# InputScope

Browser-based mouse and keyboard diagnostic tools. Static site — plain HTML, CSS and
JavaScript. No build step, no dependencies, no framework.

## Live

- Preview: `https://m1k82v5yhxugy.space.minimax.io`
- (This URL is a temporary CDN preview. A real domain is bought later and pointed here.)

## Layout

```
index.html            Main page — overview, tool cards, problem shortcuts, FAQ
mouse-check.html      Mouse Check tool
keyboard-check.html   Keyboard Check tool
about.html            About the project, editorial policy, revision log
contact.html          Contact form (opens the visitor's mail client, no backend)
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
```

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
2. **The contact email.** `hello@inputscope.com` appears in `contact.html`,
   `privacy.html` and `terms.html`. Currently a placeholder.
3. **`ads.txt`.** Contains comments only. When the AdSense account is approved, paste
   the real line from the AdSense dashboard in place of the placeholder comment.
4. **Ad units.** Deliberately not added. Ads belong on the informational pages only —
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
