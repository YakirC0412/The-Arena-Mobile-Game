import { createInitialGame, getNeighborPlayerIds, createBattleSetup, resolveBattle } from '../src/game/engine';
import { by, genderOfAvatar } from '../src/game/gender';
import { createSeededRandom } from '../src/game/rng';
import { createEmptyStore, signUp } from '../src/services/accounts/accounts';
import { assert, assertEqual, suite, test } from './harness';

suite('gender: texts follow the player', () => {
  test('by() picks the masculine or feminine form, and avatars know their gender', () => {
    assertEqual(by({ gender: 'male' }, 'ניצח', 'ניצחה'), 'ניצח', 'Male');
    assertEqual(by({ gender: 'female' }, 'ניצח', 'ניצחה'), 'ניצחה', 'Female');
    assertEqual(by(undefined, 'ניצח', 'ניצחה'), 'ניצח', 'Unknown defaults to male');
    assertEqual(genderOfAvatar('avatar-01'), 'female', 'Avatar 01 is a woman');
    assertEqual(genderOfAvatar('avatar-02'), 'male', 'Avatar 02 is a man');
  });

  test('the duel summary uses the winner\'s own form, with no slashes', () => {
    for (const gender of ['female', 'male'] as const) {
      const state = createInitialGame('countries', createSeededRandom(3), 'נועם', 'avatar-02', 'w1', gender);
      assertEqual(state.players.human.gender, gender, 'The human keeps the chosen gender');
      const target = getNeighborPlayerIds(state, 'human')[0];
      const summary = resolveBattle(state, createBattleSetup(state, 'human', target), 'human').summary;
      assert(summary.includes(gender === 'female' ? 'ניצחה בהתקפה' : 'ניצח בהתקפה'), `Summary form (${gender}): ${summary}`);
      assert(!/[א-ת]\/[הת]/.test(summary), `No slash forms: ${summary}`);
    }
  });

  test('bots get the gender of their picture', () => {
    const state = createInitialGame('countries', createSeededRandom(5));
    for (const player of Object.values(state.players)) assertEqual(player.gender, genderOfAvatar(player.avatar), `${player.name} matches the picture`);
  });

  test('sign-up needs a gender', () => {
    const base = { fullName: 'נועם כהן', email: 'n@example.com', nickname: 'נועם', password: 'secret1', avatar: 'avatar-02' };
    const missing = signUp(createEmptyStore(), { ...base, gender: undefined as never }, 'u', 's');
    assert(!missing.ok && !!missing.errors.gender, 'A missing gender is an error');
    const ok = signUp(createEmptyStore(), { ...base, gender: 'female' }, 'u', 's');
    assert(ok.ok && ok.user.gender === 'female', 'The chosen gender is kept');
  });
});
