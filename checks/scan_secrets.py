#!/usr/bin/env python3
"""Scan a directory (and a git repository's full history) for exposed secrets.

Prints the location and a MASKED value — never the secret itself — so the
output can safely be pasted into a chat or a ticket.

Usage:
  python3 scan_secrets.py                scan this repository, tree and history
  python3 scan_secrets.py <path>         scan some other path
  python3 scan_secrets.py <path> --no-git  tree only, skip the history

Exits non-zero if anything secret-shaped is found, so a release fails rather
than shipping a key.
"""
import os
import re
import sys
import math
import subprocess
from collections import defaultdict

# --- known token prefixes, by provider -------------------------------------
PREFIXES = [
    ("GitHub classic PAT",        r"gh[pousr]_[A-Za-z0-9]{20,}"),
    ("GitHub fine-grained PAT",   r"github_pat_[A-Za-z0-9_]{20,}"),
    ("GitHub OAuth token",        r"gho_[A-Za-z0-9]{20,}"),
    ("OpenAI key",                r"sk-[A-Za-z0-9_-]{20,}"),
    ("Anthropic key",             r"sk-ant-[A-Za-z0-9_-]{20,}"),
    ("AWS access key id",         r"(?:AKIA|ASIA|AIDA|AROA)[A-Z0-9]{16}"),
    ("Google API key",            r"AIza[0-9A-Za-z_-]{35}"),
    ("Google OAuth client",       r"GOCSPX-[0-9A-Za-z_-]{20,}"),
    ("Slack token",               r"xox[baprs]-[0-9A-Za-z-]{10,}"),
    ("Slack webhook",             r"https://hooks\.slack\.com/services/T[A-Za-z0-9_/]+"),
    ("SendGrid key",              r"SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"),
    ("Stripe live key",           r"(?:sk|rk)_live_[A-Za-z0-9]{20,}"),
    ("GitLab token",              r"glpat-[A-Za-z0-9_-]{20,}"),
    ("npm token",                 r"npm_[A-Za-z0-9]{30,}"),
    ("PyPI token",                r"pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}"),
    ("DigitalOcean token",        r"dop_v1_[a-f0-9]{64}"),
    ("Cloudflare API token",      r"(?i)cloudflare.{0,20}\b[A-Za-z0-9_-]{40}\b"),
    ("Firebase key",              r"AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}"),
    ("JSON web token",            r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    ("Private key block",         r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    ("Basic auth in URL",         r"https?://[^\s/:@]+:[^\s/@]+@[^\s/]+"),
]

# --- key=value style, where the NAME suggests a secret ---------------------
ASSIGN = re.compile(
    r"(?i)\b([a-z0-9_.-]*(?:api[_-]?key|apikey|secret|passwd|password|pwd|"
    r"access[_-]?key|auth[_-]?token|bearer|client[_-]?secret|private[_-]?key|"
    r"access[_-]?token|refresh[_-]?token|session[_-]?key)[a-z0-9_.-]*)\b"
    r"\s*[:=]\s*"
    r"[\"']?([^\s\"',;<>\)\}]{8,})[\"']?"
)

# --- placeholders and obvious non-secrets ----------------------------------
PLACEHOLDER = re.compile(
    r"(?i)^(?:your[_-]?\w*|xxx+|todo|changeme|placeholder|example|test|dummy|"
    r"none|null|nil|true|false|0+|1+|\$\{.*\}|<[^>]*>|\{\{.*\}\}|%s|%\w+|"
    r"[A-Z_]{3,}|replace[_-]?me|insert[_-]?\w*|\.\.\.|\*{3,})$"
)

# --- known-safe identifiers that look like keys ----------------------------
SAFE = re.compile(
    r"(?i)^(?:pub-\d+|ca-pub-\d+|G-[A-Z0-9]{6,}|UA-\d+-\d+|AWSAccessKeyId|"
    r"AIza[0-9A-Za-z_-]{35}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$"
)

SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".zip", ".gz", ".woff",
            ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".webm", ".pdf", ".pyc"}
SKIP_DIR = {".git", "node_modules", "__pycache__", ".mavis", "attachments", ".home", "build"}


def entropy(s):
    if not s:
        return 0.0
    counts = defaultdict(int)
    for ch in s:
        counts[ch] += 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def mask(v):
    v = str(v)
    if len(v) <= 8:
        return v[:2] + "*" * max(0, len(v) - 2)
    return v[:4] + "*" * (len(v) - 8) + v[-4:]


def looks_like_placeholder(v):
    return bool(PLACEHOLDER.match(v.strip()))


def scan_text(text, label, hits):
    for name, pat in PREFIXES:
        for m in re.finditer(pat, text):
            hits.append((name, label, mask(m.group(0))))
    for m in ASSIGN.finditer(text):
        name, value = m.group(1), m.group(2)
        if looks_like_placeholder(value) or SAFE.match(value.strip()):
            continue
        if len(value) < 12 or entropy(value) < 2.8:
            continue
        hits.append(("assigned secret: " + name, label, mask(value)))


def scan_dir(root):
    hits = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR]
        for fn in filenames:
            path = os.path.join(dirpath, fn)
            if os.path.splitext(fn)[1].lower() in SKIP_EXT:
                continue
            try:
                if os.path.getsize(path) > 2_000_000:
                    continue
                text = open(path, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            scan_text(text, os.path.relpath(path, root), hits)
    return hits


def scan_git_history(root):
    hits = []
    try:
        revs = subprocess.check_output(["git", "rev-list", "--all"], cwd=root,
                                       text=True).split()
    except subprocess.CalledProcessError:
        return hits
    seen = set()
    for rev in revs:
        try:
            files = subprocess.check_output(
                ["git", "ls-tree", "-r", "--name-only", rev], cwd=root, text=True).split("\n")
        except subprocess.CalledProcessError:
            continue
        for f in files:
            if not f or os.path.splitext(f)[1].lower() in SKIP_EXT:
                continue
            try:
                blob = subprocess.check_output(["git", "show", "%s:%s" % (rev, f)],
                                               cwd=root, text=True, errors="ignore")
            except subprocess.CalledProcessError:
                continue
            key = (f, hash(blob))
            if key in seen:
                continue
            seen.add(key)
            scan_text(blob, "%s @ %s" % (f, rev[:8]), hits)
    return hits


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    with_git = "--no-git" not in sys.argv
    if args:
        path = args[0]
    else:
        # the repository this script lives in
        path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("scanning %s%s" % (path, " (tree + history)" if with_git else " (tree only)"))
    hits = scan_dir(path)
    if with_git:
        hits += scan_git_history(path)
    # de-duplicate by (kind, masked value)
    uniq = []
    seen = set()
    for kind, where, val in hits:
        k = (kind, val)
        if k in seen:
            continue
        seen.add(k)
        uniq.append((kind, where, val))
    if not uniq:
        print("  CLEAN — no secret-shaped strings found")
        return 0
    for kind, where, val in uniq:
        print("  HIT  %-28s %-46s %s" % (kind, where, val))
    print("  %d distinct finding(s)" % len(uniq))
    return 1


if __name__ == "__main__":
    sys.exit(main())
