// In dev the Vite proxy handles /api; in production set VITE_SERVER_URL to the API origin.
export const SERVER = import.meta.env.VITE_SERVER_URL || '';

export async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${SERVER}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, details: data.details });
  return data;
}
