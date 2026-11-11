import { by } from '@/game/gender';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { ITEM_IMAGES } from '@/content/item-images';
import { AppText } from '@/design/app-text';
import { ArenaBattleMiniMap } from '@/features/arena/arena-battle-mini-map';
import { ClockCard, type ClockEvent } from '@/features/battle/battle-clock-cards';
import { SoundIcon } from '@/features/battle/sound-icon';
import { useReducedMotion } from '@/design/use-reduced-motion';
import type { GameState } from '@/game/types';
import { colors, fontFamilies, layout, radii, spacing, typeScale } from '@/design/tokens';
import { isTouchWeb } from '@/design/keyboard-primer';
import { useWebViewportBox } from '@/design/use-web-viewport-box';
import { FittedPicture } from '@/features/battle/fitted-picture';
import { createTapGate } from '@/features/battle/tap-gate';
import type { OnlineView } from '@/game/online-view';
import { clockLeftMs } from '@/online/view-to-state';

// The live duel as a phone sees it online: the server sends the picture and the clocks, this screen only shows them,
// sends what the player types and "skip". Spectators (and a seat whose bot is playing) see the same without the input.
type Props = {
  view: OnlineView;
  // When this phone received `view` (Date.now()).
  receivedAt: number;
  // Which side this phone plays (null = watching).
  mySide: 'attacker' | 'defender' | null;
  send: (type: string, payload?: object) => void;
  // Called with true when the server confirms a right answer.
  onSkipFeedback?: () => void;
  // The board (for the mini-map), how many right answers the server confirmed for this phone, and the sound switch.
  state: GameState;
  correctCount: number;
  muted: boolean;
  onToggleMuted: () => void;
};

const formatClock = (ms: number) => (Math.max(0, ms) / 1000).toFixed(1);

export function OnlineDuel({ view, receivedAt, mySide, send, onSkipFeedback, state, correctCount, muted, onToggleMuted }: Props) {
  const duel = view.duel!;
  const setup = view.setup!;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  // Always sized to the visible area: on iPhone the page height is not the visible height while Safari's toolbars show.
  const viewportBox = useWebViewportBox(true);
  const { height: windowHeight } = useWindowDimensions();
  // A player on a phone always gets the compact layout (the keyboard is up for the whole duel); see isTouchWeb.
  const compact = (viewportBox ? viewportBox.height : windowHeight) < 600 || (mySide !== null && isTouchWeb());
  const fixedBox = viewportBox
    ? ({
      position: 'fixed', top: viewportBox.top, left: 0, right: 0, height: viewportBox.height,
      marginHorizontal: 'auto', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)',
    } as never)
    : null;

  const attacker = view.players.find((player) => player.id === setup.attackerId)!;
  const defender = view.players.find((player) => player.id === setup.defenderId)!;
  const activeId = duel.active === 'attacker' ? attacker.id : defender.id;
  const activeName = duel.active === 'attacker' ? attacker.name : defender.name;
  const myTurn = mySide !== null && mySide === duel.active && !duel.winner;
  const running = !duel.paused && !duel.winner;
  const left = (side: 'attacker' | 'defender') =>
    clockLeftMs(duel.remainingMs[side], receivedAt, now, running && duel.active === side);

  // --- answer field ---
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [answer, setAnswer] = useState('');
  useEffect(() => setAnswer(''), [duel.itemId]);
  const onChange = (text: string) => {
    setAnswer(text);
    if (myTurn && text.trim()) send('answer', { text });
  };

  // The answer field takes focus when the duel opens and keeps it for the whole duel (also while the other side plays),
  // so the iPhone keyboard stays up and nothing jumps when the turn comes to you. iOS only honours this after a tap
  // (the keyboard is primed by the tap that led here); otherwise any tap on the picture opens it.
  useEffect(() => {
    if (!mySide) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [mySide, myTurn]);

  // ---- feedback, the same as the local duel: "-3" on a skip, a big "נכון!" and a bump on a right answer, a shake on a wrong one ----
  const reduceMotion = useReducedMotion();
  const [clockEvents, setClockEvents] = useState<Record<'attacker' | 'defender', ClockEvent>>({ attacker: null, defender: null });
  const eventKeyRef = useRef(0);
  const ownEventAtRef = useRef(0);
  const [verdict] = useState(() => new Animated.Value(0));
  const [fieldShake] = useState(() => new Animated.Value(0));
  const [wrong, setWrong] = useState(false);
  const native = Platform.OS !== 'web';
  const showVerdict = () => {
    verdict.stopAnimation();
    verdict.setValue(0);
    Animated.sequence([
      Animated.timing(verdict, { toValue: 1, duration: 120, easing: Easing.out(Easing.exp), useNativeDriver: native }),
      Animated.delay(380),
      Animated.timing(verdict, { toValue: 0, duration: 180, useNativeDriver: native }),
    ]).start();
  };
  const emit = (side: 'attacker' | 'defender', kind: 'skip' | 'correct') => {
    eventKeyRef.current += 1;
    const event = { key: eventKeyRef.current, kind };
    setClockEvents((current) => ({ ...current, [side]: event }));
    if (kind === 'correct') showVerdict();
  };
  // My own right answer: the server confirms it at once.
  const correctSeenRef = useRef(correctCount);
  useEffect(() => {
    if (correctCount === correctSeenRef.current) return;
    correctSeenRef.current = correctCount;
    if (mySide) {
      ownEventAtRef.current = Date.now();
      emit(mySide, 'correct');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctCount]);
  // The other side's skip or right answer shows when the next picture arrives: same turn = a skip, turn passed = a right answer.
  const previousRef = useRef({ itemId: duel.itemId, active: duel.active });
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { itemId: duel.itemId, active: duel.active };
    if (previous.itemId === duel.itemId) return;
    if (Date.now() - ownEventAtRef.current < 2500) return;
    emit(previous.active, previous.active === duel.active ? 'skip' : 'correct');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.itemId]);
  const itemRef = useRef(duel.itemId);
  itemRef.current = duel.itemId;
  const onWrongSubmit = () => {
    const submittedItem = duel.itemId;
    setTimeout(() => {
      if (itemRef.current !== submittedItem) return;
      setWrong(true);
      setTimeout(() => setWrong(false), 700);
      if (reduceMotion) return;
      fieldShake.stopAnimation();
      Animated.sequence([
        Animated.timing(fieldShake, { toValue: -8, duration: 45, useNativeDriver: native }),
        Animated.timing(fieldShake, { toValue: 8, duration: 60, useNativeDriver: native }),
        Animated.timing(fieldShake, { toValue: -5, duration: 55, useNativeDriver: native }),
        Animated.timing(fieldShake, { toValue: 0, duration: 45, useNativeDriver: native }),
      ]).start();
    }, 500);
  };

  const skip = () => {
    if (!myTurn || duel.paused) return;
    inputRef.current?.focus();
    send('skip');
    onSkipFeedback?.();
    if (mySide) {
      ownEventAtRef.current = Date.now();
      emit(mySide, 'skip');
    }
  };
  const skipRef = useRef(skip);
  useEffect(() => {
    skipRef.current = skip;
  });
  const [skipGate] = useState(() => createTapGate());
  const skipListenersRef = useRef<(() => void) | null>(null);
  // iPhone Safari: act on touch-down so the first tap works while the keyboard is up (same as the local duel).
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

  const image = duel.imageKey ? ITEM_IMAGES[duel.imageKey] : undefined;

  const clockCard = (side: 'attacker' | 'defender') => {
    const player = side === 'attacker' ? attacker : defender;
    const mine = mySide === side;
    const role = side === 'attacker' ? by(player, 'תוקף', 'תוקפת') : by(player, 'מגן', 'מגנה');
    return (
      <ClockCard
        active={duel.active === side && !duel.winner}
        avatar={player.avatar}
        bonus={side === 'attacker' ? setup.attackerUsesBonus : setup.defenderUsesBonus}
        compact={compact}
        event={clockEvents[side]}
        label={`${mine ? by(player, 'אתה', 'את') : player.name} · ${role}`}
        milliseconds={left(side)}
        totalMs={(side === 'attacker' ? setup.attackerSeconds : setup.defenderSeconds) * 1000}
      />
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ android: 'height', ios: 'padding' })} style={[styles.screen, compact && styles.screenCompact, fixedBox]}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.miniMapPosition}>
          <ArenaBattleMiniMap attackerId={setup.attackerId} compact={compact} defenderId={setup.defenderId} state={state} />
        </View>
        <Pressable
          accessibilityLabel={muted ? 'הפעלת צלילים' : 'השתקת צלילים'}
          accessibilityRole="button"
          onPress={onToggleMuted}
          style={styles.muteButton}>
          <SoundIcon muted={muted} />
        </Pressable>
        {compact ? null : <AppText style={styles.eyebrow} weight="bold">{setup.isFinal ? '🏆 הגמר' : `דו־קרב ${view.duels + 1} מתוך 15`}</AppText>}
        <AppText numberOfLines={1} style={[styles.title, compact && styles.titleCompact]} weight="black">{setup.categoryName}</AppText>
        <AppText style={styles.wayLine} weight="bold">{setup.wayLabel}</AppText>
      </View>

      <View style={styles.clocks}>
        {clockCard('attacker')}
        {clockCard('defender')}
      </View>

      {compact && mySide ? null : <View style={styles.turnPill}>
        <AppText style={styles.turnText} weight="black">
          {duel.winner ? 'הדו־קרב נגמר' : myTurn ? 'התור שלך · הקלידו את התשובה' : mySide ? `התור של ${activeName}` : `👁 צופים · התור של ${activeName}`}
        </AppText>
      </View>}

      <Pressable accessible={false} focusable={false} onPress={() => inputRef.current?.focus()} style={styles.pictureTap}>
        <FittedPicture
          cardStyle={duel.paused ? { borderColor: colors.correct } : undefined}
          fallback={<AppText style={styles.visual}>❔</AppText>}
          minHeight={compact ? 64 : 140}
          source={image}
        />
      </Pressable>

      {mySide ? (
        <View style={styles.inputRow}>
          <Animated.View style={[styles.fieldWrap, { transform: [{ translateX: fieldShake }] }]}>
          <TextInput
            ref={inputRef}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="תשובה"
            autoComplete="off"
            blurOnSubmit={false}
            editable={!duel.winner}
            maxFontSizeMultiplier={1.3}
            onChangeText={onChange}
            onSubmitEditing={() => {
              if (!myTurn || !answer.trim()) return;
              send('answer', { text: answer });
              onWrongSubmit();
            }}
            placeholder={myTurn ? 'הקלידו תשובה…' : `התור של ${activeName}`}
            placeholderTextColor={myTurn ? colors.inkSoft : colors.textSecondary}
            returnKeyType="done"
            selectionColor={colors.success}
            spellCheck={false}
            style={[styles.input, !myTurn && styles.inputInactive, wrong && styles.inputWrong]}
            submitBehavior="submit"
            textAlign="right"
            value={answer}
          />
          </Animated.View>
          <Pressable
            ref={setSkipButton}
            accessibilityLabel="דילוג על התמונה, מינוס 3 שניות"
            accessibilityRole="button"
            focusable={false}
            onPress={Platform.OS === 'web' ? undefined : skip}
            style={[styles.skipButton, (!myTurn || duel.paused) && styles.disabled]}>
            <AppText style={styles.skipText} weight="black">דילוג</AppText>
            <AppText style={styles.skipPenalty} weight="bold">‎−3 שנ׳</AppText>
          </Pressable>
        </View>
      ) : (
        <AppText style={styles.watchNote}>{activeId ? `${activeName} ${by(duel.active === 'attacker' ? attacker : defender, 'משחק', 'משחקת')} עכשיו` : ''}</AppText>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', backgroundColor: colors.screen, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  screenCompact: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  header: { alignItems: 'center', marginBottom: spacing.sm },
  // Short visible area (keyboard up): title and way share one line so the picture keeps the room.
  headerCompact: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: spacing.sm, marginBottom: spacing.xs },
  eyebrow: { color: colors.accentGold, fontSize: typeScale.caption, textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  titleCompact: { fontSize: 18, lineHeight: 22 },
  wayLine: { color: colors.success, fontSize: typeScale.caption, textAlign: 'center' },
  clocks: { flexDirection: 'row-reverse', gap: spacing.sm },
  clock: { flex: 1, borderRadius: radii.control, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.sm, alignItems: 'center', gap: 2 },
  clockCompact: { paddingVertical: spacing.xs, gap: 0 },
  clockValueRow: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: spacing.sm },
  clockValueCompact: { fontSize: 26, lineHeight: 30 },
  clockActive: { borderColor: colors.accentGold, backgroundColor: colors.surfaceMuted },
  clockWinner: { borderColor: colors.correct },
  clockWho: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  clockName: { color: colors.textPrimary, fontSize: typeScale.body, flexShrink: 1 },
  clockValue: { color: colors.textPrimary, fontSize: 34, lineHeight: 40, textAlign: 'center' },
  clockRole: { color: colors.textSecondary, fontSize: typeScale.caption, textAlign: 'center' },
  turnPill: { alignSelf: 'center', minHeight: 34, backgroundColor: colors.success, borderRadius: radii.pill, paddingHorizontal: spacing.lg, justifyContent: 'center', marginVertical: spacing.sm },
  turnText: { color: colors.bg, fontSize: typeScale.caption, textAlign: 'center' },
  imageCard: { flex: 1, width: '100%', minHeight: 140, borderRadius: radii.card, backgroundColor: colors.surfaceMuted, borderWidth: 2, borderColor: colors.territoryMeBorder, padding: spacing.xs, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imageCardCompact: { minHeight: 64 },
  miniMapPosition: { position: 'absolute', left: 0, top: 0 },
  muteButton: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  fieldWrap: { flex: 1 },
  inputWrong: { borderColor: colors.danger },
  verdict: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  verdictText: { color: colors.correct, fontSize: 40, lineHeight: 48, textShadowColor: colors.bg, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  pictureTap: { flex: 1, width: '100%' },
  imageFill: { position: 'absolute', top: spacing.xs, bottom: spacing.xs, left: spacing.xs, right: spacing.xs },
  itemImage: { width: '100%', height: '100%', borderRadius: radii.control },
  visual: { color: colors.textPrimary, fontSize: 84, lineHeight: 100, textAlign: 'center' },
  inputRow: { minHeight: 52, flexDirection: 'row-reverse', gap: spacing.sm, marginTop: spacing.sm },
  input: { flex: 1, height: 52, borderRadius: radii.control, borderWidth: 2, borderColor: colors.success, backgroundColor: colors.textPrimary, color: colors.bg, fontFamily: fontFamilies.bold, fontSize: typeScale.button, paddingHorizontal: spacing.md, writingDirection: 'rtl' },
  inputInactive: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textSecondary },
  skipButton: { width: 76, height: 52, borderRadius: radii.control, borderWidth: 2, borderColor: colors.accentGold, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: colors.accentGold, fontSize: typeScale.body, lineHeight: 18, textAlign: 'center' },
  skipPenalty: { color: colors.accentGold, fontSize: typeScale.caption, lineHeight: 15, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  watchNote: { color: colors.textSecondary, fontSize: typeScale.body, textAlign: 'center', marginTop: spacing.sm },
});
