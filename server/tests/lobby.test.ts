import { CATEGORY_BY_ID } from '../../mobile/src/content/categories';
import { createGame } from '../../mobile/src/game/engine';
import { createSeededRandom } from '../../mobile/src/game/rng';
import { assert, assertEqual, suite, test } from '../../mobile/tests/harness';
import { Lobby, MAX_HUMANS } from '../src/lobby';

const CATS = Object.keys(CATEGORY_BY_ID).filter((id) => CATEGORY_BY_ID[id].status === 'active');
const room = () => new Lobby('חדר', 'ABCD', 'public');
const add = (lobby: Lobby, id: string) => lobby.join({ clientId: id, userId: Number(id.replace(/\D/g, '') || 1), name: id });
const errorOf = (r: { ok: boolean; error?: string }) => (r.ok ? 'ok' : r.error);

suite('lobby (rooms before the game)', () => {
  test('the first person is the host; the host role moves on when the host leaves; an empty room reports it', () => {
    const lobby = room();
    add(lobby, 'a'); add(lobby, 'b'); add(lobby, 'c');
    assertEqual(lobby.hostId, 'a', 'First is host');
    assertEqual(lobby.leave('a'), false, 'Not empty');
    assertEqual(lobby.hostId, 'b', 'Next person is host');
    lobby.leave('b');
    assertEqual(lobby.leave('c'), true, 'Empty room');
  });

  test('at most 6 humans', () => {
    const lobby = room();
    for (let i = 1; i <= MAX_HUMANS; i += 1) assert(add(lobby, `p${i}`).ok, 'Joins');
    assertEqual(errorOf(add(lobby, 'p7')), 'room_full', 'Seventh refused');
  });

  test('a category belongs to one person; switching frees the old one at once', () => {
    const lobby = room();
    add(lobby, 'a'); add(lobby, 'b');
    assert(lobby.pickCategory('a', CATS[0]).ok, 'A picks');
    assertEqual(errorOf(lobby.pickCategory('b', CATS[0])), 'category_taken', 'B refused');
    assert(lobby.pickCategory('a', CATS[1]).ok, 'A switches');
    assert(lobby.pickCategory('b', CATS[0]).ok, 'The old one is free now');
    assert(lobby.pickCategory('b', CATS[0]).ok, 'Picking your own again is fine');
    assertEqual(lobby.view().takenCategoryIds.sort().join(), [CATS[0], CATS[1]].sort().join(), 'Taken list');
  });

  test('unknown categories, hidden ones, bad ways and strangers are refused', () => {
    const lobby = room();
    add(lobby, 'a');
    assertEqual(errorOf(lobby.pickCategory('a', 'no-such')), 'unknown_category', 'Unknown');
    const hidden = Object.keys(CATEGORY_BY_ID).find((id) => CATEGORY_BY_ID[id].status !== 'active');
    if (hidden) assertEqual(errorOf(lobby.pickCategory('a', hidden)), 'unknown_category', 'Hidden reserve');
    assertEqual(errorOf(lobby.pickCategory('a', CATS[0], 'w9' as never)), 'bad_way', 'Bad way');
    assertEqual(errorOf(lobby.pickCategory('zzz', CATS[0])), 'not_a_player', 'Stranger');
  });

  test('only the host starts, with 2+ humans who all have a category', () => {
    const lobby = room();
    add(lobby, 'a');
    lobby.pickCategory('a', CATS[0]);
    assertEqual(errorOf(lobby.canStart('a')), 'need_more_players', 'Alone');
    add(lobby, 'b');
    assertEqual(errorOf(lobby.canStart('a')), 'need_categories', 'b has no category');
    lobby.pickCategory('b', CATS[1]);
    assertEqual(errorOf(lobby.canStart('b')), 'not_host', 'Not the host');
    assert(lobby.view().canStart, 'The view says it can start');
    assert(lobby.start('a').ok, 'Host starts');
    assertEqual(errorOf(lobby.start('a')), 'already_started', 'Not twice');
    assertEqual(errorOf(add(lobby, 'c')), 'in_game', 'Nobody joins a game in progress');
    assertEqual(errorOf(lobby.pickCategory('a', CATS[2])), 'already_started', 'No switching after the start');
  });

  test('the seats it hands over make a real game: humans keep their categories, bots fill to 16', () => {
    const lobby = room();
    add(lobby, 'a'); add(lobby, 'b'); add(lobby, 'c');
    lobby.pickCategory('a', CATS[0]); lobby.pickCategory('b', CATS[1]); lobby.pickCategory('c', CATS[2], 'w1');
    const started = lobby.start('a');
    assert(started.ok, 'Started');
    if (!started.ok) return;
    const state = createGame(started.seats, createSeededRandom(8));
    assertEqual(Object.keys(state.players).length, 16, 'Sixteen seats');
    assertEqual(state.players.b.categoryId, CATS[1], 'Choice kept');
    assertEqual(Object.values(state.players).filter((player) => player.isHuman).length, 3, 'Three humans');
    assertEqual(new Set(Object.values(state.players).map((player) => player.categoryId)).size, 16, 'All categories different');
  });

  test('leaving after picking frees the category for others', () => {
    const lobby = room();
    add(lobby, 'a'); add(lobby, 'b');
    lobby.pickCategory('b', CATS[0]);
    lobby.leave('b');
    assert(lobby.pickCategory('a', CATS[0]).ok, 'Free again');
  });
});
