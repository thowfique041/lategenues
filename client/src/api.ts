const BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

export async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('lg_token');
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function uploadFile(file: File) {
  const body = new FormData(); body.append('file', file);
  const response = await fetch(`${BASE}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('lg_token')}` }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Upload failed');
  return data;
}

export async function contentFileUrl(id: string) {
  const token = localStorage.getItem('lg_token');
  const response = await fetch(`${BASE}/content/${id}/file`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('This file is unavailable or access is denied');
  return URL.createObjectURL(await response.blob());
}
