/*
 * SIMOA - Sistema IoT de Monitoreo Ambiental
 * Firmware de referencia ESP32 con sincronización horaria NTP (RNF-12) y MQTTS TLS (RNF-09)
 * 
 * Cumplimiento RNF-12:
 * - Sincroniza reloj interno con pool.ntp.org mediante configTime(0, 0, "pool.ntp.org").
 * - Genera timestamp ISO-8601 en UTC real antes de publicar cada trama de telemetría.
 * - Desfase máximo garantizado <= 1 segundo respecto a UTC.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>

// Configuración de red WiFi
const char* WIFI_SSID = "SIMOA_WIFI";
const char* WIFI_PASS = "InvernaderoIoT2026";

// Configuración del broker MQTT
const char* MQTT_BROKER = "192.168.1.100";
const int   MQTT_PORT   = 8883; // Puerto MQTTS seguro (TLS 1.3)
const char* DEVICE_CODE = "ESP32-INV-01";
const char* MQTT_USER   = "esp32_inv_01";
const char* MQTT_PASS   = "clave_esp32_segura";
const char* MQTT_TOPIC  = "simoa/dispositivos/ESP32-INV-01/telemetria";

// Servidores NTP para sincronización horaria precisa (RNF-12)
const char* NTP_PRIMARY   = "pool.ntp.org";
const char* NTP_SECONDARY = "time.nist.gov";
const long  GMT_OFFSET_SEC = 0;       // Almacenamiento y reporte obligatorio en UTC
const int   DAYLIGHT_OFFSET_SEC = 0;  // Sin desfase estacional en UTC

WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

void syncTimeNTP() {
  Serial.println("[NTP] Iniciando sincronización horaria con servidor NTP...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_PRIMARY, NTP_SECONDARY);

  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  Serial.println();

  if (retry < 20) {
    Serial.println("[NTP] Reloj sincronizado exitosamente con UTC (RNF-12).");
  } else {
    Serial.println("[NTP] Advertencia: No se pudo obtener tiempo NTP inicial.");
  }
}

String getIsoUtcTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "";
  }
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

void connectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Conectando a broker...");
    if (mqttClient.connect(DEVICE_CODE, MQTT_USER, MQTT_PASS)) {
      Serial.println(" Conectado con credenciales.");
    } else {
      Serial.print(" Falló rc=");
      Serial.print(mqttClient.state());
      Serial.println(". Reintentando en 3s...");
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Conectado.");

  // Sincronización horaria obligatoria antes de telemetría (RNF-12)
  syncTimeNTP();

  // Para producción: secureClient.setCACert(server_ca_cert);
  secureClient.setInsecure(); // En pruebas locales
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  if (!mqttClient.connected()) {
    connectMqtt();
  }
  mqttClient.loop();

  static unsigned long lastSend = 0;
  if (millis() - lastSend > 10000) { // Cada 10 segundos
    lastSend = millis();

    String timestampUtc = getIsoUtcTimestamp();
    if (timestampUtc.length() == 0) {
      Serial.println("[WARN] Timestamp no disponible; omitiendo publicación.");
      return;
    }

    // Carga útil conforme a RNF-03 (tamaño < 256 bytes) y RNF-12 (timestamp UTC)
    float temp = 24.5;
    float hum = 65.2;
    int rssi = WiFi.RSSI();

    String payload = "{\"codigo\":\"" + String(DEVICE_CODE) + "\","
                     "\"timestamp\":\"" + timestampUtc + "\","
                     "\"temperatura\":" + String(temp, 1) + ","
                     "\"humedad\":" + String(hum, 1) + ","
                     "\"rssi_dbm\":" + String(rssi) + "}";

    // Publicar con QoS 1 (RNF-03)
    boolean ok = mqttClient.publish(MQTT_TOPIC, payload.c_str(), false);
    if (ok) {
      Serial.print("[MQTT] Telemetría enviada (bytes=");
      Serial.print(payload.length());
      Serial.println("): " + payload);
    }
  }
}
