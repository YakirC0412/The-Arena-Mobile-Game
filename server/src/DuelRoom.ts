import { Room } from 'colyseus';
import { CATEGORY_BY_ID } from '../../mobile/src/content/categories';
import { userFromToken } from './auth';
import type { PublicUser } from './auth';
import { getDb } from './context';
import { LiveDuel } from './liveDuel';

// Phase 3 room: one live duel. Two people play (the first two to join), everyone else watches.
// Join with { token, categoryId?, wayId? } (the token comes from /api/login). Messages from phones:
//   'answer' { text }  - every keystroke or on Enter; the server only replies { correct } to the sender
//   'skip'
// The server sends 'view' about four times a second (never containing answers) and 'role' once on join.
const TICK_MS = 250;

export class DuelRoom extends Room {
  maxClients = 30;
  private duel!: LiveDuel;
  private users = new Map<string, PublicUser>();

  onAuth(_client: unknown, options: { token?: string }) {
    const user = userFromToken(getDb(), options?.token);
    if (!user) throw new Error('not_signed_in');
    return user;
  }

  onCreate(options: { categoryId?: string; wayId?: 'w1' | 'w2'; seed?: number }) {
    const categoryId = options.categoryId && CATEGORY_BY_ID[options.categoryId]
      ? options.categoryId
      : Object.keys(CATEGORY_BY_ID).find((id) => CATEGORY_BY_ID[id].status === 'active')!;
    this.duel = new LiveDuel({ categoryId, wayId: options.wayId, random: Math.random, now: () => Date.now() });

    this.onMessage('answer', (client, message: { text?: unknown }) => {
      if (typeof message?.text !== 'string') return;
      if (this.duel.answer(client.sessionId, message.text)) client.send('correct', { correct: true });
      this.sendView();
    });
    this.onMessage('skip', (client) => {
      this.duel.skip(client.sessionId);
      this.sendView();
    });

    this.clock.setInterval(() => {
      this.duel.update();
      this.sendView();
      if (this.duel.finished() && !this.closing) {
        this.closing = true;
        this.clock.setTimeout(() => this.disconnect(), 10_000);
      }
    }, TICK_MS);
  }

  private closing = false;

  onJoin(client: { sessionId: string; send: (type: string, message?: unknown) => void }, _options: unknown, user: PublicUser) {
    this.users.set(client.sessionId, user);
    const role = this.duel.join(client.sessionId, user.name);
    client.send('role', { role });
    this.sendView();
  }

  onLeave(client: { sessionId: string }) {
    this.duel.leave(client.sessionId);
    this.users.delete(client.sessionId);
    this.sendView();
  }

  private sendView() {
    this.broadcast('view', this.duel.view());
  }
}
