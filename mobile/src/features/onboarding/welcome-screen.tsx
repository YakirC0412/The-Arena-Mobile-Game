import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';

import { AVATARS, DEFAULT_AVATAR_ID } from '@/content/avatars';
import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { ArenaLogo, BrandBackground, BrandPrimaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { loadAccountStore, saveAccountStore, createLocalId } from '@/services/accounts/account-storage';
import {
  NICKNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signIn,
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
      ? signUp(store, { fullName, email, nickname, password, avatar }, createLocalId('user'), createLocalId('salt'))
      : signIn(store, email, password);
    if (!result.ok) {
      setErrors(result.errors);
      setMessage(result.message ?? 'יש לתקן את השדות המסומנים');
      return;
    }
    saveAccountStore(result.store);
    onSignedIn(result.user);
  };

  const isSignUp = mode === 'signup';

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
              accessibilityHint="התחברות עם Google תתאפשר בשלב מאוחר יותר"
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              disabled
              style={styles.googleButton}>
              <View style={styles.googleGlyph}>
                <Text style={styles.googleGlyphText} weight="black">G</Text>
              </View>
              <Text style={styles.googleText} weight="bold">
                {isSignUp ? 'הרשמה עם Google' : 'התחברות עם Google'}
              </Text>
              <View style={styles.soonBadge}>
                <Text style={styles.soonText} weight="bold">בקרוב</Text>
              </View>
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
