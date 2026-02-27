/**
 * ESP32 MQTT Publisher
 * Telecom Tower Fault Detection System
 *
 * Publishes sensor data (simulated) every 5 seconds to:
 *   telecom/{DEVICE_ID}/sensor-data
 *
 * Configure WIFI_SSID, WIFI_PASSWORD, and DEVICE_ID below.
 *
 * Required libraries (install via Arduino Library Manager):
 *   - PubSubClient by Nick O'Leary (v2.8+)
 *   - ArduinoJson by Benoit Blanchon (v6+)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ── Configuration ─────────────────────────────────────────────────────────────

// WiFi credentials — update before flashing
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Device identifier — must match the device_id created in admin panel
#define DEVICE_ID     "tower-001"

// MQTT Broker
#define MQTT_HOST     "trolley.proxy.rlwy.net"
#define MQTT_PORT     26703
#define MQTT_USERNAME "fault-monitoring-system"
#define MQTT_PASSWORD "di1u5ydet0z049vbbl08cofp6vhya45l"
#define MQTT_CLIENT_ID "esp32-" DEVICE_ID

// Publish interval (milliseconds)
#define PUBLISH_INTERVAL_MS 5000

// MQTT topic
#define TOPIC_PREFIX "telecom/"
#define TOPIC_SUFFIX "/sensor-data"

// ── Globals ───────────────────────────────────────────────────────────────────

WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

char mqttTopic[64];
unsigned long lastPublishMs = 0;
uint32_t publishCount = 0;

// ── Sensor Simulation ─────────────────────────────────────────────────────────

/**
 * In production, replace these with actual sensor reads:
 *   - Voltage: ADC / INA219 / ACS712
 *   - Current: ACS712 / INA219
 *   - Temperature: DS18B20 / DHT22 / BME280
 *   - Fan speed: Hall-effect tachometer
 *   - Humidity: DHT22 / BME280 / SHT31
 */

float readVoltage() {
  // Simulated: 45 – 55 V (normal range ~47–53 V)
  return 45.0f + (random(0, 1001) / 100.0f);
}

float readCurrent() {
  // Simulated: 10 – 15 A
  return 10.0f + (random(0, 501) / 100.0f);
}

float readTemperature() {
  // Simulated: 25 – 60 °C
  // Occasionally spike above 55 to trigger alarms
  int roll = random(0, 100);
  if (roll < 5) {
    return 55.0f + (random(0, 200) / 10.0f); // 55–75 °C spike
  }
  return 25.0f + (random(0, 3001) / 100.0f);
}

float readFanSpeed() {
  // Simulated: 400 – 1500 RPM
  // Occasionally drop below 450 to trigger alarms
  int roll = random(0, 100);
  if (roll < 5) {
    return random(100, 450); // Low fan speed
  }
  return 400.0f + random(0, 1101);
}

float readHumidity() {
  // Simulated: 40 – 90 %
  return 40.0f + (random(0, 5001) / 100.0f);
}

// ── WiFi ──────────────────────────────────────────────────────────────────────

void connectWiFi() {
  Serial.printf("\n[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++attempts >= 40) {
      Serial.println("\n[WiFi] Failed to connect. Restarting...");
      ESP.restart();
    }
  }

  Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
}

// ── MQTT ──────────────────────────────────────────────────────────────────────

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Not subscribing to any topics — placeholder for future commands
  Serial.printf("[MQTT] Message received on: %s\n", topic);
}

void connectMQTT() {
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(10);

  Serial.printf("[MQTT] Connecting to %s:%d as %s ...\n", MQTT_HOST, MQTT_PORT, MQTT_CLIENT_ID);

  uint8_t attempts = 0;
  while (!mqttClient.connected()) {
    bool ok = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
    if (ok) {
      Serial.println("[MQTT] Connected!");
      return;
    }
    Serial.printf("[MQTT] Failed (state=%d). Retry in 3s...\n", mqttClient.state());
    delay(3000);
    if (++attempts >= 10) {
      Serial.println("[MQTT] Max retries reached. Restarting...");
      ESP.restart();
    }
  }
}

void ensureConnected() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Lost connection. Reconnecting...");
    connectWiFi();
  }
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Lost connection. Reconnecting...");
    connectMQTT();
  }
}

// ── Publish ───────────────────────────────────────────────────────────────────

void publishSensorData() {
  float voltage     = readVoltage();
  float current     = readCurrent();
  float temperature = readTemperature();
  float fan_speed   = readFanSpeed();
  float humidity    = readHumidity();

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["voltage"]     = serialized(String(voltage, 2));
  doc["current"]     = serialized(String(current, 2));
  doc["temperature"] = serialized(String(temperature, 1));
  doc["fan_speed"]   = serialized(String(fan_speed, 0));
  doc["humidity"]    = serialized(String(humidity, 1));
  doc["device_id"]   = DEVICE_ID;
  doc["seq"]         = publishCount;

  char payload[256];
  size_t payloadLen = serializeJson(doc, payload);

  bool sent = mqttClient.publish(mqttTopic, payload, payloadLen);

  if (sent) {
    publishCount++;
    Serial.printf(
      "[PUB #%u] %s => V:%.2fV I:%.2fA T:%.1f°C FAN:%.0fRPM H:%.1f%%\n",
      publishCount, mqttTopic, voltage, current, temperature, fan_speed, humidity
    );
  } else {
    Serial.printf("[PUB] Failed to publish! MQTT state: %d\n", mqttClient.state());
  }
}

// ── Setup & Loop ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("===========================================");
  Serial.println("  Telecom Tower MQTT Publisher");
  Serial.printf("  Device ID : %s\n", DEVICE_ID);
  Serial.printf("  Broker    : %s:%d\n", MQTT_HOST, MQTT_PORT);
  Serial.println("===========================================");

  // Build MQTT topic once
  snprintf(mqttTopic, sizeof(mqttTopic), "%s%s%s", TOPIC_PREFIX, DEVICE_ID, TOPIC_SUFFIX);
  Serial.printf("  Topic     : %s\n\n", mqttTopic);

  randomSeed(esp_random()); // True hardware random seed on ESP32

  connectWiFi();
  connectMQTT();
}

void loop() {
  ensureConnected();
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    publishSensorData();
  }
}
