from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


# Auth schemas
class UserRegister(BaseModel):
    device_id: str
    password: str


class UserLogin(BaseModel):
    device_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Sensor data schemas
class SensorDataResponse(BaseModel):
    id: uuid.UUID
    device_id: str
    voltage: float
    current: float
    temperature: float
    fan_speed: float
    humidity: float
    anomaly: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Alert schemas
class AlertResponse(BaseModel):
    id: uuid.UUID
    device_id: str
    type: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


# Threshold schemas
class ThresholdUpdate(BaseModel):
    temp_alert: float
    temp_alarm: float
    voltage_min_alarm: float
    voltage_max_alarm: float
    fan_alert_min: float
    fan_alarm_min: float
    humidity_alert: float


class ThresholdResponse(BaseModel):
    id: uuid.UUID
    device_id: str
    temp_alert: float
    temp_alarm: float
    voltage_min_alarm: float
    voltage_max_alarm: float
    fan_alert_min: float
    fan_alarm_min: float
    humidity_alert: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Admin schemas
class CreateDevice(BaseModel):
    device_id: str


class DeviceResponse(BaseModel):
    id: uuid.UUID
    device_id: str
    license_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Dashboard live data
class LiveDataResponse(BaseModel):
    latest_reading: Optional[SensorDataResponse]
    device_id: str
    status: str


class HistoryResponse(BaseModel):
    readings: List[SensorDataResponse]
    total: int


class AlertsResponse(BaseModel):
    alerts: List[AlertResponse]
    total: int
