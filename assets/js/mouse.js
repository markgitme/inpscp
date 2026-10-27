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
     ========================================================= */
  (function mouseDisplay() {
    var stage = $('#mouse-stage');
    if (!stage) return;
    var logEl = $('#mouse-display-log');
    var counts = { left: 0, right: 0, middle: 0, side1: 0, side2: 0, up: 0, down: 0 };
    var flashTimer = null;

    var LABELS = {
      left: 'left click',
      right: 'right click',
      middle: 'middle click',
      side1: 'back button',
      side2: 'forward button',
      up: 'scroll up',
      down: 'scroll down'
    };

    var SHORT = {
      left: 'left', right: 'right', middle: 'middle',
      side1: 'back', side2: 'forward', up: 'scroll ↑', down: 'scroll ↓'
    };

    function bump(key, delta) {
      counts[key] = (counts[key] || 0) + (delta === undefined ? 1 : delta);
      var map = {
        left: 'disp-left', right: 'disp-right', middle: 'disp-middle',
        side1: 'disp-side', side2: 'disp-side'
      };
      var out = map[key];
      if (out) {
        var el = document.querySelector('[data-out="' + out + '"]');
        if (el) el.textContent = key === 'side2'
          ? String(counts.side1 + counts.side2)
          : String(counts[key]);
      }
      if (key === 'up' || key === 'down') {
        var s = document.querySelector('[data-out="disp-scroll"]');
        if (s) s.textContent = String(counts.up + counts.down);
      }
    }

    function flash(btn) {
      $$('.is-hit', stage).forEach(function (n) { n.classList.remove('is-hit'); });
      $$('.led').forEach(function (n) { n.classList.remove('is-on', 'is-on--blue', 'is-on--violet'); });
      if (!btn) return;
      var region = stage.querySelector('[data-btn="' + btn + '"]');
      if (region) region.classList.add('is-hit');
      var ledKey = (btn === 'up' || btn === 'down') ? 'scroll' : btn;
      var led = document.querySelector('[data-led="' + ledKey + '"]');
      if (led) {
        led.classList.add('is-on');
        if (btn === 'middle' || btn === 'up' || btn === 'down') led.classList.add('is-on--blue');
        if (btn === 'side1' || btn === 'side2') led.classList.add('is-on--violet');
      }
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        $$('.is-hit', stage).forEach(function (n) { n.classList.remove('is-hit'); });
        $$('.led').forEach(function (n) { n.classList.remove('is-on', 'is-on--blue', 'is-on--violet'); });
      }, 1100);
    }

    function register(btn, e) {
      bump(btn, 1);
      flash(btn);
      var pos = e && e.clientX != null ? ' (' + Math.round(e.clientX) + ', ' + Math.round(e.clientY) + ')' : '';
      log(logEl, LABELS[btn] + pos, btn === 'right' || btn === 'side1' || btn === 'side2' ? 'w' : 'ok');
      setOut('disp-last', SHORT[btn] || LABELS[btn], 'most recent input event', null);
      stage.classList.add('is-live');
      setTimeout(function () { stage.classList.remove('is-live'); }, 220);
    }

    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    stage.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var region = e.target.closest ? e.target.closest('[data-btn]') : null;
      var btn;
      if (e.button === 2) btn = 'right';
      else if (e.button === 1) btn = 'middle';
      else if (region) btn = region.getAttribute('data-btn');
      else btn = 'left';
      register(btn, e);
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.deltaY < 0) register('up', e);
      else if (e.deltaY > 0) register('down', e);
      if (e.deltaX < 0) bump('side1', 0);
    }, { passive: false });

    var reset = $('#mouse-display-reset');
    if (reset) reset.addEventListener('click', function () {
      counts = { left: 0, right: 0, middle: 0, side1: 0, side2: 0, up: 0, down: 0 };
      ['disp-left', 'disp-right', 'disp-middle', 'disp-side', 'disp-scroll'].forEach(function (k) {
        setOut(k, '0', '', null);
      });
      setOut('disp-last', '—', 'no input yet', null);
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

    function spawn() {
      var r = pad.getBoundingClientRect();
      var x = rnd(r.width * .12, r.width * .88);
      var y = rnd(r.height * .16, r.height * .84);
      target = document.createElement('div');
      target.className = 'hitpad__target';
      target.style.left = x + 'px';
      target.style.top = y + 'px';
      pad.appendChild(target);
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
        spawn();
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

      setTimeout(function () {
        target.remove();
        target = null;
        if (attempts < 20) spawn();
      }, hit ? 130 : 320);
    });

    var startBtn = $('#precision-start');
    if (startBtn) startBtn.addEventListener('click', function () {
      reset();
      spawn();
      started = true;
      var hint = $('.hitpad__hint', pad);
      if (hint) hint.classList.add('hidden');
      setOut('precision-acc', '0%', 'click the blue dots', null);
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

    function evaluate() {
      var hr = handle.getBoundingClientRect();
      var zr = zone.getBoundingClientRect();
      var dx = (hr.left + hr.width / 2) - (zr.left + zr.width / 2);
      var dy = (hr.top + hr.height / 2) - (zr.top + zr.height / 2);
      var d = Math.hypot(dx, dy);
      offset = d;
      attempts++; sumErr += d; done++;
      setOut('drag-offset', d.toFixed(1) + 'px', 'distance from target centre', d < 8 ? 'ok' : d < 20 ? 'warn' : 'bad');
      setOut('drag-score', done, 'drops measured', null);
    }

    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var r = track.getBoundingClientRect();
      var x = clamp(e.clientX - r.left, 0, r.width);
      var y = clamp(e.clientY - r.top, 0, r.height);
      handle.style.left = x + 'px';
      handle.style.top = y + 'px';
    });
    handle.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      evaluate();
    });

    var start = $('#drag-start');
    if (start) start.addEventListener('click', function () {
      layout();
      handle.style.left = '24px';
      handle.style.top = ((track.getBoundingClientRect().height - handle.offsetHeight) / 2) + 'px';
      setOut('drag-offset', '—', 'drag the slider onto the marker', null);
    });

    window.addEventListener('resize', layout);
    layout();
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
          setOut('dbl-time', (gap < 10 ? gap.toFixed(1) : Math.round(gap)) + 'ms', 'measured interval', gap < 300 ? 'ok' : 'warn');
          var verdict = gap < 300 ? 'Snappy — comfortably inside the 500ms window'
            : gap < 450 ? 'Normal — typical for a healthy mouse'
              : 'Slow — raise your double-click speed setting';
          setOut('dbl-verdict', verdict.split(' — ')[0], verdict.split(' — ')[1], gap < 300 ? 'ok' : gap < 450 ? 'warn' : 'bad');
          log(lg, 'double-click interval ' + Math.round(gap) + 'ms');
        }
      }
      last = now;
    });

    pad.addEventListener('dblclick', function () { lastEvent = performance.now(); });

    var start = $('#dbl-start');
    if (start) start.addEventListener('click', function () {
      intervals = [];
      setOut('dbl-time', '—', 'double-click the pad', null);
      setOut('dbl-verdict', '—', 'no measurement yet', null);
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

    pad.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.deltaY < 0) up++; else if (e.deltaY > 0) down++;
      if (e.deltaX !== 0) horiz++;
      lastDelta = Math.abs(e.deltaY);
      setOut('scroll-up', up + ' / ' + down, 'notches up / down', up > 0 || down > 0 ? 'ok' : null);
      setOut('scroll-h', horiz, 'horizontal notches', horiz > 0 ? 'ok' : null);
      setOut('scroll-delta', Math.round(lastDelta), 'pixels per notch', null);
    }, { passive: false });

    var start = $('#scroll-start');
    if (start) start.addEventListener('click', function () {
      up = down = horiz = 0;
      setOut('scroll-up', '0 / 0', 'notches up / down', null);
      setOut('scroll-h', '0', 'horizontal notches', null);
      setOut('scroll-delta', '—', 'pixels per notch', null);
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
          log(lg, 'raw polling rate: ' + hz + ' Hz');
        } else if (moves > 20) {
          setOut('poll-hz', evRate + ' ev/s', 'browser pointermove rate (not raw Hz)', 'warn');
          setOut('poll-note', 'Estimated only', 'raw sampling not exposed by this browser', 'warn');
          log(lg, 'browser event rate: ' + evRate + ' ev/s — raw rate not measurable here', 'w');
        } else {
          setOut('poll-hz', '—', 'no movement detected — move the mouse', 'bad');
          setOut('poll-note', 'No signal', 'the mouse did not move during sampling', 'bad');
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
    var samples = [], running = false, t0 = 0;
    var lg = $('#motion-log');

    function onMove(e) {
      if (!running) return;
      samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    }

    function analyse() {
      running = false;
      window.removeEventListener('pointermove', onMove, true);
      if (samples.length < 12) {
        setOut('motion-avg', '—', 'not enough movement data', 'bad');
        setOut('motion-jitter', '—', 'move the mouse more', null);
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
      if (lg) log(lg, samples.length + ' samples · mean ' + mean.toFixed(1) + 'ms · jitter ' + sd.toFixed(1) + 'ms');
    }

    var start = $('#motion-start');
    if (start) start.addEventListener('click', function () {
      samples = [];
      running = true;
      setOut('motion-avg', '…', 'move the mouse for 2 seconds', null);
      setOut('motion-jitter', '…', 'measuring', null);
      window.addEventListener('pointermove', onMove, true);
      setTimeout(analyse, 2000);
    });
  })();

  /* =========================================================
     8. Hover latency
     ========================================================= */
  (function hover() {
    var pad = $('#hover-pad');
    if (!pad) return;
    var enterT = 0, latency = null, samples = [], active = false;
    var lg = $('#hover-log');

    pad.addEventListener('pointerenter', function () {
      enterT = performance.now();
      active = true;
      setOut('hover-state', 'Hovering', 'pointer is over the target', 'ok');
    });
    pad.addEventListener('pointerleave', function () {
      active = false;
      setOut('hover-state', 'Outside', 'pointer left the target', null);
    });
    pad.addEventListener('pointermove', function () {
      if (!active || !enterT) return;
      var d = performance.now() - enterT;
      if (d < 900) { samples.push(d); latency = d; }
    });

    var start = $('#hover-start');
    if (start) start.addEventListener('click', function () {
      samples = []; latency = null;
      setOut('hover-state', '—', 'move the pointer over the pad', null);
      setOut('hover-latency', '—', 'awaiting hover', null);
      if (lg) lg.innerHTML = '';
      log(lg, 'hover in and out of the pad a few times');
    });

    setInterval(function () {
      if (!samples.length) return;
      var avg = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;
      setOut('hover-latency', avg.toFixed(1) + 'ms', 'time to register a hover', avg < 25 ? 'ok' : avg < 60 ? 'warn' : 'bad');
    }, 700);
  })();

  /* =========================================================
     9. Acceleration / speed consistency
     ========================================================= */
  (function speed() {
    var pad = $('#speed-pad');
    if (!pad) return;
    var x = null, dir = 0, dist = 0, swipes = [], running = false, t0 = 0;
    var lg = $('#speed-log');

    function onMove(e) {
      if (!running) return;
      var r = pad.getBoundingClientRect();
      var nx = e.clientX - r.left;
      if (x === null) { x = nx; return; }
      var d = nx - x;
      dist += Math.abs(d);
      if (Math.abs(d) > 2) {
        var nd = d > 0 ? 1 : -1;
        if (dir !== 0 && nd !== dir) {
          if (dist > 40) swipes.push(dist);
          dist = 0;
        }
        dir = nd;
      }
      x = nx;
    }

    function analyse() {
      running = false;
      window.removeEventListener('pointermove', onMove, true);
      if (swipes.length < 3) {
        setOut('speed-ratio', '—', 'need at least 3 swipes — try again', 'warn');
        setOut('speed-verdict', 'Not enough data', 'swipe back and forth more', 'bad');
        if (lg) log(lg, 'only ' + swipes.length + ' swipe(s) captured', 'w');
        return;
      }
      var sorted = swipes.slice().sort(function (a, b) { return a - b; });
      var lo = sorted[Math.floor(sorted.length * 0.2)];
      var hi = sorted[Math.floor(sorted.length * 0.8)];
      var ratio = hi / Math.max(lo, 1);
      var verdict, tone;
      if (ratio < 1.18) { verdict = 'Linear'; tone = 'ok'; }
      else if (ratio < 1.4) { verdict = 'Mild boost'; tone = 'warn'; }
      else { verdict = 'Accelerated'; tone = 'bad'; }

      setOut('speed-ratio', ratio.toFixed(2) + '×', 'fastest vs slowest swipe', tone);
      setOut('speed-verdict', verdict, tone === 'ok' ? '1:1 pointer movement' : 'distance grows with speed', tone);
      setOut('speed-swipes', swipes.length, 'swipes measured', null);
      if (lg) log(lg, swipes.length + ' swipes · ratio ' + ratio.toFixed(2) + '× · ' + verdict);
    }

    var start = $('#speed-start');
    if (start) start.addEventListener('click', function () {
      swipes = []; dist = 0; x = null; dir = 0; running = true;
      setOut('speed-ratio', '…', 'swipe back and forth for 6 seconds', null);
      setOut('speed-verdict', '…', 'measuring', null);
      setOut('speed-swipes', '0', 'swipes measured', null);
      if (lg) lg.innerHTML = '';
      log(lg, 'use the SAME hand movement every time — about 10cm each way');
      window.addEventListener('pointermove', onMove, true);
      setTimeout(analyse, 6000);
    });
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
    'disp-last': 'Last event',
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
    'hover-latency': 'Hover delay',
    'speed-ratio': 'Acceleration ratio',
    'speed-verdict': 'Acceleration',
    'speed-swipes': 'Swipes'
  };
  function buildSummary() {
    if (!summary) return;
    var keys = ['disp-left', 'disp-right', 'disp-middle', 'disp-scroll', 'precision-acc', 'dbl-time', 'poll-hz'];
    summary.innerHTML = keys.map(function (k) {
      var v = document.querySelector('[data-out="' + k + '"]');
      var n = document.querySelector('[data-note="' + k + '"]');
      return '<div class="tile"><div class="tile__k">' + (LABELS[k] || k) + '</div>' +
        '<div class="tile__v" style="font-size:1.05rem">' + (v ? v.textContent : '—') + '</div>' +
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
