import { Pressable, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { ArenaLogo, BrandBackground, BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { styles } from './welcome-styles';

// The signed-in home: nickname, avatar, and the two ways into the game.
export function HomeScreen({
  avatar,
  nickname,
  onGuide,
  onNewGame,
  onSignOut,
}: {
  avatar: string;
  nickname: string;
  onGuide: () => void;
  onNewGame: () => void;
  onSignOut: () => void;
}) {
  return (
    <BrandBackground>
      <View style={styles.homeColumn}>
        <View style={styles.homeTopBar}>
          <ArenaLogo size={84} />
          <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText} weight="bold">התנתקות</Text>
          </Pressable>
        </View>

        <View style={styles.homeProfile}>
          <Text style={styles.homeGreeting} weight="bold">שלום,</Text>
          <Text accessibilityRole="header" style={styles.homeNickname} weight="black">{nickname}</Text>
          <View style={styles.homeAvatarRing}>
            <AvatarPortrait avatarId={avatar} borderColor={colors.brandSky} size={132} />
          </View>
        </View>

        <View style={styles.homeActions}>
          <BrandSecondaryButton icon="📖" label="הוראות המשחק" onPress={onGuide} />
          <BrandPrimaryButton icon="⚔️" label="התחלת משחק חדש" onPress={onNewGame} />
        </View>
      </View>
    </BrandBackground>
  );
}
