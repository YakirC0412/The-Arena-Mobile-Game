import { describeRoom, formatGameTimer, isCompleteRoomCode, normalizeRoomCode, podiumSlots } from '../src/online/format';
import { createMockRoomsSource } from '../src/online/mock-rooms-source';
import type { LeaderRow, RoomSummary } from '../src/online/types';
import { assert, assertEqual, suite, test } from './harness';

const room = (patch: Partial<RoomSummary> = {}): RoomSummary => ({
  id: 'r', code: 'AB23', name: 'חדר', host: 'דנה', humans: 3, maxHumans: 6, visibility: 'public',
  phase: 'lobby', startedAt: null, watchers: 0, ...patch,
});
const leader = (id: string, wins: number): LeaderRow => ({ userId: id, name: id, avatar: 'avatar-01', wins, games: wins + 3 });

suite('online home: formatting and room cards', () => {
  test('the game timer shows mm:ss, then h:mm:ss, never negative', () => {
    assertEqual(formatGameTimer(0), '00:00', 'Zero');
    assertEqual(formatGameTimer(247_000), '04:07', 'Minutes');
    assertEqual(formatGameTimer(3_729_000), '1:02:09', 'Hours');
    assertEqual(formatGameTimer(-5000), '00:00', 'Negative');
  });

  test('room codes: upper case, no look-alike characters, 4 at most', () => {
    assertEqual(normalizeRoomCode('ab2c'), 'AB2C', 'Upper case');
    assertEqual(normalizeRoomCode('a-b 0o1i2'), 'AB2', 'Look-alikes and symbols dropped');
    assertEqual(normalizeRoomCode('ABCDEFG'), 'ABCD', 'Four at most');
    assert(isCompleteRoomCode('ab23') && !isCompleteRoomCode('ab2'), 'Complete only at four');
  });

  test('a card offers join for waiting public rooms, a code for private ones, watch for full or running games', () => {
    assertEqual(describeRoom(room(), 0).action, 'join', 'Public and waiting');
    assertEqual(describeRoom(room({ visibility: 'private' }), 0).action, 'enterCode', 'Private and waiting');
    assertEqual(describeRoom(room({ humans: 6 }), 0).action, 'watch', 'Full');
    assertEqual(describeRoom(room({ phase: 'inGame', startedAt: 1000 }), 1000).action, 'watch', 'In game');
    assertEqual(describeRoom(room({ visibility: 'private', phase: 'inGame', startedAt: 1 }), 0).action, 'enterCode', 'Private rooms are always entered with the code');
    assertEqual(describeRoom(room({ visibility: 'private' }), 0).accessLabel, 'בקוד', 'Private label');
  });

  test('only a running game has a timer, counted from its start', () => {
    assertEqual(describeRoom(room(), 99_000).timer, null, 'Waiting rooms have no timer');
    const running = describeRoom(room({ phase: 'inGame', startedAt: 10_000 }), 10_000 + 125_000);
    assertEqual(running.timer, '02:05', 'Timer counts from the start');
    assertEqual(running.statusLabel, 'במשחק', 'Status');
  });

  test('the podium puts 1st in the middle, and missing winners stay empty', () => {
    const slots = podiumSlots([leader('a', 9), leader('b', 7), leader('c', 5)]);
    assertEqual(slots.map((slot) => slot.place).join(), '2,1,3', 'Order on screen');
    assertEqual(slots[1].leader?.userId, 'a', 'Winner in the middle');
    const one = podiumSlots([leader('a', 1)]);
    assertEqual(one[0].leader, null, 'No second place yet');
    assertEqual(podiumSlots([]).every((slot) => slot.leader === null), true, 'Empty podium');
  });
});

suite('online home: mock rooms source', () => {
  test('lists rooms with live-looking counts, a running timer and a code lookup', async () => {
    let clock = 1_000_000;
    const source = createMockRoomsSource({ now: () => clock, latencyMs: 0 });
    const first = await source.listRooms();
    assert(first.length >= 4, 'Several sample rooms');
    assert(first.some((r) => r.phase === 'inGame') && first.some((r) => r.visibility === 'private'), 'Mixed rooms');
    assert(first.every((r) => r.humans >= 1 && r.humans <= r.maxHumans), 'Counts in range');
    const running = first.find((r) => r.phase === 'inGame')!;
    clock += 60_000;
    const later = (await source.listRooms()).find((r) => r.id === running.id)!;
    assertEqual(clock - later.startedAt! - (clock - 60_000 - running.startedAt!), 0, 'The start time stays fixed');
    assertEqual((await source.findByCode(' k7mq '))?.id, 'room-1', 'Code lookup ignores case and spaces');
    assertEqual(await source.findByCode('ZZZZ'), null, 'Unknown code');
  });

  test('creating a room puts it first, waiting, with the host alone', async () => {
    const source = createMockRoomsSource({ latencyMs: 0 });
    const made = await source.createRoom({ name: ' הזירה ', visibility: 'private', host: 'אני' });
    assertEqual(made.name, 'הזירה', 'Name trimmed');
    assertEqual(made.humans, 1, 'Host alone');
    assertEqual((await source.listRooms())[0].id, made.id, 'Listed first');
  });

  test('the empty and offline states exist for design checks', async () => {
    assertEqual((await createMockRoomsSource({ empty: true, latencyMs: 0 }).listRooms()).length, 0, 'Empty');
    let failed = false;
    try { await createMockRoomsSource({ fail: true, latencyMs: 0 }).listRooms(); } catch { failed = true; }
    assert(failed, 'Offline throws');
  });
});
