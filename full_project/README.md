# Telecom Tower Fault Detection System

AI-Powered Fault Detection & Predictive Maintenance System for Telecom Towers.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                         │
│                                                                     │
│  ┌──────────┐    MQTT     ┌───────────┐   SQL    ┌──────────────┐  │
│  │  ESP32   │────────────▶│  Backend  │──────────▶│  PostgreSQL  │  │
│  │ (Sensor) │            │ (FastAPI) │           │  (Database)  │  │
│  └──────────┘            │           │           └──────────────┘  │
│                          │  ┌──────┐ │                             │
│                          │  │  ML  │ │   REST API                  │
│                          │  │ Model│ │◀──────────────────────────  │
│                          │  └──────┘ │                             │
│                          └───────────┘                             │
│                                │                                   │
│                     ┌──────────┴──────────┐                        │
│                     │                     │                        │
│              ┌──────────────┐    ┌───────────────┐                 │
│              │   Frontend   │    │  Admin Panel  │                 │
│              │  (Next.js)   │    │ (HTML/CSS/JS) │                 │
│              └──────────────┘    └───────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component     | Technology              | Purpose                                        |
|---------------|-------------------------|------------------------------------------------|
| **Backend**   | FastAPI + SQLAlchemy    | REST API, MQTT subscriber, ML inference        |
| **Database**  | PostgreSQL              | Persistent storage for all data                |
| **ML Model**  | scikit-learn RandomForest | Anomaly detection on sensor readings         |
| **Frontend**  | Next.js 14 + Tailwind   | Real-time monitoring dashboard                 |
| **Admin**     | HTML + CSS + JS         | Device lifecycle management                    |
| **ESP32**     | Arduino C++             | Sensor data publisher over MQTT                |
| **MQTT**      | Mosquitto (external)    | Message broker for IoT device communication    |

---

## Project Structure

```
full_project/
├── backend/
│   ├── main.py              # FastAPI app + lifespan
│   ├── database.py          # SQLAlchemy engine + session
│   ├── models.py            # ORM table models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT + bcrypt authentication
│   ├── mqtt_client.py       # MQTT subscriber (background thread)
│   ├── ml_model.py          # RandomForest anomaly detection
│   ├── alert_engine.py      # Dynamic threshold evaluation
│   ├── routers/
│   │   ├── auth.py          # POST /register, POST /login
│   │   ├── dashboard.py     # GET/PUT /dashboard/*
│   │   └── admin.py         # POST/PUT/GET /admin/*
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Redirect to /login
│   │   ├── login/page.tsx   # Login page
│   │   └── dashboard/page.tsx # Main dashboard
│   ├── lib/api.ts           # API client
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── Dockerfile
├── admin_panel/
│   ├── index.html           # Admin UI
│   ├── style.css
│   └── app.js               # Admin logic
├── esp32code/
│   └── esp32_mqtt_publisher.ino
├── docker-compose.yml
├── railway.json
├── .env.example
└── README.md
```

---

## Quick Start (Local)

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

---

### 1. Clone & Configure

```bash
git clone <repository-url>
cd full_project
cp .env.example .env
# Edit .env with your values
```

---

### 2. PostgreSQL Setup

```sql
-- Connect to PostgreSQL and create the database
CREATE DATABASE telecom_iot;
```

Tables are created automatically on backend startup via SQLAlchemy.

---

### 3. Run the Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will:
1. Create all database tables
2. Train (or load) the ML model → saved as `model.oxxec`
3. Connect to the MQTT broker and subscribe to `telecom/+/sensor-data`

---

### 4. Run the Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### 5. Open Admin Panel

Open `admin_panel/index.html` in your browser (file:// or via a local server):

```bash
cd admin_panel
python -m http.server 8080
# Open http://localhost:8080
```

Configure:
- **Backend URL**: `http://localhost:8000`
- **Admin Token**: value of `ADMIN_TOKEN` from your `.env`

---

## Docker Compose (Recommended)

```bash
cd full_project
cp .env.example .env
# Set all required values in .env

docker compose up --build
```

| Service  | URL                           |
|----------|-------------------------------|
| Backend  | http://localhost:8000         |
| Frontend | http://localhost:3000         |
| Admin    | http://localhost:8080         |
| API Docs | http://localhost:8000/docs    |

---

## Railway Deployment

### Backend

1. Create a new Railway project
2. Add a **PostgreSQL** plugin — copy the `DATABASE_URL`
3. Deploy the backend service:
   - Root directory: `full_project/backend`
   - Or use the root `railway.json` with the correct context
4. Set environment variables:
   ```
   DATABASE_URL=<from PostgreSQL plugin>
   JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
   ADMIN_TOKEN=<strong secret>
   MOSQUITTO_HOST=trolley.proxy.rlwy.net
   MOSQUITTO_PORT=26703
   MOSQUITTO_USERNAME=fault-monitoring-system
   MOSQUITTO_PASSWORD=di1u5ydet0z049vbbl08cofp6vhya45l
   ALLOWED_ORIGINS=https://your-frontend.railway.app
   ```

### Frontend

1. Add another Railway service
2. Root directory: `full_project/frontend`
3. Set environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```

---

## Authentication Flow

```
Admin creates device  →  device exists in DB (license_active = false)
                           ↓
User registers (device_id + password)  →  user row created
                           ↓
Admin activates license  →  license_active = true
                           ↓
User logs in  →  JWT returned  →  dashboard accessible
```

### API Endpoints

#### Public
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register with device_id + password |
| POST | `/login` | Login → returns JWT |

#### Dashboard (JWT required, license must be active)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/live` | Latest cached sensor reading |
| GET | `/dashboard/history?limit=10` | Last N sensor readings |
| GET | `/dashboard/alerts?limit=20` | Recent alerts and alarms |
| GET | `/dashboard/thresholds` | Current device thresholds |
| PUT | `/dashboard/thresholds` | Update device thresholds |

#### Admin (Admin Token required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/create-device` | Register a new device |
| PUT | `/admin/toggle-license/{device_id}` | Toggle license on/off |
| GET | `/admin/devices` | List all devices |

Full interactive docs at: `http://localhost:8000/docs`

---

## Dynamic Threshold System

Thresholds are stored **per device** in the `device_thresholds` table.

When sensor data arrives from MQTT:

1. Backend fetches the device's thresholds from PostgreSQL
2. Compares values against thresholds:

| Condition | Type | Rule |
|-----------|------|------|
| temperature > temp_alert | ⚠ Alert | Warning — rising temperature |
| temperature > temp_alarm | 🚨 Alarm | Critical — overheating |
| voltage < voltage_min_alarm | 🚨 Alarm | Under-voltage |
| voltage > voltage_max_alarm | 🚨 Alarm | Over-voltage |
| fan_speed < fan_alert_min | ⚠ Alert | Reduced fan speed |
| fan_speed < fan_alarm_min | 🚨 Alarm | Fan failure |
| humidity > humidity_alert | ⚠ Alert | High humidity |
| ML predicts anomaly | 🚨 Alarm | AI-detected fault pattern |

3. Triggered alerts are saved to the `alerts` table
4. Users can update thresholds from the dashboard — changes are instant

**Default thresholds (created automatically on first data receipt):**

| Threshold | Default |
|-----------|---------|
| temp_alert | 45.0 °C |
| temp_alarm | 55.0 °C |
| voltage_min_alarm | 46.0 V |
| voltage_max_alarm | 54.0 V |
| fan_alert_min | 600 RPM |
| fan_alarm_min | 450 RPM |
| humidity_alert | 80.0 % |

---

## ML Model

- **Algorithm**: RandomForestClassifier (scikit-learn)
- **Features**: voltage, current, temperature, fan_speed, humidity
- **Training**: 5000 synthetic samples (85% normal, 15% anomalous)
- **File**: `model.oxxec` (joblib format)

If `model.oxxec` is not found at startup, the model is automatically trained and saved.

**Anomaly patterns the model learns:**
- Voltage outside 46–54V range
- Temperature above 55°C
- Fan speed below 450 RPM
- Combined multi-sensor deviations

---

## ESP32 Flashing Guide

### Hardware Requirements
- ESP32 development board (any variant)
- USB cable for programming
- Sensors (or use built-in simulation)

### Software Setup

1. Install **Arduino IDE** (2.x recommended)
2. Add ESP32 board support:
   - File → Preferences → Additional Board URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board Manager → Install **esp32**

3. Install required libraries (Tools → Library Manager):
   - **PubSubClient** by Nick O'Leary (≥ 2.8)
   - **ArduinoJson** by Benoit Blanchon (≥ 6.0)

### Configuration

Edit `esp32code/esp32_mqtt_publisher.ino`:

```cpp
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define DEVICE_ID     "tower-001"    // Must match device in admin panel
```

### Flash

1. Select board: Tools → Board → ESP32 Dev Module
2. Select the correct COM/USB port
3. Click **Upload**
4. Open Serial Monitor (115200 baud) to verify

Expected output:
```
[WiFi] Connected! IP: 192.168.x.x
[MQTT] Connected!
[PUB #1] telecom/tower-001/sensor-data => V:50.12V I:12.34A T:35.2°C FAN:1200RPM H:55.3%
```

---

## Security Notes

- All secrets are in environment variables — never hardcoded
- JWT tokens expire after `JWT_EXPIRE_MINUTES` (default: 60 minutes)
- Passwords hashed with bcrypt (cost factor 12)
- Admin endpoints protected by a separate static `ADMIN_TOKEN`
- CORS restricted to configured origins only

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend fails to start | Check `DATABASE_URL` is correct and PostgreSQL is running |
| MQTT not receiving data | Verify broker credentials and that ESP32 device_id matches admin panel |
| Login returns 403 | Device license not activated — use admin panel to toggle |
| Model not loading | Delete `model.oxxec` and restart — it will retrain automatically |
| Frontend can't reach backend | Check `NEXT_PUBLIC_API_URL` and CORS `ALLOWED_ORIGINS` |
