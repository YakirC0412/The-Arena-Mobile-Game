import { Pressable } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { styles } from './onboarding-styles';

export function TopBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityLabel="חזרה" accessibilityRole="button" onPress={onPress} style={styles.backButton}>
      <Text style={styles.backButtonText}>→</Text>
    </Pressable>
  );
}
