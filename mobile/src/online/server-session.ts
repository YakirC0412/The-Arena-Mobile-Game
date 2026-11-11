import { serverHttpUrl } from './server-config';

// The player's account on the Arena server. For now it is created silently the first time the Multi tab is used:
// a random email and password are generated and kept on this phone (localStorage), and the nickname becomes the
// name other players see. A real sign-up form (and Google) come later. Not real security: it only separates players.
export type ServerSession = { token: string; userId: number; name: string; avatar: string };

// One account per nickname on this phone (so two tabs with different nicknames are two different players while testing).
const keyFor = (nickname: string) => `arena.serverAccount:${nickname}`;
type Credentials = { email: string; password: string };

function loadCredentials(nickname: string): Credentials | null {
  try {
    const raw = globalThis.localStorage?.getItem(keyFor(nickname));
    return raw ? (JSON.parse(raw) as Credentials) : null;
  } catch {
    return null;
  }
}

function saveCredentials(nickname: string, credentials: Credentials) {
  try {
    globalThis.localStorage?.setItem(keyFor(nickname), JSON.stringify(credentials));
  } catch {
    // no storage (private window): a new account is made next visit
  }
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else values.forEach((_, index) => { values[index] = Math.floor(Math.random() * 256); });
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function post(path: string, body: object): Promise<{ status: number; json: any }> {
  let response: Response;
  try {
    response = await fetch(`${serverHttpUrl()}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('server_offline');
  }
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

let cached: (ServerSession & { nickname: string }) | null = null;
let pending: Promise<ServerSession> | null = null;

// A player who signed in with Google has a real server account (see google-account.ts): its session is remembered here and
// multiplayer uses it instead of the silent per-nickname account below.
const GOOGLE_KEY = 'arena.googleServerSession';

export function adoptServerSession(session: ServerSession, nickname: string): void {
  cached = { ...session, nickname };
  try {
    globalThis.localStorage?.setItem(GOOGLE_KEY, JSON.stringify(cached));
  } catch {
    // no storage: the session lasts until the page closes
  }
}

export function clearServerSession(): void {
  cached = null;
  try {
    globalThis.localStorage?.removeItem(GOOGLE_KEY);
  } catch {
    // nothing stored
  }
}

function loadGoogleSession(nickname: string): (ServerSession & { nickname: string }) | null {
  try {
    const raw = globalThis.localStorage?.getItem(GOOGLE_KEY);
    const saved = raw ? (JSON.parse(raw) as ServerSession & { nickname: string }) : null;
    return saved && saved.nickname === nickname ? saved : null;
  } catch {
    return null;
  }
}

export function ensureServerSession(nickname: string, avatar: string, gender: 'male' | 'female' = 'male'): Promise<ServerSession> {
  if (cached && cached.nickname === nickname) return Promise.resolve(cached);
  const google = loadGoogleSession(nickname);
  if (google) {
    cached = google;
    return Promise.resolve(google);
  }
  pending ??= (async () => {
    try {
      const saved = loadCredentials(nickname);
      if (saved) {
        const login = await post('/api/login', { ...saved, gender });
        if (login.status === 200) return (cached = { ...toSession(login.json), nickname });
      }
      // First visit (or the server's database was reset): make a new account.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const credentials = { email: `p${randomHex(8)}@arena.local`, password: randomHex(12) };
        const register = await post('/api/register', { ...credentials, name: nickname.trim().slice(0, 20) || 'שחקן', avatar, gender });
        if (register.status === 201) {
          saveCredentials(nickname, credentials);
          return (cached = { ...toSession(register.json), nickname });
        }
        if (register.json?.error !== 'email_taken') throw new Error(register.json?.error ?? 'register_failed');
      }
      throw new Error('register_failed');
    } finally {
      pending = null;
    }
  })();
  return pending;
}

// The player edited their nickname/picture: the server account follows, so other players see the new ones and a later
// Google sign-in does not bring the old ones back. Best effort: offline, the phone keeps the new profile anyway.
export async function syncServerProfile(oldNickname: string, profile: { nickname: string; avatar: string; gender: 'male' | 'female' }): Promise<void> {
  try {
    const session = await ensureServerSession(oldNickname, profile.avatar, profile.gender);
    // The silent account is kept per nickname: it moves to the new one, so wins stay with the player.
    const saved = loadCredentials(oldNickname);
    if (saved && profile.nickname !== oldNickname) {
      saveCredentials(profile.nickname, saved);
      try { globalThis.localStorage?.removeItem(keyFor(oldNickname)); } catch { /* nothing to remove */ }
    }
    const reply = await postWithToken('/api/profile', { name: profile.nickname.trim().slice(0, 20), avatar: profile.avatar, gender: profile.gender }, session.token);
    if (reply.status === 200) {
      const next = { ...session, name: profile.nickname, avatar: profile.avatar, nickname: profile.nickname };
      cached = next;
      if (loadGoogleSession(oldNickname)) adoptServerSession(next, profile.nickname);
    }
  } catch {
    // server offline: nothing to sync now
  }
}

async function postWithToken(path: string, body: object, token: string): Promise<{ status: number; json: any }> {
  try {
    const response = await fetch(`${serverHttpUrl()}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return { status: response.status, json: await response.json().catch(() => ({})) };
  } catch {
    throw new Error('server_offline');
  }
}

const toSession = (json: { token: string; user: { id: number; name: string; avatar: string } }): ServerSession => ({
  token: json.token,
  userId: json.user.id,
  name: json.user.name,
  avatar: json.user.avatar,
});
