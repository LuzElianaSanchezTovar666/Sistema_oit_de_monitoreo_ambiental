# RF-11: Generación de Gráficos de Tendencia Dinámicos

## 1. Tecnología Gráfica Elegida (SVG Nativo vs SRS)
- **Elección:** Gráficos **SVG nativos en React** ([TrendChartPanel.tsx](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/src/components/analytics/TrendChartPanel.tsx)), coherentes con `TelemetryChart.tsx` del Dashboard principal.
- **Justificación respecto al SRS:** El proyecto no tiene instalada ninguna biblioteca Canvas/Chart.js; `Chart.js` renderiza en Canvas por defecto, mientras que RF-11 exige representación SVG. Usar SVG nativo en React 19 evita instalar bibliotecas redundantes, garantiza nitidez vectorial, interacción táctil/teclado accesible, respeto de `prefers-reduced-motion` (`motion-reduce:transition-none`) y cero conflictos de dependencias.

## 2. Endpoint, Series Temporales y Reducción de Volumen
- **Endpoint:** `GET /api/mediciones/tendencias` ([mediciones.py](file:///c:/Users/Aprendiz/Documents/Sistema_oit_de_monitoreo_ambiental/backend/app/routers/mediciones.py)) reutiliza autenticación RF-01, filtros RF-10 y conversión local→UTC.
- **Orden y reducción (`_downsample_preserving_extremes`):** Consulta cronológica ascendente; si el volumen supera `max_points` (predeterminado `300`), divide en cubetas conservando primer/último punto, mínimos, máximos, mediciones fuera de umbral y anomalías IA.
- **Límites reales y vigencia:** Se leen de `umbrales_alerta` junto a `fecha_actualizacion` (`vigencia_completa` / `vigente_desde_utc`), sin aplicar umbrales actuales a períodos anteriores cuando hay cambio posterior.

## 3. Gráficos Independientes, Anomalías y Datos Insuficientes
- Dos gráficos independientes: **Temperatura (°C)** y **Humedad Relativa (%RH)** (escala acotada a `[0, 100]` %RH).
- Distingue visualmente **fuera de umbral** (círculo rojo `#DC2626`) de **anomalía IA RF-18** (rombo violeta `#7C3AED`, sin inventar anomalías cuando `score_anomalia_ia` es `NULL`).
- Con `< 2` mediciones válidas muestra exactamente: *"Recolección inicial de datos en curso. Aún no hay suficientes mediciones para visualizar una tendencia"* (mostrando el valor único si existe `1` lectura, sin línea de tendencia).
