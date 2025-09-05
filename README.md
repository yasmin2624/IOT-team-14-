# 🔐 Smart IoT Access Door with Multi-Sensors

---

## 📌 Introduction
The **Smart Access Door** project is an IoT-based security solution that integrates **multi-sensor authentication, real-time monitoring, and cloud-based event logging**. It enhances **safety, convenience, and transparency**, going beyond traditional single-mode access systems.

- Central Controller: **ESP32**
- Cloud Backend: **Supabase (PostgreSQL + Auth + Realtime)**
- Communication: **MQTT (HiveMQ Broker)**
- User Interface: **React Web App**

---

## 🚩 Problem & Motivation
Traditional access systems often suffer from:
- ❌ Lack of real-time event logging  
- ❌ Limited integration with mobile/web platforms  
- ❌ Inability to respond to unsafe conditions (fire, obstruction)

✅ Our solution provides a **flexible, intelligent, and connected smart door** with **multi-sensor authentication** and **cloud-powered monitoring**.

---

## 🏗 System Architecture
Local Hardware (ESP32) ──> MQTT Broker ──> Supabase Cloud ──> Web/Mobile Clients


- **ESP32 Hub**: central processing & sensor management  
- **Sensors & Actuators**: RFID, IR, Fire, Magnetic switch, Keypad, LCD, Servo  
- **MQTT Broker**: real-time messaging  
- **Supabase**: database, authentication, and realtime API  
- **Web App**: dashboard, alerts, logs, and remote control  

---

## 🔑 Key Components

### Hardware
- **ESP32** – core controller  
- **RFID MFRC522** – card-based authentication  
- **Keypad (4x4)** – PIN-based entry  
- **IR Sensor** – presence detection  
- **Fire Sensor** – emergency unlock  
- **Magnetic Switch** – door open/closed status  
- **LCD I2C 16x2** – user feedback  
- **Servo Motor** – lock/unlock mechanism  

### Software
- **Arduino IDE** – ESP32 programming  
- **MQTT (HiveMQ Broker)** – message routing  
- **Supabase** – PostgreSQL + Auth + Realtime  
- **React Web App** – dashboard, remote control, alerts, history  

---

## ⚙️ System Operation Flow
1. **Idle** – system waits for input (RFID, PIN, sensors)  
2. **Auth** – validates RFID/PIN against Supabase  
3. **Unlock** – servo opens, LCD displays status, Supabase logs event  
4. **Lock** – locks only if safe (no fire, no presence, door closed)  

---

## 🌐 Web Application Features
- 🔐 **Auth** – signup/login via Supabase (email + magic link)  
- 📊 **Realtime Dashboard** – sensor data + door status  
- 📜 **History Logs** – all access & sensor events stored in Supabase  
- 🚨 **Alerts Page** – fire/unauthorized attempts with instant notifications  
- 📱 **Remote Control** – lock/unlock via MQTT commands  
- 🛠 **Management** – update PIN codes & RFID tags directly from UI  

---

## 🗄 Supabase Database
- **users** – authentication & roles  
- **sensor_readings** – real-time values from ESP32  
- **access_logs** – door access attempts (RFID, PIN, manual, remote)  
- **alerts** – emergency/fire events  

---

## 🚀 Future Enhancements
- 📷 Door camera integration (live monitoring)  
- 🔥 Gas sensor alerts  
- 📲 Mobile push notifications  
- 🎙 Voice assistant support  
- 📈 Advanced analytics on access patterns  
- 🧬 Biometric authentication (fingerprint, face ID)  

---

## 🧪 Simulation (Wokwi)
- Fire sensor → simulated with potentiometer  
- RFID & Magnetic switch → simulated with pushbuttons  
- Servo + LCD used for lock mechanism & feedback  

---

## ✅ Conclusion
This project demonstrates a **secure, real-time smart door system** powered by **ESP32, Supabase, and MQTT**.  
It delivers:
- **Full monitoring** (RFID, sensors, access logs)  
- **Secure authentication & instant alerts**  
- **Future scalability** with modular architecture  

---

