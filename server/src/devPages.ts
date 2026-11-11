// Development-only helpers served by the same server: the /rooms test page (open http://<PC address>:2567/rooms),
// the pictures (/items/<key>.webp) and the Colyseus browser SDK (/sdk.js) that the page loads from this machine.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOMS_PAGE } from './roomsPage';

const ITEMS_DIR = resolve(__dirname, '../../../../mobile/assets/items');
const SDK_FILE = resolve(__dirname, '../../../node_modules/@colyseus/sdk/dist/colyseus.js');

export function mountDevPages(app: any): void {
  app.get('/rooms', (_req: any, res: any) => res.type('html').send(ROOMS_PAGE));
  app.get('/sdk.js', (_req: any, res: any) => res.sendFile(SDK_FILE));
  app.get('/items/:key.webp', (req: any, res: any) => {
    const match = /^([a-z0-9-]+)-(\d+)$/.exec(String(req.params.key));
    const file = match ? join(ITEMS_DIR, match[1], `${req.params.key}.webp`) : null;
    if (!file || !existsSync(file)) return res.status(404).end();
    res.sendFile(file);
  });
}
