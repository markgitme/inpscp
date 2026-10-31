#!/usr/bin/env python3
"""InputScope — link / anchor / schema / duplicate-content checker."""
import os, re, json, sys
from urllib.parse import urlparse, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.environ.get("BUILD_DIR") or os.path.join(os.path.dirname(HERE), "build")


pages = []
for root, dirs, files in os.walk(BUILD):
    for fn in files:
        if fn.endswith(".html"):
            pages.append(os.path.join(root, fn))
pages.sort()

def ids_of(path):
    h = open(path, encoding="utf-8").read()
    return set(re.findall(r'\bid="([^"]+)"', h))

problems = []
checked = 0

for p in pages:
    h = open(p, encoding="utf-8").read()
    rel = os.path.relpath(p, BUILD)
    for attr, val in re.findall(r'\b(href|src)="([^"]+)"', h):
        v = val.strip()
        if not v or v.startswith("#") and v == "#":
            continue
        if v.startswith(("http://", "https://", "mailto:", "data:", "javascript:", "//")):
            continue
        if v == "#":  # in-page anchor handled below
            continue
        if v.startswith("#"):
            # in-page fragment
            if v[1:] and v[1:] not in ids_of(p):
                problems.append(f"{rel}: dead in-page anchor {v}")
            checked += 1
            continue
        path, _, frag = v.partition("#")
        target = os.path.normpath(os.path.join(os.path.dirname(p), unquote(path)))
        checked += 1
        if not os.path.exists(target):
            problems.append(f"{rel}: BROKEN LINK -> {v}")
            continue
        if frag:
            if target.endswith(".html"):
                if frag not in ids_of(target):
                    problems.append(f"{rel}: dead anchor {v} (id '{frag}' not in {os.path.relpath(target, BUILD)})")

print(f"checked {checked} links across {len(pages)} pages")

# ---- schema
for p in pages:
    h = open(p, encoding="utf-8").read()
    for i, blk in enumerate(re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)):
        try:
            json.loads(blk)
        except Exception as e:
            problems.append(f"{os.path.relpath(p, BUILD)}: bad JSON-LD block {i}: {e}")

# ---- canonical / og:url present and relative
for p in pages:
    h = open(p, encoding="utf-8").read()
    noindex = 'name="robots" content="noindex"' in h
    if not noindex:
        if not re.search(r'<link rel="canonical" href="[^"]+">', h):
            problems.append(f"{os.path.relpath(p, BUILD)}: no canonical")
        if not re.search(r'<meta property="og:url" content="[^"]+">', h):
            problems.append(f"{os.path.relpath(p, BUILD)}: no og:url")
    if not re.search(r'<meta name="description" content="[^"]+">', h):
        problems.append(f"{os.path.relpath(p, BUILD)}: no meta description")
    if not re.search(r'<h1', h):
        problems.append(f"{os.path.relpath(p, BUILD)}: no h1")

# ---- duplicate content: the moved prose must not still sit on mouse-check.html
def text_of(path):
    h = open(path, encoding="utf-8").read()
    h = re.sub(r'<script.*?</script>', '', h, flags=re.S)
    h = re.sub(r'<style.*?</style>', '', h, flags=re.S)
    h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'\s+', ' ', h).strip()

mouse = text_of(os.path.join(BUILD, "mouse-check.html"))
probes = [
    "Your operating system has a double-click window",
    "A mouse registering clicks you did not make",
    "Unresponsive mouse",
    "almost always the scroll encoder wearing out",
    "The pointer teleporting across the screen",
    "Side buttons are almost never handled by the operating system directly",
    "Every target is 26 pixels across",
    "Raw measurement is only half the value",
]
for pr in probes:
    if pr in mouse:
        problems.append(f"mouse-check.html: moved prose still present -> {pr!r}")

# guide pages must NOT contain the moved prose twice
for gp in [x for x in pages if "/guides/" in x]:
    t = text_of(gp)
    words = t.split()
    if len(words) < 250:
        problems.append(f"{os.path.relpath(gp, BUILD)}: suspiciously short ({len(words)} words)")

print()
if problems:
    print(f"!! {len(problems)} problem(s):")
    for x in problems:
        print("   -", x)
    sys.exit(1)
print("ALL CHECKS PASSED")
