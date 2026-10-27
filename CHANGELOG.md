# Changelog

All notable changes to InputScope. Versions are tagged in git and archived as zips.

## v1.3.1 — 2026-10-27

### Changed

- **Headset Test is now first in the roadmap**, with Gamepad Test second. Display
  Test, Webcam Test and the "More to come" placeholder are unchanged.
- **The Headset Test tag reads "In development"** instead of "Planned", so the
  first card on the list no longer claims the same status as the ones behind it.
  "Working" was rejected as a claim the build does not support yet — the tool
  does not exist, so "In development" is the honest word.
- The About page's "What is next" list reordered to match, so the two pages do
  not contradict each other. The "Recently" table was left alone — it is a
  record of what was published, not a current status list.

## v1.3.0 — 2026-10-27

### Changed

- **The owner has a name.** The About page H1 is now "Hi, I'm Mark." instead of
  the `[Your name]` placeholder.
- **The AI disclosure is now stated, not confessed.** The "How it was built"
  section previously opened with "I should be upfront about this", which framed
  the disclosure as an apology. It now opens with a flat factual sentence — "The
  code was written with AI assistance" — and pairs it with the part that
  actually matters for a trust product: the implementation is reviewed line by
  line, and every measurement is checked against real hardware before it ships.

  The wording follows two published examples of sites that disclose AI use
  without apologising for it: Steven Hylands' about page (a one-line tools
  list: "Claude Code — Builds most of my software, including this site") and
  Graaft's footer ("All imagery and video on this site is AI-generated and
  human-edited"), whose essay argues that "the 'human-edited' half of the
  disclosure is doing real work — it names the person responsible."

### Why the disclosure stays at all

Checked against current policy: Google's AI labelling rules apply to **ad
creatives**, not to site content, and the old AdSense in-content disclosure
clause was removed in February 2025. Nothing requires the disclosure. It stays
because the product is trust, and a diagnostics site that a visitor later
discovers was built differently has a credibility problem that a site whose
product is honesty does not have.

## v1.2.0 — 2026-10-27

### Changed

- **About page rewritten as a personal page.** It read like a product page; it now
  speaks in the first person, says who runs the site, why it was made, and openly
  states that the code was written with AI assistance. Also drops the
  company-flavoured "editorial policy" framing for plain language.
- **Contact page now posts to Web3Forms** instead of opening the visitor's mail
  client. Visitor's name (optional), email, subject and body go straight to the
  owner's inbox; the reply address is set automatically so "Reply" comes back to
  the sender. hCaptcha is wired in for spam protection, and the subject line is
  branded "InputScope — …" before sending.
- **Privacy policy gained a section on the contact form** — what is collected, why,
  and that Web3Forms, CleanTalk, Akismet and hCaptcha are involved. The "no data
  collected" claim was no longer true and now reads accurately.
- **Footer line softened everywhere** to "The tools collect nothing. The contact
  form is the exception." The home page FAQ now says the same thing.
- **Roadmap narrowed.** Touchpad Test and Printer Test removed from the coming-soon
  grid — there is no real device on the desk to test them against. Gamepad, Headset,
  Display and Webcam remain, plus a full-width "More to come" placeholder.

## v1.1.0 — 2026-10-27

### Added

- **"More coming soon" roadmap** on the home page — six planned diagnostics
  (gamepad, touchpad, headset, display, webcam, printer) with a note that each
  will run locally in the browser. Signals to visitors and to ad-network
  reviewers that the site is actively expanding rather than abandoned.
- Roadmap noted in the About page's revision log and project description.

### Changed

- Removed the closing "Start with the mouse" call-to-action band from the home
  page — the hero already carries both tool buttons, so it was redundant.

## v1.0.0 — 2026-10-27

First complete build. Site published to a temporary preview URL.

### Tools

- **Mouse Check** — interactive top-down mouse diagram that lights up the physical
  button you press (left, right, wheel, and two thumb-button tabs), with LEDs,
  per-button counters and a timestamped event log. Context menu is suppressed inside
  the display so right-clicks register.
  - Quick checks: pointer precision, double-click speed, polling rate.
  - Advanced (collapsed): drag accuracy, scroll encoder, motion smoothness,
    hover response, acceleration curve.
- **Keyboard Check** — live key map that lights up every key, with stuck-key
  detection and an event log.
  - Quick checks: typing speed and accuracy, physical layout detection
    (US QWERTY / QWERTZ / AZERTY / Dvorak), key rollover depth.
  - Advanced (collapsed): lock key state, response latency.

### Site

- Home page with tool cards, a "common problems" shortcut grid, a reference table of
  healthy measurement ranges, and an FAQ.
- About, contact, privacy and terms pages.
- Dark theme design system, no dependencies, no build step.

### SEO

- Unique title, meta description, canonical and Open Graph tags per page.
- JSON-LD: `WebSite`, `Organization`, `SoftwareApplication` (per tool) and
  `FAQPage` on all three content pages.
- `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, generated OG image.
- "Common problems" sections on both tool pages, with the search query as the
  heading, plus a problem-shortcut grid on the home page.

### Development

- Review mode: click any element on the live site to attach a numbered note, then
  export the batch as Markdown with CSS selectors. Notes persist in `localStorage`.
  `Alt+R` toggles capture. Invisible to ordinary visitors.
- `build.sh` stages a clean deployable copy without the git history or dev notes.
