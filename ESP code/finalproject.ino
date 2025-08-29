#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>   // MQTT library
#include <time.h>           // ⬅ Added for timezone

#define SS_PIN 5
#define RST_PIN 4
#define MGS 17
#define IR 16
#define FIRE 13

MFRC522 rfid(SS_PIN, RST_PIN);
Servo lockServo;
LiquidCrystal_I2C lcd(0x27,16,2);

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {12,14,27,26};
byte colPins[COLS] = {25,33,32,35};
Keypad keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

String password = "1234";
String input = "";
bool passwordMode = false;
bool locked = true;
bool rfidReady = false;

// ===== WiFi & Supabase Settings =====
const char* ssid = "OFK";
const char* password_wifi = "#Ofk@3182544";
String supabase_url_logs = "https://rndtqfkwlclrpofhqhro.supabase.co/rest/v1/access_logs";
String supabase_url_alerts = "https://rndtqfkwlclrpofhqhro.supabase.co/rest/v1/alerts";
String supabase_url_sensors = "https://rndtqfkwlclrpofhqhro.supabase.co/rest/v1/sensor_readings?select=*&order=created_at.desc";
String supabase_url_settings = "https://rndtqfkwlclrpofhqhro.supabase.co/rest/v1/system_settings?select=door_password&limit=1&order=updated_at.desc";
String supabase_apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZHRxZmt3bGNscnBvZmhxaHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNDM3OTYsImV4cCI6MjA3MTcxOTc5Nn0.PRdAuxoEVE5rLFlqrTNMSHjgbxoHnzn8pHwhOb_OVJc";
// ===== MQTT Settings =====
const char* mqtt_server = "broker.hivemq.com";
const int   mqtt_port   = 1883;
const char* topic_sensors = "esp32/shahd/alerts";
const char* topic_control = "esp32/door1/control";

WiFiClient espClient;
PubSubClient client(espClient);

// ===== Supabase RFID Settings =====
String supabase_url_rfid = "https://rndtqfkwlclrpofhqhro.supabase.co/rest/v1/system_settings?select=rfid_tag&order=updated_at.desc";

// ===== Check if scanned UID is in Supabase list =====
bool isRFIDAuthorized(String uid) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(supabase_url_rfid);
    http.addHeader("apikey", supabase_apiKey);
    http.addHeader("Authorization", "Bearer " + supabase_apiKey);

    int httpResponseCode = http.GET();
    if (httpResponseCode > 0) {
      String payload = http.getString();
      payload.toUpperCase(); // make case-insensitive

      // Search for the UID in the JSON string
      if (payload.indexOf(uid) != -1) {
        Serial.println("RFID found in Supabase ✅");
        http.end();
        return true;
      }
    } else {
      Serial.println("Error fetching RFID list: " + String(httpResponseCode));
    }
    http.end();
  }
  return false;
}

// ===== Function to send access logs =====
void sendAccessLog(String status, String method) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(supabase_url_logs);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabase_apiKey);
    http.addHeader("Authorization", "Bearer " + supabase_apiKey);

    String jsonData = "{\"status\":\"" + status + "\",\"method\":\"" + method + "\"}";
    http.POST(jsonData);
    http.end();
  }
}

// ===== Function to send Alerts =====
void sendAlert(String message, String severity="critical", String type="system") {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(supabase_url_alerts);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("apikey", supabase_apiKey);
      http.addHeader("Authorization", "Bearer " + supabase_apiKey);

      String jsonData = "{\"message\":\"" + message + "\",\"severity\":\"" + severity + "\",\"type\":\"" + type + "\"}";
      http.POST(jsonData);
      http.end();
    }
}

// ===== Function to send Sensor Readings =====
void sendSensorReadings(int fire, int mgs, int ir) {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(supabase_url_sensors);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("apikey", supabase_apiKey);
      http.addHeader("Authorization", "Bearer " + supabase_apiKey);

      String jsonData = "{\"fire\":" + String(fire) + ",\"mgs\":" + String(mgs) + ",\"ir\":" + String(ir) + "}";
      http.POST(jsonData);
      http.end();
    }

    String mqttMsg = "{\"fire\":" + String(fire) + ",\"mgs\":" + String(mgs) + ",\"ir\":" + String(ir) + "}";
    client.publish(topic_sensors, mqttMsg.c_str());
}

// ===== Function to fetch password from Supabase =====
String fetchDoorPassword() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(supabase_url_settings);
    http.addHeader("apikey", supabase_apiKey);
    http.addHeader("Authorization", "Bearer " + supabase_apiKey);

    int httpCode = http.GET();
    if (httpCode > 0) {
      String payload = http.getString();
      int start = payload.indexOf("\"door_password\":\"");
      if (start != -1) {
        start += 17;
        int end = payload.indexOf("\"", start);
        if (end != -1) {
          String passFromDB = payload.substring(start, end);
          http.end();
          return passFromDB;
        }
      }
    }
    http.end();
  }
  return "";
}

void showIdle() {
  if (locked) {
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Scan Card or *");
    lcd.setCursor(0,1);
    lcd.print("to enter PIN");
  }
}

void lockSystem() {
  lockServo.write(0);
  lcd.clear();
  lcd.print("LOCKED");
  locked = true;
  sendAccessLog("success", "manual");
  delay(1000);
  showIdle();
}

void unlockSystem(const char* msg, int delayMs=5000, String method="manual", String status="success") {
  if (status == "success") {
    lockServo.write(100);
    locked = false;
  } else {
    lockServo.write(0);
    locked = true;
  }

  lcd.clear();
  lcd.print(msg);
  sendAccessLog(status, method);

  delay(delayMs);
  showIdle();
}

// ===== MQTT Callback =====
void callback(char* topic, byte* message, unsigned int length) {
  String msg;
  for (int i=0; i<length; i++) msg += (char)message[i];
  Serial.print("MQTT msg on "); Serial.print(topic); Serial.print(": "); Serial.println(msg);

  if (String(topic) == topic_control) {
    if (msg == "open") unlockSystem("unlocked",5000,"mqtt","success");
    else if (msg == "close") lockSystem();
  }
}

// ===== MQTT Reconnect =====
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP32_Client")) {
      Serial.println("connected");
      client.subscribe(topic_control);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5s");
      delay(5000);
    }
  }
}

unsigned long lastSensorUpdate = 0;
int lastFire = HIGH, lastMGS = HIGH, lastIR = HIGH;

void setup() {
  Serial.begin(115200);
  SPI.begin(18,19,23);
  rfid.PCD_Init();

  Serial.println("Checking MFRC522...");
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("VersionReg value: 0x");
  Serial.println(v, HEX);

  if (v == 0x91 || v == 0x92) {
    Serial.println("MFRC522 detected ✅");
    rfidReady = true;
  } else {
    Serial.println("MFRC522 not responding ❌");
    lcd.clear();
    lcd.print("RFID NOT FOUND");
    rfidReady = false;
  }

  pinMode(MGS, INPUT_PULLUP);
  pinMode(IR, INPUT_PULLUP);
  pinMode(FIRE, INPUT_PULLUP);

  lockServo.attach(15);
  lockServo.write(0);

  lcd.init();
  lcd.backlight();
  if (rfidReady) showIdle();

  WiFi.begin(ssid, password_wifi);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi!");

  configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // --- RFID ---
  if (rfidReady && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i=0; i<rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    Serial.print("Card UID: ");
    Serial.println(uid);

    if (isRFIDAuthorized(uid))
      unlockSystem("UNLOCKED", 5000, "rfid", "success");
    else
      unlockSystem("Access Denied", 2000, "rfid", "failure");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // --- Fire / IR / MGS logic ---
  int fireVal = digitalRead(FIRE);
  int irVal   = digitalRead(IR);
  int mgsVal  = digitalRead(MGS);

  if (fireVal == LOW) {  
    unlockSystem("EMERGENCY UNLOCK",2000,"emergency","success");
    sendAlert("🔥 Fire detected","critical","fire");
  } 
  else if (irVal == LOW && locked) { 
    unlockSystem("UNLOCKED",2000,"ir","success"); 
  } 
  else if (mgsVal == LOW && locked) { 
    unlockSystem("UNLOCKED",2000,"mgs","success"); 
  } 
  else if (mgsVal == HIGH && irVal == HIGH && fireVal == HIGH && !locked) { 
    delay(2000);
    lockSystem();
  }

  // --- Keypad ---
  char key = keypad.getKey();
  if (key) {
    if (key == '*') {
      passwordMode = true;
      input = "";
      lcd.clear();
      lcd.print("Enter Password:");
      lcd.setCursor(0,1);
    } 
    else if (key == '#' && passwordMode) {
      String dbPassword = fetchDoorPassword();
      if (dbPassword.length() > 0 && input == dbPassword)
        unlockSystem("UNLOCKED",5000,"password","success");
      else
        unlockSystem("Wrong Password",2000,"password","failure");
      passwordMode = false;
      input = "";
    } 
    else if (passwordMode) {
      input += key;
      lcd.setCursor(0,1);
      lcd.print(input);
    }
  }

  if (fireVal != lastFire || mgsVal != lastMGS || irVal != lastIR) {
    sendSensorReadings(fireVal, mgsVal, irVal);
    lastFire = fireVal;
    lastMGS = mgsVal;
    lastIR = irVal;
  }
}
