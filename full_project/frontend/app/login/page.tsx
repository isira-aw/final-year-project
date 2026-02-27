'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'info'>('login');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(deviceId, password);
      localStorage.setItem('jwt_token', data.access_token);
      localStorage.setItem('device_id', deviceId);
      localStorage.setItem('role', data.role);
      // Route based on role — admin → /admin, user → /dashboard
      router.push(data.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Telecom Monitor</h1>
          <p className="text-slate-400 mt-2">AI-Powered Fault Detection System</p>
        </div>

        {/* Login Card */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>
          <p className="text-slate-400 text-sm mb-6">
            Admins are routed to the admin panel. Device users are routed to the monitoring dashboard.
          </p>

          {error && (
            <div className="bg-red-900/40 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Device ID</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. tower-001"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={loading || !deviceId || !password}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-700">
            <button
              className="text-slate-400 hover:text-slate-200 text-sm w-full text-center transition-colors"
              onClick={() => setMode(mode === 'login' ? 'info' : 'login')}
            >
              {mode === 'login' ? 'Need help? View requirements' : 'Back to login'}
            </button>
          </div>

          {mode === 'info' && (
            <div className="mt-4 bg-slate-900/60 rounded-lg p-4 text-sm text-slate-300 space-y-2">
              <p className="font-semibold text-slate-200">Requirements to log in:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Device must be registered by admin</li>
                <li>Device license must be active</li>
                <li>You must have registered an account with your device_id</li>
              </ul>
              <p className="text-slate-400 pt-1">Contact your administrator if you need access.</p>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Telecom Tower Fault Detection System v1.0
        </p>
      </div>
    </div>
  );
}
