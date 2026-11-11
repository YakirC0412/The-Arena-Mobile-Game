// The Arena server's side of "Sign in with Google": the server checks the Firebase ID token and answers with the player's
// server account and a login token (used for multiplayer, so the wins land on this account).
import type { Gender } from '../game/gender';
import { adoptServerSession, clearServerSession } from './server-session';
import { serverHttpUrl } from './server-config';

export type GoogleServerUser = { id: number; email: string; name: string; avatar: string; gender: Gender };
export type GoogleLogin = { user: GoogleServerUser; token: string; needsProfile: boolean };

const MESSAGES: Record<string, string> = {
  server_offline: 'השרת לא זמין. בדקו שהמחשב פעיל ושאתם באותה רשת',
  google_not_configured: 'ההתחברות עם Google עוד לא הוגדרה בשרת',
  email_not_verified: 'האימייל של חשבון Google לא מאומת',
  certs_unavailable: 'לא הצלחנו לאמת את ההתחברות כרגע. נסו שוב בעוד רגע',
  expired: 'ההתחברות פגה. נסו שוב',
  bad_name: 'הכינוי צריך להיות בין 1 ל־20 תווים',
};
export const googleErrorMessage = (code: string | undefined): string => (code && MESSAGES[code]) || 'ההתחברות עם Google נכשלה. נסו שוב';

async function post(path: string, body: object, token?: string): Promise<{ status: number; json: any }> {
  let response: Response;
  try {
    response = await fetch(`${serverHttpUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('server_offline');
  }
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

export async function loginWithGoogleToken(idToken: string): Promise<GoogleLogin> {
  const reply = await post('/api/firebase-login', { idToken });
  if (reply.status !== 200) throw new Error(reply.json?.error ?? 'google_failed');
  return reply.json as GoogleLogin;
}

export async function saveGoogleProfile(token: string, profile: { name: string; avatar: string; gender: Gender }): Promise<GoogleServerUser> {
  const reply = await post('/api/profile', profile, token);
  if (reply.status !== 200) throw new Error(reply.json?.error ?? 'google_failed');
  return reply.json.user as GoogleServerUser;
}

// From now on multiplayer uses this account instead of a silent per-nickname one.
export function rememberGoogleAccount(user: GoogleServerUser, token: string): void {
  adoptServerSession({ token, userId: user.id, name: user.name, avatar: user.avatar }, user.name);
}

export async function forgetGoogleAccount(): Promise<void> {
  clearServerSession();
}
