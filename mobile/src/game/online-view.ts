// What a phone sees of an online game (the server builds it in server/src/onlineGame.ts; pure types, no logic).
import type { DuelView } from './duel';

export type OnlineStage = 'draw' | 'milestone' | 'finalReveal' | 'target' | 'final' | 'announce' | 'duel' | 'result' | 'after' | 'done';

export type ViewPlayer = {
  id: string;
  name: string;
  avatar: string;
  // A person decides for this seat right now.
  isHuman: boolean;
  isActive: boolean;
  categoryId: string;
  cells: number;
  winStreak: number;
  bonusReady: boolean;
  // Already drawn to attack in this round (the draw animation only jumps over those who have not).
  played: boolean;
  // A human seat whose phone is not connected.
  away: boolean;
};

export type OnlineView = {
  stage: OnlineStage;
  round: number;
  duels: number;
  players: ViewPlayer[];
  // The owner of each of the 16 cells (index = cell id).
  cells: string[];
  // The contestant who attacks now.
  attackerId: string | null;
  setup: {
    attackerId: string;
    defenderId: string;
    categoryId: string;
    categoryName: string;
    wayLabel: string;
    attackerSeconds: number;
    defenderSeconds: number;
    attackerUsesBonus: boolean;
    defenderUsesBonus: boolean;
    isFinal: boolean;
  } | null;
  // What the choosing person may pick.
  targets: string[];
  finalOptions: string[];
  duel: DuelView | null;
  result: { winnerId: string; loserId: string; summary: string; inheritedCategory: boolean; earnedBonus: boolean;
    // Two bots fought: the phones show a short banner instead of the conquest animation.
    compact: boolean;
    // This duel left one contestant: the champion celebration follows.
    decisive: boolean;
  } | null;
  // The drawn contestant is a bot: a short draw animation.
  drawQuick: boolean;
  // A quarter-final / semi-final banner is on.
  milestone: 'quarter' | 'semi' | null;
  // Time left (ms) for a human to choose, or null.
  choiceLeftMs: number | null;
  championId: string | null;
  events: string[];
  serverNow: number;
};

