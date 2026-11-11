#!/usr/bin/env python3
"""Fill a whole Arena category with pictures, item by item.

Reads admin/image-sources.json, finds a
picture for every item (Wikipedia lead image -> photo search -> AI), resizes it,
saves it as mobile/assets/items/<category>/<category>-<n>.webp, records credits,
connects the pictures to the game and writes a contact sheet for review.

Usage:
  arena_images.py <category>                      items that have no picture yet
  arena_images.py <category> --only 3,7 --force   redo these items
  arena_images.py <category> --only 9 --ai --desc "red liver bird crest"   AI, own description
  arena_images.py <category> --boxes "4=0.3,0.4,0.4,0.15;ring:0.5,0.5,0.45,0.35"   blur areas of item 4
  arena_images.py <category> --sheet              only rebuild the contact sheet

Needs Python 3 + Pillow. Keys (all optional): env vars or <skill>/keys.env –
PEXELS_API_KEY, PIXABAY_API_KEY, POLLINATIONS_TOKEN, OPENAI_API_KEY.
"""
import argparse, base64, concurrent.futures as cf, io, json, os, random, re, shutil, subprocess, sys, threading, time
import urllib.error, urllib.parse, urllib.request

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
MOBILE = os.path.join(REPO, "mobile")
ITEMS_DIR = os.path.join(MOBILE, "assets", "items")
CREDITS = os.path.join(ITEMS_DIR, "credits.json")
SOURCES = os.path.join(REPO, "admin", "image-sources.json")
ARCHIVE = os.path.join(REPO, "archive")
UA = "TheArenaPrototype/0.1 (private trivia game; picture download)"
WIKI_API = "https://en.wikipedia.org/w/api.php"
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
MAX_SIDE = 640


def load_keys():
    try:
        for line in open(os.path.join(SKILL_DIR, "keys.env"), encoding="utf-8"):
            k, sep, v = line.strip().partition("=")
            if sep and k and not k.startswith("#"):
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except OSError:
        pass


load_keys()


# ---------- http ----------
def get(url, headers=None, timeout=15, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500 or attempt == 5:
                raise
            wait = e.headers.get("Retry-After", "")
            time.sleep(int(wait) if wait.isdigit() else 5 * 2 ** attempt)


def get_json(url, headers=None):
    return json.loads(get(url, headers))


plain = lambda html: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()[:120]


# ---------- Wikipedia (lead image of an article, or a pinned File:) ----------
def wiki_lead(title, any_license):
    d = get_json(WIKI_API + "?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": 2, "redirects": 1, "prop": "pageimages",
        "piprop": "name", "pilicense": "any" if any_license else "free", "titles": title}))
    pages = d.get("query", {}).get("pages", [])
    return pages[0].get("pageimage") if pages else None


def wiki_named_file(title, words):
    """First file used in the article whose name contains the item's name and one of words (in order),
    e.g. ["icon", "logo"] -> "Instagram icon.png" before "Instagram logo 2022.svg"."""
    d = get_json(WIKI_API + "?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": 2, "redirects": 1, "prop": "images",
        "imlimit": 100, "titles": title}))
    pages = d.get("query", {}).get("pages", [])
    names = [i["title"].split(":", 1)[1] for i in (pages[0].get("images") or [])] if pages else []
    key = re.sub(r"\s*\(.*?\)", "", title).split()[0].lower().replace("-", "")  # "Amazon (company)" -> "amazon"
    names = [n for n in names if key in n.lower().replace("-", "").replace("_", "")
             and not re.search(r"oojs|commons-logo|wiki|edit|question_book|symbol_|padlock|ambox", n, re.I)]
    for word in words:
        for n in names:
            if word.lower() in n.lower():
                return n
    return None


def wiki_file(name):
    """Thumbnail url + license/author of a file on Wikipedia or Commons."""
    d = get_json(WIKI_API + "?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": 2, "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 800, "titles": "File:" + name}))
    pages = d.get("query", {}).get("pages", [])
    ii = (pages[0].get("imageinfo") or [None])[0] if pages else None
    if not ii:
        return None
    meta = ii.get("extmetadata") or {}
    return dict(url=ii.get("thumburl") or ii["url"], w=ii.get("thumbwidth") or ii.get("width", 0),
                h=ii.get("thumbheight") or ii.get("height", 0), file=name.replace(" ", "_"),
                license=(meta.get("LicenseShortName") or {}).get("value") or "Non-free (fair use)",
                author=plain((meta.get("Artist") or {}).get("value")) or "—", page=ii.get("descriptionurl", ""))


# ---------- photo search (candidates: url, w, h, title, src, credit) ----------
def pexels(q):
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        return []
    d = get_json("https://api.pexels.com/v1/search?" + urllib.parse.urlencode({"query": q, "per_page": 15}),
                 {"Authorization": key})
    return [dict(url=p["src"]["large"], w=p["width"], h=p["height"], title=p.get("alt") or q, src="pexels",
                 credit=dict(license="Pexels License", author=p["photographer"], page=p["url"], file=str(p["id"])))
            for p in d.get("photos", [])]


def pixabay(q):
    key = os.environ.get("PIXABAY_API_KEY")
    if not key:
        return []
    d = get_json("https://pixabay.com/api/?" + urllib.parse.urlencode(
        {"key": key, "q": q, "image_type": "photo", "per_page": 20, "safesearch": "true"}))
    return [dict(url=h["webformatURL"], w=h["imageWidth"], h=h["imageHeight"], title=h.get("tags", ""), src="pixabay",
                 credit=dict(license="Pixabay License", author=h["user"], page=h["pageURL"], file=str(h["id"])))
            for h in d.get("hits", [])]


def openverse(q):
    d = get_json("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({"q": q, "page_size": 20, "mature": "false"}))
    return [dict(url=r["url"], w=r.get("width") or 0, h=r.get("height") or 0, title=r.get("title") or "", src="openverse",
                 credit=dict(license=f'{r.get("license", "").upper()} {r.get("license_version") or ""}'.strip(),
                             author=r.get("creator") or "—", page=r.get("foreign_landing_url", ""), file=r.get("id", "")))
            for r in d.get("results", [])]


def commons(q):
    d = get_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap|drawing {q}",
        "gsrnamespace": 6, "gsrlimit": 20, "prop": "imageinfo", "iiprop": "url|size|mime", "iiurlwidth": 800}))
    out = []
    for p in (d.get("query") or {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/svg+xml"):
            continue
        out.append(dict(url=ii.get("thumburl") or ii["url"], w=ii.get("width", 0), h=ii.get("height", 0),
                        title=p.get("title", ""), src="commons", credit=None))
    return out


SEARCHES = [pexels, pixabay, openverse, commons]
PRIORITY = {"pexels": 1.0, "pixabay": 0.8, "openverse": 0.4, "commons": 0.3}
BAD_WORDS = ("map", "diagram", "chart", "screenshot", "stamp", "drawing of", "plan", "graph", "poster", "page")
LOGO_BAD = ("logo", "icon", "coat of arms", "flag", "text")


def score(c, q, kind, min_side):
    w, h = c["w"], c["h"]
    if w and h and (min(w, h) < min_side or not 0.4 < w / h < 2.5):
        return -1
    title, ql = c["title"].lower(), q.lower()
    words = [wd for wd in re.findall(r"\w+", ql) if len(wd) > 2]
    rel = sum(wd in title for wd in words) / max(len(words), 1)
    if rel == 0 and c["src"] in ("openverse", "commons"):
        return -1
    bad = BAD_WORDS + (() if kind == "logo" else LOGO_BAD)
    if any(b in title for b in bad if b not in ql):
        return -1
    return rel * 2 + PRIORITY[c["src"]] + (min(min(w, h), 1600) / 1600 if w and h else 0.2)


def is_image(b):
    return bool(b) and (b[:3] == b"\xff\xd8\xff" or b[:4] == b"\x89PNG" or (b[:4] == b"RIFF" and b[8:12] == b"WEBP"))


# ---------- AI ----------
_ai_lock = threading.Lock()  # one AI call at a time: parallel calls hit rate limits
OPENAI_STATE = os.path.join(SKILL_DIR, ".openai_state.json")


class OpenAIUnavailable(Exception):
    pass


def openai_ready():
    if not os.environ.get("OPENAI_API_KEY"):
        return False
    try:
        return time.time() > json.load(open(OPENAI_STATE)).get("off_until", 0)
    except Exception:
        return True


def openai_call(path, data, ctype):
    if not openai_ready():
        raise OpenAIUnavailable("openai skipped (no key, or credits used up)")
    try:
        return json.loads(get("https://api.openai.com/v1/" + path,
                              {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": ctype},
                              timeout=180, data=data))
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read()).get("error", {})
        except Exception:
            err = {}
        code, msg = str(err.get("code") or err.get("type") or ""), str(err.get("message", ""))[:120]
        if code in ("insufficient_quota", "billing_hard_limit_reached") or "quota" in msg or "billing" in msg:
            json.dump({"off_until": time.time() + 12 * 3600}, open(OPENAI_STATE, "w"))
            raise OpenAIUnavailable("openai credits used up - skipping OpenAI for 12h")
        raise OpenAIUnavailable(f"openai error {e.code}: {msg}")


def ai_generate(prompt):
    errors = []
    with _ai_lock:
        tok = os.environ.get("POLLINATIONS_TOKEN")
        try:
            url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt) + "?" + urllib.parse.urlencode(
                {"width": 1024, "height": 1024, "nologo": "true", "model": "flux", "seed": random.randint(1, 10**6)}))
            b = get(url, {"Authorization": f"Bearer {tok}"} if tok else None, timeout=120)
            if is_image(b):
                return b, "pollinations flux"
            errors.append("pollinations: not an image")
        except Exception as e:
            errors.append(f"pollinations: {e}")
        try:
            d = openai_call("images/generations", json.dumps({"model": "gpt-image-1", "prompt": prompt, "size": "1024x1024",
                                                              "n": 1, "quality": "medium"}).encode(), "application/json")
            return base64.b64decode(d["data"][0]["b64_json"]), "openai gpt-image-1"
        except Exception as e:
            errors.append(str(e))
    raise RuntimeError("; ".join(errors))


# ---------- hide the product name (categories with "hideName": true) ----------
HIDE_PROMPT = ("Remove ALL text, letters, words, numbers, brand names and logos from the product and its packaging. "
               "Fill those areas with the surrounding colors and texture so it looks natural. Keep everything else the same.")


def hide_name(b, url):
    if not (os.environ.get("POLLINATIONS_TOKEN") or openai_ready()):  # both refuse without a key: don't wait for it
        return None, "no AI key: blur with --boxes"
    errors = []
    with _ai_lock:
        if url:
            try:
                tok = os.environ.get("POLLINATIONS_TOKEN")
                out = get("https://image.pollinations.ai/prompt/" + urllib.parse.quote(HIDE_PROMPT) + "?" + urllib.parse.urlencode(
                    {"model": "kontext", "image": url, "nologo": "true", "private": "true", "seed": random.randint(1, 10**6)}),
                    {"Authorization": f"Bearer {tok}"} if tok else None, timeout=120)
                if is_image(out):
                    return out, "ai-edit pollinations"
            except Exception as e:
                errors.append(f"pollinations: {e}")
        try:
            bd = "----arena" + str(random.randint(1, 10**9))
            parts = [f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
                     for k, v in (("model", "gpt-image-1"), ("prompt", HIDE_PROMPT), ("quality", "medium"))]
            parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="image"; filename="img.jpg"\r\n'
                         f'Content-Type: image/jpeg\r\n\r\n'.encode() + b + b"\r\n" + f"--{bd}--\r\n".encode())
            d = openai_call("images/edits", b"".join(parts), f"multipart/form-data; boundary={bd}")
            return base64.b64decode(d["data"][0]["b64_json"]), "ai-edit openai"
        except Exception as e:
            errors.append(str(e))
    return None, "; ".join(errors)


WEBP_QUALITY = 85


def has_alpha(im):
    return im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)


def encode_webp(im):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
    return buf.getvalue()


def to_webp(b):
    """Any image bytes -> WebP bytes (kept at most MAX_SIDE px, transparency kept). WebP passes through unchanged."""
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return b
    im = Image.open(io.BytesIO(b))
    im.load()
    im = im.convert("RGBA" if has_alpha(im) else "RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return encode_webp(im)


def blur_shapes(b, spec):
    """Blur areas of a saved picture. spec: shapes split by ';', all in fractions of the picture –
    "x,y,w,h" = rectangle, "ring:cx,cy,r_out,r_in[,from,to]" = band between two circles (text around round
    badges), optionally only from..to degrees (0 = right, 90 = bottom, 270 = top; clockwise)."""
    im = Image.open(io.BytesIO(b)).convert("RGB")
    W, H = im.size
    mask = Image.new("L", im.size, 0)
    for shape in filter(None, (v.strip() for v in spec.split(";"))):
        part = Image.new("L", im.size, 0)
        draw = ImageDraw.Draw(part)
        if shape.startswith("ring:"):
            cx, cy, ro, ri, *arc = (float(v) for v in shape[5:].split(","))
            start, end = arc if arc else (0, 360)
            draw.pieslice((cx * W - ro * W, cy * H - ro * W, cx * W + ro * W, cy * H + ro * W), start, end, fill=255)  # radius is a fraction of the width: a true circle
            draw.ellipse((cx * W - ri * W, cy * H - ri * W, cx * W + ri * W, cy * H + ri * W), fill=0)
        else:
            x, y, w, h = (float(v) for v in shape.split(","))
            draw.rectangle((x * W, y * H, (x + w) * W, (y + h) * H), fill=255)
        mask = ImageChops.lighter(mask, part)
    small = im.resize((max(1, W // 28), max(1, H // 28)), Image.BILINEAR)
    blurred = small.resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(W // 60))
    im.paste(blurred, mask=mask.filter(ImageFilter.GaussianBlur(2)))
    return encode_webp(im)


def reveal_path(category, item_id):
    """The untouched original of an edited picture (older ones are .jpg, new ones .webp)."""
    base = os.path.join(ARCHIVE, "reveal", category, item_id)
    for ext in (".webp", ".jpg"):
        if os.path.exists(base + ext):
            return base + ext
    return base + ".webp"


def crop_square(b, spec):
    """Keep only the rectangle "x,y,w,h" (fractions), padded to a white square – e.g. a symbol next to its name."""
    im = Image.open(io.BytesIO(b)).convert("RGB")
    W, H = im.size
    x, y, w, h = (float(v) for v in spec.split(","))
    im = im.crop((int(x * W), int(y * H), int((x + w) * W), int((y + h) * H)))
    data, _ = finalize(_png(im), "logo")
    return data


def _png(im):
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def edit_item(category, n, spec, credits, how):
    """Blur or crop an item's saved picture. The untouched original is kept in archive/reveal/."""
    item_id, cur = f"{category}-{n}", existing(category, n)
    if not cur:
        return f"FAIL {item_id}: no picture to {how}"
    rev = reveal_path(category, item_id)
    if not os.path.exists(rev):
        os.makedirs(os.path.dirname(rev), exist_ok=True)
        shutil.copy(cur, rev)
    original = open(rev, "rb").read()  # always from the original, so a rerun replaces the edit
    data = blur_shapes(original, spec) if how == "blur" else crop_square(original, spec)
    os.remove(cur)
    with open(os.path.join(ITEMS_DIR, category, f"{item_id}.webp"), "wb") as f:
        f.write(data)
    credits.setdefault(item_id, {}).update(hidden=how, **{how: spec})
    credits[item_id].pop("needbox", None)
    return f"{how.upper()} {item_id}"


# ---------- finding one item's picture ----------
def find_picture(entry, cfg, a):
    """Returns (bytes, url, credit dict). Order: pinned File: -> Wikipedia lead image -> search -> AI."""
    kind = cfg.get("kind", "photo")
    name, _, desc = entry.partition("::")
    name, desc = name.strip(), (a.desc or desc.strip())
    if not a.ai:
        lead = name[5:] if name.startswith("File:") else None
        if not lead and cfg.get("prefer"):
            lead = wiki_named_file(name, cfg["prefer"])
        if not lead and cfg.get("wikipedia", True):
            lead = wiki_lead(name, any_license=kind == "logo" or cfg.get("anyLicense", False))  # errors fail the item: better a rerun than an AI guess
        if lead and not (kind != "logo" and lead.lower().endswith(".svg")):
            info = wiki_file(lead)
            if info and (kind == "logo" or cfg.get("anyLicense") or min(info["w"], info["h"]) >= 300):
                b = get(info["url"])
                if is_image(b):
                    return b, info["url"], dict(source=name, via="wikipedia", **{k: info[k] for k in ("file", "license", "author", "page")})
        if not name.startswith("File:"):
            q = cfg.get("query", "{item}").replace("{item}", name)
            cands = []
            with cf.ThreadPoolExecutor(len(SEARCHES)) as ex:
                for f in [ex.submit(fn, q) for fn in SEARCHES]:
                    try:
                        cands += f.result()
                    except Exception:
                        pass
            min_side = 200 if kind == "logo" else a.min
            for c in sorted((c for c in cands if score(c, q, kind, min_side) >= 0), key=lambda c: -score(c, q, kind, min_side))[:4]:
                try:
                    b = get(c["url"])
                except Exception:
                    continue
                if not is_image(b) or len(b) < 8_000:
                    continue
                cr = c["credit"]
                if cr is None:  # commons search hit: look up license and author
                    info = wiki_file(c["title"].replace("File:", "", 1)) or {}
                    cr = {k: info.get(k, "?") for k in ("file", "license", "author", "page")}
                return b, c["url"], dict(source=name, via=c["src"], **cr)
    prompt = desc or cfg.get("prompt", "{item}, clear photo, centered subject, plain background").replace("{item}", name)
    b, model = ai_generate(prompt)
    return b, None, dict(source=name, via="ai", file="", license="AI generated", author=model, page="", prompt=prompt, review=True)


def finalize(b, kind):
    """Flatten transparency on white, square-pad logos, fit in MAX_SIDE, return WebP bytes."""
    im = Image.open(io.BytesIO(b))
    im.load()
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, "white")
        bg.alpha_composite(im)
        im = bg
    im = im.convert("RGB")
    if kind == "logo":
        side = int(max(im.size) * 1.12)
        sq = Image.new("RGB", (side, side), "white")
        sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        im = sq
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return encode_webp(im), im.size


# ---------- files ----------
def existing(category, n):
    d = os.path.join(ITEMS_DIR, category)
    if not os.path.isdir(d):
        return None
    for f in os.listdir(d):
        base, ext = os.path.splitext(f)
        if base == f"{category}-{n}" and ext.lower() in EXTENSIONS:
            return os.path.join(d, f)
    return None


def save(category, n, data):
    old = existing(category, n)
    if old:  # never delete: older pictures go to archive/replaced-images
        os.makedirs(os.path.join(ARCHIVE, "replaced-images"), exist_ok=True)
        shutil.move(old, os.path.join(ARCHIVE, "replaced-images", f"{int(time.time())}-{os.path.basename(old)}"))
    os.makedirs(os.path.join(ITEMS_DIR, category), exist_ok=True)
    path = os.path.join(ITEMS_DIR, category, f"{category}-{n}.webp")  # every picture in the game is WebP
    with open(path, "wb") as f:
        f.write(to_webp(data))
    return path


def contact_sheet(category, entries, credits):
    cell, cols, cap = 180, 6, 34
    rows = (len(entries) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + cap)), (24, 24, 32))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=13)
    except TypeError:
        font = ImageFont.load_default()
    for i, entry in enumerate(entries):
        n, x, y = i + 1, (i % cols) * cell, (i // cols) * (cell + cap)
        path = existing(category, n)
        if path:
            im = Image.open(path).convert("RGB")
            im.thumbnail((cell - 8, cell - 8))
            sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        cr = credits.get(f"{category}-{n}", {})
        color = (255, 90, 90) if cr.get("review") or not path else (230, 230, 230)
        if cr.get("review"):
            draw.rectangle((x + 2, y + 2, x + cell - 3, y + cell - 3), outline=color, width=4)
        label = f"{n}. {entry.partition('::')[0].replace('File:', '')[:20]}"
        draw.text((x + 6, y + cell + 2), label, fill=color, font=font)
        note = ("MISSING" if not path else "AI - review" if cr.get("review") else "NAME VISIBLE" if cr.get("needbox")
                else f'{cr.get("via", "")} {"(" + cr["hidden"] + ")" if cr.get("hidden") else ""}')
        draw.text((x + 6, y + cell + 17), note, fill=(255, 90, 90) if cr.get("needbox") else color, font=font)
    out = os.path.join(ARCHIVE, "image-review", f"{category}.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out, "JPEG", quality=85)
    return out


def grid_view(category, numbers):
    """Pictures side by side with a line every 10% (magenta = 50%), for placing --boxes shapes."""
    S = 420
    sheet = Image.new("RGB", (S * len(numbers), S + 24), "white")
    draw = ImageDraw.Draw(sheet)
    for k, n in enumerate(numbers):
        path = existing(category, n)
        if not path:
            continue
        im = Image.open(path).convert("RGB").resize((S, S))
        g = ImageDraw.Draw(im)
        for t in range(1, 10):
            c = (255, 0, 255) if t == 5 else (0, 200, 255)
            g.line((t * S / 10, 0, t * S / 10, S), fill=c)
            g.line((0, t * S / 10, S, t * S / 10), fill=c)
        sheet.paste(im, (k * S, 24))
        draw.text((k * S + 6, 4), f"#{n}", fill="black")
        draw.line((k * S, 0, k * S, S + 24), fill="black", width=3)
    out = os.path.join(ARCHIVE, "image-review", f"{category}-grid.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out, "JPEG", quality=88)
    return out


def convert_all():
    """One-off migration: every jpg/png/gif picture becomes WebP; the originals move to archive/original-images."""
    done, before, after = 0, 0, 0
    for cat in sorted(os.listdir(ITEMS_DIR)):
        folder = os.path.join(ITEMS_DIR, cat)
        if not os.path.isdir(folder):
            continue
        for f in sorted(os.listdir(folder)):
            base, ext = os.path.splitext(f)
            if ext.lower() not in (".jpg", ".jpeg", ".png", ".gif"):
                continue
            src = os.path.join(folder, f)
            data = to_webp(open(src, "rb").read())
            with open(os.path.join(folder, base + ".webp"), "wb") as out:
                out.write(data)
            before, after, done = before + os.path.getsize(src), after + len(data), done + 1
            keep = os.path.join(ARCHIVE, "original-images", cat)
            os.makedirs(keep, exist_ok=True)
            shutil.move(src, os.path.join(keep, f))
    print(f"CONVERTED {done} pictures: {before // 1024} KB -> {after // 1024} KB")
    for line in run_node("build-item-images.js"):
        print(line)


def run_node(script):
    node = shutil.which("node") or r"C:\Program Files\nodejs\node.exe"
    r = subprocess.run([node, os.path.join(MOBILE, "scripts", script)], cwd=MOBILE, capture_output=True, text=True)
    return (r.stdout + r.stderr).strip().splitlines()[-1:] if r.returncode == 0 else [f"! {script} failed: {r.stderr.strip()[-300:]}"]


def load_config(category):
    for path in (SOURCES,):
        try:
            cfg = json.load(open(path, encoding="utf-8")).get(category)
        except OSError:
            continue
        if cfg:
            return cfg if isinstance(cfg, dict) else {"kind": "photo", "items": cfg}
    sys.exit(f"No entry for '{category}' in admin/image-sources.json – add it first (see SKILL.md).")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="Fill an Arena category with pictures.")
    p.add_argument("category", nargs="?")
    p.add_argument("--only", help="item numbers, e.g. 3,7,12")
    p.add_argument("--force", action="store_true", help="redo items that already have a picture")
    p.add_argument("--ai", action="store_true", help="skip the search, generate with AI")
    p.add_argument("--desc", help="AI description (use with --only for one item)")
    p.add_argument("--boxes", action="append", help='blur areas of saved pictures: "<n>=x,y,w,h;ring:cx,cy,ro,ri" '
                   '(fractions of the picture; repeat for more items; without "<n>=" it applies to --only)')
    p.add_argument("--crop", action="append", help='keep only "<n>=x,y,w,h" (fractions) of saved pictures, '
                   'padded to a square – a symbol without the name written next to it')
    p.add_argument("--ok", help="hideName: mark these items as checked – no name on the picture, e.g. 1,3,5")
    p.add_argument("--restore", help="put the untouched original back (undo blur/crop), e.g. 4,9")
    p.add_argument("--to-webp", action="store_true", help="convert every picture of every category to WebP (originals go to archive/original-images)")
    p.add_argument("--reject", help="take these pictures out of the game (to archive/replaced-images), e.g. 2,8")
    p.add_argument("--file", action="append", help='use a picture the user gave: "<n>=<path>" (repeat for more)')
    p.add_argument("--min", type=int, default=400, help="min short side of searched photos (default 400)")
    p.add_argument("--sheet", action="store_true", help="only rebuild the contact sheet")
    p.add_argument("--grid", help="only make a gridded view of these items (up to 4), e.g. 3,4,5")
    a = p.parse_args()
    if a.to_webp:
        return convert_all()
    if not a.category:
        p.error("a category is needed (or --to-webp)")
    if a.grid:
        return print("GRID " + grid_view(a.category, [int(v) for v in a.grid.split(",")]))

    cfg = load_config(a.category)
    entries = cfg["items"]
    credits = json.load(open(CREDITS, encoding="utf-8")) if os.path.exists(CREDITS) else {}
    edits = [(spec, "blur") for spec in a.boxes or []] + [(spec, "crop") for spec in a.crop or []]
    for spec in a.file or []:
        n, _, src = spec.partition("=")
        item_id = f"{a.category}-{int(n)}"
        data, _ = finalize(open(src, "rb").read(), cfg.get("kind", "photo"))
        save(a.category, int(n), data)
        old_reveal = reveal_path(a.category, item_id)
        if os.path.exists(old_reveal):  # a new original: older blur/crop edits no longer apply
            os.remove(old_reveal)
        credits[item_id] = dict(source=entries[int(n) - 1].partition("::")[0], via="user", file=os.path.basename(src),
                                license="provided by the user", author="—", page="",
                                **({"needbox": True} if cfg.get("hideName") else {}))
        print(f"FILE {item_id}" + (" (check the name)" if cfg.get("hideName") else ""))
        edits.append(("", "ok"))
    for n in (a.restore or "").split(","):
        if not n.strip():
            continue
        item_id = f"{a.category}-{n.strip()}"
        rev = reveal_path(a.category, item_id)
        if not os.path.exists(rev):
            print(f"FAIL {item_id}: no original to restore")
            continue
        save(a.category, int(n), open(rev, "rb").read())  # the edited picture goes to archive/replaced-images
        cr = credits.setdefault(item_id, {})
        for k in ("hidden", "blur", "crop"):
            cr.pop(k, None)
        if cfg.get("hideName"):
            cr["needbox"] = True
        print(f"RESTORED {item_id}")
        edits.append(("", "ok"))
    for n in (a.reject or "").split(","):
        if n.strip() and existing(a.category, n.strip()):
            old = existing(a.category, n.strip())
            os.makedirs(os.path.join(ARCHIVE, "replaced-images"), exist_ok=True)
            shutil.move(old, os.path.join(ARCHIVE, "replaced-images", f"{int(time.time())}-{os.path.basename(old)}"))
            credits.pop(f"{a.category}-{n.strip()}", None)
            print(f"REJECT {a.category}-{n.strip()}")
            edits.append(("", "ok"))
    for n in (a.ok or "").split(","):
        if n.strip():
            credits.setdefault(f"{a.category}-{n.strip()}", {}).pop("needbox", None)
            edits.append(("", "ok"))
    if edits:
        for spec, how in edits:
            n, sep, shapes = spec.partition("=")
            items = [int(n)] if sep else [int(v) for v in (a.only or "").split(",") if v]
            for item in items if how != "ok" else []:
                print(edit_item(a.category, item, shapes if sep else spec, credits, how))
    elif not a.sheet:
        only = {int(v) for v in a.only.split(",")} if a.only else None
        redo = a.force or a.ai
        todo = [n for n in range(1, len(entries) + 1)
                if (only is None or n in only) and (redo or not existing(a.category, n))]
        lock = threading.Lock()

        def handle(n):
            item_id = f"{a.category}-{n}"
            try:
                b, url, cr = find_picture(entries[n - 1], cfg, a)
                kind = cfg.get("kind", "photo")
                if cfg.get("hideName"):
                    rev = reveal_path(a.category, item_id)
                    os.makedirs(os.path.dirname(rev), exist_ok=True)
                    open(rev, "wb").write(finalize(b, kind)[0])
                    hidden, how = hide_name(b, url)
                    if hidden is None:  # keep the picture with its name; blur it with --boxes
                        save(a.category, n, open(rev, "rb").read())
                        with lock:
                            credits[item_id] = {**cr, "needbox": True}
                        return f"NEEDBOX {item_id} {existing(a.category, n)} ({how[:120]})"
                    b, cr = hidden, {**cr, "hidden": how}
                data, (w, h) = finalize(b, kind)
                save(a.category, n, data)
                with lock:
                    credits[item_id] = cr
                return f"{'AI' if cr.get('review') else 'OK'} {item_id} {w}x{h} {cr['via']}{' (review)' if cr.get('review') else ''}"
            except Exception as e:
                return f"FAIL {item_id} {entries[n - 1]}: {str(e)[:160]}"

        with cf.ThreadPoolExecutor(2) as ex:  # Wikimedia rate-limits faster clients
            for line in ex.map(handle, todo):
                print(line, flush=True)
        if not todo:
            print("Nothing to do – every item already has a picture (use --only N --force to redo).")
    if not a.sheet or edits:
        ordered = dict(sorted(credits.items(), key=lambda kv: (kv[0].rsplit("-", 1)[0], int(kv[0].rsplit("-", 1)[1]))))
        with open(CREDITS, "w", encoding="utf-8") as f:
            f.write(json.dumps(ordered, indent=1, ensure_ascii=False) + "\n")
        for line in run_node("write-image-credits.js") + run_node("build-item-images.js"):
            print(line)
        have = sum(1 for n in range(1, len(entries) + 1) if existing(a.category, n))
        print(f"{a.category}: {have}/{len(entries)} pictures")
    print("SHEET " + contact_sheet(a.category, entries, credits))


if __name__ == "__main__":
    main()
