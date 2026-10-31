/* =========================================================
   InputScope — Mouse Check
   Browser-based pointer diagnostics.
   Everything is measured client-side; nothing is uploaded.
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

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

  // Every measurement leads with the plain-language answer; the raw figure
  // stays in the mini-results underneath for anyone who wants the number.
  function verdict(id, line, detail, tone) {
    var l = document.getElementById(id + '-verdict-line');
    var d = document.getElementById(id + '-verdict-detail');
    if (l) {
      l.textContent = line;
      l.className = 'verdict__line' + (tone ? ' ' + tone : '');
    }
    if (d) d.textContent = detail || '';
  }

  // A dot that follows the pointer inside a pad so it is obvious you are in
  // the test area, plus an optional fading trail of where you have been.
  function makeTracker(pad, dotId, withTrail) {
    var dot = document.getElementById(dotId);
    if (!dot) return null;
    var TRAIL = 22, trail = [], pool = [], i;
    if (withTrail) {
      for (i = 0; i < TRAIL; i++) {
        var t = document.createElement('span');
        t.className = 'trail-dot';
        pad.appendChild(t);
        pool.push(t);
      }
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
    pad.addEventListener('pointerenter', function () { pad.classList.add('is-tracked'); });
    pad.addEventListener('pointerleave', function () { pad.classList.remove('is-tracked'); });
    pad.addEventListener('pointermove', function (e) {
      var r = pad.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      if (withTrail) {
        trail.push({ x: x, y: y });
        if (trail.length > TRAIL) trail.shift();
        renderTrail();
      }
    });
    return {
      clear: function () { trail = []; renderTrail(); }
    };
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

  /* =========================================================
     0. Interactive mouse display
     ------------------------------------------------------------
     The primary test. A top-down diagram of a mouse that lights
     up whichever physical button you press, with a live event log.

     The click counters live here, in one object, because three
     different things read them: the Quick summary tiles, the
     status pill and the Copy results button. The Click tester
     used to show its own row of counter boxes and the summary
     read the numbers back out of them, which meant the same
     figure appeared on screen twice.
     ========================================================= */
  var clickCounts = { left: 0, right: 0, middle: 0, side1: 0, side2: 0, up: 0, down: 0 };
  window.inputScopeClicks = clickCounts;

  (function mouseDisplay() {
    var stage = $('#mouse-stage');
    if (!stage) return;
    var logEl = $('#mouse-display-log');
    var flashTimer = null;

    /* PointerEvent.button: 0 left, 1 middle, 2 right, 3 X1 (back), 4 X2
       (forward). See https://www.w3.org/TR/pointerevents4/ */
    var BUTTONS = { 0: 'left', 1: 'middle', 2: 'right', 3: 'side1', 4: 'side2' };

    var LABELS = {
      left: 'left click',
      right: 'right click',
      middle: 'middle click',
      side1: 'back button',
      side2: 'forward button',
      up: 'scroll up',
      down: 'scroll down'
    };

    function bump(key, delta) {
      clickCounts[key] = (clickCounts[key] || 0) + (delta === undefined ? 1 : delta);
    }

    function flash(btn) {
      $$('.is-hit', stage).forEach(function (n) { n.classList.remove('is-hit'); });
      $$('.is-scroll', stage).forEach(function (n) { n.classList.remove('is-scroll'); });
      $$('.led').forEach(function (n) { n.classList.remove('is-on', 'is-on--blue', 'is-on--violet', 'is-on--amber'); });
      if (!btn) return;
      // Scrolling and middle-clicking both act on the wheel, so the wheel is
      // the region that lights — in a different colour for each.
      var scrolling = (btn === 'up' || btn === 'down');
      var region = stage.querySelector('[data-btn="' + (scrolling ? 'middle' : btn) + '"]');
      if (region) region.classList.add(scrolling ? 'is-scroll' : 'is-hit');
      var ledKey = scrolling ? 'scroll' : btn;
      var led = document.querySelector('[data-led="' + ledKey + '"]');
      if (led) {
        led.classList.add('is-on');
        if (btn === 'middle') led.classList.add('is-on--blue');
        if (scrolling) led.classList.add('is-on--amber');
        if (btn === 'side1' || btn === 'side2') led.classList.add('is-on--violet');
      }
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        $$('.is-hit', stage).forEach(function (n) { n.classList.remove('is-hit'); });
        $$('.is-scroll', stage).forEach(function (n) { n.classList.remove('is-scroll'); });
        $$('.led').forEach(function (n) { n.classList.remove('is-on', 'is-on--blue', 'is-on--violet', 'is-on--amber'); });
      }, 1100);
    }

    function register(btn, e) {
      bump(btn, 1);
      flash(btn);
      var pos = e && e.clientX != null ? ' (' + Math.round(e.clientX) + ', ' + Math.round(e.clientY) + ')' : '';
      log(logEl, LABELS[btn] + pos, btn === 'right' || btn === 'side1' || btn === 'side2' ? 'w' : 'ok');
      stage.classList.add('is-live');
      setTimeout(function () { stage.classList.remove('is-live'); }, 220);
    }

    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* The diagram is a display, not a set of buttons. Which part lights up is
       decided by the physical button you pressed, never by where on the
       diagram you happened to click. The old code fell through to the region
       under the cursor for the left button, so a left click on the right half
       of the picture was logged as a right click — a readout that lied about
       the mouse. */
    stage.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var btn = BUTTONS[e.button];
      if (btn) register(btn, e);
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.deltaY < 0) register('up', e);
      else if (e.deltaY > 0) register('down', e);
      if (e.deltaX < 0) bump('side1', 0);
    }, { passive: false });

    var reset = $('#mouse-display-reset');
    if (reset) reset.addEventListener('click', function () {
      Object.keys(clickCounts).forEach(function (k) { clickCounts[k] = 0; });
      if (logEl) logEl.innerHTML = '';
      log(logEl, 'reset — press any button on your mouse');
    });
  })();

  /* =========================================================
     1. Pointer precision
     ========================================================= */
  (function precision() {
    var pad = $('#precision-pad');
    if (!pad) return;
    var target = null, attempts = 0, hits = 0, errSum = 0, streak = 0, best = 0, radius = 13;
    var started = false;
    var runPos = null;

    // Each run places the first target somewhere random and remembers where
    // it went, so Reset can put the dot back exactly where the run began.
    function spawnAt(pos) {
      var r = pad.getBoundingClientRect();
      var x = pos ? pos.x : rnd(r.width * .12, r.width * .88);
      var y = pos ? pos.y : rnd(r.height * .16, r.height * .84);
      target = document.createElement('div');
      target.className = 'hitpad__target';
      target.style.left = x + 'px';
      target.style.top = y + 'px';
      pad.appendChild(target);
      return { x: x, y: y };
    }

    function reset() {
      attempts = hits = errSum = streak = best = 0;
      started = false;
      $$('.hitpad__target', pad).forEach(function (n) { n.remove(); });
      var hint = $('.hitpad__hint', pad);
      if (hint) hint.classList.remove('hidden');
    }

    pad.addEventListener('click', function (e) {
      var r = pad.getBoundingClientRect();
      var cx = e.clientX - r.left, cy = e.clientY - r.top;
      if (!target) {
        runPos = spawnAt(null);
        started = true;
        var hint = $('.hitpad__hint', pad);
        if (hint) hint.classList.add('hidden');
        return;
      }
      var t = target.getBoundingClientRect();
      var tx = t.left + t.width / 2 - r.left, ty = t.top + t.height / 2 - r.top;
      var d = Math.hypot(cx - tx, cy - ty);
      attempts++;
      var hit = d <= radius;
      if (hit) {
        hits++; errSum += d; streak++; best = Math.max(best, streak);
        target.classList.add('hit');
        setOut('precision-acc', Math.round(hits / attempts * 100) + '%', 'hits / ' + attempts + ' attempts', 'ok');
      } else {
        streak = 0;
        target.classList.add('miss');
        setOut('precision-acc', Math.round(hits / attempts * 100) + '%', 'hits / ' + attempts + ' attempts', 'warn');
      }
      setOut('precision-err', hit && attempts > 1 ? (errSum / hits).toFixed(1) + 'px' : '—', 'average miss radius from centre', null);
      setOut('precision-streak', best, 'longest clean run', null);

      var pct = Math.round(hits / attempts * 100);
      var vline = pct >= 95 ? 'Your aim is very accurate.'
        : pct >= 85 ? 'Your aim is accurate.'
        : pct >= 70 ? 'Your aim is a little loose.'
        : 'Your aim is loose — check your mouse sensitivity.';
      var vdetail = pct + '% of ' + attempts + ' targets hit' +
        (hits ? ', average miss ' + (errSum / hits).toFixed(1) + 'px from the centre' : '') + '.';
      verdict('precision', vline, vdetail, pct >= 85 ? 'ok' : pct >= 70 ? 'warn' : 'bad');

      setTimeout(function () {
        target.remove();
        target = null;
        if (attempts < 20) spawnAt(null);
      }, hit ? 130 : 320);
    });

    var startBtn = $('#precision-start');
    if (startBtn) startBtn.addEventListener('click', function () {
      reset();
      runPos = spawnAt(null);
      started = true;
      pad.classList.remove('hitpad--ready');
      var hint = $('.hitpad__hint', pad);
      if (hint) hint.classList.add('hidden');
      setOut('precision-acc', '0%', 'click the blue dots', null);
      verdict('precision', 'Go on — click each blue target.', 'Twenty targets gives a reliable result.', null);
    });

    var resetBtn = $('#precision-reset');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      reset();
      if (runPos) spawnAt(runPos);
      started = false;
      pad.classList.add('hitpad--ready');
      var hint = $('.hitpad__hint', pad);
      if (hint) hint.classList.remove('hidden');
      setOut('precision-acc', '—', 'click the blue dots', null);
      setOut('precision-err', '—', 'average miss radius from centre', null);
      setOut('precision-streak', '0', 'longest clean run', null);
      verdict('precision', 'Ready when you are.',
        'Press Start, then click each target — the blue dot is back where it started.', null);
    });
  })();

  /* =========================================================
     2. Drag accuracy
     ========================================================= */
  (function dragTest() {
    var track = $('#drag-track');
    if (!track) return;
    var handle = $('#drag-handle');
    var zone = $('#drag-target');
    var dragging = false, offset = 0, attempts = 0, sumErr = 0, done = 0;

    function layout() {
      var r = track.getBoundingClientRect();
      zone.style.left = (r.width * .62) + 'px';
      zone.style.top = ((r.height - zone.offsetHeight) / 2) + 'px';
    }

    // The block used to sit in the very corner on first load and only moved
    // to the middle when the reset button was pressed, so the two states
    // disagreed. Both now use this.
    function placeHandle() {
      handle.style.left = '24px';
      handle.style.top = ((track.getBoundingClientRect().height - handle.offsetHeight) / 2) + 'px';
    }

    function evaluate() {
      var hr = handle.getBoundingClientRect();
      var zr = zone.getBoundingClientRect();
      var dx = (hr.left + hr.width / 2) - (zr.left + zr.width / 2);
      var dy = (hr.top + hr.height / 2) - (zr.top + zr.height / 2);
      var d = Math.hypot(dx, dy);
      offset = d;
      attempts++; sumErr += d; done++;
      setOut('drag-offset', d.toFixed(1) + 'px', 'distance from target centre', d < 8 ? 'ok' : d < 20 ? 'warn' : 'bad');
      setOut('drag-score', done, 'every drop, landed or not', null);
      var vline = d < 8 ? 'You are as accurate while dragging as while clicking.'
        : d < 20 ? 'You are a little less accurate while dragging.'
        : 'You lose a lot of accuracy while dragging.';
      verdict('drag', vline, d.toFixed(1) + 'px from the centre, over ' + done +
        (done === 1 ? ' drop.' : ' drops.'), d < 8 ? 'ok' : d < 20 ? 'warn' : 'bad');
    }

    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      track.classList.add('is-dragging');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var r = track.getBoundingClientRect();
      var bw = handle.offsetWidth, bh = handle.offsetHeight;
      // The block follows the pointer by its centre, not by its top-left
      // corner. It used to be placed by the corner while the measurement
      // compared centres, which put a permanent 28px bias on every drop —
      // a pixel-perfect landing scored as a bad one.
      var x = clamp(e.clientX - r.left - bw / 2, 0, Math.max(0, r.width - bw));
      var y = clamp(e.clientY - r.top - bh / 2, 0, Math.max(0, r.height - bh));
      handle.style.left = x + 'px';
      handle.style.top = y + 'px';
    });
    handle.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      evaluate();
    });

    var start = $('#drag-start');
    function reset() {
      layout();
      track.classList.remove('is-dragging');
      placeHandle();
      setOut('drag-offset', '—', 'drag the block into the target zone', null);
      setOut('drag-score', '0', 'every drop, landed or not', null);
      verdict('drag', 'Ready when you are.', 'Drag the block into the zone and let go.', null);
    }

    if (start) start.addEventListener('click', reset);

    window.addEventListener('resize', layout);
    layout();
    placeHandle();
  })();

  /* =========================================================
     4. Double-click speed
     ========================================================= */
  (function dbl() {
    var pad = $('#dbl-pad');
    if (!pad) return;
    var last = 0, lastEvent = 0, intervals = [];
    var lg = $('#dbl-log');

    pad.addEventListener('click', function (e) {
      var now = performance.now();
      if (last) {
        var gap = now - last;
        if (gap < 600) {
          intervals.push(gap);
          setOut('dbl-time', (gap < 10 ? gap.toFixed(1) : Math.round(gap)) + 'ms', 'time between your two clicks', gap < 300 ? 'ok' : 'warn');
          var ms = (gap < 10 ? gap.toFixed(1) : Math.round(gap));
          setOut('dbl-time', ms + 'ms', 'time between your two clicks', gap < 300 ? 'ok' : gap < 450 ? 'warn' : 'bad');
          var vline = gap < 300 ? 'Your double-click is snappy.'
            : gap < 450 ? 'Your double-click is normal.'
              : 'Your double-click is slow.';
          var vdetail = gap < 300
            ? ms + 'ms between your two clicks — well inside the 500ms window.'
            : gap < 450
              ? ms + 'ms between your two clicks. A healthy mouse lands inside 450ms.'
              : ms + 'ms between your two clicks — close to the 500ms limit where the system stops treating it as one click.';
          var vtone = gap < 450 ? 'ok' : 'warn';
          setOut('dbl-verdict', gap < 300 ? 'Snappy' : gap < 450 ? 'Normal' : 'Slow',
            gap < 300 ? 'comfortably inside the 500ms window'
              : gap < 450 ? 'typical for a healthy mouse'
                : 'raise your double-click speed setting', vtone);
          verdict('dbl', vline, vdetail, vtone);
          log(lg, 'double-click interval ' + Math.round(gap) + 'ms');
        }
      }
      last = now;
    });

    pad.addEventListener('dblclick', function () { lastEvent = performance.now(); });

    var start = $('#dbl-start');
    if (start) start.addEventListener('click', function () {
      intervals = [];
      last = 0;
      setOut('dbl-time', '—', 'double-click the pad', null);
      setOut('dbl-verdict', '—', 'no measurement yet', null);
      verdict('dbl', 'Ready when you are.', 'Double-click the pad a few times.', null);
      if (lg) lg.innerHTML = '';
      log(lg, 'double-click the pad a few times');
    });
  })();

  /* =========================================================
     5. Scroll wheel
     ========================================================= */
  (function scrollTest() {
    var pad = $('#scroll-pad');
    if (!pad) return;
    var up = 0, down = 0, horiz = 0, lastDelta = 0;
    var lg = $('#scroll-log');
    var dirEl = $('#scroll-dir'), arrow = $('#scroll-dir-arrow'), dirText = $('#scroll-dir-text');
    var dirTimer = null;

    // Shows which way the wheel is turning, right where the pointer is.
    function showDir(dir) {
      pad.classList.add('is-active');
      if (!dirEl) return;
      dirEl.classList.add('is-on');
      dirEl.classList.toggle('scroll-dir--side', dir === 'side');
      if (arrow) arrow.textContent = dir === 'up' ? '\u25B2' : dir === 'down' ? '\u25BC' : '\u25C0\u25B6';
      if (dirText) dirText.textContent = dir === 'up' ? 'Scrolling up'
        : dir === 'down' ? 'Scrolling down' : 'Scrolling sideways';
      clearTimeout(dirTimer);
      dirTimer = setTimeout(function () { dirEl.classList.remove('is-on'); }, 700);
    }

    pad.addEventListener('wheel', function (e) {
      e.preventDefault();
      var dir = e.deltaY < 0 ? 'up' : e.deltaY > 0 ? 'down' : (e.deltaX !== 0 ? 'side' : '');
      if (e.deltaY < 0) up++; else if (e.deltaY > 0) down++;
      if (e.deltaX !== 0) horiz++;
      lastDelta = Math.abs(e.deltaY);
      if (dir) showDir(dir);
      setOut('scroll-up', up + ' / ' + down, 'up first, then down', up > 0 || down > 0 ? 'ok' : null);
      setOut('scroll-h', horiz, 'horizontal notches', horiz > 0 ? 'ok' : null);
      setOut('scroll-delta', Math.round(lastDelta), 'the last scroll step', null);

      if (horiz > 0) {
        verdict('scroll', 'Your wheel also scrolls sideways.',
          'That is a tilt wheel, or something is intercepting the pointer.', 'warn');
      } else if (up + down > 0) {
        verdict('scroll', 'Your wheel is scrolling.',
          up + ' notch' + (up === 1 ? '' : 'es') + ' up, ' + down + ' down \u00b7 ' +
          Math.round(lastDelta) + ' pixels per notch.', 'ok');
      } else {
        verdict('scroll', 'No scroll events reached the page.',
          'Nothing scrolled when you used the wheel.', 'bad');
      }
    }, { passive: false });

    var start = $('#scroll-start');
    if (start) start.addEventListener('click', function () {
      up = down = horiz = 0;
      pad.classList.remove('is-active');
      if (dirEl) dirEl.classList.remove('is-on');
      clearTimeout(dirTimer);
      setOut('scroll-up', '0 / 0', 'up first, then down', null);
      setOut('scroll-h', '0', 'horizontal notches', null);
      setOut('scroll-delta', '—', 'the last scroll step', null);
      verdict('scroll', 'Ready when you are.', 'Scroll up, down, then sideways if your wheel tilts.', null);
      if (lg) lg.innerHTML = '';
      log(lg, 'scroll up, down, then sideways if you have a tilt wheel');
    });
  })();

  /* =========================================================
     6. Polling rate
     ========================================================= */
  (function polling() {
    var supported = 'onpointerrawupdate' in window;
    var out = $('#polling-status');
    if (out) out.textContent = supported ? 'raw sampling available' : 'fallback: browser event rate';

    var start = $('#polling-start');
    var meter = $('#polling-meter');
    var lg = $('#polling-log');
    if (!start) return;

    start.addEventListener('click', function () {
      var raw = 0, moves = 0, t0 = performance.now(), raf = 0, lastMove = 0;
      setOut('poll-hz', '…', 'sampling for 1 second', null);
      setOut('poll-note', '—', 'how the rate was measured', null);
      verdict('poll', 'Keep the mouse moving…', 'Sampling for one second.', null);
      if (lg) lg.innerHTML = '';

      function onRaw() { raw++; }
      function onMove() { moves++; lastMove = performance.now(); }

      if (supported) window.addEventListener('pointerrawupdate', onRaw, true);
      window.addEventListener('pointermove', onMove, true);

      raf = requestAnimationFrame(function tick() {
        if (performance.now() - t0 < 1000) { raf = requestAnimationFrame(tick); return; }
        window.removeEventListener('pointerrawupdate', onRaw, true);
        window.removeEventListener('pointermove', onMove, true);

        var secs = (performance.now() - t0) / 1000;
        var hz = supported ? Math.round(raw / secs) : 0;
        var evRate = Math.round(moves / secs);

        if (supported && raw > 20) {
          setOut('poll-hz', hz + ' Hz', 'raw input samples per second', hz >= 1000 ? 'ok' : hz >= 500 ? 'warn' : 'bad');
          setOut('poll-note', 'Hardware-grade', 'raw pointer sampling confirmed', hz >= 500 ? 'ok' : 'warn');
          var pline = hz >= 1000 ? 'That is a pro-gaming mouse.'
            : hz >= 500 ? 'That is a fast gaming mouse.'
            : hz >= 125 ? 'That is a standard office mouse.'
            : 'That is an unusually slow polling rate.';
          verdict('poll', pline, hz + ' Hz — ' + hz + ' position reports every second.',
            hz >= 1000 ? 'ok' : hz >= 500 ? 'warn' : 'bad');
          log(lg, 'raw polling rate: ' + hz + ' Hz');
        } else if (moves > 20) {
          setOut('poll-hz', evRate + ' ev/s', 'browser pointermove rate (not raw Hz)', 'warn');
          setOut('poll-note', 'Estimated only', 'raw sampling not exposed by this browser', 'warn');
          verdict('poll', 'Your browser will not report the real rate.',
            evRate + ' events per second is an estimate, not a measurement.', 'warn');
          log(lg, 'browser event rate: ' + evRate + ' ev/s — raw rate not measurable here', 'w');
        } else {
          setOut('poll-hz', '—', 'no movement detected — move the mouse', 'bad');
          setOut('poll-note', 'No signal', 'the mouse did not move during sampling', 'bad');
          verdict('poll', 'No movement was detected.', 'The mouse did not move during the sample.', 'bad');
          log(lg, 'no pointer movement detected', 'x');
        }
        if (meter) meter.style.width = supported && raw > 20 ? Math.min(100, hz / 12.5) + '%' : '0%';
      });
    });
  })();

  /* =========================================================
     7. Motion smoothness / jitter
     ========================================================= */
  (function motion() {
    var pad = $('#motion-pad');
    if (!pad) return;
    var samples = [], running = false, t0 = 0, timer = null;
    var lg = $('#motion-log');
    var tracker = makeTracker(pad, 'motion-dot', true);

    function onMove(e) {
      if (!running) return;
      samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    }

    function analyse() {
      running = false;
      pad.removeEventListener('pointermove', onMove);
      if (samples.length < 12) {
        setOut('motion-avg', '—', 'not enough movement data', 'bad');
        setOut('motion-jitter', '—', 'move the mouse more', null);
        setOut('motion-smooth', '—', 'move the pointer inside the box', null);
        verdict('motion', 'Not enough movement was captured.',
          'Move the pointer inside the box, in slow circles, and try again.', 'bad');
        if (lg) log(lg, 'not enough samples — circle the pointer around the pad', 'x');
        return;
      }
      var deltas = [];
      for (var i = 1; i < samples.length; i++) deltas.push(samples[i].t - samples[i - 1].t);
      var mean = deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length;
      var variance = deltas.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / deltas.length;
      var sd = Math.sqrt(variance);
      var longest = 0, run = 0;
      deltas.forEach(function (d) { run = d > 40 ? run + 1 : 0; longest = Math.max(longest, run); });

      setOut('motion-avg', mean.toFixed(1) + 'ms', 'mean gap between pointer events', mean < 12 ? 'ok' : 'warn');
      setOut('motion-jitter', sd.toFixed(1) + 'ms', 'standard deviation of those gaps', sd < 8 ? 'ok' : sd < 18 ? 'warn' : 'bad');
      setOut('motion-smooth', mean < 12 && sd < 8 ? 'Smooth' : sd < 18 ? 'Fair' : 'Choppy',
        'based on mean and jitter', mean < 12 && sd < 8 ? 'ok' : sd < 18 ? 'warn' : 'bad');
      var mline = mean < 12 && sd < 8 ? 'Your movement is smooth.'
        : sd < 18 ? 'Your movement is a little uneven.'
        : 'Your movement is choppy.';
      verdict('motion', mline,
        'Mean gap ' + mean.toFixed(1) + 'ms, jitter ' + sd.toFixed(1) + 'ms.',
        mean < 12 && sd < 8 ? 'ok' : sd < 18 ? 'warn' : 'bad');
      if (lg) log(lg, samples.length + ' samples · mean ' + mean.toFixed(1) + 'ms · jitter ' + sd.toFixed(1) + 'ms');
    }

    var start = $('#motion-start');
    if (start) start.addEventListener('click', function () {
      samples = [];
      running = true;
      setOut('motion-avg', '…', 'mean gap between pointer events', null);
      setOut('motion-jitter', '…', 'standard deviation of those gaps', null);
      setOut('motion-smooth', '…', 'based on mean and jitter', null);
      verdict('motion', 'Keep moving…', 'Move the pointer inside the box for two seconds.', null);
      pad.addEventListener('pointermove', onMove);
      clearTimeout(timer);
      timer = setTimeout(analyse, 2000);
    });

    var resetBtn = $('#motion-reset');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      running = false;
      clearTimeout(timer);
      samples = [];
      pad.removeEventListener('pointermove', onMove);
      if (tracker) tracker.clear();
      setOut('motion-avg', '—', 'not measured yet', null);
      setOut('motion-jitter', '—', 'not measured yet', null);
      setOut('motion-smooth', '—', 'not measured yet', null);
      verdict('motion', 'Ready when you are.',
        'Move the pointer into the box — the dot follows you — then press Start.', null);
      if (lg) lg.innerHTML = '';
      log(lg, 'reset — move the pointer inside the box and press Start');
    });
  })();

  /* =========================================================
     8. Hover latency
     ========================================================= */
  (function hover() {
    var pad = $('#hover-pad');
    if (!pad) return;
    var samples = [];
    var WINDOW = 10;
    var lg = $('#hover-log');
    makeTracker(pad, 'hover-dot', false);

    /* The delay is measured from the moment the platform created the event to
       the moment the page received it. e.timeStamp is the creation time, so
       performance.now() - e.timeStamp is the real input-to-delivery latency:
       about one frame period on a 60 Hz display, and it does not move when
       you linger inside the box.

       The old version timed the pointerenter handler against the next
       pointermove and pushed a sample for every move. The reading then grew
       by a frame for every frame you spent inside the box, so it measured
       how long you hovered rather than how fast the page noticed — and the
       verdict never moved, because the number was not a latency at all. */
    pad.addEventListener('pointerenter', function (e) {
      var lag = performance.now() - e.timeStamp;
      if (lag >= 0 && lag < 2000) {
        samples.push(lag);
        while (samples.length > WINDOW) samples.shift();
        log(lg, 'hover ' + lag.toFixed(1) + 'ms', lag < 25 ? 'ok' : lag < 60 ? 'w' : 'x');
      }
      setOut('hover-state', 'Hovering', 'pointer is over the target', 'ok');
      verdict('hover', 'You are hovering over the box.',
        'Move away and come back a few times to measure the delay.', null);
    });
    pad.addEventListener('pointerleave', function () {
      setOut('hover-state', 'Outside', 'pointer left the target', null);
    });

    var start = $('#hover-start');
    if (start) start.addEventListener('click', function () {
      samples = [];
      setOut('hover-state', '—', 'move the pointer over the pad', null);
      setOut('hover-latency', '—', 'awaiting hover', null);
      verdict('hover', 'Ready when you are.', 'Move the pointer over the box, then away and back again.', null);
      if (lg) lg.innerHTML = '';
      log(lg, 'hover in and out of the pad a few times');
    });

    setInterval(function () {
      if (!samples.length) return;
      var avg = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;
      setOut('hover-latency', avg.toFixed(1) + 'ms', 'input to page', avg < 25 ? 'ok' : avg < 60 ? 'warn' : 'bad');
      var hline = avg < 25 ? 'Hover registers instantly.'
        : avg < 60 ? 'Hover takes a moment to register.'
        : 'Hover is slow to register.';
      verdict('hover', hline,
        'Average ' + avg.toFixed(1) + 'ms from the pointer arriving to the page seeing it · ' +
        samples.length + ' hover' + (samples.length === 1 ? '' : 's') + ' measured.',
        avg < 25 ? 'ok' : avg < 60 ? 'warn' : 'bad');
    }, 700);
  })();

  /* =========================================================
     Summary + run all
     ========================================================= */
  var summary = $('#mouse-summary');
  var LABELS = {
    'disp-left': 'Left clicks',
    'disp-right': 'Right clicks',
    'disp-middle': 'Middle clicks',
    'disp-side': 'Side buttons',
    'disp-scroll': 'Scroll events',
    'precision-acc': 'Precision',
    'precision-err': 'Avg offset',
    'precision-streak': 'Best streak',
    'drag-offset': 'Drag accuracy',
    'drag-score': 'Drops',
    'dbl-time': 'Double-click',
    'dbl-verdict': 'Double-click verdict',
    'scroll-up': 'Scroll notches',
    'scroll-down': 'Scroll notches',
    'scroll-h': 'Horizontal',
    'scroll-delta': 'Pixels per notch',
    'poll-hz': 'Polling rate',
    'poll-note': 'Rate confidence',
    'motion-avg': 'Mean interval',
    'motion-jitter': 'Motion jitter',
    'motion-smooth': 'Motion verdict',
    'hover-state': 'Hover state',
    'hover-latency': 'Hover delay'
  };
  /* The click counters come from the shared object; every other reading
     still comes from the panel that produced it. */
  function clickValue(key) {
    if (key === 'disp-left') return String(clickCounts.left);
    if (key === 'disp-right') return String(clickCounts.right);
    if (key === 'disp-middle') return String(clickCounts.middle);
    if (key === 'disp-scroll') return String(clickCounts.up + clickCounts.down);
    return null;
  }
  function buildSummary() {
    if (!summary) return;
    var keys = ['disp-left', 'disp-right', 'disp-middle', 'disp-scroll', 'precision-acc', 'dbl-time', 'poll-hz'];
    summary.innerHTML = keys.map(function (k) {
      var v = document.querySelector('[data-out="' + k + '"]');
      var n = document.querySelector('[data-note="' + k + '"]');
      var value = clickValue(k);
      if (value === null) value = v ? v.textContent : '—';
      return '<div class="tile"><div class="tile__k">' + (LABELS[k] || k) + '</div>' +
        '<div class="tile__v" style="font-size:1.05rem">' + value + '</div>' +
        '<div class="tile__note">' + (n ? n.textContent : '') + '</div></div>';
    }).join('');
  }
  setInterval(buildSummary, 900);
  buildSummary();

  var runAll = $('#mouse-run-all');
  if (runAll) runAll.addEventListener('click', function () {
    ['#polling-start', '#motion-start', '#dbl-start'].forEach(function (sel) {
      var b = document.querySelector(sel);
      if (b) b.click();
    });
  });

  /* ---------------- global guard: block the context menu over tool areas ---------------- */
  $$('[data-nocontext]').forEach(function (el) {
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });
  var stage = $('#mouse-stage');
  if (stage) {
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
})();
