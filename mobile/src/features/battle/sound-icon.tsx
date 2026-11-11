import { StyleSheet, View } from 'react-native';

import { colors } from '@/design/tokens';

// A speaker drawn from plain views (no icon library in the project): body, cone and one sound wave; when muted the
// wave is replaced by a slash. Fixed 24 x 24 box, left/right are physical (the icon does not mirror in RTL).
export function SoundIcon({ muted }: { muted: boolean }) {
  const color = muted ? colors.textSecondary : colors.textPrimary;
  return (
    <View importantForAccessibility="no-hide-descendants" style={styles.box}>
      <View style={[styles.body, { backgroundColor: color }]} />
      <View style={[styles.cone, { borderRightColor: color }]} />
      {muted ? null : <View style={[styles.wave, { borderRightColor: color }]} />}
      {muted ? <View style={styles.slash} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 24, height: 24 },
  body: { position: 'absolute', left: 3, top: 9, width: 5, height: 6, borderRadius: 1 },
  cone: {
    position: 'absolute',
    left: 8,
    top: 5,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  wave: {
    position: 'absolute',
    left: 14,
    top: 6,
    width: 8,
    height: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 8,
  },
  slash: {
    position: 'absolute',
    left: -1,
    top: 11,
    width: 26,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.danger,
    transform: [{ rotate: '-45deg' }],
  },
});
