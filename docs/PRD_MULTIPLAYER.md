# THE ARENA – Multiplayer PRD

Version 1.0 · 5 Nov 2026 · Status: **draft for your review – nothing has been built yet**

This document describes the online multiplayer mode: what it is, how it behaves, what we build in which order, and what is still open. It extends `docs/PRD.md` section 7 and `docs/GAME_RULES.md`. The game rules themselves do not change; this document only adds rooms and online play.

---

## 1. Summary

Today THE ARENA is a local game: one human against 15 bots, everything running inside the phone's browser. The multiplayer mode lets **2 to 6 real people play the same arena together**, each with their own category, while bots fill the remaining seats up to 16. People meet in **rooms**. A server runs the game so that clocks, answers and results cannot be faked.

**In one sentence:** create or join a room, pick a category, and fight for the arena against your friends and the bots.

## 2. Goals and non-goals

**Goals**
- Friends can play one real arena together from their phones (iPhone Safari first).
- A simple room flow: create, share a code or appear in a live list, join, pick a category, start.
- Fair play: the server owns the clocks, the answers and the results.
- A leaders table that rewards winning full games.
- A beginner can run and test the whole thing from a home PC before any paid hosting.

**Non-goals (not in the first release)**
- Public internet hosting and public launch (phase 6, a separate decision).
- More than 6 humans per room, or several simultaneous duels.
- Voice or text chat, friends lists, tournaments, ranking by skill (Elo).
- Password reset by email, Google sign-in (both need public hosting or an email service).
- Native iOS or Android apps.

## 3. Who uses it

| Person | Wants | Needs from the product |
|---|---|---|
| **Host** | To gather friends and run a game | Name a room, choose public or private, share a code, start when ready |
| **Player** | To join friends fast and pick a category they know | Join by code or from a list, pick or switch a category, see who is ready |
| **Spectator** | To watch a game in progress | See the board, the live duel and the clocks, without playing |
| **Owner (you)** | To run it cheaply and safely | One command to start the server, simple admin of categories (already exists) |

## 4. Key concepts

- **Room**: a place where up to 6 humans gather before and during one game. It has a name, a host, a public or private setting and a short code.
- **Seat**: one of the 16 positions in the arena. Each seat is a human or a bot. Seats of humans who disconnect for more than 30 seconds are taken over by a bot.
- **Authoritative server**: the program that holds the true game state. Phones only send actions ("I answer X") and draw what the server says.
- **Duel**: unchanged from today: two contestants, the defender's category, 40 seconds each (45 with bonus), one duel at a time.

## 5. User flows

### 5.1 Rooms screen (after sign-in)
Shows:
1. A **live list of public rooms**: room name, host name, humans x/6, status "Waiting" or "In game". It refreshes every few seconds.
2. A field to **enter a room code**.
3. A **Create room** button.
4. A **Leaders table**: top players by number of full games won (see 6.7).

Rooms "In game" can be opened to **watch** only. A full room (6/6 humans) also offers **watch** only.

### 5.2 Create a room
1. The host types a **room name**.
2. The host chooses **Public** (appears in the list while waiting) or **Private** (joinable only with the code). Every room has a code either way.
3. The host picks **their own category and its way** (for example "flag → capital").
4. The room opens in the lobby and shows the code to share.

### 5.3 Join a room
- From the live list (public rooms), or by typing a code (public or private).
- Errors are clear: wrong code, room full, game already started (offer to watch).

### 5.4 Lobby (before the game)
- Everyone sees all humans in the room, their avatar, name and chosen category.
- **Category picking**: each player who joins picks a category from the ones still free, and its way. Taken categories are shown but disabled.
- **Switching**: until the host starts, any player may change category as often as they want, as long as the new one is free. The old one becomes free immediately for everyone.
- **Race**: if two players pick the same free category at the same moment, the server decides; the other gets a short "taken" message and the screen updates.
- **Start**: the host's Start button is enabled when **at least 2 humans** are in the room and **every human has a category**. (Your note "2 min" is read as "minimum 2 players".)
- **Host leaves** in the lobby: the next human becomes host. An empty room closes.

### 5.3a Starting the game
- The server fills the remaining seats up to 16 with **bots**, whose categories are drawn from the categories not taken by humans, with the same difficulty spread as today (up to 3 hard, 6 medium, 6 easy).
- The arena is built and the usual flow begins: build animation, draw, choose a target, duel, conquest, and so on.

### 5.5 Playing
- **Humans** play their own seats: when drawn, a human picks the target; when attacked or attacking, a human plays the duel on their phone.
- **Bots** play bot seats using today's bot logic.
- **Everyone else watches the current duel live**: picture, both clocks and typing progress shown as correct/not yet. Spectators never see the answer until it is correct.
- Only one duel runs at a time, like today.

### 5.6 Leaving and reconnecting
- If a human's connection drops, the game continues. After **30 seconds** a bot plays their seat; if the duel is theirs, the bot answers for them.
- When the player reconnects (same account, same device or browser session), they get the full current state and take their seat back **between duels** (never in the middle of a duel).
- A player who quits on purpose leaves their seat to a bot.

### 5.7 End of game
- The champion is announced as today (always 15 duels).
- The champion earns **one win** on their account if the game had **2 or more humans**.
- Everyone returns to the rooms screen. The room closes (new game = new room, in the first release).

## 6. Functional requirements

### 6.1 Accounts
- Register and sign in on the server with **email and password**. Passwords are stored hashed (Node `crypto.scrypt`), never in plain text.
- The client keeps a login token; the server identifies the player from it on every action.
- Local accounts that exist today stay for **solo play** only.
- No password reset and no Google sign-in in the first release.

### 6.2 Rooms
- Create, join, watch, leave, list, close when empty.
- Room name 2 to 24 characters; the code is short (for example 4 letters) and unique among open rooms.
- At most **6 humans**; any number of spectators (reasonable limit, for example 20).

### 6.3 Lobby and categories
- Only **active, playable** categories can be picked (30+ pictures, as today).
- Each human has exactly one category and one way at start time. Two humans never share a category.
- All category changes go through the server, which keeps the single source of truth and broadcasts the lobby to everyone.

### 6.4 The game online
- All rules from `GAME_RULES.md` apply: neighbors only, defender's category, streak and bonus, continue or return, final of the last two, always 15 duels.
- The local-only conveniences (skip to my turn, bot-vs-bot simulation screens) are replaced by spectating.

### 6.5 The duel online (server-owned)
- The **server** chooses the picture order, runs both clocks from its own time, checks every answer, applies skip (−3 seconds) and the short pause after a correct answer, and decides the winner when a clock reaches zero.
- The **phone** sends the typed text (debounced, about 80 ms) and a skip request, and displays what the server reports. The phone's clock is only a display, kept in step with the server.
- Answers are matched with the same rules as today (Hebrew final letters, niqqud, punctuation, no geresh needed).

### 6.6 Spectating
- Same live data as players, without being able to act, and without the correct answer before it is guessed.

### 6.7 Leaders table
- Counts **full games won** by account, with **games played** shown next to it.
- A game counts only when it had **2 or more humans** (default; easy to change).
- Shown on the rooms screen, top 10, plus the signed-in player's own place.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| **Fairness** | The client is never trusted. Clocks, answers and results are decided on the server. |
| **Latency** | Typing to server acknowledgment should feel instant on home Wi-Fi (target under 150 ms). Clock display stays within about 0.2 s of the server. |
| **Reliability** | A dropped connection never stops the game for others; a bot covers after 30 s. |
| **Security (home stage)** | Server reachable only on the home network. Passwords hashed. Without https the password travels unencrypted inside the home network: acceptable for tests only. |
| **Security (public stage)** | https and wss, rate limits on answers, answers removed from the web bundle, opaque picture keys. |
| **Privacy** | Store only what is needed: email, nickname, avatar, wins. No tracking. |
| **Hebrew / RTL** | All new screens in Hebrew, right to left, using the existing design tokens. |
| **iPhone first** | Works in iPhone Safari and as a home-screen web app; keyboard-safe layouts as in the duel today. |
| **Cost** | Home stage: free. Public stage: about $5 per month for the server. |

## 8. How it is built (short)

### 8.1 Pieces
- **Game code** (`mobile/src/game/`): stays pure TypeScript and is reused unchanged by the server (draw, battle setup, resolution, bots, answer matching).
- **Server** (new `server/` folder): Node and TypeScript with **Colyseus** for rooms and connections, a SQLite file for accounts and wins.
- **Phone app**: the existing Expo web app, with a new `online` area (rooms, lobby, online duel) and a connection hook.

### 8.2 Main messages
- Phone to server: `join`, `pickCategory`, `start`, `pickTarget`, `answer`, `skip`, `continueOrReturn`, `pickFinalCategory`.
- Server to phone: `rooms`, `lobby`, `state`, `duelStart`, `picture`, `turn`, `correct`, `duelEnd`, `champion`, `error`.

### 8.3 Data stored on the server
- **users**: id, email, password hash, nickname, avatar, created.
- **wins**: user id, wins, games played.
- Rooms and games live in memory only (a server restart ends running games).

### 8.4 Known limitation of the first stages
Until the public stage, the answers file still ships inside the web app (local play needs it). The server does not rely on it, so this does not affect fairness on the home network, but it must be removed before a public launch.

## 9. Build order and acceptance criteria

Each phase ends with passing automated tests (`npm.cmd test`, `npx tsc --noEmit`) and a demo you can try.

| Phase | What is built | You can see | Done when |
|---|---|---|---|
| **0 Prepare** | Engine supports several humans and category choice per seat; a pure duel state machine; no visible change | Nothing changes in the game | All 61 existing tests pass; a multi-human game builds with unique categories |
| **1 Server, bots only** | A server that plays whole games by itself | A log of finished games | 100 seeded games each have 15 duels and one champion, matching the local engine |
| **2 Accounts** | Register and sign in on the server; wins table | Sign in against the server | Register, sign in, wrong password and duplicate email all behave correctly |
| **3 One online duel** | Two humans duel through the server; spectators watch | Two browser tabs dueling | Skip penalty, pause, loss on clock zero and wrong answers verified by a scripted test client |
| **4 Rooms and lobby** | Rooms screen, create and join, categories, start rules, leaders table | Create a room on the iPhone, join from a tab | Taken-category race, full room, bad code and host leaving all handled |
| **5 Full online game** | The whole arena online with 16 seats, spectating, reconnect, bot takeover, champion recorded | A full game with 2 to 6 humans on Wi-Fi | 16 scripted clients finish a game; a killed connection is replaced by a bot after 30 s |
| **6 Internet** | Hosting, https, rate limits, answers off the bundle, Google sign-in | Play over mobile data | Only after the licensing and budget decisions in section 11 |

## 10. Risks

| Risk | Why it matters | What we do |
|---|---|---|
| iPhone Safari drops connections when the app goes to the background | Players vanish mid-game | The 30-second bot takeover and a clean reconnect |
| Home network changes (the address changes on hotspots) | The phone cannot find the server | Show the server address clearly; document how to start it |
| Windows Firewall blocks the server port | Phones cannot connect | You open the port once (steps provided); test it early in phase 3 |
| Non-free pictures (logos, posters, characters) | Public hosting could cause copyright problems | Keep to friends-only access until a decision is made (phase 6 gate) |
| Typing latency over Wi-Fi | Unfair against fast typers | Judge answers by server arrival time and keep messages tiny |
| A single server process | A crash ends running games | Acceptable for the pilot; revisit in phase 6 |

## 11. Open questions and assumptions

These are defaults I chose. Tell me if any should change.

1. **"2 min"** in your note is read as *at least 2 players to start*. If you meant a **2-minute wait**, say so and I will add a timer.
2. **Wins** count only in games with 2 or more humans.
3. **A room is one game.** When the game ends, everyone goes back to the rooms screen and creates or joins a new room.
4. **Spectator limit**: 20 per room.
5. **Host cannot start** until every human has a category.
6. **Late joiners** to a room already in game can only watch.
7. **Licensing and budget** for phase 6 are decided later.

## 12. What success looks like

- You and 2 to 5 friends finish a full 15-duel game on home Wi-Fi without anyone being stuck.
- A dropped phone is covered by a bot and returns smoothly.
- No client can finish a duel faster than the server allows (verified by tests with a cheating test client).
- The leaders table shows the right winner after a game.
