#!/usr/bin/env python3
"""InputScope — check the published build carries no work in progress.

The rule: a tool that is still in development must not reach the published
site. It has no guide, no FAQ entry, no schema block, no sitemap entry and no
byline, so it cannot be published — and a page that is reachable but not
linked is still live, because GitHub Pages serves the repository root.

This is the check that keeps that true, because "we will remember to take it
out" is not a mechanism:

  1. No file is in both the published list and the work-in-progress list.
  2. Every work-in-progress file really exists in the repository.
  3. Nothing in the published site links to a work-in-progress page.
  4. The sitemap does not list a work-in-progress page.
  5. The published build on disk contains no work-in-progress page.
  6. A device the site asks for is not blocked by our own Permissions-Policy,
     and a device the site never asks for stays blocked.

Usage: python3 check_build.py [published-build-dir]
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD_SH = os.path.join(ROOT, "build.sh")

problems = []
checks = 0


def read_build_arrays():
    """The two file lists out of build.sh."""
    text = open(BUILD_SH, encoding="utf-8").read()
    out = {}
    for name in ("SITE_FILES", "WIP_FILES"):
        m = re.search(name + r"\s*=\s*\((.*?)\)", text, re.S)
        if not m:
            problems.append("build.sh has no %s array" % name)
            out[name] = []
            continue
        out[name] = re.findall(r'"([^"]+)"', m.group(1))
    return out["SITE_FILES"], out["WIP_FILES"]


def html_files(base):
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "build", "checks")]
        for fn in files:
            if fn.endswith(".html"):
                yield os.path.join(root, fn)


def main():
    global checks

    site, wip = read_build_arrays()

    # 1. the two lists must not overlap
    for f in wip:
        checks += 1
        if f in site:
            problems.append("%s is in both the published list and the work-in-progress list" % f)

    # 2. every work-in-progress file must exist
    for f in wip:
        checks += 1
        if not os.path.exists(os.path.join(ROOT, f)):
            problems.append("build.sh lists %s as work in progress, but it does not exist" % f)

    if not wip:
        print("no work in progress is declared in build.sh")

    # 3. nothing published may link to a work-in-progress page
    for path in html_files(ROOT):
        rel = os.path.relpath(path, ROOT)
        if rel in wip:
            continue
        html = open(path, encoding="utf-8").read()
        for f in wip:
            checks += 1
            if f in html:
                problems.append("%s links to the work-in-progress page %s" % (rel, f))

    # 4. the sitemap must not list one
    sitemap = os.path.join(ROOT, "sitemap.xml")
    if os.path.exists(sitemap):
        sm = open(sitemap, encoding="utf-8").read()
        for f in wip:
            checks += 1
            if f in sm:
                problems.append("sitemap.xml lists the work-in-progress page %s" % f)

    # 5. the published build on disk must not contain one
    published = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build")
    if os.path.isdir(published):
        for f in wip:
            checks += 1
            if os.path.exists(os.path.join(published, f)):
                problems.append("the published build contains the work-in-progress page %s" % f)

    # 6. a device the site asks for must not be blocked by our own headers.
    #    The Permissions-Policy in _headers is applied by Cloudflare Pages on
    #    the real site, so `microphone=()` there would block the microphone
    #    tool in production while every local test passed. The permission is
    #    granted now and the tool arrives with it; the rule only fires when
    #    a page actually asks.
    headers = os.path.join(ROOT, "_headers")
    policy = ""
    if os.path.exists(headers):
        for line in open(headers, encoding="utf-8"):
            # the line is indented, so it must be stripped before it is
            # matched — an unmatched policy would make this check vacuous
            if line.strip().lower().startswith("permissions-policy:"):
                policy = line.split(":", 1)[1].strip()
    uses_mic = False
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "build", "checks")]
        for fn in files:
            if fn.endswith((".js", ".html")) and "getUserMedia" in open(os.path.join(root, fn), encoding="utf-8", errors="ignore").read():
                uses_mic = True
    checks += 1
    if uses_mic and "microphone=()" in policy:
        problems.append("the site asks for the microphone, but _headers blocks it with 'microphone=()'")
    checks += 1
    if not uses_mic and "camera=()" not in policy:
        problems.append("nothing on the site uses a camera, so the Permissions-Policy should keep blocking it")

    for p in problems:
        print("PROBLEM: %s" % p)
    print("%d checks, %d problems" % (checks, len(problems)))
    if problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
