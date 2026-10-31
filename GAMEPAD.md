# Gamepad Test — the locked scope

This file is the memory for the third InputScope tool, so the decision cannot be
lost when a chat ends. It is not published: `build.sh` only stages the site
files, so this never reaches the live site.

**Status: decided, not started. Nothing about the gamepad exists yet.**

## Why the gamepad, and why now

Mouse and keyboard are functionally done — every panel has thresholds, a guide
section and a real test driving it. What is left on those two is polish.

The two candidates were a **headset/microphone** test and a **gamepad** test.

- The **microphone field is mature and hostile.** miniwebtool, screentest.pro,
  checkmymic, clic.tools, wavespeed.ai, utilitytoolslab and hardtest.online
  already do noise floor, SNR, clipping, dBFS, spectrum and echo toggles, on
  established domains.
- The **gamepad field is thin.** gamepadtester.co, arraykit.com,
  gamepadtester.co.uk, joycheck.io, controllertest.io and screen-tester.com all
  ship the same feature list. Only joycheck.io does real per-brand threshold
  work.
- The **decisive difference is permission.** The Gamepad API asks for no
  permission prompt, so a tool that cannot possibly collect anything is the
  cleanest demonstration of the privacy promise. A microphone tool has to earn
  trust through a scary dialog on a trust site.

## The honesty wedge

The Gamepad API applies a **deadzone before the page ever sees an axis
value**. That is why a worn stick feels dead long before it reads as drifting.
Competitors claim "raw values, exactly what your game receives" — which is
true, and misleading, because the game receives the deadzoned value too.

The wedge: state the deadzone the browser applies, show what the page really
receives, and never present a deadzoned value as raw hardware.

## The scope, as the owner locked it

> just build a simple page for gamepad functionality first with display that
> shows if the buttons gets pressed. no dedicated troubleshooting page yet, no
> other texts yet with FAQ, different tests, simplified troubleshooting (on the
> gamepad page). just a visual image of a typical gamepad that lets us tests
> the buttons.

In practice:

- A **drawn gamepad** whose buttons light when pressed.
- **Simplified troubleshooting on the gamepad page itself.**
- **No guide page. No FAQ. No other tests. No other prose yet.**
- Built **one piece at a time**, with a browser check after each piece.

## The build order, in pieces

1. Button detection — the drawn gamepad lights the right button.
2. Axis readouts, with the browser deadzone stated honestly.
3. Per-axis drift statistics over a rolling window.
4. The deadzone as the browser applies it, shown next to the raw reading.
5. Trigger creep, chatter, dead motor, rumble.
6. Browser-observed latency.

## Rules that apply from the start

- **Functional first.** A feature still in development gets no page, no guide,
  no FAQ entry, no schema block, no sitemap entry and no home card. The home
  page card says "Next up" until the thing actually works.
- **The `data-note` plumbing goes in from the start.** Every reading on the
  mouse and keyboard pages had its unit line silently discarded for months
  because `setOut()` wrote into a `[data-note]` element that did not exist.
  The new page declares a starting line for every reading in the HTML, and
  `check_notes.py` fails the build if a reading has nowhere to write.
- **One long document per device**, not one page per symptom — when the
  troubleshooting guide is written.
- **Never an ad unit on a measurement surface.** Estimates are labelled as
  estimates.
- **Copy must match the tool's JavaScript exactly.** A threshold table is a
  test suite for the tool.
