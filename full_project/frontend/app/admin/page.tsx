'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminListDevices,
  adminCreateDevice,
  adminToggleLicense,
  type Device,
} from '@/lib/api';

// ── Small components ──────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border transition-all
        ${type === 'success'
          ? 'bg-green-900/90 border-green-600 text-green-200'
          : 'bg-red-900/90 border-red-600 text-red-200'}`}
    >
      {type === 'success' ? '✓ ' : '✗ '}{message}
    </div>
  );
}

function LicenseBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/40 text-green-300 border border-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      Licensed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-900/40 text-red-300 border border-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Unlicensed
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Create device form
  const [newDeviceId, setNewDeviceId] = useState('');
  const [creating, setCreating] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const logout = useCallback(() => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('device_id');
    localStorage.removeItem('role');
    router.push('/login');
  }, [router]);

  const fetchDevices = useCallback(async () => {
    try {
      const list = await adminListDevices();
      setDevices(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load devices';
      if (msg.toLowerCase().includes('not authenticated') || msg.toLowerCase().includes('admin access')) {
        logout();
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const role = localStorage.getItem('role');
    const did = localStorage.getItem('device_id');

    if (!token || role !== 'admin') {
      router.push('/login');
      return;
    }
    setAdminId(did || 'admin');
    fetchDevices();
  }, [router, fetchDevices]);

  async function handleToggleLicense(device_id: string) {
    setTogglingId(device_id);
    try {
      const updated = await adminToggleLicense(device_id);
      setDevices((prev) =>
        prev.map((d) => (d.device_id === device_id ? updated : d))
      );
      showToast(
        `License ${updated.license_active ? 'activated' : 'revoked'} for ${device_id}`,
        'success'
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Toggle failed', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreateDevice(e: FormEvent) {
    e.preventDefault();
    if (!newDeviceId.trim()) return;
    setCreating(true);
    try {
      const created = await adminCreateDevice(newDeviceId.trim());
      setDevices((prev) => [created, ...prev]);
      setNewDeviceId('');
      showToast(`Device '${created.device_id}' created successfully`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  }

  const licensed = devices.filter((d) => d.license_active).length;
  const unlicensed = devices.length - licensed;

  return (
    <div className="min-h-screen bg-slate-900">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Navbar */}
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">A</div>
            <div>
              <h1 className="text-white font-bold">Admin Panel</h1>
              <p className="text-xs text-slate-400">Logged in as <span className="text-purple-400 font-medium">{adminId}</span></p>
            </div>
          </div>
          <button onClick={logout} className="btn-secondary text-sm">Logout</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <div className="text-3xl font-bold text-white">{devices.length}</div>
            <div className="text-sm text-slate-400 mt-1">Total Devices</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-green-400">{licensed}</div>
            <div className="text-sm text-slate-400 mt-1">Licensed</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-red-400">{unlicensed}</div>
            <div className="text-sm text-slate-400 mt-1">Unlicensed</div>
          </div>
        </div>

        {/* Create Device */}
        <section className="card">
          <h2 className="text-lg font-semibold text-white mb-1">Create New Device</h2>
          <p className="text-sm text-slate-400 mb-5">
            Register a device so users can sign up with it. New devices start with the license inactive.
          </p>
          <form onSubmit={handleCreateDevice} className="flex gap-3">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="e.g. tower-001, site-abc"
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
              pattern="[a-zA-Z0-9\-_]+"
              title="Only letters, numbers, hyphens and underscores"
              required
            />
            <button
              type="submit"
              className="btn-primary whitespace-nowrap"
              disabled={creating || !newDeviceId.trim()}
            >
              {creating ? 'Creating…' : '+ Create Device'}
            </button>
          </form>
        </section>

        {/* Device List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">All Devices</h2>
            <button
              onClick={fetchDevices}
              className="btn-secondary text-sm"
              disabled={loading}
            >
              {loading ? 'Loading…' : '⟳ Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="card flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading devices…</p>
              </div>
            </div>
          ) : devices.length === 0 ? (
            <div className="card text-center py-16">
              <div className="text-4xl mb-3">📡</div>
              <p className="text-slate-400">No devices yet. Create one above.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-slate-400">
                    <th className="px-6 py-4 font-semibold">Device ID</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Created</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {devices.map((device) => (
                    <tr
                      key={device.id}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{device.device_id}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{device.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <LicenseBadge active={device.license_active} />
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(device.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleLicense(device.device_id)}
                          disabled={togglingId === device.device_id}
                          className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-all disabled:opacity-50
                            ${device.license_active
                              ? 'bg-red-900/30 border-red-700 text-red-300 hover:bg-red-900/50'
                              : 'bg-green-900/30 border-green-700 text-green-300 hover:bg-green-900/50'
                            }`}
                        >
                          {togglingId === device.device_id
                            ? 'Updating…'
                            : device.license_active
                            ? 'Revoke License'
                            : 'Activate License'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Info box */}
        <div className="card bg-slate-800/50 border-slate-600">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">How the device lifecycle works</h3>
          <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
            <li>Create a device here — it starts <span className="text-red-400 font-medium">unlicensed</span>.</li>
            <li>Share the <span className="text-blue-400 font-medium">device_id</span> with the tower operator.</li>
            <li>The operator registers at <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">/login</code> using the device_id and a password they choose.</li>
            <li>Activate the license here — the operator can now access the monitoring dashboard.</li>
            <li>Revoke the license at any time to cut off access instantly.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
