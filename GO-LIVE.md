# GO-LIVE.md — InputScope

Everything that has to happen before `inputscope.app` goes live, in order.
Written 27 Oct 2026 at v1.4.2. This file lives in the repo, so it travels with the code.

---

## The order of operations (this is the important bit)

```
1.  Build the "form can fail" fix          ← code, do it before anything goes live
2.  Add author + dates + Person schema     ← code, 1 hour
3.  Buy inputscope.app                      ← starts Raptive's 6-month clock
4.  Register at web3forms.com, get the key  ← then paste the key into contact.html
5.  Turn hCaptcha ON in the Web3Forms dash  ← the markup is there, it is not enforced yet
6.  Point the domain at Cloudflare Pages    ← the site goes live
7.  Turn on Cloudflare Web Analytics        ← but ONLY after the privacy policy is updated
8.  Submit the sitemap in Search Console
9.  Publish the guide pages                 ← this is what the waiting months are FOR
10. Wait 2-3 months, then apply to AdSense  ← never before
```

**Steps 3, 4, 5 and 6 happen in the same week.** If the domain resolves while the Web3Forms
key is still the placeholder, the contact form is green and delivers nothing from day one.

---

## Phase 1 — code, before anything is published

### The contact form must be able to fail ⚠️ NOT DONE

With the placeholder key `YOUR_ACCESS_KEY_HERE` still in place, Web3Forms answers
**HTTP 200 with `success: true`** and the message:

> *"It works. Please insert your actual form_id or access_key to receive emails."*

The current handler treats 200 as success and throws the API's `message` away, so a visitor
would see *"Thanks — your message is on its way"* and **nothing would be delivered**. A green
lie is the worst possible failure mode, because nobody notices.

Two acceptable fixes — pick one:
1. **Hard-fail** — treat that message as an error and show a real failure notice.
2. **Gate it** — render a "not configured yet" notice instead of the form until a real key
   exists. Bonus: the site becomes safe to publish before the key lands.

### Author, dates, Person schema ⚠️ NOT DONE

Checked 27 Oct 2026 across all 8 pages: **zero** author markup, **zero** `datePublished` /
`dateModified`, **zero** `Person` schema. The AdSense reviewer's checklist names this
explicitly — *"a visible author and publication date"*. One of the Product Experts quoted in
`adsense-evidence-brief-2026-10-27.md` listed it as a per-page requirement.

### The baseline promise gap ⚠️ NOT DONE

The site copy promises *"run it again in three months and you have a baseline"*. There is no
save/compare. Either build it (localStorage, no accounts) or reword the promise.

---

## Phase 2 — your accounts

| # | What | Where | Notes |
|---|---|---|---|
| 1 | **Buy `inputscope.app`** | Cloudflare Registrar | $8.20, renews $14.20/yr. Google Registry, HTTPS mandatory. At-cost, no markup, keeps DNS on Cloudflare where Pages lives. **This starts Raptive's 6-month clock.** |
| 2 | **Web3Forms** | web3forms.com | Verify your email → get the `access_key`. Free, 250 submissions/month. **The form ID and the access key are the same UUID — one thing to copy, not two.** |
| 3 | **hCaptcha ON** | Web3Forms dashboard | The markup renders but is not enforced server-side until the toggle is on. Matters because the free plan **stops entirely at 100%** rather than degrading — a bot could burn the quota and silently stop real mail. |
| 4 | **Google Analytics 4** | analytics.google.com | Required for Raptive. Also the only way to know if you're near 25k PV. |
| 5 | **Search Console** | search.google.com/webmasters | Add `inputscope.app` as a domain property, submit `sitemap.xml`. |
| 6 | **AdSense** | adsense.google.com | **Do NOT create the account yet.** See Phase 5. |

**One inbox.** Point `hello@inputscope.com` at the same address as the Web3Forms account, or
change it to match your new domain. It appears 4 times: `privacy.html` ×3, `terms.html` ×1.
It is an email address, independent of the domain — keeping `.com` is fine even on an `.app`
site, but matching reads better.

---

## Phase 3 — publishing

**GitHub** — `markgitme/inputscope`, branch `main`, 13 commits, tags `v1.0.0` … `v1.4.2`.
`build.sh` stages the 21 public site files into `build/`.

**Cloudflare Pages** — connect the repo, then:

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | `./build.sh` |
| Build output directory | `build` |

**Domain** — add `inputscope.app` in Cloudflare Pages → Custom domains. It handles the
certificate automatically.

**Then update 8 hardcoded URLs** (2 files):
- `sitemap.xml` — 7 `<loc>` entries
- `robots.txt` — 1 `Sitemap:` line

Canonical and `og:url` are relative and self-adapt. Nothing else needs changing.

---

## Phase 4 — the months in between

The site needs live, indexed, original content before a reviewer has anything to judge.
That is what the waiting months are for — **not** idling.

**The guide pages are the page engine.** One page per symptom, not one page per device.
8 of the top 10 results for a mouse-double-click query are single-symptom pages with the
query in the title. The closest analogue to this site (probecheck.com, a browser diagnostics
site) uses `/troubleshooting/<symptom-slug>/` and opens every guide by routing into the tool.

**The rule for every guide page:** it must contain at least one thing only InputScope can say —
a measurement, a threshold, and what the reading means. That is what "original content" means
in practice, and it is what the AdSense reviewers are looking for. A guide that only restates
wikihow is replicated content and will be treated as such.

**While waiting, do not:**
- add ad code, ad placeholders, or an "AdSense coming soon" banner — the site must look like
  it exists to be useful, not to be monetised
- create the AdSense account early (see Phase 5)
- change the site structure while an application is under review

---

## Phase 5 — monetisation

**AdSense first. Raptive as the fallback.** They are different gates:

| | AdSense | Raptive |
|---|---|---|
| Gate | editorial substance — a judgement call | traffic — a plannable number |
| Traffic bar | none published | 25,000 PV/month |
| Geography | none | ≥50% US/CA/UK/AU/NZ (under 100k PV) |
| Domain age | none (the "6 months" thing is removed folklore) | **6 months, hard** |
| Other | — | GA4 required, original content, flat 75% rev share |
| Review | 2–4 weeks, ~95% of new accounts declined | ~1 week, human |

**Applying to AdSense:**
- Apply only when the guide pages are live and indexed — realistically 2–3 months in
- **Never create the account early.** You have 6 months from account creation to complete
  setup, or the account is deactivated and you start over
- On rejection: fix what they actually named, wait 2–4 weeks so Googlebot re-crawls, then
  re-apply once. No limit on the number of attempts.
- **Never open a second AdSense account** to bypass a rejection — that bans all your accounts
- **Freeze the site during review** — major structural changes or bulk deletions reset the
  reviewer's read and stretch the timeline
- Approval is site-level since March 2024: each new domain needs its own 2–4 week review

**Raptive:** the 6-month clock starts on the **domain registration date**, not launch. If the
domain is bought in November 2026, Raptive opens up in May 2027. It also needs 25,000 PV/month
with the right geography, which is the harder half.

**Full research, with sources and attributions:** `adsense-evidence-brief-2026-10-27.md`.

---

## Cloudflare gotchas

1. **Bot Fight Mode / WAF will get AdSense to report invalid traffic or refuse to crawl.**
   This is the most common reason a Cloudflare-hosted site fails review. Add a WAF rule that
   *skips* security checks for `Googlebot`, `AdsBot-Google`, `Mediapartners-Google` — or turn
   Bot Fight Mode off.
2. **Cloudflare Web Analytics sets cookies.** The privacy policy currently promises the tools
   collect nothing. If analytics is enabled, update the policy *first*.
3. Cloudflare Pages automatically uses the repo's `404.html` as the custom 404 page. One is
   already built.

---

## Never break these

- **Never place an ad unit inside a measurement surface.** Layout shift corrupts the readings.
  Tools never carry ads; only informational pages will.
- **Estimates are always labelled as estimates.**
- **The contact form must be capable of failing.** Never a green success that didn't deliver.
- **The review overlay stays invisible to ordinary visitors** (`?review=1` only, then a
  localStorage flag). Don't share links containing `?review=1`.
- **Roadmap order:** Headset → Gamepad → Display → Webcam. Headset is tagged "In development",
  the rest "Planned". Never tag something "Working" that isn't built — a tag must not claim
  more than the build supports.
- **The AI disclosure stays.** It is stated as fact, not as a confession, and it is paired
  with the human responsibility. Disclosing costs nothing in SEO and is the thing that makes
  the site credible.
- **`inputscope.com` is not ours** — registered 2026-05-23 at Alibaba Cloud, no site, no DNS
  records. Do not try to use it and do not spend time on it.
- **`markgitme/mousetestsite` is a separate earlier project ("MousePulse")**, left alone
  deliberately. It is not part of this project.
