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

export function ensureServerSession(nickname: string, avatar: string): Promise<ServerSession> {
  if (cached && cached.nickname === nickname) return Promise.resolve(cached);
  pending ??= (async () => {
    try {
      const saved = loadCredentials(nickname);
      if (saved) {
        const login = await post('/api/login', saved);
        if (login.status === 200) return (cached = { ...toSession(login.json), nickname });
      }
      // First visit (or the server's database was reset): make a new account.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const credentials = { email: `p${randomHex(8)}@arena.local`, password: randomHex(12) };
        const register = await post('/api/register', { ...credentials, name: nickname.trim().slice(0, 20) || 'שחקן', avatar });
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

const toSession = (json: { token: string; user: { id: number; name: string; avatar: string } }): ServerSession => ({
  token: json.token,
  userId: json.user.id,
  name: json.user.name,
  avatar: json.user.avatar,
});
