# RF-15 · Conectividad de nodos IoT

## Configuración

RF-06 documenta una cadencia nominal de 2,5 a 5 segundos. RF-15 usa dos intervalos nominales máximos para tolerar un paquete perdido y conserva el límite de 60 segundos establecido en el SRS.

| Variable | Valor inicial | Uso |
| --- | ---: | --- |
| `RF15_NORMAL_SECONDS` | 10 s | Hasta este límite inclusive, el nodo está `ONLINE`. |
| `RF15_MAX_SILENCE_SECONDS` | 60 s | Por encima del límite normal y hasta este límite inclusive, está en `ADVERTENCIA`. Superado este límite, está `OFFLINE`. |
| `RF15_SCAN_SECONDS` | 2,5 s | Intervalo de evaluación y actualización del canal SSE. |
| `RF15_EVIDENCE_MAX_AGE_SECONDS` | 10 s | Antigüedad de origen aceptada para acreditar presencia. Ajustar junto con la cadencia y sincronización UTC de los nodos. |
| `RF15_MQTT_ACL_ENFORCED` | `false` | Habilita evidencia de conexión cuando el broker aplica autenticación y reglas de publicación por dispositivo. |
| `MQTT_TLS_CA_FILE` | vacío | Ruta local al certificado de CA para validar el broker cuando el listener usa TLS. |

El broker anónimo de desarrollo de RF-06 no acredita conectividad. Para QA y producción, configurar un listener autenticado con TLS, credenciales propias por nodo y ACL de escritura para sus dos tópicos exactos. Vincular cada credencial al `mqtt_client_id` registrado con el control de identidades del broker. La cuenta de ingestión necesita acceso de lectura a ambos comodines. Configurar sus credenciales por variables de entorno e introducir `RF15_MQTT_ACL_ENFORCED=true` después de verificar las ACL. Guardar los secretos fuera de Git.

La suscripción de RF-06 a `simoa/dispositivos/<codigo>/telemetria` se conserva. El mismo consumidor escucha `simoa/dispositivos/<codigo>/heartbeat` cuando está habilitada la evidencia autenticada. El mensaje de latido usa QoS 1, sin retención, con estas propiedades:

```json
{"codigo":"SIMOA-ESP32-EJEMPLO","mqtt_client_id":"simoa_client_simoa-esp32-ejemplo","timestamp":"2026-11-20T15:00:00Z"}
```

El consumidor valida el tópico registrado, la coincidencia del código y el identificador declarado en el latido. Paho recibe el tópico y la carga útil. La identidad de la conexión publicadora se valida en el broker. Los latidos no atraviesan RF-07 ni RF-13. Los mensajes retenidos, duplicados o con hora de captura fuera de tolerancia no renuevan el contacto. RF-07 mantiene las mediciones históricas que superen sus validaciones.

## Backend y frontend

- La migración `011_add_conectividad_rf15.sql` agrega al inventario el indicador administrativo, el estado de conectividad, `ultimo_ping` en UTC, la fecha de cambio y el historial de transiciones. `estado` sigue exponiendo el estado efectivo que usa RF-02. Un nodo sin evidencia queda `PENDIENTE`. Un nodo `INACTIVO` conserva su historial y queda excluido del monitor.
- El monitor arranca con FastAPI y evalúa el estado persistido. Usa un bloqueo de MySQL por base para que un solo proceso ejecute la evaluación a la vez. Los cambios y sus registros de auditoría se confirman en una transacción. Los paquetes válidos usan bloqueo de fila para coordinarse con el monitor y la desactivación de RF-02.
- El registro de contacto de telemetría se confirma junto con la medición de RF-07. Su cola durable conserva la hora original de recepción ante fallos de MySQL. Si no se puede registrar un latido aislado, el servicio registra el fallo y espera la siguiente señal válida del nodo. El monitor reintenta en el próximo ciclo.
- El canal SSE existente expone `GET /api/mediciones/stream/temperatura?conectividad=true` con los mismos permisos de lectura. Los eventos de conectividad son independientes de RF-13. Al reconectar, el cliente recibe el inventario vigente. Ante fallos del canal, consulta temporalmente `GET /api/dispositivos`.
- El Dashboard, el inventario y Mantenimiento Técnico muestran el estado y último contacto. Las tarjetas RF-08/RF-09 muestran ausencia de lectura cuando el dato vence. Un latido restablece la conectividad, mientras que las tarjetas requieren una medición reciente. Las gráficas conservan los huecos y el simulador de campo está limitado a Vite en modo desarrollo con activación explícita.
- RF-19/RF-20 pueden consultar identificación, ubicación, último contacto, tiempo en silencio, fecha de cambio y estado en el inventario, consultar los sensores con el endpoint de RF-04 y usar `historial_conectividad_dispositivos` para auditar desconexiones y recuperaciones.

## Verificar en QA

Usar una base y un broker de QA aislados de producción. Aplicar las migraciones al iniciar la API y provisionar un nodo registrado con sensor activo y otro nodo para verificar que la desconexión se detecta por dispositivo. Los tests modifican exclusivamente datos de prueba.

1. Iniciar la API y el broker. Cerrar el Dashboard y confirmar por la API que un nodo nuevo permanece `PENDIENTE`.
2. Publicar una medición válida desde el nodo autenticado y consultar `GET /api/dispositivos/<id>`. Registrar su `ultimo_ping` y comprobar `ONLINE`. Reenviar el mismo paquete y confirmar que el último contacto conserva su valor.
3. Interrumpir la transmisión del primer nodo. Después de 10 segundos, más el intervalo de evaluación, comprobar `ADVERTENCIA`. Mantener el silencio más de 60 segundos y comprobar `OFFLINE`. El otro nodo debe conservar su propio estado.
4. Abrir el Dashboard, el inventario y el panel técnico. Confirmar que reflejan la transición y que las tarjetas muestran `-- °C` y `-- %RH` cuando falta una lectura actual. Revisar los conteos y fechas del histórico.
5. Reconectar con un latido válido y comprobar `ONLINE` con un nuevo `ultimo_ping`. Publicar una lectura actual y confirmar que se recuperan las tarjetas. Verificar los eventos en `historial_conectividad_dispositivos`.
6. Repetir con un nodo `INACTIVO`, un cliente sin permisos y un reinicio controlado del broker. Confirmar que RF-13 conserva su canal de alertas ambientales y que ninguno de los ensayos agrega lecturas sintéticas al histórico.

Para ejecutar las pruebas automatizadas, apuntar `DB_*` a una instancia aislada con el esquema `simoa`, definir `JWT_SECRET_KEY` de pruebas y configurar `RF15_TEST_MOSQUITTO` con la ruta al ejecutable de Mosquitto. La prueba MQTT autenticada crea un listener temporal y utiliza `mosquitto_passwd` del mismo directorio.

```text
python -m pytest -q backend/tests/test_connectivity_rf15.py
npm test
npm run lint
npm run build -- --configLoader runner
```

## Evidencia local

La suite RF-15 pasó 10 pruebas con MariaDB 10.4 y Mosquitto 2.1.4. La prueba con broker autenticado rechazó la publicación de otro nodo y registró la secuencia `ONLINE → OFFLINE → ONLINE` tras detener y reiniciar el broker. La prueba de persistencia conservó el último contacto al quedar `OFFLINE`, reprodujo un microcorte y confirmó que no se añadieron lecturas durante el corte. Las 21 pruebas de frontend verificaron, entre otros casos, el aviso visual y los marcadores de falta de datos de RF-08 y RF-09.
