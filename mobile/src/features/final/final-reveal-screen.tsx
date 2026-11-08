import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPortrait } from '@/design/avatar-portrait';
import { AppText as Text } from '@/design/app-text';
import { colors } from '@/design/tokens';
import { useReducedMotion } from '@/design/use-reduced-motion';
import { CATEGORY_BY_ID } from '@/content/categories';
import { getActivePlayers } from '@/game/engine';
import { getTerritoryLabelRegion } from '@/features/arena/territory-layout';
import type { GameState } from '@/game/types';

export function FinalRevealScreen({ onComplete, state }: { onComplete?: () => void; state: GameState }) {
  const finalists = getActivePlayers(state);
  const [entrance] = useState(() => new Animated.Value(0));
  const [divider] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  const territoryRegions = useMemo(() => {
    const result = new Map<string, ReturnType<typeof getTerritoryLabelRegion>>();
    finalists.forEach((player) => {
      const cells = player.cellIds.map((id) => state.cells[id]);
      result.set(player.id, getTerritoryLabelRegion(cells));
    });
    return result;
  }, [finalists, state.cells]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('נשארו שני מתמודדים. הגמר הגדול מתחיל');
    if (reducedMotion) {
      entrance.setValue(1);
      divider.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(entrance, { duration: 900, easing: Easing.out(Easing.cubic), toValue: 1, useNativeDriver: true }),
      Animated.loop(Animated.sequence([
        Animated.timing(divider, { duration: 850, easing: Easing.inOut(Easing.quad), toValue: 1, useNativeDriver: true }),
        Animated.timing(divider, { duration: 850, easing: Easing.inOut(Easing.quad), toValue: 0.35, useNativeDriver: true }),
      ])),
    ]);
    animation.start();
    return () => animation.stop();
  }, [divider, entrance, reducedMotion]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }}>
          <Text style={styles.kicker}>נשארו שני מתמודדים</Text>
          <Text style={styles.title}>הגמר הגדול</Text>
          <Text style={styles.subtitle}>הזירה נחלקת לשני הכוחות האחרונים</Text>
        </Animated.View>

        <Animated.View style={[styles.boardFrame, { opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}>
          <View style={styles.board}>
            {state.cells.map((cell) => {
              const owner = state.players[cell.ownerId];
              const sameOwnerAt = (row: number, column: number) => row >= 0 && row < 4 && column >= 0 && column < 4
                ? state.cells[row * 4 + column].ownerId === owner.id
                : false;
              const boundary = {
                borderTopWidth: sameOwnerAt(cell.row - 1, cell.column) ? 0 : 2,
                borderBottomWidth: sameOwnerAt(cell.row + 1, cell.column) ? 0 : 2,
                borderLeftWidth: sameOwnerAt(cell.row, cell.column - 1) ? 0 : 2,
                borderRightWidth: sameOwnerAt(cell.row, cell.column + 1) ? 0 : 2,
              };
              return (
                <View key={cell.id} style={[styles.cell, boundary, { left: `${cell.column * 25}%`, top: `${cell.row * 25}%` }]} />
              );
            })}
            {finalists.map((owner) => {
              const region = territoryRegions.get(owner.id);
              if (!region) return null;
              return (
                <View
                  key={`finalist-${owner.id}`}
                  pointerEvents="none"
                  style={[
                    styles.labelPosition,
                    {
                      height: `${region.height}%`,
                      left: `${region.left}%`,
                      top: `${region.top}%`,
                      width: `${region.width}%`,
                    },
                  ]}>
                  <AvatarPortrait avatarId={owner.avatar} borderColor={colors.textPrimary} size={48} />
                  <Text numberOfLines={1} style={styles.category}>{CATEGORY_BY_ID[owner.categoryId].name}</Text>
                  <Text numberOfLines={1} style={styles.name}>{owner.name}</Text>
                </View>
              );
            })}
          </View>
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: divider }]} />
        </Animated.View>

        {onComplete ? (
          <Pressable accessibilityLabel="מעבר לבחירת דו קרב הגמר" accessibilityRole="button" onPress={onComplete} style={styles.button}>
            <Text style={styles.buttonText}>מעבר לבחירת דו־קרב הגמר</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screen },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 18 },
  kicker: { color: colors.accentGold, fontSize: 13, textAlign: 'center', writingDirection: 'rtl' },
  title: { color: colors.textPrimary, fontSize: 36, lineHeight: 44, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 2 },
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', writingDirection: 'rtl', marginTop: 3 },
  boardFrame: { width: '100%', maxWidth: 360, aspectRatio: 1, alignSelf: 'center', borderRadius: 24, backgroundColor: colors.boardFrame, borderWidth: 2, borderColor: colors.boardFrameBorder, padding: 9, marginTop: 24, shadowColor: colors.boardFrameBorder, shadowOpacity: 0.5, shadowRadius: 18, elevation: 9 },
  board: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 14 },
  cell: { position: 'absolute', width: '25%', height: '25%', backgroundColor: colors.territoryTarget, borderColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  labelPosition: { position: 'absolute', overflow: 'hidden', padding: 4, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  category: { color: colors.textPrimary, fontSize: 17, lineHeight: 21, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 4, textShadowColor: colors.bg, textShadowRadius: 5 },
  name: { color: colors.textPrimary, fontSize: 14, lineHeight: 18, textAlign: 'center', writingDirection: 'rtl', textShadowColor: colors.bg, textShadowRadius: 4 },
  glow: { position: 'absolute', top: 9, right: 9, bottom: 9, left: 9, borderRadius: 14, borderWidth: 2, borderColor: colors.textPrimary, shadowColor: colors.textPrimary, shadowOpacity: 1, shadowRadius: 10, elevation: 6 },
  button: { minHeight: 58, borderRadius: 14, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center', marginTop: 24, paddingHorizontal: 18 },
  buttonText: { color: colors.bg, fontSize: 17, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
});
