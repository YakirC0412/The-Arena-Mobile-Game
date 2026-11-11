import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ITEM_IMAGES } from '@/content/item-images';
import { AppText as Text } from '@/design/app-text';
import { colors, radii, spacing } from '@/design/tokens';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import type { GuideVisualKey } from './guide-pages';

// The small animated pictures of the guide. Each one loops through a few steps; with "Reduce Motion" it shows
// its last, most explanatory step and stays still. Column 0 is on the left, like on the real arena.

function useLoopStep(length: number, intervalMs: number) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) {
      setStep(length - 1);
      return undefined;
    }
    const timer = setInterval(() => setStep((current) => (current + 1) % length), intervalMs);
    return () => clearInterval(timer);
  }, [reduced, length, intervalMs]);
  return step;
}

type CellKind = 'floor' | 'me' | 'target' | 'gold' | 'faded';

function MiniBoard({ kindOf, markOf }: { kindOf: (index: number) => CellKind; markOf?: (index: number) => string | undefined }) {
  return (
    <View style={styles.board}>
      {Array.from({ length: 16 }, (_, index) => (
        <View key={index} style={[styles.cell, CELL_STYLES[kindOf(index)]]}>
          {markOf?.(index) ? <Text style={styles.cellMark}>{markOf(index)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function ArenaVisual() {
  const step = useLoopStep(26, 130);
  return <MiniBoard kindOf={(i) => (i === 5 ? 'me' : i < step ? 'floor' : 'faded')} />;
}

// The cursor jumps between squares and lands on the chosen one.
const DRAW_PATH = [11, 2, 14, 7, 0, 9, 13, 4, 10, 1, 6, 5, 5, 5, 5];
function DrawVisual() {
  const step = useLoopStep(DRAW_PATH.length, 260);
  const landed = step >= 11;
  return (
    <View style={styles.centered}>
      <MiniBoard kindOf={(i) => (i === DRAW_PATH[step] ? (landed ? 'gold' : 'me') : 'floor')} />
      <Text style={styles.caption} weight="bold">{landed ? 'נבחר!' : 'מי יוצא לתקוף?'}</Text>
    </View>
  );
}

function NeighborsVisual() {
  const step = useLoopStep(2, 700);
  const neighbors = [1, 4, 6, 9];
  const diagonals = [0, 2, 8, 10];
  return (
    <View style={styles.centered}>
      <MiniBoard
        kindOf={(i) => (i === 5 ? 'gold' : neighbors.includes(i) && step === 1 ? 'target' : 'floor')}
        markOf={(i) => (diagonals.includes(i) ? '✕' : undefined)}
      />
      <Text style={styles.caption} weight="bold">רק ארבעה כיוונים, בלי אלכסון</Text>
    </View>
  );
}

function ClockCard({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <View style={[styles.clockCard, active && styles.clockCardActive]}>
      <Text style={styles.clockLabel} weight="bold">{label}</Text>
      <Text style={[styles.clockValue, !active && styles.clockValueMuted]} weight="black">{value}</Text>
    </View>
  );
}

function PictureCard({ imageKey }: { imageKey: string }) {
  const source = ITEM_IMAGES[imageKey];
  return (
    <View style={styles.pictureCard}>
      {source ? <Image resizeMode="contain" source={source} style={styles.picture} /> : null}
    </View>
  );
}

// You identify the picture while your clock runs; the answer is accepted as soon as it matches.
function DuelVisual() {
  const step = useLoopStep(9, 650);
  const typed = 'אריה'.slice(0, Math.min(step, 4));
  const correct = step >= 5;
  return (
    <View style={styles.duel}>
      <View style={styles.clockRow}>
        <ClockCard active label="אתה" value={(40 - Math.min(step, 5) * 1.6).toFixed(1)} />
        <ClockCard label="יריב" value="40.0" />
      </View>
      <PictureCard imageKey="animals-1" />
      <View style={[styles.field, correct && styles.fieldCorrect]}>
        <Text style={[styles.fieldText, correct && styles.fieldTextCorrect]} weight="bold">{correct ? 'נכון!' : typed || '…'}</Text>
      </View>
    </View>
  );
}

// Skip: new picture, and 3 seconds off your clock.
function SkipVisual() {
  const step = useLoopStep(4, 900);
  const skipped = step >= 2;
  return (
    <View style={styles.duel}>
      <View style={styles.clockRow}>
        <ClockCard active label="אתה" value={skipped ? '28.2' : '31.2'} />
        <ClockCard label="יריב" value="40.0" />
      </View>
      <PictureCard imageKey={skipped ? 'animals-2' : 'animals-1'} />
      <View style={styles.skipRow}>
        {skipped ? <Text style={styles.penalty} weight="black">‎−3 שניות</Text> : null}
        <View style={[styles.skipButton, step === 1 && styles.skipButtonPressed]}>
          <Text style={styles.skipText} weight="black">דילוג</Text>
        </View>
      </View>
    </View>
  );
}

// The loser's squares turn into the winner's squares.
function ConquestVisual() {
  const step = useLoopStep(5, 800);
  const winner = [5, 6];
  const loser = [9, 10];
  return (
    <View style={styles.centered}>
      <MiniBoard
        kindOf={(i) => (winner.includes(i) || (i === 9 && step >= 2) || (i === 10 && step >= 3)
          ? 'me'
          : loser.includes(i) ? 'gold' : 'floor')}
      />
      <Text style={styles.caption} weight="bold">{step >= 2 ? 'השטח עבר למנצח' : 'המפסיד מודח'}</Text>
    </View>
  );
}

function BonusVisual() {
  const step = useLoopStep(7, 700);
  return (
    <View style={styles.centered}>
      <View style={styles.winRow}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.winDot, step >= n && styles.winDotLit]}>
            <Text style={[styles.winDotText, step >= n && styles.winDotTextLit]} weight="black">{step >= n ? '✓' : n}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.bonusChip, step < 4 && styles.hidden]}>
        <Text style={styles.bonusText} weight="black">+5 שניות · 45 במקום 40</Text>
      </View>
    </View>
  );
}

function FinalVisual() {
  const step = useLoopStep(4, 900);
  return (
    <View style={styles.centered}>
      <Text style={[styles.crown, step < 2 && styles.crownDim]}>♛</Text>
      <View style={styles.finalRow}>
        <View style={[styles.finalCell, styles.finalMe]} />
        <View style={[styles.finalCell, step >= 2 && styles.finalLost]} />
      </View>
      <Text style={styles.caption} weight="bold">שני אחרונים · 15 דו־קרבות · אלוף אחד</Text>
    </View>
  );
}

const VISUALS: Record<GuideVisualKey, () => React.JSX.Element> = {
  arena: ArenaVisual,
  draw: DrawVisual,
  neighbors: NeighborsVisual,
  duel: DuelVisual,
  skip: SkipVisual,
  conquest: ConquestVisual,
  bonus: BonusVisual,
  final: FinalVisual,
};

export function GuideVisual({ type }: { type: GuideVisualKey }) {
  const Visual = VISUALS[type];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.box}>
      <Visual />
    </View>
  );
}

const CELL = 22;
const styles = StyleSheet.create({
  box: { height: 178, borderRadius: 20, backgroundColor: colors.surfaceMuted, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, overflow: 'hidden' },
  centered: { alignItems: 'center', gap: spacing.sm },
  caption: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', writingDirection: 'rtl' },
  board: { width: CELL * 4 + 4 * 3, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: CELL, height: CELL, borderRadius: radii.cell, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cellMark: { color: colors.textSecondary, fontSize: 12, lineHeight: 14 },
  duel: { width: '100%', paddingHorizontal: spacing.md, gap: 6 },
  clockRow: { flexDirection: 'row-reverse', gap: spacing.sm },
  clockCard: { flex: 1, minHeight: 44, borderRadius: radii.control, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  clockCardActive: { borderColor: colors.success },
  clockLabel: { color: colors.textSecondary, fontSize: 12, lineHeight: 14 },
  clockValue: { color: colors.textPrimary, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  clockValueMuted: { color: colors.textSecondary },
  pictureCard: { height: 64, borderRadius: radii.control, borderWidth: 2, borderColor: colors.territoryMeBorder, backgroundColor: colors.surface, padding: 3 },
  picture: { width: '100%', height: '100%', borderRadius: 8 },
  field: { height: 30, borderRadius: radii.control, borderWidth: 2, borderColor: colors.success, backgroundColor: colors.textPrimary, justifyContent: 'center', paddingHorizontal: spacing.md },
  fieldCorrect: { borderColor: colors.correct, backgroundColor: colors.correct },
  fieldText: { color: colors.bg, fontSize: 14, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  fieldTextCorrect: { textAlign: 'center' },
  skipRow: { height: 34, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  skipButton: { minWidth: 76, height: 34, borderRadius: radii.control, borderWidth: 2, borderColor: colors.accentGold, alignItems: 'center', justifyContent: 'center' },
  skipButtonPressed: { backgroundColor: colors.accentGold, transform: [{ scale: 0.94 }] },
  skipText: { color: colors.accentGold, fontSize: 14, lineHeight: 18 },
  penalty: { color: colors.accentGold, fontSize: 16, lineHeight: 20, writingDirection: 'rtl' },
  winRow: { flexDirection: 'row-reverse', gap: spacing.md },
  winDot: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  winDotLit: { borderColor: colors.correct, backgroundColor: colors.correct },
  winDotText: { color: colors.textSecondary, fontSize: 18, lineHeight: 22 },
  winDotTextLit: { color: colors.bg },
  bonusChip: { borderRadius: radii.pill, backgroundColor: colors.accentGold, paddingHorizontal: spacing.md, paddingVertical: 6 },
  bonusText: { color: colors.bg, fontSize: 14, lineHeight: 18, writingDirection: 'rtl' },
  hidden: { opacity: 0 },
  crown: { color: colors.accentGold, fontSize: 34, lineHeight: 40 },
  crownDim: { opacity: 0.35 },
  finalRow: { flexDirection: 'row', gap: spacing.md },
  finalCell: { width: 62, height: 62, borderRadius: radii.card, borderWidth: 2, backgroundColor: colors.arenaFloor, borderColor: colors.arenaFloorBorder },
  finalMe: { backgroundColor: colors.territoryMeEnd, borderColor: colors.territoryMeBorder },
  finalLost: { opacity: 0.35 },
});

// One look per kind of square, the same colors as the real arena: floor, me (light blue), selected (gold).
const CELL_STYLES: Record<CellKind, { backgroundColor: string; borderColor: string; opacity?: number }> = {
  floor: { backgroundColor: colors.arenaFloor, borderColor: colors.arenaFloorBorder },
  me: { backgroundColor: colors.territoryMeEnd, borderColor: colors.territoryMeBorder },
  target: { backgroundColor: colors.territoryTarget, borderColor: colors.territoryTargetBorder },
  gold: { backgroundColor: colors.territorySelected, borderColor: colors.territorySelected },
  faded: { backgroundColor: colors.arenaFloor, borderColor: colors.arenaFloorBorder, opacity: 0.2 },
};
