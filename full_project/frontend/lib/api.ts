const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jwt_token');
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Request failed');
  }

  return response.json() as Promise<T>;
}

// Auth
export async function login(device_id: string, password: string) {
  return apiFetch<{ access_token: string; token_type: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ device_id, password }),
  });
}

export async function register(device_id: string, password: string) {
  return apiFetch<{ message: string }>('/register', {
    method: 'POST',
    body: JSON.stringify({ device_id, password }),
  });
}

// Dashboard
export interface SensorReading {
  id: string;
  device_id: string;
  voltage: number;
  current: number;
  temperature: number;
  fan_speed: number;
  humidity: number;
  anomaly: boolean;
  created_at: string;
}

export interface LiveData {
  latest_reading: SensorReading | null;
  device_id: string;
  status: string;
}

export interface Alert {
  id: string;
  device_id: string;
  type: string;
  message: string;
  created_at: string;
}

export interface Thresholds {
  id: string;
  device_id: string;
  temp_alert: number;
  temp_alarm: number;
  voltage_min_alarm: number;
  voltage_max_alarm: number;
  fan_alert_min: number;
  fan_alarm_min: number;
  humidity_alert: number;
  created_at: string;
  updated_at: string;
}

export async function getLiveData(): Promise<LiveData> {
  return apiFetch<LiveData>('/dashboard/live', {}, true);
}

export async function getHistory(limit = 10): Promise<{ readings: SensorReading[]; total: number }> {
  return apiFetch<{ readings: SensorReading[]; total: number }>(
    `/dashboard/history?limit=${limit}`,
    {},
    true
  );
}

export async function getAlerts(limit = 20): Promise<{ alerts: Alert[]; total: number }> {
  return apiFetch<{ alerts: Alert[]; total: number }>(
    `/dashboard/alerts?limit=${limit}`,
    {},
    true
  );
}

export async function getThresholds(): Promise<Thresholds> {
  return apiFetch<Thresholds>('/dashboard/thresholds', {}, true);
}

export async function updateThresholds(data: Omit<Thresholds, 'id' | 'device_id' | 'created_at' | 'updated_at'>): Promise<Thresholds> {
  return apiFetch<Thresholds>('/dashboard/thresholds', {
    method: 'PUT',
    body: JSON.stringify(data),
  }, true);
}
