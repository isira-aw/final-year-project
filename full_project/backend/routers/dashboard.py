from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
import models
import schemas
import auth
import mqtt_client as mqtt_state

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/live", response_model=schemas.LiveDataResponse)
def get_live_data(
    current_user: models.User = Depends(auth.get_licensed_user),
):
    """Return the latest cached sensor reading for the authenticated device."""
    device_id = current_user.device_id
    latest = mqtt_state.latest_readings.get(device_id)

    if latest is None:
        return schemas.LiveDataResponse(
            latest_reading=None,
            device_id=device_id,
            status="No data received yet",
        )

    reading = schemas.SensorDataResponse(
        id=latest["id"],
        device_id=latest["device_id"],
        voltage=latest["voltage"],
        current=latest["current"],
        temperature=latest["temperature"],
        fan_speed=latest["fan_speed"],
        humidity=latest["humidity"],
        anomaly=latest["anomaly"],
        created_at=datetime.fromisoformat(latest["created_at"]),
    )

    return schemas.LiveDataResponse(
        latest_reading=reading,
        device_id=device_id,
        status="active",
    )


@router.get("/history", response_model=schemas.HistoryResponse)
def get_history(
    limit: int = 10,
    current_user: models.User = Depends(auth.get_licensed_user),
    db: Session = Depends(get_db),
):
    """Return last N sensor readings for the authenticated device."""
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 100.")

    readings = (
        db.query(models.SensorData)
        .filter(models.SensorData.device_id == current_user.device_id)
        .order_by(models.SensorData.created_at.desc())
        .limit(limit)
        .all()
    )

    total = (
        db.query(models.SensorData)
        .filter(models.SensorData.device_id == current_user.device_id)
        .count()
    )

    return schemas.HistoryResponse(readings=readings, total=total)


@router.get("/alerts", response_model=schemas.AlertsResponse)
def get_alerts(
    limit: int = 20,
    current_user: models.User = Depends(auth.get_licensed_user),
    db: Session = Depends(get_db),
):
    """Return recent alerts/alarms for the authenticated device."""
    alerts = (
        db.query(models.Alert)
        .filter(models.Alert.device_id == current_user.device_id)
        .order_by(models.Alert.created_at.desc())
        .limit(limit)
        .all()
    )

    total = (
        db.query(models.Alert)
        .filter(models.Alert.device_id == current_user.device_id)
        .count()
    )

    return schemas.AlertsResponse(alerts=alerts, total=total)


@router.get("/thresholds", response_model=schemas.ThresholdResponse)
def get_thresholds(
    current_user: models.User = Depends(auth.get_licensed_user),
    db: Session = Depends(get_db),
):
    """Return current thresholds for the authenticated device."""
    threshold = (
        db.query(models.DeviceThreshold)
        .filter(models.DeviceThreshold.device_id == current_user.device_id)
        .first()
    )

    if threshold is None:
        # Create default thresholds
        threshold = models.DeviceThreshold(device_id=current_user.device_id)
        db.add(threshold)
        db.commit()
        db.refresh(threshold)

    return threshold


@router.put("/thresholds", response_model=schemas.ThresholdResponse)
def update_thresholds(
    payload: schemas.ThresholdUpdate,
    current_user: models.User = Depends(auth.get_licensed_user),
    db: Session = Depends(get_db),
):
    """Update alert/alarm thresholds for the authenticated device."""
    threshold = (
        db.query(models.DeviceThreshold)
        .filter(models.DeviceThreshold.device_id == current_user.device_id)
        .first()
    )

    if threshold is None:
        threshold = models.DeviceThreshold(device_id=current_user.device_id)
        db.add(threshold)

    threshold.temp_alert = payload.temp_alert
    threshold.temp_alarm = payload.temp_alarm
    threshold.voltage_min_alarm = payload.voltage_min_alarm
    threshold.voltage_max_alarm = payload.voltage_max_alarm
    threshold.fan_alert_min = payload.fan_alert_min
    threshold.fan_alarm_min = payload.fan_alarm_min
    threshold.humidity_alert = payload.humidity_alert
    threshold.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(threshold)
    return threshold
