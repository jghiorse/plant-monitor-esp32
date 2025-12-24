#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_wifi.h>
#include <WiFiManager.h> // Dependency added in platformio.ini

#include "Adafruit_SHT4x.h"
#include "Adafruit_VEML7700.h"
#include "Adafruit_seesaw.h"
#include "Adafruit_MAX1704X.h"

// --- CONFIGURATION ---
String SERVER_HOST = "jghiorse.pythonanywhere.com"; 
const int SERVER_PORT = 80;

// --- PINS (TinyS3 specific) ---
#define INTERNAL_SDA 8
#define INTERNAL_SCL 9
#define EXTERNAL_SDA 3
#define EXTERNAL_SCL 5
#define PUMP_PIN     4
#define BOOT_BUTTON  0 

// --- TIMING ---
#define uS_TO_S_FACTOR 1000000ULL  
#define TIME_TO_SLEEP  10          

// --- MEMORY (Survives Deep Sleep) ---
RTC_DATA_ATTR int boot_fail_count = 0; 

// --- OBJECTS ---
Adafruit_SHT4x sht4 = Adafruit_SHT4x();
Adafruit_VEML7700 veml = Adafruit_VEML7700();
Adafruit_seesaw ss(&Wire1);
Adafruit_MAX17048 maxlipo; 

void goToSleep() {
  Serial.println("💤 Going to sleep...");
  Serial.flush();
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void runSensorTasks() {
  Serial.print("✅ WiFi Connected! IP: "); 
  Serial.println(WiFi.localIP());

  // Initialize Sensors
  Wire.begin(INTERNAL_SDA, INTERNAL_SCL);
  maxlipo.begin(); 
  
  Wire1.begin(EXTERNAL_SDA, EXTERNAL_SCL);
  sht4.begin(&Wire1);
  veml.begin(&Wire1);
  ss.begin(0x36);

  // Read Data
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

  // JSON Payload
  String url = "http://" + SERVER_HOST + "/api/data";
  String jsonPayload = "{";
  jsonPayload += "\"air_temp_f\": " + String(airTempF) + ",";
  jsonPayload += "\"humidity\": " + String(humidity.relative_humidity) + ",";
  jsonPayload += "\"lux\": " + String(lux) + ",";
  jsonPayload += "\"soil_temp_f\": " + String(soilTempF) + ",";
  jsonPayload += "\"soil_moisture\": " + String(soilMoisture) + ",";
  jsonPayload += "\"batt_pct\": " + String(battPercent);
  jsonPayload += "}";

  // Post Data
  Serial.println("📤 Posting Data...");
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int code = http.POST(jsonPayload);
  if (code > 0) {
    String resp = http.getString();
    Serial.println("✅ Server: " + resp);
    
    if (resp.indexOf("WATER") > 0) {
      Serial.println("💦 PUMP ON");
      pinMode(PUMP_PIN, OUTPUT);
      digitalWrite(PUMP_PIN, HIGH);
      delay(3000);
      digitalWrite(PUMP_PIN, LOW);
    }
  } else {
    Serial.print("❌ HTTP Error: "); Serial.println(code);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  // Wait for Serial (Optional in Prod, helpful for Debug)
  delay(2000); 

  // WiFiManager wm;
  // wm.resetSettings();
  
  Serial.println("\n\n=== PLANT MONITOR WAKE UP ===");
  Serial.print("⚠️ Fail Count: "); Serial.println(boot_fail_count);

  // --- FACTORY RESET (Hold BOOT) ---
  pinMode(BOOT_BUTTON, INPUT_PULLUP);
  if (digitalRead(BOOT_BUTTON) == LOW) {
    Serial.println("🔴 BOOT Button Held: Wiping WiFi Settings!");
    WiFiManager wm;
    wm.resetSettings();
    boot_fail_count = 10; 
    delay(1000);
    ESP.restart();
  }

  // --- FORCE AP IF NO CONFIG ---
  if (WiFi.SSID().length() == 0) {
    Serial.println("ℹ️ No SSID Saved. Forcing AP Mode.");
    boot_fail_count = 3; 
  }

  // --- CONNECTION LOGIC ---
  if (boot_fail_count < 3) {
    // Attempt Silent Connect
    Serial.println("⚡ Trying Saved Credentials...");
    WiFi.mode(WIFI_STA);
    WiFi.begin(); 

    int timer = 0;
    while (WiFi.status() != WL_CONNECTED && timer < 20) {
      delay(500);
      Serial.print(".");
      timer++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      boot_fail_count = 0; 
      runSensorTasks();
    } else {
      Serial.println("\n❌ Connection Failed.");
      boot_fail_count++; 
    }

  } else {
    // Attempt Configuration AP
    Serial.println("🚨 Too many failures. Starting Configuration AP...");
    
    WiFiManager wm;
    wm.setConfigPortalTimeout(180); // 3 mins to save battery

    // The AP name will be "PlantMonitor_Setup"
    // No password by default for the AP itself to make it easy to connect
    bool res = wm.autoConnect("PlantMonitor_Setup"); 

    if (res) {
      Serial.println("✅ Connected via WiFiManager!");
      boot_fail_count = 0; 
      runSensorTasks();
    } else {
      Serial.println("❌ Configuration Timed Out.");
      boot_fail_count = 0; 
    }
  }

  goToSleep();
}

void loop() {}