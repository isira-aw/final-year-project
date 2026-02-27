import os
import logging
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)

MODEL_PATH = os.getenv("MODEL_PATH", "model.oxxec")


def generate_synthetic_data(n_samples: int = 5000):
    """Generate synthetic sensor data for training the anomaly detection model."""
    np.random.seed(42)

    # Normal operating conditions
    normal_count = int(n_samples * 0.85)
    normal_voltage = np.random.uniform(47, 53, normal_count)
    normal_current = np.random.uniform(10.5, 14.5, normal_count)
    normal_temperature = np.random.uniform(25, 44, normal_count)
    normal_fan_speed = np.random.uniform(650, 1500, normal_count)
    normal_humidity = np.random.uniform(40, 79, normal_count)
    normal_labels = np.zeros(normal_count)

    # Anomalous conditions
    anomaly_count = n_samples - normal_count
    anomaly_voltage = np.concatenate([
        np.random.uniform(40, 46, anomaly_count // 3),
        np.random.uniform(54, 60, anomaly_count // 3),
        np.random.uniform(47, 53, anomaly_count - 2 * (anomaly_count // 3)),
    ])
    anomaly_current = np.random.uniform(10, 15, anomaly_count)
    anomaly_temperature = np.concatenate([
        np.random.uniform(55, 75, anomaly_count // 2),
        np.random.uniform(25, 44, anomaly_count - anomaly_count // 2),
    ])
    anomaly_fan_speed = np.concatenate([
        np.random.uniform(100, 449, anomaly_count // 2),
        np.random.uniform(650, 1500, anomaly_count - anomaly_count // 2),
    ])
    anomaly_humidity = np.concatenate([
        np.random.uniform(80, 99, anomaly_count // 2),
        np.random.uniform(40, 79, anomaly_count - anomaly_count // 2),
    ])
    anomaly_labels = np.ones(anomaly_count)

    voltage = np.concatenate([normal_voltage, anomaly_voltage])
    current = np.concatenate([normal_current, anomaly_current])
    temperature = np.concatenate([normal_temperature, anomaly_temperature])
    fan_speed = np.concatenate([normal_fan_speed, anomaly_fan_speed])
    humidity = np.concatenate([normal_humidity, anomaly_humidity])
    labels = np.concatenate([normal_labels, anomaly_labels])

    X = np.column_stack([voltage, current, temperature, fan_speed, humidity])
    y = labels.astype(int)

    return X, y


def train_model() -> RandomForestClassifier:
    """Train a RandomForest anomaly detection model on synthetic data."""
    logger.info("Training new RandomForest anomaly detection model...")
    X, y = generate_synthetic_data(5000)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    accuracy = clf.score(X_test, y_test)
    logger.info(f"Model trained. Test accuracy: {accuracy:.4f}")

    joblib.dump(clf, MODEL_PATH)
    logger.info(f"Model saved to {MODEL_PATH}")
    return clf


def load_model() -> RandomForestClassifier:
    """Load model from disk or train a new one."""
    if os.path.exists(MODEL_PATH):
        try:
            clf = joblib.load(MODEL_PATH)
            logger.info(f"Model loaded from {MODEL_PATH}")
            return clf
        except Exception as e:
            logger.warning(f"Failed to load model: {e}. Retraining...")

    return train_model()


# Global model instance
_model: RandomForestClassifier = None


def get_model() -> RandomForestClassifier:
    global _model
    if _model is None:
        _model = load_model()
    return _model


def predict_anomaly(voltage: float, current: float, temperature: float, fan_speed: float, humidity: float) -> bool:
    """Predict whether sensor readings indicate an anomaly."""
    model = get_model()
    features = np.array([[voltage, current, temperature, fan_speed, humidity]])
    prediction = model.predict(features)[0]
    return bool(prediction == 1)
