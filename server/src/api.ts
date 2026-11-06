// The small HTTP API for accounts: pure `handleApi` (testable) plus an adapter for Express.
import { login, logout, register, userFromToken } from './auth';
import { getLeaders } from './db';
import type { Db } from './db';

export type ApiReply = { status: number; body: unknown };

const bearer = (header: string | undefined) => (header?.startsWith('Bearer ') ? header.slice(7) : null);

export function handleApi(db: Db, method: string, path: string, body: Record<string, unknown>, authorization?: string): ApiReply {
  const token = bearer(authorization);
  if (method === 'POST' && path === '/api/register') {
    const result = register(db, body as { email: string; password: string; name: string });
    return result.ok ? { status: 201, body: result.value } : { status: 400, body: { error: result.error } };
  }
  if (method === 'POST' && path === '/api/login') {
    const result = login(db, body as { email: string; password: string });
    if (result.ok) return { status: 200, body: result.value };
    return { status: result.error === 'too_many_attempts' ? 429 : 401, body: { error: result.error } };
  }
  if (method === 'POST' && path === '/api/logout') {
    logout(db, token);
    return { status: 200, body: { ok: true } };
  }
  if (method === 'GET' && path === '/api/me') {
    const user = userFromToken(db, token);
    return user ? { status: 200, body: { user } } : { status: 401, body: { error: 'not_signed_in' } };
  }
  if (method === 'GET' && path === '/api/leaders') return { status: 200, body: { leaders: getLeaders(db) } };
  return { status: 404, body: { error: 'not_found' } };
}

// Mounts the API on Colyseus's Express app. The site and the server have different addresses (ports), so CORS is open;
// every call needs a login token anyway, and nothing here uses cookies.
export function mountApi(app: any, db: Db): void {
  app.use((req: any, res: any, next: () => void) => {
    if (!req.url.startsWith('/api/')) return next();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk;
      if (raw.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      let parsed: Record<string, unknown> = {};
      try { parsed = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ error: 'bad_json' }); }
      const reply = handleApi(db, req.method, req.url.split('?')[0], parsed, req.headers.authorization);
      res.status(reply.status).json(reply.body);
    });
  });
}
