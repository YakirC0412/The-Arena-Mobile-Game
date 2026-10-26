import { colors } from '@/design/tokens';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { AVATARS, DEFAULT_AVATAR_ID } from '@/content/avatars';
import { type PlayerProfile } from './player-profile';
import { TopBackButton } from './top-back-button';
import { styles } from './onboarding-styles';

const AVATAR_OPTIONS = AVATARS.map((avatar) => avatar.id);

type AuthMode = 'signup' | 'login';

export function AuthScreen({
  initialProfile,
  onBack,
  onComplete,
}: {
  initialProfile: PlayerProfile;
  onBack: () => void;
  onComplete: (profile: PlayerProfile) => void;
}) {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [nickname, setNickname] = useState(initialProfile.nickname);
  const [avatar, setAvatar] = useState(initialProfile.avatar || DEFAULT_AVATAR_ID);
  const [error, setError] = useState('');

  const submit = () => {
    const cleanName = fullName.trim();
    const cleanNickname = nickname.trim();
    if (mode === 'signup' && cleanName.length < 2) {
      setError('יש להזין שם באורך של שתי אותיות לפחות.');
      return;
    }
    if (cleanNickname.length < 2) {
      setError('יש להזין כינוי באורך של שתי אותיות לפחות.');
      return;
    }
    onComplete({
      fullName: cleanName || initialProfile.fullName || cleanNickname,
      nickname: cleanNickname,
      avatar,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.formScreen} keyboardShouldPersistTaps="handled">
        <TopBackButton onPress={onBack} />
        <Text style={styles.pageEyebrow}>הפרופיל שלי</Text>
        <Text style={styles.pageTitle}>נעים להכיר</Text>
        <Text style={styles.pageBody}>הפרטים נשמרים כרגע רק למשחק הנוכחי במכשיר.</Text>

        <View style={styles.segmentedControl}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'signup' }}
            onPress={() => { setMode('signup'); setError(''); }}
            style={[styles.segment, mode === 'signup' && styles.segmentActive]}>
            <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>הרשמה</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'login' }}
            onPress={() => { setMode('login'); setError(''); }}
            style={[styles.segment, mode === 'login' && styles.segmentActive]}>
            <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>התחברות</Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.label}>שם</Text>
              <TextInput
                accessibilityLabel="שם"
                autoComplete="name"
                onChangeText={(value) => { setFullName(value); setError(''); }}
                placeholder="למשל: דניאל כהן"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
                style={styles.input}
                textAlign="right"
                value={fullName}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>כינוי שיופיע בזירה</Text>
            <TextInput
              accessibilityLabel="כינוי שיופיע בזירה"
              autoCapitalize="none"
              maxLength={16}
              onChangeText={(value) => { setNickname(value); setError(''); }}
              onSubmitEditing={submit}
              placeholder="למשל: אלוף הטריוויה"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              style={styles.input}
              textAlign="right"
              value={nickname}
            />
          </View>

          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.label}>בחירת דמות</Text>
              <View accessibilityLabel="בחירת דמות" style={styles.avatarGrid}>
                {AVATAR_OPTIONS.map((option) => {
                  const selected = avatar === option;
                  return (
                    <Pressable
                      accessibilityLabel={`דמות ${option}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={option}
                      onPress={() => setAvatar(option)}
                      style={[styles.avatarOption, selected && styles.avatarOptionSelected]}>
                      <AvatarPortrait avatarId={option} borderColor={selected ? colors.success : colors.border} size={58} />
                      {selected && <View style={styles.avatarCheck}><Text style={styles.avatarCheckText}>✓</Text></View>}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={submit}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>
              {mode === 'signup' ? 'יצירת שחקן' : 'כניסה למשחק'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
