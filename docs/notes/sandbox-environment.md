# Sandbox browser testing + the release loop

> How to run and verify a browser build in this sandbox. Read before running any
> headless browser test, deploying a site, or when a change needs to be verified
> before the owner sees it.

## Tooling

- Playwright at `/usr/local/lib/node_modules/playwright`.
- Chromium binary at
  `/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome` — must pass
  `executablePath` **and** `--no-sandbox`; the headless shell is not installed.
- Local server: `python3 -m http.server 8899`.
- The sandbox proxies outbound HTTPS, so headless Chromium throws
  `ERR_CERT_AUTHORITY_INVALID` on live URLs — launch with
  `--ignore-certificate-errors` when testing against a deployed URL. `curl`
  verifies fine (`ssl_verify_result=0`).
- `run_all.sh` in `checks/` auto-detects the chromium binary; override with
  `CHROME_PATH`, and point the browser checks at another server with `BASE_URL`.

## What headless Chrome cannot do

**Headless Chrome does not track lock state at all** —
`getModifierState('CapsLock')` returns `false` on every event, including a real
CapsLock keydown. The hardware path cannot be exercised in this sandbox; say
plainly that the real toggle path is unverified.

To validate the handler, dispatch a synthetic `KeyboardEvent` and override
`getModifierState` on the instance:

```js
const e = new KeyboardEvent('keydown', { key: 'CapsLock', code: 'CapsLock' });
Object.defineProperty(e, 'getModifierState', { value: (k) => k === 'CapsLock' });
window.dispatchEvent(e);
```

That proves the lamp/pill logic end to end.

Auto-repeat simulates exactly the same way — `repeat` is a standard
`KeyboardEventInit` member:

```js
new KeyboardEvent('keydown', { key, code, repeat: true })
```

Scenario tests: N normal presses → count N; 1 press + 30 repeats → count 1 and
repeat shows "30 × A"; 2 keydowns + 1 keyup → double-fires 1.

## Storage durability (verified 2026-10-31)

- **Sandbox filesystem is session-scoped.** The mount path literally contains the
  session id: `alinas-ap-…:/457081825542382/workspace` on 2026-10-31, and
  `/456725449961619/workspace` on 2026-10-27 — **a different id, a different
  volume.** A new chat = new session id = **new empty volume**. A project
  directory will not exist in a new session.
- **The Drive is durable and global.** Every `website_deploy` records
  `"source_retained": true, "project_source_retained": true`. Verified:
  `drive files download` on a zip node returns a working archive containing the
  **full source**.
- **Memory is global and permanent** — user scope (cross-agent) + agent scope
  (private), injected into every new chat.
- **Best durability: GitHub.**
  `git -c http.https://github.com/.extraheader=Authorization: Basic $AUTH` keeps
  the token out of git config, the remote URL, and history.

## The release loop (for any change the owner wants to see)

1. Make the edit(s).
2. Verify — structure check + browser check for console errors.
3. `git add -A` → `git commit` → `git tag -a vX.Y.Z`.
4. `./build.sh --clean` → zip into `/workspace/output/<name>-vX.Y.Z-<date>.zip`.
5. `website_deploy` with `path=/<project>/build`, `source_path=/<project>`.
6. **Put the new URL in the response, prominently**, plus the zip and any
   screenshots.

`website_deploy` mints a fresh `*.space.minimax.io` URL every time, so always
quote the URL from the *most recent* deploy result — never a remembered one. All
prior URLs keep resolving, so old links are not broken, just outdated. The source
upload is a private archive: check it contains no secrets before publishing.

## Adding pages in subdirectories — four ways to break the links

Adding a `guides/mouse/` tree to a flat static site surfaced four bugs that a
"does it render?" check would have missed. All four were caught by a **link
checker**, not by the browser.

**1. A relative canonical must be relative to the PAGE, not to the site root.**
`guides/mouse/foo.html` with `<link rel="canonical" href="guides/mouse/foo.html">`
resolves to `/guides/mouse/guides/mouse/foo.html` — a 404 that looks fine in the
source. The site's existing convention (`mouse-check.html` →
`href="mouse-check.html"`) means **canonical = the page's own filename, relative
to itself**. Same for `og:url`. `og:image` follows the same rule and needs the
right number of `../`.

**2. Breadcrumbs break the same way.** `guides/index.html` linking to
`href="guides/index.html"` for the "Guides" crumb points at
`/guides/guides/index.html`. Breadcrumb hrefs are page-relative:
`../index.html`, `index.html`.

**3. An f-string template double-hashes the anchor.** A helper taking
`anchor="#dbl-start"` and writing `href="../../mouse-check.html#{anchor}"`
produces `##dbl-start`, which no link checker flags as "dead" unless it strips
the fragment properly. Normalise with `anchor.lstrip('#')` at the boundary
instead.

**4. A generator that only patches *some* call sites leaves one stale path.**
The hardcoded `canonical="guides/mouse/what-the-numbers-mean.html"` survived
while the f-string siblings were rewritten — a per-occurrence count check
caught it.

**The link checker that catches all of this** (keep it — it is reusable):
walk every `.html` in `build/`, resolve every `href`/`src` against the file's own
directory, check the target exists, and check the fragment against the target's
`id`s. Also assert: canonical present, `og:url` present, meta description
present, exactly one `h1`, every JSON-LD block parses, and **no prose sentence
appears on two pages** (that last one proves a "move" actually moved).

**Two more checks worth keeping:**

- **No-index pages are exempt** from the canonical/description rules — `404.html`
  has `<meta name="robots" content="noindex">` and legitimately has no
  canonical. A checker that flags it teaches you to ignore the checker.
- **Grammar in headings is a copy bug, but read the bytes, not your memory.**
  Twice in one session I reported a heading as "Why does your keyboard
  ghosting?" when the file said "Why is your keyboard ghosting?" — which is
  correct English. `repr()` on the string and an `ord()` dump settles it in one
  second. **Never report a copy bug from a glance.**

## Measuring "is it above the fold?" instead of guessing

When a change is about what a visitor sees **without scrolling**, measure it in
the browser rather than estimating from CSS.

```js
const first = document.querySelector('#tools .tool-card');
const r = first.getBoundingClientRect();
const cardTop    = Math.round(r.top + window.scrollY);
const cardBottom = Math.round(r.bottom + window.scrollY);
const titleTop   = Math.round(first.querySelector('h3').getBoundingClientRect().top + window.scrollY);
```

Run it at several viewports (390×844 phone, 768×1024 tablet, 1280×800 small
laptop, 1280×900 and 1440×900 desktop). **A card is "above the fold" when its
bottom is inside the viewport; the card *title* is visible much earlier.** Both
numbers matter — "the user can see the tool name" and "the user can see the whole
card" are different bars.

Also measure the page height before and after so the win is a number, not a
feeling: `document.body.scrollHeight` ÷ viewport height = screens.

**To see where a heading actually breaks**, range-measure the text nodes —
`getClientRects` per character gives the real line boxes:

```js
const r = document.createRange();
for (let i = 0; i < t.length; i++) { r.setStart(t, i); r.setEnd(t, i + 1);
  const key = Math.round(r.getBoundingClientRect().top); /* new line when key changes */ }
```

This is how you catch `text-wrap: balance` splitting *"keyboard | test"*, which
looks fine in the source and only shows up in the rendered line boxes.

## Two lessons from a migration that clobbered its own output

**1. A generator that deletes its output directory will destroy your work when
it crashes.** The Troubleshooting generator did `shutil.rmtree(OUT)` at the top of
every run, then read its source from a tree that had already been deleted — so it
crashed *after* wiping 54 KB of finished documents. Recovery was
`git checkout HEAD -- guides/`.

**Rules:** never `rmtree` the output at the start of a run — overwrite the files
instead. And never let a generator's source be a tree the same run deletes.
Snapshot the source outside the repo and read from the snapshot.

**2. The drift check is the thing that makes a content migration safe.** When
moving prose between pages, verify it survived:

```python
# article paragraphs only — skip the hero lead, the related-links grid and the CTA
for sec in re.findall(r'<section class="section[^"]*">(.*?)</section>\s*(?=<section|</main)', h, re.S):
    if 'tool-hero' in sec or 'cta-band' in sec or '>Read next<' in sec: continue
```

Then check each paragraph appears in the destination. 107 paragraphs checked, 2
lost, and both were card-grid introductions that no longer applied.

**Two traps in that check, both of which produced false alarms:**

- **`<link>` matches an `li` alternative in a naive tag-stripping regex.**
  `<li[^>]*>.*?</li>` then matches from `<link rel="stylesheet">` all the way to
  the first `</li>`, eating every paragraph on the page. Always put a word
  boundary after the tag name: `<(h[1-6]|li|td|th|summary)\b[^>]*>`.
- **Strip tags consistently on both sides.** Replacing tags with a space in one
  place and with nothing in another turns `<strong>key chatter</strong>` into
  "key chatter " vs "key chatter" and reports a false loss. Pick one and use it
  for both.

## The link checker that catches more than broken links

Walk every `.html` in `build/`, resolve every `href`/`src` against the file's own
directory, check the target exists, and check the fragment against the target's
`id`s. Also assert: canonical present, `og:url` present, meta description
present, exactly one `h1`, every JSON-LD block parses, and **no prose sentence
appears on two pages** (that last one proves a "move" actually moved).

**No-index pages are exempt** from the canonical/description rules — `404.html`
has `<meta name="robots" content="noindex">` and legitimately has no canonical. A
checker that flags it teaches you to ignore the checker.

This checker now lives in the repository as `checks/check_links.py`.
