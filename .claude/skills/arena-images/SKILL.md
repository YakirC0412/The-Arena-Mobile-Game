---
name: arena-images
description: Fill a whole category of THE ARENA trivia game with pictures – one picture per item, found by item name + category (Wikipedia lead image, then photo search, then AI from a prompt), resized, saved under the game's file names, credited and connected to the game. Use when the user wants pictures for a category, says a category picture is bad, or adds a new picture category.
---

# Arena images

One command fills a category. Do NOT browse or web-search for pictures yourself – run the script.
The category (its items and Hebrew answers) already exists in `mobile/src/content/categories.ts`; this
skill only supplies the pictures.

Python: `"$LOCALAPPDATA/Programs/Python/Python312/python.exe"` (needs Pillow). From the repo root:

```bash
PY="$LOCALAPPDATA/Programs/Python/Python312/python.exe"
"$PY" .claude/skills/arena-images/scripts/arena_images.py <category>
```

## 1. Sources entry (once per category)

If the category is not in `mobile/scripts/image-sources.json`, add it. Read the category's item list in
`categories.ts` and write one English entry per item, **same order** (entry n = item `<category>-n`):

```json
"football-clubs": {
  "kind": "logo",                      // photo | logo | product
  "query": "{item} crest logo",        // photo-search text
  "prompt": "The official crest of {item} football club, flat emblem, centered on a plain white background",
  "items": ["FC Barcelona", "Real Madrid CF", "..."]
}
```

- Item = the exact English Wikipedia article title when one exists (its lead image is tried first and is
  usually the best picture). `File:<name>` pins a Wikimedia file. `Title::<AI description>` sets this item's
  AI description.
- Choose `kind` from the category's battle way: a crest/icon/logo way → `logo` (logos allowed, padded on
  white); a packaging way → `product`; anything else → `photo`.
- `"prefer": ["icon", "logo"]` when the article's lead image is a screenshot or a building (apps,
  brands, companies): the article's first file with that word in its name is used instead.
- `"anyLicense": true` for posters, covers and cartoon/game characters: the article's lead image is used even
  when it is not freely licensed (private game, decisions 14 and 17).
- `"hideName": true` when the answer must not be written on the picture (crests, packaging, app icons).
- Write `prompt` so the AI picture answers the way: what must be visible, plain background, no text.
- Categories missing here fall back to `wiki-sources.json` (kind photo).

## 2. Run and read the output (one line per item)

- `OK <id> <WxH> <source>` – saved (`wikipedia`, `pexels`, `pixabay`, `openverse`, `commons`)
- `AI <id> ... (review)` – nothing good was found; AI picture saved and marked for review
- `FAIL <id> <item>: <reason>` – nothing saved; fix the entry (better title or `File:`) and rerun
- `NEEDBOX <id> <path>` – hideName: the AI could not remove the name (no key / refused). The picture is
  saved WITH the name and shown as "NAME VISIBLE" on the sheet – blur it (section 4).
- last line `SHEET <path>` – contact sheet of the whole category (red frame = AI, needs review)

The script also updates `assets/items/credits.json`, `docs/IMAGE_CREDITS.md` and the game's picture
map (`npm run images`). A category with 30 pictures becomes playable.

## 3. Review with the user

Read the `SHEET` image (one image for the whole category – do not open pictures one by one) and tell
the user, in Hebrew, which numbers look wrong. Show the user the sheet too. Fix:

- wrong picture → change that entry (other title / `File:` / `::description`), then
  `--only <n> --force`
- user wants an AI picture → `--only <n> --ai --desc "<visual description>"`
- `--sheet` only rebuilds the sheet

Replaced pictures move to `archive/replaced-images/` (never deleted). Then follow CLAUDE.md:
typecheck, tests, open the category in `/qa-duel?category=<id>`, commit, push.

## 4. Blur names by hand (`--boxes`)

Works on the saved pictures, offline, for any category; the unblurred original stays in
`archive/reveal/<category>/` and every rerun blurs from it, so just rerun with better shapes.

1. `--grid 3,4,5,7` (up to 4 items) prints `GRID <path>`: the pictures side by side, each 420px square with
   a line every 10% (magenta = 50%) under a 24px label strip. Read it and note where the text is.
2. Shapes, as fractions of the picture, split by `;`:
   - rectangle `x,y,w,h`
   - ring `ring:cx,cy,r_out,r_in[,from,to]` – text running around a round badge; `from,to` in degrees,
     0 = right, 90 = bottom, 270 = top, clockwise (top arc ≈ `195,345`, bottom arc ≈ `20,160`).
3. All items in one call: `--boxes "4=0.2,0.25,0.6,0.07;0.27,0.39,0.46,0.15" --boxes "5=ring:0.5,0.5,0.42,0.27"`
4. Check the gridded view again; text that is still readable → bigger shape, rerun that item.

When the symbol stands next to the written name (TikTok, Spotify, Airbnb wordmarks), crop to the symbol
instead of blurring: `--crop "4=0.02,0.35,0.29,0.3"` (rectangle, padded to a white square).

A wrong picture nobody can fix now: `--reject 2,8` takes it out of the game (to archive/replaced-images);
a later plain run tries to fill it again. A category is playable only with 30 good pictures.

A picture that shows no name at all: `--ok 1,3,5` (removes "NAME VISIBLE" from the sheet).

Hide full names, city names and initials written as text (FCB, CABJ). Keep monograms that are the
crest itself (BVB, Juventus J). The shapes used are saved in credits.json (`blur`).

## 5. Pictures from the user

The user may send pictures (often a zip). Unzip into a new empty folder in the scratchpad, look at them
on one sheet, match each to its item number, then
`--file "2=<path>" --file "7=<path>"` – resized, saved, credited as "provided by the user". With
hideName they come in as "NAME VISIBLE": blur or crop as in section 4. A trimmed copy (stray strips,
borders) can be made first in the scratchpad.

## Keys

Optional, in env vars or `.claude/skills/arena-images/keys.env` (git-ignored; never print it):
`PEXELS_API_KEY`, `PIXABAY_API_KEY` (better photos), `POLLINATIONS_TOKEN` (AI limits, name removal),
`OPENAI_API_KEY` (second AI). Without keys: Wikipedia, Openverse, Commons and free Pollinations AI.
