# Publishing InputScope to GitHub

> How to push this project to GitHub — fine-grained PAT scopes, the read-only
> misclick, the push script, GitHub Pages as a permanent host, and the
> credentials rules.
>
> Read before any push, token work, or hosting change.

## The push path

```bash
export GH_TOKEN=<fine-grained PAT>
cd /workspace/inpscp
./push-to-github.sh https://github.com/markgitme/inpscp.git
```

`push-to-github.sh` (in the repo root):

- renames the branch to `main` if needed
- sets/updates the `origin` remote
- pushes the branch **and all version tags** (`--tags`) — the tags ARE the
  restorable release history
- verifies with `ls-remote --heads --tags`
- the token goes through
  `git -c "http.https://github.com/.extraheader=Authorization: Basic $AUTH"`, so it
  is **never** written to `.git/config`, the remote URL, or the commit history

**A push is a release.** Only push when the owner asks for it in that
conversation. The remote is the production branch for GitHub Pages.

## Fine-grained PAT gotcha — reads look fine, writes don't

**Symptom:** `git push` → `remote: Permission to markgitme/inpscp.git denied to
markgitme. fatal: ... 403`, while `GET /repos/{owner}/{repo}` returns
`permissions: {admin: true, push: true, pull: true}` and `/user` returns the
right login. Looks like a git problem; it isn't.

**The `permissions` block is the USER's role on the repo, not the token's
scope.** A token with write access to one repository still reports `admin: true`
on every public repository, and a GET returns 200 on all of them.

**The probe that settles it — pick the one that tests the right permission:**

| Probe | Tests | Result when the scope is wrong |
|---|---|---|
| `PATCH /repos/{owner}/{repo}` (description) | **Metadata** | 403 even when the token CAN push — Metadata is read-only by default. **Misleading probe; do not use it to judge push access.** |
| `PUT /repos/{owner}/{repo}/contents/{path}` | **Contents** | 403 — this is the honest probe, same permission a push uses |
| `git push --dry-run` | **Contents** | The most faithful probe of all — it asks the server exactly what a push would ask |

**Never probe by writing to the default branch.** Writing to `main` creates a
remote commit the local repo doesn't have, and the next push is then rejected:
`! [rejected] HEAD -> main (fetch first)`. Probe on a throwaway branch, or skip
the probe and just push. If you already polluted `main`, the fix is
`git push --force -u origin HEAD` — safe when the extra commits are your own
throwaway ones.

**The full permission map for a fine-grained PAT:**

| Operation | Permission needed |
|---|---|
| `git push` / `PUT /contents` | **Contents: Read and write** |
| `PATCH /repos/…` (set description) | **Metadata: Read and write** (separate; read-only by default) |
| `POST /repos/…/pages` (enable GitHub Pages) | **Administration: Read and write** |
| `DELETE /repos/…` (delete a repo) | **Administration: Delete repository** |

**Why reads looked fine:** the repo is **public**, so reads succeed for any
authenticated token regardless of its repository selection. Only writes are
scoped.

**Three misclicks that cause it:**

1. Repository access set to **"Public repositories (read-only)"** — reads
   everything, writes nothing.
2. "Only select repositories" and the target repo **not ticked** (or ticked
   before it existed — fine-grained tokens do NOT auto-acquire newly created
   repos).
3. **Repository permissions → Contents left at "Read-only"** instead of "Read
   and write".

**Key fact: editing a fine-grained token's permissions does NOT change the
token string.** A token the user already pasted can be reused — no need to paste
a new one, no need to regenerate. Fix the scopes, re-run the push with the same
`${GH_TOKEN}`.

**Why HTTPS and not SSH:** the sandbox has no persistent `~/.ssh` and the
workspace is session-scoped, so an SSH keypair would not survive and would have
to be added to the GitHub account by hand. HTTPS + a scoped PAT is the one-step
path.

## The current tokens' blast radius

There are **two** fine-grained tokens in the secret store, deliberately kept
apart:

| Secret | Write-scoped to | Used for |
|---|---|---|
| `GH_TOKEN` | `markgitme/inpscp` only | this project |
| `GH_TOKEN_URSIFT` | `markgitme/ursift` only | the side project |

A dry-run push with `GH_TOKEN` to `markgitme/ursift` is refused (403 "Resource
not accessible by personal access token") and accepted for `inpscp`; the same
probe with `GH_TOKEN_URSIFT` is accepted for ursift. The other four public
repos are readable but not writable by either token. **Use the right token for
the repo, and never echo either one.**

## Credentials rules

- **Never store the raw token in memory.** Use the `secret` tool: `secret create
  --name=GH_TOKEN --value=…` — encrypted at rest, referenced as `${GH_TOKEN}` in
  bash.
- The chat transcript still holds whatever the user pasted. **Always tell them
  to revoke the token after the push** at
  https://github.com/settings/personal-access-tokens
- `$GH_TOKEN` is injected into **every** bash call, so a careless `echo` prints
  it. That is how a token leaked into a transcript once.
- `gh` CLI is **not installed** in the sandbox. No global git config, no stored
  git credentials.
- No GitHub connector/App exists in the mcode-tools catalog. Git over HTTPS
  works fine — only auth was missing.
- Manual alternative if the user wants the token to never leave their machine:
  download the release zip, extract, then `git init && git add -A && git commit
  && git branch -M main && git remote add origin … && git push -u origin main`
  (plus `git push --tags`).

## GitHub Pages = a permanent home before the domain is ready

`/build/` is gitignored, and the site files sit at the repo root, so **Settings
→ Pages → Source: Deploy from a branch → `main` / `(root)`** serves `index.html`
straight away.

Result: `https://markgitme.github.io/inpscp/` — a real URL that does not expire
like the ephemeral `*.space.minimax.io` previews. All asset paths are relative,
so it works at any sub-path. Switch it off later once Cloudflare Pages +
`inputscope.app` are live.

**The Pages rebuild is not instant.** The first check, about a minute after a
push, served the **old** build — and it looked as if the push had failed. It had
not; the deploy was still running. **Wait and re-check before concluding a push
did not land** — a stale Pages build is the normal first response, not a
failure.

**Remember the `edit`-tool race:** twice now, a `git add -A && git commit` in the
same turn as an `edit` tool call reported "nothing to commit, working tree
clean" while the file *was* changed. The working tree was correct; the index was
stale. Fix: `git add <file>` then commit in a **separate** call, and verify with
`git log origin/main..HEAD` rather than trusting the commit output.

## Cloudflare Pages naming + the cutover step

**The GitHub repo name is invisible to visitors.** Three independent name layers:

| Layer | Set by | Value | Visible to visitors? |
|---|---|---|---|
| GitHub repo name | owner | `inpscp` | ❌ no |
| Cloudflare Pages **project name** | owner, **at project creation** | `inputscope` | → `inputscope.pages.dev` |
| Cloudflare **custom domain** | owner, any time | `inputscope.app` | ✅ the real URL |

Cloudflare's docs, confirmed: *"Optionally, you can customize the Project name
field. It defaults to the GitHub repository's name, **but it does not need to
match**. The Project name value is assigned as your `*.pages.dev` subdomain."* → so
the repo can stay `inpscp` while the project is named `inputscope`.

**Gotcha: the `*.pages.dev` subdomain is immutable.** *"*.pages.dev subdomains
currently cannot be changed. If you need to change your *.pages.dev subdomain,
delete your project and create a new one."* If `inputscope.pages.dev` is taken,
Cloudflare appends random characters. Harmless — the custom domain is what
matters.

**Custom domain requirement:** *"To deploy your Pages project to a custom apex
domain, that custom domain must be a zone on the Cloudflare account you have
created your Pages project on."* → buy `inputscope.app` at Cloudflare Registrar,
same account, and it just works. Certificate is automatic.

**The cutover step that must not be skipped.** Until GitHub Pages is off, **two
hosts serve identical content**. The site's canonical is **relative** — verified
in the built HTML: `<link rel="canonical" href="index.html">` and `<meta
property="og:url" content="index.html">`. Relative means each host
self-canonicalises, so Google sees two copies each claiming to be canonical and
has to pick — splitting the signal on the exact domain being established.

**Order on the day the domain goes live:**

1. Cloudflare Pages up at `inputscope.app`
2. **Repo → Settings → Pages → Source: `None`** (kills the duplicate)
3. Optional: Cloudflare **Bulk Redirects** `<project>.pages.dev` →
   `inputscope.app`

**Also worth knowing:** the site uses relative asset paths throughout, so it
works at any sub-path or host without rewriting anything. `_headers` and
`ads.txt` are already in the published build files, and Cloudflare Pages reads
`_headers` automatically.

## Reading the repo back in a fresh session — no token needed

`markgitme/inpscp` is a **public** repo, so a plain unauthenticated clone works:

```bash
git clone https://github.com/markgitme/inpscp.git inpscp
```

No PAT, no `secret`, no `gh` CLI. This is the fastest way to restore the project
when the sandbox volume is empty (a new chat = a new session id = a new empty
mount). **A PAT is only needed to push, never to read.**

**Restore-and-publish loop that worked:** clone → `./build.sh --clean` → serve
on `python3 -m http.server 8899` → Playwright check every page for console
errors → secret scan (`ghp_`/`github_pat_`/40-hex/`sk-`/`AIza` — now
`checks/scan_secrets.py`) → `website_deploy path=<repo>/build
source_path=<repo>` → curl every route on the live URL.

## Repo facts

- Owner account `markgitme` (created 2024-08-07). Public repos: `inpscp` (this
  project), `ursift` (the side project), `inputscope` (legacy duplicate),
  `mousetestsite`, `my-first-website`.
- GitHub's unauthenticated API from this sandbox IP is rate-limited (HTTP 403).
  Use `git ls-remote` or an authenticated call instead of `api.github.com` for
  repo checks.

## The sibling repos — leave them alone

- `markgitme/inputscope` — the **legacy** duplicate of this project. Everything
  in it is already in `inpscp`. It still has Pages enabled at
  `https://markgitme.github.io/inputscope/`, so **two hosts serve identical
  content** and the relative canonical splits the signal. Delete it, or point
  its Pages source at `None`, before the domain goes live.
- `markgitme/mousetestsite` — an earlier, separate project ("MousePulse"), a
  single `index.html`, different design and copy. It has a Google Search Console
  verification tag and **no ads, no analytics**. The owner has decided to leave
  it alone. Noted so a future session does not treat it as part of this project
  or try to "fix" it.

## Open recommendation — rename `inpscp` → `inputscope`

Not yet actioned. The repo name is invisible to visitors, but the **Pages URL
is a public URL**, and `…/inpscp/` reads as a typo on a site whose whole
proposition is trust. A rename changes the Pages URL, so it is cheapest to do
it before anything indexes.

**Caveats to check first:** a fine-grained PAT scoped to a repository may need
re-ticking after a rename, and the two doc lines naming the repo need flipping
back. The Cloudflare Pages **project name** does not have to match the repo
name — it is assigned to the `*.pages.dev` subdomain and is chosen at project
creation.
