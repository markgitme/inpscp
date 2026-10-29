/* =========================================================
   InputScope — Trackpad Check
   Browser-based trackpad diagnostics.
   Everything is measured client-side; nothing is uploaded.

   What a browser can actually see of a trackpad, and what it
   cannot:

   - Pointer movement arrives as pointer events, and the browser
     exposes the underlying samples through pointerrawupdate and
     getCoalescedEvents(). That is how the real report rate is
     measured.
   - Scrolling arrives as wheel events, and a trackpad’s are
     indistinguishable from a mouse wheel’s except by their shape:
     a notched wheel repeats the same delta, a trackpad does not.
   - A pinch gesture arrives as a wheel event with ctrlKey set.
   - A two-finger horizontal swipe arrives as a wheel event with a
     non-zero deltaX.
   - The browser CANNOT tell a trackpad from a mouse with
     certainty, so the scroll verdict is always a best guess and
     says so.
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------------- output helpers ---------------- */
  function setOut(key, value, note, tone) {
    var v = document.querySelector('[data-out="' + key + '"]');
    var n = document.querySelector('[data-note="' + key + '"]');
    var tile = v ? v.closest('.tile') : null;
    if (v) {
      v.textContent = value;
      if (tone) {
        if (tile) {
          tile.classList.remove('tile--ok', 'tile--warn', 'tile--bad');
          tile.classList.add('tile--' + tone);
        } else if (v.classList.contains('mini-results__v')) {
          v.classList.remove('ok', 'warn', 'bad');
          v.classList.add(tone);
        }
      }
    }
    if (n) n.textContent = note || '';
  }

  /* Every measurement leads with the plain-language answer; the raw
     figure stays in the mini-results underneath for anyone who wants
     the number. */
  function verdict(id, line, detail, tone) {
    var l = document.getElementById(id + '-verdict-line');
    var d = document.getElementById(id + '-verdict-detail');
    if (l) {
      l.textContent = line;
      l.className = 'verdict__line' + (tone ? ' ' + tone : '');
    }
    if (d) d.textContent = detail || '';
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function log(el, msg, cls) {
    if (!el) return;
    var line = document.createElement('div');
    line.className = 'log__line';
    line.innerHTML = '<b>' + stamp() + '</b><span' +
      (cls ? ' class="' + cls + '"' : '') + '>' + msg + '</span>';
    el.appendChild(line);
    while (el.children.length > 60) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
  }

  /* A dot that follows the pointer inside a pad, with a fading trail
     of where you have been. The dot travels on the movement surface
     only — the button strip below it is not a movement area. */
  function makeTracker(root, surface, dotId) {
    var dot = document.getElementById(dotId);
    if (!dot || !surface) return null;
    var TRAIL = 26, trail = [], pool = [], i;
    for (i = 0; i < TRAIL; i++) {
      var t = document.createElement('span');
      t.className = 'trail-dot';
      surface.appendChild(t);
      pool.push(t);
    }
    function renderTrail() {
      for (var j = 0; j < pool.length; j++) {
        if (j < trail.length) {
          var p = trail[trail.length - 1 - j];
          pool[j].style.left = p.x + 'px';
          pool[j].style.top = p.y + 'px';
          pool[j].style.opacity = ((1 - j / pool.length) * 0.5).toFixed(2);
        } else {
          pool[j].style.opacity = 0;
        }
      }
    }
    root.addEventListener('pointerenter', function () { root.classList.add('is-tracked'); });
    root.addEventListener('pointerleave', function () { root.classList.remove('is-tracked'); });
    surface.addEventListener('pointermove', function (e) {
      var r = surface.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      trail.push({ x: x, y: y });
      if (trail.length > TRAIL) trail.shift();
      renderTrail();
    });
    return { clear: function () { trail = []; renderTrail(); } };
  }

  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : 0; }
  function sd(a) {
    if (a.length < 2) return 0;
    var m = mean(a);
    return Math.sqrt(a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / a.length);
  }

  /* =========================================================
     The trackpad shape — a movement surface with a strip of two
     buttons below it, the way a physical trackpad is built.

     The two areas under the surface are the physical left and right
     buttons. A press on one of them is that button being pressed; a
     press on the surface is a tap, which on a real trackpad is a
     left click. A right-click on the surface is how a trackpad's
     two-finger tap arrives, so it is read as a right button too.

     A right-click inside the pad must not open the browser's menu —
     it covers the thing you are trying to look at. The event still
     carries the button, so swallowing the menu loses nothing.
     ========================================================= */
  function makeTrackpad(opts) {
    var root = opts.root;
    var surface = opts.surface;
    var dot = opts.dot;
    var leftBtn = opts.left, rightBtn = opts.right;
    var held = null;

    function light(which) {
      if (leftBtn) leftBtn.classList.toggle('is-down', which === 'left');
      if (rightBtn) rightBtn.classList.toggle('is-down', which === 'right');
      if (surface) surface.classList.remove('is-tapped');
    }

    /* Which button area is under the pointer? null means the movement
       surface, which is not a button. */
    function areaUnder(target) {
      if (leftBtn && leftBtn.contains(target)) return 'left';
      if (rightBtn && rightBtn.contains(target)) return 'right';
      return null;
    }

    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    root.addEventListener('pointerdown', function (e) {
      var area = areaUnder(e.target);
      var button;
      if (e.button === 2) {
        button = 'right';
      } else if (e.button === 1) {
        button = 'middle';
      } else {
        button = 'left';
      }
      held = button;
      /* The two areas are not buttons you can press. They show the button
         the browser reported, so a left click can never light the right
         one — only a real right-click, or a trackpad's two-finger tap,
         can do that. A browser cannot tell a tap from a press of the
         physical button, so button 0 lights the left area either way. */
      light(button === 'right' ? 'right' : (button === 'left' ? 'left' : null));
      if (surface && area === null) surface.classList.add('is-tapped');
      if (area) e.preventDefault();
      if (opts.onDown) opts.onDown(e, button);
    });

    function release(e) {
      if (held === null) return;
      var button = held;
      held = null;
      light(null);
      if (opts.onUp) opts.onUp(e, button);
    }
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    /* A window that loses focus mid-press never delivers the pointerup,
       and a button that stays held for ever is exactly the fault this
       panel is meant to catch. */
    window.addEventListener('blur', function () { release(); });

    if (surface && dot) {
      surface.addEventListener('pointermove', function (e) {
        var r = surface.getBoundingClientRect();
        dot.style.left = (e.clientX - r.left) + 'px';
        dot.style.top = (e.clientY - r.top) + 'px';
      });
    }
  }

  /* The mouse page has its own copy of this, because the two pages do
     not load the same script. */
  $$('[data-nocontext]').forEach(function (el) {
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });

  /* =========================================================
     0. The tester — taps, drags, scrolls and the button state
     ========================================================= */
  var state = { clicks: 0, drags: 0, scrolls: 0, down: false, pressed: false, downT: 0, downX: 0, downY: 0, moved: 0, button: 'up' };

  /* Light a chip when there is something to report. The button chip only
     lights once a press has actually happened, because "up" before the
     first press proves nothing. */
  function chip(id, on, tone) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('is-on', 'is-on--blue', 'is-on--violet', 'is-on--amber');
    if (on) el.classList.add(tone ? 'is-on--' + tone : 'is-on');
  }

  (function tester() {
    var pad = $('#trackpad-pad');
    if (!pad) return;
    var lg = $('#trackpad-log');
    var tracker = makeTracker(pad, $('#trackpad-surface'), 'trackpad-dot');

    function buttonState() {
      var b = state.button;
      setOut('tp-button', b,
        b === 'up' ? 'no button is down' : b + ' is held',
        b === 'up' ? null : 'warn');
      chip('tp-chip-button', state.pressed, b === 'up' ? null : 'warn');
    }

    pad.addEventListener('pointermove', function (e) {
      if (!state.down) return;
      var dx = e.clientX - state.downX, dy = e.clientY - state.downY;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > state.moved) state.moved = d;
    });

    pad.addEventListener('wheel', function (e) {
      e.preventDefault();
      state.scrolls++;
      setOut('tp-scrolls', String(state.scrolls), 'wheel events on the pad', null);
      chip('tp-chip-scrolls', true);
      log(lg, 'scroll', 'ok');
    }, { passive: false });

    makeTrackpad({
      root: pad,
      surface: $('#trackpad-surface'),
      left: $('#trackpad-btn-left'),
      right: $('#trackpad-btn-right'),
      onDown: function (e, button) {
        state.down = true;
        state.pressed = true;
        state.button = button;
        state.downT = performance.now();
        state.downX = e.clientX; state.downY = e.clientY;
        state.moved = 0;
        buttonState();
        log(lg, button + ' down', 'w');
      },
      onUp: function (e, button) {
        state.down = false;
        state.button = 'up';
        var held = performance.now() - state.downT;
        if (state.moved > 4) {
          state.drags++;
          setOut('tp-drags', String(state.drags), 'press, move, release', null);
          chip('tp-chip-drags', true);
          log(lg, button + ' drag — ' + Math.round(state.moved) + 'px, held ' + held.toFixed(0) + 'ms', 'ok');
        } else {
          state.clicks++;
          setOut('tp-clicks', String(state.clicks), 'press and release without moving', null);
          chip('tp-chip-clicks', true);
          log(lg, button + ' click — held ' + held.toFixed(0) + 'ms', 'ok');
        }
        buttonState();
      }
    });

    var reset = $('#trackpad-reset');
    if (reset) reset.addEventListener('click', function () {
      state.clicks = 0; state.drags = 0; state.scrolls = 0; state.pressed = false;
      state.button = 'up'; state.down = false;
      setOut('tp-clicks', '0', 'press and release without moving', null);
      setOut('tp-drags', '0', 'press, move, release', null);
      setOut('tp-scrolls', '0', 'wheel events on the pad', null);
      setOut('tp-button', 'up', 'no button is down', null);
      chip('tp-chip-clicks', false);
      chip('tp-chip-drags', false);
      chip('tp-chip-scrolls', false);
      chip('tp-chip-button', false);
      if (lg) lg.innerHTML = '';
      log(lg, 'reset — move, tap and scroll over the pad');
      if (tracker) tracker.clear();
    });

    buttonState();
    log(lg, 'ready — move, tap and scroll over the pad');
  })();

  /* =========================================================
     0a. The trackpad display — a picture of the pad that answers
         the pointer while it is over it. This is the one you see
         at the top of the page; the tester below does the
         measuring.
     ========================================================= */
  (function display() {
    var pad = $('#tp-display-pad');
    if (!pad) return;

    pad.addEventListener('pointerenter', function () { pad.classList.add('is-live'); });
    pad.addEventListener('pointerleave', function () { pad.classList.remove('is-live'); });

    makeTrackpad({
      root: pad,
      surface: $('#tp-display-surface'),
      dot: $('#tp-display-dot'),
      left: $('#tp-display-btn-left'),
      right: $('#tp-display-btn-right')
    });
  })();

  /* =========================================================
     1. Pointer response — how fast the trackpad reports movement
     ========================================================= */
  (function pointerResponse() {
    var start = $('#ptr-start');
    if (!start) return;
    var supported = 'onpointerrawupdate' in window;
    var lg = $('#ptr-log');
    var status = $('#ptr-status');
    if (status) {
      status.textContent = supported
        ? 'Raw sampling available — this will be a true hardware figure.'
        : 'This browser does not expose raw samples, so the rate will be an estimate of the browser event rate.';
    }

    start.addEventListener('click', function () {
      var raw = 0, rawTimes = [], moveTimes = [], steps = [], lastX = null, lastY = null;
      start.disabled = true;
      setOut('ptr-hz', '…', 'sampling for 1.5 seconds', null);
      setOut('ptr-jitter', '…', 'variation in the sample timing', null);
      setOut('ptr-step', '…', 'pointer travel per report', null);
      verdict('ptr', 'Keep the pointer moving…', 'Move a finger across the trackpad for a second and a half.', null);
      if (lg) lg.innerHTML = '';

      function onRaw(e) {
        raw++;
        rawTimes.push(e.timeStamp);
        if (lastX !== null) steps.push(Math.sqrt(Math.pow(e.clientX - lastX, 2) + Math.pow(e.clientY - lastY, 2)));
        lastX = e.clientX; lastY = e.clientY;
      }
      function onMove(e) {
        moveTimes.push(e.timeStamp);
      }

      window.addEventListener('pointerrawupdate', onRaw, true);
      window.addEventListener('pointermove', onMove, true);

      setTimeout(function () {
        window.removeEventListener('pointerrawupdate', onRaw, true);
        window.removeEventListener('pointermove', onMove, true);
        start.disabled = false;

        var times = supported && rawTimes.length > 4 ? rawTimes : moveTimes;
        var gaps = [];
        for (var i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
        if (!gaps.length) {
          setOut('ptr-hz', '—', 'no movement detected — move the pointer', 'bad');
          setOut('ptr-jitter', '—', 'no samples', 'bad');
          setOut('ptr-step', '—', 'no samples', 'bad');
          verdict('ptr', 'No movement was detected.', 'The pointer did not move during the sample.', 'bad');
          log(lg, 'no pointer movement detected', 'x');
          return;
        }

        /* The rate comes from the median gap between samples, not from the
           sample count over the window. A user who takes a moment to start
           moving would otherwise be told their trackpad is slow. */
        var sorted = gaps.slice().sort(function (a, b) { return a - b; });
        var med = sorted[Math.floor(sorted.length / 2)];
        var hz = Math.max(1, Math.round(1000 / med));
        var jitter = sd(gaps);
        var step = mean(steps);
        var hardware = supported && raw > 20;

        if (!hardware) {
          /* Without raw sampling the number is the browser delivering the
             pointer, not the trackpad reporting it. Judging it against the
             trackpad thresholds would be measuring the display. */
          setOut('ptr-hz', hz + ' ev/s', 'browser pointermove rate (not raw Hz)', 'warn');
          setOut('ptr-jitter', jitter.toFixed(1) + ' ms', 'variation in the browser event timing', 'warn');
          setOut('ptr-step', step.toFixed(1) + ' px', 'pointer travel per event, at the speed you moved', null);
          verdict('ptr', 'Your browser will not report the real rate.',
            hz + ' events per second is the browser delivering the pointer, not the trackpad reporting it. Chrome and Edge expose the raw samples; other browsers do not.',
            'warn');
          log(lg, hz + ' ev/s (estimated), jitter ' + jitter.toFixed(1) + 'ms');
          return;
        }

        setOut('ptr-hz', hz + ' Hz', 'raw input samples per second', hz >= 60 ? 'ok' : 'bad');
        setOut('ptr-jitter', jitter.toFixed(1) + ' ms', 'variation in the sample timing', jitter < 4 ? 'ok' : jitter < 8 ? 'warn' : 'bad');
        setOut('ptr-step', step.toFixed(1) + ' px', 'pointer travel per report, at the speed you moved', null);

        var rateLine = hz >= 120 ? 'That is a fast report rate.'
          : hz >= 60 ? 'That is a typical report rate.'
          : 'That is a low report rate — the pointer will look steppy.';
        var jitterLine = jitter < 4 ? 'The timing is even.'
          : jitter < 8 ? 'The timing is a little uneven.'
          : 'The timing is uneven, and that is what makes a pointer feel stuttery.';
        verdict('ptr', rateLine + ' ' + jitterLine,
          hz + ' reports per second — raw sampling confirmed. A browser cannot tell a trackpad from a mouse, so this is the rate your pointer device reported.',
          hz >= 60 && jitter < 8 ? 'ok' : 'warn');
        log(lg, hz + ' Hz, jitter ' + jitter.toFixed(1) + 'ms, step ' + step.toFixed(1) + 'px');
      }, 1500);
    });
  })();

  /* =========================================================
     2. Scroll response — smooth trackpad or notched wheel
     ========================================================= */
  (function scrollResponse() {
    var start = $('#scr-start');
    if (!start) return;
    var lg = $('#scr-log');
    var deltas = [], times = [], sawCtrl = false, sawX = false, mode = 0;

    start.addEventListener('click', function () {
      deltas = []; times = []; sawCtrl = false; sawX = false; mode = 0;
      start.disabled = true;
      setOut('scr-type', '…', 'watching the shape of the scroll', null);
      setOut('scr-hz', '…', 'scroll events per second', null);
      setOut('scr-delta', '…', 'how much each scroll moves', null);
      setOut('scr-vary', '…', 'how uneven the steps are', null);
      verdict('scr', 'Scroll with two fingers…', 'A few seconds of scrolling on the trackpad is enough.', null);
      if (lg) lg.innerHTML = '';

      function onWheel(e) {
        e.preventDefault();
        times.push(performance.now());
        deltas.push(Math.abs(e.deltaY));
        mode = e.deltaMode;
        /* A pinch arrives as a control-modified scroll with small deltas.
           A mouse wheel with the control key held sends large, even ones,
           so the size has to be part of the test or the two look alike. */
        if (e.ctrlKey && Math.abs(e.deltaY) <= 50) sawCtrl = true;
        if (Math.abs(e.deltaX) > 0) sawX = true;
      }
      window.addEventListener('wheel', onWheel, { passive: false, capture: true });

      setTimeout(function () {
        window.removeEventListener('wheel', onWheel, true);
        start.disabled = false;
        if (deltas.length < 3) {
          setOut('scr-type', '—', 'no scrolling detected', 'bad');
          setOut('scr-hz', '—', 'no scrolling detected', 'bad');
          setOut('scr-delta', '—', 'no scrolling detected', 'bad');
          setOut('scr-vary', '—', 'no scrolling detected', 'bad');
          verdict('scr', 'No scrolling was detected.', 'Nothing scrolled while the sample was running.', 'bad');
          log(lg, 'no scroll events detected', 'x');
          return;
        }

        var secs = (performance.now() - times[0]) / 1000;
        var hz = Math.round(times.length / secs);
        var avg = mean(deltas);
        var vary = sd(deltas);
        /* A browser that reports in lines rather than pixels is still
           perfectly usable, but a "step size in pixels" would be fiction. */
        var inPixels = mode === 0;

        /* A notched wheel repeats the same delta, over and over. A
           trackpad produces a run of different, usually small, values.
           This is a best guess and not a certainty: a browser gives a
           wheel event and a trackpad event the same shape. */
        var same = 0;
        for (var i = 1; i < deltas.length; i++) if (Math.abs(deltas[i] - deltas[i - 1]) < 0.5) same++;
        var repeatRatio = same / (deltas.length - 1);
        var notched = repeatRatio > 0.6 && avg >= 20;

        var type, note;
        if (sawCtrl) { type = 'Trackpad'; note = 'a pinch-zoom gesture reached the page'; }
        else if (sawX) { type = 'Trackpad'; note = 'a horizontal swipe reached the page'; }
        else if (notched) { type = 'Mouse wheel'; note = 'the scroll steps in fixed notches'; }
        else if (vary / Math.max(avg, 0.001) > 0.25 || avg < 20) { type = 'Trackpad'; note = 'the scroll is smooth rather than stepped'; }
        else { type = 'Undetermined'; note = 'the scroll did not look like either'; }

        setOut('scr-type', type, note, type === 'Trackpad' ? 'ok' : type === 'Mouse wheel' ? 'warn' : null);
        setOut('scr-hz', hz + ' Hz', 'scroll events per second', null);
        setOut('scr-delta', inPixels ? avg.toFixed(1) + ' px' : 'not in pixels', inPixels ? 'how much each scroll moves' : 'this browser reports scroll in lines', null);
        setOut('scr-vary', vary.toFixed(1) + ' px', 'how uneven the steps are', vary < 3 ? 'ok' : 'warn');

        var line = type === 'Trackpad' ? 'This is scrolling like a trackpad.'
          : type === 'Mouse wheel' ? 'This is scrolling like a notched mouse wheel.'
          : 'The browser cannot tell from this alone.';
        verdict('scr', line,
          hz + ' scroll events per second, ' +
          (inPixels ? 'averaging ' + avg.toFixed(1) + 'px each' : 'in a unit this browser does not report as pixels') + '. ' +
          'A browser cannot tell a trackpad from a wheel with certainty — this is a best guess.',
          type === 'Trackpad' ? 'ok' : 'warn');
        log(lg, type.toLowerCase() + ' — ' + hz + ' ev/s, ' + avg.toFixed(1) + 'px average, ' + vary.toFixed(1) + 'px variation');
      }, 2500);
    });
  })();

  /* =========================================================
     3. Gestures — do the two-finger gestures reach the page
     ========================================================= */
  (function gestures() {
    var start = $('#gst-start');
    if (!start) return;
    var lg = $('#gst-log');

    start.addEventListener('click', function () {
      var swipe = 0, pinch = 0, ctrlBig = 0;
      start.disabled = true;
      setOut('gst-swipe', '0', 'horizontal swipes seen', null);
      setOut('gst-pinch', '0', 'pinch gestures seen', null);
      setOut('gst-state', 'watching', 'try both gestures over the box', null);
      verdict('gst', 'Try both gestures…', 'A two-finger swipe sideways, then a pinch with two fingers.', null);
      if (lg) lg.innerHTML = '';

      function onWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
          if (Math.abs(e.deltaY) <= 50) {
            /* Small control-modified deltas are the browser’s signal for
               a pinch. Large even ones are a mouse wheel with the
               control key held, which is a different thing entirely. */
            pinch++;
            setOut('gst-pinch', String(pinch), 'pinch gestures seen', 'ok');
            log(lg, 'pinch — zoom gesture reached the page', 'ok');
          } else {
            ctrlBig++;
            log(lg, 'control-modified scroll of ' + Math.abs(e.deltaY) + 'px — too large to be a pinch', 'w');
          }
        }
        if (Math.abs(e.deltaX) > 0) {
          swipe++;
          setOut('gst-swipe', String(swipe), 'horizontal swipes seen', 'ok');
          log(lg, 'horizontal swipe reached the page', 'ok');
        }
        var both = pinch > 0 && swipe > 0;
        setOut('gst-state', both ? 'both working' : (pinch || swipe ? 'one working' : 'none yet'), 'gestures that reached the browser', both ? 'ok' : (pinch || swipe ? 'warn' : null));
        verdict('gst',
          both ? 'Both gestures reached the browser.'
            : (pinch || swipe) ? 'One of the two gestures is getting through.'
            : (ctrlBig ? 'The only control-modified scrolls were large and even, which is a mouse wheel with the control key held rather than a pinch.'
              : 'Neither gesture has reached the browser yet.'),
          'Gestures are claimed by the operating system or the browser before a page sees them, so a gesture that never arrives is a shortcut somebody else owns rather than a hardware fault.',
          both ? 'ok' : 'warn');
      }
      window.addEventListener('wheel', onWheel, { passive: false, capture: true });

      setTimeout(function () {
        window.removeEventListener('wheel', onWheel, true);
        var s = document.getElementById('gst-start');
        if (s) s.disabled = false;
      }, 6000);
    });
  })();
})();
