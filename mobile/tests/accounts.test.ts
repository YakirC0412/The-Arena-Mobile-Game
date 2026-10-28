import {
  createEmptyStore,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  signUpWithGoogle,
  type AccountStore,
  type SignUpInput,
} from '../src/services/accounts/accounts';
import { sha256Hex } from '../src/services/accounts/sha256';
import { assert, assertEqual, suite, test } from './harness';

const dana: SignUpInput = {
  fullName: 'דנה כהן',
  email: 'Dana@Example.com ',
  nickname: 'אלופת הטריוויה',
  password: 'secret1',
  avatar: 'avatar-03',
};

function registered(): AccountStore {
  const result = signUp(createEmptyStore(), dana, 'user-1', 'salt-1');
  assert(result.ok, 'Fixture sign-up must succeed');
  return result.store;
}

suite('accounts', () => {
  test('sha256 matches the standard test vectors', () => {
    assertEqual(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Empty string');
    assertEqual(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'abc');
    assertEqual(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
      'Two-block message',
    );
  });

  test('sign-up stores the profile, signs in, and never exposes the password', () => {
    const result = signUp(createEmptyStore(), dana, 'user-1', 'salt-1');
    assert(result.ok, 'Sign-up must succeed');
    assertEqual(result.user.email, 'dana@example.com', 'Email is trimmed and lower-cased');
    assertEqual(result.user.nickname, 'אלופת הטריוויה', 'Nickname is kept');
    assertEqual(result.user.provider, 'password', 'Provider');
    assertEqual(getCurrentUser(result.store)?.id, 'user-1', 'The new user is signed in');
    assert(!('passwordHash' in result.user), 'The user object must not carry the password hash');
    assert(result.store.accounts[0].passwordHash !== 'secret1', 'The password is stored hashed');
  });

  test('sign-up validates every required field', () => {
    const result = signUp(createEmptyStore(), { fullName: 'א', email: 'not-an-email', nickname: 'א', password: '123', avatar: '' }, 'x', 's');
    assert(!result.ok, 'Invalid input must fail');
    for (const field of ['fullName', 'email', 'nickname', 'password', 'avatar'] as const) {
      assert(result.errors[field], `Missing error for ${field}`);
    }
  });

  test('email and nickname must be unique', () => {
    const store = registered();
    const sameEmail = signUp(store, { ...dana, nickname: 'אחר' }, 'user-2', 'salt-2');
    assert(!sameEmail.ok && sameEmail.errors.email, 'Duplicate email must fail');
    const sameNickname = signUp(store, { ...dana, email: 'other@example.com', nickname: ' אלופת   הטריוויה ' }, 'user-2', 'salt-2');
    assert(!sameNickname.ok && sameNickname.errors.nickname, 'Duplicate nickname must fail');
  });

  test('sign-in accepts the right password and rejects a wrong one', () => {
    const store = signOut(registered());
    assertEqual(getCurrentUser(store), null, 'Signed out');
    const good = signIn(store, ' DANA@example.com', 'secret1');
    assert(good.ok, 'Correct credentials must sign in');
    assertEqual(getCurrentUser(good.store)?.nickname, 'אלופת הטריוויה', 'Current user after sign-in');
    const wrong = signIn(store, 'dana@example.com', 'wrong-1');
    assert(!wrong.ok && wrong.message === 'האימייל או הסיסמה שגויים', 'Wrong password must fail');
    const unknown = signIn(store, 'nobody@example.com', 'secret1');
    assert(!unknown.ok && unknown.message === wrong.message, 'Unknown email gets the same message');
  });

  test('Google sign-up needs no password, and such an account cannot sign in with one', () => {
    const result = signUpWithGoogle(
      createEmptyStore(),
      { fullName: 'יוסי לוי', email: 'yossi@gmail.com', nickname: 'יוסי', avatar: 'avatar-02' },
      'g-1',
    );
    assert(result.ok, 'Google sign-up must succeed');
    assertEqual(result.user.provider, 'google', 'Provider');
    assert(result.store.accounts[0].passwordHash === undefined, 'No password is stored');
    const attempt = signIn(signOut(result.store), 'yossi@gmail.com', 'anything');
    assert(!attempt.ok && attempt.message === 'החשבון הזה נרשם עם Google', 'Password sign-in points to Google');
  });
});
