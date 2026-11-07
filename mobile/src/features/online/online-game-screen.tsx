import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CATEGORY_BY_ID } from '@/content/categories';
import { AppText } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandBackground, BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { colors, layout, radii, spacing, typeScale } from '@/design/tokens';
import { ArenaBoard } from '@/features/arena/arena-board';
import type { LobbyLink } from '@/features/lobby/use-lobby-link';
import type { OnlineView, ViewPlayer } from '@/game/online-view';
import { viewToGameState } from '@/online/view-to-state';
import { useGameFeedback } from '@/services/use-game-feedback';
import { OnlineDuel } from './online-duel';

// The whole online game on a phone: one screen per stage the server reports (draw, choose an opponent, the duel,
// the result, continue or return, the final, the champion). The server decides everything; this only shows it
// and sends the player's choices.
export function OnlineGameScreen({ link, onLeave }: { link: LobbyLink; onLeave: () => void }) {
  const view = link.game as OnlineView;
  const me = link.myPlayerId;
  const feedback = useGameFeedback();
  const state = useMemo(() => viewToGameState(view, me), [view, me]);
  const byId = (id: string | null): ViewPlayer | undefined => view.players.find((player) => player.id === id);
  const mine = byId(me);

  useEffect(() => {
    if (link.correctCount > 0) feedback.correct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.correctCount]);

  // A countdown for a human choice, smooth between server messages.
  const receivedAt = useMemo(() => Date.now(), [view]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const secondsLeft = view.choiceLeftMs === null ? null : Math.max(0, Math.ceil((view.choiceLeftMs - (now - receivedAt)) / 1000));

  const setup = view.setup;
  const mySide = setup && me ? (setup.attackerId === me ? 'attacker' : setup.defenderId === me ? 'defender' : null) : null;

  if (view.stage === 'duel' && view.duel && setup) {
    return (
      <BrandBackground>
        <OnlineDuel mySide={mySide} onSkipFeedback={feedback.skip} send={link.send} view={view} />
      </BrandBackground>
    );
  }

  const attackerName = byId(view.attackerId)?.name ?? '';
  const choosing = (text: string) => <AppText style={styles.wait}>{text}</AppText>;
  const left = secondsLeft !== null ? ` · ${secondsLeft} שנ׳` : '';

  let headline = '';
  let body: ReactNode = null;

  if (view.stage === 'draw') {
    headline = 'מגרילים את המתמודד הבא…';
  } else if (view.stage === 'target') {
    const mineToChoose = view.targets.length > 0 && view.attackerId === me;
    headline = mineToChoose ? `בחרו יריב להתקפה${left}` : `${attackerName} הוגרל/ה לתקוף`;
    if (!mineToChoose) body = choosing(view.targets.length === 0 && view.attackerId === me ? 'רגע…' : `${attackerName} בוחר/ת יריב…`);
  } else if (view.stage === 'final') {
    const chooser = byId(view.players.find((player) => player.isActive)?.id ?? null);
    headline = view.finalOptions.length ? `הגמר! בחרו קטגוריה${left}` : 'הגמר! הבכיר בשטח בוחר קטגוריה';
    if (view.finalOptions.length) {
      body = (
        <View style={styles.choiceRow}>
          {view.finalOptions.map((categoryId) => (
            <BrandPrimaryButton
              icon={CATEGORY_BY_ID[categoryId].icon}
              key={categoryId}
              label={CATEGORY_BY_ID[categoryId].name}
              onPress={() => link.send('pickFinalCategory', { categoryId })}
            />
          ))}
        </View>
      );
    } else if (chooser) body = choosing('הבכיר בשטח בוחר את קטגוריית הגמר…');
  } else if (view.stage === 'announce' && setup) {
    const attacker = byId(setup.attackerId)!;
    const defender = byId(setup.defenderId)!;
    headline = setup.isFinal ? '🏆 הגמר' : '⚔️ דו־קרב מתחיל';
    body = (
      <View style={styles.vs}>
        <View style={styles.vsSide}>
          <AvatarPortrait avatarId={attacker.avatar} borderColor={colors.accentGold} size={72} />
          <AppText style={styles.vsName} weight="black">{attacker.name}{attacker.id === me ? ' (אני)' : ''}</AppText>
          <AppText style={styles.vsRole}>תוקף/ת · {setup.attackerSeconds} שנ׳</AppText>
        </View>
        <AppText style={styles.vsMark} weight="black">VS</AppText>
        <View style={styles.vsSide}>
          <AvatarPortrait avatarId={defender.avatar} borderColor={colors.brandSky} size={72} />
          <AppText style={styles.vsName} weight="black">{defender.name}{defender.id === me ? ' (אני)' : ''}</AppText>
          <AppText style={styles.vsRole}>מגן/ה · {setup.defenderSeconds} שנ׳</AppText>
        </View>
        <AppText style={styles.vsCategory} weight="bold">{CATEGORY_BY_ID[setup.categoryId].icon} {setup.categoryName} · {setup.wayLabel}</AppText>
      </View>
    );
  } else if (view.stage === 'result' && view.result) {
    const winner = byId(view.result.winnerId)!;
    headline = `${winner.id === me ? '🎉 ניצחת!' : `${winner.name} ניצח/ה`}`;
    body = (
      <View style={styles.resultCard}>
        <AvatarPortrait avatarId={winner.avatar} borderColor={colors.correct} size={84} />
        <AppText style={styles.resultText} weight="bold">{view.result.summary}</AppText>
        {view.result.earnedBonus ? <AppText style={styles.bonus} weight="black">⭐ בונוס! +5 שניות בדו־קרב הבא</AppText> : null}
      </View>
    );
  } else if (view.stage === 'after') {
    const mineToChoose = view.attackerId === me && view.choiceLeftMs !== null;
    headline = mineToChoose ? `להמשיך לתקוף?${left}` : `${attackerName} מחליט/ה אם להמשיך…`;
    if (mineToChoose) {
      body = (
        <View style={styles.choiceRow}>
          <BrandPrimaryButton icon="⚔️" label="להמשיך לתקוף" onPress={() => link.send('continue')} />
          <BrandSecondaryButton icon="🏠" label="לחזור לזירה" onPress={() => link.send('return')} />
        </View>
      );
    }
  } else if (view.stage === 'done') {
    const champion = byId(view.championId);
    const iWon = !!champion && champion.id === me;
    headline = iWon ? '🏆 אתם האלופים!' : '🏆 יש אלוף!';
    body = (
      <View style={styles.resultCard}>
        {champion ? <AvatarPortrait avatarId={champion.avatar} borderColor={colors.accentGold} size={96} /> : null}
        <AppText style={styles.resultText} weight="black">{champion ? `${champion.name} כבש/ה את כל הזירה` : ''}</AppText>
        {champion ? <AppText style={styles.vsRole}>{CATEGORY_BY_ID[champion.categoryId]?.icon} {CATEGORY_BY_ID[champion.categoryId]?.name}</AppText> : null}
        {champion?.isHuman ? <AppText style={styles.vsRole}>הניצחון נרשם בטבלת המובילים</AppText> : null}
      </View>
    );
  }

  const boardMode = view.stage === 'target' && view.targets.length > 0 && view.attackerId === me ? 'select-target' : 'overview';
  const highlighted = view.stage === 'announce' && setup ? setup.defenderId : view.attackerId;

  return (
    <BrandBackground>
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <AppText style={styles.topText} weight="bold">
            {view.stage === 'done' ? 'המשחק נגמר' : `דו־קרב ${Math.min(view.duels + 1, 15)} מתוך 15 · סיבוב ${view.round}`}
          </AppText>
          <Pressable accessibilityRole="button" onPress={onLeave} style={styles.leave}>
            <AppText style={styles.leaveText} weight="bold">{view.stage === 'done' ? 'סיום' : 'יציאה'}</AppText>
          </Pressable>
        </View>

        {mine && !mine.isActive && view.stage !== 'done' ? (
          <AppText style={styles.eliminated} weight="bold">הודחת מהזירה 😔 אפשר להמשיך לצפות עד שיש אלוף</AppText>
        ) : null}
        {!me ? <AppText style={styles.eliminated} weight="bold">👁 אתם צופים במשחק</AppText> : null}

        <AppText accessibilityRole="header" style={styles.headline} weight="black">{headline}</AppText>

        <View style={styles.boardWrap}>
          <ArenaBoard
            meId={me}
            mode={boardMode}
            onSelectTarget={(targetId) => link.send('pickTarget', { targetId })}
            selectedId={highlighted}
            state={state}
            targetIds={boardMode === 'select-target' ? view.targets : []}
          />
        </View>

        <View style={styles.bottom}>{body}</View>
      </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  topText: { color: colors.textSecondary, fontSize: typeScale.body },
  leave: { minHeight: layout.minTouchTarget, minWidth: 64, borderRadius: radii.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  leaveText: { color: colors.textSecondary, fontSize: typeScale.body },
  eliminated: { color: colors.accentGold, fontSize: typeScale.body, textAlign: 'center' },
  headline: { color: colors.textPrimary, fontSize: typeScale.sectionTitle, lineHeight: 28, textAlign: 'center' },
  boardWrap: { width: '100%' },
  bottom: { gap: spacing.md, alignItems: 'center' },
  wait: { color: colors.textSecondary, fontSize: typeScale.button, textAlign: 'center' },
  choiceRow: { width: '100%', gap: spacing.sm },
  vs: { width: '100%', flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-around', alignItems: 'center', gap: spacing.sm },
  vsSide: { alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  vsName: { color: colors.textPrimary, fontSize: typeScale.button, textAlign: 'center' },
  vsRole: { color: colors.textSecondary, fontSize: typeScale.caption, textAlign: 'center' },
  vsMark: { color: colors.accentGold, fontSize: 28 },
  vsCategory: { width: '100%', color: colors.success, fontSize: typeScale.body, textAlign: 'center' },
  resultCard: { width: '100%', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  resultText: { color: colors.textPrimary, fontSize: typeScale.body, lineHeight: 22, textAlign: 'center' },
  bonus: { color: colors.accentGold, fontSize: typeScale.body, textAlign: 'center' },
});
