# SIMOA · Sistema Inteligente de Monitoreo Ambiental (IoT)

Plataforma web de monitoreo ambiental para recintos críticos (laboratorios, bioterios, invernaderos y cadena de frío) que integra telemetría simulada de nodos **ESP32** y sensores **DHT22 / BME280 / SHT31**, control estadístico de anomalías (**Z-Score 3σ** e **Isolation Forest**), gestión de alertas con *debouncing* de 5 minutos y diagnóstico asistido por IA.

> **Nota sobre el alcance de demostración:** Este proyecto funciona como prototipo/observatorio interactivo. El inicio de sesión, el almacenamiento en caché tipo Redis, la trazabilidad OpenTelemetry y el flujo de telemetría MQTTS se ejecutan en memoria del navegador y mediante un servidor Express local para fines académicos y de demostración; **no está configurado para despliegue directo en producción**.

---

## Requisitos previos

- **Node.js** 20 o superior
- **npm** 10 o superior
- *(Opcional)* Variable de entorno `GEMINI_API_KEY` si deseas conectar el panel de diagnóstico con la API real de Google Gemini (de lo contrario usa diagnóstico determinístico local).

## Instalación y ejecución

1. Clonar el repositorio e instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar la aplicación en modo desarrollo (Vite):
   ```bash
   npm run dev
   ```
   Disponible en `http://localhost:3000`.

3. *(Opcional)* Iniciar el servidor Express BFF local en paralelo (puerto `3001`, conectado automáticamente mediante el proxy `/api` de Vite):
   ```bash
   npm run server
   ```

4. Ejecutar las pruebas unitarias del motor de telemetría y anomalías:
   ```bash
   npm test
   ```

5. Verificar tipos y generar compilación de producción:
   ```bash
   npm run lint
   npm run build
   ```

## Estructura principal

- `src/components/landing/`: Portada pública y fondo interactivo 3D con Three.js.
- `src/components/dashboard/`: Tablero en vivo, métricas de temperatura/humedad y gráficas SVG.
- `src/components/devices/`: Gestión de nodos ESP32, sensores y umbrales.
- `src/components/alerts/`: Gestor de alertas con control anti-rebote (*debouncing*).
- `src/components/analytics/`: Histórico de mediciones y exportación CSV/JSON.
- `src/components/ai/`: Panel de diagnóstico de anomalías.
- `src/services/`: Motor de telemetría (`telemetryEngine.ts`), almacenamiento local (`storage.ts`), servicio IA (`geminiService.ts`) y simulador de rendimiento en memoria (`performanceEngine.ts`).
- `server.ts`: Servidor Express de demostración local (`/api/v1/devices`, `/api/v1/alerts`).
- `docs/`: Especificación de Requerimientos de Software ([SRS_SIMOA.md](./docs/SRS_SIMOA.md)) y casos de uso consolidados ([CASOS_DE_USO_SIMOA.md](./docs/CASOS_DE_USO_SIMOA.md)).
- `tests/`: Pruebas unitarias del motor de telemetría.

*(Nota: Si clonaste el repositorio con el nombre `Sistema_oit_de_monitoreo_ambiental`, recuerda que se trata de un error tipográfico menor de `iot` en el nombre remoto de GitHub).*
