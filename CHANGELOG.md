# Changelog

All notable changes to InputScope. Versions are tagged in git and archived as zips.

## v1.14.0 — the right button can only be pressed by a right click

### Fixed

- **A left click can no longer light the right button area.** The two areas
  under the trackpad were press targets that reported the button you pressed
  them with, so clicking "right" with a left mouse produced a right click that
  never happened — a false reading in the Button readout and in the log. They
  are indicators now, not buttons: they show **the button the browser
  reported**, wherever the press landed. Only a real right-click — the
  physical right button, or a trackpad's two-finger tap — lights the right
  one. A browser cannot tell a tap from a press of the physical button, so
  button 0 lights the left area either way, and the copy says so.

- **The Pointer response check no longer reads like a trackpad measurement.**
  It reported a rate and a verdict without saying what the number described.
  It now carries the same honesty the Scroll response check has always had:
  *"A browser cannot tell a trackpad from a mouse, so this is the rate your
  pointer device reported."* The wording that called a rate a "typical trackpad
  rate" now just calls it a typical rate.

### Changed

- **The three trackpad checks now ask for your fingers.** Their instructions
  said "move the pointer", "scroll over the page" and "swipe sideways and
  pinch over the page", which is true but easy to do with a mouse. They now
  name the trackpad.

## v1.13.0 — the trackpad is drawn like a trackpad, and the browser menu stays out of it

### Changed

- **Both trackpad surfaces are now built like a real trackpad.** They were a
  plain box. A trackpad is a movement surface with a strip of buttons below it,
  split left and right, so each surface now has one: the dot travels on the
  surface only, and the two areas under it stand for the physical left and
  right buttons. The seam is off-centre, the way it is on the hardware, because
  the right button is the smaller of the two.

- **The two button areas do something.** Pressing one reports that button, and
  the strip lights the one you pressed. The tester's Button readout now names
  the button — `left`, `right` or `middle` — instead of the single word
  `held`, so a right-click can be told apart from a left one.

- **A right-click on the movement surface is read as a right button.** That is
  how a trackpad's two-finger tap arrives, so the tester now counts it as one
  and logs it as a right click.

### Fixed

- **The browser's context menu no longer opens inside the trackpad panels.** A
  right-click used to summon the browser menu over the thing you were trying
  to look at. The mouse tester has always suppressed it; the trackpad panels
  did not, because the handler that does it lives in the mouse script, which
  the keyboard page does not load. Both panels now suppress it themselves, and
  the event still carries the button, so the right-click is not lost.

- **A window that loses focus mid-press no longer leaves a button stuck down.**
  The release is now also triggered by `pointercancel` and by the window
  losing focus, which is exactly the case the panel exists to catch.

## v1.12.0 — the key tester gets a numpad, and a trackpad to look at

### Added

- **A numpad on the key map.** The board was a 60% layout with the right-hand
  third empty, so it read as lopsided and it was not the keyboard most people
  have on the desk. It is now a full-size board: a 15-unit alpha block, a
  one-unit gap and a four-unit numpad, with the numpad's tall keys — `+` and
  `enter` — spanning two rows the way a real one does. Seventeen new keys
  (`Numpad0`–`Numpad9`, `NumpadAdd`, `NumpadSubtract`, `NumpadMultiply`,
  `NumpadDivide`, `NumpadDecimal`, `NumpadEnter` and `NumLock`) light up on
  press like the rest, so the numpad is tested, not just drawn.

- **A trackpad display**, directly under the keyboard. A picture of the pad
  that answers the pointer while it is over it: a dot follows your cursor and
  the button half of the pad lights when you press. It is a display, not a
  measurement — the trackpad tester further down the page still does the
  counting, and both are live.

### Changed

- **The map is now a grid of key units** rather than a flex list of rows, so
  every row lines up and the whole board scales down as one piece. On a phone
  a full-size board does not fit, so it scrolls sideways inside the panel
  instead of pushing the page out sideways.

## v1.11.0 — the trackpad joins the keyboard tool

v1.10.0 shipped Trackpad Check as a tool in its own right: its own page, its own
troubleshooting guide, its own FAQ, its own schema, a home page card and a sitemap
entry. That was too much for something still being worked out.

The trackpad is now a **working panel inside the keyboard tool** — the tester and the
three measurements, on `keyboard-check.html`. `trackpad-check.html` and
`troubleshooting/trackpad.html` are gone, along with the home page card, the sitemap
entries and the footer links. The site is 11 pages again, with two tools and two
troubleshooting documents.

What survives from v1.10.0 is the part that was worth having:

- **The measurements.** The pointer report rate, timing jitter and travel per sample;
  the shape of the scroll; and whether a two-finger swipe and a pinch reach the page.
- **The honesty rules.** A browser cannot tell a trackpad from a mouse, so the scroll
  verdict is labelled a best guess. Where a browser does not expose raw input samples,
  the rate is reported as an estimate rather than judged against trackpad thresholds.
  A control-modified scroll with a large even delta is a mouse wheel with the control
  key held, not a pinch.
- **Two bug fixes.** The visible FAQ and the FAQPage schema had drifted apart in six
  places, so a reader and a search engine were being told two different things; and
  dragging on a test pad selected the text underneath the pointer.

The trackpad block adds **1,181px** to the keyboard page — 4,589px to 5,770px, or
5.1 screens to 6.4. Folding it into a disclosure would take that back out.


## v1.10.0 — 2026-10-28

### Added

- **Trackpad Check**, a third tool at `/trackpad-check.html`, and a matching
  long-form guide at `/troubleshooting/trackpad.html`.

  A browser cannot tell a trackpad from a mouse — they produce the same
  events — so the tool leans on the signals that do differ and labels
  everything else as an estimate:

  - **The tester.** A large pad with a pointer trail, counting clicks,
    drags and scroll events, and showing the live button state. A chip that
    still reads *held* after you have lifted your finger is a trackpad
    reporting a contact that never ended, which is a real fault.
  - **Pointer response.** The report rate, the timing jitter and the travel
    per sample, taken from `pointerrawupdate`. The rate comes from the
    **median gap between samples**, not the sample count over the window, so
    a user who takes a moment to start moving is not told their trackpad is
    slow. Where a browser does not expose raw samples, the page reports the
    browser's own event rate and says so rather than passing off a display
    artefact as a trackpad measurement.
  - **Scroll response.** Whether the scroll is smooth or notched, read from
    the *shape* of the scrolling: a notched wheel repeats the same step, a
    trackpad does not. The verdict is always marked as a best guess.
  - **Gestures.** A two-finger swipe and a pinch, tested separately. A
    control-modified scroll with a small step is a pinch; large even ones
    are a mouse wheel with the control key held, and the tool says which.

  The guide follows the house pattern — eight sections, one per fault, each
  naming the measurement that settles it and the fix to try first.

### Fixed

- **Six places where the visible FAQ and the FAQPage schema had drifted
  apart.** The mouse page had an older answer to *How do I test if my mouse
  is working?*, the keyboard page had dropped a sentence and used `F1 to F4`
  and `40 to 60` where the page said `F1–F4` and `40–60`, and the homepage
  described the ad-free policy differently in each. A reader and a search
  engine were being told two different things. A checker now asserts that
  the visible text and the schema match, question by question.

- **Dragging on a test pad selected the text underneath the pointer.** The
  `.hitpad` surfaces now set `user-select: none`, so a drag is a measurement
  rather than a selection.

### Changed

- The site-wide copy that described the tools as covering "the two devices
  you use most" now describes three, and every tool page links to the other
  two. The mouse page's "Now test the other half" was no longer true.

## v1.9.6 — 2026-10-28

### Fixed

- **The Hover Response test was measuring the wrong thing.** Mark reported that
  his reading crept down from about 120 ms to 61.8 ms and the verdict never
  changed. It was not a stuck verdict — the number was not a latency at all.

  The test timed the `pointerenter` handler against the **next** `pointermove`,
  and pushed a sample for **every** move event while the pointer was inside
  the box. The samples therefore ramped upward by one frame for every frame
  you spent hovering: a single sweep produced `1.3, 16.5, 32.9, 49.6, 66.1 …
  899.4` ms, and 321 of 378 events were silently dropped by a 900 ms filter.
  The "average delay" was really about **half the time you spent inside the
  box**, which is why it read 61.8 ms for a perfectly healthy mouse and why
  the verdict sat at "Hover is slow to register".

  The browser already exposes the real number. `event.timeStamp` is when the
  platform created the event, so `performance.now() - event.timeStamp` is the
  genuine input-to-delivery latency — about one frame period on a 60 Hz
  display, and completely independent of how long you linger in the box. The
  test now measures that, once per hover.

  Verified by driving it: the reading is now a stable 16.3 ms, 14.5 ms and
  15.5 ms for a no-pause, 500 ms-pause and 2 s-pause hover respectively,
  where the old code gave 80.9 ms, 294.5 ms and 39.6 ms for the same three.
  Each hover is also written to the event log, so the individual readings are
  visible instead of only their average.

- **The average is now a rolling window of the last ten hovers**, so the
  first cold hover can no longer bias the result for the rest of the session,
  and the verdict moves as you go.

### Copy

- The mouse document now describes what the tool actually measures — "how long
  the browser takes to get the hover to the page — the gap between the platform
  creating the event and the page receiving it" — in both the advanced
  measurements list and the display refresh section.

## v1.9.5 — 2026-10-28

### Fixed

- **The mouse diagram could lie about which button you pressed.** The
  Click tester decided which part of the drawing to light by *where you
  clicked*, not by *which button you pressed*. A left click on the right-hand
  half of the picture was logged as a right click, and the counter beside it
  went up. The cause was a positional fallback in the pointerdown handler:
  right and middle were read from the physical button, but the left button
  fell through to "whatever region of the drawing is under the cursor".

  Which part lights up now comes from `PointerEvent.button` every time —
  0 left, 1 middle, 2 right, 3 X1 (back), 4 X2 (forward) — so the drawing
  mirrors the physical mouse and cannot disagree with it. The side buttons
  are now detected from the real back and forward buttons rather than from
  clicking the violet tabs.

### Changed

- **The diagram no longer looks clickable.** The regions had a pointer cursor
  and a hover highlight, which invited exactly the click that produced the
  wrong answer. Both are gone; the panel keeps its crosshair so it still
  reads as the test area.
- **The instruction now says what to do.** "Click anywhere in the panel
  below" became "Press the buttons on your own mouse with the pointer in the
  panel", with *in the panel* highlighted in bold accent green with an
  underline, so the reader's eye goes to the diagram first.
- **The panel border lights up on hover** — a bright accent border with a soft
  glow, rather than the one-step change to a grey line it used to be.

### Copy

- The side-button section of the mouse document now says that **Firefox uses
  the back and forward mouse buttons for history navigation and never passes
  them to the page**, so the violet tabs stay dark there even when the
  hardware is fine. Without that, the threshold table would have given a
  false diagnosis to every Firefox user with a working thumb button. The
  same note is in the mouse page FAQ.
- The screen-reader label for the diagram no longer describes the old
  behaviour.

## v1.9.4 — 2026-10-28

### Changed

- **The Click tester no longer shows its own row of counter boxes.** The
  mouse page was showing the same figures twice: once inside the Click
  tester (left clicks, right clicks, middle clicks, side buttons, scroll
  events, last event) and again in the Quick summary row underneath. The
  inner row is gone; each figure now has one home.
- **The "last event" box is gone entirely.** The event log beside the
  diagram already records every input with its coordinates, so the box was
  saying the same thing a third time.
- **The click counters moved into one shared object.** The Quick summary
  tiles, the "measurements recorded" pill and the Copy results button all
  read them from a single source of truth now, rather than reading the
  numbers back out of a row of boxes that the Click tester no longer shows.
  Verified by clicking the mouse: the summary, the pill, the copy output
  and the reset button all still work.
- **The mouse diagram is bigger.** The stage column goes from 300px to
  340px and the drawing itself from 260px to 290px.
- **The signal chips are bigger.** The lamp dots go from 9px to 13px, the
  chip text from 0.8rem to 0.92rem, and the chips get more padding.
- **The event log moved beside the diagram** instead of sitting below the
  panel, so the live feed is next to the thing you are clicking. Its height
  is fixed on purpose: a log that grows the panel as it fills would push
  the Quick summary further down the page.
- **The note under the panel runs the full width** of it, so the text has
  room to breathe now that the row of boxes is gone.

### Note

- The side-button *count* no longer appears as a number anywhere on the
  page. The Back and Forward chips still light violet when a side button
  fires, which is how the troubleshooting document tells you to test them,
  and the count is still in the Copy results output.

## v1.9.3 — 2026-10-28

### Changed

- **A full proofreading pass over all 15,946 words of visible copy**, across
  the 11 pages. British English throughout, no contractions, em dashes with
  spaces — the house voice was measured first and protected, so the changes
  are corrections rather than rewrites.
- **A factual correction on the mouse page.** The display refresh rate
  section claimed that a 144 Hz display reports a *longer* hover delay than
  a 60 Hz one, and that a fast display *adds* apparent jitter. It is the
  other way round: browsers deliver pointer events once per frame, so a
  faster display makes both numbers smaller. Confirmed against Chrome's
  own "Aligned input events" write-up and measured in the tool's own
  environment, where a perfect mouse on a 60 Hz display reports a mean gap
  of 17.7 ms. The keyboard document already had this right, so the two
  pages were contradicting each other.
- **The motion smoothness reading is now explained properly.** Because the
  browser delivers pointer events once per frame, the average gap between
  them is roughly the frame period — so a perfect mouse on a 60 Hz display
  reads "Fair" rather than "Smooth". The page says so, and both threshold
  tables gained the missing "mean 12 ms or more" row, which the tool can
  report but no row covered.
- **The cursor jump section no longer overclaims.** There is no jump
  detector in the tool, so "The test that settles it" is now "The test
  that narrows it down", and the copy says plainly that no reading sees a
  jump itself.
- **The same double-click threshold table appeared three times on the mouse
  page with three different sets of wording.** All three copies now read
  identically. The thresholds were always correct — only the prose drifted.
- **Stale copy left over from the Troubleshooting restructure.** The about
  page still described the troubleshooting guides as coming next, and
  listed them at launch, when the "Recently" table says they were already
  published. The roadmap order did not match the site's own order, and the
  tool pages still linked to the old one-page-per-symptom headings.
- Grammar and wording fixes: a missing comma, a subject-verb disagreement
  ("Twenty targets gives"), a sentence that said "makes contact" twice, a
  question mark followed by an em dash, straight quotes in the terms page
  where the rest of the site uses curly ones, and a handful of phrases that
  meant something other than what they said.

### Fixed

- The keyboard document rendered full-bleed — its callout, threshold table
  and step blocks were ejected out of the page wrapper by stray closing
  tags, so they ran edge to edge with no side margins. The mouse document
  was never affected.
- The step blocks in both documents are now a plain numbered list rather
  than a row of cards, and the mouse page's four steps sit two by two.

## v1.9.0 — 2026-10-28

### Changed

- **The Guides section becomes Troubleshooting, and one page per symptom
  becomes one long page per device.** There were nine separate mouse guide
  pages under `/guides/`. They are now two: `/troubleshooting/mouse.html`
  and `/troubleshooting/keyboard.html`, each a single document-like page
  with every fault written out in order, separated by a rule and some space.
  A numbered table of contents sits at the top of each.
- **The keyboard gets the same treatment as the mouse.** Its "What the
  numbers actually mean" and "Why is my keyboard doing that?" sections moved
  off the tool page into the keyboard document, and the tool page now carries
  a card index into it. The keyboard document is 2,644 words with threshold
  tables and a "what to try" block for every fault.
- **The mouse document is 5,474 words**, keeping every paragraph of the nine
  old pages — verified by a drift check that compares the old article
  paragraphs against the new document.
- **New content in the keyboard document**: threshold tables for typing
  speed, layout detection, key rollover and response latency, plus a
  four-step "what to try" block for each of the six faults. The thresholds
  are the ones `assets/js/keyboard.js` actually applies.
- The site nav item is now **Troubleshooting**. The footer's Guides column
  becomes a Troubleshooting column listing both devices.
- `sitemap.xml` rebuilt: 10 URLs, the nine guide URLs replaced by three.
- The tool pages keep every test. Their long prose moved into the documents.

### Fixed

- The lead paragraph under the H1 sat oddly on the tool pages, because the
  home hero's centred lead style was leaking into `.hero__lead` everywhere.
  It is now scoped to the home hero only.

## v1.8.0 — 2026-10-28

### Changed

- **The site nav is Guides / About / Contact only.** Mouse Check and
  Keyboard Check come out of the header on all 18 pages. The tools stay
  reachable from the home page cards, the footer's Tools column, the 404
  page's own buttons, and the "test that settles it" callout on every guide.

### Fixed

- The guide pages had silently lost `aria-current="page"` on the Guides
  link. It was keyed off the canonical path, which became page-relative
  when the guides tree was built, so the check stopped matching. It is now
  an explicit argument.

## v1.7.1 — 2026-10-28

### Fixed

- **The tool cards were still clipping on a 720-800px window.** The hero H1
  drops from 3.5rem to 2.9rem and now sits on one line; the lead drops to
  1rem; the tools heading drops to 1.75rem. The tools heading was still
  wrapping because `.section__head` has a `max-width: 62ch`, so that head is
  now full width. Cards move from 611px to 444px and fit entirely from
  1280x720 upward.

## v1.7.0 — 2026-10-28

### Changed

- **The home hero becomes a centred masthead.** The H1 and lead use the full
  container instead of a 640px column, and the whole block is centred.
- The home page nav drops Mouse Check and Keyboard Check — the cards are
  right there. Other pages keep them.
- Headings use `text-wrap: pretty` so a short last line is avoided without
  splitting a phrase like "keyboard test" in half. `balance` is used only on
  the hero H1.

## v1.6.0 — 2026-10-28

### Changed

- **The home page is rebuilt around the tools.** It was seven and a half
  screens; it is now four and a half. The order is hero, The Tools, The Lab
  is Expanding, Common problems, Limits, FAQ.
- Removed the hero's duplicate buttons and the live pointer monitor panel,
  "What these tests actually check", "Three steps, about two minutes", and
  "What a healthy result looks like" — the last two now live in the guide
  pages. "Looking for a specific fault?" went from six cards to three, and
  the FAQ from ten questions to five.
- **The visible FAQ and the FAQPage schema are now generated from one list**,
  so they cannot drift. They were already out of step: ten visible questions
  against seven in the schema.

## v1.5.0 — 2026-10-28

### Added

- **The mouse troubleshooting guides** — ten pages under `/guides/`, built by
  splitting the mouse page rather than writing from scratch. Every guide
  opens with the measurement that settles the question, states the threshold
  the tool actually applies, and gives the fix in order.
- The nav gains Guides, the footer gains a Guides column, `sitemap.xml` is
  rebuilt with 17 URLs, and `about.html` gains `Person` schema.

## v1.4.2 — 2026-10-27

### Fixed

- **The mouse summary wrapped six tiles across and stranded the seventh.** The
  page's content column is capped at 1080px and seven tiles needed about
  1113px, so the grid broke after six and left the last one alone with a wide
  empty gap beside it. The summary is pinned to seven equal columns instead,
  with slightly tighter tile padding and a marginally smaller label so every
  title still sits on one line. It steps down to four across below 980px and
  two across below 620px. The keyboard summary is untouched.

## v1.4.1 — 2026-10-27

### Fixed

- **"PressStart" was missing its space.** The instruction inside the pointer
  precision box is a flex container, and whitespace between flex items is
  dropped — "Press " and the bold "Start" were two separate flex items, so
  the gap between them vanished. The text is now wrapped in a single span, so
  the space is part of the content instead of between two boxes.
- **The advanced diagnostics were three across, which left the fourth panel
  stranded.** Drag accuracy, Scroll encoder and Motion smoothness filled the
  first row and Hover response sat alone underneath with a wide empty gap
  beside it. The grid is two across now: Drag accuracy and Scroll encoder on
  top, Motion smoothness and Hover response below. It drops to a single
  column below 760px.

## v1.4.0 — 2026-10-27

### Changed

- **Every measurement now answers in a sentence before it shows a number.**
  The complaint was that the panels showed "px", "ms", "notches" and "Hz" with
  no reference point, while the explanation lived three screens further down
  in "What the numbers actually mean". Each panel now carries a verdict block:
  the plain-language answer first, the technical figure underneath it, and the
  raw numbers still in the mini-results for anyone who wants them.

  | Test | The answer | The number |
  |---|---|---|
  | Pointer precision | "Your aim is very accurate." | 100% of 4 targets hit, average miss 1.0px |
  | Double-click speed | "Your double-click is snappy." | 94ms between your two clicks |
  | Polling rate | "That is a fast gaming mouse." | 500 Hz — 500 position reports every second |
  | Drag accuracy | "You are as accurate while dragging as while clicking." | 1.4px from the centre |
  | Scroll encoder | "Your wheel is scrolling." | 1 notch up, 1 down · 150 pixels per notch |
  | Motion smoothness | "Your movement is smooth." | Mean gap 8.3ms, jitter 4.1ms |
  | Hover response | "Hover registers instantly." | Average 12ms from arriving to the page noticing |

- **The Acceleration curve test is gone.** It produced a "ratio" that nobody
  outside the page could act on, needed a six-second sweep to return one
  number, and duplicated what the "why does my cursor jump" section already
  explains. Nine mouse measurements are now eight. The explanation of pointer
  acceleration stays in the prose, because it is a useful thing to know.
- **Pointer precision has a Reset button.** It clears the score, restores the
  instruction text, and puts the blue target back exactly where the current
  run put it. Pressing Start still picks a fresh position, so a new run is
  never the same test twice.
- **The scroll encoder shows which way the wheel is turning** — a big arrow
  and the words "Scrolling up" / "Scrolling down" / "Scrolling sideways",
  right where the pointer is. Reset clears it and restores the prompt.
- **Motion smoothness has a pointer tracker.** A dot follows your pointer
  inside the box and leaves a fading trail, so it is obvious you are inside
  the test area rather than still looking at the page. The measurement now
  samples inside the box rather than anywhere on the page, so the visual and
  the number describe the same thing. A Reset button clears the trail.
- **Hover response has a pointer tracker** too, so you can see you are over
  the target.

### Fixed

- The instruction inside the pointer precision box was rendering as three
  stacked lines — "Press" / "Start" / ", then click each target." — because a
  grid container turns each run of text into its own row. It is one line now.
  The same trap was closed off for the other pad hints.

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
