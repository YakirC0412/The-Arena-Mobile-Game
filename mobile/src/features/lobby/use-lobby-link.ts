import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CATEGORIES } from '@/content/categories';
import type { LobbyEntry } from '@/game/flow';
import { isPickable, Lobby, MIN_HUMANS_TO_START } from '@/game/lobby';
import type { LobbyError, LobbyView } from '@/game/lobby';
import { serverWsUrl } from '@/online/server-config';
import { ensureServerSession } from '@/online/server-session';
import { Client, type Room } from '@/vendor/colyseus-sdk';

// What the lobby screen needs from "the room", whether it is the server or sample data.
export type LobbyLink = {
  status: 'connecting' | 'ready' | 'error' | 'closed';
  // Why joining failed (shown instead of the lobby).
  fatal: string | null;
  view: LobbyView | null;
  myId: string | null;
  watching: boolean;
  // A short message about the last action (for example "category taken").
  notice: string | null;
  // Set when the host started the game: how many seats there are and how many of them are people.
  started: { players: number; humans: number } | null;
  pick: (categoryId: string) => void;
  start: () => void;
  leave: () => void;
};

const MESSAGES: Record<string, string> = {
  room_full: 'החדר מלא – אפשר רק לצפות',
  in_game: 'המשחק כבר התחיל – אפשר רק לצפות',
  already_in_room: 'כבר נמצאים בחדר הזה (אולי בלשונית אחרת)',
  not_signed_in: 'ההתחברות לשרת נכשלה',
  server_offline: 'השרת לא זמין. בדקו שהמחשב פעיל ושאתם באותה רשת',
  unknown_category: 'אי אפשר לבחור את הקטגוריה הזו',
  category_taken: 'הקטגוריה כבר נלקחה – בחרו אחרת',
  bad_way: 'אי אפשר לבחור את דרך המשחק הזו',
  not_a_player: 'רק שחקנים בחדר יכולים לבחור',
  not_host: 'רק מי שפתח את החדר מתחיל',
  need_more_players: `צריך לפחות ${MIN_HUMANS_TO_START} שחקנים כדי להתחיל`,
  need_categories: 'לא כולם בחרו קטגוריה',
  already_started: 'המשחק כבר התחיל',
};
export const lobbyMessage = (code: string | undefined): string => (code && MESSAGES[code]) || 'משהו השתבש. נסו שוב';

// The real lobby: connects to the Arena server's `game` room (server/src/GameRoom.ts).
// A room you opened (roomId '') is created on connect; any other is joined by its id, or watched.
export function useServerLobby(entry: LobbyEntry, nickname: string, avatar: string): LobbyLink {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<LobbyLink['status']>('connecting');
  const [fatal, setFatal] = useState<string | null>(null);
  const [view, setView] = useState<LobbyView | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [role, setRole] = useState<'player' | 'spectator' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [started, setStarted] = useState<LobbyLink['started']>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await ensureServerSession(nickname, avatar);
        const client = new Client(serverWsUrl());
        const create = entry.isHost && entry.roomId === '';
        const room = create
          ? await client.create('game', { token: session.token, name: entry.name, visibility: entry.visibility ?? 'public', code: entry.code })
          : await client.joinById(entry.roomId, { token: session.token, watch: entry.watching });
        if (cancelled) {
          void room.leave();
          return;
        }
        roomRef.current = room;
        setMyId(room.sessionId);
        room.onMessage('lobby', (next: LobbyView) => setView(next));
        room.onMessage('role', (message: { role: 'player' | 'spectator' }) => setRole(message.role));
        room.onMessage('error', (message: { error: LobbyError }) => setNotice(lobbyMessage(message.error)));
        room.onMessage('started', (message: { players: { isHuman: boolean }[] }) =>
          setStarted({ players: message.players.length, humans: message.players.filter((player) => player.isHuman).length }));
        room.onLeave(() => !cancelled && setStatus((current) => (current === 'error' ? current : 'closed')));
        room.onError(() => !cancelled && setNotice('החיבור לשרת נקטע'));
        // Now that every handler exists, ask for the current state (nothing is lost while connecting).
        room.send('hello');
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setFatal(lobbyMessage(error instanceof Error ? error.message : undefined));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) void room.leave();
    };
  }, [entry.roomId, entry.code, entry.name, entry.isHost, entry.watching, entry.visibility, nickname, avatar]);

  const pick = useCallback((categoryId: string) => {
    setNotice(null);
    roomRef.current?.send('pickCategory', { categoryId, wayId: 'w1' });
  }, []);
  const start = useCallback(() => {
    setNotice(null);
    roomRef.current?.send('start');
  }, []);
  const leave = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) void room.leave();
  }, []);

  return { status, fatal, view, myId, watching: entry.watching || role === 'spectator', notice, started, pick, start, leave };
}

// ---- Sample data (QA screens only): the same rules as the server, with pretend people -----------------------------------

const ME = 'me';
const MOCK_PEOPLE = [
  { clientId: 'm1', userId: 101, name: 'דנה', avatar: 'avatar-05' },
  { clientId: 'm2', userId: 102, name: 'רון', avatar: 'avatar-09' },
  { clientId: 'm3', userId: 103, name: 'מיכל', avatar: 'avatar-12' },
];
const PICKABLE = CATEGORIES.filter((category) => isPickable(category.id));

export function useMockLobby(entry: LobbyEntry, nickname: string, avatar: string): LobbyLink {
  const lobby = useMemo(() => new Lobby(entry.name, entry.code, 'public'), [entry.name, entry.code]);
  const [, setVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [started, setStarted] = useState<LobbyLink['started']>(null);
  const redraw = () => setVersion((value) => value + 1);

  // A room you opened starts with you alone and a friend arrives a moment later; a room you joined already has people.
  useEffect(() => {
    const addMock = (index: number, category: string | null) => {
      lobby.join(MOCK_PEOPLE[index]);
      if (category) lobby.pickCategory(MOCK_PEOPLE[index].clientId, category);
      redraw();
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (entry.watching) {
      addMock(0, PICKABLE[3].id); addMock(1, PICKABLE[7].id); addMock(2, PICKABLE[11].id);
    } else if (entry.isHost) {
      lobby.join({ clientId: ME, userId: 1, name: nickname, avatar });
      timers.push(setTimeout(() => addMock(0, null), 1600), setTimeout(() => { lobby.pickCategory('m1', PICKABLE[3].id); redraw(); }, 3200));
    } else {
      addMock(0, PICKABLE[3].id); addMock(1, PICKABLE[7].id);
      lobby.join({ clientId: ME, userId: 1, name: nickname, avatar });
    }
    redraw();
    return () => timers.forEach(clearTimeout);
  }, [lobby, entry.isHost, entry.watching, nickname, avatar]);

  return {
    status: 'ready',
    fatal: null,
    view: lobby.view(),
    myId: ME,
    watching: entry.watching,
    notice,
    started,
    pick: (categoryId) => {
      const result = lobby.pickCategory(ME, categoryId);
      setNotice(result.ok ? null : lobbyMessage(result.error));
      redraw();
    },
    start: () => {
      const result = lobby.start(ME);
      if (result.ok) setStarted({ players: 16, humans: lobby.humanCount });
      else setNotice(lobbyMessage(result.error));
      redraw();
    },
    leave: () => undefined,
  };
}
