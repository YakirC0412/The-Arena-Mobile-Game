import { colors } from '@/design/tokens';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarPortrait } from '@/design/avatar-portrait';
import { CATEGORY_BY_ID } from '@/content/categories';
import type { GameState } from '@/game/types';
import { useReducedMotion } from '@/design/use-reduced-motion';

export function ArenaBuildScreen({
  onComplete,
  state,
}: {
  onComplete: () => void;
  state: GameState;
}) {
  const [cellAnimations] = useState(
    () => Array.from({ length: 16 }, () => new Animated.Value(0)),
  );
  const [waveAnimation] = useState(() => new Animated.Value(0));
  const completedRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (reducedMotion) {
      cellAnimations.forEach((animation) => animation.setValue(1));
      waveAnimation.setValue(0);
      completionTimerRef.current = setTimeout(complete, 450);
      return () => {
        if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      };
    }
    const animation = Animated.sequence([
      Animated.stagger(
        95,
        cellAnimations.map((value) => Animated.timing(value, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        })),
      ),
      Animated.timing(waveAnimation, {
        duration: 900,
        easing: Easing.inOut(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) completionTimerRef.current = setTimeout(complete, 650);
    });

    return () => {
      animation.stop();
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    };
  }, [cellAnimations, complete, reducedMotion, waveAnimation]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>THE ARENA</Text>
          <Text style={styles.title}>בונים את הזירה</Text>
          <Text style={styles.body}>מחלקים קטגוריות וממקמים את המתמודדים...</Text>
        </View>

        <View accessibilityLabel="הזירה נבנית" style={styles.boardFrame}>
          <View style={styles.boardGlow} />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.finalWave,
              {
                opacity: waveAnimation.interpolate({
                  inputRange: [0, 0.2, 0.72, 1],
                  outputRange: [0, 0.9, 0.6, 0],
                }),
                transform: [{
                  scale: waveAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.48, 1.08] }),
                }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.board,
              {
                transform: [{
                  scale: waveAnimation.interpolate({
                    inputRange: [0, 0.55, 1],
                    outputRange: [1, 1.025, 1],
                  }),
                }],
              },
            ]}>
            {state.cells.map((cell, index) => {
              const owner = state.players[cell.ownerId];
              const category = CATEGORY_BY_ID[owner.categoryId];
              // Same arena colors as everywhere: your own cell is the light-blue "active" one.
              const isMe = owner.isHuman;
              const foreground = isMe ? colors.boardFrame : colors.textPrimary;
              const animation = cellAnimations[index];
              return (
                <Animated.View
                  key={cell.id}
                  style={[
                    styles.cell,
                    isMe
                      ? { backgroundColor: colors.territoryMeEnd, borderColor: colors.territoryMeBorder }
                      : { backgroundColor: colors.arenaFloor, borderColor: colors.arenaFloorBorder },
                    {
                      opacity: animation,
                      transform: [{ scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
                    },
                  ]}>
                  <Text numberOfLines={2} style={[styles.categoryName, { color: foreground, opacity: 0.75 }]}>{category.name}</Text>
                  <View style={styles.ownerRow}>
                    <AvatarPortrait avatarId={owner.avatar} borderColor={foreground} size={23} />
                    <Text numberOfLines={1} style={[styles.playerName, { color: foreground }]}>{owner.name}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </Animated.View>
        </View>

        <View style={styles.loadingCard}>
          <View style={styles.loadingDots}>
            <View style={styles.loadingDot} />
            <View style={[styles.loadingDot, styles.loadingDotStrong]} />
            <View style={styles.loadingDot} />
          </View>
          <View>
            <Text style={styles.loadingTitle}>הזירה מתגבשת</Text>
            <Text style={styles.loadingText}>16 מתמודדים · 16 קטגוריות</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screen },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 18, justifyContent: 'space-between' },
  copy: { alignItems: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: colors.textPrimary, fontSize: 29, fontWeight: '900', writingDirection: 'rtl', marginTop: 5 },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', writingDirection: 'rtl', marginTop: 6 },
  boardFrame: { width: '100%', maxWidth: 380, aspectRatio: 1, alignSelf: 'center', borderRadius: 20, backgroundColor: colors.boardFrame, borderWidth: 2, borderColor: colors.boardFrameBorder, padding: 8, justifyContent: 'center', alignItems: 'center', shadowColor: colors.boardFrameBorder, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  boardGlow: { position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, backgroundColor: colors.surface, opacity: 0.35 },
  finalWave: { position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, borderRadius: 12, borderWidth: 8, borderColor: colors.territoryMeBorder, backgroundColor: colors.successSoft, zIndex: 3 },
  board: { width: '100%', aspectRatio: 1, flexDirection: 'row-reverse', flexWrap: 'wrap', zIndex: 2 },
  cell: { width: '25%', height: '25%', borderRadius: 0, borderWidth: 1, borderColor: colors.textPrimary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, overflow: 'hidden' },
  ownerRow: { maxWidth: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 2 },
  playerName: { flexShrink: 1, fontSize: 12, lineHeight: 15, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' },
  categoryName: { fontSize: 15, lineHeight: 18, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl', marginTop: 2 },
  loadingCard: { minHeight: 70, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.success, paddingHorizontal: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingDots: { flexDirection: 'row', gap: 7, height: 9, alignItems: 'center' },
  loadingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  loadingDotStrong: { width: 23, backgroundColor: colors.success },
  loadingTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  loadingText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
});
