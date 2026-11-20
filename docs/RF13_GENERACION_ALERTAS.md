# RF-13: Generación Automática de Alertas por Desborde de Límites

## 1. Arquitectura integrada en el pipeline MQTT
1. **RF-06 (`mqtt_ingest.py`)** recibe y valida el paquete MQTT contra esquema y relación dispositivo–sensor–variables; los mensajes corruptos se enrutan a la DLQ (`mqtt_mensajes_rechazados`) y nunca se evalúan como alertas ambientales.
2. **RF-07 (`measurement_persistence.py`)** almacena la medición válida en MySQL (`mediciones`) con clave de idempotencia y protección de inmutabilidad (`trg_mediciones_no_update`).
3. **RF-13 (`alerts_service.py`)** evalúa temperatura y humedad contra los umbrales vigentes de **RF-12** (`umbrales_alerta`), aplica debouncing **RN-15**, persiste en `alertas` con estado `PENDIENTE` y distribuye la notificación por SSE (`/api/alertas/stream`).

## 2. Reglas de evaluación y severidad
- **Temperatura**: dentro de `[temp_min, temp_max]` (inclusive en los límites) no se genera alerta. Fuera del rango operacional:
  - Si alcanza o supera `temp_critico_min` / `temp_critico_max` → `CRITICA`.
  - Si supera únicamente `temp_min` / `temp_max` → `ADVERTENCIA`.
- **Humedad relativa**: únicamente valores físicamente válidos en `[0, 100]` %RH. Valores `< 0` o `> 100` se registran como error de sensor/telemetría y no generan alerta ambiental.
- Si faltan los umbrales requeridos, el servicio registra advertencia de configuración sin inventar límites.

## 3. Debouncing RN-15 (ventana de 300 s persistente en MySQL)
- Se evalúa por `(sensor_id, variable, condicion)` dentro de una ventana de 300 segundos usando bloqueo transaccional `FOR UPDATE` sobre `alertas`, sobreviviendo reinicios del backend y mensajes simultáneos.
- **Independencia**: una alerta de humedad nunca se bloquea por una de temperatura del mismo sensor.
- **Escalamiento**: una alerta nueva `CRITICA` nunca se suprime por una `ADVERTENCIA` previa dentro de la ventana; se crea un nuevo registro `CRITICA`.
- **Transición normal → fuera de rango**: cuando el mismo tipo de condición ocurre tras expirar la ventana de 300 s, se genera una nueva alerta; dentro de la ventana se incrementa `ocurrencias_en_ventana` y se actualiza `ultimo_valor_detectado`.

## 4. Tolerancia a fallos de MySQL
- Ante indisponibilidad temporal de MySQL, `AlertsService` usa la última configuración conocida en caché, almacena la alerta en la cola durable SQLite (`backend/data/rf13_pending_alerts.sqlite3`), emite notificación provisional (`provisional: true`, `persistida: false`) por SSE y drena automáticamente hacia MySQL al restablecerse la conexión.
