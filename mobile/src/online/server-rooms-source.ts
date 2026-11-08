import { normalizeRoomCode } from './format';
import type { RoomsSource } from './rooms-source';
import { serverHttpUrl } from './server-config';
import { ensureServerSession } from './server-session';
import type { CreateRoomInput, LeaderRow, RoomSummary } from './types';

async function getJson(path: string, token?: string): Promise<{ status: number; json: any }> {
  try {
    const response = await fetch(`${serverHttpUrl()}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    return { status: response.status, json: await response.json().catch(() => ({})) };
  } catch {
    throw new Error('server_offline');
  }
}

// The real data: the Arena server's HTTP API (server/src/roomsApi.ts and api.ts).
export function createServerRoomsSource({ avatar, nickname, gender = 'male' }: { avatar: string; nickname: string; gender?: 'male' | 'female' }): RoomsSource {
  return {
    async listRooms() {
      const { status, json } = await getJson('/api/rooms');
      if (status !== 200) throw new Error('server_error');
      const receivedAt = Date.now();
      return (json.rooms as any[]).map((room): RoomSummary => ({
        id: room.roomId,
        code: room.code ?? '',
        name: room.name ?? '',
        host: room.host ?? '',
        humans: room.humans ?? 0,
        maxHumans: room.maxHumans ?? 6,
        visibility: room.visibility === 'private' ? 'private' : 'public',
        phase: room.phase === 'inGame' ? 'inGame' : 'lobby',
        // The server sends "how long ago it started", so a phone whose clock differs still counts right.
        startedAt: typeof room.playingMs === 'number' ? receivedAt - room.playingMs : null,
        watchers: room.watchers ?? 0,
      }));
    },

    async leaders() {
      const { status, json } = await getJson('/api/leaders');
      if (status !== 200) throw new Error('server_error');
      return (json.leaders as any[]).map((row): LeaderRow => ({
        userId: String(row.userId),
        name: row.name,
        avatar: row.avatar ?? 'avatar-01',
        wins: row.wins,
        games: row.games,
      }));
    },

    // Asks the server for a free code. The room itself is created when the lobby connects (use-server-lobby.ts).
    async createRoom(input: CreateRoomInput) {
      const session = await ensureServerSession(nickname, avatar, gender);
      const { status, json } = await getJson('/api/rooms/new-code', session.token);
      if (status !== 200) throw new Error('server_error');
      return {
        id: '',
        code: json.code,
        name: input.name.trim(),
        host: input.host,
        humans: 1,
        maxHumans: 6,
        visibility: input.visibility,
        phase: 'lobby',
        startedAt: null,
        watchers: 0,
      } satisfies RoomSummary;
    },

    async findByCode(code: string) {
      const wanted = normalizeRoomCode(code);
      const { status, json } = await getJson(`/api/rooms/code/${encodeURIComponent(wanted)}`);
      if (status === 404) return null;
      if (status !== 200) throw new Error('server_error');
      return {
        id: json.roomId,
        code: wanted,
        name: json.name ?? '',
        host: '',
        humans: json.humans ?? 0,
        maxHumans: 6,
        visibility: 'private',
        phase: json.phase === 'inGame' ? 'inGame' : 'lobby',
        startedAt: null,
        watchers: 0,
      } satisfies RoomSummary;
    },
  };
}
