import { Pressable, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './onboarding-styles';

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
