import { Room } from 'colyseus';
import { createGame } from '../../mobile/src/game/engine';
import { createSeededRandom } from '../../mobile/src/game/rng';
import { CATEGORY_BY_ID } from '../../mobile/src/content/categories';
import { isLoopDone, startLoop, stepGame } from './gameLoop';
import type { LoopEvent, LoopState } from './gameLoop';

// Phase 1 room: a game where all 16 seats are bots. A viewer joins, watches the messages and nothing else.
// The room plays one step every STEP_MS and broadcasts it; the game closes itself after the champion.
const STEP_MS = Number(process.env.ARENA_STEP_MS ?? 1500);

// Everything a phone needs to draw a step. No answers are involved yet (bots only).
const describe = (event: LoopEvent) => {
  switch (event.kind) {
    case 'targeted':
      return {
        kind: event.kind,
        attackerId: event.setup.attackerId,
        defenderId: event.setup.defenderId,
        categoryId: event.setup.categoryId,
        isFinal: event.setup.isFinal === true,
      };
    case 'resolved':
      return {
        kind: event.kind,
        duel: event.duel,
        winnerId: event.resolution.winnerId,
        loserId: event.resolution.loserId,
        summary: event.resolution.summary,
      };
    default:
      return event;
  }
};

export class ArenaRoom extends Room {
  maxClients = 50;
  private loop!: LoopState;
  private random = createSeededRandom(1);

  onCreate(options: { seed?: number } = {}) {
    const seed = Number.isInteger(options.seed) ? (options.seed as number) : Math.floor(Math.random() * 2 ** 31);
    this.random = createSeededRandom(seed);
    const categoryId = Object.keys(CATEGORY_BY_ID).find((id) => CATEGORY_BY_ID[id].status === 'active') ?? 'animals';
    this.loop = startLoop(createGame([{ id: 'host', name: 'מארח', categoryId }], this.random));
    // The only human seat plays like a bot in this phase.
    this.loop.state.players.host.isHuman = false;
    this.clock.setInterval(() => this.tick(), STEP_MS);
  }

  onJoin(client: { send: (type: string, message?: unknown) => void }) {
    client.send('welcome', { players: Object.values(this.loop.state.players), cells: this.loop.state.cells, duels: this.loop.duels });
  }

  private tick() {
    if (isLoopDone(this.loop)) return;
    const result = stepGame(this.loop, this.random);
    this.loop = result.loop;
    this.broadcast('step', describe(result.event));
    if (isLoopDone(this.loop)) this.clock.setTimeout(() => this.disconnect(), 5000);
  }
}
