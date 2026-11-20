# RF-06: Ingestión y Recepción Continua de Telemetría por MQTT en SIMOA

## 1. Biblioteca MQTT y Justificación
Se seleccionó **`paho-mqtt==2.1.0`** (cliente oficial de Eclipse Paho para Python) porque:
- Soporta `CallbackAPIVersion.VERSION2`, autenticación usuario/contraseña, reconexión automática con *backoff* exponencial (`reconnect_delay_set`) y ejecución no bloqueante en hilo de red dedicado (`loop_start()` / `loop_stop()`).
- Se integra de forma nativa con aplicaciones FastAPI síncronas/asíncronas sin requerir un framework externo adicional ni bloquear el *event loop* HTTP.

## 2. Configuración del Broker y Suscripción
- **Broker local:** Eclipse Mosquitto 2.x ([mosquitto.conf](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/mosquitto/config/mosquitto.conf)), puerto `1883`.
- **Suscripción única comodín:** `simoa/dispositivos/+/telemetria`.
- **QoS elegido:** `QoS = 1` (*at least once*). Garantiza confirmación PUBACK entre el dispositivo/backend y el broker sin la sobrecarga de 4 mensajes de QoS 2, siendo adecuado para telemetría ambiental periódica (2,5–5 s). *Nota:* MQTT con QoS 1 no garantiza cero pérdidas ante caídas prolongadas sin persistencia en el nodo emisor o almacenamiento intermedio.
- **Reconexión:** ante desconexiones inesperadas, Paho reintenta automáticamente con *backoff* configurable (`MQTT_RECONNECT_MIN_DELAY` a `MQTT_RECONNECT_MAX_DELAY`) y `on_connect` vuelve a ejecutar la suscripción a `simoa/dispositivos/+/telemetria`.

## 3. Estructura de Mensajes y Orden de Validación
Carga útil JSON aceptada:
```json
{
  "codigo": "SIMOA-ESP32-XXXXXX",
  "temperatura": 24.5,
  "humedad": 65.2,
  "timestamp": 1794575000
}
```
*(Extensible a `presion` para BME280 o cualquier magnitud registrada en RF-04/RF-05.)*

**Orden estricto de validación en `on_message`:**
1. Tópico válido con formato `simoa/dispositivos/<codigo>/telemetria`.
2. Decodificación UTF-8 y JSON objeto válido (si falla -> DLQ `JSON_MALFORMADO`).
3. Campo `codigo` presente y exactamente igual al `<codigo>` del tópico (`CODIGO_INCONSISTENTE`).
4. Dispositivo existente en RF-02 (`DISPOSITIVO_DESCONOCIDO`, nunca se crean dispositivos automáticamente) y activo (`estado != 'INACTIVO'`, RN-07 -> `DISPOSITIVO_INACTIVO`).
5. `timestamp` válido (epoch numérico finito en segundos/ms o ISO-8601 -> `TIMESTAMP_INVALIDO`).
6. Valores numéricos válidos y extensibles: se rechazan `bool`, no numéricos, `NaN` e infinitos (`VALOR_NUMERICO_INVALIDO`).
7. Sensor vinculado al dispositivo en RF-04 (nunca de otro dispositivo -> `SENSOR_NO_VINCULADO`) y operativo (`ACTIVO`; estados `FALLA`, `CALIBRACION` o `INACTIVO` se rechazan según RN-07 -> `SENSOR_NO_OPERATIVO`).
8. Variables habilitadas en RF-05 (`configuracion_variables_sensor`): política estricta de validación (`VARIABLE_NO_HABILITADA` si llega una variable deshabilitada o falta una habilitada).

## 4. Colas, Caché, DLQ y Rendimiento (RN-08)
- **Caché de metadatos (`MetadataCache`):** evita consultas MySQL en el hilo MQTT mediante caché en memoria con TTL (`MQTT_CACHE_TTL_SECONDS`) e invalidación explícita (`POST /api/mqtt/cache/invalidate`).
- **Colas internas:** el hilo MQTT normaliza a unidades estándar (`°C`, `%RH`, `hPa`) y enruta por `telemetry_queue.put_nowait(...)` hacia hilos *worker* que invocan los *hooks* de **RF-07** y **RF-13**. Si `telemetry_queue` se satura (`queue.Full`), no bloquea y registra `COLA_SATURADA` en DLQ.
- **DLQ (`mqtt_mensajes_rechazados`):** persiste rechazos sanitizados (sin credenciales ni tokens) con límite acotado (`MAX_DLQ_ROWS = 5000`) para impedir crecimiento ilimitado.
- **RN-08:** El intervalo nominal de publicación por dispositivo es de 2,5 a 5 segundos; la capacidad de ingestión del backend es independiente y soporta múltiples dispositivos concurrentes con latencia de recepción/validación/enrutamiento **< 100 ms** (medido contra Mosquitto real: promedio ~1.4 ms, p95 < 1 ms, máximo ~20.7 ms).

## 5. Integración con FastAPI y Despliegue
- Integrado en `lifespan` de [main.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/main.py) con arranque no bloqueante y cierre limpio (`disconnect()` + `loop_stop()`).
- Si se despliega con múltiples *workers* HTTP (`uvicorn --workers N`), establecer `MQTT_ENABLED=false` en los *workers* API y ejecutar una sola instancia del consumidor independiente:
  ```bash
  python -m app.mqtt_worker
  ```

## 6. Cómo probar manualmente contra Mosquitto
```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -t "simoa/dispositivos/CODIGO_REAL/telemetria" \
  -m '{"codigo":"CODIGO_REAL","temperatura":24.5,"humedad":65.2,"timestamp":1794575000}'
```
Consultar estado y métricas en `GET /api/mqtt/status` y rechazos en `GET /api/mqtt/rechazos`.
