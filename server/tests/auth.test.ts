import { assert, assertEqual, suite, test } from '../../mobile/tests/harness';
import { handleApi } from '../src/api';
import { login, resetLoginThrottle, userFromToken, register } from '../src/auth';
import { getLeaders, openDb, recordGame } from '../src/db';

const fresh = () => { resetLoginThrottle(); return openDb(':memory:'); };
const signUp = (db: ReturnType<typeof fresh>, email: string, name = 'דנה') => {
  const result = register(db, { email, password: 'secret1', name });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

suite('server accounts', () => {
  test('register, then the token finds the user; emails are case-insensitive and unique', () => {
    const db = fresh();
    const { user, token } = signUp(db, 'Dana@Example.com');
    assertEqual(user.email, 'dana@example.com', 'Email normalized');
    assertEqual(userFromToken(db, token)?.id, user.id, 'Token works');
    assertEqual(userFromToken(db, 'nope'), null, 'Unknown token');
    const again = register(db, { email: 'DANA@example.com', password: 'secret1', name: 'x' });
    assert(!again.ok && again.error === 'email_taken', 'Duplicate refused');
  });

  test('bad input is refused with a code', () => {
    const db = fresh();
    const error = (email: string, password: string, name: string) => {
      const r = register(db, { email, password, name });
      return r.ok ? 'ok' : r.error;
    };
    assertEqual(error('no-at', 'secret1', 'a'), 'bad_email', 'Email');
    assertEqual(error('a@b.co', '123', 'a'), 'bad_password', 'Short password');
    assertEqual(error('a@b.co', 'secret1', ''), 'bad_name', 'Empty name');
    assertEqual(error('a@b.co', 'secret1', 'x'.repeat(21)), 'bad_name', 'Long name');
  });

  test('the password is never stored, login works only with the right one and does not reveal unknown emails', () => {
    const db = fresh();
    signUp(db, 'a@b.co');
    const row = db.prepare('SELECT password_hash, salt FROM users').get() as { password_hash: string; salt: string };
    assert(!JSON.stringify(row).includes('secret1'), 'No plain password');
    assert(login(db, { email: 'a@b.co', password: 'secret1' }).ok, 'Right password');
    const wrong = login(db, { email: 'a@b.co', password: 'secret2' });
    const unknown = login(db, { email: 'who@b.co', password: 'secret1' });
    assert(!wrong.ok && !unknown.ok && wrong.error === unknown.error, 'Same error for both');
  });

  test('too many wrong passwords lock the email for a while', () => {
    const db = fresh();
    signUp(db, 'a@b.co');
    for (let i = 0; i < 8; i += 1) login(db, { email: 'a@b.co', password: 'bad-guess' }, 1000);
    const locked = login(db, { email: 'a@b.co', password: 'secret1' }, 2000);
    assert(!locked.ok && locked.error === 'too_many_attempts', 'Locked');
    assert(login(db, { email: 'a@b.co', password: 'secret1' }, 1000 + 11 * 60 * 1000).ok, 'Free again later');
  });

  test('the HTTP handler: register, me, logout, 404', () => {
    const db = fresh();
    const created = handleApi(db, 'POST', '/api/register', { email: 'a@b.co', password: 'secret1', name: 'דנה' });
    assertEqual(created.status, 201, 'Created');
    const token = (created.body as { token: string }).token;
    assertEqual(handleApi(db, 'GET', '/api/me', {}, `Bearer ${token}`).status, 200, 'Me');
    assertEqual(handleApi(db, 'GET', '/api/me', {}).status, 401, 'Not signed in');
    handleApi(db, 'POST', '/api/logout', {}, `Bearer ${token}`);
    assertEqual(handleApi(db, 'GET', '/api/me', {}, `Bearer ${token}`).status, 401, 'Logged out');
    assertEqual(handleApi(db, 'GET', '/api/nothing', {}).status, 404, 'Unknown path');
    assert(!JSON.stringify(handleApi(db, 'GET', '/api/leaders', {}).body).includes('a@b.co'), 'Leaders show no emails');
  });

  test('leaderboard: only games with 2+ accounts count; ordered by wins', () => {
    const db = fresh();
    const a = signUp(db, 'a@b.co', 'א').user.id;
    const b = signUp(db, 'b@b.co', 'ב').user.id;
    const c = signUp(db, 'c@b.co', 'ג').user.id;
    assertEqual(recordGame(db, [a], a), false, 'Solo game does not count');
    assertEqual(getLeaders(db).length, 0, 'Nobody listed yet');
    recordGame(db, [a, b], b);
    recordGame(db, [a, b, c], b);
    recordGame(db, [a, c], a);
    const leaders = getLeaders(db);
    assertEqual(leaders[0].userId, b, 'Most wins first');
    assertEqual(leaders[0].wins, 2, 'Two wins');
    assertEqual(leaders.find((row) => row.userId === a)?.games, 3, 'Games played counted');
    assertEqual(leaders.find((row) => row.userId === c)?.wins, 0, 'Played, never won');
  });
});
