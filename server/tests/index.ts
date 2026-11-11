// Entry point for `npm test` in server/: registers every suite, then runs them (same tiny runner as the game).
import './auth.test';
import './firebase.test';
import './lobby.test';
import './onlineGame.test';
import { runAll } from '../../mobile/tests/harness';

runAll();
