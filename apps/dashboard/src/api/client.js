/**
 * Tiny API client. In dev, Vite proxies /api → http://localhost:3000 (see
 * vite.config.js). Point VITE_API_BASE at the backend directly for
 * production deployments.
 */
const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${path} failed (${res.status})${body ? `: ${body}` : ''}`);
  }
  return res.json();
}

export async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} failed (${res.status})${text ? `: ${text}` : ''}`);
  }
  return res.json();
}
