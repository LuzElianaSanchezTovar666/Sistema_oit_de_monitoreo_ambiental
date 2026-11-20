# RF-08: Visualización en Tiempo Real de la Temperatura Actual (°C)

## 1. Selección de Sensor por Ubicación
La función `select_temperature_sensor_for_location` en [live_telemetry.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/services/live_telemetry.py) aplica la regla determinística:
1. Filtra sensores vinculados a dispositivos de la `ubicacion_id` seleccionada cuyo dispositivo no esté `INACTIVO`.
2. Exige soporte térmico en `MODEL_CAPABILITIES` (RF-04) y `temperatura_habilitada = 1` en `configuracion_variables_sensor` (RF-05).
3. Prioriza el primer sensor en estado `ACTIVO` (`fecha_creacion DESC, id_sensor ASC`); si ninguno está `ACTIVO`, selecciona el primero vinculado para reportar estado desconectado/`ESPERANDO DATOS` sin mezclar lecturas ni calcular promedios entre sensores distintos.

## 2. Flujo en Tiempo Real (SSE post-COMMIT)
1. Dispositivo IoT publica en `simoa/dispositivos/<codigo>/telemetria` (MQTT).
2. **RF-06** valida y enruta a `telemetry_queue`.
3. **RF-07** persiste en MySQL dentro de una transacción atómica (`COMMIT`).
4. **Solo después del `COMMIT`**, `LiveTemperatureBroadcaster.publish_from_rf07_event` construye el snapshot RF-08 y lo envía por **SSE** (`GET /api/mediciones/stream/temperatura?ubicacion_id=...`) autenticado mediante JWT/cookie HttpOnly (RF-01).
5. [TemperatureKpiCard.tsx](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/src/components/dashboard/TemperatureKpiCard.tsx) dentro de [LiveTelemetryView.tsx](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/src/components/dashboard/LiveTelemetryView.tsx) actualiza temperatura (`°C` con 1 decimal), estado, indicador y Z-Score, limpiando inmediatamente los datos y cerrando el `EventSource` previo al cambiar de ubicación.

## 3. Evaluación Térmica, Z-Score e Indicador Visual
- **Estado térmico:** `NOMINAL` si `temp_min <= T <= temp_max`; `FUERA DE RANGO` si es menor que `temp_min` o mayor que `temp_max`; `Sin configuración` si no existen límites reales en `umbrales_alerta`.
- **Z-Score estadístico (RF-08):** $Z = (T_{\text{actual}} - \mu) / \sigma$ calculado sobre las últimas `30` mediciones reales válidas de temperatura del mismo `sensor_id` en MySQL (`mínimo = 5`). Si hay `< 5` lecturas o $\sigma = 0$, devuelve `"No disponible"` (independiente de `score_anomalia_ia` de RF-18).
- **Indicador térmico:** Escala acotada `[temp_min - margen, temp_max + margen]` con `margen = max(2, (temp_max - temp_min) * 0.25)` y posición acotada a `[0%, 100%]` (`computeThermalGaugeGeometry`).
- **Frescura y desconexión:** `RF08_FRESHNESS_MAX_SECONDS = 30` (6× el intervalo nominal máximo de 5 s en RN-08). Si no hay lecturas recientes, el sensor está desconectado (`FALLA`/`CALIBRACION`/`INACTIVO`) o se pierde el stream SSE, muestra **`-- °C`** y **`ESPERANDO DATOS`** y reconecta automáticamente.
