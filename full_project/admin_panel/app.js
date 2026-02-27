'use strict';

// ── Config ───────────────────────────────────────────────────────────────────
let API_URL = localStorage.getItem('admin_api_url') || 'http://localhost:8000';
let ADMIN_TOKEN = localStorage.getItem('admin_token') || '';

document.getElementById('apiUrl').value = API_URL;
document.getElementById('adminToken').value = ADMIN_TOKEN;

function saveConfig() {
  API_URL = document.getElementById('apiUrl').value.trim().replace(/\/$/, '');
  ADMIN_TOKEN = document.getElementById('adminToken').value.trim();
  localStorage.setItem('admin_api_url', API_URL);
  localStorage.setItem('admin_token', ADMIN_TOKEN);
  showToast('Configuration saved!', 'success');
  updateStatusBadge(!!ADMIN_TOKEN);
}

function updateStatusBadge(configured) {
  const badge = document.getElementById('statusBadge');
  badge.textContent = configured ? 'Configured' : 'Not configured';
  badge.className = `badge ${configured ? 'badge-green' : 'badge-gray'}`;
}

// ── Navigation ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.dataset.section;
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.section').forEach((s) => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });
    const target = document.getElementById(`section-${section}`);
    target.classList.remove('hidden');
    target.classList.add('active');
    document.getElementById('pageTitle').textContent = item.textContent.trim();
  });
});

// ── API Helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  if (!ADMIN_TOKEN) {
    showToast('Admin token not set. Configure it in the sidebar.', 'error');
    throw new Error('No admin token');
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }

  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// ── Device Rendering ──────────────────────────────────────────────────────────
function renderDevices(devices) {
  const list = document.getElementById('deviceList');
  document.getElementById('deviceCount').textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;

  if (devices.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🖥</div>
        <p>No devices registered yet. Create one using the sidebar.</p>
      </div>`;
    return;
  }

  list.innerHTML = devices.map((d) => {
    const licensed = d.license_active;
    const created = new Date(d.created_at).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    return `
      <div class="device-card ${licensed ? 'licensed' : 'unlicensed'}">
        <div class="device-card-header">
          <div>
            <div class="device-id">${escapeHtml(d.device_id)}</div>
          </div>
          <span class="badge ${licensed ? 'badge-green' : 'badge-red'}">
            ${licensed ? '✓ Licensed' : '✗ Unlicensed'}
          </span>
        </div>
        <div class="device-meta">
          <span>ID: <code style="color:#94a3b8">${escapeHtml(d.id)}</code></span>
          <span>Created: ${created}</span>
        </div>
        <div class="device-card-footer">
          <button
            class="btn btn-sm ${licensed ? 'btn-danger' : 'btn-success'}"
            onclick="toggleLicense('${escapeHtml(d.device_id)}', this)"
          >
            ${licensed ? '🔒 Revoke License' : '🔓 Activate License'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Fetch Devices ─────────────────────────────────────────────────────────────
async function refreshDevices() {
  const list = document.getElementById('deviceList');
  list.innerHTML = `<div class="empty-state"><div class="spinner"></div><p style="margin-top:12px">Loading devices...</p></div>`;

  try {
    const devices = await apiFetch('/admin/devices');
    renderDevices(devices);
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <p style="color:#f87171">Failed to load devices: ${escapeHtml(err.message)}</p>
        <p style="margin-top:8px;font-size:12px">Check the backend URL and admin token in the sidebar.</p>
      </div>`;
  }
}

// ── Toggle License ────────────────────────────────────────────────────────────
async function toggleLicense(deviceId, btn) {
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';

  try {
    const updated = await apiFetch(`/admin/toggle-license/${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
    });
    const status = updated.license_active ? 'activated' : 'revoked';
    showToast(`License ${status} for device: ${deviceId}`, 'success');
    await refreshDevices();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ── Create Device ─────────────────────────────────────────────────────────────
async function handleCreateDevice(event) {
  event.preventDefault();

  const input = document.getElementById('newDeviceId');
  const deviceId = input.value.trim();
  const btn = document.getElementById('createBtn');

  if (!deviceId) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    const created = await apiFetch('/admin/create-device', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });

    showToast(`Device '${created.device_id}' created successfully!`, 'success');
    input.value = '';

    // Switch to devices view
    document.querySelector('[data-section="devices"]').click();
    await refreshDevices();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '➕ Create Device';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
updateStatusBadge(!!ADMIN_TOKEN);
refreshDevices();
