'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLiveData,
  getHistory,
  getAlerts,
  getThresholds,
  updateThresholds,
  type SensorReading,
  type Alert,
  type LiveData,
  type Thresholds,
} from '@/lib/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, icon, color }: {
  label: string; value: string | number; unit: string; icon: string; color: string;
}) {
  return (
    <div className={`metric-card border-t-4 ${color}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-3xl font-bold text-white">{value}<span className="text-lg text-slate-400 ml-1">{unit}</span></div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ anomaly }: { anomaly: boolean }) {
  return anomaly
    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-700">⚠ Anomaly</span>
    : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">✓ Normal</span>;
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState('');
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [thresholdForm, setThresholdForm] = useState<Partial<Thresholds>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('device_id');
    router.push('/login');
  }, [router]);

  const fetchAll = useCallback(async () => {
    try {
      const [live, hist, alertData, thresh] = await Promise.all([
        getLiveData(),
        getHistory(10),
        getAlerts(20),
        getThresholds(),
      ]);
      setLiveData(live);
      setHistory(hist.readings);
      setAlerts(alertData.alerts);
      if (!thresholds) {
        setThresholds(thresh);
        setThresholdForm(thresh);
      }
      setError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      if (msg.toLowerCase().includes('not authenticated') || msg.toLowerCase().includes('unauthorized')) {
        logout();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [logout, thresholds]);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const did = localStorage.getItem('device_id');
    if (!token) { router.push('/login'); return; }
    setDeviceId(did || '');
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [router, fetchAll]);

  async function handleSaveThresholds() {
    if (!thresholdForm) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await updateThresholds({
        temp_alert: Number(thresholdForm.temp_alert),
        temp_alarm: Number(thresholdForm.temp_alarm),
        voltage_min_alarm: Number(thresholdForm.voltage_min_alarm),
        voltage_max_alarm: Number(thresholdForm.voltage_max_alarm),
        fan_alert_min: Number(thresholdForm.fan_alert_min),
        fan_alarm_min: Number(thresholdForm.fan_alarm_min),
        humidity_alert: Number(thresholdForm.humidity_alert),
      });
      setThresholds(updated);
      setThresholdForm(updated);
      setSaveMsg('Thresholds saved successfully!');
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  // Chart data
  const chartLabels = [...history].reverse().map((r) =>
    new Date(r.created_at).toLocaleTimeString()
  );

  const tempChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: [...history].reverse().map((r) => r.temperature),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const voltageChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Voltage (V)',
        data: [...history].reverse().map((r) => r.voltage),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
      x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
      y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
    },
  };

  const alarms = alerts.filter((a) => a.type === 'alarm');
  const alertsOnly = alerts.filter((a) => a.type === 'alert');
  const live = liveData?.latest_reading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navbar */}
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">T</div>
            <div>
              <h1 className="text-white font-semibold">Telecom Monitor</h1>
              <p className="text-xs text-slate-400">Device: {deviceId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`flex items-center space-x-1.5 text-sm ${liveData?.status === 'active' ? 'text-green-400' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${liveData?.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>{liveData?.status === 'active' ? 'Live' : 'Waiting for data'}</span>
            </span>
            <button onClick={logout} className="btn-secondary text-sm">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-lg px-4 py-3 text-sm">
            Error: {error}
          </div>
        )}

        {/* Live Metrics */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Live Sensor Readings</h2>
          {live ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard label="Voltage" value={live.voltage.toFixed(1)} unit="V" icon="⚡" color="border-blue-500" />
              <MetricCard label="Current" value={live.current.toFixed(1)} unit="A" icon="🔌" color="border-indigo-500" />
              <MetricCard label="Temperature" value={live.temperature.toFixed(1)} unit="°C" icon="🌡" color="border-orange-500" />
              <MetricCard label="Fan Speed" value={live.fan_speed.toFixed(0)} unit="RPM" icon="💨" color="border-cyan-500" />
              <MetricCard label="Humidity" value={live.humidity.toFixed(1)} unit="%" icon="💧" color="border-teal-500" />
              <div className="metric-card border-t-4 border-purple-500">
                <div className="text-2xl mb-2">🤖</div>
                <StatusBadge anomaly={live.anomaly} />
                <div className="text-sm text-slate-400 mt-2">ML Status</div>
              </div>
            </div>
          ) : (
            <div className="card text-center text-slate-400 py-10">
              No sensor data received yet. Ensure the ESP32 device is publishing to MQTT.
            </div>
          )}
        </section>

        {/* Charts */}
        {history.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Sensor Trends</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card">
                <Line data={tempChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: 'Temperature Over Time', color: '#94a3b8' } } }} />
              </div>
              <div className="card">
                <Line data={voltageChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { display: true, text: 'Voltage Over Time', color: '#94a3b8' } } }} />
              </div>
            </div>
          </section>
        )}

        {/* Alarms & Alerts */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Alarms & Alerts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Alarms */}
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>ALARMS ({alarms.length})</span>
              </h3>
              {alarms.length === 0 ? (
                <div className="alarm-box text-center text-slate-400 py-4 text-sm">No active alarms</div>
              ) : (
                <div className="space-y-2">
                  {alarms.slice(0, 5).map((a) => (
                    <div key={a.id} className="alarm-box">
                      <p className="text-red-200 text-sm font-medium">{a.message}</p>
                      <p className="text-red-400 text-xs mt-1">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alerts */}
            <div>
              <h3 className="text-sm font-medium text-yellow-400 mb-2 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>ALERTS ({alertsOnly.length})</span>
              </h3>
              {alertsOnly.length === 0 ? (
                <div className="alert-box text-center text-slate-400 py-4 text-sm">No active alerts</div>
              ) : (
                <div className="space-y-2">
                  {alertsOnly.slice(0, 5).map((a) => (
                    <div key={a.id} className="alert-box">
                      <p className="text-yellow-200 text-sm font-medium">{a.message}</p>
                      <p className="text-yellow-400 text-xs mt-1">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* History Table */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Last 10 Readings</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Voltage (V)</th>
                  <th className="pb-3 pr-4">Current (A)</th>
                  <th className="pb-3 pr-4">Temp (°C)</th>
                  <th className="pb-3 pr-4">Fan (RPM)</th>
                  <th className="pb-3 pr-4">Humidity (%)</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {history.map((row) => (
                  <tr key={row.id} className="text-slate-300 hover:bg-slate-700/30 transition-colors">
                    <td className="py-2.5 pr-4 text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="py-2.5 pr-4">{row.voltage.toFixed(2)}</td>
                    <td className="py-2.5 pr-4">{row.current.toFixed(2)}</td>
                    <td className="py-2.5 pr-4">{row.temperature.toFixed(1)}</td>
                    <td className="py-2.5 pr-4">{row.fan_speed.toFixed(0)}</td>
                    <td className="py-2.5 pr-4">{row.humidity.toFixed(1)}</td>
                    <td className="py-2.5"><StatusBadge anomaly={row.anomaly} /></td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">No readings yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Threshold Settings */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Threshold Settings</h2>
          <div className="card">
            <p className="text-sm text-slate-400 mb-6">
              Configure alert and alarm thresholds for your device. Changes take effect immediately for all incoming sensor data.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="label">Temperature Alert (°C)</label>
                <input type="number" className="input-field" step="0.1"
                  value={thresholdForm.temp_alert ?? ''}
                  onChange={(e) => setThresholdForm((f) => ({ ...f, temp_alert: parseFloat(e.target.value) }))} />
                <p className="text-xs text-yellow-500 mt-1">⚠ Warning threshold</p>
              </div>
              <div>
                <label className="label">Temperature Alarm (°C)</label>
                <input type="number" className="input-field" step="0.1"
                  value={thresholdForm.temp_alarm ?? ''}
                  onChange={(e) => setThresholdForm((f) => ({ ...f, temp_alarm: parseFloat(e.target.value) }))} />
                <p className="text-xs text-red-500 mt-1">🚨 Critical threshold</p>
              </div>
              <div>
                <label className="label">Voltage Min Alarm (V)</label>
                <input type="number" className="input-field" step="0.1"
                  value={thresholdForm.voltage_min_alarm ?? ''}
                  onChange={(e) => setThresholdForm((f) => ({ ...f, voltage_min_alarm: parseFloat(e.target.value) }))} />
                <p className="text-xs text-red-500 mt-1">🚨 Under-voltage alarm</p>
              </div>
              <div>
                <label className="label">Voltage Max Alarm (V)</label>
                <input type="number" className="input-field" step="0.1"
                  value={thresholdForm.voltage_max_alarm ?? ''}
                  onChange={(e) => setThresholdForm((f) => ({ ...f, voltage_max_alarm: parseFloat(e.target.value) }))} />
                <p className="text-xs text-red-500 mt-1">🚨 Over-voltage alarm</p>
              </div>
              <div>
                <label className="label">Fan Speed Alert Min (RPM)</label>
                <input type="number" className="input-field" step="10"
                  value={thresholdForm.fan_alert_min ?? ''}
                  onChange={(e) => setThresholdForm((f) => ({ ...f, fan_alert_min: parseFloat(e.target.value) }))} />
                <p className="text-xs text-yellow-500 mt-1">⚠ Warning threshold</p>
              </div>
              <div>
                <label className="label">Fan Speed Alarm Min (RPM)</label>
                <input type="number" className="input-field" step="10"
                  value={thresholdForm.fan_alarm_min ?? ''}
                  onChange={(e) => setThresholdForm((f) => ({ ...f, fan_alarm_min: parseFloat(e.target.value) }))} />
                <p className="text-xs text-red-500 mt-1">🚨 Critical threshold</p>
              </div>
              <div>
                <label className="label">Humidity Alert (%)</label>
                <input type="number" className="input-field" step="1" max="100"
                  value={thresholdForm.humidity_alert ?? ''}
                  onChange={(e) => setThresholdForm((f) => ({ ...f, humidity_alert: parseFloat(e.target.value) }))} />
                <p className="text-xs text-yellow-500 mt-1">⚠ Warning threshold</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 mt-6">
              <button onClick={handleSaveThresholds} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Thresholds'}
              </button>
              {saveMsg && (
                <p className={`text-sm ${saveMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                  {saveMsg}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
