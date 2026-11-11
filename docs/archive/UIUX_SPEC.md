# THE ARENA – UI/UX Redesign: Implementation Prompt

> Paste this whole file into ChatGPT (or a coding agent) together with the repo and the mockup screenshots. The product UI language is **Hebrew only (RTL)**. This document is in English so it is easier to follow; every user-facing string in the app must stay Hebrew.

---

## 0. Your role and working agreement

You are a senior React Native / Expo engineer and mobile game UI designer. You will redesign the UI and UX of an existing prototype called **THE ARENA** (Hebrew name: הזירה), without changing its game rules.

Working agreement:

1. **Do not change game rules or engine behavior.** The rules are final and live in `GAME_RULES.md` and in `src/game/engine.ts`. If you believe a rule blocks good UX, stop and ask.
2. **All user-facing text stays Hebrew.** Code, comments, identifiers and commit messages are English. Do not add English UI strings or translations now (keep the structure ready for i18n, nothing more).
3. **Read before you write.** Before touching Expo or React Native APIs, read the documentation that matches the versions in `package.json` and the project's `AGENTS.md`. Do not rely on memory for APIs of this SDK version.
4. **Work in small, reviewable steps** (section 12). After each step return: list of changed files, full code of changed files, how to test, and which acceptance criteria are met.
5. **Ask before adding a dependency.** Section 11 lists approved and optional packages. Install with `npx expo install` so versions match the SDK.
6. **Do not guess about what you cannot see.** You cannot run the app on a device. When something must be verified on a real phone, say so explicitly and list the check.
7. If something is ambiguous, ask at most 3 closed questions, then proceed with a stated assumption.

---

## 1. Product context

THE ARENA is a Hebrew visual trivia game. A 4×4 board has 16 cells; 16 contestants each own one cell and a unique category (animals, countries, fruit, …).

- A contestant is drawn and attacks an adjacent contestant (up/down/left/right, no diagonals). Adjacent territories are the only valid targets.
- The duel is played on the **defender's** category. Both sides identify images by typing. Each has a 40-second clock (45 with a bonus). The clock runs only for the player whose turn it is. A correct answer passes the turn. Skip costs 3 seconds and swaps the image.
- Whoever runs out of time loses, is eliminated, and **their whole territory goes to the winner**. A full game is exactly 15 duels, ending with one champion.
- Current mode: **1 human vs 15 computer players, local only**. Multiplayer comes later, so do not hard-wire UI to local-only assumptions (keep the UI driven by state props).

A computer-vs-computer duel is shown as an animated simulation. It must reuse the same board visuals as the human flow.

---

## 2. Current implementation (facts found in the code review)

Stack: Expo + React Native, Expo Router, Reanimated, TypeScript, pnpm. Read the exact versions from `package.json`. Dark mode only.

Key files (paths under the mobile app folder):

- `src/app/index.tsx` – main screen controller (~20 screens driven by `useState(screen)` plus several state variables).
- `src/components/arena-board.tsx` – the 4×4 board. Uses flex-wrap `row-reverse`, per-cell borders and small "bridge" views to visually merge same-owner cells. Cell label font sizes are 11 and 9.5.
- `src/components/battle-view.tsx` – the duel screen. Clock state updates every 100 ms via `setInterval` in the same component that renders the image. The text input is **unmounted** during the computer's turn and re-created on the player's turn. `KeyboardAvoidingView` has `behavior` only on iOS. `onBlur` forces focus back to the input. Feedback line shows "ממשיכים להקליד — הזמן ממשיך לרדת." on every keystroke.
- `src/components/battle-transitions.tsx` (~615 lines) – many transition screens in one file.
- `src/components/onboarding.tsx` (~476 lines) – welcome, auth (name/nickname/avatar only), mode, guide.
- `src/game/*` – engine, content (16 categories × 24 items), colors, avatars.
- `src/app/qa-*.tsx` – 11 QA screens shipped as normal routes.
- Visual tokens are hard-coded hex values across files. Examples: background `#07151F`, panel `#102532`, border `#24414E`, accent `#21C7A8`, gold `#F8C95C`.
- Over 50 usages of `fontSize` ≤ 11 (including 9 for the bonus label).
- Only 24 of 384 items have real illustrations (12 animals, 12 fruit). The rest use emoji.

Do not rewrite everything at once. Refactor screen by screen (section 12).

---

## 3. Goals and non-goals

**Goals**

1. A visually strong "TV game-show arena" look and feel.
2. Instant readability of the board: *where am I, what can I attack, what is irrelevant*.
3. A duel screen that is fast, stable on mobile keyboards, and creates real pressure (clock states, motion, haptics, sound).
4. A single design system (tokens, typography, spacing, motion) used everywhere.
5. Accessibility and correct Hebrew RTL behavior.

**Non-goals (for this task)**

- No multiplayer, backend, login, monetization, store publishing.
- No changes to the AI/bot behavior.
- No new categories or content. (Illustration style is a separate task; keep emoji fallback working.)
- No English UI.

---

## 4. Design direction

Reference: a TV show where contestants stand on a glowing blue floor board; the active contestant's area is lit light blue, neighboring areas that can be attacked have **glowing neon outlines**, everything else is dark.

Principles:

1. **The arena is the hero.** The player must understand the board in under 2 seconds.
2. **The duel is speed and clarity.** Clock, image, input. Everything else is secondary.
3. **Every action gets feedback** (motion, sound or haptics) within 100 ms.

### 4.1 Design tokens (create one file, e.g. `src/design/tokens.ts`; replace all hard-coded hex values)

Colors (starting values taken from the approved mockups; keep them as tokens so they can change in one place):

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B1A24` | screen background |
| `surface` | `#12293A` | cards, panels |
| `surfaceMuted` | `#0F2230` | inactive clock, inputs |
| `border` | `#24414E` | panel borders |
| `textPrimary` | `#FFFFFF` | main text |
| `textSecondary` | `#B9C8D1` | secondary text (must pass 4.5:1 on `bg`) |
| `success` / primary action | `#21C7A8` | primary buttons, "your turn" |
| `accentGold` | `#F8C95C` | bonus, skip, selected target |
| `warning` | `#FFB020` | clock 10s state |
| `danger` | `#FF4D4D` | clock 5s state |
| `boardFrame` | `#0A2A7A` (border `#3FA9FF`) | board frame |
| `boardCellDark` | `#08122E` (border `#14234F`) | non-relevant territory |
| `territoryMe` | gradient `#B4EBFF → #58C4FF`, border `#D9F7FF` | the attacker's territory |
| `territoryTarget` | fill `#1747C9`, border `#4DF3FF` + glow | attackable neighbors |
| `territorySelected` | border and glow `#FFD25A` | the chosen target |

Typography (one Hebrew font loaded with `expo-font`; Heebo is the default choice, Rubik or Assistant are acceptable alternatives):

- Minimum font size **12**. Body 14. Buttons 16. Section titles 20. Screen titles 28. Battle clock 44 (active) / 36 (inactive). Use weights 700/900 for headings and numbers.
- Use `fontVariant: ['tabular-nums']` for clocks.
- Remove the global Calibri injection with `!important` in `_layout.tsx`.

Spacing and shape: 4-point scale (4, 8, 12, 16, 24, 32). Radii: 8 for small cells, 12–14 for inputs and buttons, 18–22 for cards. Minimum touch target 44×44; primary buttons 56 high.

Layout: portrait phone first (reference 390×844), max content width ~430 centered on larger screens.

---

## 5. Screen specifications

String lists are Hebrew and final unless stated otherwise.

### 5.1 Arena – attacker selection (human attacks)

Reference mockup: "זירה – אתה תוקף".

Top HUD chips (12 px, pill): `מחזור {n}`, `דו־קרבות {x}/15`, `שחקנים {n}/16`, `רצף התקפות {streak}/3` (the last chip only when the human is the attacker).

Board (the TV-style rules – this is the most important part):

- The **attacker's territory** is light blue with a gradient and the single word **"אתה"** (24 px, weight 900). No category name, no cell count.
- **Adjacent territories** (valid targets) have a **glowing outline** (border 3 px `#4DF3FF` plus outer glow and a soft inner glow), a deep blue fill and **only the category name** (15 px, white, text shadow). No owner name, no cell count.
- **All other territories are dark**, with a thin border and **no text at all**.
- The **selected target** switches its outline and glow to gold.
- Same-owner cells are merged into **one shape** (no internal borders, rounded outer corners). Do not draw internal grid lines inside a territory.
- Colors have no meaning per player any more; only the three states above (me / target / dark) plus selected.
- Tapping a target selects it (light haptic + glow transition 150 ms). Tapping a dark territory does nothing (very light "not available" haptic is optional).

Legend under the board (12 px): `הקטגוריה שלך` and `ניתן לתקוף`.

Bottom card: title `בחרו יריב להתקפה`; selected-target row (`{category} · {opponentName}`, subline `הקרב על קטגוריית המגן · 40 שניות`); primary button `תקפו את {opponentName}` (56 px high, `success`).

### 5.2 Arena – computer vs computer simulation

Reference mockup: "סימולציה – מחשב מול מחשב".

Identical board rules, but instead of `אתה` the territory shows **the contestant's name** (e.g. `נועה`). Legend: `הקטגוריה של {name}`. No HUD streak chip. Bottom card: small gold label `סימולציה · מחשב מול מחשב`, title `{name} בוחר/ת יעד…` with a 3-dot loading animation, and a secondary outlined button `דלגו לתוצאה`. The glow on targets pulses gently while the computer "chooses"; when it chooses, the chosen target switches to the gold selected state for ~600 ms before the duel starts.

### 5.3 Duel screen (human plays)

Reference mockup: "דו-קרב – התור שלך".

Top row: small gold label `דו־קרב · קטגוריית המגן`, category name (24 px) and a **mini-map** (4×4, ~70×70): your territory in turquoise, the opponent's territory in gold, everything else dim.

Clocks (two cards side by side):

- Active card: border 3 px turquoise with glow, time 44 px, label `אתה · תוקף` / `{name} · מגן`.
- Inactive card: muted surface, time 36 px in `textSecondary`, and at least 75% contrast (no 58% opacity).
- Bonus: a small gold badge `+5` next to the clock instead of a 9 px text line.
- **Clock states for the active clock:** normal (white) → at ≤ 10 s amber with a gentle pulse → at ≤ 5 s red, stronger pulse, and a tick (haptic + sound) every second. On time-up: clock shake and a strong haptic.

Turn pill under the clocks: `התור שלך · הקלידו את התשובה` or `התור של {name}`.

Image card: one card, clean light background, light scale-in (150–200 ms) when the item changes. Correct answer: a green flash/glow on the card then the next image. Skip: a quick slide/cross-fade plus a light haptic.

Answer input:

- **The input stays mounted for the whole duel**, in both players' turns, so the keyboard does not flicker. During the opponent's turn it is visibly disabled (muted border, placeholder `התור של {name}`) and the keyboard stays open. Verify on iOS and Android (some platforms dismiss the keyboard when `editable` turns false; if so, keep it enabled but ignore input while it is not the player's turn, and show the disabled look).
- Placeholder `הקלידו תשובה…`; a clear (×) button 52×52; height 52.
- Do not show a message on every keystroke. Show feedback only for: correct (`נכון!`), skip (`דילגת: ‎−3 שניות`), turn change.
- Check answers as the user types (existing behavior; keep it). Hint under the input in 12 px: `נבדק אוטומטית כשהתשובה נכונה`.
- Skip button: outlined gold, 48 px, `דילוג · ‎−3`.
- Replace the forced `onBlur` refocus with a safer strategy: refocus when the screen regains focus and when the player's turn starts, but do not trap the user (do not break Android back or screen readers).
- `KeyboardAvoidingView` must work on Android as well (set `behavior` for both platforms or use the SDK's recommended approach). Layout rule: **the image shrinks, the input never moves**. On a small phone (about 5.5 inches) the clocks, image, input and skip button must be visible together with the keyboard open.

Computer's turn: replace the text "המחשב חושב..." with an opponent avatar bubble with three animated dots and a thin progress bar. The input area stays in place (see above).

### 5.4 Result and conquest

- After a duel: a short result banner (`ניצחון` / `הפסד`), then the conquest animation: the winner's color floods from the losing territory outward cell by cell (60–80 ms per cell, max 1.2 s), accompanied by a conquest sound and a medium haptic.
- Then the existing choice: `המשיכו להתקפה` or `חזרה לזירה`. Keep the engine behavior (any winner, including a winning defender, may continue or return).
- Bonus earned popup: keep, restyle with tokens.

### 5.5 Draw screen

Short tension build (2–3 s): the board is dark, the chosen contestant's territory lights up with a spotlight sweep, then the name appears. Always allow tap-to-skip.

### 5.6 Final and champion

Final: show the two finalists' territories, the category chooser flow stays as is, restyled. Champion: confetti (Skia or Lottie), strong haptic, and a summary card: duels played, answers, biggest territory. Button `משחק חדש`.

### 5.7 Onboarding (light-touch only now)

Apply tokens, font, touch-target sizes and RTL fixes. Keep the structure. Shorten the guide to a single 15-second interactive example if it can be done safely; otherwise only restyle.

---

## 6. Component work list

1. **`ArenaBoard` rewrite** to the TV-style rules (section 5.1/5.2).
   - Props should express state, not styling: `state`, `mode: 'select-target' | 'simulation' | 'overview'`, `meId`, `targetIds`, `selectedId`, `onSelectTarget`.
   - Render each territory as **one shape** (compute a merged outline from its cells). Start with a pure React Native implementation (merged cell rects with `boxShadow`/shadow props for the glow). Evaluate Skia only if profiling shows a problem or the Android glow looks wrong (section 11).
   - Remove the `row-reverse` mirroring hack by supporting RTL properly at the layout level, or isolate it in a single, well-commented helper.
2. **`ClockCard`** with the state machine: normal / warning / danger / inactive / bonus.
3. **`ClockDisplay` isolated component**: the 100 ms tick must **not** re-render the image and the input. Keep the time in a ref or shared value and update only the clock text (Reanimated shared value, or a small component with its own interval).
4. **`MiniMap`**.
5. **`AnswerInput`** (always mounted, disabled look, clear button).
6. **`ImageCard`** (item image or emoji fallback, entry animation, feedback glow).
7. **`HudChips`**, **`BottomSheetCard`**, **`PrimaryButton`**, **`SecondaryButton`** (outlined), **`OpponentThinking`**.
8. Split `battle-transitions.tsx` into one file per screen.

Move shared UI to `src/design/` (tokens, typography, components) and keep screens under `src/features/…` or the existing folders – do not restructure the whole repo in this task.

---

## 7. Motion, sound and haptics

| Moment | Motion | Sound / haptic |
|---|---|---|
| Correct answer | image card green glow, next image scales in (150–200 ms) | short positive sound, light haptic |
| Skip | cross-fade to next image | soft tick, light haptic |
| ≤ 10 s | clock turns amber, slow pulse | – |
| ≤ 5 s | clock turns red, faster pulse | tick each second (haptic + sound) |
| Time up | clock shake | strong haptic, buzzer |
| Select target | glow transition 150 ms to gold | light haptic |
| Conquest | color flood cell by cell (≤ 1.2 s) | conquest sound, medium haptic |
| Champion | confetti | fanfare, success haptic |

Rules: animations 150–400 ms (conquest and draw may be longer), dramatic transitions ≤ 2 s and always skippable, respect the system "reduce motion" setting (replace pulses and floods with simple fades), sound has a global mute toggle that persists for the session.

---

## 8. Hebrew, RTL and input

- Enable real RTL at the platform level and verify layouts, arrows and spacing (not only `textAlign`). Test on iOS and Android, and on web if the web build is kept.
- One Hebrew font for everything; verify glyph rendering and line height for Hebrew.
- Add a **normalization step for Hebrew final letters** when comparing answers (ם/מ, ן/נ, ך/כ, ף/פ, ץ/צ) so players do not lose on a technicality. This must be a pure function in the game layer with unit tests. (Coordinate with the engine owner; it is allowed because it does not change rules, only input tolerance.)
- Keep `autoCorrect={false}`, `autoCapitalize="none"`. Test Gboard, Samsung Keyboard and iOS Hebrew keyboard for composition issues (check that auto-matching does not fire on partial composition).
- Use `‎` (LRM) marks for symbols like the minus sign in `‎−3` so they render correctly in RTL text.

---

## 9. Accessibility

- Text contrast ≥ 4.5:1 (3:1 for 24 px+). Check all text on `bg`, `surface`, board states and gradient fills.
- Never rely on color alone: the three board states must also differ in lightness and have text/outline differences (already designed: filled light, glowing outline, dark). Add a persistent non-color marker for the player's own territory (the word `אתה`).
- Dynamic font size support. Check that nothing breaks at 130%.
- Screen reader: announce turn changes, results and clock milestones (every 10 s, not every second). Keep existing `accessibilityLabel`s and extend them (board territories, buttons, clocks).
- Touch targets ≥ 44×44 everywhere.
- Respect reduce-motion.

---

## 10. UX bug fixes (must be fixed as part of this work)

| ID | Problem | Fix |
|---|---|---|
| UX-01 | Input unmounts on the computer's turn; keyboard flickers and layout jumps | Keep the input mounted; disabled look on the opponent's turn |
| UX-02 | `KeyboardAvoidingView` has no behavior on Android | Make it work on both platforms; image shrinks, input stays |
| UX-03 | 50+ places with font size ≤ 11 | Minimum 12; use the type scale |
| UX-04 | No urgency states in the clock; inactive clock at 58% opacity | Clock state machine (section 5.3) and 75%+ contrast |
| UX-05 | Clock tick (100 ms) re-renders the whole duel screen incl. image | Isolate the clock; update only its text |
| UX-06 | "ממשיכים להקליד…" message on every keystroke | Remove; feedback only on events |
| UX-07 | Non-target territories dimmed to 16% opacity (board context lost) | Use the dark board state with a visible but quiet look |
| UX-08 | Tiny labels on cells (11 / 9.5) and no clear "me" marker | TV-style board: `אתה` only on own territory, category name only on targets |
| UX-09 | `onBlur` forced refocus traps focus | Safer focus strategy (section 5.3) |
| UX-10 | Hard-coded colors and sizes | Tokens file; replace all hex values |
| UX-11 | Emoji used as illustrations; inconsistent across devices | Keep as fallback; add an `ItemVisual` component so real illustrations can be dropped in later without touching screens |
| UX-12 | QA screens are production routes | Restrict `qa-*` routes to `__DEV__` |

---

## 11. Plugins and dependencies

Install with `npx expo install <package>` to get SDK-compatible versions, and **verify compatibility with the exact versions in `package.json` and with the New Architecture before adding anything**. Do not add a package that is not listed here without asking.

**Required (small and low risk)**

- `expo-font` + a Hebrew Google Font package (for example `@expo-google-fonts/heebo`) – one Hebrew font everywhere.
- `expo-haptics` – tactile feedback for correct/skip/time-up/selection.
- `expo-audio` – sound effects and optional background music, with a mute toggle. (Use the current Expo audio package for this SDK; check the docs, do not assume the older `expo-av`.)

**Already in the project (use them, do not replace)**

- `react-native-reanimated` – clock pulses, glow transitions, conquest flood, list/enter/exit animations.
- `react-native-gesture-handler`, `expo-glass-effect`.

**Recommended, add only when the step needs it**

- `expo-linear-gradient` – gradient fill for the attacker's territory and backgrounds.
- `lottie-react-native` – confetti and a few ready-made celebration animations (champion, bonus earned). Keep the files small.
- `react-native-svg` – for crisp icons and the mini-map if needed (avoid emoji for UI icons).

**Optional, only if profiling or visuals demand it**

- `@shopify/react-native-skia` – high-quality glows, merged territory outlines, confetti and board effects. Try pure React Native first (merged rectangles + shadow/`boxShadow` glow). Use Skia only if the Android glow quality or performance is not acceptable. If the web build matters, check Skia's web requirements first.

**Developer tooling (recommended, not UI)**

- `eslint` rule or a simple check that no screen file contains raw hex colors (token discipline).
- Storybook for React Native or a dev-only "component gallery" route (inside `__DEV__`) to review `ClockCard`, `ArenaBoard` states and buttons without playing a full game.

**Avoid for now**

- Large UI kits, NativeWind/Tailwind migration, a full navigation rewrite, or any state-management library change. They are not needed for this task.

---

## 12. Suggested implementation steps (PR-sized)

Each step ends with acceptance criteria that can be verified.

1. **Foundations**: tokens file, typography scale, Hebrew font, RTL setup, `__DEV__`-only QA routes. *Acceptance:* no raw hex in changed files; no font below 12 in changed files; app builds on iOS, Android (and web if used).
2. **Duel screen stability**: UX-01, 02, 05, 06, 09. *Acceptance:* no keyboard flicker on turn change; no layout jump; clock tick does not re-render the image or input (show with React profiler or a render counter in dev); works on a small Android phone.
3. **Clock states and feedback**: clock state machine, haptics, sound, reduce-motion handling. *Acceptance:* visible amber at ≤10 s, red at ≤5 s with ticks; mute works.
4. **ArenaBoard rewrite** (TV-style states, merged territories, selected state, simulation mode). *Acceptance:* matches section 5.1 and 5.2 in all three board states; no text on dark territories; own territory shows only `אתה` (or the contestant's name in simulation).
5. **Arena screens**: HUD chips, legend, bottom card, simulation card, mini-map in the duel screen. *Acceptance:* flows work end-to-end for human attack and computer-vs-computer.
6. **Conquest, draw, final, champion polish**: motion, sound, confetti. *Acceptance:* all transitions skippable, ≤ 2 s for dramatic ones.
7. **Accessibility and Hebrew input pass**: contrast check, dynamic type at 130%, screen-reader announcements, final-letter normalization with unit tests. *Acceptance:* checklist in section 13 passes.
8. **Onboarding restyle** with tokens and touch targets.

---

## 13. Definition of done and manual test checklist

- Play a full game against 15 bots on one iOS phone and one Android phone (one of them small).
- Duel screen with keyboard open: clocks, image, input and skip are all visible; nothing jumps when the turn changes.
- Hebrew typing works on Gboard, Samsung Keyboard and the iOS keyboard; answers with final letters are accepted.
- RTL is correct on every screen (arrows, spacing, alignment).
- Contrast: spot-check the board states and the clocks.
- Dynamic font at 130%: no clipped or overlapping text.
- Reduce-motion on: pulses and floods replaced by simple fades.
- Mute toggle silences all sounds; haptics still work or can be turned off.
- Time to the first duel for a new user is under 90 seconds (measure with a stopwatch).
- `pnpm` scripts for lint, typecheck and the engine tests still pass. The engine tests must pass unchanged.

---

## 14. Reference: approved mockups

The mockups (Design canvas) contain three phone-size artboards. Attach screenshots when you send this prompt, because links to the design tool are not accessible to you.

1. **Arena – you attack:** HUD chips; board with the light-blue territory labeled `אתה`, glowing-outline neighbors with category names, dark territories without text, gold selected target; legend; bottom card with `תקפו את {name}`.
2. **Duel – your turn:** category title and mini-map; two clock cards (active with turquoise glow and `+5` badge); turn pill; image card; input with clear button; gold outlined skip button; hint line; keyboard area reserved so the layout does not move.
3. **Simulation – computer vs computer:** same board; the contestant's name instead of `אתה`; card `{name} בוחר/ת יעד…` with animated dots and `דלגו לתוצאה`.

Note: category names, contestant names and the illustration in the mockups are placeholders. Real data comes from the game state and content files.

---

## 15. First message you should send back

Before writing code, reply with:

1. The three assumptions you are making.
2. The list of files you plan to change in step 1.
3. Up to three closed questions (A/B/C) if something blocks you.

Then wait for approval.
