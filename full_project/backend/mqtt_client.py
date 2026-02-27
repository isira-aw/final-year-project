import os
import json
import logging
import threading
import paho.mqtt.client as mqtt
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import ml_model
import alert_engine

logger = logging.getLogger(__name__)

MOSQUITTO_HOST = os.getenv("MOSQUITTO_HOST", "trolley.proxy.rlwy.net")
MOSQUITTO_PORT = int(os.getenv("MOSQUITTO_PORT", "26703"))
MOSQUITTO_USERNAME = os.getenv("MOSQUITTO_USERNAME", "fault-monitoring-system")
MOSQUITTO_PASSWORD = os.getenv("MOSQUITTO_PASSWORD", "di1u5ydet0z049vbbl08cofp6vhya45l")
MQTT_TOPIC = "telecom/+/sensor-data"

# In-memory cache of latest readings per device
latest_readings: dict = {}
mqtt_client_instance: mqtt.Client = None


def process_sensor_message(device_id: str, payload: dict) -> None:
    """Process incoming sensor data: store, run ML, evaluate alerts."""
    db: Session = SessionLocal()
    try:
        voltage = float(payload.get("voltage", 0))
        current = float(payload.get("current", 0))
        temperature = float(payload.get("temperature", 0))
        fan_speed = float(payload.get("fan_speed", 0))
        humidity = float(payload.get("humidity", 0))

        # Run ML anomaly detection
        anomaly = ml_model.predict_anomaly(voltage, current, temperature, fan_speed, humidity)

        # Check device exists (only store data for registered devices)
        device = db.query(models.Device).filter(models.Device.device_id == device_id).first()
        if device is None:
            logger.warning(f"Received data from unregistered device: {device_id}")
            return

        # Persist sensor reading
        reading = models.SensorData(
            device_id=device_id,
            voltage=voltage,
            current=current,
            temperature=temperature,
            fan_speed=fan_speed,
            humidity=humidity,
            anomaly=anomaly,
        )
        db.add(reading)
        db.commit()
        db.refresh(reading)

        # Cache latest reading
        latest_readings[device_id] = {
            "id": str(reading.id),
            "device_id": device_id,
            "voltage": voltage,
            "current": current,
            "temperature": temperature,
            "fan_speed": fan_speed,
            "humidity": humidity,
            "anomaly": anomaly,
            "created_at": reading.created_at.isoformat(),
        }

        # Evaluate dynamic thresholds and save alerts
        alert_engine.evaluate_and_save_alerts(
            db=db,
            device_id=device_id,
            voltage=voltage,
            current=current,
            temperature=temperature,
            fan_speed=fan_speed,
            humidity=humidity,
            anomaly=anomaly,
        )

        logger.debug(f"Processed data from {device_id}: temp={temperature}, anomaly={anomaly}")

    except Exception as e:
        logger.error(f"Error processing message from {device_id}: {e}")
        db.rollback()
    finally:
        db.close()


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info(f"Connected to MQTT broker at {MOSQUITTO_HOST}:{MOSQUITTO_PORT}")
        client.subscribe(MQTT_TOPIC)
        logger.info(f"Subscribed to topic: {MQTT_TOPIC}")
    else:
        logger.error(f"MQTT connection failed with code {rc}")


def on_message(client, userdata, msg):
    try:
        topic_parts = msg.topic.split("/")
        if len(topic_parts) != 3:
            logger.warning(f"Unexpected topic format: {msg.topic}")
            return

        device_id = topic_parts[1]
        payload = json.loads(msg.payload.decode("utf-8"))
        logger.debug(f"Received from {device_id}: {payload}")

        # Process in a thread to avoid blocking MQTT loop
        thread = threading.Thread(
            target=process_sensor_message,
            args=(device_id, payload),
            daemon=True,
        )
        thread.start()

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON payload on topic {msg.topic}: {e}")
    except Exception as e:
        logger.error(f"Error handling MQTT message: {e}")


def on_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning(f"Unexpected MQTT disconnect (rc={rc}). Will attempt reconnect.")


def start_mqtt_client():
    """Initialize and start the MQTT client in a background thread."""
    global mqtt_client_instance

    client = mqtt.Client(client_id="telecom-backend", clean_session=True)
    client.username_pw_set(MOSQUITTO_USERNAME, MOSQUITTO_PASSWORD)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    # Enable auto-reconnect
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    try:
        client.connect(MOSQUITTO_HOST, MOSQUITTO_PORT, keepalive=60)
    except Exception as e:
        logger.error(f"Initial MQTT connection failed: {e}")

    mqtt_client_instance = client

    thread = threading.Thread(target=client.loop_forever, daemon=True)
    thread.start()
    logger.info("MQTT background thread started")


def stop_mqtt_client():
    global mqtt_client_instance
    if mqtt_client_instance:
        mqtt_client_instance.disconnect()
        logger.info("MQTT client disconnected")
