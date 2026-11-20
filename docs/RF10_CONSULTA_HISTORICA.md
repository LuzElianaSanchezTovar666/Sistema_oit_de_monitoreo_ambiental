# RF-10: Consulta y Filtrado Histórico de Mediciones

## 1. Endpoint y Parámetros
- **Ruta:** `GET /api/mediciones/historico` ([mediciones.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/routers/mediciones.py))
- **Autenticación:** JWT / cookie HttpOnly (RF-01) para `Administrador`, `Operador`, `Técnico` y `Supervisor`.
- **Parámetros:** `fecha_inicio`, `fecha_fin`, `tz_offset_minutes`, `ubicacion_id`, `dispositivo_id`, `sensor_id`, `page` (default `1`), `page_size` (default `20`, máximo estricto `100`).

## 2. Manejo de Fechas y Zona Horaria (UTC)
- Si `fecha_inicio > fecha_fin`, frontend y backend rechazan la consulta con el mensaje exacto: `"La fecha inicial no puede ser mayor a la final"`.
- Las fechas `YYYY-MM-DD` se convierten a UTC usando `tz_offset_minutes` (`00:00` local para inicio inclusivo `>=` y `00:00` del día siguiente local para fin exclusivo `<`), incluyendo completo el último día sin alterar los timestamps UTC almacenados en MySQL.

## 3. SQL, Índices, Paginación (RN-12) y Estadísticas
- **Consultas:** Parametrizadas (`%s`) con `ORDER BY m.fecha_hora DESC, m.sensor_id ASC, m.id_medicion DESC`, reutilizando `idx_mediciones_sensor_fecha`, `idx_mediciones_disp_fecha` e `idx_mediciones_ubicacion_fecha`.
- **Estadísticas consolidadas sobre TODO el conjunto filtrado:**
  - Temperatura y Humedad por separado: `MIN`, `MAX`, `AVG` y desviación estándar **muestral** (`STDDEV_SAMP`, `0.0` con 1 muestra, `None` con 0).
  - Cumplimiento ambiental (`evaluacion_combinada_rf07`): `(mediciones_conformes / mediciones_evaluables) * 100` usando únicamente `es_fuera_de_umbral` persistido en RF-07.

## 4. Interfaz React
- [HistoricalAnalytics.tsx](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/src/components/analytics/HistoricalAnalytics.tsx) implementa selectores dependientes (`Ubicación -> Dispositivo -> Sensor`), cancelación de peticiones previas con `AbortController` (RN-12), `SkeletonLoader`, tarjetas KPI y tabla paginada de solo lectura (RN-09).
