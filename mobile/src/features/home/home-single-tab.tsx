import { View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { HeroLogo } from './hero-logo';
import { styles } from './home-styles';

// Single play: you against 15 bots. The logo is the hero; one big button starts the game.
export function HomeSingleTab({ onGuide, onNewGame }: { onGuide: () => void; onNewGame: () => void }) {
  return (
    <View style={styles.singleStage}>
      <HeroLogo />
      <Text style={styles.heroSub}>אתם מול 15 יריבים במשחק טריוויה חזותי. כל יריב בקטגוריה משלו – ורק אחד יוצא אלוף.</Text>

      <View style={styles.actions}>
        <BrandPrimaryButton label="התחלת משחק חדש" onPress={onNewGame} style={styles.playButton} />
        <BrandSecondaryButton icon="📖" label="הוראות המשחק" onPress={onGuide} />
      </View>
    </View>
  );
}
