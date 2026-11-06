import { CATEGORY_BY_ID } from '../src/content/categories';
import { createGame, drawArenaCategories, getHumanPlayerIds } from '../src/game/engine';
import type { HumanSeat } from '../src/game/engine';
import { createSeededRandom } from '../src/game/rng';
import { assert, assertEqual, suite, test } from './harness';

const SEATS: HumanSeat[] = [
  { id: 'u1', name: 'דנה', avatar: 'avatar-01', categoryId: 'animals', wayId: 'w1', userId: 'user-1' },
  { id: 'u2', name: 'רון', avatar: 'avatar-02', categoryId: 'countries', wayId: 'w2', userId: 'user-2' },
  { id: 'u3', name: 'גיא', avatar: 'avatar-03', categoryId: 'fruit' },
];

suite('multiplayer: several humans in one arena', () => {
  test('3 humans and 13 bots: 16 players, every category different, the humans keep their choices', () => {
    const state = createGame(SEATS, createSeededRandom(5));
    const players = Object.values(state.players);
    assertEqual(players.length, 16, 'Players');
    assertEqual(new Set(players.map((player) => player.categoryId)).size, 16, 'Unique categories');
    assertEqual(getHumanPlayerIds(state).sort().join(), 'u1,u2,u3', 'Human seats');
    assertEqual(state.players.u1.categoryId, 'animals', 'First human category');
    assertEqual(state.players.u2.categoryId, 'countries', 'Second human category');
    assertEqual(state.players.u2.wayId, 'w2', 'Second human way');
    assertEqual(state.players.u1.userId, 'user-1', 'Seat remembers the account');
    assertEqual(players.filter((player) => !player.isHuman).length, 13, 'Bots fill the rest');
  });

  test('every human has their own cell, every cell has one owner, bots are numbered ai-1 to ai-13', () => {
    const state = createGame(SEATS, createSeededRandom(11));
    assertEqual(new Set(state.cells.map((cell) => cell.ownerId)).size, 16, 'One cell per player');
    const humanCells = SEATS.map((seat) => state.players[seat.id].cellIds[0]);
    assertEqual(new Set(humanCells).size, 3, 'Different cells for humans');
    const botIds = Object.keys(state.players).filter((id) => id.startsWith('ai-')).sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
    assertEqual(botIds.join(), Array.from({ length: 13 }, (_, i) => `ai-${i + 1}`).join(), 'Bot ids');
  });

  test('avatars are not repeated and the same seed makes the same game', () => {
    const first = createGame(SEATS, createSeededRandom(9));
    const second = createGame(SEATS, createSeededRandom(9));
    assertEqual(JSON.stringify(first), JSON.stringify(second), 'Deterministic');
    assertEqual(new Set(Object.values(first.players).map((player) => player.avatar)).size, 16, 'Unique avatars');
  });

  test('a seat count outside 1 to 16, repeated seat ids, repeated categories or unknown categories are refused', () => {
    const rejects = (seats: HumanSeat[]) => { try { createGame(seats, createSeededRandom(1)); return false; } catch { return true; } };
    assert(rejects([]), 'No humans');
    assert(rejects(Array.from({ length: 17 }, (_, i) => ({ id: `h${i}`, name: 'x', categoryId: 'animals' }))), '17 humans');
    assert(rejects([SEATS[0], { ...SEATS[1], id: 'u1' }]), 'Same seat id');
    assert(rejects([SEATS[0], { ...SEATS[1], categoryId: 'animals' }]), 'Same category');
    assert(rejects([{ id: 'x', name: 'x', categoryId: 'no-such-category' }]), 'Unknown category');
  });

  test('bot categories skip everything the humans took, and a smaller bot count keeps the level spread', () => {
    const random = createSeededRandom(3);
    const ten = drawArenaCategories(['animals', 'countries', 'fruit', 'technology', 'birds', 'vehicles'], random, 10);
    assertEqual(ten.length, 10, 'Ten bot categories');
    assertEqual(new Set(ten).size, 10, 'No repeats');
    assert(!ten.some((id) => ['animals', 'countries', 'fruit', 'technology', 'birds', 'vehicles'].includes(id)), 'Taken ones skipped');
    assert(ten.filter((id) => CATEGORY_BY_ID[id].level === 'hard').length <= 3, 'At most 3 hard');
    assertEqual(drawArenaCategories(['animals'], random, 0).length, 0, 'Zero bots needs no categories');
  });

  test('16 humans means no bots at all', () => {
    const ids = Object.keys(CATEGORY_BY_ID).filter((id) => CATEGORY_BY_ID[id].status === 'active').slice(0, 16);
    if (ids.length < 16) return;
    const seats = ids.map((categoryId, i) => ({ id: `h${i}`, name: `p${i}`, categoryId }));
    const state = createGame(seats, createSeededRandom(2));
    assertEqual(getHumanPlayerIds(state).length, 16, 'All humans');
  });
});
