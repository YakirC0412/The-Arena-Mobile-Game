// The rules of a room before the game starts (PRD_MULTIPLAYER phase 4): who is in, who is the host, who took which
// category, and when the host may start. Pure: no sockets. The Colyseus room feeds it and broadcasts its `view`.
import { CATEGORY_BY_ID, getAvailableWays } from '../../mobile/src/content/categories';
import type { HumanSeat } from '../../mobile/src/game/engine';
import type { WayId } from '../../mobile/src/game/types';

export const MAX_HUMANS = 6;
export const MIN_HUMANS_TO_START = 2;

export type LobbyError =
  | 'room_full' | 'in_game' | 'unknown_category' | 'category_taken' | 'bad_way'
  | 'not_a_player' | 'not_host' | 'need_more_players' | 'need_categories' | 'already_started';

export type Member = { clientId: string; userId: number; name: string; categoryId: string | null; wayId: WayId };
export type Result = { ok: true } | { ok: false; error: LobbyError };
const fail = (error: LobbyError): Result => ({ ok: false, error });

// Only finished, playable categories can be chosen (the hidden reserve cannot).
export const isPickable = (categoryId: string): boolean => CATEGORY_BY_ID[categoryId]?.status === 'active';

export type LobbyView = {
  name: string;
  code: string;
  visibility: 'public' | 'private';
  phase: 'lobby' | 'inGame';
  maxHumans: number;
  hostClientId: string | null;
  members: { clientId: string; name: string; categoryId: string | null; wayId: WayId; isHost: boolean }[];
  takenCategoryIds: string[];
  canStart: boolean;
};

export class Lobby {
  // In join order: the first one is the host, and the next one takes over when the host leaves.
  private members: Member[] = [];
  private phase: 'lobby' | 'inGame' = 'lobby';

  constructor(public readonly name: string, public readonly code: string, public readonly visibility: 'public' | 'private') {}

  has(clientId: string): boolean {
    return this.members.some((member) => member.clientId === clientId);
  }

  get humanCount(): number {
    return this.members.length;
  }

  get started(): boolean {
    return this.phase === 'inGame';
  }

  get hostId(): string | null {
    return this.members[0]?.clientId ?? null;
  }

  private find(clientId: string): Member | undefined {
    return this.members.find((member) => member.clientId === clientId);
  }

  private owner(categoryId: string): Member | undefined {
    return this.members.find((member) => member.categoryId === categoryId);
  }

  join(member: { clientId: string; userId: number; name: string }): Result {
    if (this.started) return fail('in_game');
    if (this.has(member.clientId)) return { ok: true };
    if (this.members.length >= MAX_HUMANS) return fail('room_full');
    this.members.push({ ...member, categoryId: null, wayId: 'w1' });
    return { ok: true };
  }

  // Leaving frees the category at once; the host role passes to the next person. Returns true when the room is empty.
  leave(clientId: string): boolean {
    this.members = this.members.filter((member) => member.clientId !== clientId);
    return this.members.length === 0;
  }

  // Switching is allowed as often as you like until the game starts. The server decides a race: the first request
  // gets the category, the second gets 'category_taken'.
  pickCategory(clientId: string, categoryId: string, wayId: WayId = 'w1'): Result {
    if (this.started) return fail('already_started');
    const member = this.find(clientId);
    if (!member) return fail('not_a_player');
    if (!isPickable(categoryId)) return fail('unknown_category');
    if (!getAvailableWays(CATEGORY_BY_ID[categoryId]).some((way) => way.id === wayId)) return fail('bad_way');
    const owner = this.owner(categoryId);
    if (owner && owner.clientId !== clientId) return fail('category_taken');
    member.categoryId = categoryId;
    member.wayId = wayId;
    return { ok: true };
  }

  canStart(clientId: string): Result {
    if (this.started) return fail('already_started');
    if (clientId !== this.hostId) return fail('not_host');
    if (this.members.length < MIN_HUMANS_TO_START) return fail('need_more_players');
    if (this.members.some((member) => !member.categoryId)) return fail('need_categories');
    return { ok: true };
  }

  // Closes the lobby and hands over the seats for `createGame` (the bots get the remaining categories there).
  start(clientId: string): { ok: true; seats: (HumanSeat & { userId: string })[] } | { ok: false; error: LobbyError } {
    const check = this.canStart(clientId);
    if (!check.ok) return check;
    this.phase = 'inGame';
    return {
      ok: true,
      seats: this.members.map((member) => ({
        id: member.clientId,
        name: member.name,
        categoryId: member.categoryId!,
        wayId: member.wayId,
        userId: String(member.userId),
      })),
    };
  }

  view(): LobbyView {
    return {
      name: this.name,
      code: this.code,
      visibility: this.visibility,
      phase: this.phase,
      maxHumans: MAX_HUMANS,
      hostClientId: this.hostId,
      members: this.members.map((member) => ({
        clientId: member.clientId,
        name: member.name,
        categoryId: member.categoryId,
        wayId: member.wayId,
        isHost: member.clientId === this.hostId,
      })),
      takenCategoryIds: this.members.flatMap((member) => (member.categoryId ? [member.categoryId] : [])),
      canStart: this.hostId !== null && this.canStart(this.hostId).ok,
    };
  }
}
