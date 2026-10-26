import { Pressable, ScrollView, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBackButton } from './top-back-button';
import { styles } from './onboarding-styles';

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
