import { colors } from '@/design/tokens';
import { Image, StyleSheet, View } from 'react-native';

import { DEFAULT_AVATAR_ID } from '@/game/avatars';
import { AVATAR_IMAGES } from '@/media/avatar-images';

export function AvatarPortrait({
  avatarId,
  borderColor = colors.textPrimary,
  size,
}: {
  avatarId: string;
  borderColor?: string;
  size: number;
}) {
  const source = AVATAR_IMAGES[avatarId] ?? AVATAR_IMAGES[DEFAULT_AVATAR_ID];
  return (
    <View
      accessibilityLabel="דמות המתמודד"
      style={[
        styles.frame,
        {
          borderColor,
          borderRadius: size * 0.24,
          borderWidth: size < 32 ? 1 : 2,
          height: size,
          width: size,
        },
      ]}>
      <Image resizeMode="cover" source={source} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', backgroundColor: colors.textPrimary, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
