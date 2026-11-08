// Local accounts for the single-device prototype: pure functions over an
// AccountStore, no React and no storage. account-storage.ts persists the
// store. Real server-side auth replaces this in the multiplayer phase; the
// AccountUser shape is what the rest of the app relies on.
import { genderOfAvatar, isGender } from '../../game/gender';
import type { Gender } from '../../game/gender';
import { sha256Hex } from './sha256';

export type AuthProvider = 'password' | 'google';

export type AccountUser = {
  id: string;
  fullName: string;
  email: string;
  nickname: string;
  avatar: string;
  // Man or woman: every text in the game uses the matching Hebrew form.
  gender: Gender;
  provider: AuthProvider;
};

export type StoredAccount = AccountUser & {
  // Only for provider 'password'. Salted SHA-256 – hygiene for a local
  // prototype, not real security.
  passwordSalt?: string;
  passwordHash?: string;
};

export type AccountStore = {
  version: 1;
  accounts: StoredAccount[];
  currentAccountId: string | null;
};

export type SignUpInput = {
  fullName: string;
  email: string;
  nickname: string;
  password: string;
  avatar: string;
  gender: Gender;
};

// Google returns name and email; the player still picks nickname and avatar.
export type GoogleSignUpInput = {
  fullName: string;
  email: string;
  nickname: string;
  avatar: string;
  gender: Gender;
};

export type FieldErrors = Partial<Record<keyof SignUpInput, string>>;

export type AuthResult =
  | { ok: true; store: AccountStore; user: AccountUser }
  | { ok: false; errors: FieldErrors; message?: string };

export const PASSWORD_MIN_LENGTH = 6;
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;

export function createEmptyStore(): AccountStore {
  return { version: 1, accounts: [], currentAccountId: null };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeNickname(nickname: string): string {
  return nickname.trim().replace(/\s+/g, ' ').toLocaleLowerCase('he');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function hashPassword(password: string, salt: string): string {
  return sha256Hex(`${salt}:${password}`);
}

export function toUser(account: StoredAccount): AccountUser {
  const { id, fullName, email, nickname, avatar, provider } = account;
  // Accounts made before gender existed get the gender of their picture.
  return { id, fullName, email, nickname, avatar, gender: account.gender ?? genderOfAvatar(avatar), provider };
}

export function getCurrentUser(store: AccountStore): AccountUser | null {
  const account = store.accounts.find((candidate) => candidate.id === store.currentAccountId);
  return account ? toUser(account) : null;
}

function findByEmail(store: AccountStore, email: string) {
  const normalized = normalizeEmail(email);
  return store.accounts.find((account) => account.email === normalized);
}

function profileErrors(
  store: AccountStore,
  input: { fullName: string; email: string; nickname: string; avatar: string; gender: Gender },
): FieldErrors {
  const errors: FieldErrors = {};
  if (input.fullName.trim().length < 2) errors.fullName = 'יש להזין שם מלא';
  if (!isValidEmail(input.email)) errors.email = 'כתובת האימייל לא תקינה';
  else if (findByEmail(store, input.email)) errors.email = 'כבר קיים חשבון עם האימייל הזה';
  const nickname = input.nickname.trim();
  if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
    errors.nickname = `הכינוי צריך להיות באורך ${NICKNAME_MIN_LENGTH}–${NICKNAME_MAX_LENGTH} תווים`;
  } else if (store.accounts.some((account) => normalizeNickname(account.nickname) === normalizeNickname(nickname))) {
    errors.nickname = 'הכינוי הזה כבר תפוס';
  }
  if (!input.avatar) errors.avatar = 'יש לבחור דמות';
  if (!isGender(input.gender)) errors.gender = 'יש לבחור: גבר או אישה';
  return errors;
}

export function validateSignUp(store: AccountStore, input: SignUpInput): FieldErrors {
  const errors = profileErrors(store, input);
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `הסיסמה צריכה לכלול לפחות ${PASSWORD_MIN_LENGTH} תווים`;
  }
  return errors;
}

function addAccount(store: AccountStore, account: StoredAccount): AuthResult {
  return {
    ok: true,
    store: { ...store, accounts: [...store.accounts, account], currentAccountId: account.id },
    user: toUser(account),
  };
}

// `id` and `salt` come from the caller so these functions stay pure.
export function signUp(store: AccountStore, input: SignUpInput, id: string, salt: string): AuthResult {
  const errors = validateSignUp(store, input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return addAccount(store, {
    id,
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
    nickname: input.nickname.trim().replace(/\s+/g, ' '),
    avatar: input.avatar,
    gender: input.gender,
    provider: 'password',
    passwordSalt: salt,
    passwordHash: hashPassword(input.password, salt),
  });
}

export function signUpWithGoogle(store: AccountStore, input: GoogleSignUpInput, id: string): AuthResult {
  const errors = profileErrors(store, input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return addAccount(store, {
    id,
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
    nickname: input.nickname.trim().replace(/\s+/g, ' '),
    avatar: input.avatar,
    gender: input.gender,
    provider: 'google',
  });
}

export function signIn(store: AccountStore, email: string, password: string): AuthResult {
  const errors: FieldErrors = {};
  if (!isValidEmail(email)) errors.email = 'כתובת האימייל לא תקינה';
  if (!password) errors.password = 'יש להזין סיסמה';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const account = findByEmail(store, email);
  const matches = account?.provider === 'password'
    && account.passwordSalt !== undefined
    && account.passwordHash === hashPassword(password, account.passwordSalt);
  // Unknown email and wrong password share one message. A Google account gets
  // its own hint, since a password can never work for it.
  if (!account || !matches) {
    if (account?.provider === 'google') {
      return { ok: false, errors: {}, message: 'החשבון הזה נרשם עם Google' };
    }
    return { ok: false, errors: {}, message: 'האימייל או הסיסמה שגויים' };
  }
  return { ok: true, store: { ...store, currentAccountId: account.id }, user: toUser(account) };
}

export function signOut(store: AccountStore): AccountStore {
  return { ...store, currentAccountId: null };
}
