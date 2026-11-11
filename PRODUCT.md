# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Hebrew speakers, mainly friends and family playing together in the same room or on a chat, on their own phones
(iPhone Safari first). Over time the game may open to a public audience of strangers who find public rooms and
climb a leaderboard. A session is short, casual and competitive: people type answers fast while a clock is running.

## Product Purpose
THE ARENA (הזירה) is a Hebrew visual-trivia game. A 4×4 arena holds 16 contestants, each with a unique category.
A drawn contestant attacks an orthogonal neighbour, and the duel is played on the defender's category: identify
pictures by typing, each side has its own clock (40 s, 45 with a bonus) that runs only on their turn. The loser is
eliminated and their territory goes to the winner. A game is always 15 duels until one champion remains.
Success = a full game that feels fair, fast and tense, and that people want to replay.

## Positioning
Two things together that another trivia game does not copy: the arena (territory conquest, elimination, always 15
duels to a single champion) and the pure visual identification (pictures against a clock, typed answers, no
multiple choice). Single player against 15 bots, and online rooms of up to 6 people with bots filling the rest.

## Operating Context
Used on a phone in portrait, often with the iOS keyboard open during a duel, so the visible area is small and
changes. The server (Colyseus) is authoritative for online games. Today the web build runs on the developer's own
PC (home Wi-Fi) and a static single-player build is published through GitHub Pages; internet hosting is a later phase.

## Capabilities and Constraints
- Local mode (1 human vs 15 bots) is polished; online multiplayer (rooms, lobby, live duels, spectators, bot
  takeover, leaderboard) works on the home network.
- Content: 35 playable categories, about 1000 pictures, edited through the admin panel; every item has answers
  and accepted spellings. Hebrew only, no content filtering by design, clean of racism, profanity and sexual content.
- Players have a gender field so Hebrew text can be addressed correctly (masculine/feminine forms).
- Technical: Expo / React Native web build; the rules live in pure TypeScript shared by client and server.
- Open: public hosting, https, Google sign-in, and licensing of non-free pictures (logos, posters, characters).

## Brand Commitments
- Name: THE ARENA – הזירה, with the existing logo; the logo's identity (deep navy and light blue) is binding.
- Hebrew only, right to left; no English UI copy.
- The testing device order: iPhone Safari first, then other browsers.

## Evidence on Hand
Real content and assets live in `mobile/assets` (items, avatars, sounds, logo) and `mobile/src/content`. There are no
testimonials, press, customer numbers or published metrics; do not invent any. Rules and decisions are recorded
in `docs/GAME_RULES.md`, `docs/DECISIONS.md` and `docs/PRD.md`.

## Product Principles
- The picture is the challenge: it stays large, clear and never cropped, even with the keyboard open.
- The clock and whose turn it is must be readable at a glance; nothing hides time pressure.
- Rules are the same everywhere (local, online, server); the UI never invents state of its own.
- Hebrew first: right-to-left reading order and correctly gendered texts everywhere.
- Phone first: touch targets, small visible areas and one-thumb play come before desktop polish.

## Accessibility & Inclusion
Minimum font 12, touch targets of at least 44 pt, sufficient contrast on the dark navy background, reduced-motion
respected in animations. Gendered Hebrew forms follow the player's own choice.
