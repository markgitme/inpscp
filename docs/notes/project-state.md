# InputScope — project state

> These are the working notes for the site. The **release-by-release history is in
> `CHANGELOG.md`** — that is the authoritative record of what changed and when.
> This file is the state, the decisions behind it, and the traps to avoid.

Read this before working on the site, deploying it, or answering a question about
its structure or status.

## What it is

Static hardware-diagnostic site. Dependency-free plain HTML/CSS/JS — no build
step, no framework, no dependencies. Dark theme. **12 pages**, 2 test suites
(Mouse Check, Keyboard Check — the trackpad is a panel inside the keyboard tool,
with its own troubleshooting document), **~25,000 words**. Built 2026-10-27,
currently **v1.17.0** (built, released and pushed). Positioning: *"an oscilloscope
for your input devices."*

## Naming

Renamed from **InputLab** → **InputScope** on 2026-10-27. "InputLab" collided with
inputlab.org (InputLab Suites — same "all tools run locally in your browser"
model), inputlabs.io, inputlab.eu, inputlab.net, and GitHub
`BertMartins/InputLab` (near-identical concept). Rejected: PointerLab, ClickLab,
KeyLab, InputBench, DeviceLab, HardwareLab, MouseCheck, KeyboardCheck,
InputAudit — all have DNS records.

## Review / annotation loop (the owner's feedback channel)

`assets/js/review.js` + `assets/css/review.css`.

- `?review=1` in the URL enables it; persists via localStorage key
  `inputscope_review_mode_v1`.
- Click any element → numbered note editor. Notes persist per page in
  `inputscope_review_notes_v1`.
- "Copy notes" exports Markdown with CSS selector + text snippet → paste to me.
- `Alt+R` arms/disarms capture so the page stays usable. Ordinary visitors see
  nothing.
- The review button only renders for the owner (after `?review=1` has been used
  once).
- **Never add an ad unit to a measurement surface** — layout shift corrupts the
  results.
- **"Copy notes" exports the WHOLE page history, not just the new notes**, so a
  second export contains the previous batch verbatim and the same fix can get
  rebuilt twice. **Before acting on a batch, diff it against the previous
  batch** — two byte-for-byte identical exports mean the work is already done,
  so check the current build and say so instead of making the changes again.
  There is a "Clear page" button (`data-rv-clear`) and individual notes can be
  deleted. Notes are per-page, so a batch is always for one page at a time.

## Storage durability (verified 2026-10-31)

- **Sandbox filesystem is session-scoped.** The NFS mount exports
  `/<session-id>/workspace`, so a new chat = a new empty volume. Nothing in
  `/workspace` survives.
- **The Drive is durable and global.** Every deploy records
  `"source_retained": true`, so the full source is kept per release.
- **Best durability: GitHub.** `push-to-github.sh` uses a scoped `extraheader`,
  so the token never touches git config, the remote URL, or history. GitHub also
  unblocks Cloudflare Pages.
- **The test suite lives in the repository, not the sandbox: `checks/`** —
  `./checks/run_all.sh` runs everything. Committed for exactly this reason.
- **Two tokens, two repos.** The token in the `GH_TOKEN` secret is
  fine-grained and write-scoped to `markgitme/inpscp` only — a dry-run push to
  `markgitme/ursift` with it is refused (403), so the other four repos are
  read-only for that token. A **separate `GH_TOKEN_URSIFT` secret** holds a
  second fine-grained token scoped to `markgitme/ursift`, which is how the
  ursift notes were pushed. Use the right one for the repo; never echo
  either.
  `checks/scan_secrets.py` scans the tree and the full git history for keys
  and fails a release on a hit; it was self-tested against planted canaries,
  because a scanner that finds nothing because it is broken looks exactly like
  a clean repo. **This site has no API keys at all** — no server, no analytics,
  no cookies. The Web3Forms access key is public by the vendor's own design.

## Deploys

**Every deploy mints a NEW ephemeral `*.space.minimax.io` URL** — the versioned
zips in `/workspace/output/` are the durable artefact. Always quote the URL from
the most recent deploy result; never reuse a remembered one. The current live
preview is in the newest release section of `CHANGELOG.md`.

## The owner's own notes (private)

**The owner-feedback log, the placeholders still to change, the domain
decision, and the AI-disclosure decision are not in this file.** They are in
the owner's private notes repository, under
`inpscp/docs/notes/owner-notes.md` — the owner's words, the money, and the
decisions only he can make. Everything here is about the code.

## The owner's own notes (private)

**The owner-feedback log, the placeholders still to change, the domain
decision, and the AI-disclosure decision are not in this file.** They are in
the owner's private notes repository, under
`inpscp/docs/notes/owner-notes.md` — the owner's words, the money, and the
decisions only he can make. Everything here is about the code.

## Roadmap priority order (updated 2026-10-31)

Gamepad → Headset → Display → Webcam. **Display is rejected as a brand mismatch**
— a monitor is an output device and "InputScope" is a promise about inputs. The
Gamepad card on the home page says "Next up", the rest say "Planned" — nothing is
in development, and the tag must never claim more than the build supports.

**The gamepad scope is locked and written down in `GAMEPAD.md`** at the root of
this repository: a drawn gamepad whose buttons light when pressed, simplified
troubleshooting on the page itself, no guide, no FAQ, no other tests yet, built
one piece at a time with a browser check after each.

## The owner's own notes (private)

**The owner-feedback log, the placeholders still to change, the domain
decision, and the AI-disclosure decision are not in this file.** They are in
the owner's private notes repository, under
`inpscp/docs/notes/owner-notes.md` — the owner's words, the money, and the
decisions only he can make. Everything here is about the code.

## The owner's own notes (private)

**The owner-feedback log, the placeholders still to change, the domain
decision, and the AI-disclosure decision are not in this file.** They are in
the owner's private notes repository, under
`inpscp/docs/notes/owner-notes.md` — the owner's words, the money, and the
decisions only he can make. Everything here is about the code.

## Competitive reality (verified by web search 2026-10-27)

Saturated niche: clicktests.net (50+ tools), mouseaccuracy.com (the strongest),
keyboardtester.click, devicetests.com, onlinemictest.com, clickspeedtester.com.
AdSense approval for a 2-tool site is unlikely (low-value-content policy). The
gamepad and mic niches were surveyed 2026-10-31 — see `GAMEPAD.md`.

## The one-document-per-device model

Mark's model, in his words: *"Main Page > Troubleshooting > List of Tools (Mouse,
Keyboard, Headset, Gamepad, etc.) … once clicked, it shows the mouse guide page
in one big, document-like page. There are no clickable links to any issues just
to create new pages. just one big page about mouse guide separated by few
spaces."*

The separate guide pages are gone. Each device is now one continuous scroll: a
**numbered table of contents**, then sections separated by a rule and some space
(`.doc-section` + `border-top`). The one-line summary that used to sit on the
guide's card now sits under each chapter heading as a `.doc-lede`. Each section
carries a threshold table and a fix, using the thresholds the tool's own JS
applies, so the document and the verdict can never disagree.

## The traps that cost time (read before generating or editing a page)

- **A relative canonical is relative to the PAGE, not the site root.**
  `guides/mouse/foo.html` with `href="guides/mouse/foo.html"` resolves to
  `/guides/mouse/guides/mouse/foo.html` — a 404 that looks fine in the source.
  The site's convention is canonical = the page's own filename, relative to
  itself. Breadcrumbs are page-relative for the same reason. `og:image` follows
  the same rule and needs the right number of `../`.
- **A generator that deletes its output directory destroys your work when it
  crashes.** Never `rmtree` the output at the start of a run — overwrite the
  files instead, and never let a generator's source be a tree the same run
  deletes. Snapshot the source outside the repo and read from the snapshot.
- **A doc-section that escapes its `.doc` wrapper looks fine in the source and
  breaks on the page.** The browser re-nests it, the callout and tables get
  ejected to `<main>`, and the prose loses its width. **The smoking gun:** the
  parent chain of the offending blocks is literally
  `DIV.table-wrap < MAIN < BODY < HTML`. If a block's ancestor chain skips the
  element you put it in, the parser has re-nested it. A layout bug that hits one
  page and not its identical sibling is a markup bug, not a CSS bug.
- **Verify by measurement, not by eyeball.** Measure the gap between every
  eyebrow and the element above it, count the columns of every steps grid, and
  measure the *text* rect (not the paragraph box) against a corner radius — the
  padding is inside the paragraph's border box, so the paragraph box reports a
  caption as still clipped when it is not.
- **Never key logic off the canonical path in a site with subdirectories** — it
  is relative to the page, not the site root. That is how the guide pages
  silently lost `aria-current="page"`.
- **Grammar in a heading is a copy bug, but read the bytes.** Twice in one
  session a heading was reported as "Why does my keyboard ghosting?" when the
  file said "Why is my keyboard ghosting?" — correct English. `repr()` settles
  it in one second. **Never report a copy bug from a glance.**
- **A proofreading pass on a technical site is not a grammar pass.** The real
  bugs were a claim contradicted by the tool's own source, a promise no panel
  delivers, a table that drifted from itself, and copy left over from a
  restructure. Always grep the JS for the panel you are describing before
  calling a sentence accurate.
- **Group `<table>`s on their row-label tuple and diff the other columns** —
  the same table appeared three times with three different wordings, and no
  checker reported it.
- **`text-wrap: balance` splits compound nouns across lines.** It split
  "keyboard test" across two. **Use `balance` only where you want even line
  lengths (a short hero H1); use `pretty` for body headings.** Both are
  progressive enhancements, so a mistake here only shows on browsers that
  support them.
- **When a heading refuses to fit, check the parent's `max-width` before
  shrinking the type.** `.section__head { max-width: 62ch; }` was forcing the
  two-line break, not the font size; `#tools .section__head { max-width: none; }`
  is what fixed it.
- **Test a range of viewports, not one — and report the card's bottom edge
  against the viewport height**, not the card's top. The owner's screenshot
  showed cards clipping at the bottom of *his* window, and the number that
  matters is where the last card ends, not where it begins.
- **A settings path in a troubleshooting guide is a factual claim.** Three
  macOS paths were wrong until they were checked against Apple's own
  documentation rather than written from memory. **Read settings paths off the
  vendor's documentation, every time.**

## A note on the older notes

Before 2026-10-28 the site had a `guides/` tree of ten separate pages, and
before that a third tool called Trackpad Check as its own page. Both were
removed, and the lessons from each are folded into the traps above and into
`measurement-panels.md`. The release-by-release narrative of all of it is in
`CHANGELOG.md`.
