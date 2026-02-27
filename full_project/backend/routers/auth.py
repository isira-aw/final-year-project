from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import auth

router = APIRouter(tags=["Authentication"])


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    # Check device exists in devices table (admin must create device first)
    device = db.query(models.Device).filter(models.Device.device_id == payload.device_id).first()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found. Contact admin to register the device first.",
        )

    # Check if user already registered for this device
    existing = db.query(models.User).filter(models.User.device_id == payload.device_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user is already registered for this device.",
        )

    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 6 characters.",
        )

    hashed = auth.hash_password(payload.password)
    user = models.User(device_id=payload.device_id, password_hash=hashed, role="user")
    db.add(user)
    db.commit()

    return {"message": "Registration successful. You can now log in."}


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.device_id == payload.device_id).first()
    if user is None or not auth.verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device_id or password.",
        )

    # Admins bypass the device/license check
    if user.role != "admin":
        device = db.query(models.Device).filter(models.Device.device_id == payload.device_id).first()
        if device is None or not device.license_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device license is not active. Contact admin.",
            )

    token = auth.create_access_token({"sub": user.device_id, "role": user.role})
    return schemas.TokenResponse(access_token=token, role=user.role)
