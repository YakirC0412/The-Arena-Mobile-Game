// Manual check: joins the running server (npm run start) and prints the game until the champion.
import { Client } from '@colyseus/sdk';
const client = new Client(process.env.ARENA_URL ?? 'ws://localhost:2567');
const room = await client.joinOrCreate('arena', { seed: Number(process.argv[2] ?? 5) });
let duels = 0;
room.onMessage('welcome', (m) => console.log(`welcome: ${m.players.length} players`));
room.onMessage('step', (m) => {
  if (m.kind === 'resolved') { duels += 1; console.log(`duel ${m.duel}: ${m.summary}`); }
  if (m.kind === 'champion') { console.log(`champion: ${m.championId} after ${duels} duels`); }
});
room.onLeave(() => { console.log('room closed'); process.exit(duels === 15 ? 0 : 1); });
setTimeout(() => { console.log('timeout'); process.exit(2); }, 60000);
