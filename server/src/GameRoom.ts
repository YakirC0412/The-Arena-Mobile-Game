import { Room } from 'colyseus';
import { createGame } from '../../mobile/src/game/engine';
import type { GameState } from '../../mobile/src/game/types';
import { userFromToken } from './auth';
import type { PublicUser } from './auth';
import { getDb } from './context';
import { Lobby, MAX_HUMANS } from './lobby';
import type { LobbyError } from './lobby';

// Phase 4 room: the waiting room of a game (PRD_MULTIPLAYER). Create it with { token, name, visibility, code }
// (use POST /api/rooms/new-code for a free code); join with { token } or { token, watch: true } to only watch.
// Phones send: 'pickCategory' { categoryId, wayId }, 'start'. They get 'lobby' (the whole lobby view, on every change),
// 'role' once ('player' | 'spectator'), 'error' { error }, and 'started' (the 16-seat board) when the host starts.
// The game itself is played in phase 5; for now starting only builds the board and closes the lobby.
export const MAX_WATCHERS = 30;

export class GameRoom extends Room {
  maxClients = MAX_HUMANS + MAX_WATCHERS;
  private lobby!: Lobby;
  private users = new Map<string, PublicUser>();
  private game: GameState | null = null;
  // When the host pressed start (server time); the rooms list turns it into a running-game timer.
  private startedAt: number | null = null;

  onAuth(_client: unknown, options: { token?: string }) {
    const user = userFromToken(getDb(), options?.token);
    if (!user) throw new Error('not_signed_in');
    return user;
  }

  onCreate(options: { name?: string; visibility?: string; code?: string }) {
    const name = String(options.name ?? '').trim().slice(0, 24);
    if (!name) throw new Error('bad_name');
    const code = String(options.code ?? '').toUpperCase().slice(0, 6) || 'XXXX';
    const visibility = options.visibility === 'private' ? 'private' : 'public';
    this.lobby = new Lobby(name, code, visibility);
    if (visibility === 'private') void this.setPrivate(true);
    this.publish();

    this.onMessage('pickCategory', (client, message: { categoryId?: unknown; wayId?: unknown }) => {
      const result = this.lobby.pickCategory(client.sessionId, String(message?.categoryId), message?.wayId === 'w2' ? 'w2' : 'w1');
      this.afterAction(client, result);
    });
    // A phone says hello once its handlers are ready, and gets everything it may have missed while connecting.
    this.onMessage('hello', (client) => {
      client.send('role', { role: this.lobby.has(client.sessionId) ? 'player' : 'spectator' });
      client.send('lobby', this.lobby.view());
      if (this.game) client.send('started', { players: Object.values(this.game.players), cells: this.game.cells });
    });
    this.onMessage('start', (client) => {
      const result = this.lobby.start(client.sessionId);
      if (!result.ok) return this.afterAction(client, result);
      this.game = createGame(result.seats, Math.random);
      this.startedAt = Date.now();
      this.broadcast('started', { players: Object.values(this.game.players), cells: this.game.cells });
      this.broadcastLobby();
      this.publish();
    });
  }

  onJoin(client: { sessionId: string; send: (type: string, message?: unknown) => void }, options: { watch?: boolean }, user: PublicUser) {
    if (options?.watch) {
      client.send('role', { role: 'spectator' });
      client.send('lobby', this.lobby.view());
      if (this.game) client.send('started', { players: Object.values(this.game.players), cells: this.game.cells });
      return;
    }
    if ([...this.users.values()].some((other) => other.id === user.id)) throw new Error('already_in_room');
    const joined = this.lobby.join({ clientId: client.sessionId, userId: user.id, name: user.name, avatar: user.avatar });
    if (!joined.ok) throw new Error(joined.error);
    this.users.set(client.sessionId, user);
    client.send('role', { role: 'player' });
    this.broadcastLobby();
    this.publish();
  }

  onLeave(client: { sessionId: string }) {
    if (!this.lobby.has(client.sessionId)) return;
    this.users.delete(client.sessionId);
    this.lobby.leave(client.sessionId);
    this.broadcastLobby();
    this.publish();
  }

  private afterAction(client: { send: (type: string, message?: unknown) => void }, result: { ok: boolean; error?: LobbyError }) {
    if (result.ok) {
      this.broadcastLobby();
      this.publish();
    } else {
      client.send('error', { error: result.error });
    }
  }

  private broadcastLobby() {
    this.broadcast('lobby', this.lobby.view());
  }

  // What the room list shows (read through matchMaker.query in roomsApi.ts).
  private publish() {
    const view = this.lobby.view();
    const host = view.members.find((member) => member.isHost);
    void this.setMetadata({
      name: view.name,
      code: view.code,
      visibility: view.visibility,
      phase: view.phase,
      humans: view.members.length,
      startedAt: this.startedAt,
      maxHumans: view.maxHumans,
      host: host?.name ?? '',
    });
  }
}
