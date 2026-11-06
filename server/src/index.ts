// Starts the Arena server on the home PC: `npm run start` from server/ (port 2567 unless PORT is set).
import { defineRoom, defineServer } from 'colyseus';
import { ArenaRoom } from './ArenaRoom';

const port = Number(process.env.PORT ?? 2567);

const server = defineServer({
  rooms: { arena: defineRoom(ArenaRoom) },
});

server.listen(port).then(() => {
  console.log(`THE ARENA server listening on port ${port}`);
});
