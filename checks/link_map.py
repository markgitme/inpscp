#!/usr/bin/env python3
"""Internal link map: anchor text -> target, grouped by target.

The point is to read the map and see whether each link says where it goes.
A link labelled "mouse troubleshooting" that lands on keyboard.html is a
defect no link checker reports, because the href is valid.
"""
import io, os, re, sys
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("REPO_DIR") or os.path.dirname(HERE)

PAGES = []
for base, _dirs, names in os.walk(ROOT):
    if "/.git" in base or "/build" in base:
        continue
    for n in sorted(names):
        if n.endswith(".html"):
            PAGES.append(os.path.join(base, n))

ENT = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
       "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
       "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”"}


def clean(s):
    for k, v in ENT.items():
        s = s.replace(k, v)
    return re.sub(r"\s+", " ", s).strip()


rows = []
for p in PAGES:
    src = io.open(p, encoding="utf-8").read()
    rel = os.path.relpath(p, ROOT)
    for m in re.finditer(r'<a\b([^>]*)>(.*?)</a>', src, re.S | re.I):
        attrs, inner = m.group(1), m.group(2)
        hm = re.search(r'href\s*=\s*["\']([^"\']+)["\']', attrs, re.I)
        if not hm:
            continue
        href = hm.group(1)
        text = clean(re.sub(r"<[^>]*>", " ", inner))
        line = src[:m.start()].count("\n") + 1
        rows.append((rel, line, href, text))

by_target = defaultdict(list)
for rel, line, href, text in rows:
    if href.startswith(("http://", "https://", "mailto:", "//")):
        continue
    by_target[href].append((rel, line, text))

print("=== INTERNAL LINKS GROUPED BY TARGET (%d internal links) ===" % sum(len(v) for v in by_target.values()))
for href in sorted(by_target.items(), key=lambda kv: -len(kv[1])) if False else sorted(by_target, key=lambda h: (-len(by_target[h]), h)):
    entries = by_target[href]
    print("\n-> %s   (%d link%s)" % (href, len(entries), "" if len(entries) == 1 else "s"))
    texts = {}
    for rel, line, text in entries:
        texts.setdefault(text, []).append("%s:%d" % (rel, line))
    for t, locs in sorted(texts.items()):
        print("     %-62s  %s" % (repr(t)[:62], ", ".join(locs)))

print("\n=== EXTERNAL LINKS (unique URLs) ===")
ext = defaultdict(list)
for rel, line, href, text in rows:
    if href.startswith(("http://", "https://")):
        ext[href].append((rel, line, text))
for href in sorted(ext):
    locs = ext[href]
    print("\n%s" % href)
    for rel, line, text in locs:
        print("     %-40s line %-5d %s" % (rel, line, repr(text)[:70]))

print("\n=== MAILTO / OTHER ===")
for rel, line, href, text in rows:
    if href.startswith(("mailto:", "#", "tel:")):
        print("  %-28s line %-5d %-40s %s" % (rel, line, href, repr(text)[:50]))
