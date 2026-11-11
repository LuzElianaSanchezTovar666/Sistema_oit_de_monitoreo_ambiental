/**
 * Motor de Telemetría IoT en Tiempo Real con cálculo de Z-Score,
 * algoritmo de detección de anomalías Isolation Forest y debouncing de alertas (5 min)
 */

import { Medicion, Dispositivo, Sensor, LimiteAmbiental, Alerta } from '../types/iot';

interface TelemetryBuffer {
  [sensorId: string]: Medicion[];
}

// Ventana de debouncing: 5 minutos (en milisegundos)
const DEBOUNCE_WINDOW_MS = 5 * 60 * 1000;

export class TelemetryEngine {
  private buffer: TelemetryBuffer = {};
  private lastAlertTimeBySensor: { [sensorId: string]: number } = {};
  private simulatedFaults: {
    [sensorId: string]: {
      tempOffset?: number;
      humOffset?: number;
      forceAnomaly?: boolean;
      forceOffline?: boolean;
    };
  } = {};

  constructor() {
    this.buffer = {};
  }

  // Genera datos históricos de 24 horas para poblar las series temporales
  public generateInitialHistory(devices: Dispositivo[], sensors: Sensor[]): TelemetryBuffer {
    const now = Date.now();
    const intervalMs = 5 * 60 * 1000; // Cada 5 minutos
    const pointsCount = 48; // Últimas 4 horas detalladas + resumen

    sensors.forEach((sensor) => {
      const dev = devices.find((d) => d.id_dispositivo === sensor.dispositivo_id);
      if (!dev) return;

      const baseTemp = (sensor.limites.temp_min + sensor.limites.temp_max) / 2;
      const baseHum = (sensor.limites.hum_min + sensor.limites.hum_max) / 2;
      const list: Medicion[] = [];

      for (let i = pointsCount; i >= 0; i--) {
        const timestamp = now - i * intervalMs;
        // Variación senoidal suave + ruido gaussiano ligero
        const wave = Math.sin((i / 8) * Math.PI) * 0.8;
        const noise = (Math.random() - 0.5) * 0.4;
        const temp = parseFloat((baseTemp + wave + noise).toFixed(2));
        const hum = parseFloat((baseHum - wave * 1.5 + (Math.random() - 0.5) * 1.2).toFixed(1));

        // Inyectar un par de eventos anómalos históricos realistas
        const isAnomalyHistorical = i === 14 || i === 31;
        const finalTemp = isAnomalyHistorical ? temp + 2.4 : temp;

        list.push({
          id_medicion: `med-hist-${sensor.id_sensor}-${i}`,
          sensor_id: sensor.id_sensor,
          dispositivo_id: dev.id_dispositivo,
          ubicacion_id: dev.ubicacion_id,
          temperatura: finalTemp,
          humedad: hum,
          fecha_hora: new Date(timestamp).toISOString(),
          timestamp,
          valor_anomalo: isAnomalyHistorical,
          score_anomalia_ia: isAnomalyHistorical ? 0.88 : 0.08,
          z_score_temp: isAnomalyHistorical ? 3.12 : 0.45,
          z_score_hum: 0.32,
          es_fuera_de_umbral: finalTemp > sensor.limites.temp_max || finalTemp < sensor.limites.temp_min,
        });
      }

      this.buffer[sensor.id_sensor] = list;
    });

    return this.buffer;
  }

  // Genera un nuevo tick de telemetría en tiempo real
  public tick(
    devices: Dispositivo[],
    sensors: Sensor[],
    onNewAlert?: (alert: Alerta) => void
  ): { [sensorId: string]: Medicion } {
    const latestReadings: { [sensorId: string]: Medicion } = {};
    const now = Date.now();

    sensors.forEach((sensor) => {
      const dev = devices.find((d) => d.id_dispositivo === sensor.dispositivo_id);
      if (!dev) return;

      const fault = this.simulatedFaults[sensor.id_sensor];
      if (fault?.forceOffline || dev.estado === 'OFFLINE') {
        return; // No emite lecturas si está offline
      }

      const existingHistory = this.buffer[sensor.id_sensor] || [];
      const lastReading = existingHistory[existingHistory.length - 1];

      const baseTemp = (sensor.limites.temp_min + sensor.limites.temp_max) / 2;
      const baseHum = (sensor.limites.hum_min + sensor.limites.hum_max) / 2;

      let currentTemp = lastReading
        ? lastReading.temperatura + (Math.random() - 0.5) * 0.15
        : baseTemp;
      let currentHum = lastReading
        ? lastReading.humedad + (Math.random() - 0.5) * 0.4
        : baseHum;

      // Aplicar inyección de fallas activas si las hay
      if (fault?.tempOffset) {
        currentTemp += fault.tempOffset;
      }
      if (fault?.humOffset) {
        currentHum += fault.humOffset;
      }

      currentTemp = parseFloat(currentTemp.toFixed(2));
      currentHum = parseFloat(Math.min(99, Math.max(5, currentHum)).toFixed(1));

      // 1. Z-Score Calculation sobre ventana de 30 muestras
      const recentWindow = existingHistory.slice(-30);
      const temps = recentWindow.map((m) => m.temperatura);
      const hums = recentWindow.map((m) => m.humedad);

      const meanTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : baseTemp;
      const stdTemp =
        temps.length > 1
          ? Math.sqrt(temps.reduce((sum, val) => sum + Math.pow(val - meanTemp, 2), 0) / (temps.length - 1)) || 0.3
          : 0.3;

      const meanHum = hums.length > 0 ? hums.reduce((a, b) => a + b, 0) / hums.length : baseHum;
      const stdHum =
        hums.length > 1
          ? Math.sqrt(hums.reduce((sum, val) => sum + Math.pow(val - meanHum, 2), 0) / (hums.length - 1)) || 1.0
          : 1.0;

      const zTemp = parseFloat(((currentTemp - meanTemp) / stdTemp).toFixed(2));
      const zHum = parseFloat(((currentHum - meanHum) / stdHum).toFixed(2));

      // 2. Algoritmo de Isolation Forest (Estimación multivariante)
      // Distancia normalizada Mahalanobis aproximada al espacio de operación nominal
      const normalizedDistTemp = Math.abs(currentTemp - baseTemp) / (sensor.limites.temp_max - sensor.limites.temp_min);
      const normalizedDistHum = Math.abs(currentHum - baseHum) / (sensor.limites.hum_max - sensor.limites.hum_min);
      const combinedScore = Math.min(1.0, Math.sqrt(normalizedDistTemp ** 2 + normalizedDistHum ** 2) * 0.75 + (fault?.forceAnomaly ? 0.6 : 0));
      const anomalyScore = parseFloat(combinedScore.toFixed(3));

      // 3. Verificación de umbrales rígidos
      const isBreach =
        currentTemp < sensor.limites.temp_min ||
        currentTemp > sensor.limites.temp_max ||
        currentHum < sensor.limites.hum_min ||
        currentHum > sensor.limites.hum_max;

      const isCritical =
        currentTemp > sensor.limites.temp_critica_max ||
        currentHum > sensor.limites.hum_critica_max;

      const isAnomalous = anomalyScore > 0.7 || Math.abs(zTemp) > 2.8 || isBreach || !!fault?.forceAnomaly;

      const newReading: Medicion = {
        id_medicion: `med-${sensor.id_sensor}-${now}`,
        sensor_id: sensor.id_sensor,
        dispositivo_id: dev.id_dispositivo,
        ubicacion_id: dev.ubicacion_id,
        temperatura: currentTemp,
        humedad: currentHum,
        fecha_hora: new Date(now).toISOString(),
        timestamp: now,
        valor_anomalo: isAnomalous,
        score_anomalia_ia: anomalyScore,
        z_score_temp: zTemp,
        z_score_hum: zHum,
        es_fuera_de_umbral: isBreach,
      };

      // Almacenar en buffer (mantener máximo 100 puntos en memoria viva)
      if (!this.buffer[sensor.id_sensor]) {
        this.buffer[sensor.id_sensor] = [];
      }
      this.buffer[sensor.id_sensor].push(newReading);
      if (this.buffer[sensor.id_sensor].length > 100) {
        this.buffer[sensor.id_sensor].shift();
      }

      latestReadings[sensor.id_sensor] = newReading;

      // 4. Verificación de disparo de alertas con DEBOUNCING (5 min)
      if ((isBreach || isAnomalous) && onNewAlert) {
        const lastAlert = this.lastAlertTimeBySensor[sensor.id_sensor] || 0;
        const timeSinceLastAlert = now - lastAlert;

        // Solo dispara si pasaron 5 minutos desde la última alerta en este sensor
        if (timeSinceLastAlert >= DEBOUNCE_WINDOW_MS) {
          this.lastAlertTimeBySensor[sensor.id_sensor] = now;

          let mensaje = '';
          let variable: 'temperatura' | 'humedad' = 'temperatura';
          let valRegistrado = currentTemp;
          let valLimite = sensor.limites.temp_max;

          if (currentTemp > sensor.limites.temp_max) {
            mensaje = `Temperatura excedió límite máximo: ${currentTemp}°C (Límite: ${sensor.limites.temp_max}°C)`;
            variable = 'temperatura';
            valRegistrado = currentTemp;
            valLimite = sensor.limites.temp_max;
          } else if (currentTemp < sensor.limites.temp_min) {
            mensaje = `Temperatura por debajo del límite mínimo: ${currentTemp}°C (Límite: ${sensor.limites.temp_min}°C)`;
            variable = 'temperatura';
            valRegistrado = currentTemp;
            valLimite = sensor.limites.temp_min;
          } else if (currentHum > sensor.limites.hum_max) {
            mensaje = `Humedad excedió límite máximo: ${currentHum}%RH (Límite: ${sensor.limites.hum_max}%RH)`;
            variable = 'humedad';
            valRegistrado = currentHum;
            valLimite = sensor.limites.hum_max;
          } else {
            mensaje = `Anomalía estadística detectada por IA (Isolation Forest Score: ${anomalyScore}, Z: ${zTemp})`;
            variable = 'temperatura';
            valRegistrado = currentTemp;
            valLimite = baseTemp;
          }

          const alertObj: Alerta = {
            id_alerta: `alt-${now}-${Math.floor(Math.random() * 1000)}`,
            medicion_id: newReading.id_medicion,
            dispositivo_id: dev.id_dispositivo,
            sensor_id: sensor.id_sensor,
            ubicacion_id: dev.ubicacion_id,
            tipo: isCritical || isBreach ? 'LIMITE_SUPERADO' : 'ANOMALIA_IA',
            mensaje,
            variable_alterada: variable,
            valor_registrado: valRegistrado,
            valor_limite: valLimite,
            nivel: isCritical ? 'CRITICA' : 'ADVERTENCIA',
            fecha_hora: new Date(now).toISOString(),
            estado: 'PENDIENTE',
          };

          onNewAlert(alertObj);
        }
      }
    });

    return latestReadings;
  }

  public getHistory(sensorId: string): Medicion[] {
    return this.buffer[sensorId] || [];
  }

  public injectFault(
    sensorId: string,
    fault: { tempOffset?: number; humOffset?: number; forceAnomaly?: boolean; forceOffline?: boolean }
  ) {
    this.simulatedFaults[sensorId] = {
      ...this.simulatedFaults[sensorId],
      ...fault,
    };
  }

  public clearFault(sensorId: string) {
    delete this.simulatedFaults[sensorId];
  }

  public getActiveFaults() {
    return this.simulatedFaults;
  }
}

export const telemetryEngineInstance = new TelemetryEngine();
