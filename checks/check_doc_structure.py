#!/usr/bin/env python3
"""Structural check on the long troubleshooting documents.

A doc-section that escapes its .doc wrapper looks fine in the source and
breaks on the page: the callout, table and steps get ejected to <main> and
the prose loses its width. This asserts the tree, not the eyeball.
"""
import io, os, sys

FAIL = 0


def check(path):
    global FAIL
    s = io.open(path, encoding="utf-8").read()
    name = path.split("/")[-1]
    # Walk the tag tree with a simple stack.
    import re
    stack = []
    problems = []
    for m in re.finditer(r'<(/?)([a-zA-Z][\w-]*)([^>]*?)(/?)>', s):
        closing, tag, attrs, selfclose = m.group(1), m.group(2), m.group(3), m.group(4)
        if tag in ('br', 'img', 'input', 'meta', 'link', 'hr', 'path', 'rect', 'circle', 'line', 'use', 'source'):
            continue
        if closing:
            if stack and stack[-1][0] == tag:
                stack.pop()
            elif any(t[0] == tag for t in stack):
                while stack and stack[-1][0] != tag:
                    problems.append("unclosed <%s> before </%s>" % (stack[-1][0], tag))
                    stack.pop()
                if stack:
                    stack.pop()
            else:
                problems.append("stray </%s>" % tag)
        elif not selfclose:
            stack.append((tag, m.start()))

    # Every doc-section must sit inside a .doc, and every table-wrap,
    # .steps and .callout must sit inside that same .doc.
    doc_spans = []
    for m in re.finditer(r'<article class="doc"[^>]*>', s):
        end = s.find('</article>', m.end())
        if end == -1:
            problems.append("<article class=\"doc\"> is never closed")
        else:
            doc_spans.append((m.start(), end))
    if not doc_spans:
        problems.append("no <article class=\"doc\"> wrapper")
    for cls in ('doc-section', 'table-wrap', 'steps', 'callout', 'prose'):
        for m in re.finditer(r'<[^>]*class="[^"]*\b%s\b[^"]*"[^>]*>' % cls, s):
            inside = any(a <= m.start() < b for a, b in doc_spans)
            if not inside:
                problems.append("<%s> outside the .doc wrapper" % cls)

    if problems:
        FAIL = 1
        print("FAIL %-24s" % name)
        for p in sorted(set(problems)):
            print("     " + p)
    else:
        secs = len(re.findall(r'class="doc-section"', s))
        print("PASS %-24s %d sections, all inside the .doc wrapper" % (name, secs))


_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sys.argv[1:] or [
    os.path.join(_root, "troubleshooting", "mouse.html"),
    os.path.join(_root, "troubleshooting", "keyboard.html"),
    os.path.join(_root, "troubleshooting", "trackpad.html"),
]
for f in files:
    check(f)
sys.exit(FAIL)
