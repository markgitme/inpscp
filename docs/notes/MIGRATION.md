# Notes migration — the ledger

> On 2026-10-31 the nine project memory topics were moved into the two project
> repositories as markdown files, and the topics were deleted.
>
> This is the record of **where every fact went**. Nothing was dropped
> silently: each fact is either in a note file, in the repository's
> `CHANGELOG.md` / `README.md` / `GAMEPAD.md`, in the agent's cross-project
> memory, or in the Drive evidence brief.
>
> **Then, on 2026-11-01, the notes were split in two.** The engineering notes
> stayed here, public and readable without any credentials. The notes that are
> about the owner rather than the code moved to a **private** repository. See
> *The split* at the end of this file.

## What moved where

| Memory topic | Bytes | Now lives in |
|---|---|---|
| `inputscope-project` | 30,228 | `docs/notes/project-state.md`, `docs/notes/measurement-panels.md`, `CHANGELOG.md`, `GAMEPAD.md` |
| `measurement-panel-engineering` | 25,623 | `docs/notes/measurement-panels.md` |
| `github-publishing` | 17,784 | `docs/notes/publishing.md`, `README.md` |
| `sandbox-browser-testing` | 9,164 | `docs/notes/sandbox-environment.md` |
| `site-monetisation` | 4,759 | **private** → `monetisation.md` in the owner's notes repository (+ the Drive brief, unchanged) |
| `ursift-project` | 30,129 | `markgitme/ursift` → `docs/notes/project-state.md` |
| `feedwatch-data-sources` | 22,587 | `markgitme/ursift` → `docs/notes/data-sources.md` |
| `ursift-worker-live` | 13,535 | `markgitme/ursift` → `docs/notes/worker.md` |
| `ursift-pinned` | 3,649 | **private** → `markgitme/projectnotes` → `ursift/docs/notes/product.md` |

**150 KB of notes → 9 files in 2 repositories, plus the release narrative that
already lived in `CHANGELOG.md`.** The memory topics that remain hold only the
cross-project rules — the ones that apply to any project, not just these two.

## Fact-by-fact: `inputscope-project` (30,228 bytes)

| Fact | Now in |
|---|---|
| 12 pages, v1.17.0, ~25,000 words, the positioning line | `project-state.md` → *What it is* |
| The InputLab → InputScope rename, the domains it collided with, the rejected names | `project-state.md` → *Naming* |
| The review loop: localStorage keys, Alt+R, the Copy-notes export, the owner-only button | `project-state.md` → *Review / annotation loop* |
| "Copy notes exports the whole page history — diff it against the previous batch" | `project-state.md` → *Review / annotation loop* |
| Every deploy mints a new URL; quote the most recent one | `project-state.md` → *Deploys* |
| The owner's ?review=1 feedback log | **private** → `owner-notes.md` in the owner's notes repository |
| The four placeholders still to change, and the contact-form standing rule | `project-state.md` → *Placeholders still to change* |
| The roadmap order and why Display is rejected | `project-state.md` → *Roadmap priority order*; `GAMEPAD.md` |
| `inputscope.app` pricing, the `inputscope.com` RDAP finding, the ccTLD rejections, the Raptive clock | **private** → `owner-notes.md` in the owner's notes repository |
| Storage durability: session-scoped sandbox, durable Drive, GitHub, the token's scope | `project-state.md` → *Storage durability` |
| Why the AI disclosure stays, and the options not built | **private** → `owner-notes.md` |
| The competitive reality, including the gamepad and mic fields | `project-state.md` → *Competitive reality`; `GAMEPAD.md` |
| The one-document-per-device model, in Mark's words | `project-state.md` → *The one-document-per-device model* |
| The eight traps: relative canonical, generator clobbers its output, doc-section escaping (+ the parent-chain smoking gun), verify by measurement, never key logic off the canonical path, grammar from the bytes, proofreading ≠ grammar, group tables by row label | `project-state.md` → *The traps that cost time` |
| `text-wrap: balance` vs `pretty`; check the parent's `max-width` before the font size; test a range of viewports and report the card's bottom edge; a settings path is a factual claim — read it off the vendor's docs | `project-state.md` → *The traps that cost time* **(added during the migration — the CHANGELOG does not carry them)** |
| The contact-form bug and its fix | `CHANGELOG.md` → v1.16.0 |
| v1.6.0 → v1.17.0, every release, its numbers and its fixes | `CHANGELOG.md`, one section per release |
| The gamepad scope, the wedge, the build order | `GAMEPAD.md` (the memory topic was deleted when that file landed) |
| The three tool bugs the trackpad guide found | `CHANGELOG.md` → v1.15.0, *Fixed* |
| The layout panel's IME and non-Latin handling | `measurement-panels.md`; `CHANGELOG.md` → v1.16.1–v1.16.3 |

## Fact-by-fact: `measurement-panel-engineering` (25,623 bytes)

Every section became a section of `docs/notes/measurement-panels.md`:
the answer-first house style, the 48 unit lines and the rule that keeps them
honest, auto-repeat as one physical press, lock/modifier state, drag/drop
geometry, the CSS/JS traps, the median-gap report rate, the raw-sampling
honesty rule, ctrl+wheel versus pinch, the shape of a wheel's scroll, delta
modes, the FAQ↔schema rule, `event.timeStamp` versus `performance.now()`, the
mouse diagram's button mapping and the Firefox back/forward-button behaviour,
the "don't look clickable" rule, the key map's separate grids, the trackpad
surfaces, the grid and log traps, the step blocks, and the `data-out` removal
warning.

Two additions were made during the migration: the **unit-line rule** (the
`data-note` defect and its fix) and the **X1/X2 mouse-button section**, both
of which were in the topic and are now written down in one place.

## Fact-by-fact: `github-publishing` (17,784 bytes)

Everything operational became `docs/notes/publishing.md`: the push path and
`push-to-github.sh`, the fine-grained PAT recipe and the permission map, the
two probe traps (`PATCH` tests Metadata, not Contents) and the write probe, the
three causes of a 403, the credentials rules, GitHub Pages as a permanent
home, the Pages rebuild delay, the `edit`-tool race, the Cloudflare naming
rules and the cutover order, and the restore-from-clone loop.

**Two corrections were made during the migration.** The topic's claim that the
ursift repository could not be written to was **wrong** — the secret store
holds a second token, `GH_TOKEN_URSIFT`, scoped to `markgitme/ursift`, and the
ursift notes were pushed with it. The note now describes both tokens and which
one to use. The dated "push completed" narratives (27 and 28 October) were
dropped from the notes because **the git history and `CHANGELOG.md` are the
record of that**, and a note that repeats the history will drift from it.

## Fact-by-fact: `sandbox-browser-testing` (9,164 bytes)

All of it became `docs/notes/sandbox-environment.md`: the Playwright paths and
flags, the certificate proxy, the synthetic-event recipe for lock state and
auto-repeat, storage durability, the release loop, the four ways subdirectories
break links, the link checker, the above-the-fold measurement, the generator
that clobbers its own output, and the drift-check recipe.

**Two additions during the migration:** the four subdirectory link traps (the
topic had them; the note had only the first), and the session-id evidence
(2026-10-27's mount was `/456725449961619/workspace`, 2026-10-31's was
`/457081825542382/workspace` — the id changes, which is the proof).

## Fact-by-fact: `site-monetisation` (4,759 bytes)

It became `monetisation.md` verbatim — the two bars, the two traced
quotes with their attributions (and the correction that the earlier
attribution was wrong), the official policy links, the competitor ad-stack
teardown, the byline/date/schema rules, the page engine, and the timing rules.
**It moved to the owner's private notes repository** on 2026-11-01: it carries
the sponsorship rates and the exit multiples, which are his business and not
the project's documentation. The Drive brief `adsense-evidence-brief-2026-10-27.md`
(node `456853571461264`) is unchanged and still the full evidence.

## Fact-by-fact: the four ursift topics

| Topic | Now in | What was dropped |
|---|---|---|
| `ursift-project` (30,129) | `markgitme/ursift` → `docs/notes/project-state.md` | The dated release narrative (v0.1.0 → v0.5.1 walk-throughs) — the repository's `CHANGELOG.md` holds it |
| `ursift-worker-live` (13,535) | `markgitme/ursift` → `docs/notes/worker.md` | The per-release Worker changelog — `CHANGELOG.md` holds it. The four failures, the edge/Google measurements, the temporary-account trick and the two test suites all stayed |
| `feedwatch-data-sources` (22,587) | `markgitme/ursift` → `docs/notes/data-sources.md` | Nothing. The whole body carried over, including the two corrections |
| `ursift-pinned` (3,649) | `markgitme/ursift` → `docs/notes/product.md` | Nothing |

## What stayed in memory, and why

The agent's memory keeps only the **cross-project** rules — the ones that are
true of any project and would be lost if they lived in one repository:

- the answer-first verdict block and the two rules about a reading that cannot
  answer;
- the silent-failure traps (a guard on a missing API, a write aimed at a
  missing element, a filter that drops what the maps expect, an IME that is
  not a keydown);
- the credential hygiene rules (the `permissions` trap, the write probe, the
  self-tested and masked scanner, and the fact that a static site cannot keep a
  key secret);
- the monetisation bars and the one-document-per-device page engine, which
  apply to every site Mark builds;
- the memory-system limits themselves;
- and the standing rule that **the project knowledge belongs in the project
  repo, read on demand — not re-created as memory topics in a new chat**.

Everything else was project knowledge and belonged in the project.

## The one correction worth calling out

The migration surfaced a **wrong fact that had been carried in memory**: that
the ursift repository could not be pushed to because the token was scoped to
`inpscp` only. It could. The secret store holds two tokens, and only the
first had ever been probed. The notes now say which token to use, and the
ursift notes were pushed immediately rather than waiting for a change to a
token that did not need changing.


---

## The split — 2026-11-01

The notes were public, and the monetisation file carried the sponsorship rates
and the exit multiples. Rather than move everything behind a token, the notes
were divided by what they actually are.

**Public, in each project repository, readable with no credentials at all:**

| Project | Files |
|---|---|
| `markgitme/inpscp` → `docs/notes/` | `README.md`, `project-state.md`, `measurement-panels.md`, `publishing.md`, `sandbox-environment.md` |
| `markgitme/ursift` → `docs/notes/` | `README.md`, `project-state.md`, `worker.md`, `data-sources.md` |

**Private, in the owner's notes repository — `markgitme/projectnotes` — one
folder per project:**

| Path | What |
|---|---|
| `inpscp/docs/notes/monetisation.md` | the revenue strategy, the approval bars, the traced evidence |
| `inpscp/docs/notes/owner-notes.md` | the feedback log, the domain decision, the AI-disclosure choice, the go-live placeholders and their reasoning |
| `ursift/docs/notes/product.md` | the product he actually wants, and the scope drift, in his words |
| `ursift/docs/notes/owner-notes.md` | the open decisions and the domain position |

**The rule:** *his words, his decisions, his money* go private; *how the code
works* stays with the code.

**No duplication.** The private repository holds the only copy of anything
marked private, and the public repositories point there rather than repeating
it.

**Why not move everything?** Because a private repository needs a token on
every read, and a token that has expired must not become a **silent** failure:
a session that cannot read the notes would otherwise carry on with a summary
of them and produce a half-informed answer without ever saying so. With the
split, the worst case is that the business notes go dark, and everything that
describes the code is still readable.
