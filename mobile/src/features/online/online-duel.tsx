import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { ITEM_IMAGES } from '@/content/item-images';
import { AppText } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { colors, fontFamilies, layout, radii, spacing, typeScale } from '@/design/tokens';
import { useWebViewportBox } from '@/design/use-web-viewport-box';
import { createTapGate } from '@/features/battle/tap-gate';
import type { OnlineView } from '@/game/online-view';
import { clockLeftMs } from '@/online/view-to-state';

// The live duel as a phone sees it online: the server sends the picture and the clocks, this screen only shows them,
// sends what the player types and "skip". Spectators (and a seat whose bot is playing) see the same without the input.
type Props = {
  view: OnlineView;
  // Which side this phone plays (null = watching).
  mySide: 'attacker' | 'defender' | null;
  send: (type: string, payload?: object) => void;
  // Called with true when the server confirms a right answer.
  onSkipFeedback?: () => void;
};

const formatClock = (ms: number) => (Math.max(0, ms) / 1000).toFixed(1);

export function OnlineDuel({ view, mySide, send, onSkipFeedback }: Props) {
  const duel = view.duel!;
  const setup = view.setup!;
  const receivedAt = useMemo(() => Date.now(), [view]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const viewportBox = useWebViewportBox();
  const { height: windowHeight } = useWindowDimensions();
  const compact = (viewportBox ? viewportBox.height : windowHeight) < 600;
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

  const skip = () => {
    if (!myTurn || duel.paused) return;
    inputRef.current?.focus();
    send('skip');
    onSkipFeedback?.();
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
    const active = duel.active === side && !duel.winner;
    const bonus = side === 'attacker' ? setup.attackerUsesBonus : setup.defenderUsesBonus;
    const ms = left(side);
    return (
      <View style={[styles.clock, active && styles.clockActive, duel.winner === side && styles.clockWinner]}>
        <View style={styles.clockWho}>
          <AvatarPortrait avatarId={player.avatar} borderColor={active ? colors.accentGold : colors.brandSky} size={compact ? 26 : 34} />
          <AppText numberOfLines={1} style={styles.clockName} weight="bold">
            {player.name}{mySide === side ? ' (אני)' : ''}
          </AppText>
        </View>
        <AppText style={[styles.clockValue, ms < 8000 && active && { color: colors.danger }]} weight="black">{formatClock(ms)}</AppText>
        <AppText style={styles.clockRole}>{side === 'attacker' ? 'תוקף' : 'מגן'}{bonus ? ' · בונוס +5' : ''}</AppText>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ android: 'height', ios: 'padding' })} style={[styles.screen, compact && styles.screenCompact, fixedBox]}>
      <View style={styles.header}>
        {compact ? null : <AppText style={styles.eyebrow} weight="bold">{setup.isFinal ? '🏆 הגמר' : `דו־קרב ${view.duels + 1} מתוך 15`}</AppText>}
        <AppText numberOfLines={1} style={[styles.title, compact && styles.titleCompact]} weight="black">{setup.categoryName}</AppText>
        <AppText style={styles.wayLine} weight="bold">{setup.wayLabel}</AppText>
      </View>

      <View style={styles.clocks}>
        {clockCard('attacker')}
        {clockCard('defender')}
      </View>

      <View style={styles.turnPill}>
        <AppText style={styles.turnText} weight="black">
          {duel.winner ? 'הדו־קרב נגמר' : myTurn ? 'התור שלך · הקלידו את התשובה' : mySide ? `התור של ${activeName}` : `👁 צופים · התור של ${activeName}`}
        </AppText>
      </View>

      <View style={[styles.imageCard, compact && styles.imageCardCompact, duel.paused && { borderColor: colors.correct }]}>
        {image ? (
          <View pointerEvents="none" style={styles.imageFill}>
            <Image accessibilityLabel="פריט לזיהוי" resizeMode="contain" source={image} style={styles.itemImage} />
          </View>
        ) : (
          <AppText style={styles.visual}>❔</AppText>
        )}
      </View>

      {mySide ? (
        <View style={styles.inputRow}>
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
            onSubmitEditing={() => myTurn && answer.trim() && send('answer', { text: answer })}
            placeholder={myTurn ? 'הקלידו תשובה…' : `התור של ${activeName}`}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            selectionColor={colors.success}
            spellCheck={false}
            style={[styles.input, !myTurn && styles.inputInactive]}
            submitBehavior="submit"
            textAlign="right"
            value={answer}
          />
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
        <AppText style={styles.watchNote}>{activeId ? `${activeName} משחק/ת עכשיו` : ''}</AppText>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', backgroundColor: colors.screen, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  screenCompact: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  header: { alignItems: 'center', marginBottom: spacing.sm },
  eyebrow: { color: colors.accentGold, fontSize: typeScale.caption, textAlign: 'center' },
  title: { color: colors.textPrimary, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  titleCompact: { fontSize: 18, lineHeight: 22 },
  wayLine: { color: colors.success, fontSize: typeScale.caption, textAlign: 'center' },
  clocks: { flexDirection: 'row', gap: spacing.sm },
  clock: { flex: 1, borderRadius: radii.control, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.sm, alignItems: 'center', gap: 2 },
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
