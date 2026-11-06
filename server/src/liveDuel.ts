// One live duel between two people with any number of spectators (PRD_MULTIPLAYER phase 3). No sockets here:
// the room feeds it joins, answers and skips, and asks for a `view` to send. The clock is injected (`now`), so tests
// drive it with a fake one. The server decides everything; a phone only sends text and "skip" and sees `view`.
import { getWay, getWayItems, CATEGORY_BY_ID } from '../../mobile/src/content/categories';
import { applyAnswer, applySkip, duelView, isFinished, startDuel, tick } from '../../mobile/src/game/duel';
import type { DuelState, DuelSide, DuelView } from '../../mobile/src/game/duel';
import { correctAnswerPauseMs, createBattleDeck } from '../../mobile/src/game/engine';
import type { RandomSource } from '../../mobile/src/game/engine';
import type { WayId } from '../../mobile/src/game/types';

export type Role = DuelSide | 'spectator';

export type LiveDuelOptions = {
  categoryId: string;
  wayId?: WayId;
  attackerSeconds?: number;
  defenderSeconds?: number;
  random: RandomSource;
  now: () => number;
};

export type LiveView = {
  phase: 'waiting' | 'running' | 'finished';
  categoryName: string;
  wayName: string;
  seats: Record<DuelSide, string | null>;
  spectators: number;
  duel: DuelView | null;
  // Who won (a seat), or null.
  winner: DuelSide | null;
  // Why the duel ended: the clock ran out, someone skipped with too little time, or someone left.
  endedBy: 'time' | 'forfeit' | null;
  serverNow: number;
};

type Person = { name: string; seat: DuelSide | null };

export class LiveDuel {
  private people = new Map<string, Person>();
  private duel: DuelState | null = null;
  private forfeitWinner: DuelSide | null = null;
  private readonly items;
  private readonly wayId: WayId;

  constructor(private readonly options: LiveDuelOptions) {
    const category = CATEGORY_BY_ID[options.categoryId];
    if (!category) throw new Error(`Unknown category: ${options.categoryId}`);
    this.wayId = options.wayId ?? 'w1';
    this.items = getWayItems(category, this.wayId);
  }

  // First person is the attacker, second the defender, everyone after that watches.
  join(clientId: string, name: string): Role {
    if (this.people.has(clientId)) return this.people.get(clientId)!.seat ?? 'spectator';
    const taken = new Set([...this.people.values()].map((person) => person.seat));
    const seat: DuelSide | null = !taken.has('attacker') ? 'attacker' : !taken.has('defender') ? 'defender' : null;
    this.people.set(clientId, { name, seat });
    if (seat && !this.duel && this.seatedCount() === 2) this.begin();
    return seat ?? 'spectator';
  }

  // A seated person who leaves while the duel is on forfeits it. Phase 5 replaces this by a bot takeover.
  leave(clientId: string): void {
    const person = this.people.get(clientId);
    if (!person) return;
    this.people.delete(clientId);
    if (person.seat && this.duel && !isFinished(this.duel) && !this.forfeitWinner) {
      this.forfeitWinner = person.seat === 'attacker' ? 'defender' : 'attacker';
    }
  }

  roleOf(clientId: string): Role | null {
    const person = this.people.get(clientId);
    return person ? person.seat ?? 'spectator' : null;
  }

  private seatedCount(): number {
    return [...this.people.values()].filter((person) => person.seat).length;
  }

  private begin(): void {
    const { attackerSeconds = 40, defenderSeconds = 40, random, now } = this.options;
    this.duel = startDuel(createBattleDeck(this.items, random), attackerSeconds * 1000, defenderSeconds * 1000, now());
  }

  private env() {
    return { refill: () => createBattleDeck(this.items, this.options.random) };
  }

  private isActive(clientId: string): boolean {
    const person = this.people.get(clientId);
    return !!person?.seat && !!this.duel && !this.finished() && this.duel.active === person.seat;
  }

  finished(): boolean {
    return this.forfeitWinner !== null || (this.duel !== null && isFinished(this.duel));
  }

  // Brings the duel up to date (pauses end, clocks run out). The room calls this a few times a second.
  update(): void {
    if (this.duel && !this.finished()) this.duel = tick(this.duel, this.options.now(), this.env());
  }

  // True when `text` was the right answer of the side whose turn it is. Wrong answers and answers from the wrong
  // person change nothing, and the right answer never leaves the server.
  answer(clientId: string, text: string): boolean {
    if (!this.duel || !this.isActive(clientId)) return false;
    const result = applyAnswer(this.duel, String(text).slice(0, 100), this.options.now(), correctAnswerPauseMs(this.options.random), this.env());
    this.duel = result.state;
    return result.correct;
  }

  skip(clientId: string): void {
    if (!this.duel || !this.isActive(clientId)) return;
    this.duel = applySkip(this.duel, this.options.now(), this.env());
  }

  view(): LiveView {
    const category = CATEGORY_BY_ID[this.options.categoryId];
    const seatName = (seat: DuelSide) => [...this.people.values()].find((person) => person.seat === seat)?.name ?? null;
    const duel = this.duel ? duelView(this.duel, this.options.now()) : null;
    const winner = this.forfeitWinner ?? duel?.winner ?? null;
    return {
      phase: !this.duel ? 'waiting' : winner ? 'finished' : 'running',
      categoryName: category.name,
      wayName: getWay(category, this.wayId).label,
      seats: { attacker: seatName('attacker'), defender: seatName('defender') },
      spectators: [...this.people.values()].filter((person) => !person.seat).length,
      duel,
      winner,
      endedBy: winner ? (this.forfeitWinner ? 'forfeit' : 'time') : null,
      serverNow: this.options.now(),
    };
  }
}
