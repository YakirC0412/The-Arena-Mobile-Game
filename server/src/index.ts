// Starts the Arena server on the home PC: `npm run start` from server/ (port 2567 unless PORT is set).
import { defineRoom, defineServer } from 'colyseus';
import { mountApi } from './api';
import { setDb } from './context';
import { mountDevPages } from './devPages';
import { openDb } from './db';
import { GameRoom } from './GameRoom';
import { mountRoomsApi } from './roomsApi';

const port = Number(process.env.PORT ?? 2567);
const db = openDb(process.env.ARENA_DB ?? 'data/arena.sqlite');

setDb(db);

const server = defineServer({
  rooms: { game: defineRoom(GameRoom) },
  express: (app) => {
    mountDevPages(app);
    mountRoomsApi(app);
    mountApi(app, db);
  },
});

server.listen(port).then(() => {
  console.log(`THE ARENA server listening on port ${port}`);
});
