// Verifies a Firebase Authentication ID token (the proof the phone gets after "Sign in with Google") without the
// firebase-admin package: it is a signed JWT (RS256) and Google publishes the signing certificates.
// Pure apart from the certificate download, which is injected so tests can use their own key.
import { createPublicKey, createVerify } from 'node:crypto';

export type FirebaseIdentity = { uid: string; email: string | null; emailVerified: boolean; name: string | null };
export type VerifyResult = { ok: true; identity: FirebaseIdentity } | { ok: false; error: string };
export type CertFetcher = () => Promise<Record<string, string>>;

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const CLOCK_SKEW_MS = 5 * 60 * 1000;

// The certificates change every few hours; they are kept until the `max-age` Google sends has passed.
let cached: { certs: Record<string, string>; until: number } | null = null;
export const fetchGoogleCerts: CertFetcher = async () => {
  if (cached && Date.now() < cached.until) return cached.certs;
  const response = await fetch(CERTS_URL);
  if (!response.ok) throw new Error('certs_unavailable');
  const certs = (await response.json()) as Record<string, string>;
  const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1];
  cached = { certs, until: Date.now() + (maxAge ? Number(maxAge) * 1000 : 3600_000) };
  return certs;
};

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

export async function verifyFirebaseToken(idToken: unknown, projectId: string, fetchCerts: CertFetcher = fetchGoogleCerts, now = Date.now()): Promise<VerifyResult> {
  if (typeof idToken !== 'string' || idToken.length > 4000) return { ok: false, error: 'bad_token' };
  const parts = idToken.split('.');
  if (parts.length !== 3) return { ok: false, error: 'bad_token' };
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decode(parts[0]);
    payload = decode(parts[1]);
  } catch {
    return { ok: false, error: 'bad_token' };
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, error: 'bad_token' };

  let certs: Record<string, string>;
  try {
    certs = await fetchCerts();
  } catch {
    return { ok: false, error: 'certs_unavailable' };
  }
  const cert = certs[header.kid];
  if (!cert) return { ok: false, error: 'unknown_key' };
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    if (!verifier.verify(createPublicKey(cert), Buffer.from(parts[2], 'base64url'))) return { ok: false, error: 'bad_signature' };
  } catch {
    return { ok: false, error: 'bad_signature' };
  }

  const exp = Number(payload.exp) * 1000;
  const iat = Number(payload.iat) * 1000;
  if (!Number.isFinite(exp) || exp <= now) return { ok: false, error: 'expired' };
  if (!Number.isFinite(iat) || iat > now + CLOCK_SKEW_MS) return { ok: false, error: 'bad_token' };
  if (payload.aud !== projectId) return { ok: false, error: 'wrong_audience' };
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return { ok: false, error: 'wrong_issuer' };
  if (typeof payload.sub !== 'string' || !payload.sub) return { ok: false, error: 'bad_token' };

  return {
    ok: true,
    identity: {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : null,
    },
  };
}
