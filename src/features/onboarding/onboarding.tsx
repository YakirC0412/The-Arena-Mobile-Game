import { colors } from '@/design/tokens';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
TextInput,
  View,
} from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPortrait } from '@/design/avatar-portrait';
import { AVATARS, DEFAULT_AVATAR_ID } from '@/content/avatars';

export type PlayerProfile = {
  fullName: string;
  nickname: string;
  avatar: string;
};

const AVATAR_OPTIONS = AVATARS.map((avatar) => avatar.id);

type GuidePage = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: 'board' | 'neighbors' | 'clock';
};

const GUIDE_PAGES: GuidePage[] = [
  {
    eyebrow: 'עמוד 1 מתוך 3',
    title: 'כבשו את הזירה',
    body: 'הזירה מורכבת מ־16 משבצות. לכל שחקן יש קטגוריית ידע ושטח משלו.',
    points: ['בחרו קטגוריית התמחות', 'נצחו בדו־קרבות', 'השתלטו על כל 16 המשבצות'],
    visual: 'board',
  },
  {
    eyebrow: 'עמוד 2 מתוך 3',
    title: 'בחרו יריב סמוך',
    body: 'בכל תור מוגרל שחקן. השחקן שנבחר יכול לאתגר רק שטח שנוגע בשטח שלו.',
    points: ['אין תקיפה באלכסון', 'נלחמים בקטגוריה של המגן', 'שטח גדול מתנהג כיחידה אחת'],
    visual: 'neighbors',
  },
  {
    eyebrow: 'עמוד 3 מתוך 3',
    title: 'נצחו לפני שהזמן נגמר',
    body: 'לכל שחקן 40 שניות. השעון יורד רק בתורו, עד שניתנת תשובה נכונה.',
    points: ['תשובה נכונה מעבירה את התור', 'דילוג עולה 3 שניות', '3 ניצחונות רצופים מעניקים 5 שניות'],
    visual: 'clock',
  },
];

type AuthMode = 'signup' | 'login';

export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.welcomeScreen}>
        <View style={styles.brandMark} accessible accessibilityLabel="לוגו הזירה">
          <View style={styles.brandGrid}>
            {Array.from({ length: 9 }, (_, index) => (
              <View key={index} style={[styles.brandCell, index === 4 && styles.brandCellActive]} />
            ))}
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>ברוכים הבאים אל</Text>
          <Text style={styles.logo}>THE ARENA</Text>
          <Text style={styles.hebrewLogo}>הזירה</Text>
          <Text style={styles.lead}>
            בחרו את תחום הידע שלכם, התמודדו בדו־קרבות וכבשו את הזירה כולה.
          </Text>
        </View>

        <View style={styles.welcomeFooter}>
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>הרשמה או התחברות</Text>
          </Pressable>
          <Text style={styles.prototypeText}>גרסת אבטיפוס • משחק מקומי</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

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

export function GameModeScreen({
  nickname,
  onBack,
  onComputer,
}: {
  nickname: string;
  onBack: () => void;
  onComputer: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.modeScreen}>
        <TopBackButton onPress={onBack} />
        <Text style={styles.pageEyebrow}>שלום, {nickname}</Text>
        <Text style={styles.pageTitle}>איך משחקים היום?</Text>
        <Text style={styles.pageBody}>בחרו את מצב המשחק הרצוי.</Text>

        <View style={styles.modeList}>
          <Pressable
            accessibilityHint="פותח משחק מקומי מול שחקני מחשב"
            accessibilityRole="button"
            onPress={onComputer}
            style={({ pressed }) => [styles.modeCard, styles.modeCardOpen, pressed && styles.pressed]}>
            <View style={styles.modeIconWrap}>
              <Text style={styles.modeIcon}>◉</Text>
            </View>
            <View style={styles.modeCopy}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.availableBadge}>פתוח</Text>
                <Text style={styles.modeTitle}>מול המחשב</Text>
              </View>
              <Text style={styles.modeDescription}>אתם מול 15 יריבים הנשלטים על ידי המחשב.</Text>
            </View>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>

          <View
            accessibilityLabel="רב משתתפים, נעול ויגיע בהמשך"
            accessibilityState={{ disabled: true }}
            style={[styles.modeCard, styles.modeCardLocked]}>
            <View style={[styles.modeIconWrap, styles.modeIconLocked]}>
              <Text style={styles.lockIcon}>⌑</Text>
            </View>
            <View style={styles.modeCopy}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.lockedBadge}>נעול</Text>
                <Text style={[styles.modeTitle, styles.mutedText]}>רב־משתתפים</Text>
              </View>
              <Text style={[styles.modeDescription, styles.mutedText]}>משחק חי מול שחקנים אחרים ייפתח בהמשך.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function GuideScreen({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = GUIDE_PAGES[pageIndex];
  const isLastPage = pageIndex === GUIDE_PAGES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.guideScreen}>
        <View style={styles.guideTopBar}>
          <Pressable
            accessibilityLabel={pageIndex === 0 ? 'חזרה לבחירת משחק' : 'לעמוד הקודם'}
            accessibilityRole="button"
            onPress={pageIndex === 0 ? onBack : () => setPageIndex((current) => current - 1)}
            style={styles.backButton}>
            <Text style={styles.backButtonText}>→</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onComplete} style={styles.skipGuideButton}>
            <Text style={styles.skipGuideText}>דילוג על ההסבר</Text>
          </Pressable>
        </View>

        <View style={styles.bookCard}>
          <GuideVisual type={page.visual} />
          <Text style={styles.guideEyebrow}>{page.eyebrow}</Text>
          <Text style={styles.guideTitle}>{page.title}</Text>
          <Text style={styles.guideBody}>{page.body}</Text>

          <View style={styles.guidePoints}>
            {page.points.map((point, index) => (
              <View key={point} style={styles.guidePointRow}>
                <View style={styles.pointNumber}>
                  <Text style={styles.pointNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.guidePointText}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.guideFooter}>
          <View accessibilityLabel={`עמוד ${pageIndex + 1} מתוך ${GUIDE_PAGES.length}`} style={styles.pageDots}>
            {GUIDE_PAGES.map((item, index) => (
              <View
                key={item.title}
                style={[styles.pageDot, index === pageIndex && styles.pageDotActive]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={isLastPage ? onComplete : () => setPageIndex((current) => current + 1)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>{isLastPage ? 'הבנתי, מתחילים' : 'לעמוד הבא'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function GuideVisual({ type }: { type: GuidePage['visual'] }) {
  if (type === 'clock') {
    return (
      <View style={styles.guideVisual}>
        <View style={styles.clockRing}>
          <Text style={styles.clockNumber}>40</Text>
          <Text style={styles.clockSeconds}>שניות</Text>
        </View>
        <View style={styles.bonusChip}>
          <Text style={styles.bonusChipText}>+5 בונוס</Text>
        </View>
      </View>
    );
  }

  const highlighted = type === 'neighbors' ? new Set([1, 4, 5, 6, 9]) : new Set([5, 6, 9]);
  return (
    <View style={styles.guideVisual}>
      <View style={styles.miniBoard}>
        {Array.from({ length: 16 }, (_, index) => {
          const isCenter = type === 'neighbors' && index === 5;
          return (
            <View
              key={index}
              style={[
                styles.miniCell,
                highlighted.has(index) && styles.miniCellOwned,
                isCenter && styles.miniCellCenter,
              ]}
            />
          );
        })}
      </View>
      {type === 'neighbors' && <Text style={styles.visualHint}>המשבצות המודגשות זמינות לתקיפה</Text>}
    </View>
  );
}

function TopBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="חזרה" accessibilityRole="button" onPress={onPress} style={styles.backButton}>
      <Text style={styles.backButtonText}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  welcomeScreen: { flex: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'space-between' },
  brandMark: { alignSelf: 'center', width: 126, height: 126, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 22 },
  brandGrid: { width: 66, height: 66, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4, transform: [{ rotate: '45deg' }] },
  brandCell: { width: 19, height: 19, borderRadius: 5, backgroundColor: colors.border },
  brandCellActive: { backgroundColor: colors.accentGold, shadowColor: colors.accentGold, shadowOpacity: 0.7, shadowRadius: 12 },
  heroCopy: { alignItems: 'center', marginTop: -18 },
  kicker: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', writingDirection: 'rtl' },
  logo: { color: colors.textPrimary, fontSize: 42, lineHeight: 49, fontWeight: '900', letterSpacing: 1.8, marginTop: 5 },
  hebrewLogo: { color: colors.success, fontSize: 25, fontWeight: '900', marginTop: -2 },
  lead: { maxWidth: 315, color: colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', writingDirection: 'rtl', marginTop: 18 },
  welcomeFooter: { gap: 13 },
  prototypeText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' },
  primaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: colors.bg, fontSize: 16, fontWeight: '900', writingDirection: 'rtl' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  formScreen: { flexGrow: 1, padding: 22, paddingBottom: 40 },
  modeScreen: { flexGrow: 1, padding: 22, paddingBottom: 40 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end', marginBottom: 22 },
  backButtonText: { color: colors.textPrimary, fontSize: 22, fontWeight: '900' },
  pageEyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  pageTitle: { color: colors.textPrimary, fontSize: 31, lineHeight: 39, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 3 },
  pageBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl', marginTop: 5 },
  segmentedControl: { flexDirection: 'row-reverse', backgroundColor: colors.surfaceMuted, borderRadius: 16, padding: 4, marginTop: 26 },
  segment: { flex: 1, height: 43, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.textSecondary, fontSize: 14, fontWeight: '800', writingDirection: 'rtl' },
  segmentTextActive: { color: colors.textPrimary },
  formCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, marginTop: 16, borderWidth: 1, borderColor: colors.border, gap: 18 },
  field: { gap: 7 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  input: { height: 54, borderRadius: 15, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, color: colors.textPrimary, fontSize: 16, paddingHorizontal: 15, writingDirection: 'rtl' },
  avatarGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  avatarOption: { width: '22.5%', aspectRatio: 0.92, borderRadius: 16, backgroundColor: colors.surfaceMuted, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', paddingVertical: 5 },
  avatarOptionSelected: { borderColor: colors.success, backgroundColor: colors.surface, transform: [{ scale: 1.04 }] },
  avatarCheck: { position: 'absolute', right: 5, top: 5, width: 17, height: 17, borderRadius: 9, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  avatarCheckText: { color: colors.bg, fontSize: 12, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 12, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl', marginTop: -7 },
  modeList: { gap: 14, marginTop: 30 },
  modeCard: { minHeight: 126, borderRadius: 24, padding: 17, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, borderWidth: 1.5 },
  modeCardOpen: { backgroundColor: colors.surface, borderColor: colors.success },
  modeCardLocked: { backgroundColor: colors.surfaceMuted, borderColor: colors.surface, opacity: 0.65 },
  modeIconWrap: { width: 55, height: 55, borderRadius: 18, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' },
  modeIconLocked: { backgroundColor: colors.border },
  modeIcon: { color: colors.bg, fontSize: 30, fontWeight: '900' },
  lockIcon: { color: colors.textSecondary, fontSize: 28, fontWeight: '900' },
  modeCopy: { flex: 1, alignItems: 'stretch' },
  modeTitleRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  modeTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  modeDescription: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl', marginTop: 7 },
  availableBadge: { color: colors.bg, backgroundColor: colors.success, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  lockedBadge: { color: colors.textSecondary, backgroundColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  mutedText: { color: colors.textSecondary },
  arrow: { color: colors.textPrimary, fontSize: 30, fontWeight: '500', marginLeft: -3 },
  guideScreen: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  guideTopBar: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  skipGuideButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  skipGuideText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline', writingDirection: 'rtl' },
  bookCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, marginTop: 6, padding: 14, overflow: 'hidden' },
  guideVisual: { height: 132, borderRadius: 20, backgroundColor: colors.surfaceMuted, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  miniBoard: { width: 100, height: 100, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 },
  miniCell: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  miniCellOwned: { backgroundColor: colors.success, borderColor: colors.success },
  miniCellCenter: { backgroundColor: colors.accentGold, borderColor: colors.accentGold, transform: [{ scale: 1.08 }] },
  visualHint: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', writingDirection: 'rtl', marginTop: 6 },
  clockRing: { width: 98, height: 98, borderRadius: 49, borderWidth: 8, borderColor: colors.success, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  clockNumber: { color: colors.textPrimary, fontSize: 34, lineHeight: 38, fontWeight: '900', fontVariant: ['tabular-nums'] },
  clockSeconds: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  bonusChip: { position: 'absolute', right: 26, bottom: 14, borderRadius: 999, backgroundColor: colors.accentGold, paddingHorizontal: 10, paddingVertical: 4, transform: [{ rotate: '-7deg' }] },
  bonusChipText: { color: colors.bg, fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
  guideEyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  guideTitle: { color: colors.textPrimary, fontSize: 23, lineHeight: 28, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 1 },
  guideBody: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl', marginTop: 5 },
  guidePoints: { gap: 4, marginTop: 8 },
  guidePointRow: { minHeight: 27, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  pointNumber: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  pointNumberText: { color: colors.success, fontSize: 12, fontWeight: '900' },
  guidePointText: { flex: 1, color: colors.textPrimary, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  guideFooter: { paddingTop: 10, gap: 9 },
  pageDots: { height: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  pageDotActive: { width: 24, backgroundColor: colors.success },
});
