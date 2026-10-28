# THE ARENA (הזירה) – context for Claude

Read this first. It replaces re-exploring the repo. Keep it short (under ~150 lines) and update the
**Status** and **Known issues** sections at the end of every work step.

## Product in one paragraph
Hebrew visual-trivia game. 4×4 board, 16 contestants, each with a unique category. A drawn contestant
attacks an orthogonal neighbor; the duel is on the defender's category; each side has a 40 s clock
(45 with bonus) that runs only on their turn; correct answer passes the turn, skip = −3 s. Loser is
eliminated and their territory goes to the winner. Always 15 duels → one champion.
Target: **web app opened in a phone browser (iPhone Safari first)** – no App Store / Play.
Now: local mode only (1 human vs 15 bots). Multiplayer comes after local is polished.

## The user
Hebrew-speaking beginner at vibe coding. Explain in Hebrew, step by step, show results in the
browser pane, ask before big or irreversible changes. Code, comments, commits: English.

## Run and check
- Node: `C:/Program Files/nodejs` (v24). In Bash first run `export PATH="/c/Program Files/nodejs:$PATH"`.
- No pnpm on the machine yet; use `npm run` / `npx` from `mobile/`.
- Dev server: browser preview config `arena-web` in `.claude/launch.json` → http://localhost:8090.
- Checks (from `mobile/`): `npx tsc --noEmit` · `npm test` (33 tests incl. 1000 seeded games) · lint is broken.
- Tests: `mobile/tests/*.test.ts` with a tiny runner (`tests/harness.ts`, no deps), entry `tests/index.ts`.
  New rule → new test in `tests/rules.test.ts`, named after the GAME_RULES section.
- Before calling a step done: typecheck + engine test + click through the flow in the browser pane.

## Repo map
```
THE_Arena/            git root (run git commands here)
├─ CLAUDE.md          this file
├─ README.md          short Hebrew intro for the user
├─ docs/              GAME_RULES.md (rules source of truth) · DECISIONS.md · ROADMAP.md
│                     PRD.md · UIUX_SPEC.md · archive/ (original questionnaire)
├─ archive/           NOT in git: old zip, Codex tooling, files removed from the app
├─ .claude/           launch.json for the preview server
└─ mobile/            Expo SDK 58 app (expo-router, reanimated, RN web)
   ├─ AGENTS.md       Expo rules – read before touching any Expo/RN API
   ├─ assets/         app/ (icons, splash) · avatars/ · items/<category>/ · sounds/ · expo.icon (iOS)
   ├─ scripts/        generate-feedback-sounds.js
   ├─ tests/          engine, rules, random-games, content tests
   └─ src/
      ├─ app/         routes only: _layout.tsx · index.tsx (renders GameFlow) · (dev)/qa-*.tsx
      ├─ game/        engine.ts (rules, bot decisions, autoPlayGame) · flow.ts (screen reducer) · rng.ts · types.ts
      │               pure TS, no React, relative imports only; never call Math.random – take a RandomSource
      ├─ content/     categories.ts (16×24 items) · avatars.ts · item-images.ts · avatar-images.ts
      ├─ features/
      │  ├─ flow/        game-flow.tsx renders FlowState → screens · arena-screen · setup · result
      │  ├─ onboarding/  welcome · auth · game-mode · guide
      │  ├─ arena/       arena-board · build · draw animation · mini-map · territory-layout
      │  ├─ battle/      battle-view (human duel) · clock cards · intro · AI target/decision/simulation
      │  │               · outcome · conquest animation · bonus popup
      │  └─ final/       final reveal · final category · champion celebration · game over
      ├─ design/      tokens.ts (all colors/sizes) · app-text · buttons · avatar-portrait · colors
      └─ services/    use-game-feedback.ts (sound + haptics, session mute)
```

## Rules for changes
- All UI text Hebrew (RTL). Use `AppText` and tokens from `design/tokens.ts`; no raw hex, no font < 12.
- `game/` and `content/categories.ts`, `content/avatars.ts` must not import React/RN/Expo
  (they compile under Node for `test:engine`). Use relative imports there, `@/` elsewhere.
- A change to game behavior → update `docs/GAME_RULES.md` + a test. A product decision → `docs/DECISIONS.md`.
- One git commit per step (Conventional Commits). Never delete user files – move them to `archive/`.
- QA screens live in `src/app/(dev)/` and are redirected away in production builds.

## Status (update every step)
- 26.10.26 – Phase 0 done: Node installed, git history started, folder restructured, big files split.
- 26.10.26 – Phase 1 done: streak/bonus rules, seeded RNG, bot decisions in engine, 0.7–1.0 s pause,
  28 tests, web.output = single. Bot levels postponed.
- 28.10.26 – Phase 2 done: all screen transitions in `game/flow.ts` (pure reducer, seeded via
  `randomState`); decision 5 built (loss → auto-play → champion → main menu); 33 tests.
- Next: Phase 3 – iPhone Safari experience (keyboard, viewport, audio unlock, haptics on web).

## Known issues / gotchas
- Round rule (decision 1, revised 26.10.26): only the drawn attacker gets `hasPlayedThisRound`; defenders
  stay drawable. Current code is correct – do not "fix" it.
- Streak/bonus (decision 2, revised 26.10.26): defender win counts as streak win 1; any return to arena
  resets `winStreak` (not `bonusReady`); bonus auto-applies in the next duel in any role. See GAME_RULES §5.
- Bot skip in the human duel shows "דילגת" (you skipped) – wording should name the bot.
- Deep links to QA screens need a full page load (`/qa-duel`); they work since web.output = single.
- ESLint crashes: "Cannot find native binding" (unrs-resolver from the Codex pnpm install). Fix by
  reinstalling deps with pnpm once pnpm is available.
- The sandbox blocks renaming/moving `.git` folders and `mobile/assets/expo.icon`; ask the user to do it.
- Old Codex Expo servers may still hold ports 8081–8083 (a reboot clears them); we use 8090.
- The user's PowerShell blocks .ps1 scripts: in their Terminal panel run `npx.cmd expo start --web --port 8090`
  from `mobile/` (a long-lived server there outlives our turns; the preview server stops at turn end).
- Haptics do nothing in iPhone Safari; iOS audio needs a user tap before the first sound.
  On web, expo-haptics calls navigator.vibrate and logs "Blocked call" errors before a real tap.
- Screen changes: add an action to `FlowAction` + a case in `flowReducer` + a flow test; never
  set screen state inside components.
