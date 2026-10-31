# Monetisation for the static sites — AdSense and Raptive

> The full evidence brief is also a durable Drive file:
> **`adsense-evidence-brief-2026-10-27.md`** (16 KB, node `456853571461264`).
> This file holds the working rules and the traced evidence.

Read before applying to a monetisation account, writing a guide page, or
answering an AdSense policy question.

## The two bars

- **AdSense judges *editorial substance*.** Policy separates "useful
  functionality" from "publisher content" — a site primarily based on tools can
  still be rejected.
- **Raptive judges *traffic*.** 25,000 PV/month, ≥50% US/CA/UK/AU/NZ under 100k
  PV, domain ≥6 months, GA4 required, flat 75% share, ~1 week human review. A
  plannable number beats an unarguable judgement for a new site.

**More tools does not solve the AdSense page-count problem.** The answer is
original editorial prose.

## Traced evidence — the quotes, and who said them

**Quote 1** — *"There is also an important distinction between useful
functionality and publisher content…"* — thread
`support.google.com/adsense/thread/450801723`, **Silver Product Expert,
14 Jul 2026** (a community volunteer, **not Google staff**). The same post lists
the per-page checklist: permanent indexable URL, 200 response, full text in
server-rendered HTML, unique title + meta, **"a visible author and publication
date"**, internal links, no interaction requirement.

**Quote 2** — *"your site offers known facts, so adds no value to what can
already be found on the web…"* — thread
`support.google.com/adsense/thread/454368122`, **busterjet — Diamond Product
Expert, 25 Jul 2026**, also a volunteer. ⚠️ An earlier attribution to thread
`449905027` was **wrong** — the search engine's extracted "content" field merged
threads.

**Cite the official policy pages, not the forum:**
answer/81904 · answer/10015918 · answer/1348737 · answer/23921 ·
adsense.googleblog.com/2011/01/adsense-facts-fiction-part-v-unoriginal.html

## The competitor ad-stack teardown

**onlinemictest.com serves Raptive's ads, not AdSense's.** Its `ads.txt` has
`managerdomain=cafemedia.com`, `contact=info@raptive.com`, and
`google.com, pub-8501674430909082, RESELLER` — they hold an AdSense account used
as a **demand partner inside Raptive's header bidding**, not a direct tag. Live
page: **0** `ins.adsbygoogle`, **0** `pagead2.googlesyndication`, 22 adthrive
refs, iframes from `ads.adthrive.com`, zones `pub_300x250`/`pub_728x90`.

## Byline, dates and schema — a Search signal, NOT an AdSense requirement

`support.google.com/adsense/answer/23921` requires only unique, relevant content
and no doorway pages — **no byline, no dates, no author schema.** The byline
guidance is Google's **Search** helpful-content guidance
(`developers.google.com/search/docs/fundamentals/creating-helpful-content`):
*"Do pages carry a byline, where one might be expected?"* and *"We strongly
encourage adding accurate authorship information"*.

- A byline is wanted **where one might be expected** — not on
  privacy/terms/404/contact.
- **The published date is the launch date and never moves.**
- The **updated** date moves only when the content changes in a way a reader
  would notice — not for a rewording, a heading level or a schema edit.
- The visible byline and the schema dates must agree.
- **Fixed in InputScope v1.17.0**: `index`, `mouse-check` and `keyboard-check`
  carry a visible byline plus `author`, `datePublished` and `dateModified`
  against a `Person` node; the troubleshooting documents keep their byline;
  `about.html` keeps its standalone `Person` schema. Enforced by
  `checks/check_bylines.py`.

## The page engine — one document per DEVICE

The one-page-per-symptom plan shipped as v1.5.0 (10 guide pages), then Mark saw
nine thin pages in a browser and changed it: *"one big, document-like page with
everything about the mouse, separated by few spaces. No clickable links to any
issues just to create new pages."*

One long document per device is what a reviewer calls editorial substance, and it
still targets every symptom because each is an H2 with its own threshold table and
fix. **Keep this shape for the Headset, Gamepad, Display and Webcam tests — not
one page per fault.**

Every guide page must carry at least one thing only this site can say — a
measurement, a threshold, and what the reading means. **A guide page must never
restate what is already on the web.**

## Timing and account rules

- AdSense has **no domain-age rule** — the "6 months" figure is folklore.
- **Do not create the AdSense account early** — 6 months without completing setup
  deactivates it.
- **Never open a second account to bypass a rejection** — that bans all accounts.
- Wait **2–4 weeks** after substantive fixes so Googlebot re-crawls, apply
  **once**, and freeze the site during review.
