import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { BattleClockCards, type BattleRole, type ClockEvent } from '@/features/battle/battle-clock-cards';
import { ArenaBattleMiniMap } from '@/features/arena/arena-battle-mini-map';
import { AppText } from '@/design/app-text';
import { colors, fontFamilies, layout, radii, spacing, typeScale } from '@/design/tokens';
import { isTouchWeb } from '@/design/keyboard-primer';
import { useWebViewportBox } from '@/design/use-web-viewport-box';
import { useGameFeedback } from '@/services/use-game-feedback';
import { CATEGORY_BY_ID, getWay, getWayItems } from '@/content/categories';
import { applyAnswer, applySkip, currentItem, remainingMs, startDuel, tick } from '@/game/duel';
import type { DuelState } from '@/game/duel';
import {
  aiThinkDelayMs,
  correctAnswerPauseMs,
  createBattleDeck,
  decideAiDuelOutcome,
} from '@/game/engine';
import { by } from '@/game/gender';
import type { BattleSetup, GameState } from '@/game/types';
import { FittedPicture } from './fitted-picture';
import { ITEM_IMAGES } from '@/content/item-images';
import { createTapGate } from '@/features/battle/tap-gate';
import { SoundIcon } from './sound-icon';

type BattleViewProps = {
  state: GameState;
  setup: BattleSetup;
  onComplete: (winnerId: string) => void;
  random?: () => number;
};

// The local human duel. All the rules (whose clock runs, the pause after a right answer, the skip penalty, who
// wins when a clock hits zero) live in the duel state machine (game/duel.ts), the same one the server uses.
// This screen only keeps one `DuelState`, feeds it what happens (typed answers, skips, a bot's choices, time passing)
// and shows the result with sounds and animations.
export function BattleView({ state, setup, onComplete, random = Math.random }: BattleViewProps) {
  const {
    correct: playCorrectFeedback,
    dangerTick: playDangerTick,
    muted,
    skip: playSkipFeedback,
    timeUp: playTimeUpFeedback,
    toggleMuted,
  } = useGameFeedback();
  // iPhone Safari: while the keyboard is up the duel sits in a fixed box that is exactly the visible area, so
  // nothing is cut at the top or hidden under the keyboard (the picture panel shrinks instead).
  const viewportBox = useWebViewportBox(true);
  // On a short visible area (the keyboard is up) the surrounding panels get flatter, so the picture panel and the
  // answer row always fit. The picture panel takes whatever height is left and is the same in every category:
  // the picture inside never changes its size (it is absolutely positioned).
  const { height: windowHeight } = useWindowDimensions();
  // Always compact on a phone: the keyboard is up for the whole duel, and a layout that switched on and off with it jumped.
  const compact = (viewportBox ? viewportBox.height : windowHeight) < 600 || isTouchWeb();
  const fixedBox = viewportBox
    ? ({
      position: 'fixed',
      top: viewportBox.top,
      left: 0,
      right: 0,
      height: viewportBox.height,
      marginHorizontal: 'auto',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)',
    } as never)
    : null;
  const attacker = state.players[setup.attackerId];
  const defender = state.players[setup.defenderId];
  const category = CATEGORY_BY_ID[setup.categoryId];
  // The duel plays the defender's way: e.g. flag → capital instead of flag → country.
  const way = getWay(category, setup.wayId);
  const [wayItems] = useState(() => getWayItems(category, setup.wayId));
  const env = useMemo(() => ({ refill: () => createBattleDeck(wayItems, random) }), [wayItems, random]);

  // The one source of truth. `duelRef` always holds the latest state, so event handlers never act on a stale one.
  const [duel, setDuel] = useState<DuelState>(() => startDuel(
    createBattleDeck(wayItems, random),
    setup.attackerSeconds * 1000,
    setup.defenderSeconds * 1000,
    Date.now(),
  ));
  const duelRef = useRef(duel);
  const commit = useCallback((next: DuelState) => {
    duelRef.current = next;
    setDuel(next);
  }, []);

  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [aiAttempt, setAiAttempt] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const finishedRef = useRef(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [imageOpacity] = useState(() => new Animated.Value(1));
  const [imageScale] = useState(() => new Animated.Value(1));
  const [correctGlow] = useState(() => new Animated.Value(0));
  // Event feedback (see BattleClockCards): which side's clock just got a skip or a right answer, the big "נכון!" over the
  // picture, and the shake of the answer field after a wrong answer was submitted.
  const [clockEvents, setClockEvents] = useState<Record<BattleRole, ClockEvent>>({ attacker: null, defender: null });
  const eventKeyRef = useRef(0);
  const emitClockEvent = useCallback((side: BattleRole, kind: 'skip' | 'correct') => {
    eventKeyRef.current += 1;
    const event = { key: eventKeyRef.current, kind };
    setClockEvents((current) => ({ ...current, [side]: event }));
  }, []);
  const [verdict] = useState(() => new Animated.Value(0));
  const [fieldShake] = useState(() => new Animated.Value(0));
  const item = currentItem(duel);
  const itemImage = item.imageKey ? ITEM_IMAGES[item.imageKey] : undefined;

  const activeRole: BattleRole = duel.active;
  const activeId = activeRole === 'attacker' ? setup.attackerId : setup.defenderId;
  const activePlayer = state.players[activeId];
  const isHumanTurn = activePlayer.isHuman;
  // Both clocks are stopped (after a right answer or a skip) or the duel is over: nothing can be typed or skipped.
  const locked = duel.pausedUntil !== null || duel.winner !== null;

  // Time passing: ends a pause (next picture, maybe the other side's turn) and ends the duel when a clock hits zero.
  useEffect(() => {
    const interval = setInterval(() => {
      const next = tick(duelRef.current, Date.now(), env);
      if (next !== duelRef.current) commit(next);
    }, 100);
    return () => clearInterval(interval);
  }, [commit, env]);

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

  // A new picture appears: fade it in, clear the answer, and say when the turn passed.
  const previousActiveRef = useRef(duel.active);
  useEffect(() => {
    setAnswer('');
    setAiAttempt(0);
    setFeedback(previousActiveRef.current !== duel.active ? 'התור עבר' : '');
    previousActiveRef.current = duel.active;
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
    // Runs when the picture changes (position, or a fresh deck).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.position, item.id, duel.deck]);

  const animateCorrect = useCallback((side: BattleRole) => {
    emitClockEvent(side, 'correct');
    verdict.stopAnimation();
    verdict.setValue(0);
    Animated.sequence([
      Animated.timing(verdict, { toValue: 1, duration: 120, easing: Easing.out(Easing.exp), useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(380),
      Animated.timing(verdict, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    correctGlow.stopAnimation();
    correctGlow.setValue(0);
    Animated.sequence([
      Animated.timing(correctGlow, { toValue: 1, duration: reduceMotion ? 80 : 120, useNativeDriver: false }),
      Animated.timing(correctGlow, { toValue: 0, duration: reduceMotion ? 80 : 160, useNativeDriver: false }),
    ]).start();
  }, [correctGlow, emitClockEvent, reduceMotion, verdict]);

  const animateSkip = useCallback((side: BattleRole) => {
    emitClockEvent(side, 'skip');
    if (reduceMotion) return;
    Animated.timing(imageOpacity, { toValue: 0.2, duration: 140, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [emitClockEvent, imageOpacity, reduceMotion]);

  // A wrong answer was submitted (Enter): a short side-to-side shake of the field; reduced motion gets a text hint instead.
  const animateWrong = useCallback(() => {
    if (reduceMotion) return;
    const native = Platform.OS !== 'web';
    fieldShake.stopAnimation();
    Animated.sequence([
      Animated.timing(fieldShake, { toValue: -8, duration: 45, useNativeDriver: native }),
      Animated.timing(fieldShake, { toValue: 8, duration: 60, useNativeDriver: native }),
      Animated.timing(fieldShake, { toValue: -5, duration: 55, useNativeDriver: native }),
      Animated.timing(fieldShake, { toValue: 0, duration: 45, useNativeDriver: native }),
    ]).start();
  }, [fieldShake, reduceMotion]);

  const focusInput = useCallback(() => {
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(focusTimer);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!isHumanTurn || locked) return undefined;
    return focusInput();
  }, [focusInput, isHumanTurn, locked]));

  useEffect(() => {
    if (!isHumanTurn || locked) return;
    return focusInput();
  }, [focusInput, isHumanTurn, locked]);

  // Take focus as soon as the duel opens, even on the bot's turn: on iPhone the
  // keyboard opened by the "start duel" tap then simply stays up all duel.
  useEffect(() => focusInput(), [focusInput]);

  // The duel is over: a short beat for the "time is up" sound, then the winner goes on.
  useEffect(() => {
    if (duel.winner === null || finishedRef.current) return;
    finishedRef.current = true;
    playTimeUpFeedback();
    const winnerId = duel.winner === 'attacker' ? setup.attackerId : setup.defenderId;
    const timer = setTimeout(() => onComplete(winnerId), 420);
    return () => clearTimeout(timer);
    // The sound and the completion happen once, for the first winner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.winner]);

  // The bot's turn: it "thinks" for a while, then answers, skips or tries again.
  useEffect(() => {
    if (isHumanTurn || locked) return;
    const timeout = setTimeout(() => {
      const now = Date.now();
      const current = tick(duelRef.current, now, env);
      if (current !== duelRef.current) commit(current);
      if (current.winner !== null || current.pausedUntil !== null) return;
      const side = current.active;
      const botId = side === 'attacker' ? setup.attackerId : setup.defenderId;
      if (state.players[botId].isHuman) return;
      const botItem = currentItem(current);
      const outcome = decideAiDuelOutcome(botItem.difficulty, remainingMs(current, side, now), random);
      if (outcome === 'correct') {
        commit(applyAnswer(current, botItem.answer, now, correctAnswerPauseMs(random), env).state);
        animateCorrect(side);
        playCorrectFeedback();
        setFeedback('נכון!');
      } else if (outcome === 'skip') {
        commit(applySkip(current, now, env));
        animateSkip(side);
        playSkipFeedback();
        setFeedback(`${state.players[botId].name} ${by(state.players[botId], 'דילג', 'דילגה')}: ‎−3 שניות`);
      } else {
        setAiAttempt((value) => value + 1);
      }
    }, aiThinkDelayMs(item.difficulty, random));
    return () => clearTimeout(timeout);
    // A new think-delay starts whenever the picture, the turn or the attempt changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.position, duel.active, duel.deck, aiAttempt, isHumanTurn, locked]);

  // Accepts the answer the moment it matches. Called from onChangeText and,
  // on the web, from raw DOM input/composition events (see below).
  const checkAnswer = (text: string) => {
    const current = duelRef.current;
    const side = current.active;
    if (!state.players[side === 'attacker' ? setup.attackerId : setup.defenderId].isHuman) return false;
    // A second listener may see the same keystroke: the duel is already paused after the first one, so it is a no-op.
    if (current.pausedUntil !== null || current.winner !== null) return false;
    const result = applyAnswer(current, text, Date.now(), correctAnswerPauseMs(random), env);
    if (!result.correct) return false;
    commit(result.state);
    animateCorrect(side);
    playCorrectFeedback();
    setFeedback('נכון!');
    return true;
  };
  const checkAnswerRef = useRef(checkAnswer);
  useEffect(() => {
    checkAnswerRef.current = checkAnswer;
  });

  // iPhone's Hebrew keyboard keeps the word being typed in a "composition"
  // (for its suggestions) and may only commit it on Enter, so onChangeText
  // can miss it. Listening to the raw field catches every keystroke.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const field = inputRef.current as unknown as HTMLInputElement | null;
    if (!field?.addEventListener) return;
    const onRawInput = () => { checkAnswerRef.current(field.value); };
    const events = ['input', 'compositionupdate', 'compositionend', 'keyup'] as const;
    events.forEach((name) => field.addEventListener(name, onRawInput));
    return () => events.forEach((name) => field.removeEventListener(name, onRawInput));
  }, []);

  const handleAnswerChange = (nextAnswer: string) => {
    if (!isHumanTurn || locked) return;
    setAnswer(nextAnswer);
    checkAnswer(nextAnswer);
  };

  // A short message that clears itself, e.g. when skip is tapped on the bot's turn.
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHint = (text: string) => {
    setFeedback(text);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setFeedback((current) => (current === text ? '' : current)), 1600);
  };
  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);

  const skip = () => {
    const current = duelRef.current;
    if (current.pausedUntil !== null || current.winner !== null) return;
    if (!isHumanTurn) {
      showHint('אפשר לדלג רק בתור שלך');
      return;
    }
    // Tapping the button would otherwise take focus and close the keyboard.
    inputRef.current?.focus();
    commit(applySkip(current, Date.now(), env));
    animateSkip(current.active);
    playSkipFeedback();
    setFeedback('דילגת: ‎−3 שניות');
  };
  const skipRef = useRef(skip);
  useEffect(() => {
    skipRef.current = skip;
  });

  // iPhone Safari: a normal tap first moves focus off the answer field, the
  // keyboard starts closing, the layout jumps and the tap is cancelled – so
  // skip needed two taps. Acting on touch-down and cancelling the default
  // keeps the keyboard open and skips on the first tap.
  // Safari does not always deliver the same events, so the button listens to touchstart, pointerdown,
  // mousedown and (as a last resort) click; the tap gate makes one tap skip once. A callback ref attaches
  // the listeners whenever the button element appears, not just on the first render.
  const [skipGate] = useState(() => createTapGate());
  const skipListenersRef = useRef<(() => void) | null>(null);
  const setSkipButton = useCallback((node: ComponentRef<typeof View> | null) => {
    skipListenersRef.current?.();
    skipListenersRef.current = null;
    if (Platform.OS !== 'web') return;
    const button = node as unknown as HTMLElement | null;
    if (!button?.addEventListener) return;
    const onDown = (event: Event) => {
      event.preventDefault();
      if (skipGate.down(Date.now())) skipRef.current();
    };
    const onClick = (event: Event) => {
      event.preventDefault();
      if (skipGate.click(Date.now())) skipRef.current();
    };
    button.addEventListener('touchstart', onDown, { passive: false });
    button.addEventListener('pointerdown', onDown);
    button.addEventListener('mousedown', onDown);
    button.addEventListener('click', onClick);
    skipListenersRef.current = () => {
      button.removeEventListener('touchstart', onDown);
      button.removeEventListener('pointerdown', onDown);
      button.removeEventListener('mousedown', onDown);
      button.removeEventListener('click', onClick);
    };
  }, [skipGate]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ android: 'height', ios: 'padding' })}
      style={[styles.screen, compact && styles.screenCompact, fixedBox]}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.miniMapPosition}>
          <ArenaBattleMiniMap
            compact={compact}
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
          <SoundIcon muted={muted} />
        </Pressable>
        <AppText numberOfLines={1} style={[styles.title, compact && styles.titleCompact]} weight="black">{category.name}</AppText>
        <AppText style={styles.wayLine} weight="bold">{way.label}</AppText>
      </View>

      <BattleClockCards
        attackerBonus={setup.attackerUsesBonus}
        attackerAvatar={attacker.avatar}
        attackerTotalMs={setup.attackerSeconds * 1000}
        attackerEvent={clockEvents.attacker}
        attackerLabel={`${attacker.isHuman ? by(attacker, 'אתה', 'את') : attacker.name} · ${by(attacker, 'תוקף', 'תוקפת')}`}
        compact={compact}
        defenderBonus={setup.defenderUsesBonus}
        defenderAvatar={defender.avatar}
        defenderTotalMs={setup.defenderSeconds * 1000}
        defenderEvent={clockEvents.defender}
        defenderLabel={`${defender.isHuman ? by(defender, 'אתה', 'את') : defender.name} · ${by(defender, 'מגן', 'מגנה')}`}
        duel={duel}
        onDangerTick={playDangerTick}
      />

      {compact ? null : (
        <View style={styles.turnPill}>
          <AppText style={styles.turnText} weight="black">
            {isHumanTurn ? 'התור שלך · הקלידו את התשובה' : `התור של ${activePlayer.name}`}
          </AppText>
        </View>
      )}

      <View style={styles.pictureWrap}>
      <FittedPicture
        Card={Animated.View as never}
        cardStyle={{
          borderColor: correctGlow.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.territoryMeBorder, colors.correct],
          }),
          opacity: imageOpacity,
          transform: [{ scale: imageScale }],
        } as never}
        fallback={<AppText accessibilityLabel="פריט לזיהוי" style={styles.visual}>{item.visual}</AppText>}
        minHeight={compact ? 64 : 140}
        source={itemImage}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.verdict, {
          opacity: verdict,
          transform: [{ scale: verdict.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}>
        <AppText style={styles.verdictText} weight="black">נכון!</AppText>
      </Animated.View>
      </View>

      <AppText accessibilityLiveRegion="polite" style={styles.feedback} weight="bold">
        {feedback || (compact
          ? (isHumanTurn ? 'התור שלך · הקלידו את התשובה' : `התור של ${activePlayer.name}`)
          : (isHumanTurn ? 'זהו את מה שמופיע בתמונה' : `${activePlayer.name} ${by(activePlayer, 'חושב', 'חושבת')}…`))}
      </AppText>

      <View style={styles.controls}>
        <View style={styles.inputRow}>
          <Animated.View style={[styles.fieldWrap, { transform: [{ translateX: fieldShake }] }]}>
          <TextInput
            ref={inputRef}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityHint="התשובה נבדקת אוטומטית בזמן ההקלדה"
            accessibilityLabel="תשובה"
            // Enter never closes the keyboard; it only re-checks the answer.
            blurOnSubmit={false}
            submitBehavior="submit"
            onSubmitEditing={() => {
              if (checkAnswer(answer) || !answer.trim() || !isHumanTurn || locked) return;
              if (reduceMotion) showHint('לא נכון, נסו שוב');
              else animateWrong();
            }}
            onChangeText={handleAnswerChange}
            spellCheck={false}
            autoComplete="off"
            placeholder={isHumanTurn ? 'הקלידו תשובה…' : `התור של ${activePlayer.name}`}
            placeholderTextColor={isHumanTurn ? colors.inkSoft : colors.textSecondary}
            maxFontSizeMultiplier={1.3}
            returnKeyType="done"
            selectionColor={colors.success}
            style={[styles.input, !isHumanTurn && styles.inputInactive]}
            textAlign="right"
            value={answer}
          />
          </Animated.View>
          {/* Skip sits beside the field, so the iPhone keyboard bar never hides it. */}
          <Pressable
            ref={setSkipButton}
            accessibilityLabel="דילוג על התמונה, מינוס 3 שניות"
            accessibilityRole="button"
            disabled={locked}
            focusable={false}
            // On web the raw touch/mouse listeners above do the skip.
            onPress={Platform.OS === 'web' ? undefined : skip}
            style={[styles.skipButton, (!isHumanTurn || locked) && styles.disabledControl]}>
            <AppText style={styles.skipText} weight="black">דילוג</AppText>
            <AppText style={styles.skipPenalty} weight="bold">‎−3 שנ׳</AppText>
          </Pressable>
        </View>
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
    backgroundColor: colors.screen,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  screenCompact: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  header: { minHeight: 70, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  headerCompact: { minHeight: 44, marginBottom: spacing.xs },
  miniMapPosition: { position: 'absolute', left: 0, top: 0 },
  muteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 44,
    height: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayLine: { color: colors.success, fontSize: typeScale.caption, textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, textAlign: 'center', marginTop: spacing.xs },
  titleCompact: { fontSize: 18, lineHeight: 22, marginTop: 0, maxWidth: '62%' },
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
  // The picture takes all the free height and is never cropped ("contain");
  // a dark card keeps the letterbox bars quiet instead of a white frame.
  imageCard: {
    flex: 1,
    width: '100%',
    minHeight: 140,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.territoryMeBorder,
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageCardCompact: { minHeight: 64 },
  // Absolutely positioned: the picture can never push the panel (or the answer row) around, whatever its size.
  imageFill: { position: 'absolute', top: spacing.xs, bottom: spacing.xs, left: spacing.xs, right: spacing.xs },
  itemImage: { width: '100%', height: '100%', borderRadius: radii.control },
  visual: { color: colors.bg, fontSize: 84, lineHeight: 100, textAlign: 'center' },
  pictureWrap: { flex: 1, width: '100%' },
  fieldWrap: { flex: 1 },
  // Big confirmation over the picture while the clocks are paused after a right answer.
  verdict: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  verdictText: {
    color: colors.correct,
    fontSize: 40,
    lineHeight: 48,
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  feedback: { minHeight: 20, color: colors.textSecondary, fontSize: typeScale.caption, textAlign: 'center', marginVertical: spacing.xs },
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
  skipButton: {
    width: 76,
    height: 52,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { color: colors.accentGold, fontSize: typeScale.body, lineHeight: 18, textAlign: 'center' },
  skipPenalty: { color: colors.accentGold, fontSize: typeScale.caption, lineHeight: 15, textAlign: 'center' },
  disabledControl: { opacity: 0.5 },
});
