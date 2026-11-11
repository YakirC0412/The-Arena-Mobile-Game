# Picture audit (8.11.26)

Scanned all 1051 WebP files in `mobile/assets/items` (nothing was changed; originals stay in place).

- **Low resolution** (longest side < 400 px): 100 files. The smallest: `apps-24` (155), `technology-8` (180),
  `apps-6` (193), `apps-4` (213), `apps-8` (215), `comedians-29` (234), `basketball-teams-6` (225),
  `clothing-brands-30` (252), `divas-10` (261), `cartoons-13` (264), `cartoons-2` (285).
  The picture panel is about 360 x 150-330 pt, so anything under ~300 px looks soft on a 3x iPhone.
  Candidates for a better source (do NOT upscale): the apps and clothing-brands items above first.
- **Lots of whitespace** (content fills < 35 % of the canvas): 34 files, mostly logos (`clothing-brands-6` 5 %,
  `clothing-brands-23` 9 %, `brands-11` 15 %, `brands-28`, `brands-12`, `brands-27`, ...). They look small inside the
  panel because the logo itself is small on its canvas. Fix = crop the transparent/white margin (re-run the picture
  skill with a trim step), not a layout change.
- **Extreme aspect ratios** (< 0.6 or > 2): 49 files (tall cartoon / game characters, wide fruit and food strips).
  These are fine now: the panel uses `contain`, so they are never cropped or stretched.

Re-run the scan with the script in the session scratchpad (Pillow: size + bounding box of non-white pixels).
