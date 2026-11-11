import {
  createEmptyStore,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  signInWithGoogleAccount,
  signUpWithGoogle,
  updateProfile,
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
  gender: 'female',
};

function registered(): AccountStore {
  const result = signUp(createEmptyStore(), dana, 'user-1', 'salt-1');
  assert(result.ok, 'Fixture sign-up must succeed');
  return result.store;
}

suite('accounts', () => {
  test('editing the profile changes nickname and picture, keeps the rest, and refuses a taken or bad nickname', () => {
    const store = registered();
    const other = signUp(signOut(store), { ...dana, email: 'yossi@example.com', nickname: 'יוסי' }, 'user-2', 'salt-2');
    assert(other.ok, 'Second account');
    const kept = updateProfile(other.store, 'user-2', { nickname: '  יוסי   החדש ', avatar: 'avatar-09' });
    assert(kept.ok, 'A free nickname is accepted');
    assertEqual(kept.user.nickname, 'יוסי החדש', 'Spaces tidied');
    assertEqual(kept.user.avatar, 'avatar-09', 'New picture');
    assertEqual(kept.user.email, 'yossi@example.com', 'Email untouched');
    assertEqual(kept.store.accounts.find((account) => account.id === 'user-1')?.nickname, dana.nickname, 'Other accounts untouched');
    assert(updateProfile(other.store, 'user-2', { nickname: 'יוסי', avatar: 'avatar-09' }).ok, 'Keeping your own nickname is fine');
    const taken = updateProfile(other.store, 'user-2', { nickname: dana.nickname, avatar: 'avatar-02' });
    assert(!taken.ok && !!taken.errors.nickname, 'Another player\'s nickname is refused');
    const short = updateProfile(other.store, 'user-2', { nickname: 'א', avatar: 'avatar-02' });
    assert(!short.ok && !!short.errors.nickname, 'Too short is refused');
    assert(!updateProfile(other.store, 'nobody', { nickname: 'שם טוב', avatar: 'avatar-02' }).ok, 'Unknown account');
  });

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
    const result = signUp(createEmptyStore(), { fullName: 'א', email: 'not-an-email', nickname: 'א', password: '123', avatar: '', gender: 'male' }, 'x', 's');
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
      { fullName: 'יוסי לוי', email: 'yossi@gmail.com', nickname: 'יוסי', avatar: 'avatar-02', gender: 'male' },
      'g-1',
    );
    assert(result.ok, 'Google sign-up must succeed');
    assertEqual(result.user.provider, 'google', 'Provider');
    assert(result.store.accounts[0].passwordHash === undefined, 'No password is stored');
    const attempt = signIn(signOut(result.store), 'yossi@gmail.com', 'anything');
    assert(!attempt.ok && attempt.message === 'החשבון הזה נרשם עם Google', 'Password sign-in points to Google');
  });

  test('signing in with Google twice is one account: the profile is refreshed, not duplicated, and an old password account is taken over', () => {
    const input = { fullName: 'יוסי לוי', email: 'Yossi@gmail.com', nickname: 'יוסי', avatar: 'avatar-02', gender: 'male' as const };
    const first = signInWithGoogleAccount(createEmptyStore(), input, 'g-1');
    assert(first.ok, 'First Google sign-in creates the account');
    const second = signInWithGoogleAccount(signOut(first.store), { ...input, nickname: 'יוסי החדש', avatar: 'avatar-05' }, 'g-2');
    assert(second.ok, 'Second Google sign-in works');
    assertEqual(second.store.accounts.length, 1, 'No duplicate account');
    assertEqual(second.user.nickname, 'יוסי החדש', 'Profile refreshed from the server');
    assertEqual(second.store.currentAccountId, first.user.id, 'Same account id');
    const withPassword = registered();
    const taken = signInWithGoogleAccount(signOut(withPassword), { fullName: 'דנה כהן', email: 'dana@example.com', nickname: 'אלופת הטריוויה', avatar: 'avatar-03', gender: 'female' }, 'g-3');
    assert(taken.ok && taken.user.provider === 'google' && taken.store.accounts.length === 1, 'The same email becomes a Google account');
  });
});
