# Changelog

All notable changes to InputScope. Versions are tagged in git and archived as zips.

## v1.3.5 — 2026-10-27

### Fixed

- **The drag test's instruction text ran through the target zone.** The hint
  was centred across the whole track, so it overlapped the dashed target box
  and made the "target" label inside it unreadable. It now sits in a strip
  along the top of the track, and fades out the moment you start dragging —
  the instruction is only useful before the first attempt.
- **The drag accuracy test could never score a good result.** The block
  followed the pointer by its top-left corner while the measurement compared
  the centres of the block and the target, which put a permanent 28px bias on
  every drop. A pixel-perfect landing read as 28.3px — "bad" — because the
  thresholds start at 20px. The block now follows the pointer by its centre,
  so what you aim with the cursor is what gets measured. A drop on the target
  centre now reads about 1px, 12px off reads "warn", and a drop in the corner
  reads "bad".
- The green block started in the very corner on first load but moved to the
  middle when the reset button was pressed, so the two states disagreed. Both
  now place it the same way.
- The drag panel's placeholder note said "drag the slider onto the marker"
  while everything around it calls it a block and a target zone.

## v1.3.4 — 2026-10-27

### Changed

- **Scrolling now lights the scroll wheel in its own colour.** Middle-clicking
  the wheel and rolling the wheel are two different actions on two different
  parts of the mouse, and the diagram now shows that: pressing the wheel in
  glows blue, rolling it glows amber. Previously the wheel only lit at all for
  a middle click — scrolling lit the "Scroll" counter but left the mouse
  diagram untouched.
- The "Scroll" indicator lamp is now amber to match the wheel, so the lamp and
  the diagram agree. The colour scheme across the mouse is now one meaning per
  colour: green for left and right clicks, blue for middle click, amber for
  scrolling, violet for the side buttons.

### Note

- A `.m-wheel.is-scroll` style already existed in the stylesheet for exactly
  this purpose, but nothing ever applied it — the rule was written and then
  left unwired. It has been given the amber treatment and connected to the
  scroll handler.

## v1.3.3 — 2026-10-27

### Fixed

- **The "Keys pressed" counter counted auto-repeat.** Holding a key down
  flooded the counter with the operating system's repeat events — about thirty
  per second — so one physical press could read as forty. The counter now
  counts one press per physical press, which is what the label claims and what
  the event log beside it already showed. The two were contradicting each
  other: the log recorded one line, the counter said forty.
- **The response latency test counted auto-repeat as extra presses.** Holding
  the target key filled the sample set with dozens of duplicate measurements
  of a single press, corrupting the average and flattening the jitter figure.
  Auto-repeat is now ignored there too, so the measurement reflects presses
  rather than the length of a hold.

### Added

- **An "Auto-repeat" reading** on the key tester. It stays at "None" unless the
  operating system repeats a key you are holding, and then shows how many
  repeats and on which key ("24 × A"). The behaviour is now explained by the
  panel instead of silently inflating a number.
- **A "Double-fires" reading**, with a matching log line. A key that sends two
  keydown events with no keyup in between is a chattering switch, and the
  tester now reports it by name rather than relying on the raw counter to
  reveal it by accident.

### Changed

- The key tester's copy now describes what the page actually does. It
  previously promised "two flashes from one press", which the code never
  implemented — the cap lights while a key is held, it does not flash. The
  FAQ entry, its schema copy and the two prose references were all updated
  to match, and to explain that holding a key is not counted as extra
  presses.

## v1.3.2 — 2026-10-27

### Fixed

- **The lock key indicators never lit up.** The Lock Key State panel on
  Keyboard Check read the lock state from `navigator.getModifierState(...)`,
  which is not a real API — it does not exist on `Navigator` in any browser.
  The call was guarded by a truthiness check, so it failed silently and the
  state was permanently `false`. Every lamp sat dark and every pill read
  "Off" no matter which lock key you pressed.
  The correct API is `KeyboardEvent.getModifierState('CapsLock' | 'NumLock' |
  'ScrollLock')`, which is only readable while an event is being dispatched —
  there is no pollable equivalent, so the old 400ms interval could never have
  worked either. The state is now read off every keydown and keyup, and the
  DOM is only rewritten when a lock actually flips so the typing-speed test is
  not paying for a redraw on every keystroke.
- **The contact page scrolled sideways by 3px at 360px wide.** hCaptcha's
  widget is a fixed 303px iframe that could not shrink inside the panel. The
  iframe is now capped at 100% of its container, so the page no longer
  overflows on narrow phones.

### Changed

- The lock panel's labels ("Caps Lock", "Num Lock", "Scroll Lock") no longer
  wrap mid-phrase — the name sits on its own line with the lamp and the
  On/Off pill below it.
- The note under the lock panel now explains that not every keyboard has every
  lock. Most laptops fold Num Lock and Scroll Lock into the Fn layer, and
  macOS keyboards have neither, so on a Mac those two lamps will always read
  "Off" — which is correct, not a fault.

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
