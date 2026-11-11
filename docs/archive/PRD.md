# THE ARENA – PRD v0.2

Based on a review of the local prototype dated 24.10.2026 (code, assets and the decisions questionnaire). This document is written so it can be handed over as-is to ChatGPT or a development team.

## 0. Instructions for the reader (ChatGPT)

- Your role: lead architect and developer of the game. This document is the source of truth.
- Wherever something is marked **[Open decision]**, ask me before implementing.
- Priorities, in order: design, visuals, programming, functionality. Out of scope for now: legal, monetization, app-store publishing.
- Work according to the phases in section 8. In each phase return complete code, tests and acceptance criteria.
- Before touching Expo/React Native, read the documentation matching the version in package.json (the project's AGENTS.md says the same). Do not rely on memory.

## 1. Product summary

A multiplayer visual trivia game. The arena is a 4×4 grid of cells, 16 contestants, and each cell has a unique category (animals, countries, fruit, and so on).

- A drawn contestant picks a valid adjacent opponent (up, down, left, right) and a duel starts on the defender's category.
- In a duel, contestants identify images by typing. Each has a 40-second clock, and the clock runs only for the player whose turn it is. A correct answer passes the turn; a skip costs 3 seconds.
- Whoever's clock runs out loses, is eliminated, and all of their territory goes to the winner.
- Every duel eliminates exactly one player, so a full game is 15 duels until a champion remains.
- Three consecutive wins as the attacker grant a bonus: 45 seconds in the fourth duel.

**Current state:** one human player against 15 computer players, local only.
**Goal:** several real users playing simultaneously, against each other and against bots.

## 2. Current state – review findings

**What exists:** an Expo/React Native app (Expo Router, Reanimated, TypeScript, dark mode only). 16 categories × 24 items = 384 items. 16 avatars. About 20 screens covering registration, arena build, draw, battle start, battle, conquest, final and champion celebration. The game-rules engine lives in a separate file, engine.ts, with an engine smoke-test script, and there are QA screens for each flow.

**What is good:** the engine is pure functions with no UI dependency, so it can run on a server almost as-is. Content, engine and screens are separated.

**A note on the MD files:** README.md and AGENTS.md come from the Expo template and contain no game rules. All the rules exist only in the docx questionnaire. A GAME_RULES.md should be created in the repo (section 8, phase 0).

## 3. Game rules – consolidated version based on the questionnaire

1. 16 contestants, one per cell, each cell with a unique category. The prototype uses 16 fixed categories; later, a draw from a larger pool.
2. Adjacency is orthogonal only, no diagonals.
3. Contestants are drawn in rounds. A round ends when everyone has played, and then it resets.
4. The drawn contestant is valid if they have an adjacent opponent. Territory of several cells counts as a single unit, and an attack can start from any cell on its border.
5. A loss means elimination, and losing all cells to the winner.
6. Clocks: 40 seconds each, 45 with a bonus. Only one bonus can be held at a time, and it is used in the fourth duel.
7. A wrong answer keeps the turn and the clock keeps running. Unlimited attempts with a very short delay between submissions. A skip costs 3 seconds and replaces the image within the same turn.
8. After a correct answer there is a 0.7–1.0 second pause with no time deducted.
9. An image does not repeat in the same game. If the pool runs out, it is reshuffled.
10. Returning to the arena after a win resets the streak.
11. Final: when two remain, the larger of the two chooses a category from the two categories they hold.
12. Hebrew only, no content filtering. Content must be clean of racism, profanity, gender and sexual content. Personal use only, no game saving.

## 4. Gaps, contradictions and missing items

The gaps were found by comparing the questionnaire to the code.

**A. Three decisions are not defined well enough (questionnaire questions 2, 10, 11) [Open decision]:**
- The questionnaire says "a category belongs to you as long as it hasn't been played", i.e. a category that has been played is "burned". The code does not implement this at all.
- In the code, an attacker who wins does **not** inherit the defender's category and stays with their own. A defender who wins **does** inherit the attacker's category. According to the questionnaire the wording is the reverse, or at least not unambiguous.
- One decision table is needed: who inherits which category in each outcome, what happens to a burned category, and what happens when a contestant holds several categories.

**B. Win streak (question 21):** the questionnaire states that returning to the arena resets the streak. In the code, returnToArena does nothing to winStreak. This is a bug.

**C. "A cell that has played" (questions 8–9):** in the code, hasPlayedThisRound is set only for whoever was drawn. Whoever was a defender is not marked. If the intent is anyone who took part in a duel, this must change [Open decision].

**D. Delay between submissions (question 16):** does not exist. The answer is checked on every keystroke (onChangeText) and there is no submit button. This is convenient for typists but hard on a Hebrew keyboard with autocorrect and in a multiplayer setting. Decide between automatic submission and Enter.

**E. Answer normalization:** there is no handling of Hebrew final letters (ם/מ, ן/נ, ך/כ, ף/פ, ץ/צ) and no partial matching. In the prototype that is allowed per the questionnaire, but for a real player it would be frustrating.

**F. Game length and waiting players (critical for multiplayer):** 15 duels in a row, each lasting up to about 80 seconds. Everyone else only watches. See section 7.

**G. Content data:** a duplicate alias "נמר" in the animals category (an alias of tiger and also the answer for leopard). Some items are unclear emoji combinations such as 🔴👑 for pomegranate. Difficulty level is determined by position in the list (first third easy, and so on) and not by real data.

## 5. Improvements – design and visuals

1. **Design system:** define tokens (colors, spacing, radii, shadows, typography) in a single file. Today colors are scattered across the styles of every screen.
2. **Font:** replace the Calibri injection with !important in _layout.tsx (which works on web only) with a Hebrew font loaded via expo-font, for example Heebo, Rubik or Assistant, with headings in a heavy weight.
3. **True RTL:** enable right-to-left direction at the system level, not only textAlign. Also check spacing and arrows.
4. **Unified image style:** currently only 24 items (12 animals and 12 fruit) are illustrations. The other 360 items use emoji, which look different on every operating system. A single illustration style for the whole deck is recommended.
5. **The arena board:** turn it into the main focal point: territories merged in the player's color with a rounded outline, rather than separate cells. A conquest animation that spreads from the attacking cell, a shadow trail after the battle, and a mini-map during the battle.
6. **Battle screen:** clocks as ticking coins, pulsing and red in the last ten seconds, "correct" and "skip" animations, and clear turn indicators (a glow around the active player).
7. **Feel:** haptic feedback for correct, wrong and time-up. Sound effects and background music with a mute button. A champion celebration with confetti.
8. **Accessibility:** contrast, dynamic font size, and screen-reader descriptions (some screens already have an accessibilityLabel).
9. **Asset cleanup:** remove the source sheets (animals-sheet.png at about 3.2MB, fruit-sheet.png at about 2.5MB), the duplicate jpg files and the template assets (react-logo, expo-badge, tabIcons). Convert to WebP.

## 6. Improvements – code and architecture

1. **State machine:** index.tsx manages about 20 screens using useState(screen) plus another four or five state variables. Replace it with a reducer or XState, so transitions are defined in one place and can be tested.
2. **Monorepo:** pnpm-workspace.yaml already exists. Proposed structure: `apps/mobile`, `apps/server`, `packages/game-core` (the engine and types) and `packages/content` (categories and items). See section 12.
3. **Determinism:** the engine uses Math.random and Date.now (for event identifiers). Move to a seeded random generator for each game, so a game can be replayed and verified on a server.
4. **Logic leaking into the UI:** the decision whether to continue attacking is made in battle-transitions.tsx using Math.random() < 0.38, and all bot behavior in battle is inside battle-view.tsx. This should move into the engine.
5. **Content validation:** a Zod schema, or equivalent, for an item (answer, aliases, difficulty, image identifier), and a script that checks for duplicate aliases, missing image files and missing difficulty.
6. **Tests:** today there is a single smoke script. Move to Jest or Vitest with unit tests for every rule in section 3, property-based tests (in every random game exactly 15 duels and one champion remain), and basic E2E.
7. **QA screens:** 11 qa-*.tsx files sit in src/app and therefore ship as routes in a production build. Restrict them to __DEV__.
8. **Registration screen:** collects only a name, nickname and avatar. There is no real login. It is required for multiplayer (section 7).
9. **Cleanup:** empty folders (ui, hooks, constants), reset-project.js, the template README, and the web.output="server" setting, which is unclear whether it is needed.
10. **CI:** lint, typecheck and tests on every PR, and builds via EAS.

## 7. Multiplayer – requirements and design

**Principle:** an authoritative server. The server holds the game state, runs the duel clocks, checks the answers and decides who wins. The client only displays and sends intents.

**Requirements:**
- The correct answers are not sent to the client. Today the entire deck is in the app bundle, so cheating is possible. The client receives only the image, and the check happens on the server.
- A server-side clock with network-latency compensation, and a fast resynchronization after a disconnect.
- Rooms with a join code and with matchmaking, filling empty slots with bots (up to 16).
- Disconnect in the middle of a game: reconnect within a defined time, and after that a bot takes over the contestant.
- Watching other people's duels as the default (a shortened simulation or live broadcast).

**[Open decision] – waiting players:** with 16 humans, 14 of them wait during each duel. Options:
- A. Sequential duels with live viewing and predictions (simple, but a long wait for those waiting).
- B. Simultaneous duels between pairs that do not share a cell, with progress in real time (more energy, but changes the dynamics of the draw).
- C. Small rooms of 4–8 players instead of 16.

Recommendation: start with A, using bots and humans mixed, and examine it in a playtest.

**Recommended technology:** Colyseus (a TypeScript server with rooms and state synchronization), because it lets packages/game-core run on the server exactly as it is. Alternative: Supabase (Realtime and authentication) with Edge Functions, or a small Node server. The choice between the two is an **[Open decision]**.

## 8. Work plan

Every phase ends with acceptance criteria that can be verified. The estimates are orders of magnitude for development with AI assistance, not commitments.

**Phase 0 – Close the decisions (2–3 days)**
- Resolve section 4 (A, C, D) in a single decision table.
- Write GAME_RULES.md in the repo and update the questionnaire.
- *Acceptance:* every rule in section 3 has a written example scenario.

**Phase 1 – Code foundations (1 week)**
- Monorepo, extraction of game-core and content, and Jest or Vitest.
- Fix the streak bug (4B), a seeded random generator, and moving the bot logic into the engine.
- A content schema and validation script, and fixing the duplicate alias.
- A state machine for the screens, and restricting QA screens to __DEV__.
- *Acceptance:* a thousand random games in the tests always end with exactly 15 duels and one champion. CI is green.

**Phase 2 – Design and visuals system (1.5–2 weeks)**
- Tokens, a Hebrew font and RTL.
- A new design of the arena board and of the battle screen according to section 5.
- Haptics, sound and transition animations.
- *Acceptance:* run on iOS, Android and web without material visual differences. A full duel with no dropped frames on a mid-range device.

**Phase 3 – Content (1 week, in parallel)**
- A single illustration style for all 384 items, or at least for the first 8 categories.
- Difficulty as explicit data in each item, and additional aliases (including final letters).
- A content-cleanup policy (no racism, profanity, gender or sexual content) and an automated check for it.
- *Acceptance:* no item without an illustration. No duplicate alias within a category.

**Phase 4 – Multiplayer alpha (2–3 weeks)**
- An authoritative server, rooms, and basic login and profile.
- Duel synchronization: clock, turn, answers and result. Reconnection.
- A lobby, join by code, and watching other people's duels.
- *Acceptance:* a full game with 4 real devices and 12 bots, including a disconnect and reconnect by one player.

**Phase 5 – Hardening and release (2 weeks)**
- Load tests, protection against cheating, and rate limiting on submissions.
- Analytics: game length, success rate per category, attacker vs defender advantage.
- A playtest with 10–20 people and balancing.
- *Acceptance:* 90% of games complete without a fault. Average game length within the target range.

## 9. Recommended plugins and libraries

Install using `npx expo install` to get versions matching the SDK (as AGENTS.md states). Before installing, verify compatibility with the versions in package.json.

**Visuals and feel**
- @shopify/react-native-skia – shadows, glows, gradients, confetti and region shapes on the board.
- lottie-react-native – conquest, elimination and celebration animations (Lottie files, e.g. from LottieFiles).
- expo-haptics – haptic feedback.
- expo-audio – sound and music.
- expo-linear-gradient – backgrounds. expo-glass-effect is already in the project.
- react-native-reanimated and gesture-handler are already in the project and can stay.

**Code and quality**
- Zustand or XState – state management and a screen state machine.
- Zod – schemas for content and for network messages.
- Vitest or Jest – engine tests. Maestro – native E2E tests.
- seedrandom – a seeded random generator.
- Sentry – crash reporting. Storybook for React Native – developing components in isolation.

**Multiplayer**
- Colyseus (server and client) or Supabase (Realtime and Auth).
- expo-secure-store – storing a token. NetInfo – detecting disconnects.

**Hebrew and language**
- expo-localization and i18next – ready for adding English later.
- Fonts: Heebo, Rubik or Assistant (Google Fonts).

**Working tools**
- EAS Build and EAS Update. Figma for screen design. Cursor or Claude Code for development against the repo.

## 10. Risks and success metrics

**Risks:** players waiting (section 7), accuracy of Hebrew input on a phone keyboard, visual consistency of the image deck, and the cost of producing illustrations for 384 items or more.

**Metrics:** average game length, drop-off rate mid-game, attacker vs defender win balance (close to 50%), number of wrong attempts per item (to find items that are too hard or missing aliases), and network latency in a duel.

## 11. Suggested opening prompt for ChatGPT

> I am building a game called THE ARENA. A PRD is attached. Start with phase 0: create a decision table for section 4 (A, C, D) with closed questions I can answer with A/B/C, and then write GAME_RULES.md. Do not start writing code before I approve the table. In every phase after that, return: a list of files to change, full code, tests and acceptance criteria.

## 12. Proposed folder and file structure

The structure below is a monorepo (pnpm workspaces, which already exists in the project). The principle: game logic lives in a separate package with no dependency on React or Expo, so both the app and the server use the same code.

```
the-arena/
├─ apps/
│  ├─ mobile/                    # Expo app (the existing code)
│  │  ├─ app/                    # Expo Router routes only, thin files
│  │  │  ├─ _layout.tsx
│  │  │  ├─ index.tsx            # entry, routes to screens
│  │  │  └─ (dev)/qa-*.tsx       # QA screens, loaded only in __DEV__
│  │  ├─ src/
│  │  │  ├─ features/            # split by domain, not by file type
│  │  │  │  ├─ onboarding/       # welcome, auth, mode, guide
│  │  │  │  ├─ arena/            # board, build, draw
│  │  │  │  ├─ battle/           # battle-view, intro, outcome, simulation
│  │  │  │  ├─ final/            # final-category, final-reveal, champion
│  │  │  │  └─ lobby/            # phase 4: lobby and rooms
│  │  │  ├─ state/               # state machine (XState/reducer) and server connection
│  │  │  ├─ design/              # tokens, fonts, shared UI components
│  │  │  ├─ services/            # network, analytics, audio, haptics
│  │  │  ├─ i18n/                # he.json (and later en.json)
│  │  │  └─ hooks/
│  │  ├─ assets/
│  │  │  ├─ app/                 # icon, splash
│  │  │  ├─ avatars/
│  │  │  ├─ items/<category>/    # WebP only, file name = item id
│  │  │  ├─ audio/  fonts/  lottie/
│  │  ├─ app.json  eas.json  package.json  tsconfig.json
│  │
│  └─ server/                    # phase 4
│     ├─ src/
│     │  ├─ rooms/               # ArenaRoom: lobby, game, battle
│     │  ├─ services/            # answer checking, clock, authentication
│     │  ├─ bots/                # reuses game-core
│     │  └─ index.ts
│     └─ test/
│
├─ packages/
│  ├─ game-core/                 # pure TypeScript, no React
│  │  ├─ src/
│  │  │  ├─ rules/               # turn, battle, conquest, bonus, final
│  │  │  ├─ ai/                  # target choice and simulation
│  │  │  ├─ rng.ts               # seeded random generator
│  │  │  ├─ answers.ts           # answer normalization and comparison
│  │  │  ├─ protocol.ts          # Zod schemas for network messages
│  │  │  └─ types.ts
│  │  └─ tests/                  # replaces engine-smoke.ts
│  └─ content/
│     ├─ categories/*.json       # one file per category
│     ├─ schema.ts               # Zod
│     └─ scripts/validate.ts     # duplicates, missing images, missing difficulty
│
├─ docs/
│  ├─ PRD.md                     # this document
│  ├─ GAME_RULES.md              # final rules, source of truth
│  ├─ DECISIONS.md               # decision log (replaces the questionnaire)
│  ├─ ARCHITECTURE.md
│  ├─ DESIGN.md                  # tokens, illustration style, screen map
│  ├─ CONTENT_GUIDE.md           # content policy and item format
│  └─ archive/THE_ARENA_Open_Questions_Questionnaire_HE.docx
├─ .github/workflows/ci.yml      # lint, typecheck, test
├─ AGENTS.md                     # guidance for coding agents, updated for the monorepo
├─ README.md                     # quick start only
├─ package.json  pnpm-workspace.yaml  tsconfig.base.json
└─ .gitignore
```

### Mapping from the current state

- `src/game/engine.ts`, `types.ts` → `packages/game-core/src/`, split into rules, ai and answers.
- `src/game/content.ts` → `packages/content/categories/*.json`, with explicit difficulty per item.
- `src/game/avatars.ts`, `colors.ts` → `apps/mobile/src/design/`.
- `src/components/*` → `apps/mobile/src/features/*` by domain. The file battle-transitions.tsx (about 600 lines) is split into one file per screen.
- `src/media/*.ts` → `apps/mobile/src/services/` or `assets/`, later generated automatically from the image files.
- `scripts/engine-smoke.ts` → `packages/game-core/tests/`.
- `scripts/reset-project.js`, `assets/images/react-logo*`, `expo-badge*`, `tabIcons/`, empty folders → delete.
- `animals-sheet.png`, `fruit-sheet.png`, `source-sheet.jpg` → out of the repo (separate source storage), with the items as WebP.
- The questionnaire (docx) → `docs/archive/`, and its decisions move to `GAME_RULES.md` and `DECISIONS.md`.

### Working rules

- Route files in `app/` contain only imports and rendering. Logic and components live in `src/`.
- `game-core` does not import `react`, `react-native` or `expo`. An automated lint rule enforces this.
- File names in kebab-case, components in PascalCase, a test next to the file or in a tests folder.
- Branches: `main` stays stable, a branch per task, and a PR with green CI. Commit messages follow Conventional Commits.
- The move to a monorepo is part of phase 1 and is not required before phase 0.
