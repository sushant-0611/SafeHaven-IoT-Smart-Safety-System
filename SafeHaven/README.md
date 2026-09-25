# SafeHaven IoT Smart Safety System

> **An IoT-based real-time safety monitoring, alerting and automatic response system**

SafeHaven is an IoT-based smart safety and monitoring system designed to continuously monitor environmental and safety parameters such as **temperature, humidity, smoke, gas leakage, noise level and fire**.

The system uses an **ESP32** as the main hardware controller. Sensor readings are processed locally and transmitted to a **custom web platform through REST APIs**. The web platform provides real-time monitoring, historical data, alerts, automation settings, device status and system configuration.

When a dangerous condition is detected, SafeHaven can automatically activate appropriate safety devices such as a **water pump, exhaust fan, buzzer and warning LEDs**. A **SIM800C GSM module** is also used to send SMS alerts to configured phone numbers.

---

## 1. Project Overview

### Project Name

**SafeHaven – IoT Smart Safety System**

### Project Type

IoT + Embedded Systems + Web Application

### Main Objective

The main objective of SafeHaven is to provide a centralized system for:

* Real-time environmental monitoring
* Fire detection
* Smoke detection
* Gas leakage detection
* Temperature monitoring
* Humidity monitoring
* Noise monitoring
* Automatic emergency response
* SMS-based emergency notifications
* Web-based monitoring
* Historical telemetry analysis
* Configurable safety thresholds
* Device and automation management

### Developed By

**SushTech Innovations**
Software | Hardware | AI | Project Support

This project, **SafeHaven – IoT Smart Safety System**, was developed by **SushTech Innovations** as an integrated IoT-based safety monitoring and automation solution.

**Website:** https://sushant-0611.github.io/
**Email:** [sushtech.service@gmail.com](mailto:sushtech.service@gmail.com)

---
# 2. Key Features

## Hardware Monitoring

SafeHaven monitors the following parameters:

| Parameter   | Sensor       |
| ----------- | ------------ |
| Temperature | DHT11        |
| Humidity    | DHT11        |
| Smoke       | MQ2          |
| Gas Leakage | MQ6          |
| Noise       | Sound Sensor |
| Fire        | Flame Sensor |

---

## Automatic Safety Response

The system can automatically perform actions according to detected conditions.

| Condition            | Automatic Response |
| -------------------- | ------------------ |
| Fire detected        | Water pump ON      |
| Gas leakage detected | Exhaust fan ON     |
| Smoke detected       | Exhaust fan ON     |
| Dangerous condition  | Buzzer ON          |
| Dangerous condition  | Red LED ON         |
| Safe condition       | Green LED ON       |

The automation behaviour is configurable from the web platform.

---

## Alert System

SafeHaven supports:

* Warning alerts
* Danger alerts
* Critical safety alerts
* SMS notifications
* Alert history
* Alert acknowledgement
* Configurable SMS cooldown
* Custom SMS message templates

---

## Web Dashboard

The web platform provides:

* Real-time sensor readings
* Device status
* Current safety state
* Sensor history
* Alerts
* Automation status
* Commands
* System settings
* Notification settings
* Threshold configuration

---

# 3. System Architecture

```text
                  ┌─────────────────────┐
                  │      Sensors        │
                  │                     │
                  │ DHT11               │
                  │ MQ2                 │
                  │ MQ6                 │
                  │ Flame Sensor        │
                  │ Noise Sensor        │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │        ESP32         │
                  │                     │
                  │ Sensor Processing   │
                  │ Safety Logic        │
                  │ LCD Display         │
                  │ Local Automation    │
                  └──────────┬──────────┘
                             │
                Wi-Fi / REST API
                             │
                             ▼
                  ┌─────────────────────┐
                  │    Node.js API      │
                  │    Express Server   │
                  └──────────┬──────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
             ┌─────────────┐   ┌─────────────┐
             │  MongoDB    │   │ Socket.IO   │
             │  Database   │   │ Real-time   │
             └─────────────┘   └──────┬──────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │ React Web       │
                             │ Dashboard       │
                             └─────────────────┘


        Emergency Response
                │
       ┌────────┼─────────┐
       ▼        ▼         ▼
   Water Pump Exhaust   Buzzer/
              Fan       LEDs

                +
           SIM800C GSM
                │
                ▼
              SMS
```

---

# 4. Hardware Components

| No. | Component          | Purpose                             |
| --: | ------------------ | ----------------------------------- |
|   1 | ESP32              | Main microcontroller                |
|   2 | DHT11              | Temperature and humidity monitoring |
|   3 | MQ2                | Smoke and combustible gas detection |
|   4 | MQ6                | LPG/gas leakage detection           |
|   5 | Flame Sensor       | Fire detection                      |
|   6 | Sound Sensor       | Noise monitoring                    |
|   7 | 16x2 I2C LCD       | Local status display                |
|   8 | SIM800C GSM Module | SMS alerts                          |
|   9 | 12V Water Pump     | Fire response                       |
|  10 | 12V Exhaust Fan    | Gas/smoke ventilation               |
|  11 | 2-Channel 5V Relay | Pump and fan control                |
|  12 | Buzzer             | Audible emergency alert             |
|  13 | Green LED          | Safe status                         |
|  14 | Red LED            | Danger status                       |
|  15 | Power Supply       | Hardware power                      |

---

# 5. ESP32 Pin Configuration

| Component         | ESP32 GPIO |
| ----------------- | ---------: |
| DHT11             |     GPIO 4 |
| MQ2               |    GPIO 35 |
| MQ6               |    GPIO 32 |
| Sound Sensor      |    GPIO 34 |
| Flame Sensor      |    GPIO 33 |
| Green LED         |    GPIO 23 |
| Red LED           |    GPIO 19 |
| Buzzer            |    GPIO 18 |
| Water Pump Relay  |    GPIO 26 |
| Exhaust Fan Relay |    GPIO 27 |
| LCD SDA           |    GPIO 21 |
| LCD SCL           |    GPIO 22 |
| SIM800C RX        |    GPIO 16 |
| SIM800C TX        |    GPIO 17 |

### LCD

```text
LCD Address : 0x27
Interface   : I2C
SDA         : GPIO 21
SCL         : GPIO 22
```

### SIM800C

```text
UART        : HardwareSerial(2)
RX          : GPIO 16
TX          : GPIO 17
Baud Rate   : 9600
Format      : 8N1
```

---

# 6. Sensor Thresholds

The system uses warning and danger thresholds.

| Sensor      | Warning | Danger |
| ----------- | ------: | -----: |
| Temperature |   40 °C |  45 °C |
| Humidity    |    60 % |   80 % |
| Smoke       |    40 % |   70 % |
| Gas         |    40 % |   70 % |
| Noise       |      50 |     80 |
| Fire        |    50 % |   70 % |

These values are configurable through the web platform.

---

# 7. Safety States

SafeHaven mainly operates using three safety levels.

## SAFE

When all monitored parameters are within their configured limits:

```text
Green LED  → ON
Red LED    → OFF
Buzzer     → OFF
```

---

## WARNING

When a sensor crosses its warning threshold:

```text
Warning Alert → Generated
Dashboard     → Updated
SMS           → Sent if enabled
```

The system continues monitoring the environment.

---

## DANGER

When a sensor crosses its danger threshold:

```text
Red LED       → ON
Green LED     → OFF
Buzzer        → ON
Danger Alert  → Generated
SMS           → Sent if enabled
Automation    → Executed
```

---

# 8. Automatic Response Logic

## Fire Detection

When fire reaches the configured danger level:

```text
Flame Sensor
      ↓
Fire Condition Detected
      ↓
Danger State
      ↓
Water Pump ON
      ↓
Buzzer ON
      ↓
Red LED ON
      ↓
SMS Alert
      ↓
Web Dashboard Update
```

---

## Gas Leakage

When gas leakage is detected:

```text
MQ6
 ↓
Gas Level > Threshold
 ↓
Danger Condition
 ↓
Exhaust Fan ON
 ↓
Buzzer ON
 ↓
Red LED ON
 ↓
SMS Alert
```

---

## Smoke Detection

When smoke exceeds its configured threshold:

```text
MQ2
 ↓
Smoke Detected
 ↓
Exhaust Fan ON
 ↓
Danger Alert
 ↓
SMS Notification
```

---

# 9. Local LCD Display

The 16x2 LCD provides local status information even without opening the web dashboard.

The display can show:

* Temperature
* Humidity
* Gas
* Smoke
* Noise
* Fire
* Safety state
* Danger reason

Example:

```text
SAFEHAVEN
SYSTEM SAFE
```

or:

```text
DANGER!
FIRE DETECTED
```

---

# 10. GSM SMS System

SafeHaven uses the **SIM800C GSM module** for emergency SMS communication.

SMS notifications can contain:

* Sensor title
* Current sensor reading
* Threshold
* Reason
* Temperature
* Humidity
* Smoke
* Gas
* Noise
* Fire

Example message:

```text
SAFEHAVEN DANGER

Critical Safety Condition Detected!

Sensor: Fire Detected
Current Reading: fire = 75%
Danger Threshold: 70%
Reason: Fire level exceeded danger threshold.

Current Sensor Readings:
Temperature: 46°C
Humidity: 72%
Smoke: 81%
Gas: 64%
Noise: 83
Fire: 75%

Immediate attention is required.
Please check the system.
```

---

# 11. SMS Placeholders

Custom SMS templates support the following placeholders:

```text
{deviceId}
{sensor}
{sensorTitle}
{value}
{unit}
{threshold}
{severity}
{rule}
{reason}
{time}
{temperature}
{humidity}
{smoke}
{gas}
{noise}
{fire}
```

This allows administrators to customize notification messages from the web platform.

---

# 12. SMS Cooldown

To prevent excessive SMS generation, SafeHaven uses an SMS cooldown mechanism.

Default:

```text
Cooldown = 60 seconds
```

The cooldown can be configured through system settings.

---

# 13. Software Technology Stack

## Embedded System

```text
ESP32
Arduino IDE
C/C++
```

Libraries include:

```text
WiFi.h
HTTPClient.h
Wire.h
DHT.h
DIYables_LCD_I2C.h
```

---

## Backend

```text
Node.js
Express.js
MongoDB
Mongoose
Socket.IO
JWT Authentication
REST API
```

---

## Frontend

```text
React
Vite
Axios
Socket.IO Client
CSS
```

---

# 14. Backend Architecture

The backend is responsible for:

* Authentication
* Device authentication
* Telemetry processing
* Database operations
* Automation rules
* Alerts
* Commands
* SMS logging
* System settings
* Dashboard statistics
* Socket.IO events

General architecture:

```text
ESP32
  │
  ▼
REST API
  │
  ├── Device Authentication
  │
  ├── Telemetry Processing
  │
  ├── Automation
  │
  ├── Alerts
  │
  ├── Commands
  │
  ├── SMS
  │
  └── MongoDB
```

---

# 15. REST API

Base URL:

```text
http://localhost:5000/api
```

## Device Status

```http
GET /api/devices/SAFEHAVEN-001/status
```

Returns the current device connection/status information.

---

## Latest Telemetry

```http
GET /api/devices/SAFEHAVEN-001/latest
```

Returns the latest sensor readings.

---

## Telemetry History

```http
GET /api/devices/SAFEHAVEN-001/history
```

Returns historical sensor data.

---

## Send Device Telemetry

```http
POST /api/devices/telemetry
```

Required device headers:

```text
X-Device-ID
X-Device-Key
```

Content type:

```text
application/json
```

---

## System Settings

```http
GET /api/settings
```

and:

```http
PUT /api/settings
```

System settings include:

* Thresholds
* Monitoring configuration
* Automation configuration
* SMS configuration
* Notification configuration
* Device configuration

---

## Dashboard Statistics

```http
GET /api/dashboard/statistics
```

Provides dashboard-level statistics.

---

# 16. Device Authentication

ESP32 devices communicate with the backend using device credentials.

Headers:

```text
X-Device-ID
X-Device-Key
```

Example:

```text
X-Device-ID: SAFEHAVEN-001
X-Device-Key: YOUR_DEVICE_KEY
```

The device ID used by the current system is:

```text
SAFEHAVEN-001
```

---

# 17. Realtime Communication

SafeHaven uses Socket.IO for realtime web dashboard updates.

Important events include:

```text
telemetry:update
device:telemetry
device:status
alert:update
command:update
notification:update
dashboard:update
```

The web dashboard can therefore receive new telemetry and system events without continuously refreshing the browser.

---

# 18. Important Device Status Design

The web dashboard does **not** assume that the ESP32 is online merely because the browser has a Socket.IO connection.

Device connectivity is determined from the device status API:

```http
GET /api/devices/SAFEHAVEN-001/status
```

The frontend periodically checks this endpoint.

Default frontend polling:

```text
Every 5 seconds
```

Socket.IO is used for realtime updates and not as proof that the ESP32 itself is connected.

---

# 19. Monitoring Timers

The current system uses separate timers for different tasks.

| Task                  |   Interval |
| --------------------- | ---------: |
| Sensor reading        |  2 seconds |
| API telemetry         |  5 seconds |
| LCD update            |  2 seconds |
| Wi-Fi check           | 10 seconds |
| SMS reminder/cooldown | 60 seconds |

This prevents all operations from blocking one another.

---

# 20. Database

SafeHaven uses MongoDB for persistent storage.

The database stores information such as:

```text
Users
Devices
Telemetry
Alerts
Commands
Automation Rules
System Settings
SMS Logs
Notifications
```

---

# 21. User Roles

The web platform supports role-based access control.

Typical roles include:

```text
SUPER_ADMIN
ADMIN
USER
```

Administrative functions such as system configuration can be protected using authorization middleware.

---

# 22. System Settings

The settings module allows administrators to configure:

### Sensor Thresholds

```text
Temperature
Humidity
Smoke
Gas
Noise
Fire
```

### Automation

```text
Fire Pump
Gas/Smoke Exhaust
Danger Buzzer
```

### Notifications

```text
SMS
Danger-only notification
Phone numbers
Cooldown
```

### Device Configuration

```text
Device ID
Monitoring configuration
Connection configuration
```

---

# 23. Project Folder Structure

A typical SafeHaven project structure is:

```text
SafeHaven/
│
├── backend/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── config/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── assets/
│   │   └── App.jsx
│   ├── public/
│   ├── index.html
│   └── package.json
│
├── esp32/
│   └── SafeHaven.ino
│
├── README.md
└── documentation/
```

The exact folder names may differ depending on the final repository structure.

---

# 24. Backend Installation

Open PowerShell inside the backend directory.

```powershell
cd backend
npm install
```

Create a `.env` file.

Example:

```env
PORT=5000

MONGO_URI=mongodb://127.0.0.1:27017/safehaven

JWT_SECRET=your_secure_jwt_secret

DEVICE_ID=SAFEHAVEN-001
DEVICE_KEY=your_secure_device_key
```

Start the backend:

```powershell
npm run dev
```

or:

```powershell
npm start
```

The backend should run on:

```text
http://localhost:5000
```

---

# 25. Frontend Installation

Open another PowerShell window.

```powershell
cd frontend
npm install
```

Create `.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Start the frontend:

```powershell
npm run dev
```

Vite will provide a local URL similar to:

```text
http://localhost:5173
```

---

# 26. MongoDB

Make sure MongoDB is running before starting the backend.

The application uses:

```text
MongoDB
```

with a database such as:

```text
safehaven
```

The backend connects through the `MONGO_URI` environment variable.

---

# 27. ESP32 Setup

Open the ESP32 firmware in Arduino IDE.

Install the ESP32 board package.

Select the appropriate ESP32 board.

Configure:

```text
Board      : ESP32
Port       : ESP32 COM Port
Baud Rate  : 115200
```

Upload the firmware.

---

# 28. ESP32 Firmware Configuration

The ESP32 requires:

```cpp
WiFi SSID
WiFi Password
API URL
DEVICE_ID
DEVICE_KEY
```

Example:

```cpp
const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

const char* API_URL =
    "http://YOUR_SERVER_IP:5000/api/devices/telemetry";

const char* DEVICE_ID =
    "SAFEHAVEN-001";

const char* DEVICE_KEY =
    "YOUR_DEVICE_KEY";
```

Do not expose real Wi-Fi passwords or device keys in a public repository.

---

# 29. ESP32 Telemetry Flow

The ESP32 periodically performs:

```text
Read Sensors
     ↓
Convert/Process Values
     ↓
Determine Safety State
     ↓
Update LCD
     ↓
Execute Local Safety Logic
     ↓
Connect to Wi-Fi
     ↓
Send JSON Telemetry
     ↓
Backend
     ↓
MongoDB
     ↓
Socket.IO
     ↓
Web Dashboard
```

---

# 30. Example Telemetry Data

A telemetry payload can contain values similar to:

```json
{
  "deviceId": "SAFEHAVEN-001",
  "temperature": 32.5,
  "humidity": 58,
  "smoke": 18,
  "gas": 15,
  "noise": 35,
  "fire": 5
}
```

The exact payload should match the final ESP32 firmware and backend telemetry schema.

---

# 31. Automation Engine

The backend automation service evaluates configured rules against incoming telemetry.

The general process is:

```text
Telemetry Received
        ↓
Load Automation Rules
        ↓
Read Sensor Value
        ↓
Compare With Threshold
        ↓
Condition Matched?
     /        \
   NO          YES
   │            │
   │            ▼
   │       Create Alert
   │            │
   │            ▼
   │       Create Command
   │            │
   │            ▼
   │        SMS Process
   │            │
   └────────────┘
```

---

# 32. Automation Priority

The system uses command priorities:

```text
WARNING  → NORMAL
DANGER   → HIGH
CRITICAL → CRITICAL
```

This allows emergency commands to be handled with appropriate priority.

---

# 33. Duplicate Command Prevention

The automation system checks for existing pending automation commands before creating another command for the same condition.

This helps prevent:

```text
Pump ON
Pump ON
Pump ON
Pump ON
...
```

from being generated repeatedly while the same command is still pending.

---

# 34. Alert Management

SafeHaven supports:

* Alert creation
* Alert update
* Alert acknowledgement
* Severity levels
* Sensor-specific alerts
* Automation-generated alerts
* Realtime alert updates

Example:

```text
Sensor:
Fire

Severity:
DANGER

Reason:
Fire level exceeded danger threshold.

Action:
Water pump activated.
```

---

# 35. Frontend Dashboard

The dashboard provides a centralized view of the SafeHaven system.

Typical dashboard sections include:

```text
┌────────────────────────────────────┐
│          SafeHaven Dashboard       │
├────────────────────────────────────┤
│ Device Status                      │
├────────────────────────────────────┤
│ Temperature │ Humidity │ Smoke     │
├────────────────────────────────────┤
│ Gas         │ Noise    │ Fire      │
├────────────────────────────────────┤
│ Safety Status / Active Alerts      │
├────────────────────────────────────┤
│ Automation Status                  │
├────────────────────────────────────┤
│ Recent Events                      │
└────────────────────────────────────┘
```

---

# 36. Settings Page

The settings page contains full-width configuration sections:

```text
Sensor Thresholds
        ↓
Automation
        ↓
Notifications
        ↓
Device Configuration
        ↓
Actions
```

This allows administrators to configure the complete system from one location.

---

# 37. Notifications

The notification system can be configured for:

```text
SMS Enabled/Disabled
Phone Numbers
SMS Cooldown
Danger-only Notifications
Custom Warning Message
Custom Danger Message
```

---

# 38. Safety Logic Summary

```text
                SENSOR DATA
                     │
                     ▼
             Threshold Check
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
         SAFE      WARNING     DANGER
          │          │          │
          ▼          ▼          ▼
      Green LED    Alert       Alert
          │          │          │
          ▼          ▼          ▼
       Normal      SMS*        SMS*
                               │
                               ▼
                        Automation
                         /    |    \
                        /     |     \
                       ▼      ▼      ▼
                     Pump   Fan   Buzzer
```

`*` SMS is sent only when notification and rule settings allow it.

---

# 39. Testing Checklist

## Hardware Testing

* [x] ESP32 powers correctly
* [x] DHT11 gives temperature
* [x] DHT11 gives humidity
* [x] MQ2 detects smoke
* [x] MQ6 detects gas
* [x] Flame sensor detects fire
* [x] Noise sensor provides readings
* [x] LCD displays correctly
* [x] Green LED works
* [x] Red LED works
* [x] Buzzer works
* [x] Pump relay works
* [x] Exhaust fan relay works
* [x] SIM800C initializes correctly
* [x] SIM800C sends SMS

---

## Backend Testing

* [x] Backend starts successfully
* [x] MongoDB connection works
* [x] Device authentication works
* [x] Telemetry endpoint works
* [x] Latest telemetry endpoint works
* [x] History endpoint works
* [x] Device status endpoint works
* [x] Settings API works
* [x] Automation service works
* [x] Alert creation works
* [x] Command creation works
* [x] SMS logs are created
* [x] Socket.IO events are emitted

---

## Frontend Testing

* [x] Login works
* [x] Dashboard loads
* [x] Device status displays correctly
* [x] Sensor values update
* [x] Alerts appear
* [x] History works
* [x] Settings load
* [x] Settings update
* [x] Automation settings work
* [x] Notification settings work
* [x] Realtime updates work

---

# 40. End-to-End Testing

A complete test should verify:

```text
Physical Sensor
      ↓
ESP32
      ↓
Wi-Fi
      ↓
REST API
      ↓
MongoDB
      ↓
Automation
      ↓
Alert / Command
      ↓
Socket.IO
      ↓
React Dashboard
      ↓
SMS / Physical Actuator
```

Example fire test:

```text
Apply controlled flame near flame sensor
        ↓
ESP32 detects fire
        ↓
Fire value increases
        ↓
Telemetry sent
        ↓
Backend receives telemetry
        ↓
Danger threshold crossed
        ↓
Alert generated
        ↓
Water pump command generated
        ↓
Buzzer + red LED
        ↓
SMS sent
        ↓
Dashboard updated
```

Perform physical actuator testing carefully and safely.

---

# 41. Security Considerations

The following should be protected:

```text
Wi-Fi Password
MongoDB URI
JWT Secret
Device Key
GSM credentials/configuration
Admin credentials
```

Use environment variables for backend secrets.

Do not commit:

```text
.env
```

to a public Git repository.

Recommended `.gitignore` entries:

```text
node_modules/
.env
.env.*
dist/
build/
logs/
```

---

# 42. Current System Architecture

SafeHaven currently uses:

```text
ESP32
   │
   │ Wi-Fi
   ▼
Custom REST API
   │
   ▼
Node.js + Express
   │
   ├───────────────┐
   ▼               ▼
MongoDB         Socket.IO
   │               │
   │               ▼
   │          React Dashboard
   │
   ▼
Automation Engine
   │
   ├── Alerts
   ├── Commands
   ├── SMS
   └── Safety Actions
```

**Blynk is not used in the current architecture.**

---

# 43. Important Design Decision

The current SafeHaven implementation uses a **custom web platform and REST API** instead of Blynk.

Therefore:

```text
ESP32
  ↓
Wi-Fi
  ↓
Custom REST API
  ↓
Node.js Backend
  ↓
MongoDB
  ↓
React Dashboard
```

This gives the project control over:

* Data storage
* Dashboard design
* Authentication
* Device management
* Automation
* Alerts
* SMS
* Historical data
* System settings

---

# 44. Advantages

SafeHaven provides:

1. Real-time safety monitoring
2. Automatic emergency response
3. Web-based remote monitoring
4. SMS emergency notification
5. Configurable thresholds
6. Historical sensor data
7. Realtime dashboard updates
8. Multiple safety sensors
9. Automatic actuator control
10. Centralized system management
11. Device authentication
12. Role-based access
13. Custom notification messages
14. Persistent database storage

---

# 45. Limitations

Current limitations may include:

* DHT11 provides relatively basic environmental measurements.
* MQ-series sensors require proper calibration.
* Analog sensor values are represented as normalized values rather than laboratory-grade gas concentration measurements.
* GSM communication depends on cellular network availability.
* Wi-Fi connectivity is required for web telemetry.
* Physical actuator safety depends on correct electrical isolation and relay wiring.
* Local development currently uses localhost unless the backend is deployed to a network-accessible server.
* Real-world deployment requires proper enclosure, power protection and electrical safety.

---

# 46. Future Scope

Possible future improvements include:

* Mobile application
* Cloud deployment
* Multiple ESP32 device support
* Advanced analytics
* Predictive safety analysis
* AI-based anomaly detection
* Camera-based fire verification
* GPS-based emergency location
* Voice alerts
* Email notifications
* WhatsApp notifications
* Advanced sensor calibration
* Industrial-grade sensors
* Battery backup
* Solar power support
* Multi-location monitoring
* Advanced reporting
* PDF report generation

---

# 47. Project Status

### Core Development

```text
ESP32 Integration       ✅
Sensor Monitoring       ✅
LCD Display             ✅
Actuators               ✅
GSM/SMS                 ✅
REST API                ✅
MongoDB                 ✅
Device Authentication   ✅
Automation              ✅
Alerts                  ✅
Commands                ✅
React Dashboard         ✅
Settings                ✅
Notifications            ✅
Socket.IO               ✅
```

The software architecture is feature-complete according to the current project scope.

Final project validation should still include **physical end-to-end testing** of the ESP32, sensors, GSM module, relay-controlled pump/fan, backend, database and web dashboard together.

---

# 48. Development Commands

## Backend

```powershell
cd backend
npm install
npm run dev
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Build Frontend

```powershell
npm run build
```

## Preview Production Build

```powershell
npm run preview
```

---

# 49. Recommended Development Order

When setting up the complete project on another computer:

```text
1. Install Node.js
        ↓
2. Install MongoDB
        ↓
3. Install Arduino IDE
        ↓
4. Install ESP32 Board Package
        ↓
5. Install Backend Dependencies
        ↓
6. Configure .env
        ↓
7. Start MongoDB
        ↓
8. Start Backend
        ↓
9. Start Frontend
        ↓
10. Configure ESP32 Wi-Fi/API
        ↓
11. Upload ESP32 Firmware
        ↓
12. Verify Telemetry
        ↓
13. Verify Dashboard
        ↓
14. Verify Automation
        ↓
15. Verify GSM/SMS
        ↓
16. Perform End-to-End Testing
```

---

# 50. Conclusion

SafeHaven is an IoT-based smart safety monitoring and automation platform that combines embedded hardware, sensors, cloud-style REST communication, database storage, realtime web monitoring, automatic safety actions and GSM-based emergency notifications.

The system continuously monitors:

```text
Temperature
Humidity
Smoke
Gas
Noise
Fire
```

and can automatically respond through:

```text
Water Pump
Exhaust Fan
Buzzer
Red LED
Green LED
SMS
```

The custom web platform provides centralized monitoring and configuration, while the ESP32 provides local sensing and immediate hardware-level safety responses.

SafeHaven therefore provides an integrated architecture combining:

```text
IoT
+
Embedded Systems
+
REST API
+
Node.js
+
MongoDB
+
React
+
Socket.IO
+
Automation
+
GSM
```

---

# 51. Project Information

**Project:** SafeHaven – IoT Smart Safety System

**Platform:** Custom Web Platform

**Controller:** ESP32

**Backend:** Node.js + Express.js

**Frontend:** React + Vite

**Database:** MongoDB

**Communication:** Wi-Fi + REST API + Socket.IO

**Emergency Communication:** SIM800C GSM

**Device ID:** `SAFEHAVEN-001`

**Cloud Platform:** Custom REST API

**Blynk:** Not used in the current implementation

---

## License

This project is developed for academic/project purposes.

---

## Acknowledgement

SafeHaven was developed as an IoT-based safety monitoring and automation project integrating embedded hardware with a custom web platform.

The project combines sensor monitoring, realtime communication, database management, automation and emergency notification into a single safety management system.
