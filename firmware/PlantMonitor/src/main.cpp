#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_wifi.h> 
#include "Adafruit_SHT4x.h"
#include "Adafruit_VEML7700.h"
#include "Adafruit_seesaw.h"
#include "Adafruit_MAX1704X.h" 

// --- CONFIGURATION ---
const char* WIFI_SSID = "Shore_House_2.4";
const char* WIFI_PASS = "diving5948"; // <--- Update this!
String SERVER_IP      = "10.0.0.12";          
const int SERVER_PORT = 5001;

// --- PINS ---
#define INTERNAL_SDA 8
#define INTERNAL_SCL 9
#define EXTERNAL_SDA 3
#define EXTERNAL_SCL 5
#define PUMP_PIN     4

// --- TIMING ---
#define uS_TO_S_FACTOR 1000000ULL  
#define TIME_TO_SLEEP  10          // 10 Seconds for testing

// --- MEMORY (Survives Deep Sleep) ---
RTC_DATA_ATTR int32_t channel_store = 0;
RTC_DATA_ATTR bool    config_saved = false;

// --- OBJECTS ---
Adafruit_SHT4x sht4 = Adafruit_SHT4x();
Adafruit_VEML7700 veml = Adafruit_VEML7700();
Adafruit_seesaw ss(&Wire1);
Adafruit_MAX17048 maxlipo; 

void resetRadio() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  esp_wifi_stop();
  delay(100); 
  esp_wifi_start();
  delay(100); 
  WiFi.mode(WIFI_STA);
}

// --- 1. FAST CONNECT (Channel Only) ---
bool fastConnect() {
  if (!config_saved) return false;

  Serial.println("\n⚡ ATTEMPTING FAST CONNECT (Channel Hint)...");
  
  resetRadio(); // Wake up radio

  Serial.print("   Target Channel: "); Serial.println(channel_store);

  // KEY CHANGE: We pass 'NULL' for BSSID, but we provide the Channel.
  // This skips the scan (fast) but allows standard handshake (reliable).
  WiFi.begin(WIFI_SSID, WIFI_PASS, channel_store, NULL, true);

  int timeout = 0;
  // Give it 8 seconds
  while (WiFi.status() != WL_CONNECTED && timeout < 16) { 
    delay(500);
    Serial.print(".");
    timeout++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Fast Connect SUCCESS!");
    return true;
  } else {
    Serial.println("\n❌ Fast Connect Failed. Falling back to Scan.");
    return false;
  }
}

// --- 2. NUCLEAR SCAN (Fallback) ---
bool scanAndConnect() {
  Serial.println("\n🔍 FULL SCAN INITIATED...");
  resetRadio();

  Serial.println("   Scanning networks...");
  int n = WiFi.scanNetworks();
  int bestIndex = -1;

  for (int i = 0; i < n; ++i) {
    if (WiFi.SSID(i) == WIFI_SSID) {
      bestIndex = i;
      Serial.print("   ✅ Found Beacon: ");
      Serial.print(WiFi.SSID(i));
      Serial.print(" ("); Serial.print(WiFi.RSSI(i)); Serial.println(" dBm)");
      break; 
    }
  }

  if (bestIndex >= 0) {
    // Save ONLY the channel this time
    channel_store = WiFi.channel(bestIndex);
    config_saved = true;

    Serial.print("   💾 Saved Channel ");
    Serial.print(channel_store);
    Serial.println(" for next sleep.");
    
    // Connect normally to Prime the connection
    WiFi.begin(WIFI_SSID, WIFI_PASS, channel_store, NULL, true);

    int timeout = 0;
    while (WiFi.status() != WL_CONNECTED && timeout < 60) {
      delay(500);
      Serial.print(".");
      timeout++;
    }
    
    if (WiFi.status() == WL_CONNECTED) return true;
  }
  
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(1000); 

  Serial.println("\n\n=== PLANT MONITOR WAKE UP ===");

  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);

  // --- SENSORS ---
  Wire.begin(INTERNAL_SDA, INTERNAL_SCL);
  maxlipo.begin(); 
  
  Wire1.begin(EXTERNAL_SDA, EXTERNAL_SCL);
  sht4.begin(&Wire1);
  veml.begin(&Wire1);
  ss.begin(0x36);

  // --- CONNECTION LOGIC ---
  bool connected = false;

  // 1. Try Fast (Channel Hint)
  if (fastConnect()) {
    connected = true;
  } 
  // 2. Fallback to Full Scan
  else {
    if (scanAndConnect()) {
      connected = true;
    }
  }

  if (connected) {
    Serial.print("IP: "); Serial.println(WiFi.localIP());

    // --- DATA ---
    sensors_event_t humidity, temp;
    sht4.getEvent(&humidity, &temp);
    
    float airTempF = (temp.temperature * 1.8) + 32;
    float lux = 0; 
    if(veml.begin(&Wire1)) { 
       veml.setGain(VEML7700_GAIN_1_8); 
       veml.setIntegrationTime(VEML7700_IT_100MS);
       lux = veml.readLux();
    }
    uint16_t soilMoisture = ss.touchRead(0);
    float soilTempF = (ss.getTemp() * 1.8) + 32;
    float battPercent = maxlipo.cellPercent();

    String url = "http://" + SERVER_IP + ":" + String(SERVER_PORT) + "/api/data";
    String jsonPayload = "{";
    jsonPayload += "\"air_temp_f\": " + String(airTempF) + ",";
    jsonPayload += "\"humidity\": " + String(humidity.relative_humidity) + ",";
    jsonPayload += "\"lux\": " + String(lux) + ",";
    jsonPayload += "\"soil_temp_f\": " + String(soilTempF) + ",";
    jsonPayload += "\"soil_moisture\": " + String(soilMoisture) + ",";
    jsonPayload += "\"batt_pct\": " + String(battPercent);
    jsonPayload += "}";

    Serial.println("Posting Data...");
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    int code = http.POST(jsonPayload);
    if (code > 0) {
      String resp = http.getString();
      Serial.println("✅ Server: " + resp);
      
      if (resp.indexOf("WATER") > 0) {
        Serial.println("💦 PUMP ON");
        digitalWrite(PUMP_PIN, HIGH);
        delay(3000);
        digitalWrite(PUMP_PIN, LOW);
      }
    } else {
      Serial.print("❌ HTTP Error: "); Serial.println(code);
    }
    http.end();
    
  } else {
    Serial.println("❌ WiFi Failed. Going back to sleep.");
  }

  Serial.println("Sleep...");
  Serial.flush(); 
  
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void loop() {}