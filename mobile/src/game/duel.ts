import { isCorrectAnswer, SKIP_PENALTY_MS } from './engine';
import type { CategoryItem } from './types';

// The duel as a pure state machine (docs/GAME_RULES.md section 3): no React, no timers, no clock of its own.
// Every function takes the current time `now` (milliseconds), so the same code can run on the phone and on the
// server, and a test can drive it with a fake clock. The server owns the truth in online games; the phone only
// shows what `duelView` returns.
//
// Rules in short: the attacker starts; only the active side's clock runs; a correct answer stops both clocks for a
// short pause and then passes the turn with the next picture; a skip costs SKIP_PENALTY_MS, pauses briefly and
// keeps the turn with the next picture; a clock that reaches zero loses.

export type DuelSide = 'attacker' | 'defender';

// After a skip both clocks stay stopped for this long, then the next picture appears (same as the local duel).
export const SKIP_PAUSE_MS = 250;

export type DuelState = {
  // The pictures in play (for the defender's way, so `answer` is what has to be typed).
  deck: CategoryItem[];
  position: number;
  active: DuelSide;
  // Time left on each clock as of `turnStartedAt` (or as of now when the clock is stopped).
  remainingMs: Record<DuelSide, number>;
  // When the active clock started running; null while it is stopped (pause or finished).
  turnStartedAt: number | null;
  // While set, both clocks are stopped until this time; then `afterPause` happens.
  pausedUntil: number | null;
  afterPause: 'switch' | 'stay' | null;
  winner: DuelSide | null;
};

// Called when the deck runs out; returns a fresh deck. Without it the deck simply starts over.
export type DuelEnv = { refill?: () => CategoryItem[] };

export function startDuel(deck: CategoryItem[], attackerMs: number, defenderMs: number, now: number): DuelState {
  if (deck.length === 0) throw new Error('A duel needs at least one picture');
  return {
    deck,
    position: 0,
    active: 'attacker',
    remainingMs: { attacker: attackerMs, defender: defenderMs },
    turnStartedAt: now,
    pausedUntil: null,
    afterPause: null,
    winner: null,
  };
}

export const otherSide = (side: DuelSide): DuelSide => (side === 'attacker' ? 'defender' : 'attacker');

export function currentItem(duel: DuelState): CategoryItem {
  return duel.deck[duel.position];
}

export function isFinished(duel: DuelState): boolean {
  return duel.winner !== null;
}

// True while the duel waits (after a correct answer or a skip) and takes no answers.
export function isPaused(duel: DuelState, now: number): boolean {
  return duel.pausedUntil !== null && now < duel.pausedUntil;
}

// What a clock shows right now.
export function remainingMs(duel: DuelState, side: DuelSide, now: number): number {
  const base = duel.remainingMs[side];
  if (side !== duel.active || duel.turnStartedAt === null || duel.winner) return Math.max(0, base);
  return Math.max(0, base - Math.max(0, now - duel.turnStartedAt));
}

function advancePicture(duel: DuelState, env: DuelEnv): DuelState {
  const last = currentItem(duel);
  let deck = duel.deck;
  let position = duel.position + 1;
  if (position >= deck.length) {
    deck = env.refill ? env.refill() : deck;
    position = 0;
    // Never show the same picture twice in a row when the deck starts over.
    if (deck.length > 1 && deck[0].id === last.id) deck = [...deck.slice(1), deck[0]];
  }
  return { ...duel, deck, position };
}

// Brings the duel up to `now`: ends a pause (next picture, maybe the other side's turn) and ends the duel when the
// active clock has run out. Safe to call as often as you like.
export function tick(duel: DuelState, now: number, env: DuelEnv = {}): DuelState {
  let state = duel;
  if (state.winner) return state;

  if (state.pausedUntil !== null && now >= state.pausedUntil) {
    const resumedAt = state.pausedUntil;
    state = advancePicture(state, env);
    state = {
      ...state,
      active: state.afterPause === 'switch' ? otherSide(state.active) : state.active,
      turnStartedAt: resumedAt,
      pausedUntil: null,
      afterPause: null,
    };
  }

  if (state.turnStartedAt !== null) {
    const left = state.remainingMs[state.active] - (now - state.turnStartedAt);
    if (left <= 0) {
      state = {
        ...state,
        remainingMs: { ...state.remainingMs, [state.active]: 0 },
        turnStartedAt: null,
        winner: otherSide(state.active),
      };
    }
  }
  return state;
}

// Writes the running clock's elapsed time into remainingMs and stops the clock.
function settle(duel: DuelState, now: number): DuelState {
  if (duel.turnStartedAt === null) return duel;
  const left = Math.max(0, duel.remainingMs[duel.active] - (now - duel.turnStartedAt));
  return { ...duel, remainingMs: { ...duel.remainingMs, [duel.active]: left }, turnStartedAt: null };
}

export type AnswerResult = { state: DuelState; correct: boolean };

// The active side typed `text`. A match (same rules as the local game) stops both clocks for `pauseMs`
// (use correctAnswerPauseMs) and then passes the turn. Anything else changes nothing.
export function applyAnswer(duel: DuelState, text: string, now: number, pauseMs: number, env: DuelEnv = {}): AnswerResult {
  const state = tick(duel, now, env);
  if (state.winner || isPaused(state, now)) return { state, correct: false };
  const item = currentItem(state);
  if (!isCorrectAnswer(text, item.answer, item.aliases)) return { state, correct: false };
  return {
    state: { ...settle(state, now), pausedUntil: now + pauseMs, afterPause: 'switch' },
    correct: true,
  };
}

// The active side skips: the next picture, the turn stays, and the clock pays SKIP_PENALTY_MS.
export function applySkip(duel: DuelState, now: number, env: DuelEnv = {}): DuelState {
  const state = tick(duel, now, env);
  if (state.winner || isPaused(state, now)) return state;
  const settled = settle(state, now);
  const left = Math.max(0, settled.remainingMs[settled.active] - SKIP_PENALTY_MS);
  const paid = { ...settled, remainingMs: { ...settled.remainingMs, [settled.active]: left } };
  if (left === 0) return { ...paid, winner: otherSide(paid.active) };
  return { ...paid, pausedUntil: now + SKIP_PAUSE_MS, afterPause: 'stay' };
}

// What a phone may see: never the answer, only the picture and the clocks.
export type DuelView = {
  active: DuelSide;
  itemId: string;
  imageKey?: string;
  remainingMs: Record<DuelSide, number>;
  paused: boolean;
  winner: DuelSide | null;
};

export function duelView(duel: DuelState, now: number): DuelView {
  const item = currentItem(duel);
  return {
    active: duel.active,
    itemId: item.id,
    imageKey: item.imageKey,
    remainingMs: { attacker: remainingMs(duel, 'attacker', now), defender: remainingMs(duel, 'defender', now) },
    paused: isPaused(duel, now),
    winner: duel.winner,
  };
}
