# InputScope

Browser-based mouse and keyboard diagnostic tools. Static site — plain HTML, CSS and
JavaScript. No build step, no dependencies, no framework.

## Live

- GitHub Pages: `https://markgitme.github.io/inpscp/` — permanent, rebuilds from
  `main` on every push.
- The real domain (`inputscope.app`) is not bought yet and is pointed here when
  it is.

## Layout

```
index.html            Main page — overview, tool cards, problem shortcuts, FAQ
mouse-check.html      Mouse Check tool
keyboard-check.html   Keyboard Check tool
about.html            About the project — a personal page: who runs it and why
contact.html          Contact form (posts to Web3Forms, which forwards to the inbox)
privacy.html          Privacy policy
terms.html            Terms of use
404.html              Not found

assets/
  css/style.css       Design system + all page and tool styles
  css/review.css      Review-mode overlay styles
  js/site.js          Shared behaviour: mobile nav, footer year, copy buttons
  js/review.js        Review mode: element annotation + markdown export
  js/mouse.js         Mouse Check: click tester, precision, drag, scroll, polling…
  js/keyboard.js      Keyboard Check: key map, typing, layout, rollover, latency
  favicon.svg         Brand mark
  og-image.png        1200×630 social share image

robots.txt            Crawl rules + sitemap pointer
sitemap.xml           XML sitemap (currently points at the placeholder domain)
ads.txt               AdSense publisher record — placeholder, see below
manifest.webmanifest  PWA manifest

checks/               The test suite — run ./checks/run_all.sh before every release
  README.md           What each check catches, and why it exists
  run_all.sh          Builds the site, serves it, runs everything

docs/notes/           A pointer to the working notes, which live in a private repo
  README.md           Where the notes are, how to read them, what is in them
```

## Checks

```bash
./checks/run_all.sh
```

Builds the site, serves it, and runs the whole suite: links and anchors, the
visible FAQ against its schema, the document structure of the long guides, the
unit line on every reading, the byline dates against the schema dates, the
structural and accessibility audit, and the browser tests that drive the two
tools for real.

Every check exists because something specific broke. `checks/README.md` lists
what each one catches. Run it before every release, not after.

## Working notes

The notes that used to live in a chat assistant's memory now live in a
**private repository**, `markgitme/projectnotes`, under `inpscp/docs/notes/` —
the same paths they occupy here, so the mapping is one to one.

```bash
AUTH=$(printf 'x-access-token:%s' "$GH_TOKEN_NOTES" | base64 -w0)
git -c "http.https://github.com/.extraheader=Authorization: Basic $AUTH" \
    clone https://github.com/markgitme/projectnotes.git
```

They cover the current state and the naming, how to build a measurement panel
that does not lie, how to publish and deploy, how to run the headless tests,
the monetisation research, and a ledger of where every note came from.

**`docs/notes/README.md` here is a pointer, not a copy.** If the clone fails,
say so and stop — do not carry on from a summary as if the notes had been read.

## Credentials

**This site has no API keys.** It is static HTML, CSS and JavaScript — no
server, no database, no third-party analytics, no cookies. Nothing a visitor
loads can leak a key, because there is nothing to leak.

Two things are credential-shaped, and neither is in this repository:

- **The GitHub token** used to push. It lives in the agent's encrypted secret
  store, is injected as `$GH_TOKEN` at command time, and is never written to a
  file, a commit or the repository. It is fine-grained and scoped to the
  repositories it needs and nothing else — this repository for the site, a
  separate token for the side project, and a third for the private notes
  repository. Revoke them when the working session ends.
  - **Editing a token's repository access does not change its token string**, so
    a token that is already in the secret store starts working the moment a
    repository is ticked — no new paste, no new token.
- **The Web3Forms access key** in the contact form. Web3Forms states plainly
  that this key is public and is meant to sit in client-side HTML: *"No. You
  do not need to hide access key. Access key is public."* It is an alias for
  an email address, not a secret. What protects the form is domain
  restriction and a captcha, both on the go-live list.

**If this project ever needs a key:** put it in the encrypted secret store,
never in a file. A static page cannot read a `.env` file and `process.env`
does not exist in a browser — anything the page needs ends up in the served
HTML where every visitor can read it. `.gitignore` also ignores the usual
secret file names, and `checks/scan_secrets.py` fails the release if anything
secret-shaped reaches the tree or the history.

## Publishing

`build.sh` copies the deployable site into `./build/` and strips the development
files, so the public site never contains the git history, this README, or the
helper scripts.

```bash
./build.sh          # refresh ./build/
```

Then deploy `./build/` as the site root and this directory as the source root.

## Cloudflare Pages setup

The intended production host. Connect the GitHub repo and set:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `./build.sh` |
| Build output directory | `build` |
| Root directory | *(repo root, or `/` if the repo contains this folder)* |

That is the whole configuration — there is no npm install and no dependency
step, so builds finish in a couple of seconds.

**Custom domain:** Cloudflare Pages → your project → Custom domains → add the
domain. If the domain was bought through Cloudflare Registrar the DNS record is
created for you automatically. SSL is issued automatically, and Cloudflare
provides a permanent certificate.

**Two things that will bite you if nobody tells you:**

1. **Allow AdSense's crawlers.** Cloudflare's Bot Fight Mode and WAF rules
   challenge Google's crawlers, which can make AdSense report "invalid traffic"
   or refuse to crawl the site. Add a WAF rule that *skips* the security checks
   for `Googlebot`, `AdsBot-Google` and `Mediapartners-Google`, or set Bot
   Fight Mode to off for those verified bots. This is the single most common
   reason a Cloudflare-hosted site fails AdSense review.
2. **Cloudflare Web Analytics sets cookies.** If you turn it on, the privacy
   policy has to say so. The site currently promises that no cookies are used
   and no analytics run, and `privacy.html` reflects that. Either leave
   analytics off, or update the policy first.

`_headers` (in the repo root, copied into the build output) sets sensible cache
and security headers. It is inert unless the site is served by Cloudflare Pages.

## Before going live — placeholders to change

1. **The domain.** `sitemap.xml` and `robots.txt` both point at `https://inputscope.com`.
   Replace with the real domain once it is bought.
2. **The Web3Forms access key.** `contact.html` has `YOUR_ACCESS_KEY_HERE` as the
   `access_key` value. Get one at web3forms.com by entering the inbox that should
   receive submissions. The key is public by design (an alias to the inbox), so it
   is safe to commit. Then switch hCaptcha on for that form in the Web3Forms
   dashboard — the markup is already in place.
3. **The contact email.** `hello@inputscope.com` appears in `privacy.html` and
   `terms.html`. Use whichever address you actually want to be reachable at.
4. **`ads.txt`.** Contains comments only. When the AdSense account is approved, paste
   the real line from the AdSense dashboard in place of the placeholder comment.
5. **Ad units.** Deliberately not added. Ads belong on the informational pages only —
   never inside a measurement surface, because a layout shift mid-test corrupts the
   readings. See `terms.html` and `privacy.html` for the wording that already
   promises this.

## Publishing to GitHub

`push-to-github.sh` pushes this directory to a GitHub repository. It uses a
fine-grained token through a scoped HTTP header, so the token is never written
to `.git/config`, the remote URL, or the commit history.

```bash
export GH_TOKEN=github_pat_...      # one repo, Contents: Read and write
./push-to-github.sh https://github.com/YOUR_USER/YOUR_REPO.git
```

To publish without handing over a token, download the release zip, extract it
and push it yourself:

```bash
git init && git add -A && git commit -m "v1.0.0 — initial release"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Either way, free hosting is one click away: **Settings → Pages → Source: Deploy
from a branch → `main` / `(root)`.**

### The token recipe (fine-grained PAT)

**One token per working session — not one per update.** The agent encrypts it into a
secret store, reuses `${GH_TOKEN}` for every push in that session, and the token is
revoked when the session ends.

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained
tokens** → Generate new token:

| Field | Value |
|---|---|
| Expiration | 30 days (or 90 — it is revoked manually anyway) |
| **Repository access** | **Only select repositories** → tick `inpscp` |
| **Repository permissions** | **Contents → Read and write** |
| Account permissions | leave empty |

**The two misclicks that cause a 403 on push:**

1. Repository access left on **"Public repositories (read-only)"** — this reads every
   public repo and writes none. It *looks* like it works, because the repo is public
   and every read succeeds. Only the push fails.
2. **Contents left on "Read-only"** instead of "Read and write".

Symptom of either: `remote: Permission to … denied` / `403`, while `GET /repos/{owner}/{repo}`
still reports `push: true` — that field is the *user's* role on the repo, not the token's
scope. Confirm with a write probe: `PATCH /repos/{owner}/{repo}` → `Resource not accessible
by personal access token` means the scope is wrong, not the git.

**Editing a token's permissions does not change its token string**, so a token that
already failed can be fixed in the UI and reused without pasting a new one.

**Rules:**
- **Never a classic PAT** (`ghp_…`) — those grant access to everything on the account.
- **Never commit the token**, put it in the remote URL, or let it into `.git/config`.
  The script's scoped-header method already prevents all three.
- **Revoke when the session ends** — a pasted token sits in the chat transcript.
- `gh` CLI is not available in the sandbox; git-over-HTTPS is the only path.

**Once Cloudflare Pages is connected to this repo, every push rebuilds and redeploys
the live site automatically.** There is no separate publish step.

## Review mode

For iterating on the live site without needing a code change:

- Open any page with `?review=1` → review mode arms.
- Click any element → a numbered note editor appears, pinned to that element.
- Notes persist per page in `localStorage` and survive a reload.
- **Copy notes** exports Markdown: element label, CSS selector, text snippet, note.
  Paste that back to have changes applied.
- `Alt+R` arms and disarms capture, so the page stays usable for testing.
- `?review=0` force-disables it and clears the "seen it before" flag.
- Visitors never see any of it — the toggle only appears after `?review=1` has been
  used once in that browser.

## Gotchas worth remembering

- All asset and page links are **relative** (`assets/css/style.css`, `mouse-check.html`).
  The site works whether it is served from a domain root or a sub-path. Do not
  introduce absolute paths.
- The review-mode LEDs sit *outside* the clickable stage element, so they must be
  queried at document level. Scoping the query to the stage silently fails.
- Log timestamps are 24-hour `HH:MM:SS`; `toLocaleTimeString()` 12-hour output wraps
  in the narrow log column.
- `setOut()` applies tone classes to `.mini-results__v` as well as `.tile` children.
- Never insert an element between the user and a measurement surface.

## Version control

`git` history lives in this directory. Tags mark releases: `v1.0.0`, `v1.1.0`, …
Releases are also zipped to `../output/` for download.
