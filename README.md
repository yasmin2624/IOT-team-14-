# Smart Access Door with Multi-Sensors  

This project is a complete *IoT-based smart access control system* powered by the ESP32 microcontroller.  
It integrates multiple sensors (RFID, IR, Fire, and Magnetic Switch) with a servo motor and LCD to provide *secure, flexible, and intelligent door access*.  

Data is transmitted via *MQTT (HiveMQ broker)* for realtime communication and stored in a *Supabase backend*.  
The database includes dedicated tables for users, sensor_readings, alerts, and access_logs, all secured with *Row Level Security (RLS)* and *policies. Supabase also provides **authentication* and *realtime updates*, ensuring instant synchronization between the hardware and the web application.  

The *web dashboard* was developed using *React + Tailwind CSS*, integrated with Supabase APIs. It enables users to:  
- *Sign up / Login* using Supabase Auth.  
- *Monitor live sensor data* (fire detection, RFID access, magnetic switch status).  
- *Control the door remotely* via MQTT commands.  
- *Change the door password* securely through a dedicated settings page.  
- *Receive realtime alerts* during emergencies.  
- *View historical data* from Supabase tables (access logs, alerts).  

### 🔑 Key Features
- Multi-sensor access: RFID, keypad, IR presence, fire, and magnetic switch.  
- *Realtime communication* via MQTT (esp32/sensors/data & esp32/door/control).  
- *Supabase integration* for authentication, database, security policies, and realtime events.  
- *Web dashboard* with React + Tailwind CSS for a modern, responsive UI.  
- Safety logic: *auto-unlock during fire emergencies*.  
- Scalable and modular design, ready for future enhancements (camera, biometrics, mobile notifications).
