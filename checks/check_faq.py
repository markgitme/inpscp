#!/usr/bin/env python3
"""Assert the visible FAQ and the FAQPage JSON-LD say the same thing.

Search engines read the JSON-LD. Readers read the page. If they drift, the
page is lying to one of them.
"""
import io, json, os, re, sys, html

def visible_faq(s):
    """Only the .faq container. Matching <summary> anywhere in the file also
    picks up the <details> disclosure panels, which are not FAQs."""
    m = re.search(r'<div class="faq[^"]*">(.*?)</div>\s*</div>\s*</section>', s, re.S)
    block = m.group(1) if m else s
    out = []
    for m in re.finditer(r'<summary>(.*?)</summary>\s*<div class="faq__a">(.*?)</div>\s*</details>', block, re.S):
        q = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
        a = html.unescape(re.sub(r'<[^>]+>', '', m.group(2)))
        a = re.sub(r'\s+', ' ', a).strip()
        out.append((q, a))
    return out

def ld_faq(s):
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)
    if not m:
        return None
    data = json.loads(m.group(1))
    nodes = data.get('@graph', [data])
    for n in nodes:
        if n.get('@type') == 'FAQPage':
            return [(i['name'], re.sub(r'\s+', ' ', i['acceptedAnswer']['text']).strip())
                    for i in n['mainEntity']]
    return None

def check(path):
    s = io.open(path, encoding='utf-8').read()
    v = visible_faq(s)
    l = ld_faq(s)
    name = path.split('/')[-1]
    if l is None:
        print("FAIL %-24s no FAQPage schema" % name)
        return False
    if len(v) != len(l):
        print("FAIL %-24s %d visible questions, %d in the schema" % (name, len(v), len(l)))
        return False
    ok = True
    for (vq, va), (lq, la) in zip(v, l):
        if vq != lq:
            print("FAIL %-24s question mismatch:\n  visible: %s\n  schema : %s" % (name, vq, lq))
            ok = False
        if va != la:
            print("FAIL %-24s answer mismatch for %r" % (name, vq))
            for i in range(min(len(va), len(la))):
                if va[i] != la[i]:
                    print("  first difference at char %d" % i)
                    print("  visible: ...%s..." % va[max(0, i - 60):i + 60])
                    print("  schema : ...%s..." % la[max(0, i - 60):i + 60])
                    break
            else:
                print("  visible length %d, schema length %d" % (len(va), len(la)))
                print("  visible tail: %s" % va[min(len(va), len(la)):][:120])
                print("  schema tail : %s" % la[min(len(va), len(la)):][:120])
            ok = False
    if ok:
        print("PASS %-24s %d questions, visible and schema agree" % (name, len(v)))
    return ok

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sys.argv[1:] or [
    os.path.join(_root, "mouse-check.html"),
    os.path.join(_root, "keyboard-check.html"),
    os.path.join(_root, "index.html"),
]
allok = True
for f in files:
    allok = check(f) and allok
sys.exit(0 if allok else 1)
