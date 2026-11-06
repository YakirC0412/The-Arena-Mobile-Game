// Entry point for `npm test` in server/: registers every suite, then runs them (same tiny runner as the game).
import './gameLoop.test';
import './auth.test';
import './liveDuel.test';
import { runAll } from '../../mobile/tests/harness';

runAll();
