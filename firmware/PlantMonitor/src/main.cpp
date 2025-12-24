#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_wifi.h>
#include <WiFiManager.h>
#include "driver/gpio.h" // Needed for Pin Hold

#include "Adafruit_SHT4x.h"
#include "Adafruit_VEML7700.h"
#include "Adafruit_seesaw.h"
#include "Adafruit_MAX1704X.h"

// --- CONFIGURATION ---
String SERVER_HOST = "jghiorse.pythonanywhere.com"; 
const int SERVER_PORT = 80;

// --- PINS ---
#define INTERNAL_SDA 8
#define INTERNAL_SCL 9
#define EXTERNAL_SDA 3
#define EXTERNAL_SCL 5
#define PUMP_PIN     4 // GPIO 4
#define BOOT_BUTTON  0 

#define uS_TO_S_FACTOR 1000000ULL  
#define TIME_TO_SLEEP  10          

RTC_DATA_ATTR int boot_fail_count = 0; 

Adafruit_SHT4x sht4 = Adafruit_SHT4x();
Adafruit_VEML7700 veml = Adafruit_VEML7700();
Adafruit_seesaw ss(&Wire1);
Adafruit_MAX17048 maxlipo; 

void goToSleep() {
  Serial.println("💤 Going to sleep...");
  Serial.flush();
  
  // --- SAFETY: LOCK PUMP LOW ---
  digitalWrite(PUMP_PIN, LOW);
  gpio_hold_en((gpio_num_t)PUMP_PIN); // Force pin LOW during sleep
  gpio_deep_sleep_hold_en();
  // -----------------------------

  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void runSensorTasks() {
  Serial.print("✅ WiFi Connected! IP: "); 
  Serial.println(WiFi.localIP());

  // Initialize Internal I2C (Battery)
  Wire.begin(INTERNAL_SDA, INTERNAL_SCL);
  maxlipo.begin(); 
  
  // Initialize External I2C (Sensors)
  Wire1.begin(EXTERNAL_SDA, EXTERNAL_SCL);
  
  bool sensorsActive = true;
  
  if (!ss.begin(0x36)) {
    Serial.println("❌ ERROR: Soil Sensor not found! Check wiring.");
    sensorsActive = false;
  }
  if (!sht4.begin(&Wire1)) {
    Serial.println("❌ ERROR: SHT4x not found!");
  }
  
  // --- READ DATA ---
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

  Serial.print("   Sensors Read -> Moisture: "); Serial.println(soilMoisture);

  // --- POST DATA ---
  String url = "http://" + SERVER_HOST + "/api/data";
  String jsonPayload = "{";
  jsonPayload += "\"air_temp_f\": " + String(airTempF) + ",";
  jsonPayload += "\"humidity\": " + String(humidity.relative_humidity) + ",";
  jsonPayload += "\"lux\": " + String(lux) + ",";
  jsonPayload += "\"soil_temp_f\": " + String(soilTempF) + ",";
  jsonPayload += "\"soil_moisture\": " + String(soilMoisture) + ",";
  jsonPayload += "\"batt_pct\": " + String(battPercent);
  jsonPayload += "}";

  Serial.println("📤 Posting Data...");
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int code = http.POST(jsonPayload);
  if (code > 0) {
    String resp = http.getString();
    Serial.println("✅ Server: " + resp);
    
    // --- SAFE WATERING LOGIC ---
    // Only water if command received AND sensors are actually working.
    // This prevents flooding if the sensor dies and sends "0".
    if (resp.indexOf("WATER") > 0) {
      if (sensorsActive && soilMoisture > 100) { 
        Serial.println("💦 PUMP ON");
        
        // Unlock pin to use it
        gpio_hold_dis((gpio_num_t)PUMP_PIN); 
        
        digitalWrite(PUMP_PIN, HIGH);
        delay(3000);
        digitalWrite(PUMP_PIN, LOW);
      } else {
        Serial.println("⚠️ Water Command IGNORED: Sensor failure or reading too low (Safety).");
      }
    }
  } else {
    Serial.print("❌ HTTP Error: "); Serial.println(code);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000); 

  // --- SAFETY STARTUP ---
  // Release the lock from sleep so we can control the pin
  gpio_hold_dis((gpio_num_t)PUMP_PIN);
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW); 
  // ----------------------

  Serial.println("\n\n=== PLANT MONITOR WAKE UP ===");
  Serial.print("⚠️ Fail Count: "); Serial.println(boot_fail_count);

  pinMode(BOOT_BUTTON, INPUT_PULLUP);
  if (digitalRead(BOOT_BUTTON) == LOW) {
    WiFiManager wm;
    wm.resetSettings();
    ESP.restart();
  }

  if (WiFi.SSID().length() == 0) {
    boot_fail_count = 3; 
  }

  if (boot_fail_count < 3) {
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
      boot_fail_count++; 
    }

  } else {
    Serial.println("🚨 Starting Configuration AP...");
    WiFiManager wm;
    wm.setConfigPortalTimeout(180); 
    if (wm.autoConnect("PlantMonitor_Setup")) {
      boot_fail_count = 0; 
      runSensorTasks();
    } 
  }

  goToSleep();
}

void loop() {}