#!/usr/bin/env python3
"""Check that every reading has somewhere to write its unit line.

The defect this guards against: `setOut(key, value, note, tone)` looks up
`[data-note="key"]`. If the page has no such element the note is silently
discarded, so the reading loses its unit and the panel cannot explain
itself. That is exactly what was wrong on all three tool pages.

Rules checked:
  1. Every setOut call that passes a note has a matching data-note element
     on the page that loads the script.
  2. Every data-note element on a tool page is written by something
     (a setOut call in any script that page loads, or the modifier-lock
     renderer).
  3. No note string is empty.

Usage: python3 check_notes.py <repo>
"""
import re
import sys
import os
from collections import defaultdict

REPO = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("REPO_DIR") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# which page loads which script
JS_TO_PAGE = {
    "assets/js/mouse.js": "mouse-check.html",
    "assets/js/keyboard.js": "keyboard-check.html",
    "assets/js/trackpad.js": "keyboard-check.html",
}


def split_args(s):
    """Split a call's argument list on top-level commas."""
    out, depth, cur, quote = [], 0, "", None
    for ch in s:
        if quote:
            cur += ch
            if ch == quote and not cur.endswith("\\"):
                quote = None
            continue
        if ch in "'\"":
            quote = ch
            cur += ch
            continue
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def setout_calls(js):
    """Yield (key, note_arg) for every setOut(...) call."""
    for m in re.finditer(r"\bsetOut\(", js):
        i = m.end()
        depth, quote = 1, None
        while i < len(js) and depth:
            ch = js[i]
            if quote:
                if ch == quote and js[i - 1] != "\\":
                    quote = None
            elif ch in "'\"":
                quote = ch
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            i += 1
        args = split_args(js[m.end():i - 1])
        if len(args) < 3:
            continue
        key = args[0].strip("'\"")
        if key == "key":
            continue          # the function definition, not a call
        yield key, args[2]


def note_elements(html):
    """{key: declared starting line} from the markup, ignoring inline scripts."""
    markup = re.sub(r"(?s)<script.*?</script>", "", html)
    out = {}
    for m in re.finditer(r'data-note="([^"]+)"[^>]*>([^<]*)<', markup):
        out.setdefault(m.group(1), m.group(2).strip())
    return out


def main():
    fails = []
    checks = 0

    scripts = {p: open(os.path.join(REPO, p), encoding="utf-8").read()
               for p in JS_TO_PAGE}

    # every line a page can show, from every script it loads
    page_lines = defaultdict(set)
    page_notes = defaultdict(set)
    for js_path, page in JS_TO_PAGE.items():
        for key, note_arg in setout_calls(scripts[js_path]):
            page_notes[page].add(key)
            for line in re.findall(r"'([^']*)'", note_arg):
                page_lines[page].add((key, line))
    # the modifier lamps carry their line in the LOCKS table
    for m in re.finditer(r"\{ out: '(mod-[a-z]+)'[^}]*note: '([^']*)'[^}]*\}", scripts["assets/js/keyboard.js"]):
        page_lines["keyboard-check.html"].add((m.group(1), m.group(2)))

    for js_path, page in JS_TO_PAGE.items():
        js = scripts[js_path]
        elements = note_elements(open(os.path.join(REPO, page), encoding="utf-8").read())

        # 1. a note passed to setOut needs an element to land in
        for key, note_arg in setout_calls(js):
            has_note = bool(re.findall(r"'[^']+'", note_arg)) and note_arg.strip() != "null"
            if not has_note:
                continue
            checks += 1
            if key not in elements:
                fails.append("%s: setOut('%s') passes a note but %s has no "
                             'data-note="%s" element' % (js_path, key, page, key))

        # 2. every element must be written by something, and must declare a
        #    starting line so the reading is never a silent dash
        for key, declared in sorted(elements.items()):
            checks += 1
            if key not in page_notes[page] and not key.startswith("mod-"):
                fails.append('%s: data-note="%s" has nothing writing it' % (page, key))
            if not declared:
                fails.append('%s: data-note="%s" declares no starting line' % (page, key))
                continue
            if (key, declared) not in page_lines[page]:
                fails.append('%s: data-note="%s" starts with %r, which the script '
                             'never writes for that reading'
                             % (page, key, declared))

        # 3. a note literal must not be blank
        for key, note_arg in setout_calls(js):
            if note_arg.strip() in ("''", '\"\"', "null"):
                checks += 1
                fails.append("%s: setOut('%s') passes an empty note" % (js_path, key))

    # the modifier lamps carry their note in the LOCKS table
    kb = scripts["assets/js/keyboard.js"]
    for m in re.finditer(r"\{ out: '(mod-[a-z]+)'[^}]*\}", kb):
        checks += 1
        if "note:" not in m.group(0):
            fails.append("keyboard.js: %s has no note" % m.group(1))

    for f in fails:
        print("FAIL " + f)
    print("%d checks, %d failures" % (checks, len(fails)))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
