// Starts the Arena server on the home PC: `npm run start` from server/ (port 2567 unless PORT is set).
import { defineRoom, defineServer } from 'colyseus';
import { ArenaRoom } from './ArenaRoom';
import { mountApi } from './api';
import { setDb } from './context';
import { DuelRoom } from './DuelRoom';
import { openDb } from './db';
import { mountWatch } from './watch';
import { mountDuelPage } from './duelPage';

const port = Number(process.env.PORT ?? 2567);
const db = openDb(process.env.ARENA_DB ?? 'data/arena.sqlite');

setDb(db);

const server = defineServer({
  rooms: { arena: defineRoom(ArenaRoom), duel: defineRoom(DuelRoom) },
  express: (app) => {
    mountWatch(app);
    mountDuelPage(app);
    mountApi(app, db);
  },
});

server.listen(port).then(() => {
  console.log(`THE ARENA server listening on port ${port}`);
});
