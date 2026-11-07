import type { LeaderRow, RoomSummary } from './types';

// Game timer on a room card: 04:07, or 1:02:09 after an hour. Never negative.
export function formatGameTimer(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

// Codes use letters and digits without look-alikes (no O/0, I/1), always 4 characters.
export const CODE_LENGTH = 4;
const CODE_CHARS = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;

// Cleans what a person typed: upper case, only allowed characters, at most 4.
export function normalizeRoomCode(input: string): string {
  return (input.toUpperCase().match(CODE_CHARS) ?? []).join('').slice(0, CODE_LENGTH);
}

export const isCompleteRoomCode = (input: string): boolean => normalizeRoomCode(input).length === CODE_LENGTH;

// What a room card says and offers (one rule for every card).
export type RoomCardInfo = {
  // 'join' = enter the lobby, 'enterCode' = private room, ask for the code, 'watch' = spectate.
  action: 'join' | 'enterCode' | 'watch';
  statusLabel: string;
  accessLabel: string;
  full: boolean;
  timer: string | null;
};

export function describeRoom(room: RoomSummary, now: number): RoomCardInfo {
  const full = room.humans >= room.maxHumans;
  const inGame = room.phase === 'inGame';
  // A private room is always entered with its code (even to watch); a public one by tapping.
  const action: RoomCardInfo['action'] = room.visibility === 'private' ? 'enterCode' : inGame || full ? 'watch' : 'join';
  return {
    action,
    statusLabel: inGame ? 'במשחק' : full ? 'מלא' : 'ממתין לשחקנים',
    accessLabel: room.visibility === 'private' ? 'בקוד' : 'ציבורי',
    full,
    timer: inGame && room.startedAt !== null ? formatGameTimer(now - room.startedAt) : null,
  };
}

// The classic podium: 1st in the middle (tallest), 2nd on the left, 3rd on the right of the screen.
// Returns the three slots left to right; a missing winner is null.
export type PodiumSlot = { place: 1 | 2 | 3; leader: LeaderRow | null };

export function podiumSlots(leaders: LeaderRow[]): [PodiumSlot, PodiumSlot, PodiumSlot] {
  const at = (index: number) => leaders[index] ?? null;
  return [
    { place: 2, leader: at(1) },
    { place: 1, leader: at(0) },
    { place: 3, leader: at(2) },
  ];
}
