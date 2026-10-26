import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AccessibilityInfo,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  BattleClockCards,
  type BattleClockHandle,
  type BattleRole,
} from '@/features/battle/battle-clock-cards';
import { ArenaBattleMiniMap } from '@/features/arena/arena-battle-mini-map';
import { AppText } from '@/design/app-text';
import { colors, fontFamilies, layout, radii, spacing, typeScale } from '@/design/tokens';
import { useGameFeedback } from '@/services/use-game-feedback';
import { CATEGORY_BY_ID } from '@/content/categories';
import { createBattleDeck, isCorrectAnswer } from '@/game/engine';
import type { BattleSetup, GameState } from '@/game/types';
import { ITEM_IMAGES } from '@/content/item-images';

type BattleViewProps = {
  state: GameState;
  setup: BattleSetup;
  onComplete: (winnerId: string) => void;
  random?: () => number;
};

export function BattleView({ state, setup, onComplete, random = Math.random }: BattleViewProps) {
  const {
    correct: playCorrectFeedback,
    dangerTick: playDangerTick,
    muted,
    skip: playSkipFeedback,
    timeUp: playTimeUpFeedback,
    toggleMuted,
  } = useGameFeedback();
  const attacker = state.players[setup.attackerId];
  const defender = state.players[setup.defenderId];
  const category = CATEGORY_BY_ID[setup.categoryId];
  const [deck, setDeck] = useState(() => createBattleDeck(category.items, random));
  const [activeId, setActiveId] = useState(setup.attackerId);
  const [position, setPosition] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [aiAttempt, setAiAttempt] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const finishedRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const clockRef = useRef<BattleClockHandle>(null);
  const [imageOpacity] = useState(() => new Animated.Value(1));
  const [imageScale] = useState(() => new Animated.Value(1));
  const [correctGlow] = useState(() => new Animated.Value(0));
  const item = deck[position];
  const itemImage = item.imageKey ? ITEM_IMAGES[item.imageKey] : undefined;

  const activeRole: BattleRole = activeId === setup.attackerId ? 'attacker' : 'defender';
  const activePlayer = state.players[activeId];
  const isHumanTurn = activePlayer.isHuman;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      isHumanTurn ? 'התור שלך. הקלידו את התשובה' : `התור של ${activePlayer.name}`,
    );
  }, [activePlayer.name, isHumanTurn]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    imageOpacity.stopAnimation();
    imageScale.stopAnimation();
    if (reduceMotion) {
      imageOpacity.setValue(1);
      imageScale.setValue(1);
      return;
    }
    imageOpacity.setValue(0.15);
    imageScale.setValue(0.96);
    Animated.parallel([
      Animated.timing(imageOpacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(imageScale, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [imageOpacity, imageScale, item.id, reduceMotion]);

  const animateCorrect = useCallback(() => {
    correctGlow.stopAnimation();
    correctGlow.setValue(0);
    Animated.sequence([
      Animated.timing(correctGlow, { toValue: 1, duration: reduceMotion ? 80 : 120, useNativeDriver: false }),
      Animated.timing(correctGlow, { toValue: 0, duration: reduceMotion ? 80 : 160, useNativeDriver: false }),
    ]).start();
  }, [correctGlow, reduceMotion]);

  const animateSkip = useCallback(() => {
    if (reduceMotion) return;
    Animated.timing(imageOpacity, { toValue: 0.2, duration: 140, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [imageOpacity, reduceMotion]);

  const focusInput = useCallback(() => {
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(focusTimer);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!isHumanTurn || transitioning) return undefined;
    return focusInput();
  }, [focusInput, isHumanTurn, transitioning]));

  useEffect(() => {
    if (!isHumanTurn || transitioning) return;
    return focusInput();
  }, [focusInput, isHumanTurn, transitioning]);

  const advanceImage = useCallback((switchTurn: boolean) => {
    let nextPosition = position + 1;
    if (nextPosition >= deck.length) {
      const nextDeck = createBattleDeck(category.items, random);
      if (nextDeck[0]?.id === item.id && nextDeck.length > 1) {
        nextDeck.push(nextDeck.shift()!);
      }
      setDeck(nextDeck);
      nextPosition = 0;
    }
    setPosition(nextPosition);
    setAnswer('');
    setFeedback(switchTurn ? 'התור עבר' : '');
    setAiAttempt(0);
    setTransitioning(false);
    if (switchTurn) {
      setActiveId((current) => (
        current === setup.attackerId ? setup.defenderId : setup.attackerId
      ));
    }
  }, [category.items, deck.length, item.id, position, random, setup.attackerId, setup.defenderId]);

  const scheduleAdvance = useCallback((switchTurn: boolean, delay: number) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => advanceImage(switchTurn), delay);
  }, [advanceImage]);

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);

  const finishFromClock = useCallback((expiredRole: BattleRole) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete(expiredRole === 'attacker' ? setup.defenderId : setup.attackerId);
  }, [onComplete, setup.attackerId, setup.defenderId]);

  const handleClockExpired = useCallback(() => {
    playTimeUpFeedback();
  }, [playTimeUpFeedback]);

  useEffect(() => {
    if (isHumanTurn || transitioning || finishedRef.current) return;
    const difficulty = item.difficulty;
    const delay = 850 + difficulty * 450 + Math.floor(random() * 500);
    const timeout = setTimeout(() => {
      if (finishedRef.current) return;
      const successChance = 0.92 - difficulty * 0.15;
      if (random() < successChance) {
        animateCorrect();
        playCorrectFeedback();
        setTransitioning(true);
        setFeedback('נכון!');
        scheduleAdvance(true, 350);
        return;
      }

      const role: BattleRole = activeId === setup.attackerId ? 'attacker' : 'defender';
      if ((clockRef.current?.getRemaining(role) ?? 0) < 6500 || random() < 0.45) {
        animateSkip();
        playSkipFeedback();
        clockRef.current?.penalize(role, 3000);
        setTransitioning(true);
        setFeedback('דילגת: ‎−3 שניות');
        scheduleAdvance(false, 350);
      } else {
        setAiAttempt((value) => value + 1);
      }
    }, delay);
    return () => clearTimeout(timeout);
  }, [activeId, aiAttempt, animateCorrect, animateSkip, isHumanTurn, item.difficulty, playCorrectFeedback, playSkipFeedback, random, scheduleAdvance, setup.attackerId, transitioning]);

  const handleAnswerChange = (nextAnswer: string) => {
    if (!isHumanTurn || transitioning) return;
    setAnswer(nextAnswer);
    if (isCorrectAnswer(nextAnswer, item.answer, item.aliases)) {
      animateCorrect();
      playCorrectFeedback();
      setTransitioning(true);
      setFeedback('נכון!');
      scheduleAdvance(true, 300);
    }
  };

  const clearAnswer = () => {
    if (!isHumanTurn || transitioning) return;
    setAnswer('');
    inputRef.current?.focus();
  };

  const skip = () => {
    if (!isHumanTurn || transitioning) return;
    setTransitioning(true);
    animateSkip();
    playSkipFeedback();
    clockRef.current?.penalize(activeRole, 3000);
    setFeedback('דילגת: ‎−3 שניות');
    scheduleAdvance(false, 250);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ android: 'height', ios: 'padding' })}
      style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.miniMapPosition}>
          <ArenaBattleMiniMap
            attackerId={setup.attackerId}
            defenderId={setup.defenderId}
            state={state}
          />
        </View>
        <Pressable
          accessibilityLabel={muted ? 'הפעלת צלילים' : 'השתקת צלילים'}
          accessibilityRole="button"
          onPress={toggleMuted}
          style={styles.muteButton}>
          <AppText style={styles.muteButtonText} weight="bold">
            {muted ? 'שקט' : 'קול'}
          </AppText>
        </Pressable>
        <AppText style={styles.eyebrow} weight="bold">דו־קרב · קטגוריית המגן</AppText>
        <AppText style={styles.title} weight="black">{category.name}</AppText>
      </View>

      <BattleClockCards
        ref={clockRef}
        activeRole={activeRole}
        attackerBonus={setup.attackerUsesBonus}
        attackerColor={attacker.color}
        attackerLabel={`${attacker.isHuman ? 'אתה' : attacker.name} · תוקף`}
        attackerMilliseconds={setup.attackerSeconds * 1000}
        defenderBonus={setup.defenderUsesBonus}
        defenderColor={defender.color}
        defenderLabel={`${defender.isHuman ? 'אתה' : defender.name} · מגן`}
        defenderMilliseconds={setup.defenderSeconds * 1000}
        onClockExpired={handleClockExpired}
        onDangerTick={playDangerTick}
        onTimeUp={finishFromClock}
        paused={transitioning}
      />

      <View style={styles.turnPill}>
        <AppText style={styles.turnText} weight="black">
          {isHumanTurn ? 'התור שלך · הקלידו את התשובה' : `התור של ${activePlayer.name}`}
        </AppText>
      </View>

      <Animated.View style={[
        styles.imageCard,
        {
          borderColor: correctGlow.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.territoryMeBorder, colors.success],
          }),
          opacity: imageOpacity,
          transform: [{ scale: imageScale }],
        },
      ]}>
        {itemImage ? (
          <Image
            accessibilityLabel="פריט לזיהוי"
            resizeMode="contain"
            source={itemImage}
            style={styles.itemImage}
          />
        ) : (
          <AppText accessibilityLabel="פריט לזיהוי" style={styles.visual}>{item.visual}</AppText>
        )}
      </Animated.View>

      <AppText accessibilityLiveRegion="polite" style={styles.feedback} weight="bold">
        {feedback || 'זהו את מה שמופיע בתמונה'}
      </AppText>

      <View style={styles.controls}>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityHint="התשובה נבדקת אוטומטית בזמן ההקלדה"
            accessibilityLabel="תשובה"
            onChangeText={handleAnswerChange}
            placeholder={isHumanTurn ? 'הקלידו תשובה…' : `התור של ${activePlayer.name}`}
            placeholderTextColor={colors.textSecondary}
            maxFontSizeMultiplier={1.3}
            returnKeyType="done"
            selectionColor={colors.success}
            style={[styles.input, !isHumanTurn && styles.inputInactive]}
            textAlign="right"
            value={answer}
          />
          <Pressable
            accessibilityLabel="מחיקת התשובה"
            accessibilityRole="button"
            disabled={!isHumanTurn || transitioning || !answer}
            onPress={clearAnswer}
            style={[styles.clearButton, (!isHumanTurn || transitioning || !answer) && styles.disabledControl]}>
            <AppText style={styles.clearText} weight="bold">×</AppText>
          </Pressable>
        </View>

        {isHumanTurn ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={transitioning}
              onPress={skip}
              style={[styles.skipButton, transitioning && styles.disabledControl]}>
              <AppText style={styles.skipText} weight="black">דילוג · ‎−3</AppText>
            </Pressable>
            <View style={styles.autoSubmitHint}>
              <AppText style={styles.autoSubmitHintText} weight="bold">נבדק אוטומטית כשהתשובה נכונה</AppText>
            </View>
          </View>
        ) : (
          <View style={styles.aiThinking}>
            <AppText style={styles.aiThinkingText} weight="bold">{activePlayer.name} חושב/ת</AppText>
            <View style={styles.thinkingDots}>
              <View style={styles.thinkingDot} />
              <View style={styles.thinkingDot} />
              <View style={styles.thinkingDot} />
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  header: { minHeight: 70, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  miniMapPosition: { position: 'absolute', left: 0, top: 0 },
  muteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    minWidth: 48,
    minHeight: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteButtonText: { color: colors.textSecondary, fontSize: typeScale.caption, textAlign: 'center' },
  eyebrow: { color: colors.accentGold, fontSize: typeScale.caption, textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, textAlign: 'center', marginTop: spacing.xs },
  turnPill: {
    alignSelf: 'center',
    minHeight: 34,
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  turnText: { color: colors.bg, fontSize: typeScale.caption, textAlign: 'center' },
  imageCard: {
    flex: 1,
    width: '100%',
    minHeight: 112,
    maxHeight: 260,
    borderRadius: radii.card,
    backgroundColor: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.territoryMeBorder,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemImage: { width: '100%', height: '100%', maxWidth: 310, flex: 1, minHeight: 90, borderRadius: radii.control },
  visual: { color: colors.bg, fontSize: 84, lineHeight: 100, textAlign: 'center' },
  feedback: { minHeight: 22, color: colors.textSecondary, fontSize: typeScale.caption, textAlign: 'center', marginVertical: spacing.xs },
  controls: { gap: spacing.sm },
  inputRow: { minHeight: 52, flexDirection: 'row-reverse', gap: spacing.sm },
  input: {
    flex: 1,
    height: 52,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.textPrimary,
    color: colors.bg,
    fontFamily: fontFamilies.bold,
    fontSize: typeScale.button,
    paddingHorizontal: spacing.md,
    writingDirection: 'rtl',
  },
  inputInactive: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textSecondary },
  clearButton: {
    width: 52,
    height: 52,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { color: colors.textPrimary, fontSize: 28, lineHeight: 32, textAlign: 'center' },
  actions: { minHeight: 48, flexDirection: 'row-reverse', gap: spacing.sm },
  autoSubmitHint: {
    flex: 2,
    minHeight: 48,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoSubmitHintText: { color: colors.textSecondary, fontSize: typeScale.caption, lineHeight: 17, textAlign: 'center' },
  skipButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: { color: colors.accentGold, fontSize: typeScale.body, textAlign: 'center' },
  aiThinking: {
    minHeight: 48,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiThinkingText: { color: colors.textSecondary, fontSize: typeScale.body, textAlign: 'center' },
  thinkingDots: { flexDirection: 'row', gap: spacing.xs },
  thinkingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  disabledControl: { opacity: 0.5 },
});
