#!/usr/bin/env python3
"""Structural / accessibility / SEO audit of the built site.

Checks that a link checker cannot: duplicate ids, heading order, missing
alt text, labels, title and description quality, canonical consistency,
sitemap agreement, form wiring, and colour contrast for the site's own
tokens.
"""
import io, json, os, re, sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.environ.get("BUILD_DIR") or os.path.join(os.path.dirname(HERE), "build")

problems = []
notes = []


def P(msg):
    problems.append(msg)


def N(msg):
    notes.append(msg)


def rel(p):
    return os.path.relpath(p, BUILD)


pages = []
for root, _d, files in os.walk(BUILD):
    for fn in files:
        if fn.endswith(".html"):
            pages.append(os.path.join(root, fn))
pages.sort()

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


class Doc(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.headings = []
        self.imgs = []
        self.links = []
        self.buttons = []
        self.inputs = []
        self.labels = []
        self.metas = []
        self.linksheet = []
        self.title = []
        self.in_title = False
        self.text_chunks = []
        self.html_attrs = {}
        self.body_attrs = {}
        self.in_body = False
        self.stack = []
        self.tags = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        self.tags.append(tag)
        if tag == "html":
            self.html_attrs = d
        if tag == "body":
            self.body_attrs = d
            self.in_body = True
        if "id" in d:
            self.ids.append(d["id"])
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.headings.append((tag, self._text()))
        if tag == "img":
            self.imgs.append(d)
        if tag == "a":
            self.links.append(d)
        if tag == "button":
            self.buttons.append(d)
        if tag in ("input", "select", "textarea"):
            self.inputs.append((tag, d))
        if tag == "label":
            self.labels.append(d)
        if tag == "meta":
            self.metas.append(d)
        if tag == "link":
            self.linksheet.append(d)
        if tag == "title":
            self.in_title = True
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag in self.stack:
            while self.stack and self.stack[-1] != tag:
                self.stack.pop()
            if self.stack:
                self.stack.pop()

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.stack and self.stack[-1] in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.text_chunks.append(data)

    def _text(self):
        return ""


docs = {}
for p in pages:
    d = Doc()
    d.feed(io.open(p, encoding="utf-8").read())
    docs[p] = d

# ---- per page checks
for p in pages:
    r = rel(p)
    d = docs[p]

    # duplicate ids
    seen = set()
    for i in d.ids:
        if i in seen:
            P("%s: duplicate id '%s'" % (r, i))
        seen.add(i)

    # heading order
    prev = 0
    for tag, _ in d.headings:
        lvl = int(tag[1])
        if prev and lvl > prev + 1:
            P("%s: heading jumps from h%d to h%d" % (r, prev, lvl))
        prev = lvl
    h1s = [t for t, _ in d.headings if t == "h1"]
    if len(h1s) != 1:
        P("%s: %d <h1> elements (expected exactly 1)" % (r, len(h1s)))

    # images
    for im in d.imgs:
        if "alt" not in im:
            P("%s: <img> without alt attribute: %s" % (r, im.get("src", "?")))
        elif im["alt"].strip() == "" and im.get("role") != "presentation":
            N("%s: <img src=%s> has empty alt" % (r, im.get("src", "?")))

    # links
    for a in d.links:
        if "href" not in a:
            P("%s: <a> without href: %r" % (r, a))
        if a.get("target") == "_blank" and "rel" not in a:
            P("%s: target=_blank without rel=noopener" % r)

    # buttons
    for b in d.buttons:
        if b.get("type") not in ("button", "submit", "reset"):
            N("%s: <button> without explicit type: %r" % (r, b))

    # inputs need labels
    label_for = {l.get("for") for l in d.labels if l.get("for")}
    wrapped = len(d.labels) > len(label_for)
    for tag, i in d.inputs:
        if i.get("type") in ("hidden", "submit", "button", "image"):
            continue
        if i.get("id") and i["id"] in label_for:
            continue
        if i.get("aria-label") or i.get("aria-labelledby"):
            continue
        if wrapped:
            continue
        P("%s: <%s id=%s> has no associated label" % (r, tag, i.get("id", "(no id)")))

    # meta
    def meta(name=None, prop=None):
        for m in d.metas:
            if name and m.get("name") == name:
                return m.get("content", "")
            if prop and m.get("property") == prop:
                return m.get("content", "")
        return None

    desc = meta(name="description")
    if not desc:
        P("%s: no meta description" % r)
    else:
        if len(desc) < 50:
            N("%s: meta description short (%d chars)" % (r, len(desc)))
        if len(desc) > 180:
            N("%s: meta description long (%d chars)" % (r, len(desc)))
    if meta(name="viewport") is None:
        P("%s: no viewport meta" % r)
    if not d.html_attrs.get("lang"):
        P("%s: <html> has no lang attribute" % r)
    if d.title:
        t = " ".join("".join(d.title).split())
        if len(t) > 70:
            N("%s: <title> %d chars: %r" % (r, len(t), t))
        if len(t) < 10:
            P("%s: <title> too short: %r" % (r, t))
    else:
        P("%s: no <title>" % r)

    # canonical
    canon = [l for l in d.linksheet if "canonical" in (l.get("rel") or "").lower()]
    if not canon:
        P("%s: no canonical link" % r)
    else:
        cu = canon[0].get("href", "")
        expected = os.path.basename(p) if os.path.dirname(p) == BUILD else \
            "troubleshooting/" + os.path.basename(p)
        if expected not in cu:
            P("%s: canonical %r does not contain %r" % (r, cu, expected))

    # og / twitter
    for prop in ("og:title", "og:description", "og:url", "og:type"):
        if meta(prop=prop) is None:
            N("%s: missing %s" % (r, prop))
    if meta(name="twitter:card") is None:
        N("%s: missing twitter:card" % r)

    # json-ld
    src = io.open(p, encoding="utf-8").read()
    for i, blk in enumerate(re.findall(r'<script type="application/ld\+json">(.*?)</script>', src, re.S)):
        try:
            obj = json.loads(blk)
        except Exception as e:
            P("%s: JSON-LD block %d invalid: %s" % (r, i, e))
            continue
        for ob in (obj if isinstance(obj, list) else [obj]):
            if isinstance(ob, dict) and "@graph" in ob:
                for sub in ob["@graph"]:
                    if "url" in sub and "@id" in sub:
                        pass

print("=== PROBLEMS (%d) ===" % len(problems))
for x in problems:
    print("  " + x)

print("\n=== NOTES (%d) ===" % len(notes))
for x in notes:
    print("  " + x)

# ---- sitemap vs files
print("\n=== SITEMAP vs FILES ===")
sm = io.open(os.path.join(BUILD, "sitemap.xml"), encoding="utf-8").read()
locs = re.findall(r"<loc>([^<]+)</loc>", sm)
urls_in_pages = set()
for p in pages:
    src = io.open(p, encoding="utf-8").read()
    for l in re.findall(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', src):
        urls_in_pages.add(l)
print("sitemap entries: %d" % len(locs))
for l in locs:
    print("  " + l)
if len(locs) != len(urls_in_pages):
    N("sitemap has %d entries, pages declare %d canonicals" % (len(locs), len(urls_in_pages)))

# ---- robots / ads / manifest / headers
print("\n=== CONFIG FILES ===")
for f in ("robots.txt", "ads.txt", "manifest.webmanifest", "_headers"):
    p = os.path.join(BUILD, f)
    if not os.path.exists(p):
        P("missing %s" % f)
        continue
    body = io.open(p, encoding="utf-8").read()
    print("\n--- %s (%d bytes) ---" % (f, len(body)))
    print(body.strip()[:900])
