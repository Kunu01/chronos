const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// Shared Web Audio Context unlocked on PIN pad physical tap (iOS Safari requirement)
let sharedAudioCtx = null;

export const unlockAudioContext = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

export const optimizeCloudinaryUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('w_800')) {
    return url.replace('/upload/', '/upload/w_800,f_webp,q_auto/');
  }
  return url;
};

export const apiRequest = async (endpoint, { method = 'GET', body, token, adminToken, isFormData = false } = {}) => {
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resolvedAdminToken =
    adminToken ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('chronos_admin_token') : null);

  if (resolvedAdminToken) {
    headers['x-admin-token'] = resolvedAdminToken;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    credentials: 'include',
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({
    success: false,
    error: { code: 'NETWORK_ERROR', message: 'Invalid server response' },
  }));

  if (!res.ok || !json.success) {
    const err = new Error(json?.error?.message || 'Request failed');
    err.code = json?.error?.code || 'ERROR';
    err.status = res.status;
    throw err;
  }

  return json.data;
};

