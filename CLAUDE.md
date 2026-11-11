# THE ARENA (הזירה) – context for Claude

Read this first. It replaces re-exploring the repo. Keep it short (under ~150 lines) and update the
**Status** and **Known issues** sections at the end of every work step.

## Product in one paragraph
Hebrew visual-trivia game. 4×4 board, 16 contestants, each with a unique category. A drawn contestant
attacks an orthogonal neighbor; the duel is on the defender's category; each side has a 40 s clock
(45 with bonus) that runs only on their turn; correct answer passes the turn, skip = −3 s. Loser is
eliminated and their territory goes to the winner. Always 15 duels → one champion.
Target: **web app opened in a phone browser (iPhone Safari first)** – no App Store / Play.
Now: local mode (1 human vs 15 bots) is polished; online multiplayer is being built in phases (docs/PRD_MULTIPLAYER.md).

## The user
Hebrew-speaking beginner at vibe coding. Explain in Hebrew, step by step, show results in the
browser pane, ask before big or irreversible changes. Code, comments, commits: English.

## Run and check
- Node: `C:/Program Files/nodejs` (v24). In Bash first run `export PATH="/c/Program Files/nodejs:$PATH"`.
- No pnpm on the machine yet; use `npm run` / `npx` from `mobile/`.
- Dev server: browser preview config `arena-web` in `.claude/launch.json` → http://localhost:8090.
- Admin panel (decision 19): code in the top-level `admin/` folder (see `admin/README.md`). Start: `npm run admin` from `mobile/` or `node admin/server.js` (preview config `arena-admin`) → http://localhost:8095. Edits
  categories, items and pictures in the real files. Check it with `node admin/smoke-test.js` (server running).
  Never run `arena_images.py` in the background while the panel does something: both rewrite credits.json.
- Server (multiplayer): `server/` has its own `npm.cmd test` / `npm.cmd run start` (port 2567). Dev server dir is git-ignored for node_modules/dist/data.
- Checks (from `mobile/`): `npx tsc --noEmit` · `npm test` (95 tests incl. 1000 seeded games) · lint is broken.
- Tests: `mobile/tests/*.test.ts` with a tiny runner (`tests/harness.ts`, no deps), entry `tests/index.ts`.
  New rule → new test in `tests/rules.test.ts`, named after the GAME_RULES section.
- Before calling a step done: typecheck + engine test + click through the flow in the browser pane.

## Repo map
```
THE_Arena/            git root (run git commands here) · remote origin = github.com/YakirC0412/The-Arena-Mobile-Game (branch main, public)
├─ CLAUDE.md          this file          README.md  short Hebrew intro + folder map for the user
├─ PRODUCT.md · DESIGN.md   product brief and design system (Impeccable context)
├─ firebase.json · .firebaserc   Firebase Hosting (live site https://the-arena-game-v1.web.app, public dir mobile/dist-web)
├─ docs/              GAME_RULES.md (rules source of truth) · DECISIONS.md · ROADMAP.md · CATEGORIES.md · PRD_MULTIPLAYER.md
│                     GOOGLE_LOGIN_SETUP.md · IMAGE_CREDITS.md (generated) · STATUS_LOG.md (full history) · archive/ (old PRD, UI spec, questionnaire)
├─ admin/             admin panel for categories, items and pictures (see admin/README.md): server.js · store.js · index.html · image-sources.json
├─ server/            multiplayer server (Node + Colyseus): src/GameRoom.ts · onlineGame.ts · lobby.ts · roomsApi.ts · api.ts · auth.ts · firebaseAuth.ts
│                     · db.ts · devPages.ts (/rooms test page) · index.ts · tests/
├─ .claude/           launch.json (arena-web, arena-admin, arena-server) · skills/arena-images (picture skill) + 4 installed design skills
├─ .github/           workflows/pages.yml (GitHub Pages build)      .impeccable/  design-tool state
├─ archive/           NOT in git (local only, not backed up): old zip, original images, removed files, early server prototypes
└─ mobile/            Expo SDK 58 app (expo-router, reanimated, RN web)
   ├─ AGENTS.md       Expo rules – read before touching any Expo/RN API
   ├─ public/         index.html (web page template: iPhone meta, no page-level dir!) · manifest + icons
   ├─ assets/         app/ (icons, splash, arena-logo.webp) · avatars/ · items/<category>/ · sounds/ · expo.icon
   ├─ scripts/        build-item-images.js · write-image-credits.js · generate-feedback-sounds.js (app build helpers only)
   ├─ tests/          engine, rules, random-games, content tests
   └─ src/
      ├─ app/         routes only: _layout.tsx · index.tsx (renders GameFlow) · (dev)/qa-*.tsx
      ├─ game/        engine.ts (rules, bot decisions, createGame) · duel.ts (pure duel state machine) · flow.ts · rng.ts · types.ts
      │               pure TS, no React, relative imports only; never call Math.random – take a RandomSource
      ├─ content/     categories.ts (builds the pool from categories-data.json = ALL categories, items, answers, ways; edited by the admin panel) · avatars.ts · item/avatar-images.ts
      ├─ features/    one folder per part of the game
      │  ├─ flow/        game-flow.tsx renders FlowState → screens · setup · result
      │  ├─ onboarding/  intro · welcome (sign-up/sign-in, Google) · guide
      │  ├─ home/        home screen (Single/Multi tabs) · room cards · podium · edit-profile sheet
      │  ├─ lobby/       multiplayer lobby · category picker
      │  ├─ arena/       arena-screen · arena-board · build · draw animation · mini-map · territory-layout
      │  ├─ battle/      battle-view (human duel) · clock cards · intro · AI target/decision/simulation · outcome · conquest animation · bonus popup
      │  ├─ online-game/ the online game screens (online-game-screen, online-duel)
      │  └─ final/       final reveal · final category · champion celebration · game over
      ├─ design/      tokens.ts (all colors/sizes, brand* = logo palette) · brand.tsx · app-text · avatar-portrait · bottom-sheet · fitted-picture · sound-icon
      ├─ hooks/       use-game-feedback (sound + haptics) · use-reduced-motion · use-web-viewport-box · keyboard-primer
      ├─ online/      network layer: rooms sources, server session, Firebase/Google sign-in, view-to-state
      ├─ services/    accounts/ (local accounts: pure accounts.ts + sha256.ts, account-storage.ts = browser localStorage)
      └─ vendor/      colyseus-sdk.js (vendored: npm cannot extend the pnpm layout)
```

## Rules for changes
- Design skill `.claude/skills/ui-ux-pro-max` (MIT, from github.com/nextlevelbuilder/ui-ux-pro-max-skill): use it for UI/UX decisions
  (search: `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain style|color|typography|ux`). Its advice is input,
  not law: our tokens (`design/tokens.ts`), Hebrew RTL, and the existing brand palette win when they conflict.
- All UI text Hebrew (RTL). Use `AppText` and tokens from `design/tokens.ts`; no raw hex, no font < 12.
- `game/` and `content/categories.ts`, `content/avatars.ts` must not import React/RN/Expo
  (they compile under Node for `test:engine`). Use relative imports there, `@/` elsewhere.
- A change to game behavior → update `docs/GAME_RULES.md` + a test. A product decision → `docs/DECISIONS.md`.
- One git commit per step (Conventional Commits), then `git push` (user approved pushing to their private
  repo, 30.10.26). Never delete user files – move them to `archive/`.
- QA screens live in `src/app/(dev)/` and are redirected away in production builds.

## Status (update every step)
- 11.11.26 – ADMIN PANEL x DIFFICULTY TIERS: the panel now shows the 12/10/8 tiers: summary + explanation in the category header, a section per tier in the item grid (colour, badge, filter chips), tier info and "העברה לדרגה" buttons in the item dialog (`moveToTier` = repeated moves), tier counts in the sidebar, a warning when a list is not 30 long. Shared constants in `mobile/src/content/difficulty-tiers.json`; `admin/tiers.js` has the same formula as `difficultyTierSizes` (a test compares them for 0-80 items); the API adds `tier` per item and `tiers` per category. Smoke test +2 checks. 110 mobile tests. Restart the panel to see it (a running panel keeps the old code). Not deployed (the panel is local only).
- 11.11.26 – PICTURE MIX + BOT SPEED (decisions 27-28): (1) a category's list is 40% easy / 33% medium / 27% hard by position (`difficultyTierSizes` in `content/categories.ts`: 12/10/8 of 30; item order IS the difficulty, in the admin panel too). (2) `createBattleDeck(items, random, startPlace)` builds the deck place by place from `PICTURE_MIX` (random order, rising difficulty: first picture easy, no hard before the 4th, every picture once); a refilled deck continues from `items.length`. (3) Bot think time = `aiThinkDelayMs(item)`: 630 ms + 370 per difficulty step + 242 per letter + 315 per extra word (+-15%, min 1.05 s), calibrated by simulating whole duels: average typist wins ~59%, fast ~86%, slow ~30% (the human speed is an assumption: collect real timings from friends and retune the `AI_*` constants). 109 mobile tests. Step 2 (a personality per bot) NOT done. DEPLOYED to https://the-arena-game-v1.web.app on 11.11.26 (release for friends to test).
- 11.11.26 – BOT SPEED (friends' feedback: bots answer long words too fast): `aiThinkDelayMs(item, random)` in `game/engine.ts` now depends on the answer: 600 ms + 350 ms per difficulty step + 230 ms per letter + 300 ms per extra word (+-15%, min 1 s); letters counted after `normalizeAnswer`, without spaces; a shorter accepted alias counts halfway (`aiTypingLoad`). Same function for the local duel (`battle-view.tsx`) and the server (`onlineGame.ts`). Bot accuracy table unchanged (77/62/47%). Simulation (human speed is an assumption): average typist wins 33% -> 58%, fast 59% -> 83%, slow 15% -> 33%. 5 new tests (decision 27, GAME_RULES §7). Step 2 (a personality per bot: speed factor, strong/weak categories, optional difficulty setting) NOT done. Not deployed to web.app.
- 11.11.26 – PROJECT TIDY-UP: admin panel moved to the top-level `admin/` folder (own README; `npm run admin` from `mobile/` still works); early server prototypes (ArenaRoom, gameLoop, DuelRoom, liveDuel, watch/duel pages) moved to the local `archive/server-prototypes/` (dev helpers now in `server/src/devPages.ts`); unused app files, the legacy Wikipedia collector and the slides/banner-design/ui-styling skills removed; `mobile/src` regrouped (`design/` has the generic UI, `hooks/` the hooks, `features/online-game/` the online screens, `arena-screen` in `features/arena/`); old PRD/UI specs moved to `docs/archive/`; this status section trimmed, the full history is in `docs/STATUS_LOG.md`.
- 11.11.26 – SOUNDS ROUND 3: conquest is back to the ORIGINAL plain tone (260 Hz, byte-identical to git HEAD; played at once again, no delay). Champion = drum roll (snare roll 10→30 hits/s, swelling, timpani beats) for 3 s, then timpani + cymbal crash and a trumpet fanfare (G G G C, E, held G with a soft C-E chord, vibrato) - synthesised in `scripts/generate-feedback-sounds.js`, checked on a spectrogram only (not heard). Draw sounds unchanged (draw-roll / draw). Deployed to web.app.
- 11.11.26 – SOUNDS REDONE (user disliked the drone+impact conquest): conquest.wav = a "wave" (band-passed noise swelling and rising 250→2400 Hz to a peak at 2.5 s, then falling and closing by 3.5 s, soft G3/D4 pad, no impact); draw = `draw-roll.wav` (the cursor's 34 jumps as decelerating "tocks", same timings as `drawStepDelaysMs`, then a bell chime at the landing; played when the draw starts, only for the full draw) and `draw.wav` (chime alone, used for a bot's quick draw and Reduce Motion). Champion sound unchanged. The user's reference videos are TV mixes (voices, crowd, music), so the effects could not be isolated: the sounds follow the user's words, not the clips. Not heard on a device. Not redeployed.
- 10.11.26 – FIXES + SOUNDS: (1) draw animation: the highlighted cell (zIndex 3) hid its own label; the label layers now have zIndex 5. (2) Arena HUD pill reads "N מתמודדים נותרו | דו־קרב X מתוך 15 | N משבצות בשליטה שלך" (singular: "משבצת 1 בשליטה שלך", "מתמודד אחד נותר"). (3) Champion scene: one title "<name> כובש/ת את הזירה ו(מנצח/ת) את המשחק"; eyebrow and footer title removed. (4) New sounds from `scripts/generate-feedback-sounds.js` (re-run it to regenerate): conquest = drone + accelerating heartbeat + hiss rising, impact at 3.0 s (a multi-cell takeover starts it 1.3 s late so the hit lands as the cells join); champion = same build-up, impact at 3.0 s, then a brass-like C-major fanfare and sparkles (6.4 s). Synthesised, not listened to on a device: tune by ear. Not redeployed to web.app yet. NOTE: Metro sometimes stalls on gzip responses (page stays blank): restart it with `--clear`.
- 10.11.26 – WEB HOSTING: the game (single mode + Google sign-in) is live at https://the-arena-game-v1.web.app (Firebase Hosting; `firebase.json`/`.firebaserc` at the repo root, public dir `mobile/dist-web`). Update: from `mobile/` `npx expo export -p web --output-dir dist-web`, then from the root `npx.cmd firebase-tools deploy --only hosting`. Multi does NOT work there yet (no cloud server; next: Railway/Tunnel). Not tested on the iPhone.
- 10.11.26 – EDIT PROFILE: tapping the avatar in the home top bar (pencil badge) opens `features/home/edit-profile-sheet.tsx` (nickname + picture grid). `updateProfile` in accounts.ts (nickname unique among OTHER accounts), flow action `PROFILE_UPDATED`, `syncServerProfile` (server-session.ts) moves the silent server account to the new nickname and posts `/api/profile` (also keeps a Google account's profile from reverting at the next sign-in). A one-time hint bubble ("לחיצה על הדמות פותחת עריכה…") shows on first home visit per account (localStorage `arena.profileHintSeen:<id>`, 9 s, tap opens the editor). QA: `/qa-home?hint=1`. 98 mobile tests. Checked in the browser pane (bubble, validation, save); NOT checked on the iPhone; gender is not editable.
- Older entries: see `docs/STATUS_LOG.md` (and docs/ROADMAP.md, docs/DECISIONS.md).

## Known issues / gotchas
- Round rule (decision 1, revised 26.10.26): only the drawn attacker gets `hasPlayedThisRound`; defenders
  stay drawable. Current code is correct – do not "fix" it.
- Streak/bonus (decision 2, revised 26.10.26): defender win counts as streak win 1; any return to arena
  resets `winStreak` (not `bonusReady`); bonus auto-applies in the next duel in any role. See GAME_RULES §5.
- Picture review: put a contact sheet in mobile/public/ (served by the dev server), screenshot it, then
  delete it. Wikipedia lead images are often paintings, diagrams or transparent PNGs – always look.
- Ambulance/fire engine/police car pictures show the English word – accepted for now.
- Free Pollinations AI now answers 402 without a token; AI fallback needs POLLINATIONS_TOKEN or
  OPENAI_API_KEY in .claude/skills/arena-images/keys.env (git-ignored; the user copies it).
- Bot skip in the human duel shows "דילגת" (you skipped) – wording should name the bot.
- Deep links to QA screens need a full page load (`/qa-duel`); they work since web.output = single.
- Metro (the game server) crashes with ENOENT when hundreds of picture files change under it (e.g. the WebP
  conversion): restart it with `npx.cmd expo start --web --port 8090 --clear`.
- ESLint crashes: "Cannot find native binding" (unrs-resolver from the Codex pnpm install). Fix by
  reinstalling deps with pnpm once pnpm is available.
- The sandbox blocks renaming/moving `.git` folders and `mobile/assets/expo.icon`; ask the user to do it.
- Old Codex Expo servers may still hold ports 8081–8083 (a reboot clears them); we use 8090.
- The user's PowerShell blocks .ps1 scripts: in their Terminal panel run `npx.cmd expo start --web --port 8090`
  from `mobile/` (a long-lived server there outlives our turns; the preview server stops at turn end).
- Accounts on the phone are local (localStorage, salted SHA-256): not real security. Google sign-in works (Firebase; falls back to a local-only sign-in when the server is unreachable); it was modelled
  first in `signUpWithGoogle`.
- Haptics do nothing in iPhone Safari; iOS audio needs a user tap before the first sound – both are
  handled in services/use-game-feedback.ts (sounds before the first tap are skipped).
- Buttons next to the answer field on iPhone: a normal onPress needs two taps (first tap blurs the field
  and the layout jumps). Use the raw touchstart pattern from battle-view skip.
- iOS opens the keyboard only from a tap: `primeWebKeyboard()` must run inside the tap that leads to a
  text field; then keep that field focused (never blur on submit, refocus after button taps).
- Windows WIC drops WebP alpha; icons were rendered from the logo in a browser canvas.
- Full-screen containers use `backgroundColor: colors.screen` (transparent), never `colors.bg`
  (`bg` is dark ink for text on light buttons). The navigator theme in _layout must stay transparent.
- Player colors (`PLAYER_COLORS` in engine.ts, `design/colors.ts`) are no longer shown on boards.
- Screen changes: add an action to `FlowAction` + a case in `flowReducer` + a flow test; never
  set screen state inside components.
