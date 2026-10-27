# Changelog

All notable changes to InputScope. Versions are tagged in git and archived as zips.

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
