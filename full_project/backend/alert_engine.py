import logging
from sqlalchemy.orm import Session
import models

logger = logging.getLogger(__name__)


def get_or_create_thresholds(db: Session, device_id: str) -> models.DeviceThreshold:
    """Fetch device thresholds or create defaults if not set."""
    threshold = db.query(models.DeviceThreshold).filter(
        models.DeviceThreshold.device_id == device_id
    ).first()

    if threshold is None:
        threshold = models.DeviceThreshold(device_id=device_id)
        db.add(threshold)
        db.commit()
        db.refresh(threshold)
        logger.info(f"Created default thresholds for device {device_id}")

    return threshold


def evaluate_and_save_alerts(
    db: Session,
    device_id: str,
    voltage: float,
    current: float,
    temperature: float,
    fan_speed: float,
    humidity: float,
    anomaly: bool,
) -> list:
    """
    Evaluate sensor readings against dynamic device thresholds.
    Saves triggered alerts/alarms to the database.
    Returns list of triggered alert dicts.
    """
    thresholds = get_or_create_thresholds(db, device_id)
    triggered = []

    # --- ALARM checks (critical) ---
    if temperature > thresholds.temp_alarm:
        msg = (
            f"ALARM: Temperature {temperature:.1f}°C exceeds alarm threshold "
            f"{thresholds.temp_alarm:.1f}°C"
        )
        triggered.append({"type": "alarm", "message": msg})

    if voltage < thresholds.voltage_min_alarm:
        msg = (
            f"ALARM: Voltage {voltage:.2f}V is below minimum alarm threshold "
            f"{thresholds.voltage_min_alarm:.2f}V"
        )
        triggered.append({"type": "alarm", "message": msg})

    if voltage > thresholds.voltage_max_alarm:
        msg = (
            f"ALARM: Voltage {voltage:.2f}V exceeds maximum alarm threshold "
            f"{thresholds.voltage_max_alarm:.2f}V"
        )
        triggered.append({"type": "alarm", "message": msg})

    if fan_speed < thresholds.fan_alarm_min:
        msg = (
            f"ALARM: Fan speed {fan_speed:.0f} RPM is below alarm minimum "
            f"{thresholds.fan_alarm_min:.0f} RPM"
        )
        triggered.append({"type": "alarm", "message": msg})

    if anomaly:
        msg = "ALARM: ML model detected an anomaly in sensor readings"
        triggered.append({"type": "alarm", "message": msg})

    # --- ALERT checks (warnings) ---
    if temperature > thresholds.temp_alert and temperature <= thresholds.temp_alarm:
        msg = (
            f"ALERT: Temperature {temperature:.1f}°C exceeds alert threshold "
            f"{thresholds.temp_alert:.1f}°C"
        )
        triggered.append({"type": "alert", "message": msg})

    if fan_speed < thresholds.fan_alert_min and fan_speed >= thresholds.fan_alarm_min:
        msg = (
            f"ALERT: Fan speed {fan_speed:.0f} RPM is below alert minimum "
            f"{thresholds.fan_alert_min:.0f} RPM"
        )
        triggered.append({"type": "alert", "message": msg})

    if humidity > thresholds.humidity_alert:
        msg = (
            f"ALERT: Humidity {humidity:.1f}% exceeds alert threshold "
            f"{thresholds.humidity_alert:.1f}%"
        )
        triggered.append({"type": "alert", "message": msg})

    # Persist triggered alerts to database
    for item in triggered:
        alert = models.Alert(
            device_id=device_id,
            type=item["type"],
            message=item["message"],
        )
        db.add(alert)

    if triggered:
        db.commit()
        logger.info(f"Saved {len(triggered)} alert(s) for device {device_id}")

    return triggered
