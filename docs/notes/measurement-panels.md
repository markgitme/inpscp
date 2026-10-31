# Building measurement panels that don't lie

> Rules and hard-won lessons for building correct browser-based measurement
> panels — answer-first verdict blocks, auto-repeat vs physical presses,
> modifier/lock state reading, drag/drop geometry bias, and the CSS/JS traps
> that silently break a panel.
>
> Read when building or debugging any latency/precision/click/typing
> measurement, or when a test reports a number that looks wrong.

## The answer-first house style

The owner's instruction: *"a straight up answer like 'Your double-click is/was
slightly slow' followed by the number 280ms or something. so that it serves two
people. the common one and the one who knows about ms stuff / nerdy stuff."*

- A `.verdict` block sits between the control and the mini-results. It has two
  lines: `verdict__line` (the plain-language answer, tone-coloured
  ok/warn/bad) and `verdict__detail` (one brief technical line).
- The raw numbers stay in `.mini-results` underneath for the reader who wants
  them.
- The wordy technical explanation stays in the "What the numbers actually mean"
  section — that section was **not** trimmed, only the acceleration paragraph
  was removed with its test.
- A `verdict(id, line, detail, tone)` helper writes to `id + '-verdict-line'` /
  `id + '-verdict-detail'`. **Getting those id suffixes wrong silently no-ops
  every update** — the initial HTML text still renders, so it looks alive but
  never changes. This bit me once: the helper used `id + '-line'` while the
  markup used `id + '-verdict-line'`.
- **Cut measurements that produce a ratio nobody can act on.** The Acceleration
  curve was removed: a six-second sweep for one unusable number, and it
  duplicated the "why does my cursor jump" prose. The prose itself stayed.

## Every reading needs a home for its unit line

`setOut(key, value, note, tone)` writes the reading's explanation into
`[data-note="key"]`. **On this site that element did not exist on any page**, so
all 48 readings silently discarded their unit line and every Quick-summary tile
rendered an empty note. Fixed in v1.17.0.

The rule that keeps it fixed: **the markup declares the starting state, the
script updates it, and a checker asserts the declared line is one the script can
actually write** (`checks/check_notes.py`, 223 checks).

A note with no element is not a note — a panel with nowhere to explain itself
can only ever show a dash.

## Auto-repeat is ONE physical press

OS auto-repeat fires ~30 events/second while a key is held.
`KeyboardEvent.repeat === true` is the signal. Never let auto-repeat into a
count of presses, and never let it into a measurement sample set — a 1.3s hold
read as "40 keys pressed" and it was silently corrupting the response-latency
test too (dozens of duplicate samples of one press flattened the jitter
figure).

- `keymap-count` counts physical presses only (`if (e.repeat) { …; return; }`).
- `keymap-repeat` reads "None" until the OS repeats a held key, then "24 × A"
  (count × the key's visible label, read from the map's `[data-code]` cell).
- `keymap-double` reads a key that sends two non-repeat keydowns with no keyup
  in between — a chattering switch. Tracked with a `fires[code]` counter that
  must be reset on keyup **and on window blur**, or a key held when the tab lost
  focus is falsely reported as a double-fire later.
- The latency test's `onKey` returns early on `e.repeat`. The rollover test and
  the keymap log already excluded repeats; the typing-speed test uses the
  `input` event and measures real characters, so it was always correct.

## Lock / modifier state

- The API is `KeyboardEvent.getModifierState()` — **not**
  `navigator.getModifierState`. The original code called
  `navigator.getModifierState && navigator.getModifierState('CapsLock')`; the
  method doesn't exist, so the truthiness guard short-circuited and the state
  was permanently `false`. Every lamp dark, every pill "Off", regardless of the
  key pressed.
- Lock state is **only readable from a `KeyboardEvent` during dispatch**. There
  is no pollable equivalent — a `setInterval` refresh can never work, and
  reading `e.getModifierState()` inside a deferred callback returns the same
  stale snapshot (modifier state is frozen at event creation).
- Read it off **every** keydown and keyup. Current Chrome/Firefox report the
  *post-toggle* value on the lock key's own keydown; older Chrome reported the
  *pre-toggle* value there and the correct value on keyup. Listening to both
  covers every browser and ordering.
- Cache the state and only rewrite the DOM when a lock actually flips —
  otherwise the typing-speed and latency tests pay a redraw on every keystroke.
- Re-render the cached values on `focus` / `visibilitychange`, since the state
  survives while the tab is backgrounded.
- The note under the lock panel explains that most laptops fold Num
  Lock/Scroll Lock into the Fn layer and macOS has neither — so on a Mac those
  two lamps correctly read "Off" forever.

## Drag/drop measurement geometry

**Generalisable rule: any drag/drop measurement must compare like with like.**
If the dragged element is positioned by its top-left but the result is computed
from its centre, the error is half the element's size and it shows up as a
constant floor in the result.

The actual bug: `pointermove` set `handle.style.left = e.clientX - r.left`
(top-left follows the pointer) while `evaluate()` compared the **centres** of
handle and zone. The handle's centre sat 20px right and 20px down → distance =
√(20²+20²) = 28.3px minimum. Tone thresholds are `d < 8 ? ok : d < 20 ? warn :
bad` — **a pixel-perfect drop scored 28.3px = "bad". The test could never
pass.** Fixed by centring the handle on the pointer: `clamp(e.clientX - r.left -
bw/2, 0, r.width - bw)`. Now a centred drop reads ~1px (ok), 12px off reads
warn, a corner drop reads bad.

- Symptom to watch for: a measurement with a suspicious minimum value (28.3px)
  that no amount of accuracy can beat.
- Test the extremes: drop exactly on the target centre and drop in the far
  corner. If the centre drop does not read near zero, the geometry is wrong.
- Init and Reset must agree: `layout()` positioned only the zone, so on first
  load the block sat at the CSS default `left:0; top:0` and only moved when
  Reset was clicked. Extracted `placeHandle()` and call it on init as well as
  on reset.

## Coding traps that silently break a panel

- **`display: grid; place-items: center` turns every run of text into its own
  grid row.** "Press `<strong>Start</strong>`, then click each target."
  rendered as three stacked lines. Use flex (`align-items`/`justify-content:
  center`) for any centred hint containing inline markup.
- **`var` inside an IIFE shadows an outer helper for the whole scope**
  (hoisting). A local `var verdict = ...` killed the outer `verdict()` function
  file-wide. Renamed the local to `vLabel`; use `let`/`const` for locals.
- **A truthiness guard on a non-existent API fails silently** and is
  indistinguishable from a real value. `typeof` check first.
- **When a panel promises a behaviour, check the code actually delivers it.**
  The key tester promised *"a key that fires twice shows two flashes from one
  press"* in four places (panel copy, FAQ, FAQ schema, prose) and the code never
  implemented a two-flash visual — the cap lights while held, it does not flash.
  All four now say the tester *flags* the key as a double-fire. Keep the FAQPage
  schema text identical to the visible FAQ.
- **A helper that writes to `id + '-suffix'` no-ops if the markup disagrees** —
  the page still renders its initial text, so it looks alive and never updates.
- **A drag on a test surface must not select text.** `.hitpad` sets
  `user-select: none`. Without it, dragging across a pad selected the words
  underneath the pointer — which on the trackpad tester selected the hint text
  mid-measurement. It was visible only in a screenshot, not in the DOM.

## Report rate: measure the median gap, not the sample count

A device's report rate is `1000 / median(gap between samples)`, **not** `samples
/ window length`. The window method dilutes the reading whenever the user does
not move for the whole window — someone who starts moving 400 ms into a 1.5 s
sample is told their trackpad is slow when it is fine. Sort the gaps, take the
middle one, invert it. The median also survives a trailing pause, which the
mean does not.

## The raw-sampling honesty rule

`pointerrawupdate` is Chromium-only and needs a secure context. Where it is
available it is the real device cadence; where it is not, `pointermove` only
tells you how often the **browser** delivered the pointer, which is
frame-aligned and says more about the display than about the device.

- Never judge the fallback number against device thresholds. The mouse page
  already had this rule ("Your browser will not report the real rate"); the
  trackpad page had to learn it too — the first version reported "60 Hz, a
  typical trackpad rate" off a 60 Hz frame rate, which was a display artefact
  dressed as a trackpad measurement.
- Label the fallback unit `ev/s` (events per second), not `Hz`, and say
  "estimated" in the note.
- Show the capability on the page, not just in the verdict: a `Checking browser
  capability…` line under the panel that resolves to "Raw sampling available"
  or "This browser does not expose raw samples".

## A `ctrlKey` wheel event is not automatically a pinch

Ctrl+scroll with a **mouse wheel** also sets `ctrlKey`, so counting every
control-modified scroll as a pinch is a false positive. The delta size separates
them: a trackpad pinch arrives with small deltas (the browser's zoom signal), a
mouse wheel with the control key held arrives with large even ones. Count a
pinch only when `ctrlKey && Math.abs(deltaY) <= 50`, and say plainly when the
only control-modified scrolls were large and even — that is a modified mouse
wheel, not a gesture.

## A notched wheel and a trackpad differ in the *shape* of the scroll

A notched wheel repeats the same delta; a trackpad produces a run of different,
usually small, values. Compare consecutive deltas: a high repeat ratio with a
large average means a wheel. This is a **guess** — a browser gives a wheel event
and a trackpad event the same shape — so the verdict must say so, and the page
copy must never claim certainty.

## Scroll deltas are not always in pixels

`WheelEvent.deltaMode` can be 1 (lines) or 2 (pages). A "step size in pixels"
would then be fiction. Convert, or report the step size as "not in pixels" and
note that the browser reports in lines.

## The visible FAQ and the FAQPage schema must agree

Six places across the mouse, keyboard and home pages had drifted: the schema
still carried an older answer, dropped a sentence, and wrote `F1 to F4` and `40
to 60` where the page said `F1–F4` and `40–60`. A reader and a search engine
were being told two different things.

- The rule is now enforced by a checker: `checks/check_faq.py` strips the markup
  from the visible `.faq` answers and compares them to the JSON-LD, question by
  question.
- **Do not re-serialise the whole JSON-LD block** to fix a mismatch — the file
  writes non-ASCII literally (a real em dash, not `\u2014`), so `json.dumps` must
  be called with `ensure_ascii=False` to produce a string that matches the bytes
  on disk. Try both encodings when searching for the raw text.
- The visible text is the proofread version, so when they differ the **schema**
  is what moves.
- The same rule applies to the copy: the visible answer may wrap a phrase in a
  link, but the stripped text must be identical in both places.

## `performance.now()` in a handler is the DISPATCH time, not the EVENT time

The hover test measured hesitation, not latency. It timed the `pointerenter`
**handler** against the next `pointermove` and pushed a sample for **every**
move event inside the box. The samples ramped by one frame per frame hovered: a
single sweep produced `1.3, 16.5, 32.9, 49.6, 66.1 … 899.4 ms`, and **321 of
378 events were silently dropped** by the 900 ms filter. The "average delay" was
≈ **half the time you spent inside the box**. The owner's 61.8 ms ≈ half of a
~120 ms hover — that is why the number never moved: it was faithfully reporting
a quantity that had nothing to do with latency.

**The fix — the browser already exposes the real number.** `event.timeStamp` is
when the platform created the event, so `performance.now() - event.timeStamp` is
the genuine **input-to-delivery latency** (~16 ms on a 60 Hz display = one frame
period), and it does **not** move when you linger. One sample per hover, over a
rolling window of the last 10, plus a per-hover log line.

| hover pattern | old | new |
|---|---|---|
| no pause inside | 80.9 ms | **16.3 ms** |
| 500 ms pause inside | 294.5 ms | **14.5 ms** |
| 2 s pause inside | 39.6 ms | **15.5 ms** |

**The generalisable lesson:** whenever a test claims to measure latency, use
`event.timeStamp`.

**Two traps worth remembering:**

- **A `setInterval` that recomputes from an ever-growing array is a lifetime
  average.** One cold first sample (JIT, first paint) poisons the result for the
  whole session. Use a rolling window, and say how many samples the average
  covers.
- **A filter that discards outliers silently biases the mean.** The `d < 900`
  guard threw away the *worst* readings while keeping the ones just under the
  cap — the opposite of what a "reject the silly ones" guard is supposed to do.

**Debugging technique that found it:** do not read the number and guess what it
means — **replicate the handler's logic in an injected script that logs every
event, then drive the input with different patterns.** Three hover styles (no
pause / 500 ms / 2 s) turned "the number won't change" into "the number is your
hover duration". `page.mouse.move(x, y, { steps: N })` sweeps fast enough to
cross a 493 px pad in ~30 frames, which is what exposed the ramp.

## The mouse diagram must report the button pressed, not the region clicked

Mark found it: *"im left clicking the right click, a right click gets
recorded."* The Click tester decided which part of the drawing to light by
**where you clicked**, not by **which button you pressed**.

**The culprit** — a positional fallback in the `pointerdown` handler:

```js
if (e.button === 2) btn = 'right';
else if (e.button === 1) btn = 'middle';
else if (region) btn = region.getAttribute('data-btn');   // <-- the lie
else btn = 'left';
```

Right and middle came from the physical button; **the left button fell through
to the region under the cursor.** Now it is `BUTTONS[e.button]` for every press.

**`PointerEvent.button` values** (W3C Pointer Events 4): 0 left · 1 middle · 2
right · **3 X1 (back)** · **4 X2 (forward)**; the `buttons` bitmask is 1/2/4/**8**/
**16**. Chromium delivers X1/X2 as button 3/4.

### The consequence nobody expected: Firefox

**Firefox uses the back and forward mouse buttons for history navigation and
never passes them to the page** — no `pointerdown`, no `mousedown`, nothing.
Chromium delivers them.

So detecting the side buttons physically means **the violet tabs stay dark in
Firefox even when the hardware is fine** — and the mouse document's threshold
table said *"The violet tabs stay dark | 0 events | The buttons are not firing. A
driver, a pairing problem, or a faulty switch"*, which would have given **every
Firefox user a false diagnosis**. The document's side-button section, its table
row, and the mouse page FAQ now all say so.

**The pattern to remember:** changing *how* the tool detects something changes
what the copy is allowed to claim. **Grep the document for the old promise
whenever the detection mechanism changes.**

### The "don't look clickable" rule

A shape with a pointer cursor and a hover fill is a **promise** that clicking it
does something. `.m-btn, .m-side { cursor: pointer }` and the `:hover` fill were
exactly that promise, and the diagram's click behaviour was the lie behind it.
Both removed; the regions now inherit the stage's crosshair, so the panel still
reads as the test area.

### Mark's copy preferences, applied

- "in the panel" → **bold + accent green + underline**, as a `.hl` class, left in
  the flow of the sentence rather than pulled out of it.
- The panel border on hover: a bright accent border + a soft glow, not a
  one-step grey change.
- The instruction had to change, because "Click anywhere in the panel below"
  described the old behaviour and would have been a new lie: *"Press the buttons
  on your own mouse with the pointer **in the panel** — left, right, middle, the
  side buttons and the scroll wheel all show up on the diagram."*

### Playwright cannot send X1/X2

`page.mouse.click(x, y, { button: 'back' })` throws — only `left|right|middle` are
accepted. To test the 3/4 path, dispatch a synthetic `PointerEvent` with `button:
3, buttons: 8` onto the stage. A synthetic event proves the **mapping**, not the
physical device.

---

## Site-specific layout decisions

The implementation is in the repo (`assets/css/style.css`, `assets/js/`), so
this records the **why** and the measured numbers, not the code.

### The key map — a full-size board built as separate grids

- **CSS Grid auto-placement cannot express "leave this cell empty".** The first
  attempt was one 20-column grid with the numpad placed explicitly at columns
  17–20; auto-placement then filled the empty hole at row 1, columns 17–20 with
  alpha keys and every row shifted right. The fix was **separate grids**:
  `.kbd-frow` (16 keys, flex) and `.kbd-body` (flex) containing `.kbd-alpha` (15
  columns × 5 rows, **each row exactly filling 15 units**) and `.kbd-numpad` (4
  columns × 5 rows, all 17 keys placed explicitly).
  **Never rely on a hole in a grid to stay empty.**
- **Sizing is in key units, not pixels:** `--u: 42px` (one key), `--kg: 6px` (the
  gap), `.kbd-key.w2/.w3/.w6` spanning columns. The board is 20 units wide.
  Centring is `width: fit-content; margin-inline: auto` — measured **985px inside
  a 1078px panel**, 47px either side.
- **A full-size board does not fit a phone.** Below the width where the board
  exceeds the panel, the map scrolls sideways **inside the panel** rather than
  pushing the page out: `.kbd-scroll { overflow-x: auto; }` around `.kbd-map {
  width: max-content; margin-inline: auto; }`. The `margin-inline: auto` is
  what centres it when it fits and collapses to 0 when it overflows — **the
  flexbox `justify-content: center` trick would have cut off the left edge.**
  Steps: `--u` 42px → 38px (≤1080) → 28px (≤900) → 26px (≤700) → 22px (≤520).
  Measured page overflow: **0 at 360 / 390 / 430 / 768 / 1024 / 1280px**.
- The board is a 104 minus the navigation cluster, so there is a deliberate
  **four-unit hole at the top right above the numpad**. That is authentic, not a
  mistake — the F-row (prt, scr, pau) is contiguous and ends above the numpad's
  first column.
- **Verification that caught it: assert the DOM, not the pixels** — 94 `.kbd-key`
  elements, 0 duplicate `data-code`s, the numpad's top row sharing a `top` with
  the alpha block's first row, and `Numpad7` acquiring the `hit` class on
  `keyboard.down('Numpad7')`.

### The trackpad surfaces — a surface and a button strip

```
.tp-pad (position: relative; overflow: hidden)
  .tp-surface     position: absolute; inset: 0 0 46px 0   <- the movement area
  .tp-buttons     position: absolute; inset: auto 0 0 0; height: 46px; display: flex
    .tp-btn--left   flex: 7 1 0; border-right: 1px solid var(--line-2)
    .tp-btn--right  flex: 3 1 0
```

- **Absolute positioning, not flex on the pad.** `.hitpad` is shared with the
  mouse page's precision pad and the click tester, so changing its layout would
  have touched three places. **A shared class is not a licence to restyle it.**
- The seam is **off-centre (70/30)** because the right button is the smaller of
  the two on real hardware. It reads as a trackpad rather than as a generic box.
- **The dot travels on the surface only** — the button strip is not a movement
  area, so the `pointermove` listener sits on `.tp-surface`, not on the pad. The
  trail dots go on the surface too, so they cannot leak into the strip.
- **Press semantics:** a press on the *surface* is a tap → a left click → the
  surface tints; a press on the *left area* → the left button → that area
  lights; a press on the *right area* → the right button → that area lights; a
  hardware **right-click anywhere** → read as a right button, because that is
  how a trackpad's **two-finger tap** arrives.
- **A browser cannot tell a tap from a press of the physical button** — both are
  button 0 — so the left area lights either way. The copy says exactly that,
  rather than pretending the areas are separate physical buttons.
- **The areas are indicators, not press targets.** They show the button the
  browser reported, wherever the press landed: `e.button === 2` lights the right
  one, `0` the left, `1` (middle) neither. Clicking "right" with a left mouse
  lights **left** — a right click that never happened must not be reported.

### Grid and log traps

- **A `1fr` track in an auto-height grid sizes to its content's max-content
  contribution**, so a filling log pushed the row taller and the whole panel
  grew. The log needs a **fixed height** (`height: 356px`) with
  `overflow-y: auto`.
- **The global `.log` rule already had `max-height: 220px`**, which silently
  capped the 356px log. **Any override of a shared class needs to reset
  `max-height` too**, not just `height`.
- **The Quick summary is 7 tiles of 147px in a 1080px row — free space is −2px**,
  so an 8th tile genuinely does NOT fit at 1280px. Mark's "adding another box
  would break the line" was correct, and now measured. `.tiles` uses
  `repeat(auto-fit, minmax(178px, 1fr))`; an 8th would need the min dropped to
  ~127px. Side-button counts therefore have **no home on the page** — the chips
  still light violet and the count stays in the Copy output. A deliberate trade,
  flagged to Mark.
- **A summary row with a known tile count should be pinned, not left to
  auto-fit** — `repeat(6, minmax(0, 1fr))` with media queries to 3 and 2 columns.

### The step blocks

- `.steps` at `repeat(auto-fit, minmax(230px, 1fr))` made three columns at the
  document width and stranded a fourth on a row with a large empty gap. Now two
  by two, and where the count is odd the last card spans the full width:
  `.doc .steps > .step:last-child:nth-child(odd) { grid-column: 1 / -1; }`.
- Step blocks became a **plain numbered list**, not cards. A card per step
  fights the "one long article" feel, and a boxed grid breaks unevenly whenever
  the count is not a multiple of the column count.

### Before removing any `data-out` element

Grep for it across the HTML **and every JS file, including inline `<script>`
blocks** — they are easy to miss because they are not in `assets/js/`. The
v1.9.4 removal was not a layout-only change: `buildSummary()` read the boxes'
`textContent`, the inline script decided the pill state, and the Copy button
listed the same keys. Deleting the markup made all three go quiet — the summary
rendered "—" for ever, the pill never flipped, and the copy output lost the
counts. The counters had to move into **one shared object**
(`window.inputScopeClicks`) that all three read from.

### Structural assertion for the long documents

`checks/check_doc_structure.py` walks the tag tree and asserts every
`.doc-section`, `.table-wrap`, `.steps`, `.callout` and `.prose` sits inside the
`<article class="doc">` wrapper. A section that escapes it renders fine in the
source and breaks on the page — the callout, table and steps get ejected to
`<main>` and the prose loses its width. Note that `<article class="doc">` has to
be closed by scanning for the matching `</article>`; a regex that only captures
the opening tag gives an empty span and reports every section as escaped.

### Misc site fix

The contact page had a 3px sideways scroll at 360px width: hCaptcha's fixed
303px iframe could not shrink. Capped it at `max-width: 100%`.
