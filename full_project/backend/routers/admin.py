from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
import auth

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/create-device", response_model=schemas.DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: schemas.CreateDevice,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_admin_user),
):
    """Admin: Create a new device entry."""
    existing = db.query(models.Device).filter(models.Device.device_id == payload.device_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device '{payload.device_id}' already exists.",
        )

    device = models.Device(device_id=payload.device_id, license_active=False)
    db.add(device)
    db.commit()
    db.refresh(device)

    return device


@router.put("/toggle-license/{device_id}", response_model=schemas.DeviceResponse)
def toggle_license(
    device_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_admin_user),
):
    """Admin: Toggle the license status of a device."""
    device = db.query(models.Device).filter(models.Device.device_id == device_id).first()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device '{device_id}' not found.",
        )

    device.license_active = not device.license_active
    db.commit()
    db.refresh(device)

    return device


@router.get("/devices", response_model=List[schemas.DeviceResponse])
def list_devices(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.get_admin_user),
):
    """Admin: List all registered devices."""
    devices = db.query(models.Device).order_by(models.Device.created_at.desc()).all()
    return devices
