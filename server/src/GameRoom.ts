import { Room } from 'colyseus';
import { createGame } from '../../mobile/src/game/engine';
import type { HumanSeat } from '../../mobile/src/game/engine';
import { userFromToken } from './auth';
import type { PublicUser } from './auth';
import { getDb } from './context';
import { recordGame } from './db';
import { Lobby, MAX_HUMANS } from './lobby';
import type { LobbyError } from './lobby';
import { OnlineGame } from './onlineGame';

// The room of one game (PRD_MULTIPLAYER phases 4-5). Create it with { token, name, visibility, code }
// (use POST /api/rooms/new-code for a free code); join with { token } or { token, watch: true } to only watch.
// Lobby: phones send 'pickCategory' { categoryId, wayId }, 'start'; they get 'lobby' (the whole lobby view),
// 'role' once ('player' | 'spectator'), 'error' { error }.
// Game (after 'start'): the room runs an OnlineGame. Phones send 'pickTarget' { targetId }, 'pickFinalCategory'
// { categoryId }, 'answer' { text }, 'skip', 'continue', 'return'; they get 'game' (OnlineView, about 4 times a second,
// never containing answers), 'me' { playerId } (their seat, or null for a spectator) and 'correct' to the answerer.
// A person who joins again with the same account during the game gets their seat back.
export const MAX_WATCHERS = 30;
const TICK_MS = 250;
const CLOSE_AFTER_CHAMPION_MS = 60_000;

type Sender = { sessionId: string; send: (type: string, message?: unknown) => void };

export class GameRoom extends Room {
  maxClients = MAX_HUMANS + MAX_WATCHERS;
  private lobby!: Lobby;
  private users = new Map<string, PublicUser>();
  private game: OnlineGame | null = null;
  // When the host pressed start (server time); the rooms list turns it into a running-game timer.
  private startedAt: number | null = null;
  private closing = false;
  private senders = new Map<string, Sender>();

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
      const seat = this.game?.seatOf(client.sessionId) ?? null;
      client.send('role', { role: this.lobby.has(client.sessionId) || seat ? 'player' : 'spectator' });
      client.send('lobby', this.lobby.view());
      this.sendGameTo(client);
    });
    this.onMessage('start', (client) => {
      const result = this.lobby.start(client.sessionId);
      if (!result.ok) return this.afterAction(client, result);
      this.beginGame(result.seats);
    });

    // ---- in the game ----
    const act = (client: Sender, action: Parameters<OnlineGame['act']>[1]) => {
      if (!this.game) return;
      const result = this.game.act(client.sessionId, action);
      if (result.correct) client.send('correct', { correct: true });
      this.broadcastGame();
    };
    this.onMessage('pickTarget', (client, message: { targetId?: unknown }) => act(client, { type: 'pickTarget', targetId: String(message?.targetId) }));
    this.onMessage('pickFinalCategory', (client, message: { categoryId?: unknown }) => act(client, { type: 'pickFinalCategory', categoryId: String(message?.categoryId) }));
    this.onMessage('answer', (client, message: { text?: unknown }) => {
      if (typeof message?.text === 'string') act(client, { type: 'answer', text: message.text });
    });
    this.onMessage('skip', (client) => act(client, { type: 'skip' }));
    this.onMessage('continue', (client) => act(client, { type: 'continue' }));
    this.onMessage('return', (client) => act(client, { type: 'return' }));

    this.clock.setInterval(() => {
      if (!this.game) return;
      this.game.update();
      this.broadcastGame();
      if (this.game.isFinished() && !this.closing) {
        this.closing = true;
        this.clock.setTimeout(() => this.disconnect(), CLOSE_AFTER_CHAMPION_MS);
      }
    }, TICK_MS);
  }

  private beginGame(seats: HumanSeat[]) {
    const state = createGame(seats, Math.random);
    this.startedAt = Date.now();
    this.game = new OnlineGame({
      state,
      random: Math.random,
      now: () => Date.now(),
      onFinish: ({ championUserId, userIds }) => {
        try {
          recordGame(getDb(), userIds, championUserId);
        } catch {
          // a database problem must not break the champion screen
        }
      },
    });
    for (const [sessionId, user] of this.users) {
      const seat = this.game.connect(sessionId, user.id);
      this.senders.get(sessionId)?.send('me', { playerId: seat });
    }
    this.broadcastLobby();
    this.broadcastGame();
    this.publish();
  }

  onJoin(client: Sender, options: { watch?: boolean }, user: PublicUser) {
    this.senders.set(client.sessionId, client);
    // The game is on: a person who has a seat gets it back (even through the "watch" button); everyone else watches.
    if (this.game) {
      const seat = this.game.connect(client.sessionId, user.id);
      if (seat) this.users.set(client.sessionId, user);
      client.send('role', { role: seat ? 'player' : 'spectator' });
      client.send('lobby', this.lobby.view());
      client.send('me', { playerId: seat });
      this.sendGameTo(client);
      return;
    }
    if (options?.watch) {
      client.send('role', { role: 'spectator' });
      client.send('lobby', this.lobby.view());
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
    this.senders.delete(client.sessionId);
    if (this.game) {
      this.game.disconnect(client.sessionId);
      this.users.delete(client.sessionId);
      return;
    }
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

  private broadcastGame() {
    if (this.game) this.broadcast('game', this.game.view());
  }

  private sendGameTo(client: Sender) {
    if (this.game) client.send('game', this.game.view());
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
