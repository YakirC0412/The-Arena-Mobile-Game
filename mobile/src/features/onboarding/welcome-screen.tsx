import { useEffect, useState, type ReactNode } from 'react';
import type { Gender } from '@/game/gender';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';

import { AVATARS, DEFAULT_AVATAR_ID } from '@/content/avatars';
import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { ArenaLogo, BrandBackground, BrandPrimaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { isGoogleConfigured, preloadFirebase, signInWithGoogle } from '@/online/firebase-auth';
import { googleErrorMessage, loginWithGoogleToken, rememberGoogleAccount, saveGoogleProfile, type GoogleServerUser } from '@/online/google-account';
import { loadAccountStore, saveAccountStore, createLocalId } from '@/services/accounts/account-storage';
import {
  NICKNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signIn,
  signInWithGoogleAccount,
  signUp,
  type AccountUser,
  type FieldErrors,
} from '@/services/accounts/accounts';
import { styles } from './welcome-styles';

type AuthMode = 'signup' | 'signin';

// The first screen: logo plus a sign-up / sign-in card. Accounts are local to
// this device for now (services/accounts); Google is shown but disabled.
export function WelcomeScreen({ onSignedIn }: { onSignedIn: (user: AccountUser) => void }) {
  const { width } = useWindowDimensions();
  const logoSize = Math.min(240, Math.max(160, width * 0.55));
  const [mode, setMode] = useState<AuthMode>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR_ID);
  // Chosen at sign-up: every text in the game then uses the right Hebrew form (ניצח / ניצחה).
  const [gender, setGender] = useState<Gender | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrors({});
    setMessage('');
  };

  const edit = (field: keyof FieldErrors, setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (message) setMessage('');
  };

  const submit = () => {
    const store = loadAccountStore();
    const result = mode === 'signup'
      ? signUp(store, { fullName, email, nickname, password, avatar, gender: gender as Gender }, createLocalId('user'), createLocalId('salt'))
      : signIn(store, email, password);
    if (!result.ok) {
      setErrors(result.errors);
      setMessage(result.message ?? 'יש לתקן את השדות המסומנים');
      return;
    }
    saveAccountStore(result.store);
    onSignedIn(result.user);
  };

  // ---- Google (Firebase): popup -> the server checks the token -> a first-time player picks nickname, avatar and gender ----
  const googleReady = isGoogleConfigured();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{ token: string; user: GoogleServerUser } | null>(null);
  // Load Google's sign-in code now, so the popup can open inside the tap (iPhone blocks popups that open late).
  useEffect(() => {
    if (googleReady) void preloadFirebase().catch(() => undefined);
  }, [googleReady]);

  // An empty token means the Arena server was not reachable: the sign-in is kept on this device only (single-player works,
  // multiplayer asks to sign in again once the server is there).
  const finishGoogle = (user: GoogleServerUser, token: string) => {
    if (token) rememberGoogleAccount(user, token);
    const result = signInWithGoogleAccount(
      loadAccountStore(),
      { fullName: user.name, email: user.email, nickname: user.name, avatar: user.avatar, gender: user.gender },
      createLocalId('user'),
    );
    if (!result.ok) {
      setMessage(result.errors.nickname ?? result.message ?? 'לא הצלחנו להיכנס עם החשבון הזה');
      return;
    }
    saveAccountStore(result.store);
    onSignedIn(result.user);
  };

  const startGoogle = async () => {
    if (googleBusy) return;
    setGoogleBusy(true);
    setMessage('');
    try {
      const google = await signInWithGoogle();
      let login;
      try {
        login = await loginWithGoogleToken(google.idToken);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'server_offline' || !google.email) throw error;
        // No server: sign in on this device with what Google told us.
        const email = google.email.trim().toLowerCase();
        const known = loadAccountStore().accounts.find((account) => account.email === email);
        if (known) {
          finishGoogle({ id: 0, email, name: known.nickname, avatar: known.avatar, gender: known.gender ?? 'male' }, '');
        } else {
          setNickname(google.name.trim().slice(0, NICKNAME_MAX_LENGTH));
          setGoogleProfile({ token: '', user: { id: 0, email, name: google.name, avatar, gender: 'male' } });
        }
        return;
      }
      if (login.needsProfile) {
        setNickname(login.user.name);
        setAvatar(login.user.avatar);
        setGoogleProfile({ token: login.token, user: login.user });
      } else {
        finishGoogle(login.user, login.token);
      }
    } catch (error) {
      const code = (error as { code?: string }).code ?? (error instanceof Error ? error.message : undefined);
      // Closing Google's window is a choice, not a failure.
      // The technical code stays visible (small, in brackets) so a failure on a phone can be diagnosed from a screenshot.
      if (!/popup-closed|cancelled-popup/.test(code ?? '')) setMessage(`${googleErrorMessage(code)}${code ? ` (${code})` : ''}`);
    } finally {
      setGoogleBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!googleProfile) return;
    const next: FieldErrors = {};
    const name = nickname.trim().replace(/\s+/g, ' ');
    if (name.length < 1 || name.length > NICKNAME_MAX_LENGTH) next.nickname = `הכינוי צריך להיות בין 1 ל־${NICKNAME_MAX_LENGTH} תווים`;
    if (!gender) next.gender = 'יש לבחור גבר או אישה';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setGoogleBusy(true);
    try {
      const user = googleProfile.token
        ? await saveGoogleProfile(googleProfile.token, { name, avatar, gender: gender as Gender })
        : { ...googleProfile.user, name, avatar, gender: gender as Gender };
      finishGoogle(user, googleProfile.token);
    } catch (error) {
      setMessage(googleErrorMessage(error instanceof Error ? error.message : undefined));
    } finally {
      setGoogleBusy(false);
    }
  };

  const isSignUp = mode === 'signup';

  // First Google sign-in: Google knows neither the nickname the other players see, nor the avatar, nor the gender.
  if (googleProfile) {
    return (
      <BrandBackground>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <View style={styles.card}>
              <Text style={styles.cardTitle} weight="black">עוד רגע ואתם בזירה</Text>
              <Text style={styles.cardSubtitle}>{googleProfile.user.email} · בחרו כינוי, דמות ומין, והמשחק יכיר אתכם.</Text>

              <Field error={errors.nickname} hint="כך יראו אותך שאר השחקנים בזירה" label="כינוי בזירה">
                <TextInput
                  accessibilityLabel="כינוי בזירה"
                  maxLength={NICKNAME_MAX_LENGTH}
                  onChangeText={(value) => { setNickname(value); setErrors((current) => ({ ...current, nickname: undefined })); }}
                  placeholder="למשל: אלוף הטריוויה"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, errors.nickname && styles.inputError]}
                  textAlign="right"
                  value={nickname}
                />
              </Field>

              <Field error={errors.gender} hint="כדי שהמשחק ידבר אליך נכון: ניצח / ניצחה, כובש / כובשת" label="אני">
                <View accessibilityLabel="אני" style={styles.toggle}>
                  {([['male', 'גבר'], ['female', 'אישה']] as const).map(([value, label]) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: gender === value }}
                      key={value}
                      onPress={() => { setGender(value); setErrors((current) => ({ ...current, gender: undefined })); }}
                      style={[styles.toggleOption, gender === value && styles.toggleOptionActive]}>
                      <Text style={[styles.toggleText, gender === value && styles.toggleTextActive]} weight="bold">{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>

              <Field label="בחירת דמות">
                <View accessibilityLabel="בחירת דמות" style={styles.avatarGrid}>
                  {AVATARS.map(({ id }) => {
                    const selected = avatar === id;
                    return (
                      <Pressable
                        accessibilityLabel={`דמות ${id}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={id}
                        onPress={() => setAvatar(id)}
                        style={[styles.avatarOption, selected && styles.avatarOptionSelected]}>
                        <AvatarPortrait avatarId={id} borderColor={selected ? colors.brandSky : colors.brandBorder} size={52} />
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              {!!message && <Text accessibilityRole="alert" style={styles.formMessage} weight="bold">{message}</Text>}
              <BrandPrimaryButton disabled={googleBusy} label={googleBusy ? 'שומרים…' : 'כניסה לזירה'} onPress={saveProfile} />
              <Pressable accessibilityRole="button" onPress={() => { setGoogleProfile(null); setMessage(''); }} style={styles.switchLink}>
                <Text style={styles.switchTextStrong} weight="bold">ביטול</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </BrandBackground>
    );
  }

  return (
    <BrandBackground>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.hero}>
            <ArenaLogo size={logoSize} />
            <Text style={styles.tagline}>טריוויה חזותית · 16 מתמודדים · זירה אחת</Text>
          </View>

          <View style={styles.card}>
            <View accessibilityRole="tablist" style={styles.toggle}>
              {(['signup', 'signin'] as const).map((option) => {
                const selected = mode === option;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    key={option}
                    onPress={() => switchMode(option)}
                    style={[styles.toggleOption, selected && styles.toggleOptionActive]}>
                    <Text style={[styles.toggleText, selected && styles.toggleTextActive]} weight="bold">
                      {option === 'signup' ? 'הרשמה' : 'התחברות'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.cardTitle} weight="black">{isSignUp ? 'יצירת חשבון חדש' : 'ברוכים השבים'}</Text>
            <Text style={styles.cardSubtitle}>
              {isSignUp ? 'כמה פרטים, בחירת דמות, ונכנסים לזירה.' : 'התחברו כדי להמשיך לשחק.'}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !googleReady || googleBusy }}
              disabled={!googleReady || googleBusy}
              onPress={startGoogle}
              style={[styles.googleButton, googleReady && styles.googleButtonReady]}>
              <View style={styles.googleGlyph}>
                <Text style={styles.googleGlyphText} weight="black">G</Text>
              </View>
              <Text style={styles.googleText} weight="bold">
                {googleBusy ? 'מתחברים…' : isSignUp ? 'הרשמה עם Google' : 'התחברות עם Google'}
              </Text>
              {googleReady ? null : (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText} weight="bold">בקרוב</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>או עם אימייל</Text>
              <View style={styles.dividerLine} />
            </View>

            {isSignUp && (
              <Field error={errors.fullName} label="שם מלא">
                <TextInput
                  accessibilityLabel="שם מלא"
                  autoComplete="name"
                  onChangeText={edit('fullName', setFullName)}
                  placeholder="למשל: דניאל כהן"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="next"
                  style={[styles.input, errors.fullName && styles.inputError]}
                  textAlign="right"
                  value={fullName}
                />
              </Field>
            )}

            <Field error={errors.email} label="אימייל">
              <TextInput
                accessibilityLabel="אימייל"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                inputMode="email"
                keyboardType="email-address"
                onChangeText={edit('email', setEmail)}
                placeholder="name@example.com"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
                style={[styles.input, styles.inputLtr, errors.email && styles.inputError]}
                textAlign="left"
                value={email}
              />
            </Field>

            {isSignUp && (
              <Field error={errors.nickname} hint="כך יראו אותך שאר השחקנים בזירה" label="כינוי בזירה">
                <TextInput
                  accessibilityLabel="כינוי בזירה"
                  autoCapitalize="none"
                  maxLength={NICKNAME_MAX_LENGTH}
                  onChangeText={edit('nickname', setNickname)}
                  placeholder="למשל: אלוף הטריוויה"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="next"
                  style={[styles.input, errors.nickname && styles.inputError]}
                  textAlign="right"
                  value={nickname}
                />
              </Field>
            )}

            {isSignUp && (
              <Field error={errors.gender} hint="כדי שהמשחק ידבר אליך נכון: ניצח / ניצחה, כובש / כובשת" label="אני">
                <View accessibilityLabel="אני" style={styles.toggle}>
                  {([['male', 'גבר'], ['female', 'אישה']] as const).map(([value, label]) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: gender === value }}
                      key={value}
                      onPress={() => { setGender(value); if (errors.gender) setErrors((current) => ({ ...current, gender: undefined })); }}
                      style={[styles.toggleOption, gender === value && styles.toggleOptionActive]}>
                      <Text style={[styles.toggleText, gender === value && styles.toggleTextActive]} weight="bold">{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
            )}

            <Field
              error={errors.password}
              hint={isSignUp ? `לפחות ${PASSWORD_MIN_LENGTH} תווים` : undefined}
              label="סיסמה">
              <View style={styles.passwordRow}>
                <TextInput
                  accessibilityLabel="סיסמה"
                  autoCapitalize="none"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  autoCorrect={false}
                  onChangeText={edit('password', setPassword)}
                  onSubmitEditing={isSignUp ? undefined : submit}
                  placeholder={isSignUp ? 'בחרו סיסמה' : 'הסיסמה שלך'}
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType={isSignUp ? 'next' : 'go'}
                  secureTextEntry={!showPassword}
                  style={[styles.input, styles.inputLtr, styles.passwordInput, errors.password && styles.inputError]}
                  textAlign="left"
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                  accessibilityRole="button"
                  onPress={() => setShowPassword((visible) => !visible)}
                  style={styles.showPasswordButton}>
                  <Text style={styles.showPasswordText} weight="bold">{showPassword ? 'הסתר' : 'הצג'}</Text>
                </Pressable>
              </View>
            </Field>

            {isSignUp && (
              <Field error={errors.avatar} label="בחירת דמות">
                <View accessibilityLabel="בחירת דמות" style={styles.avatarGrid}>
                  {AVATARS.map(({ id }) => {
                    const selected = avatar === id;
                    return (
                      <Pressable
                        accessibilityLabel={`דמות ${id}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        key={id}
                        onPress={() => setAvatar(id)}
                        style={[styles.avatarOption, selected && styles.avatarOptionSelected]}>
                        <AvatarPortrait
                          avatarId={id}
                          borderColor={selected ? colors.brandSky : colors.brandBorder}
                          size={52}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            )}

            {!!message && <Text accessibilityRole="alert" style={styles.formMessage} weight="bold">{message}</Text>}

            <BrandPrimaryButton label={isSignUp ? 'יצירת חשבון וכניסה' : 'התחברות'} onPress={submit} />

            <Pressable accessibilityRole="button" onPress={() => switchMode(isSignUp ? 'signin' : 'signup')} style={styles.switchLink}>
              <Text style={styles.switchText}>
                {isSignUp ? 'כבר יש לך חשבון? ' : 'עוד אין לך חשבון? '}
                <Text style={styles.switchTextStrong} weight="bold">{isSignUp ? 'להתחברות' : 'להרשמה'}</Text>
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footnote}>גרסת אבטיפוס · החשבון נשמר בדפדפן במכשיר הזה בלבד</Text>
        </View>
      </ScrollView>
    </BrandBackground>
  );
}

function Field({ children, error, hint, label }: { children: ReactNode; error?: string; hint?: string; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label} weight="bold">{label}</Text>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}
