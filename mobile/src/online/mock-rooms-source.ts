import { normalizeRoomCode } from './format';
import type { RoomsSource } from './rooms-source';
import type { CreateRoomInput, LeaderRow, RoomSummary } from './types';

// Sample data so the Multi tab can be designed and tested without a server. Rooms "move" with the clock (players
// come and go every few seconds) so the live-update feel can be checked. Replaced by the server source later.
const MINUTE = 60_000;

type Base = Omit<RoomSummary, 'humans' | 'startedAt' | 'watchers'> & { startedMinutesAgo: number | null; baseHumans: number; swing: number };

const BASE_ROOMS: Base[] = [
  { id: 'room-1', code: 'K7MQ', name: 'החבר׳ה מהצוות', host: 'דנה', maxHumans: 6, visibility: 'public', phase: 'lobby', startedMinutesAgo: null, baseHumans: 2, swing: 2 },
  { id: 'room-2', code: 'R4TX', name: 'ערב טריוויה', host: 'רון', maxHumans: 6, visibility: 'private', phase: 'lobby', startedMinutesAgo: null, baseHumans: 3, swing: 1 },
  { id: 'room-3', code: 'W9PB', name: 'הליגה של יובל', host: 'יובל', maxHumans: 6, visibility: 'public', phase: 'inGame', startedMinutesAgo: 7.4, baseHumans: 5, swing: 0 },
  { id: 'room-4', code: 'D2HN', name: 'משפחת כהן', host: 'מיכל', maxHumans: 6, visibility: 'private', phase: 'inGame', startedMinutesAgo: 21.1, baseHumans: 6, swing: 0 },
  { id: 'room-5', code: 'F6LC', name: 'מתחילים בלבד', host: 'גיא', maxHumans: 6, visibility: 'public', phase: 'lobby', startedMinutesAgo: null, baseHumans: 6, swing: 0 },
];

const LEADERS: LeaderRow[] = [
  { userId: 'u-1', name: 'נועם', avatar: 'avatar-03', wins: 14, games: 31 },
  { userId: 'u-2', name: 'מאיה', avatar: 'avatar-07', wins: 11, games: 24 },
  { userId: 'u-3', name: 'איתי', avatar: 'avatar-02', wins: 9, games: 30 },
];

export type MockOptions = { now?: () => number; empty?: boolean; fail?: boolean; latencyMs?: number };

export function createMockRoomsSource(options: MockOptions = {}): RoomsSource {
  const now = options.now ?? Date.now;
  const created: RoomSummary[] = [];
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, options.latencyMs ?? 350));
  const guard = async () => {
    await wait();
    if (options.fail) throw new Error('server_offline');
  };

  const snapshot = (): RoomSummary[] => {
    if (options.empty) return [...created];
    const tick = Math.floor(now() / 6000);
    const sample = BASE_ROOMS.map((base): RoomSummary => {
      const wiggle = base.swing === 0 ? 0 : (tick + base.id.length * 3) % (base.swing + 1);
      const inGame = base.phase === 'inGame';
      return {
        id: base.id,
        code: base.code,
        name: base.name,
        host: base.host,
        maxHumans: base.maxHumans,
        visibility: base.visibility,
        phase: base.phase,
        humans: Math.min(base.maxHumans, base.baseHumans + wiggle),
        // The timer keeps ticking from a fixed start, so it moves like a real running game.
        startedAt: inGame ? now() - Math.round((base.startedMinutesAgo ?? 0) * MINUTE) : null,
        watchers: inGame ? 1 + (tick % 3) : 0,
      };
    });
    return [...created, ...sample];
  };

  return {
    async listRooms() {
      await guard();
      return snapshot();
    },
    async leaders() {
      await guard();
      return options.empty ? [] : LEADERS;
    },
    async createRoom(input: CreateRoomInput) {
      await wait();
      const room: RoomSummary = {
        id: `mine-${created.length + 1}`,
        code: ['M3KA', 'P8ZE', 'T5VN', 'H2QW'][created.length % 4],
        name: input.name.trim() || 'החדר שלי',
        host: input.host,
        humans: 1,
        maxHumans: 6,
        visibility: input.visibility,
        phase: 'lobby',
        startedAt: null,
        watchers: 0,
      };
      created.unshift(room);
      return room;
    },
    async findByCode(code: string) {
      await wait();
      const wanted = normalizeRoomCode(code);
      return snapshot().find((room) => room.code === wanted) ?? null;
    },
  };
}
