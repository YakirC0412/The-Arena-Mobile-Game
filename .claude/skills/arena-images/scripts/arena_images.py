#!/usr/bin/env python3
"""Fill a whole Arena category with pictures, item by item.

Reads mobile/scripts/image-sources.json (falls back to wiki-sources.json), finds a
picture for every item (Wikipedia lead image -> photo search -> AI), resizes it,
saves it as mobile/assets/items/<category>/<category>-<n>.jpg, records credits,
connects the pictures to the game and writes a contact sheet for review.

Usage:
  arena_images.py <category>                      items that have no picture yet
  arena_images.py <category> --only 3,7 --force   redo these items
  arena_images.py <category> --only 9 --ai --desc "red liver bird crest"   AI, own description
  arena_images.py <category> --only 4 --boxes "0.3,0.4,0.4,0.15"   blur areas (hideName categories)
  arena_images.py <category> --sheet              only rebuild the contact sheet

Needs Python 3 + Pillow. Keys (all optional): env vars or <skill>/keys.env –
PEXELS_API_KEY, PIXABAY_API_KEY, POLLINATIONS_TOKEN, OPENAI_API_KEY.
"""
import argparse, base64, concurrent.futures as cf, io, json, os, random, re, shutil, subprocess, sys, threading, time
import urllib.error, urllib.parse, urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
MOBILE = os.path.join(REPO, "mobile")
ITEMS_DIR = os.path.join(MOBILE, "assets", "items")
CREDITS = os.path.join(ITEMS_DIR, "credits.json")
SOURCES = os.path.join(MOBILE, "scripts", "image-sources.json")
WIKI_SOURCES = os.path.join(MOBILE, "scripts", "wiki-sources.json")
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


def hide_name(b, url, boxes):
    if boxes:
        return blur_boxes(b, [tuple(float(v) for v in box.split(",")) for box in boxes.split(";") if box.strip()]), "blur-boxes"
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


def blur_boxes(b, boxes):
    im = Image.open(io.BytesIO(b)).convert("RGB")
    W, H = im.size
    for x, y, w, h in boxes:
        if max(x, y, w, h) <= 1:
            x, y, w, h = x * W, y * H, w * W, h * H
        p = int(max(w, h) * 0.25) + 4
        box = (max(0, int(x - p)), max(0, int(y - p)), min(W, int(x + w + p)), min(H, int(y + h + p)))
        reg = im.crop(box)
        reg = reg.resize((max(1, reg.width // 16), max(1, reg.height // 16))).resize(reg.size)
        im.paste(reg.filter(ImageFilter.GaussianBlur(max(6, reg.width // 20))), box)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=92)
    return buf.getvalue()


# ---------- finding one item's picture ----------
def find_picture(entry, cfg, a):
    """Returns (bytes, url, credit dict). Order: pinned File: -> Wikipedia lead image -> search -> AI."""
    kind = cfg.get("kind", "photo")
    name, _, desc = entry.partition("::")
    name, desc = name.strip(), (a.desc or desc.strip())
    if not a.ai:
        lead = name[5:] if name.startswith("File:") else None
        if not lead and cfg.get("wikipedia", True):
            lead = wiki_lead(name, any_license=kind == "logo")  # errors fail the item: better a rerun than an AI guess
        if lead and not (kind != "logo" and lead.lower().endswith(".svg")):
            info = wiki_file(lead)
            if info and (kind == "logo" or min(info["w"], info["h"]) >= 300):
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
    """Flatten transparency on white, square-pad logos, fit in MAX_SIDE, return JPEG bytes."""
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
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85, optimize=True)
    return buf.getvalue(), im.size


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
    path = os.path.join(ITEMS_DIR, category, f"{category}-{n}.jpg")
    with open(path, "wb") as f:
        f.write(data)
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
        draw.text((x + 6, y + cell + 17), "AI - review" if cr.get("review") else (cr.get("via") or ("MISSING" if not path else "")), fill=color, font=font)
    out = os.path.join(ARCHIVE, "image-review", f"{category}.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out, "JPEG", quality=85)
    return out


def run_node(script):
    node = shutil.which("node") or r"C:\Program Files\nodejs\node.exe"
    r = subprocess.run([node, os.path.join(MOBILE, "scripts", script)], cwd=MOBILE, capture_output=True, text=True)
    return (r.stdout + r.stderr).strip().splitlines()[-1:] if r.returncode == 0 else [f"! {script} failed: {r.stderr.strip()[-300:]}"]


def load_config(category):
    for path in (SOURCES, WIKI_SOURCES):
        try:
            cfg = json.load(open(path, encoding="utf-8")).get(category)
        except OSError:
            continue
        if cfg:
            return cfg if isinstance(cfg, dict) else {"kind": "photo", "items": cfg}
    sys.exit(f"No entry for '{category}' in mobile/scripts/image-sources.json – add it first (see SKILL.md).")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="Fill an Arena category with pictures.")
    p.add_argument("category")
    p.add_argument("--only", help="item numbers, e.g. 3,7,12")
    p.add_argument("--force", action="store_true", help="redo items that already have a picture")
    p.add_argument("--ai", action="store_true", help="skip the search, generate with AI")
    p.add_argument("--desc", help="AI description (use with --only for one item)")
    p.add_argument("--boxes", help='hideName categories: blur "x,y,w,h;..." (fractions) instead of AI removal')
    p.add_argument("--min", type=int, default=400, help="min short side of searched photos (default 400)")
    p.add_argument("--sheet", action="store_true", help="only rebuild the contact sheet")
    a = p.parse_args()

    cfg = load_config(a.category)
    entries = cfg["items"]
    credits = json.load(open(CREDITS, encoding="utf-8")) if os.path.exists(CREDITS) else {}
    if not a.sheet:
        only = {int(v) for v in a.only.split(",")} if a.only else None
        redo = a.force or a.ai or a.boxes
        todo = [n for n in range(1, len(entries) + 1)
                if (only is None or n in only) and (redo or not existing(a.category, n))]
        lock = threading.Lock()

        def handle(n):
            item_id = f"{a.category}-{n}"
            try:
                b, url, cr = find_picture(entries[n - 1], cfg, a)
                if cfg.get("hideName"):
                    reveal = os.path.join(ARCHIVE, "reveal", a.category, f"{item_id}.jpg")
                    os.makedirs(os.path.dirname(reveal), exist_ok=True)
                    open(reveal, "wb").write(finalize(b, "photo")[0])
                    hidden, how = hide_name(b, url, a.boxes)
                    if hidden is None:
                        return f"NEEDBOX {item_id} {reveal} ({how})"
                    b, cr = hidden, {**cr, "hidden": how}
                data, (w, h) = finalize(b, cfg.get("kind", "photo"))
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
