---
name: THE ARENA (הזירה)
description: Night-stadium navy and light blue; structural glow, no classic shadows; confident, tactile touch controls in Hebrew RTL.
colors:
  sky-blue: "#7CCBFF"
  arena-blue: "#1F6BFF"
  signal-cyan: "#4DF3FF"
  trophy-gold: "#F8C95C"
  selected-gold: "#FFD25A"
  correct-green: "#3DDC97"
  alert-red: "#FF4D4D"
  warning-amber: "#FFB020"
  error-soft-red: "#FF8A8A"
  navy-deep: "#030A24"
  navy: "#071A4D"
  ink-navy: "#04112F"
  surface: "#0C2466"
  surface-muted: "#0A1D55"
  surface-raised: "#123180"
  border-blue: "#1E3F95"
  brand-border: "#2B53B8"
  board-frame: "#0B2470"
  board-frame-border: "#3FA9FF"
  arena-floor: "#0A1F5C"
  arena-floor-border: "#1C3C8C"
  board-cell-dark: "#06123A"
  board-cell-dark-border: "#102456"
  territory-me-start: "#B4EBFF"
  territory-me-border: "#D9F7FF"
  text-primary: "#FFFFFF"
  text-secondary: "#B8CBEA"
typography:
  screen-title:
    fontFamily: "Heebo_900Black, Heebo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 900
    lineHeight: 1.15
  duel-title:
    fontFamily: "Heebo_900Black, Heebo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: 1.25
  section-title:
    fontFamily: "Heebo_700Bold, Heebo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
  clock:
    fontFamily: "Heebo_900Black, Heebo, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 900
    lineHeight: 1
  button:
    fontFamily: "Heebo_900Black, Heebo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 900
  body:
    fontFamily: "Heebo_500Medium, Heebo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Heebo_700Bold, Heebo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  cell: "8px"
  control: "12px"
  button: "14px"
  card: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.sky-blue}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "56px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "rgba(124, 203, 255, 0.16)"
    textColor: "{colors.text-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "56px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "16px"
  answer-input:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.control}"
    height: "52px"
  skip-button:
    backgroundColor: "transparent"
    textColor: "{colors.trophy-gold}"
    rounded: "{rounded.control}"
    size: "76px"
    height: "52px"
  turn-pill:
    backgroundColor: "{colors.sky-blue}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.pill}"
    height: "34px"
---

# Design System: THE ARENA (הזירה)

## Overview

**Creative North Star: "זירת הלילה" (The Night Arena)**

A stadium at night: deep navy fills everything, light blue is the floodlight, and gold appears only at the moments that matter (a chosen target, a skip, the champion). The screen is dark and tense but never noisy; it stays readable under a running clock. Everything is built for one thumb on a phone in portrait, in Hebrew, right to left.

The system is flat in structure and glowing in emphasis. Surfaces are tonal steps of the same navy; important things (the main button, the arena frame, the active clock) get a soft coloured glow instead of a classic drop shadow. Controls are large, rounded and confident, with a clear pressed response. The picture being identified is always the largest thing on a duel screen.

**Key Characteristics:**
- Dark only; one navy family from `navy-deep` to `surface-raised`, plus a single light-blue voice.
- Glow, not shadow: depth is expressed by coloured halos and outlines.
- Gold is rare and means "chosen / special".
- Large touch targets (44 pt minimum), rounded corners, tactile press feedback.
- Hebrew first, RTL layout; text is Heebo only.

## Colors

A deep-navy field with a light-blue accent drawn from the logo, one warm gold, and a real green and red reserved for right and wrong.

### Primary
- **Floodlight Sky** (#7CCBFF): the one action colour. Primary buttons, "your turn", the player's own territory, focus and success highlights.
- **Arena Blue** (#1F6BFF): territories that can be attacked, with a **Signal Cyan** (#4DF3FF) outline.

### Secondary
- **Trophy Gold** (#F8C95C): bonus, skip, small headings above titles, the active clock border. **Selected Gold** (#FFD25A) marks the chosen target.

### Tertiary (feedback)
- **Correct Green** (#3DDC97): right answer only. **Alert Red** (#FF4D4D): clock under 8 s, loss. **Warning Amber** (#FFB020). **Soft Error Red** (#FF8A8A): form errors on navy.

### Neutral
- **Deep Night** (#030A24) / **Night Navy** (#071A4D): the screen gradient (top and bottom deep, middle lighter).
- **Ink Navy** (#04112F): text on light-blue buttons and on white inputs.
- **Surface** (#0C2466), **Muted Surface** (#0A1D55), **Raised Surface** (#123180): cards and wells, from lowest to highest.
- **Border Blue** (#1E3F95), **Brand Border** (#2B53B8): hairlines and card outlines.
- **Board** (#0B2470 frame, #3FA9FF frame border, #0A1F5C floor, #1C3C8C floor border, #06123A dark cell): the 4×4 arena.
- **White** (#FFFFFF) body text on navy; **Mist Blue** (#B8CBEA) secondary text.

### Named Rules
**The One Voice Rule.** Light blue is the only action colour; gold never competes with it for the same job.
**The Real Green Rule.** Green means "correct answer" and nothing else.
**The Floor Colour Rule.** Board colours keep one meaning in every situation: floor = ordinary territory, light blue = me/drawn/winner, blue with cyan outline = can be attacked, gold = chosen, dark = not relevant now.

## Typography

**Display / Body Font:** Heebo (Black 900, Bold 700, Medium 500, Regular 400), falling back to system sans.
**Character:** one friendly geometric Hebrew sans used at a few weights; hierarchy comes from size and weight, not from font changes.

### Hierarchy
- **Screen title** (900, 28/32): screen headings.
- **Duel title** (900, 24/30): the category name in a duel.
- **Section title** (700, 20): sections inside cards and sheets.
- **Clock** (900, up to 56): the clocks; the largest numerals in the game.
- **Button** (900, 16): all button labels.
- **Body** (500, 14): explanations and list text.
- **Caption** (700, 12): small gold eyebrows and secondary lines; never smaller than 12.

### Named Rules
**The 12 Point Floor.** No text below 12.
**The Black Is Rare Rule.** The Black face is for headings, clocks and buttons; everything else uses Bold or Medium.

## Layout

One column, maximum content width 430 pt, centred, with 16 pt side padding and a spacing scale of 4 / 8 / 12 / 16 / 24 / 32. Screens fill the visible area; in a duel the fixed parts (header, clocks, answer row) stay compact and the picture area takes whatever height remains. When the iOS keyboard is open (visible height under 600) the duel switches to a compact layout: title and way share one line, clocks shrink, and the turn pill is hidden. Minimum touch target 44 pt, main buttons 56 pt tall. All layout is right-to-left; the board is always column 0 on the left.

## Elevation & Depth

Tonal layering plus glow. Surfaces are flat steps of navy separated by a 1–2 pt blue border. Emphasis is a soft coloured halo (shadow colour equal to the element's own colour), never a black drop shadow.

### Shadow Vocabulary
- **Primary glow** (`shadow: sky-blue, opacity 0.45, radius 16, offset 0 4`): the primary button.
- **Board glow** (`shadow: #3FA9FF, opacity 0.4, radius 14`): the arena frame and its mini-maps.
- **Hairline outline** (2 pt Border Blue): cards and wells.

### Named Rules
**The Glow Not Shadow Rule.** If something needs to stand out it glows in its own colour; nothing casts a grey shadow.

## Shapes

Rounded and confident: cards 20, buttons 14, inputs and clocks 12, board cells 8, pills fully round. Territories merge: neighbouring cells of one owner lose their inner borders and corners so a territory reads as one shape. Pictures sit inside a card that wraps the picture's own width and height, never cropped.

## Components

### Buttons
- **Shape:** 14 pt radius, 56 pt tall, full width for the main action.
- **Primary:** Floodlight Sky fill, Ink Navy label (Black 16), primary glow.
- **Secondary:** 2 pt Sky outline on a 16% sky tint, white label.
- **Play button (home):** 64 pt tall with a darker lower edge (5 pt, #3F9FE6) so it reads as a raised key.
- **Pressed:** scale 0.98 (no layout shift); disabled: 50% opacity.
- **Skip:** outline in Trophy Gold, 76×52, label plus "−3 s".

### Cards / Containers
- **Corner Style:** 20 pt. **Background:** Surface or Muted Surface. **Border:** 1–2 pt Border Blue (cyan or sky when highlighted). **Padding:** 16.

### Inputs / Fields
- **Style:** white field, Ink Navy text, 12 pt radius, 52 pt tall, 2 pt light-blue border; right-aligned Hebrew text.
- **Inactive (not my turn):** Muted Surface fill, Border Blue stroke, mist text.

### Turn pill and clock cards
- **Turn pill:** fully round light-blue pill with ink text. **Clock card:** 12 pt radius navy card with avatar, name, big numerals and role; the active side has a gold border and a raised surface, numerals turn red under 8 s.

### Picture card
The category picture sits in a Muted Surface card with a 2 pt light-blue border (green on a correct answer) that is exactly as big as the scaled picture.

### Arena board
Square frame (max 380 pt) with Board Glow; 4×4 cells in the Floor Colour Rule; territory labels (category name, avatar, owner) grow with the territory and wrap instead of being cut off.

## Do's and Don'ts

### Do:
- **Do** use only tokens from `design/tokens.ts`; never raw hex in screens.
- **Do** keep the picture the largest element of a duel, even with the keyboard open.
- **Do** make every touch target at least 44 pt and every main action 56 pt.
- **Do** express emphasis with a coloured glow or a gold border.
- **Do** write all copy in Hebrew, correctly gendered (masculine/feminine forms).

### Don't:
- **Don't** add a second action colour or use gold for ordinary buttons.
- **Don't** use grey drop shadows, light surfaces or white screens.
- **Don't** cut text with an ellipsis where it can wrap (category names, player names).
- **Don't** use text under 12 pt.
- **Don't** shift layout on press; use opacity or a small scale only.
- **Don't** change the logo's navy and light-blue identity.
