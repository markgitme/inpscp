#!/usr/bin/env python3
"""Assert that the site is themeable, and that every page carries the picker.

Two rules, both structural rather than visual:

1. NO COLOUR LITERAL OUTSIDE A :root BLOCK. Every colour in every stylesheet
   lives inside :root or html[data-theme="…"]. That is what makes a theme a
   set of variable values rather than a pile of overrides, and it is the rule
   that stops the old "63 hardcoded colours" problem coming back.

2. EVERY PAGE CARRIES THE PICKER. The inline head script (which sets the
   theme before the stylesheets arrive), the picker with its label, theme.js,
   and the theme-color meta.

Run:  python3 checks/check_themeable.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_DIR = os.path.join(ROOT, 'assets', 'css')

fails = []
checks = 0


def check(cond, label, detail=''):
    global checks
    checks += 1
    if cond:
        print(f"PASS  {label}")
    else:
        print(f"FAIL  {label}" + (f"  — {detail}" if detail else ''))
        fails.append(label)


# ---------------------------------------------------------------------------
# 1. no colour literal outside a :root block
# ---------------------------------------------------------------------------
# a colour literal: #hex, rgb(), rgba(), hsl(), oklch()
COLOUR = re.compile(
    r'#[0-9a-fA-F]{3,8}\b'
    r'|\brgba?\([^)]*\)'
    r'|\bhsla?\([^)]*\)'
    r'|\boklch\([^)]*\)',
    re.I)

# a block whose contents are allowed to hold colours
BLOCK_START = re.compile(r'^\s*(:root|html\[data-theme[^\]]*\])\s*\{', re.M)


def blocks_and_body(css):
    """Return (list of block bodies, the rest of the file)."""
    blocks, rest = [], []
    i = 0
    while True:
        m = BLOCK_START.search(css, i)
        if not m:
            rest.append(css[i:])
            break
        rest.append(css[i:m.start()])
        j = css.index('{', m.start())
        depth = 0
        for k in range(j, len(css)):
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
                if depth == 0:
                    blocks.append(css[j + 1:k])
                    i = k + 1
                    break
        else:
            rest.append(css[j:])
            break
    return blocks, ''.join(rest)


def strip_var_refs(s):
    """Remove var(--x) references so rgba(var(--accent-rgb), .1) is not a hit."""
    s = re.sub(r'rgba?\(\s*var\([^)]*\)[^)]*\)', '', s)
    s = re.sub(r'rgb\(\s*var\([^)]*\)\s*\)', '', s)
    return s


css_files = sorted(f for f in os.listdir(CSS_DIR) if f.endswith('.css'))
print(f"--- themeability: {len(css_files)} stylesheet(s) ---")
for name in css_files:
    path = os.path.join(CSS_DIR, name)
    css = open(path, encoding='utf-8').read()
    blocks, body = blocks_and_body(css)
    body = strip_var_refs(body)
    hits = [m.group(0) for m in COLOUR.finditer(body)]
    check(not hits,
          f"{name}: no colour literal outside a :root block",
          f"{len(hits)} found, e.g. {hits[:3]}")

# the three themes must exist. Monochrome is the DEFAULT, so it is the :root
# block; the other two are attribute blocks. These are the internal names —
# the picker shows the reader "Dark", "Ember" and "Light".
style = open(os.path.join(CSS_DIR, 'style.css'), encoding='utf-8').read()
check(re.search(r'^:root \s*\{', style, re.M) is not None,
      "style.css defines the default theme (Monochrome, shown as Dark) as :root")
for theme in ('ember', 'daylight'):
    check(f'html[data-theme="{theme}"]' in style,
          f"style.css defines the {theme} theme")

# ---------------------------------------------------------------------------
# 1b. a transparent text colour must be clipped to its text
# ---------------------------------------------------------------------------
# The highlighted word on the home page is painted with a transparent colour
# and a background clipped to the text. A theme that set the background with
# the `background` shorthand resets `background-clip` to `border-box`, and the
# word then vanishes into a grey block. That really happened, so it is a rule
# now: any rule that makes the text transparent must clip the background to
# the text, in the same rule.
TRANSPARENT_TEXT = re.compile(r'(?<![\w-])color\s*:\s*transparent\b', re.I)
CLIPPED_TO_TEXT = re.compile(r'(?<![\w-])background-clip\s*:\s*text\b', re.I)


def rule_bodies(css):
    """Return the declarations of every rule, at any nesting depth.

    A rule's own declarations only: any nested rule is stripped out, so a
    block is never judged on the declarations of a rule inside it. Every rule
    is collected at every depth, because the rule this guards against is a
    theme override nested inside html[data-theme="…"].
    """
    bodies, stack = [], []
    for i, ch in enumerate(css):
        if ch == '{':
            stack.append(i)
        elif ch == '}' and stack:
            open_at = stack.pop()
            body = css[open_at + 1:i]
            while '{' in body:
                body = re.sub(r'\{[^{}]*\}', ' ', body)
            bodies.append(body)
    return bodies


transparent_rules = 0
for name in sorted(os.listdir(CSS_DIR)):
    if not name.endswith('.css'):
        continue
    css = open(os.path.join(CSS_DIR, name), encoding='utf-8').read()
    for body in rule_bodies(css):
        if not TRANSPARENT_TEXT.search(body):
            continue
        transparent_rules += 1
        check(CLIPPED_TO_TEXT.search(body) is not None,
              f"{name}: a transparent text colour is clipped to its text",
              body.strip()[:70])

# the rule above must not go vacuous: if nothing uses a transparent text
# colour, the guard would sit there green while proving nothing
check(transparent_rules > 0,
      "the transparent-text rule is not vacuous",
      f"{transparent_rules} rule(s) use a transparent text colour")

# ---------------------------------------------------------------------------
# 2. every page carries the picker
# ---------------------------------------------------------------------------
pages = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ('.git', 'build', 'node_modules', 'docs', 'checks')]
    for fn in filenames:
        if fn.endswith('.html'):
            pages.append(os.path.join(dirpath, fn))

# The picker lives on the home page only. Every other page still honours the
# choice — it reads the same stored value — but does not offer the control.
HOME = 'index.html'

print(f"\n--- the picker: {len(pages)} page(s) ---")
for path in sorted(pages):
    rel = os.path.relpath(path, ROOT)
    html = open(path, encoding='utf-8').read()
    where = rel.replace(os.sep, '/')
    is_home = where == HOME

    # every page honours the choice
    check('assets/js/theme.js' in html, f"{where}: loads theme.js")
    check("setAttribute('data-theme'" in html or "setAttribute(\"data-theme\"" in html,
          f"{where}: sets the theme before the stylesheets arrive")
    check('name="theme-color"' in html, f"{where}: declares the browser chrome colour")

    if not is_home:
        check('data-theme-select' not in html,
              f"{where}: carries no theme picker")
        check('class="theme-picker"' not in html,
              f"{where}: carries no theme picker control")
        continue

    check('data-theme-select' in html, f"{where}: has the theme picker")
    check('<label class="theme-label" for="theme-select">Theme</label>' in html,
          f"{where}: the picker has its visible 'Theme' label")

    # the picker must come after the Contact link and before the nav closes
    nav = re.search(r'<nav class="nav" id="site-nav"[^>]*>(.*?)</nav>', html, re.S)
    check(nav is not None, f"{where}: has a nav")
    if nav:
        body = nav.group(1)
        ci = body.find('>Contact</a>')
        pi = body.find('class="theme-picker"')
        check(ci != -1 and pi != -1 and pi > ci,
              f"{where}: the picker sits after the Contact link")
        check(body.find('class="theme-label"') < body.find('data-theme-select'),
              f"{where}: the 'Theme' label is to the left of the dropdown")

    # the three options, in order
    opts = re.findall(r'<option value="([a-z]+)">', html)
    check(opts == ['monochrome', 'ember', 'daylight'],
          f"{where}: offers exactly the three themes", f"({opts})")

    # the words on screen, in order. The values are the internal names; these
    # labels are what the reader reads, and they are pinned here so that a
    # rename cannot slip through unnoticed.
    labels = re.findall(r'<option value="[a-z]+">([^<]+)</option>', html)
    check(labels == ['Dark', 'Ember', 'Light'],
          f"{where}: shows the themes as Dark, Ember and Light", f"({labels})")

print()
if fails:
    print(f"{len(fails)} of {checks} checks FAILED")
    for f in fails:
        print(f"  - {f}")
    sys.exit(1)
print(f"all {checks} checks passed")
