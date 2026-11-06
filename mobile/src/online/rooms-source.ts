import type { CreateRoomInput, LeaderRow, RoomSummary } from './types';

// Where the Multi tab gets its data. The mock implements it now; the server version (HTTP polling of
// /api/rooms and /api/leaders) replaces it later without touching any screen.
export interface RoomsSource {
  listRooms(): Promise<RoomSummary[]>;
  leaders(): Promise<LeaderRow[]>;
  createRoom(input: CreateRoomInput): Promise<RoomSummary>;
  findByCode(code: string): Promise<RoomSummary | null>;
}
