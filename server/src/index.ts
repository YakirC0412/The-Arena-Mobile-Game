// Starts the Arena server on the home PC: `npm run start` from server/ (port 2567 unless PORT is set).
import { defineRoom, defineServer } from 'colyseus';
import { ArenaRoom } from './ArenaRoom';
import { mountApi } from './api';
import { openDb } from './db';

const port = Number(process.env.PORT ?? 2567);
const db = openDb(process.env.ARENA_DB ?? 'data/arena.sqlite');

const server = defineServer({
  rooms: { arena: defineRoom(ArenaRoom) },
  express: (app) => mountApi(app, db),
});

server.listen(port).then(() => {
  console.log(`THE ARENA server listening on port ${port}`);
});
