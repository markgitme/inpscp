# Working notes — InputScope

> **The working notes for this project are not in this repository.** They live
> in a private repository, `markgitme/projectnotes`, under
> `inpscp/docs/notes/` — the same paths they used to occupy here, so the
> mapping is one to one.
>
> This folder is a pointer, not a copy. The notes were moved out because they
> carry the owner's own decisions, his money and his words, and those do not
> belong on a public URL.

## Reading them

The private repository needs a token to clone. The token is fine-grained and
scoped to that repository alone, and the clone puts it in a scoped HTTP header
so it never lands in `.git/config`, in the remote URL, or in any commit:

```bash
AUTH=$(printf 'x-access-token:%s' "$GH_TOKEN_NOTES" | base64 -w0)
git -c "http.https://github.com/.extraheader=Authorization: Basic $AUTH" \
    clone https://github.com/markgitme/projectnotes.git
```

**If that clone fails, say so and stop** — do not carry on from a summary as if
the notes had been read. A missing document that is not noticed is worse than
one that is.

## What is in there

| File | Read it before |
|---|---|
| `project-state.md` | changing anything structural — the current page set, the naming, the placeholders still to change, the roadmap order, the domain situation, and the traps that cost time |
| `measurement-panels.md` | building or debugging any measurement panel — the verdict block, physical presses vs auto-repeat, lock state, drag geometry, the latency rule |
| `publishing.md` | pushing, token work, or a hosting change — the PAT recipe, the permission map, the write probe, the Cloudflare cutover order |
| `sandbox-environment.md` | running a headless browser test or deploying — Playwright paths, what headless Chrome cannot verify, the release loop |
| `monetisation.md` | touching ads, analytics, bylines, dates or schema — the two approval bars and the byline/date rules |
| `MIGRATION.md` | once — where every note came from when the memory topics were moved into the repositories, and what was dropped and why |

## What is still here, and public

| File | What it is |
|---|---|
| `CHANGELOG.md` | every release, what changed and why — the authoritative history |
| `GAMEPAD.md` | the locked scope and build order for the third tool |
| `GO-LIVE.md` | the go-live checklist |
| `checks/` | the test suite — `./checks/run_all.sh` before every release |
| `README.md` | the project README — layout, checks, credentials, publishing, review mode |
