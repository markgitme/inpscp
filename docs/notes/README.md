# Working notes — InputScope

> The notes that used to live in a chat assistant's memory, moved into the
> repository so they survive every new conversation.
>
> **How to use this folder:** clone the repo and read the file that matches what
> you are about to do. Nothing here is needed to *serve* the site — it is the
> reasoning, the measurements and the traps behind the code.
>
> **These notes are public and readable without any credentials.** The parts
> that are about the owner rather than the code — the feedback log, the domain
> decision, the AI-disclosure choice, the go-live placeholders and their
> reasoning, and the monetisation strategy — live in the owner's **private**
> notes repository, `markgitme/projectnotes`, under `inpscp/docs/notes/`. This
> repository is the engineering half; that one is the rest.
>
> To read the private half:
> ```bash
> AUTH=$(printf 'x-access-token:%s' "$GH_TOKEN_NOTES" | base64 -w0)
> git -c "http.https://github.com/.extraheader=Authorization: Basic $AUTH" \
>     clone https://github.com/markgitme/projectnotes.git
> ```
> **If that clone fails, say so and stop** — do not carry on from a summary as
> if the notes had been read.

## Why these are in the repo

The knowledge that used to sit in a capped memory store (10 topics, 30 KB each)
belongs to the project, not to a chat window. A new session gets an empty
sandbox, but it can always clone this repository and read the same notes.

**Read the notes before working on the site.** They record the decisions that
were made once and should not be re-litigated, the numbers that were measured
so they do not have to be measured again, and the traps that each cost real
time.

## The files

| File | Read it before |
|---|---|
| [`project-state.md`](project-state.md) | changing anything structural — the current page set, the naming, the review loop, the placeholders still to change, the roadmap order, the domain situation, and the traps that cost time |
| [`measurement-panels.md`](measurement-panels.md) | building or debugging any measurement panel — the answer-first verdict block, physical presses vs auto-repeat, modifier/lock state, drag-and-drop geometry, the latency rule (`event.timeStamp`, not `performance.now()`), and the CSS/JS traps that silently break a panel |
| [`publishing.md`](publishing.md) | pushing, token work, or a hosting change — the fine-grained PAT recipe, the permission map, the write probe, the GitHub Pages setup, and the Cloudflare cutover order |
| [`sandbox-environment.md`](sandbox-environment.md) | running a headless browser test or deploying — the Playwright paths, the certificate proxy, what headless Chrome cannot verify, storage durability, the release loop, and the link checker recipe |
| `monetisation.md` *(private)* | touching ads, analytics, bylines, dates or schema — the two approval bars (AdSense judges editorial substance, Raptive judges traffic), the traced policy quotes, the byline/date rules, and the one-document-per-device page engine — **private, in the owner's notes repository** |
| [`MIGRATION.md`](MIGRATION.md) | once — the record of where every note came from when the memory topics were moved into this folder on 2026-10-31, and what was dropped from them and where it went instead |

## The one-line rules that come out of them

- **Never push to GitHub unless the owner asks for it in that conversation.** A
  push is a release — GitHub Pages rebuilds from `main`.
- **Functional first.** A feature in development gets no page, no guide entry,
  no FAQ entry, no schema block, no sitemap entry, no home card.
- **The markup declares the starting state, the script updates it, and a
  checker asserts the declared line is one the script can actually write.**
- **Copy must match the tool's JavaScript exactly.** A threshold table is a
  test suite for the tool.
- **Never put an ad unit on a measurement surface.** A layout shift mid-test
  corrupts the reading.
- **British English, no contractions, em dashes with spaces, plain second
  person, no marketing voice.** Correctness over taste.
- **The site owns the thresholds and the trust.** Everything a competitor's
  page asserts has to be checked before it is repeated here.

## Related files in the repository

| File | What it is |
|---|---|
| [`../../CHANGELOG.md`](../../CHANGELOG.md) | every release, what changed and why — the narrative history the notes deliberately do not duplicate |
| [`../../GAMEPAD.md`](../../GAMEPAD.md) | the locked scope and build order for the third tool |
| [`../../GO-LIVE.md`](../../GO-LIVE.md) | the go-live checklist |
| [`../../checks/README.md`](../../checks/README.md) | what each check catches and why it exists |
| [`../../README.md`](../../README.md) | the project README — layout, checks, credentials, publishing, review mode |

## Housekeeping

These notes are the working memory. Update them **in place** when a decision
changes, rather than starting a new document. When a note becomes stale, delete
it — a note that is out of date is worse than no note, because it will be
believed.
