import { useCallback, useEffect, useRef, useState } from 'react';

import type { RoomsSource } from '@/online/rooms-source';
import type { LeaderRow, RoomSummary } from '@/online/types';

export const POLL_MS = 3000;

// One shared "now" that ticks every second, so every running-game timer on screen moves together.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type RoomsStatus = 'loading' | 'ready' | 'error';

// Loads the room list and the hall of fame and refreshes them every few seconds (the "live" feel).
// A failed refresh keeps the last good list and only shows the error when there is nothing to show.
export function useRooms(source: RoomsSource) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [status, setStatus] = useState<RoomsStatus>('loading');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [nextRooms, nextLeaders] = await Promise.all([source.listRooms(), source.leaders()]);
      if (!alive.current) return;
      setRooms(nextRooms);
      setLeaders(nextLeaders);
      setStatus('ready');
      setLastUpdate(Date.now());
    } catch {
      if (!alive.current) return;
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
    }
  }, [source]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  const retry = useCallback(() => {
    setStatus('loading');
    void refresh();
  }, [refresh]);

  return { rooms, leaders, status, lastUpdate, retry, refresh };
}
