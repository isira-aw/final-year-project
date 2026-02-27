import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String, unique=True, nullable=False, index=True)
    license_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SensorData(Base):
    __tablename__ = "sensor_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String, nullable=False, index=True)
    voltage = Column(Float, nullable=False)
    current = Column(Float, nullable=False)
    temperature = Column(Float, nullable=False)
    fan_speed = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    anomaly = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)  # "alert" or "alarm"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceThreshold(Base):
    __tablename__ = "device_thresholds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String, ForeignKey("devices.device_id"), unique=True, nullable=False, index=True)
    temp_alert = Column(Float, default=45.0, nullable=False)
    temp_alarm = Column(Float, default=55.0, nullable=False)
    voltage_min_alarm = Column(Float, default=46.0, nullable=False)
    voltage_max_alarm = Column(Float, default=54.0, nullable=False)
    fan_alert_min = Column(Float, default=600.0, nullable=False)
    fan_alarm_min = Column(Float, default=450.0, nullable=False)
    humidity_alert = Column(Float, default=80.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
