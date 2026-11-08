import type { OnlineView } from '../game/online-view';
import type { ArenaCell, ArenaPlayer, GameState } from '../game/types';

// The board components draw a `GameState`; an online phone only has the server's `OnlineView`.
// This builds the same shape from it (only what the board and the mini-map read is real; the rest is neutral).
export function viewToGameState(view: OnlineView, meId: string | null): GameState {
  const cells: ArenaCell[] = view.cells.map((ownerId, id) => ({ id, row: Math.floor(id / 4), column: id % 4, ownerId }));
  const players: Record<string, ArenaPlayer> = {};
  for (const player of view.players) {
    players[player.id] = {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      color: '#000000',
      isHuman: player.isHuman,
      isActive: player.isActive,
      categoryId: player.categoryId,
      wayId: 'w1',
      cellIds: cells.filter((cell) => cell.ownerId === player.id).map((cell) => cell.id),
      hasPlayedThisRound: player.played,
      winStreak: player.winStreak,
      bonusReady: player.bonusReady,
    };
  }
  return {
    cells,
    players,
    humanPlayerId: meId ?? '',
    round: view.round,
    selectedPlayerId: view.attackerId,
    events: view.events.map((text, index) => ({ id: `e${index}`, text })),
    eventCount: view.events.length,
  };
}

// A clock that shows the server's time left and keeps running smoothly between messages.
export function clockLeftMs(base: number, receivedAt: number, now: number, running: boolean): number {
  return Math.max(0, running ? base - Math.max(0, now - receivedAt) : base);
}
