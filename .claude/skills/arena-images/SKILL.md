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
  white); a packaging way → `product` (+ `"hideName": true` when the way says "without the name");
  anything else → `photo`.
- Write `prompt` so the AI picture answers the way: what must be visible, plain background, no text.
- Categories missing here fall back to `wiki-sources.json` (kind photo).

## 2. Run and read the output (one line per item)

- `OK <id> <WxH> <source>` – saved (`wikipedia`, `pexels`, `pixabay`, `openverse`, `commons`)
- `AI <id> ... (review)` – nothing good was found; AI picture saved and marked for review
- `FAIL <id> <item>: <reason>` – nothing saved; fix the entry (better title or `File:`) and rerun
- `NEEDBOX <id> <reveal path>` – hideName failed: read that picture once, estimate text/logo rectangles
  as fractions (x,y,w,h) and rerun with `--only <n> --boxes "x,y,w,h;..."`
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

## Keys

Optional, in env vars or `.claude/skills/arena-images/keys.env` (git-ignored; never print it):
`PEXELS_API_KEY`, `PIXABAY_API_KEY` (better photos), `POLLINATIONS_TOKEN` (AI limits, name removal),
`OPENAI_API_KEY` (second AI). Without keys: Wikipedia, Openverse, Commons and free Pollinations AI.
