# RF-09: Visualización en Tiempo Real de la Humedad Relativa (%RH)

## 1. Integración con RF-08, RF-06 y RF-07
- Comparte la misma selección de ubicación, el mismo flujo MQTT (RF-06), la misma confirmación transaccional en MySQL (RF-07) y la **misma suscripción SSE** (`/api/mediciones/stream/temperatura?ubicacion_id=...`) mediante el evento `humedad` y `humedad_snapshot` en `snapshot`.
- Reutiliza `compute_variable_zscore`, `evaluate_range_state` y `select_variable_sensor_for_location` en [live_telemetry.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/services/live_telemetry.py), preservando `sensor_id` y `fecha_hora_utc` propios cuando temperatura y humedad provienen de sensores distintos.

## 2. Validación Física (`0 <= humedad <= 100 %RH`)
- Tanto el consumidor MQTT ([mqtt_ingest.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/services/mqtt_ingest.py)) como el persistidor RF-07 ([measurement_persistence.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/services/measurement_persistence.py)) rechazan cualquier humedad `< 0` o `> 100` antes del almacenamiento y visualización, registrando el incidente en `mqtt_mensajes_rechazados` (`LECTURA_FISICA_INVALIDA`) como anomalía de calidad de datos sin generar alertas ambientales por umbral.

## 3. Tarjeta KPI, Umbrales y Z-Score Higrométrico (RN-11)
- [HumidityKpiCard.tsx](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/src/components/dashboard/HumidityKpiCard.tsx) muestra el valor en `%RH`, `Rango óptimo: hum_min % - hum_max %` (desde `umbrales_alerta` o `"Sin configuración"`), estado `NOMINAL` / `FUERA DE RANGO`, barra proporcional `0 % - 100 %` y Z-Score higrométrico real (`No disponible` si `< 5` lecturas o $\sigma = 0$).
- Sin lecturas recientes (antigüedad > `30 s`), sensor desconectado o pérdida de stream SSE, muestra **`-- %RH`** y **`ESPERANDO DATOS`**.
