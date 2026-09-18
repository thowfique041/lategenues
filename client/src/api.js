const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function api(path, options = {}) {
  const token = localStorage.getItem('lg_token');
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function uploadFile(file) {
  const body = new FormData(); body.append('file', file);
  const response = await fetch(`${BASE}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('lg_token')}` }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Upload failed');
  return data;
}
