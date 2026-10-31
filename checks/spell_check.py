#!/usr/bin/env python3
"""Spelling sweep across the shipped site.

Noise reduction:
  * hyphenated compounds are split and each part is checked
  * possessives and contractions are normalised
  * proper nouns are detected from the corpus itself (a capitalised word
    that appears mid-sentence somewhere on the site) and accepted
  * each unique word is reported once, at its first location

Output is a list for a human to judge, not a verdict.
"""
import io, os, re, sys, html
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("REPO_DIR") or os.path.dirname(HERE)

DICT = "/workspace/words_alpha.txt"

# Site jargon that a general dictionary will not carry.
JARGON = set("""
inputscope web3forms hcaptcha cloudflare github pages githubio gzipped gzip
macos windows linux ubuntu fedora android iphone ipad imac macbook
trackpad trackpads touchpad touchpads numpad numlock numlock keypad
keypress keypresses rollover ghosting debounce deadkey deadkeys deadzone
scrollbar scrollbars scrollwheel wheel doubleclick doubleclicks
pointerlock pointerrawupdate coalesced requestanimationframe
requestidlecallback getcoalescedevents getmodifierstate eventtimestamp
browsersafari chromium firefox safari chrome edge webkit
usb dongle dongles thunderbolt wifi bluetooth
ms pv pv clickthrough ctr cpm rpm
unplug replug reboot overclock underclock throttling throttle throttled
latency latencies jitter jittery jitteriness polled polling pollrate
loose lossy sticky stickykeys accessibility a11y aria
labelledby labelled unlabelled colour colours coloured behavior behaviour
centre centred metre millimetre recognise recognise
haemorrhage jewellery travelling cancelled cancelled
modelling modelling labelled
fulfil fulfil fulfilment
analyse analyse analysing
""".split())

TYPOS = {
    "ther": "there / their", "teh": "the", "recieve": "receive",
    "seperate": "separate", "occured": "occurred", "occurence": "occurrence",
    "acheive": "achieve", "compatability": "compatibility",
    "comparision": "comparison", "dependant": "dependent",
    "independant": "independent", "existance": "existence",
    "consistant": "consistent", "refered": "referred",
    "commited": "committed", "prefered": "preferred",
    "sucessful": "successful", "successfull": "successful",
    "usefull": "useful", "helpfull": "helpful", "begining": "beginning",
    "explicitely": "explicitly", "definately": "definitely",
    "seperately": "separately", "wich": "which", "whith": "with",
    "thier": "their", "becuase": "because", "loose": "lose",
    "parameteres": "parameters", "paramters": "parameters",
    "reccommend": "recommend", "recomend": "recommend",
    "neccessary": "necessary", "necesary": "necessary",
    "occassionally": "occasionally", "priviledge": "privilege",
    "publically": "publicly", "realy": "really", "truely": "truly",
    "untill": "until", "wich": "which", "writen": "written",
    "measurment": "measurement", "measurments": "measurements",
    "treshold": "threshold", "tresholds": "thresholds",
    "threshhold": "threshold", "tolerance": "tolerance",
    "reponse": "response", "respone": "response",
    "responce": "response", "seperate": "separate",
    "tempature": "temperature", "tempertaure": "temperature",
    "interupt": "interrupt", "interupted": "interrupted",
    "occurr": "occur", "occurance": "occurrence",
    "acumulate": "accumulate", "accummulate": "accumulate",
    "millsecond": "millisecond", "milliseconds": "milliseconds",
    "milisecond": "millisecond", "milisec": "millisecond",
    "milis": "millis", "pixles": "pixels", "pixelate": "pixelate",
    "positon": "position", "positon": "position",
    "positon": "position", "postion": "position",
    "veloctiy": "velocity", "accelleration": "acceleration",
    "accelaration": "acceleration", "intial": "initial",
    "intially": "initially", "inital": "initial",
    "normalled": "normalised", "normalled": "normalised",
    "avaliable": "available", "availble": "available",
    "avaliable": "available", "prefered": "preferred",
    "dependecy": "dependency", "dependecies": "dependencies",
    "refernce": "reference", "refernces": "references",
    "referrence": "reference", "preferrable": "preferable",
    "commiting": "committing", "commitement": "commitment",
    "beleive": "believe", "beleived": "believed",
    "hierachy": "hierarchy", "heirarchy": "hierarchy",
    "manoeuver": "manoeuvre", "manouver": "manoeuvre",
    "cancelled": "cancelled", "cancelation": "cancellation",
    "occuring": "occurring", "occuring": "occurring",
    "comparing": "comparing", "comparision": "comparison",
    "correctess": "correctness", "correctnes": "correctness",
    "accurracy": "accuracy", "acurracy": "accuracy",
    "consistantly": "consistently", "consistantly": "consistently",
    "definitly": "definitely", "definately": "definitely",
    "independant": "independent",
}


def norm(w):
    w = w.lower()
    w = re.sub(r"['’]s$", "", w)
    w = re.sub(r"['’](t|re|ve|ll|d|m)$", "", w)
    return w


def load_dict():
    d = set()
    with io.open(DICT, encoding="utf-8", errors="ignore") as f:
        for line in f:
            w = line.strip().lower()
            if w:
                d.add(w)
    return d


def html_prose(path):
    src = io.open(path, encoding="utf-8").read()
    lines = src.split("\n")
    out = []
    in_skip = False
    for i, line in enumerate(lines, 1):
        if in_skip:
            if re.search(r"</(script|style)>", line, re.I):
                in_skip = False
            continue
        if re.search(r"<(script|style)\b", line, re.I):
            if not re.search(r"</(script|style)>", line, re.I):
                in_skip = True
            line = re.sub(r"<[^>]*>", " ", line)
        else:
            line = re.sub(r"<[^>]*>", " ", line)
        line = html.unescape(line)
        if line.strip():
            out.append((i, line))
    return out


def code_text(path):
    out = []
    src = io.open(path, encoding="utf-8").read()
    for i, line in enumerate(src.split("\n"), 1):
        chunks = []
        chunks += re.findall(r"/\*.*?\*/", line)
        chunks += re.findall(r"//.*?$", line)
        chunks += re.findall(r"'([^'\\\n]{2,})'", line)
        chunks += re.findall(r'"([^"\\\n]{2,})"', line)
        for c in chunks:
            out.append((i, c))
    return out


def build_proper_nouns(all_lines):
    """A capitalised token that appears mid-sentence is a proper noun."""
    props = set()
    for _ln, text in all_lines:
        for m in re.finditer(r"(?<=[a-z0-9,;)\]] )([A-Z][A-Za-z'\-]{2,})", text):
            props.add(norm(m.group(1)))
    return props


def main():
    dic = load_dict()
    site_files, code_files, md_files = [], [], []
    for base, _dirs, names in os.walk(ROOT):
        if "/.git" in base or "/build" in base:
            continue
        for n in sorted(names):
            p = os.path.join(base, n)
            if n.endswith(".html"):
                site_files.append(p)
            elif n.endswith((".js", ".css")):
                code_files.append(p)
            elif n.endswith((".md", ".txt", ".xml", ".webmanifest")):
                md_files.append(p)

    corpus = []
    for p in site_files:
        corpus += html_prose(p)
    props = build_proper_nouns(corpus)
    props |= set(JARGON)

    flagged = OrderedDict()

    def scan(path, lines, tag):
        for ln, text in lines:
            for m in re.finditer(r"[A-Za-z][A-Za-z'’]+", text):
                raw = m.group(0)
                # split hyphenated compounds
                parts = raw.split("-") if "-" in raw else [raw]
                for part in parts:
                    w = norm(part)
                    if len(w) < 3:
                        continue
                    if w in dic or w in props or w in JARGON:
                        continue
                    key = (tag, w)
                    if key not in flagged:
                        flagged[key] = (os.path.relpath(path, ROOT), ln, raw)

    for p in site_files:
        scan(p, html_prose(p), "prose")
    for p in code_files:
        scan(p, code_text(p), "code")
    for p in md_files:
        scan(p, code_text(p) if p.endswith((".txt", ".xml", ".webmanifest"))
             else html_prose(p), "doc")

    print("=== NOT IN DICTIONARY (unique words, first location) ===")
    for (tag, w), (f, ln, raw) in sorted(flagged.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        print("  %-5s %-26s %s:%d" % (tag, raw, f, ln))
    print("--- %d unique flagged words ---" % len(flagged))

    print("\n=== CURATED MISSPELLINGS (real word, wrong word) ===")
    n = 0
    for p in site_files + code_files + md_files:
        src = io.open(p, encoding="utf-8").read()
        for i, line in enumerate(src.split("\n"), 1):
            for bad, good in sorted(TYPOS.items()):
                for m in re.finditer(r"\b%s\b" % re.escape(bad), line, re.I):
                    print("  %s:%d  %r -> %r" % (os.path.relpath(p, ROOT), i, m.group(0), good))
                    n += 1
    print("--- %d curated hits ---" % n)


if __name__ == "__main__":
    main()
