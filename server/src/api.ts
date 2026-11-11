// The small HTTP API for accounts: pure `handleApi` (testable) plus an adapter for Express.
import { login, loginWithFirebase, logout, register, updateProfile, userFromToken } from './auth';
import { fetchGoogleCerts, verifyFirebaseToken, type CertFetcher } from './firebaseAuth';
import { getLeaders } from './db';
import type { Db } from './db';

export type ApiReply = { status: number; body: unknown };

const bearer = (header: string | undefined) => (header?.startsWith('Bearer ') ? header.slice(7) : null);

export function handleApi(db: Db, method: string, path: string, body: Record<string, unknown>, authorization?: string): ApiReply {
  const token = bearer(authorization);
  if (method === 'POST' && path === '/api/register') {
    const result = register(db, body as { email: string; password: string; name: string; avatar?: string; gender?: string });
    return result.ok ? { status: 201, body: result.value } : { status: 400, body: { error: result.error } };
  }
  if (method === 'POST' && path === '/api/login') {
    const result = login(db, body as { email: string; password: string; gender?: string });
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
  if (method === 'POST' && path === '/api/profile') {
    const result = updateProfile(db, token, body);
    return result.ok ? { status: 200, body: { user: result.value } } : { status: result.error === 'not_signed_in' ? 401 : 400, body: { error: result.error } };
  }
  if (method === 'GET' && path === '/api/leaders') return { status: 200, body: { leaders: getLeaders(db) } };
  return { status: 404, body: { error: 'not_found' } };
}

// The one call that has to wait for the network (Google's certificates): "Sign in with Google" sends the Firebase ID token.
export async function handleApiAsync(
  db: Db, method: string, path: string, body: Record<string, unknown>, authorization?: string,
  options: { projectId?: string; fetchCerts?: CertFetcher; now?: number } = {},
): Promise<ApiReply> {
  if (method === 'POST' && path === '/api/firebase-login') {
    const projectId = options.projectId ?? process.env.FIREBASE_PROJECT_ID;
    if (!projectId) return { status: 503, body: { error: 'google_not_configured' } };
    const verified = await verifyFirebaseToken(body.idToken, projectId, options.fetchCerts ?? fetchGoogleCerts, options.now);
    if (!verified.ok) return { status: verified.error === 'certs_unavailable' ? 503 : 401, body: { error: verified.error } };
    const result = loginWithFirebase(db, verified.identity);
    return result.ok ? { status: 200, body: result.value } : { status: 403, body: { error: result.error } };
  }
  return handleApi(db, method, path, body, authorization);
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
      handleApiAsync(db, req.method, req.url.split('?')[0], parsed, req.headers.authorization)
        .then((reply) => res.status(reply.status).json(reply.body))
        .catch(() => res.status(500).json({ error: 'server_error' }));
    });
  });
}
