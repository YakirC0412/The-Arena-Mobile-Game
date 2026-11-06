// Accounts: email + password (scrypt), login tokens. Real security for the server; the old local accounts stay for solo play.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Db } from './db';

export type PublicUser = { id: number; email: string; name: string };
export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString('hex');
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function newSession(db: Db, userId: number): string {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)').run(hashToken(token), userId, Date.now());
  return token;
}

export function register(db: Db, input: { email: string; password: string; name: string }): AuthResult<{ user: PublicUser; token: string }> {
  const email = normalizeEmail(String(input.email ?? ''));
  const name = String(input.name ?? '').trim();
  const password = String(input.password ?? '');
  if (!EMAIL.test(email) || email.length > 120) return { ok: false, error: 'bad_email' };
  if (name.length < 1 || name.length > 20) return { ok: false, error: 'bad_name' };
  if (password.length < 6 || password.length > 200) return { ok: false, error: 'bad_password' };
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return { ok: false, error: 'email_taken' };
  const salt = randomBytes(16).toString('hex');
  const created = db
    .prepare('INSERT INTO users (email, name, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(email, name, salt, hashPassword(password, salt), Date.now());
  const id = Number(created.lastInsertRowid);
  return { ok: true, value: { user: { id, email, name }, token: newSession(db, id) } };
}

// Too many wrong passwords for one email slow an attacker down (kept in memory, resets on restart).
const failures = new Map<string, { count: number; since: number }>();
const MAX_FAILURES = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function login(db: Db, input: { email: string; password: string }, now = Date.now()): AuthResult<{ user: PublicUser; token: string }> {
  const email = normalizeEmail(String(input.email ?? ''));
  const password = String(input.password ?? '');
  const seen = failures.get(email);
  if (seen && now - seen.since < WINDOW_MS && seen.count >= MAX_FAILURES) return { ok: false, error: 'too_many_attempts' };
  const row = db.prepare('SELECT id, email, name, salt, password_hash FROM users WHERE email = ?').get(email) as
    | { id: number; email: string; name: string; salt: string; password_hash: string }
    | undefined;
  // Hash even for an unknown email so the answer takes the same time and says nothing about which emails exist.
  const salt = row?.salt ?? '00000000000000000000000000000000';
  const candidate = Buffer.from(hashPassword(password, salt), 'hex');
  const stored = Buffer.from(row?.password_hash ?? '0'.repeat(128), 'hex');
  if (!row || !timingSafeEqual(candidate, stored)) {
    const fresh = seen && now - seen.since < WINDOW_MS ? seen : { count: 0, since: now };
    failures.set(email, { count: fresh.count + 1, since: fresh.since });
    return { ok: false, error: 'wrong_login' };
  }
  failures.delete(email);
  return { ok: true, value: { user: { id: row.id, email: row.email, name: row.name }, token: newSession(db, row.id) } };
}

export function userFromToken(db: Db, token: string | null | undefined): PublicUser | null {
  if (!token) return null;
  const row = db
    .prepare('SELECT u.id AS id, u.email AS email, u.name AS name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?')
    .get(hashToken(token)) as PublicUser | undefined;
  return row ? { id: row.id, email: row.email, name: row.name } : null;
}

export function logout(db: Db, token: string | null | undefined): void {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function resetLoginThrottle(): void {
  failures.clear();
}
