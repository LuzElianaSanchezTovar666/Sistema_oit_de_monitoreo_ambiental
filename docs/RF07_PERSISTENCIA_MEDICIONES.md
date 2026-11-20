# RF-07: Almacenamiento Persistente de Mediciones en Base de Datos

## 1. Estructura de Tabla, Migración e Índices
Reutiliza la tabla `mediciones` mediante la migración idempotente [007_extend_mediciones_rf07.sql](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/migrations/007_extend_mediciones_rf07.sql) sin eliminar registros previos:
- **Clave primaria:** `id_medicion` (`BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`).
- **Relaciones:** `fk_mediciones_dispositivo` -> `dispositivos(id_dispositivo)` y `fk_mediciones_sensor` -> `sensores(id_sensor)` (`ON UPDATE CASCADE ON DELETE RESTRICT`).
- **Campos RF-07 añadidos:**
  - `es_fuera_de_umbral` (`TINYINT(1) NULL`): `1`/`0` cuando existen límites configurados en `umbrales_alerta` (RF-04/RF-12); **`NULL`** cuando no existen límites configurados (nunca se marca como normal artificialmente).
  - `score_anomalia_ia` (`DECIMAL(6,4) NULL`): **`NULL`** hasta la integración del motor de anomalías **RF-18** (sin resultados ficticios).
  - `clave_idempotencia` (`VARCHAR(80) NULL UNIQUE KEY uq_mediciones_idempotencia`): garantiza inserciones idempotentes ante reintentos.
- **Índice compuesto:** `idx_mediciones_sensor_fecha (sensor_id, fecha_hora)` verificado con `EXPLAIN`.

## 2. Flujo Integrado RF-06 -> RF-07 -> Suscriptores en Vivo
1. El consumidor MQTT (RF-06) valida y normaliza el paquete en `< 100 ms` y lo deposita en `telemetry_queue`.
2. El *worker* de [mqtt_ingest.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/services/mqtt_ingest.py) invoca primero a `measurement_persister.persist_event(event)` ([measurement_persistence.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/services/measurement_persistence.py)).
3. RF-07 ejecuta la transacción atómica (`COMMIT` / `ROLLBACK`) usando el *pool* de conexiones MySQL de [database.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_AMBIENTAL/backend/app/database.py).
4. **Solo después** de confirmar el `COMMIT` en MySQL, RF-06 libera el evento a los suscriptores en vivo / **RF-13**.

## 3. Estrategia UTC
- Todos los `timestamp` se normalizan a **UTC** (`DATETIME` sin desfase local) antes de persistir en `mediciones.fecha_hora`.
- Los endpoints de consulta (`GET /api/mediciones`, `GET /api/mediciones/{id}`) devuelven `fecha_hora_utc` en formato ISO-8601 con sufijo `Z`. Las consultas o el frontend pueden convertir a la zona horaria del usuario para visualización sin alterar jamás el valor UTC original almacenado en MySQL.

## 4. Idempotencia, Fallos de MySQL y Recuperación Durable
- **Idempotencia:** Si el mensaje incluye `message_id`, se usa `msg:<message_id>`; en caso contrario se calcula SHA-256 determinístico sobre `(sensor_id, fecha_hora_utc, magnitudes)`. Colisiones por reintento (`IntegrityError 1062`) se resuelven como éxito idempotente sin duplicar filas ni descartar mediciones legítimas con distinto `timestamp`.
- **Buffer durable y backoff exponencial acotado:** Si MySQL cae (`OperationalError` / `InterfaceError`), se ejecuta `ROLLBACK`, se reintenta brevemente con backoff exponencial acotado (`RF07_BACKOFF_BASE_SECONDS` hasta `RF07_BACKOFF_MAX_SECONDS`), y si persiste la caída, la medición se conserva en un buffer durable local en **SQLite WAL** (`backend/data/rf07_pending_buffer.sqlite3`, tope `10000` registros). Al restablecerse MySQL (incluso tras reinicio del proceso), `_recovery_loop` drena automáticamente las mediciones pendientes en orden FIFO.

## 5. Inmutabilidad (RN-09) y Compatibilidad Futura
- **RN-09:** No existen endpoints `PUT`, `PATCH` ni `DELETE` en [mediciones.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/routers/mediciones.py) y el trigger MySQL `trg_mediciones_no_update` bloquea cualquier `UPDATE` sobre `mediciones`. Para producción se documenta otorgar únicamente `SELECT, INSERT` sobre `simoa.mediciones` al usuario de aplicación.
- **Compatibilidad:** `GET /api/mediciones` expone filtros por `sensor_id`, `dispositivo_id`, `ubicacion_id`, `desde`, `hasta` y `limit` listos para **RF-10**, **RF-11**, **RF-16** y **RF-18**.

## 6. Rendimiento Medido y Limitaciones Conocidas
- **Entorno:** Windows local, MariaDB `10.4.32` (`127.0.0.1:3306`), pool de conexiones PyMySQL (`maxsize=12`).
- **Resultados reales (`test_persistence_rf07.py`, 27 inserciones):** `avg = 0.427 ms`, `p95 = 0.559 ms`, `max = 0.675 ms` (objetivo `< 50 ms` cumplido).
- **Limitaciones conocidas:** Si el disco local donde reside `rf07_pending_buffer.sqlite3` supera el tope de `10000` mediciones durante una caída prolongada de MySQL, las nuevas entradas adicionales se rechazan para proteger el almacenamiento; `score_anomalia_ia` permanece en `NULL` hasta implementar **RF-18**.
