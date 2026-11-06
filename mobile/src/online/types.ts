// What the Multi tab shows. Pure data, no React: today a mock fills it, later the server (see rooms-source.ts).
export type RoomPhase = 'lobby' | 'inGame';
export type RoomVisibility = 'public' | 'private';

export type RoomSummary = {
  id: string;
  // The short code that is shared to join ("AB12").
  code: string;
  name: string;
  host: string;
  humans: number;
  maxHumans: number;
  visibility: RoomVisibility;
  phase: RoomPhase;
  // When the game began (ms since epoch); null while the room is still waiting.
  startedAt: number | null;
  watchers: number;
};

// One row of the hall of fame (all-time wins; a win counts only in games with 2+ humans).
export type LeaderRow = {
  userId: string;
  name: string;
  avatar: string;
  wins: number;
  games: number;
};

export type CreateRoomInput = { name: string; visibility: RoomVisibility; host: string };
