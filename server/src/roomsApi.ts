// HTTP for the rooms screen: the live list of public rooms, a join-by-code lookup, a free code, and the categories to pick from.
import { matchMaker } from 'colyseus';
import { CATEGORIES, getAvailableWays } from '../../mobile/src/content/categories';
import { userFromToken } from './auth';
import { getDb } from './context';
import { isPickable } from './lobby';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function liveRooms() {
  return matchMaker.query({ name: 'game' });
}

async function newCode(): Promise<string> {
  const used = new Set((await liveRooms()).map((room) => String(room.metadata?.code ?? '')));
  for (;;) {
    const code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
    if (!used.has(code)) return code;
  }
}

export function mountRoomsApi(app: any): void {
  const open = (res: any) => res.setHeader('Access-Control-Allow-Origin', '*');
  const signedIn = (req: any) => userFromToken(getDb(), String(req.headers.authorization ?? '').replace(/^Bearer /, ''));

  app.get('/api/categories', (_req: any, res: any) => {
    open(res);
    res.json({
      categories: CATEGORIES.filter((category) => isPickable(category.id)).map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        level: category.level,
        ways: getAvailableWays(category).map((way) => ({ id: way.id, label: way.label })),
      })),
    });
  });

  // Public rooms only (private ones are never listed). "In game" rooms stay listed so people can watch.
  app.get('/api/rooms', async (_req: any, res: any) => {
    open(res);
    const rooms = (await liveRooms()).filter((room) => !room.private);
    res.json({
      rooms: rooms.map((room) => ({ roomId: room.roomId, ...room.metadata, watchers: Math.max(0, room.clients - (room.metadata?.humans ?? 0)) })),
    });
  });

  app.get('/api/rooms/code/:code', async (req: any, res: any) => {
    open(res);
    const code = String(req.params.code).toUpperCase();
    const room = (await liveRooms()).find((candidate) => candidate.metadata?.code === code);
    if (!room) return res.status(404).json({ error: 'no_such_room' });
    res.json({ roomId: room.roomId, name: room.metadata?.name, phase: room.metadata?.phase, humans: room.metadata?.humans });
  });

  app.get('/api/rooms/new-code', async (req: any, res: any) => {
    open(res);
    if (!signedIn(req)) return res.status(401).json({ error: 'not_signed_in' });
    res.json({ code: await newCode() });
  });
}
