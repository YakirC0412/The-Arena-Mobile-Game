// Entry point for `npm run test:engine`: registers every suite, then runs them.
import './engine.test';
import './rules.test';
import './random-games.test';
import './content.test';
import './flow.test';
import './accounts.test';
import './skip.test';
import './ways.test';
import { runAll } from './harness';

runAll();
