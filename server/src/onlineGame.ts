// The whole online game of one room (PRD_MULTIPLAYER phase 5). Pure: no sockets, no timers. The room feeds it
// actions and calls `update()` a few times a second; the clock (`now`) and the random source are injected, so
// tests drive it with fakes. The server decides everything: who is drawn, the duel clocks, the answers, the
// winner. A phone only sends choices and sees `view()` (never an answer).
//
// Order (same as the local game and `gameLoop.ts`): draw -> target -> duel -> result -> (continue | return) -> ...
// -> the final when two are left (the one with more territory chooses the category) -> champion.
// A human who does not choose in time gets the bot's choice; a human who is away for `awayMs` is replaced by a
// bot, and takes the seat back (between duels) when they return.
import { getWay, CATEGORY_BY_ID, getWayItems } from '../../mobile/src/content/categories';
import { applyAnswer, applySkip, currentItem, duelView, isFinished, isPaused, remainingMs, startDuel, tick } from '../../mobile/src/game/duel';
import type { DuelState } from '../../mobile/src/game/duel';
import type { OnlineView } from '../../mobile/src/game/online-view';

export type { OnlineView, ViewPlayer } from '../../mobile/src/game/online-view';
import {
  aiThinkDelayMs,
  chooseAiFinalCategory,
  chooseAiTarget,
  correctAnswerPauseMs,
  createBattleDeck,
  createBattleSetup,
  createFinalBattleSetup,
  decideAiContinue,
  decideAiDuelOutcome,
  drawPlayer,
  getActivePlayers,
  getChampion,
  getFinalCategoryChooser,
  getNeighborPlayerIds,
  resolveBattle,
  returnWinnerToArena,
  simulateAiBattle,
} from '../../mobile/src/game/engine';
import type { RandomSource } from '../../mobile/src/game/engine';
import type { BattleResolution, BattleSetup, GameState } from '../../mobile/src/game/types';

export type Timing = {
  // The draw animation on the phones: full when a person is drawn, quick when a bot is.
  drawFullMs: number;
  drawBonusExtraMs: number;
  drawQuickMs: number;
  // How long a bot "thinks" about a target / continue / final category.
  botChoiceMs: number;
  // The "A attacks B" card before a live duel.
  announceMs: number;
  // After a duel: with the conquest animation (a person was in it), short for bots only, shortest for the deciding duel.
  resultMs: number;
  // After a duel with a person in it: who won is shown first, then the conquest animation.
  resultBannerMs: number;
  // A bot's choice of a target: first "X goes on", then the chosen target is shown.
  botRevealMs: number;
  resultCompactMs: number;
  resultFinalMs: number;
  // Quarter-final / semi-final banner and the final reveal.
  milestoneMs: number;
  finalRevealMs: number;
  // How long a human has to choose (target, continue or return, final category) before a bot choice is used.
  humanChoiceMs: number;
  // A human away this long is replaced by a bot.
  awayMs: number;
};

export const DEFAULT_TIMING: Timing = {
  drawFullMs: 5600, drawBonusExtraMs: 900, drawQuickMs: 1700, botChoiceMs: 1200, announceMs: 2200,
  resultMs: 5200, resultBannerMs: 1800, botRevealMs: 1300, resultCompactMs: 2400, resultFinalMs: 1800, milestoneMs: 2800, finalRevealMs: 4800,
  humanChoiceMs: 20_000, awayMs: 30_000,
};

type Stage =
  | { kind: 'draw'; attackerId: string; wakeAt: number; quick: boolean }
  | { kind: 'milestone'; label: 'quarter' | 'semi'; winnerId: string; wakeAt: number }
  | { kind: 'finalReveal'; wakeAt: number }
  | {
    kind: 'target'; attackerId: string; wakeAt: number; deadline: number | null;
    // The winner goes on attacking (not freshly drawn).
    continuing: boolean;
    // A bot chooses at once but the phones see the choice only from `revealAt` (null for a person).
    botTargetId: string | null; revealAt: number | null;
  }
  | { kind: 'final'; chooserId: string; wakeAt: number; deadline: number | null }
  | { kind: 'announce'; setup: BattleSetup; wakeAt: number }
  | { kind: 'duel'; setup: BattleSetup; duel: DuelState; botAt: number | null; botKey: string }
  | { kind: 'result'; setup: BattleSetup; resolution: BattleResolution; wakeAt: number; compact: boolean; bannerUntil: number }
  | { kind: 'after'; winnerId: string; wakeAt: number; deadline: number | null }
  | { kind: 'done'; championId: string };

export type Action =
  | { type: 'pickTarget'; targetId: string }
  | { type: 'pickFinalCategory'; categoryId: string }
  | { type: 'answer'; text: string }
  | { type: 'skip' }
  | { type: 'continue' }
  | { type: 'return' };

export type ActionResult = { ok: boolean; correct?: boolean; error?: string };

type Seat = { playerId: string; userId: number; clientId: string | null; awaySince: number | null };

export type OnlineGameOptions = {
  state: GameState;
  random: RandomSource;
  now: () => number;
  timing?: Partial<Timing>;
  // Called once, when the champion is known.
  onFinish?: (result: { championId: string; championUserId: number | null; userIds: number[] }) => void;
};

export class OnlineGame {
  private state: GameState;
  private stage: Stage;
  private duels = 0;
  private readonly seats: Seat[];
  private readonly timing: Timing;
  private finished = false;
  private finalRevealed = false;
  private readonly milestonesShown = new Set<number>();

  constructor(private readonly options: OnlineGameOptions) {
    this.state = options.state;
    this.timing = { ...DEFAULT_TIMING, ...options.timing };
    this.seats = Object.values(this.state.players)
      .filter((player) => player.isHuman && player.userId !== undefined)
      .map((player) => ({ playerId: player.id, userId: Number(player.userId), clientId: null, awaySince: this.options.now() }));
    this.stage = { kind: 'done', championId: '' };
    this.enterDraw(this.options.now());
  }

  // ---- people ---------------------------------------------------------------------------------------------------

  // A phone connects (or reconnects). Returns the seat it controls, or null for a spectator.
  connect(clientId: string, userId: number): string | null {
    const seat = this.seats.find((candidate) => candidate.userId === userId);
    if (!seat) return null;
    seat.clientId = clientId;
    seat.awaySince = null;
    this.reclaim();
    return seat.playerId;
  }

  disconnect(clientId: string): void {
    const seat = this.seats.find((candidate) => candidate.clientId === clientId);
    if (!seat) return;
    seat.clientId = null;
    seat.awaySince = this.options.now();
  }

  seatOf(clientId: string): string | null {
    return this.seats.find((seat) => seat.clientId === clientId)?.playerId ?? null;
  }

  isFinished(): boolean {
    return this.stage.kind === 'done';
  }

  getState(): GameState {
    return this.state;
  }

  private setHuman(playerId: string, isHuman: boolean) {
    const player = this.state.players[playerId];
    if (!player || player.isHuman === isHuman) return;
    this.state = { ...this.state, players: { ...this.state.players, [playerId]: { ...player, isHuman } } };
  }

  private inLiveDuel(playerId: string): boolean {
    return this.stage.kind === 'duel' && (this.stage.setup.attackerId === playerId || this.stage.setup.defenderId === playerId);
  }

  // A returning person gets their seat back, but not in the middle of their own duel (the bot finishes it).
  private reclaim() {
    for (const seat of this.seats) {
      if (seat.clientId && !this.state.players[seat.playerId].isHuman && this.state.players[seat.playerId].isActive && !this.inLiveDuel(seat.playerId)) {
        this.setHuman(seat.playerId, true);
      }
    }
  }

  private isHuman(playerId: string): boolean {
    return !!this.state.players[playerId]?.isHuman;
  }

  // ---- the clock ------------------------------------------------------------------------------------------------

  update(): void {
    const now = this.options.now();
    for (const seat of this.seats) {
      if (seat.awaySince !== null && now - seat.awaySince >= this.timing.awayMs) this.setHuman(seat.playerId, false);
    }
    this.reclaim();

    const stage = this.stage;
    switch (stage.kind) {
      case 'draw':
        if (now >= stage.wakeAt) this.toTarget(stage.attackerId, now, false);
        return;
      case 'milestone':
        if (now >= stage.wakeAt) this.proceedAfterResult(stage.winnerId, now);
        return;
      case 'finalReveal':
        if (now >= stage.wakeAt) this.enterDraw(now);
        return;
      case 'target': return this.updateTarget(stage, now);
      case 'final': return this.updateFinal(stage, now);
      case 'announce':
        if (now >= stage.wakeAt) this.beginDuel(stage.setup, now);
        return;
      case 'duel': return this.updateDuel(stage, now);
      case 'result':
        if (now >= stage.wakeAt) this.afterResult(stage, now);
        return;
      case 'after': return this.updateAfter(stage, now);
      case 'done': return;
    }
  }

  private humanDeadline(now: number): number {
    return now + this.timing.humanChoiceMs;
  }

  // Starts a draw (or the final reveal, the final, the end): the contestant is drawn at once, so every phone can run
  // the draw animation towards the same result, and the stage lasts as long as that animation.
  private enterDraw(now: number) {
    const champion = getChampion(this.state);
    if (champion) return this.finish(champion.id);
    const chooser = getFinalCategoryChooser(this.state);
    if (chooser) {
      if (!this.finalRevealed) {
        this.finalRevealed = true;
        this.stage = { kind: 'finalReveal', wakeAt: now + this.timing.finalRevealMs };
        return;
      }
      this.stage = {
        kind: 'final', chooserId: chooser.id, wakeAt: chooser.isHuman ? now : now + this.timing.botChoiceMs,
        deadline: chooser.isHuman ? this.humanDeadline(now) : null,
      };
      return;
    }
    this.state = drawPlayer(this.state, this.options.random);
    const attackerId = this.state.selectedPlayerId!;
    const person = this.isHuman(attackerId);
    const duration = person
      ? this.timing.drawFullMs + (this.state.players[attackerId].bonusReady ? this.timing.drawBonusExtraMs : 0)
      : this.timing.drawQuickMs;
    this.stage = { kind: 'draw', attackerId, wakeAt: now + duration, quick: !person };
  }

  private toTarget(attackerId: string, now: number, continuing: boolean) {
    if (this.isHuman(attackerId)) {
      this.stage = { kind: 'target', attackerId, wakeAt: now, deadline: this.humanDeadline(now), continuing, botTargetId: null, revealAt: null };
      return;
    }
    // A bot: "X goes on / was drawn" for a moment, then the phones see whom it attacks, then the duel is announced.
    const botTargetId = chooseAiTarget(this.state, attackerId, this.options.random);
    if (!botTargetId) throw new Error(`${attackerId} has no neighbor to attack`);
    const revealAt = now + this.timing.botChoiceMs;
    this.stage = { kind: 'target', attackerId, wakeAt: revealAt + this.timing.botRevealMs, deadline: null, continuing, botTargetId, revealAt };
  }

  private updateTarget(stage: Extract<Stage, { kind: 'target' }>, now: number) {
    if (now < stage.wakeAt) return;
    if (this.isHuman(stage.attackerId) && stage.deadline !== null && now < stage.deadline) return;
    // A bot (or a human who ran out of time, or left) chooses.
    const targetId = stage.botTargetId ?? chooseAiTarget(this.state, stage.attackerId, this.options.random);
    if (!targetId) throw new Error(`${stage.attackerId} has no neighbor to attack`);
    this.announce(createBattleSetup(this.state, stage.attackerId, targetId), now);
  }

  private updateFinal(stage: Extract<Stage, { kind: 'final' }>, now: number) {
    if (now < stage.wakeAt) return;
    if (this.isHuman(stage.chooserId) && stage.deadline !== null && now < stage.deadline) return;
    this.announce(
      createFinalBattleSetup(this.state, stage.chooserId, chooseAiFinalCategory(this.state, stage.chooserId, this.options.random)),
      now,
    );
  }

  // A duel with a person in it gets an announcement card and is played live; two bots are decided at once and only
  // shown briefly (the compact result), so bot fights never hold anyone up.
  private announce(setup: BattleSetup, now: number) {
    if (!this.isHuman(setup.attackerId) && !this.isHuman(setup.defenderId)) {
      this.resolve(setup, simulateAiBattle(this.state, setup, this.options.random), now, true);
      return;
    }
    this.stage = { kind: 'announce', setup, wakeAt: now + this.timing.announceMs };
  }

  private beginDuel(setup: BattleSetup, now: number) {
    if (!this.isHuman(setup.attackerId) && !this.isHuman(setup.defenderId)) {
      // A person left during the announcement: two bots, so the engine decides.
      this.resolve(setup, simulateAiBattle(this.state, setup, this.options.random), now, true);
      return;
    }
    const category = CATEGORY_BY_ID[setup.categoryId];
    const deck = createBattleDeck(getWayItems(category, setup.wayId), this.options.random);
    this.stage = {
      kind: 'duel', setup, botAt: null, botKey: '',
      duel: startDuel(deck, setup.attackerSeconds * 1000, setup.defenderSeconds * 1000, now),
    };
  }

  private duelEnv(setup: BattleSetup) {
    const items = getWayItems(CATEGORY_BY_ID[setup.categoryId], setup.wayId);
    return { refill: () => createBattleDeck(items, this.options.random) };
  }

  private updateDuel(stage: Extract<Stage, { kind: 'duel' }>, now: number) {
    const { setup } = stage;
    let duel = tick(stage.duel, now, this.duelEnv(setup));
    let { botAt, botKey } = stage;

    if (!isFinished(duel)) {
      const activeId = duel.active === 'attacker' ? setup.attackerId : setup.defenderId;
      if (!this.isHuman(activeId) && !isPaused(duel, now)) {
        const item = currentItem(duel);
        const key = `${duel.position}:${item.id}:${duel.active}`;
        if (botKey !== key || botAt === null) {
          botKey = key;
          botAt = now + aiThinkDelayMs(item.difficulty, this.options.random);
        } else if (now >= botAt) {
          const outcome = decideAiDuelOutcome(item.difficulty, remainingMs(duel, duel.active, now), this.options.random);
          if (outcome === 'correct') {
            duel = applyAnswer(duel, item.answer, now, correctAnswerPauseMs(this.options.random), this.duelEnv(setup)).state;
          } else if (outcome === 'skip') {
            duel = applySkip(duel, now, this.duelEnv(setup));
          } else {
            botAt = now + aiThinkDelayMs(item.difficulty, this.options.random);
          }
        }
      }
    }

    if (isFinished(duel)) {
      const winnerId = duel.winner === 'attacker' ? setup.attackerId : setup.defenderId;
      this.resolve(setup, winnerId, now);
    } else {
      this.stage = { ...stage, duel, botAt, botKey };
    }
  }

  private resolve(setup: BattleSetup, winnerId: string, now: number, compact = false) {
    const resolution = resolveBattle(this.state, setup, winnerId);
    this.state = resolution.state;
    this.duels += 1;
    const decisive = !!getChampion(this.state);
    // A duel with a person: first who won (banner), then the conquest animation.
    const ms = decisive ? this.timing.resultFinalMs : compact ? this.timing.resultCompactMs : this.timing.resultBannerMs + this.timing.resultMs;
    this.stage = { kind: 'result', setup, resolution, wakeAt: now + ms, compact, bannerUntil: now + this.timing.resultBannerMs };
  }

  private afterResult(stage: Extract<Stage, { kind: 'result' }>, now: number) {
    const winnerId = stage.resolution.winnerId;
    const left = getActivePlayers(this.state).length;
    // Quarter-final (8 left) and semi-final (4 left) get a short banner.
    if ((left === 8 || left === 4) && !this.milestonesShown.has(left)) {
      this.milestonesShown.add(left);
      this.stage = { kind: 'milestone', label: left === 8 ? 'quarter' : 'semi', winnerId, wakeAt: now + this.timing.milestoneMs };
      return;
    }
    this.proceedAfterResult(winnerId, now);
  }

  private proceedAfterResult(winnerId: string, now: number) {
    // Champion, or two left (the final comes next): back to the top, no continue-or-return question.
    if (getChampion(this.state) || getFinalCategoryChooser(this.state)) {
      this.enterDraw(now);
      return;
    }
    this.stage = {
      kind: 'after', winnerId, wakeAt: now + this.timing.botChoiceMs,
      deadline: this.isHuman(winnerId) ? this.humanDeadline(now) : null,
    };
  }

  private updateAfter(stage: Extract<Stage, { kind: 'after' }>, now: number) {
    if (now < stage.wakeAt) return;
    if (this.isHuman(stage.winnerId) && stage.deadline !== null && now < stage.deadline) return;
    // A human who ran out of time returns to the arena (the safe default); a bot decides.
    const keepGoing = this.isHuman(stage.winnerId) ? false : decideAiContinue(this.state, stage.winnerId, this.options.random);
    this.continueOrReturn(stage.winnerId, keepGoing, now);
  }

  private continueOrReturn(winnerId: string, keepGoing: boolean, now: number) {
    if (keepGoing) {
      this.toTarget(winnerId, now, true);
    } else {
      this.state = returnWinnerToArena(this.state, winnerId);
      this.enterDraw(now);
    }
  }

  private finish(championId: string) {
    this.stage = { kind: 'done', championId };
    if (this.finished) return;
    this.finished = true;
    const champion = this.state.players[championId];
    this.options.onFinish?.({
      championId,
      championUserId: champion?.userId !== undefined ? Number(champion.userId) : null,
      userIds: this.seats.map((seat) => seat.userId),
    });
  }

  // ---- what people do ---------------------------------------------------------------------------------------------

  act(clientId: string, action: Action): ActionResult {
    const playerId = this.seatOf(clientId);
    if (!playerId || !this.isHuman(playerId)) return { ok: false, error: 'not_a_player' };
    const now = this.options.now();
    const stage = this.stage;

    if (action.type === 'pickTarget') {
      if (stage.kind !== 'target' || stage.attackerId !== playerId || now < stage.wakeAt) return { ok: false, error: 'not_now' };
      if (!getNeighborPlayerIds(this.state, playerId).includes(action.targetId)) return { ok: false, error: 'bad_target' };
      this.announce(createBattleSetup(this.state, playerId, action.targetId), now);
      return { ok: true };
    }

    if (action.type === 'pickFinalCategory') {
      if (stage.kind !== 'final' || stage.chooserId !== playerId) return { ok: false, error: 'not_now' };
      const options = getActivePlayers(this.state).map((player) => player.categoryId);
      if (!options.includes(action.categoryId)) return { ok: false, error: 'bad_category' };
      this.announce(createFinalBattleSetup(this.state, playerId, action.categoryId), now);
      return { ok: true };
    }

    if (action.type === 'continue' || action.type === 'return') {
      if (stage.kind !== 'after' || stage.winnerId !== playerId) return { ok: false, error: 'not_now' };
      const canContinue = getNeighborPlayerIds(this.state, playerId).length > 0;
      if (action.type === 'continue' && !canContinue) return { ok: false, error: 'no_neighbor' };
      this.continueOrReturn(playerId, action.type === 'continue', now);
      return { ok: true };
    }

    // answer / skip: only the side whose turn it is.
    if (stage.kind !== 'duel') return { ok: false, error: 'not_now' };
    const { setup } = stage;
    const side = setup.attackerId === playerId ? 'attacker' : setup.defenderId === playerId ? 'defender' : null;
    if (!side || stage.duel.active !== side) return { ok: false, error: 'not_your_turn' };
    if (action.type === 'skip') {
      this.stage = { ...stage, duel: applySkip(stage.duel, now, this.duelEnv(setup)) };
      return { ok: true };
    }
    const result = applyAnswer(stage.duel, String(action.text).slice(0, 100), now, correctAnswerPauseMs(this.options.random), this.duelEnv(setup));
    this.stage = { ...stage, duel: result.state };
    return { ok: true, correct: result.correct };
  }

  // ---- what phones see --------------------------------------------------------------------------------------------

  view(): OnlineView {
    const now = this.options.now();
    const { state } = this;
    const stage = this.stage;
    const setup = 'setup' in stage ? stage.setup : null;
    const awayIds = new Set(this.seats.filter((seat) => seat.clientId === null).map((seat) => seat.playerId));

    let targets: string[] = [];
    let finalOptions: string[] = [];
    let choiceDeadline: number | null = null;
    if (stage.kind === 'target' && this.isHuman(stage.attackerId) && now >= stage.wakeAt) {
      targets = getNeighborPlayerIds(state, stage.attackerId);
      choiceDeadline = stage.deadline;
    }
    if (stage.kind === 'final' && this.isHuman(stage.chooserId)) {
      finalOptions = getActivePlayers(state).map((player) => player.categoryId);
      choiceDeadline = stage.deadline;
    }
    if (stage.kind === 'after' && this.isHuman(stage.winnerId)) {
      choiceDeadline = stage.deadline;
      // The arena shows whom the winner could attack while deciding.
      targets = getNeighborPlayerIds(state, stage.winnerId);
    }

    const resolution = stage.kind === 'result' ? stage.resolution : null;
    const attackerId = stage.kind === 'target' || stage.kind === 'draw' ? stage.attackerId
      : stage.kind === 'after' ? stage.winnerId
      : stage.kind === 'final' ? stage.chooserId
      : setup ? setup.attackerId
      : null;

    return {
      stage: stage.kind,
      round: state.round,
      duels: this.duels,
      players: Object.values(state.players).map((player) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        gender: player.gender,
        isHuman: player.isHuman,
        isActive: player.isActive,
        categoryId: player.categoryId,
        cells: player.cellIds.length,
        winStreak: player.winStreak,
        bonusReady: player.bonusReady,
        played: player.hasPlayedThisRound,
        away: awayIds.has(player.id),
      })),
      cells: [...state.cells].sort((a, b) => a.id - b.id).map((cell) => cell.ownerId),
      attackerId,
      setup: setup ? {
        attackerId: setup.attackerId,
        defenderId: setup.defenderId,
        categoryId: setup.categoryId,
        categoryName: CATEGORY_BY_ID[setup.categoryId].name,
        wayLabel: getWay(CATEGORY_BY_ID[setup.categoryId], setup.wayId).label,
        attackerSeconds: setup.attackerSeconds,
        defenderSeconds: setup.defenderSeconds,
        attackerUsesBonus: setup.attackerUsesBonus,
        defenderUsesBonus: setup.defenderUsesBonus,
        isFinal: !!setup.isFinal,
      } : null,
      targets,
      finalOptions,
      duel: stage.kind === 'duel' ? duelView(stage.duel, now) : null,
      result: resolution ? {
        winnerId: resolution.winnerId,
        loserId: resolution.loserId,
        summary: resolution.summary,
        inheritedCategory: resolution.inheritedCategory,
        earnedBonus: resolution.winnerEarnedBonus,
        compact: stage.kind === 'result' ? stage.compact : false,
        banner: stage.kind === 'result' && !stage.compact && now < stage.bannerUntil,
        decisive: !!getChampion(state),
      } : null,
      drawQuick: stage.kind === 'draw' ? stage.quick : false,
      continuing: stage.kind === 'target' ? stage.continuing : false,
      chosenTargetId: stage.kind === 'target' && stage.revealAt !== null && now >= stage.revealAt ? stage.botTargetId : null,
      milestone: stage.kind === 'milestone' ? stage.label : null,
      choiceLeftMs: choiceDeadline === null ? null : Math.max(0, choiceDeadline - now),
      championId: stage.kind === 'done' ? stage.championId : null,
      events: state.events.map((event) => event.text),
      serverNow: now,
    };
  }
}
