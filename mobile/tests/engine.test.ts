import {
  chooseAiTarget,
  createFinalBattleSetup,
  createBattleSetup,
  createInitialGame,
  getActivePlayers,
  getFinalCategoryChooser,
  getNeighborPlayerIds,
  isCorrectAnswer,
  resolveBattle,
} from '../src/game/engine';
import { AVATARS } from '../src/content/avatars';
import type { GameState } from '../src/game/types';
import { assert, suite, test } from './harness';

const fixedRandom = () => 0;

// Human on cells 0–8, one opponent on cells 9–15: a ready-made final.
function createFinalState(): { state: GameState; opponentId: string } {
  const initial = createInitialGame('animals', fixedRandom);
  const opponentId = initial.cells[9].ownerId;
  const humanCells = initial.cells.slice(0, 9).map((cell) => cell.id);
  const opponentCells = initial.cells.slice(9).map((cell) => cell.id);
  const state: GameState = {
    ...initial,
    cells: initial.cells.map((cell) => ({
      ...cell,
      ownerId: humanCells.includes(cell.id) ? 'human' : opponentId,
    })),
    players: Object.fromEntries(Object.entries(initial.players).map(([id, player]) => [
      id,
      id === 'human'
        ? { ...player, cellIds: humanCells, isActive: true }
        : id === opponentId
          ? { ...player, cellIds: opponentCells, isActive: true }
          : { ...player, cellIds: [], isActive: false },
    ])),
    selectedPlayerId: 'human',
  };
  return { state, opponentId };
}

suite('setup', () => {
  test('a new game has 16 active players and keeps the human category', () => {
    const initial = createInitialGame('animals', fixedRandom);
    assert(getActivePlayers(initial).length === 16, 'A new game must have 16 active players');
    assert(initial.players.human.categoryId === 'animals', 'The human category must be preserved');
    assert(getNeighborPlayerIds(initial, 'human').length === 2, 'A corner territory must have two neighbors');
  });

  test('avatars are unique and bot names match avatar gender', () => {
    const state = createInitialGame('animals', fixedRandom, 'שחקן בדיקה', 'avatar-16');
    const assigned = Object.values(state.players).map((player) => player.avatar);
    assert(new Set(assigned).size === 16, 'Every arena player must receive a unique avatar');
    assert(state.players.human.avatar === 'avatar-16', 'The selected human avatar must be preserved');
    const femaleNames = new Set(['נועה', 'מאיה', 'ליה', 'רוני', 'תמר', 'שירה', 'יעל', 'דנה', 'איילת', 'מיכל', 'נעמה', 'הדר']);
    const maleNames = new Set(['עומר', 'איתי', 'יונתן', 'דניאל', 'אורי', 'נועם', 'גיא', 'אדם', 'יואב', 'רועי', 'אופיר', 'אלון']);
    for (const player of Object.values(state.players).filter((candidate) => !candidate.isHuman)) {
      const gender = AVATARS.find((avatar) => avatar.id === player.avatar)?.gender;
      assert(
        gender === 'female' ? femaleNames.has(player.name) : maleNames.has(player.name),
        `Avatar gender and player name must match for ${player.id}`,
      );
    }
  });
});

suite('battle results', () => {
  test('a winning attacker takes the whole territory and keeps its category', () => {
    const initial = createInitialGame('animals', fixedRandom);
    const target = getNeighborPlayerIds(initial, 'human')[0];
    const win = resolveBattle(initial, createBattleSetup(initial, 'human', target), 'human');
    assert(win.state.players.human.cellIds.length === 2, 'Attacker must inherit the whole territory');
    assert(win.state.players.human.categoryId === 'animals', 'Winning attacker must keep its category');
    assert(!win.state.players[target].isActive, 'Losing player must be eliminated');
    assert(
      win.state.players.human.cellIds.every((cellId) => win.state.cells[cellId].ownerId === 'human'),
      'Every conquered cell must belong to the winning attacker',
    );
  });

  test('multi-cell territories move as one unit and fight on the defender category', () => {
    const base = createInitialGame('animals', fixedRandom);
    const defenderId = getNeighborPlayerIds(base, 'human').find((id) => base.players[id].cellIds[0] === 1)!;
    const farOwnerId = base.cells[2].ownerId;
    const expanded = resolveBattle(base, createBattleSetup(base, defenderId, farOwnerId), defenderId).state;
    assert(expanded.players[defenderId].cellIds.length === 2, 'A territory must grow into connected cells');

    const setup = createBattleSetup(expanded, 'human', defenderId);
    assert(setup.categoryId === expanded.players[defenderId].categoryId, 'A duel must use the defender category');
    const win = resolveBattle(expanded, setup, 'human');
    assert(win.state.players.human.cellIds.length === 3, 'Defeating a territory transfers all of its cells');
    assert(win.state.players.human.categoryId === 'animals', 'An attacking winner keeps its category');

    const defended = resolveBattle(expanded, createBattleSetup(expanded, defenderId, 'human'), 'human');
    assert(defended.state.players.human.cellIds.length === 3, 'A defending winner receives every attacker cell');
    assert(
      defended.state.players.human.categoryId === expanded.players[defenderId].categoryId,
      'A defending winner inherits the losing attacker category',
    );
  });

  test('a winning defender inherits the attacker category', () => {
    const state = createInitialGame('animals', fixedRandom);
    const target = getNeighborPlayerIds(state, 'human')[0];
    const before = state.players[target].categoryId;
    const win = resolveBattle(state, createBattleSetup(state, 'human', target), target);
    assert(win.inheritedCategory, 'A winning defender must inherit the attacker category');
    assert(win.state.players[target].categoryId === 'animals', 'Defender must receive the attacker category');
    assert(before !== win.state.players[target].categoryId, 'Defender category should change');
  });

  test('a winner outside the duel is rejected', () => {
    const state = createInitialGame('animals', fixedRandom);
    const setup = createBattleSetup(state, 'human', getNeighborPlayerIds(state, 'human')[0]);
    let rejected = false;
    try {
      resolveBattle(state, setup, 'not-a-participant');
    } catch {
      rejected = true;
    }
    assert(rejected, 'A battle result must reject a winner outside the duel');
  });

  test('bots only target adjacent active opponents', () => {
    const state = createInitialGame('animals', fixedRandom);
    assert(
      getNeighborPlayerIds(state, 'human').includes(chooseAiTarget(state, 'human', fixedRandom)!),
      'AI target selection must choose an adjacent active opponent',
    );
  });
});

suite('final', () => {
  test('the larger finalist chooses, from either finalist category', () => {
    const { state, opponentId } = createFinalState();
    assert(getFinalCategoryChooser(state)?.id === 'human', 'The larger finalist must choose the final category');
    const setup = createFinalBattleSetup(state, 'human', state.players[opponentId].categoryId);
    assert(setup.isFinal === true, 'The final battle setup must be marked as final');
    assert(setup.categoryId === state.players[opponentId].categoryId, 'The chooser may pick the opponent category');
  });

  test('the last battle winner breaks an 8–8 tie', () => {
    const { state, opponentId } = createFinalState();
    const tied: GameState = {
      ...state,
      cells: state.cells.map((cell, index) => ({ ...cell, ownerId: index < 8 ? 'human' : opponentId })),
      players: {
        ...state.players,
        human: { ...state.players.human, cellIds: state.cells.slice(0, 8).map((cell) => cell.id) },
        [opponentId]: { ...state.players[opponentId], cellIds: state.cells.slice(8).map((cell) => cell.id) },
      },
      selectedPlayerId: opponentId,
    };
    assert(getFinalCategoryChooser(tied)?.id === opponentId, 'The last battle winner must break an 8-8 tie');
  });
});

suite('answers', () => {
  test('final Hebrew letters and punctuation do not matter', () => {
    assert(isCorrectAnswer('פילים', 'פילים', []), 'Exact answer must match');
    assert(isCorrectAnswer('פילימ', 'פילים', []), 'Final mem typed as regular mem must match');
    assert(isCorrectAnswer(' ג׳ירפה ', 'ג׳ירפה', []), 'Spaces and geresh must be ignored');
    assert(isCorrectAnswer('ארהב', 'ארצות הברית', ['ארה״ב']), 'Aliases must match');
    assert(!isCorrectAnswer('פי', 'פיל', []), 'A partial answer must not match');
  });
});
