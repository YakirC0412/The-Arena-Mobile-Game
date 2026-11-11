import { createSign, generateKeyPairSync } from 'node:crypto';

import { assert, assertEqual, suite, test } from '../../mobile/tests/harness';
import { handleApi, handleApiAsync } from '../src/api';
import { login, register, resetLoginThrottle } from '../src/auth';
import { openDb } from '../src/db';
import { verifyFirebaseToken } from '../src/firebaseAuth';

const PROJECT = 'arena-test';
const NOW = 1_800_000_000_000;

// A throw-away RSA key and a certificate for it, like the ones Google publishes.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

// The verifier accepts a certificate PEM or (for tests) a bare public key PEM: createPublicKey takes both.
const certs = async () => ({ kid1: publicPem });

function token(overrides: Record<string, unknown> = {}, key = privateKey, kid = 'kid1', alg = 'RS256') {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = {
    aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'uid-1', iat: NOW / 1000 - 60, exp: NOW / 1000 + 3600,
    email: 'Dana@Example.com', email_verified: true, name: 'דנה כהן', ...overrides,
  };
  const head = `${encode({ alg, kid, typ: 'JWT' })}.${encode(payload)}`;
  const signature = createSign('RSA-SHA256').update(head).sign(key).toString('base64url');
  return `${head}.${signature}`;
}

const verify = (idToken: string) => verifyFirebaseToken(idToken, PROJECT, certs, NOW);
const errorOf = async (idToken: string) => {
  const result = await verify(idToken);
  return result.ok ? 'ok' : result.error;
};

suite('google sign-in: the Firebase token', () => {
  test('a good token gives the identity', async () => {
    const result = await verify(token());
    assert(result.ok, 'Valid token accepted');
    if (result.ok) {
      assertEqual(result.identity.uid, 'uid-1', 'uid');
      assertEqual(result.identity.email, 'dana@example.com', 'email is lower-cased');
      assert(result.identity.emailVerified, 'verified');
    }
  });

  test('wrong project, wrong issuer, expired, wrong key and tampered tokens are refused', async () => {
    assertEqual(await errorOf(token({ aud: 'someone-else' })), 'wrong_audience', 'audience');
    assertEqual(await errorOf(token({ iss: 'https://evil.example/arena-test' })), 'wrong_issuer', 'issuer');
    assertEqual(await errorOf(token({ exp: NOW / 1000 - 10 })), 'expired', 'expired');
    assertEqual(await errorOf(token({}, other.privateKey)), 'bad_signature', 'signed by another key');
    assertEqual(await errorOf(token({}, privateKey, 'unknown-kid')), 'unknown_key', 'unknown key id');
    assertEqual(await errorOf(token({}, privateKey, 'kid1', 'HS256')), 'bad_token', 'wrong algorithm');
    const good = token();
    const [head, body, sig] = good.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), sub: 'someone-else' })).toString('base64url');
    assertEqual(await errorOf(`${head}.${forged}.${sig}`), 'bad_signature', 'payload changed after signing');
    assertEqual(await errorOf('not-a-token'), 'bad_token', 'garbage');
  });
});

suite('google sign-in: accounts', () => {
  const api = (db: ReturnType<typeof openDb>, idToken: string) => handleApiAsync(db, 'POST', '/api/firebase-login', { idToken }, undefined, { projectId: PROJECT, fetchCerts: certs, now: NOW });
  const profile = (db: ReturnType<typeof openDb>, bearer: string, body: object) => handleApi(db, 'POST', '/api/profile', body as Record<string, unknown>, `Bearer ${bearer}`);

  test('the first sign-in creates an account that still needs a profile; the profile fills it; the next sign-in is the same account', async () => {
    const db = openDb(':memory:');
    const first = await api(db, token());
    assertEqual(first.status, 200, 'Signed in');
    const body = first.body as { user: { id: number; email: string }; token: string; needsProfile: boolean };
    assert(body.needsProfile, 'A new Google account needs a profile');
    assertEqual(body.user.email, 'dana@example.com', 'email');
    const saved = profile(db, body.token, { name: 'דנה', avatar: 'avatar-07', gender: 'female' });
    assertEqual(saved.status, 200, 'Profile saved');
    const second = await api(db, token());
    const again = second.body as { user: { id: number; name: string; avatar: string; gender: string }; needsProfile: boolean };
    assertEqual(again.user.id, body.user.id, 'Same account');
    assert(!again.needsProfile, 'No second profile step');
    assertEqual(`${again.user.name}/${again.user.avatar}/${again.user.gender}`, 'דנה/avatar-07/female', 'Profile kept');
  });

  test('a Google sign-in with the email of an existing password account links to it; the password still works', async () => {
    const db = openDb(':memory:');
    resetLoginThrottle();
    const created = register(db, { email: 'dana@example.com', password: 'secret1', name: 'דנה' });
    assert(created.ok, 'Registered');
    const result = await api(db, token());
    const body = result.body as { user: { id: number }; needsProfile: boolean };
    assertEqual(body.user.id, created.ok ? created.value.user.id : -1, 'Linked, not duplicated');
    assert(!body.needsProfile, 'An existing account keeps its profile');
    assert(login(db, { email: 'dana@example.com', password: 'secret1' }).ok, 'Password login still works');
  });

  test('a Google account has no password, an unverified email and a missing configuration are refused', async () => {
    const db = openDb(':memory:');
    await api(db, token());
    resetLoginThrottle();
    assert(!login(db, { email: 'dana@example.com', password: '' }).ok, 'Empty password refused');
    assert(!login(db, { email: 'dana@example.com', password: 'anything' }).ok, 'No password route for Google accounts');
    const unverified = await api(openDb(':memory:'), token({ email_verified: false, sub: 'uid-2' }));
    assertEqual(unverified.status, 403, 'Unverified email refused');
    const noConfig = await handleApiAsync(db, 'POST', '/api/firebase-login', { idToken: token() }, undefined, { projectId: '' });
    assertEqual(noConfig.status, 503, 'Not configured');
  });

  test('the profile call needs a login and a sensible name', async () => {
    const db = openDb(':memory:');
    assertEqual(profile(db, 'nope', { name: 'x' }).status, 401, 'Not signed in');
    const body = (await api(db, token())).body as { token: string };
    assertEqual(profile(db, body.token, { name: '' }).status, 400, 'Empty name');
    assertEqual(profile(db, body.token, { name: 'x'.repeat(21) }).status, 400, 'Long name');
  });
});
