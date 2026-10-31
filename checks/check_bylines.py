#!/usr/bin/env python3
"""Check the byline against the schema dates.

The defect this guards against: the keyboard guide said "Updated 28 October
2026" while its schema said dateModified 2026-10-31. Two dates, one page,
no link between them, so they drifted.

Policy:
  - datePublished is the launch date. It never moves.
  - dateModified is the day the page's content last changed in a way a
    reader would notice. It does not move for a rewording, a heading level
    or a schema edit.
  - The visible byline shows the published date, and shows the updated date
    only when the two differ. If the updated date is shown it must equal
    dateModified; if it is not shown, dateModified must equal datePublished.

Usage: python3 check_bylines.py <repo>
"""
import re
import sys
import os
import json

REPO = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("REPO_DIR") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MONTHS = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"])}


def visible_date(s):
    """'27 October 2026' -> '2026-10-27'"""
    m = re.search(r"(\d{1,2}) ([A-Z][a-z]+) (\d{4})", s)
    if not m:
        return None
    day, month, year = int(m.group(1)), MONTHS.get(m.group(2)), int(m.group(3))
    if not month:
        return None
    return "%04d-%02d-%02d" % (year, month, day)


def schema_dates(html):
    """Every datePublished / dateModified in the page's JSON-LD."""
    out = []
    for m in re.finditer(r'(?s)<script type="application/ld\+json">(.*?)</script>', html):
        try:
            data = json.loads(m.group(1))
        except ValueError as e:
            out.append(("PARSE-ERROR", str(e)))
            continue
        for node in walk(data):
            for field in ("datePublished", "dateModified"):
                if field in node:
                    out.append((field, node[field]))
    return out


def walk(node):
    if isinstance(node, list):
        for n in node:
            for x in walk(n):
                yield x
    elif isinstance(node, dict):
        yield node
        for v in node.values():
            for x in walk(v):
                yield x


def main():
    fails = []
    notes = []
    checks = 0
    pages = []
    for root, _dirs, files in os.walk(REPO):
        if ".git" in root or "/build" in root:
            continue
        for f in files:
            if f.endswith(".html"):
                pages.append(os.path.relpath(os.path.join(root, f), REPO))
    pages.sort()

    for page in pages:
        html = open(os.path.join(REPO, page), encoding="utf-8").read()
        m = re.search(r'(?s)<p class="byline">(.*?)</p>', html)
        dates = schema_dates(html)
        pub = [d for f, d in dates if f == "datePublished"]
        mod = [f for f, d in dates if f == "dateModified"]
        mods = [d for f, d in dates if f == "dateModified"]
        for f, d in dates:
            if f == "PARSE-ERROR":
                fails.append("%s: JSON-LD does not parse (%s)" % (page, d))

        if not m:
            if pub or mods:
                notes.append("%s: schema has dates but no visible byline" % page)
            continue

        checks += 1
        line = re.sub(r"<[^>]+>", "", m.group(1))
        line = line.replace("&middot;", "·").replace("&mdash;", "—").strip()

        vm = re.search(r"Published (.+?)(?: · Updated (.+))?$", line)
        if not vm:
            fails.append("%s: byline does not say Published: %r" % (page, line))
            continue
        vpub = visible_date(vm.group(1))
        vmod = visible_date(vm.group(2)) if vm.group(2) else None

        if not pub:
            fails.append("%s: visible byline but no datePublished in the schema" % page)
            continue
        if len(set(pub)) != 1:
            fails.append("%s: datePublished differs between schema blocks: %s" % (page, pub))
        if vpub != pub[0]:
            fails.append("%s: visible Published date %s but schema datePublished %s"
                         % (page, vpub, pub[0]))

        if len(set(mods)) > 1:
            fails.append("%s: dateModified differs between schema blocks: %s" % (page, mods))
        if mods:
            if vmod is None:
                if mods[0] != pub[0]:
                    fails.append("%s: schema dateModified is %s but the byline shows no "
                                 "updated date" % (page, mods[0]))
            elif vmod != mods[0]:
                fails.append("%s: visible Updated date %s but schema dateModified %s"
                             % (page, vmod, mods[0]))

    for n in notes:
        print("note " + n)
    for f in fails:
        print("FAIL " + f)
    print("%d byline checks, %d failures" % (checks, len(fails)))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
