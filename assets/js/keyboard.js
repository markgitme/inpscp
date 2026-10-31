/* =========================================================
   InputScope — Keyboard Check
   Browser-based keyboard diagnostics.
   Everything is measured client-side; nothing is uploaded.
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

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
     1. Live key map
     ========================================================= */
  (function keymap() {
    var map = $('#keymap');
    if (!map) return;
    var down = {}, fires = {}, repeatN = {}, total = 0, doubles = 0;
    var lg = $('#keymap-log');

    function label(code) {
      var el = map.querySelector('[data-code="' + code + '"]');
      return el ? el.textContent.trim() : code;
    }

    function flash(code) {
      var key = map.querySelector('[data-code="' + code + '"]');
      if (!key) return;
      key.classList.add('hit');
    }

    function onDown(e) {
      // The operating system repeats a key you are holding down. Those are
      // not extra presses, so they never reach the press total — they are
      // reported separately instead.
      if (e.repeat) {
        repeatN[e.code] = (repeatN[e.code] || 0) + 1;
        setOut('keymap-repeat', repeatN[e.code] + ' \u00d7 ' + label(e.code),
               'repeats while a key was held down', 'warn');
        return;
      }
      total++;
      down[e.code] = true;
      // A second keydown with no keyup in between means the key fired twice
      // from one physical press.
      fires[e.code] = (fires[e.code] || 0) + 1;
      if (fires[e.code] > 1) {
        doubles++;
        setOut('keymap-double', String(doubles), 'keys that fired twice', 'bad');
        log(lg, e.code + ' fired twice from one press — possible double-fire', 'x');
      }
      flash(e.code);
      var c = document.querySelector('[data-out="keymap-count"]');
      if (c) c.textContent = String(total);
      if (lg) log(lg, e.code + ' → ' + e.key);
    }

    function onUp(e) {
      down[e.code] = false;
      fires[e.code] = 0;
      var key = map.querySelector('[data-code="' + e.code + '"]');
      if (key) key.classList.remove('hit');
    }

    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);

    window.addEventListener('blur', function () {
      var stuck = Object.keys(down).filter(function (c) { return down[c]; });
      $$('.kbd-key.hit', map).forEach(function (k) { k.classList.remove('hit'); });
      if (stuck.length) {
        setOut('keymap-ghost', stuck.length + ' key' + (stuck.length === 1 ? '' : 's'), 'never sent a release event', 'bad');
        log(lg, 'stuck on release: ' + stuck.join(', '), 'x');
      } else {
        setOut('keymap-ghost', 'None', 'pressed but never released', 'ok');
      }
      down = {};
      fires = {};
    });

    var start = $('#keymap-start');
    if (start) start.addEventListener('click', function () {
      total = 0;
      doubles = 0;
      fires = {};
      repeatN = {};
      if (lg) lg.innerHTML = '';
      setOut('keymap-count', '0', 'keys pressed since reset', null);
      setOut('keymap-ghost', 'None', 'pressed but never released', 'ok');
      setOut('keymap-repeat', 'None', 'repeats while a key was held down', null);
      setOut('keymap-double', 'None', 'keys that fired twice', null);
      log(lg, 'press keys to test them — every key you press lights up');
    });
  })();

  /* =========================================================
     2. Typing speed
     ========================================================= */
  (function typing() {
    var box = $('#typing-box');
    if (!box) return;
    var timer = null, t0 = 0, correct = 0, typed = 0, errors = 0, running = false;
    var SAMPLE = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';

    function tick() {
      var secs = (performance.now() - t0) / 1000;
      var wpm = secs > 0 ? (correct / 5) / secs * 60 : 0;
      setOut('typing-wpm', Math.round(wpm), 'words per minute', wpm >= 40 ? 'ok' : wpm >= 25 ? 'warn' : null);
      setOut('typing-time', secs.toFixed(1) + 's', 'elapsed', null);
      setOut('typing-acc', typed ? Math.round(correct / typed * 100) + '%' : '—', 'correct characters', null);
    }

    box.addEventListener('input', function () {
      if (!running) return;
      var v = box.value;
      typed = v.length;
      correct = 0; errors = 0;
      for (var i = 0; i < v.length; i++) {
        if (v[i] === SAMPLE[i]) correct++; else errors++;
      }
      tick();
    });

    var start = $('#typing-start');
    if (start) start.addEventListener('click', function () {
      if (running) {
        clearInterval(timer); running = false;
        box.disabled = false;
        start.textContent = 'Start timing';
        return;
      }
      box.value = ''; box.disabled = false;
      box.focus();
      correct = 0; typed = 0; errors = 0;
      t0 = performance.now(); running = true;
      timer = setInterval(tick, 250);
      start.textContent = 'Stop';
      setOut('typing-sample', SAMPLE, 'target text', null);
    });

    var sampleOut = document.querySelector('[data-out="typing-sample"]');
    if (sampleOut) sampleOut.textContent = SAMPLE;
  })();

  /* =========================================================
     3. Layout detection
     ========================================================= */
  (function layout() {
    var box = $('#layout-box');
    if (!box) return;

    var BASE = {
      'US QWERTY': {
        'KeyQ': 'q', 'KeyW': 'w', 'KeyE': 'e', 'KeyR': 'r', 'KeyT': 't', 'KeyY': 'y', 'KeyU': 'u',
        'KeyI': 'i', 'KeyO': 'o', 'KeyP': 'p', 'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\',
        'KeyA': 'a', 'KeyS': 's', 'KeyD': 'd', 'KeyF': 'f', 'KeyG': 'g', 'KeyH': 'h', 'KeyJ': 'j',
        'KeyK': 'k', 'KeyL': 'l', 'Semicolon': ';', 'Quote': "'", 'Enter': 'enter',
        'KeyZ': 'z', 'KeyX': 'x', 'KeyC': 'c', 'KeyV': 'v', 'KeyB': 'b', 'KeyN': 'n', 'KeyM': 'm',
        'Comma': ',', 'Period': '.', 'Slash': '/', 'Backquote': '`', 'Space': ' ',
        'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
        'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0'
      },
      'QWERTZ': {
        'KeyQ': 'q', 'KeyW': 'w', 'KeyE': 'e', 'KeyR': 'r', 'KeyT': 't', 'KeyY': 'z', 'KeyU': 'u',
        'KeyI': 'i', 'KeyO': 'o', 'KeyP': 'p', 'BracketLeft': 'ü', 'BracketRight': '+', 'Backslash': '#',
        'KeyA': 'a', 'KeyS': 's', 'KeyD': 'd', 'KeyF': 'f', 'KeyG': 'g', 'KeyH': 'h', 'KeyJ': 'j',
        'KeyK': 'k', 'KeyL': 'l', 'Semicolon': 'ö', 'Quote': 'ä', 'Enter': 'enter',
        'KeyZ': 'y', 'KeyX': 'x', 'KeyC': 'c', 'KeyV': 'v', 'KeyB': 'b', 'KeyN': 'n', 'KeyM': 'm',
        'Comma': ',', 'Period': '.', 'Slash': '-', 'Backquote': '^', 'Space': ' ',
        'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
        'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0'
      },
      'AZERTY': {
        'KeyQ': 'a', 'KeyW': 'z', 'KeyE': 'e', 'KeyR': 'r', 'KeyT': 't', 'KeyY': 'y', 'KeyU': 'u',
        'KeyI': 'i', 'KeyO': 'o', 'KeyP': 'p', 'BracketLeft': '^', 'BracketRight': '$', 'Backslash': '*',
        'KeyA': 'q', 'KeyS': 's', 'KeyD': 'd', 'KeyF': 'f', 'KeyG': 'g', 'KeyH': 'h', 'KeyJ': 'j',
        'KeyK': 'k', 'KeyL': 'l', 'Semicolon': 'm', 'Quote': "'", 'Enter': 'enter',
        'KeyZ': 'w', 'KeyX': 'x', 'KeyC': 'c', 'KeyV': 'v', 'KeyB': 'b', 'KeyN': 'n', 'KeyM': ':',
        'Comma': '?', 'Period': '.', 'Slash': '/', 'Backquote': '²', 'Space': ' ',
        'Digit1': '&', 'Digit2': 'é', 'Digit3': '"', 'Digit4': "'", 'Digit5': '(',
        'Digit6': '-', 'Digit7': 'è', 'Digit8': '_', 'Digit9': 'ç', 'Digit0': 'à'
      },
      'Dvorak': {
        'KeyQ': "'", 'KeyW': ',', 'KeyE': '.', 'KeyR': 'p', 'KeyT': 'y', 'KeyY': 'f', 'KeyU': 'g',
        'KeyI': 'c', 'KeyO': 'r', 'KeyP': 'l', 'BracketLeft': '/', 'BracketRight': '=', 'Backslash': '\\',
        'KeyA': 'a', 'KeyS': 'o', 'KeyD': 'e', 'KeyF': 'u', 'KeyG': 'i', 'KeyH': 'd', 'KeyJ': 'h',
        'KeyK': 't', 'KeyL': 'n', 'Semicolon': 's', 'Quote': '"', 'Enter': 'enter',
        'KeyZ': ';', 'KeyX': 'q', 'KeyC': 'j', 'KeyV': 'k', 'KeyB': 'x', 'KeyN': 'b', 'KeyM': 'm',
        'Comma': 'w', 'Period': 'v', 'Slash': 'k', 'Backquote': '`', 'Space': ' ',
        'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
        'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0'
      }
    };

    // A character the tool can compare: a single unshifted, non-space
    // character. Shifted symbols are excluded because they are
    // layout-specific — Shift+2 is " on QWERTY and é on AZERTY, so counting
    // it would produce a false mismatch. The unshifted punctuation IS
    // counted: the semicolon key, the slash key and the backtick key are
    // exactly where QWERTY and QWERTZ come apart.
    function isComparable(e) {
      return !e.shiftKey && e.key.length === 1 && e.key.trim() !== '';
    }

    // Latin-1 letters (é, ñ, ü) are still Latin. Anything above U+00FF is not:
    // kana, hangul, CJK, Cyrillic, Greek, and the full-width punctuation a
    // Japanese or Chinese input method produces.
    function isNonLatin(s) {
      for (var i = 0; i < s.length; i++) {
        if (s.charCodeAt(i) > 255) return true;
      }
      return false;
    }

    function explain(text) {
      var el = $('#layout-explain');
      if (el) el.textContent = text || '';
    }

    function analyse() {
      var text = box.value;
      var codes = box._codes || [];
      var comparable = [];
      var nonLatin = false;
      for (var i = 0; i < codes.length; i++) {
        if (codes[i].comparable) comparable.push(codes[i]);
        if (isNonLatin(codes[i].ch)) nonLatin = true;
      }
      // An input method composes its characters and delivers them as an
      // input event, not a keydown — so the text in the box is the only
      // reliable place to see them. The keyboard is almost certainly still
      // an English board; it is the software on top that changed.
      if (isNonLatin(text)) nonLatin = true;

      // The text in the box is checked first, because it is the only place the
      // characters actually land: an input method delivers them as an input
      // event, and a pasted phrase arrives with no keystroke at all. Either
      // way the answer is the same — there is nothing to compare.
      if (nonLatin) {
        // The input method is producing characters outside the English set —
        // Japanese, Korean, Chinese, Russian. Naming a layout here would be a
        // guess about the hardware, so the reading does not name one.
        setOut('layout-result', 'Not an English layout', 'the characters typed are outside the English set', 'warn');
        setOut('layout-score', '—', 'nothing to compare', null);
        setOut('layout-breakdown', '—', 'all candidate layouts', null);
        explain('The characters you typed come from a non-English input method, so there is nothing to compare. Switch the input method to English and type a sentence again — that changes nothing about the hardware.');
        return;
      }
      if (!codes.length) {
        setOut('layout-result', '—', 'press keys inside the box to record positions', null);
        setOut('layout-score', '—', 'confidence', null);
        setOut('layout-breakdown', '—', 'all candidate layouts', null);
        explain('Nothing was recorded. Type inside the box itself, not into another window.');
        return;
      }
      if (text.replace(/\s/g, '').length < 12) {
        setOut('layout-result', '—', 'type a little more text', null);
        setOut('layout-score', '—', 'confidence', null);
        setOut('layout-breakdown', '—', 'all candidate layouts', null);
        explain('Type at least a dozen characters. The tool compares the letters each key produces against the known layouts.');
        return;
      }
      if (!comparable.length) {
        setOut('layout-result', '—', 'not enough letter keys typed', null);
        setOut('layout-score', '—', 'confidence', null);
        setOut('layout-breakdown', '—', 'all candidate layouts', null);
        explain('Type a sentence with letters in it. The tool compares what each key produces, so punctuation alone will not identify a layout.');
        return;
      }

      var scores = [];
      Object.keys(BASE).forEach(function (name) {
        var map = BASE[name];
        var match = 0, tested = 0;
        for (var i = 0; i < comparable.length; i++) {
          var code = comparable[i].code;
          var ch = comparable[i].ch;
          if (!map[code]) continue;
          tested++;
          if (map[code] === ch.toLowerCase()) match++;
        }
        if (tested > 0) scores.push({ name: name, pct: Math.round(match / tested * 100), tested: tested });
      });
      scores.sort(function (a, b) { return b.pct - a.pct; });
      if (!scores.length) {
        setOut('layout-result', '—', 'not enough letter keys typed', null);
        setOut('layout-score', '—', 'confidence', null);
        setOut('layout-breakdown', '—', 'all candidate layouts', null);
        explain('Type a sentence with letters in it. The tool compares what each key produces, so punctuation alone will not identify a layout.');
        return;
      }
      var best = scores[0];
      var runner = scores[1];
      var margin = best.pct - (runner ? runner.pct : 0);
      var detail = scores.map(function (s) { return s.name + ' ' + s.pct + '%'; }).join(' · ');
      setOut('layout-breakdown', detail, 'all candidate layouts', null);

      if (best.pct === 0) {
        // nothing matched: say that, rather than calling it ambiguous
        setOut('layout-result', 'No layout matched', 'no key produced a character from these layouts', 'warn');
        setOut('layout-score', '0%', 'nothing to compare', null);
        explain('The characters you typed do not come from any of the known layouts. Type a sentence in English.');
        return;
      }
      if (margin < 3) {
        // the letters typed do not separate the candidates — say so rather than guess
        setOut('layout-result', 'Ambiguous', 'the keys typed match several layouts', 'warn');
        setOut('layout-score', best.pct + '%', 'no clear winner from these keys', 'warn');
        explain('The letters you typed match several layouts equally well, so the tool will not pick one. Type more keys, including the punctuation row, and click away again.');
        return;
      }
      var conf = best.pct >= 90 && margin >= 8 ? 'High' : best.pct >= 70 ? 'Medium' : 'Low';
      setOut('layout-result', best.name, 'confidence: ' + conf, conf === 'High' ? 'ok' : conf === 'Medium' ? 'warn' : 'bad');
      setOut('layout-score', best.pct + '%', 'match against ' + best.tested + ' keys', best.pct >= 90 ? 'ok' : 'warn');
      explain(conf === 'High'
        ? 'A clear match against ' + best.tested + ' keys.'
        : best.pct + '% against ' + best.tested + ' keys, but ' + (runner ? runner.name : 'the next candidate') +
          ' is close behind, so the tool will not call it with confidence. Type the punctuation row as well — that is where the layouts differ.');
    }

    // capture physical codes while typing in the box.
    // Only unshifted alphanumerics are comparable — shifted symbols are
    // layout-specific and would otherwise count as false mismatches. Every
    // other key press is still recorded, so the tool can tell "nothing was
    // typed" from "nothing that can be compared".
    //
    // An input method intercepts the keystroke and the browser reports it as
    // key "Process" with keyCode 229, not as a character — so the keystrokes
    // that produce kana must be recorded even though they carry no character.
    // The character itself arrives later, in the box text.
    box.addEventListener('keydown', function (e) {
      if (!box._codes) box._codes = [];
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!e.code) return;
      box._codes.push({
        code: e.code,
        ch: e.key,
        comparable: isComparable(e)
      });
    });

    var start = $('#layout-start');
    if (start) start.addEventListener('click', function () {
      box.value = ''; box._codes = [];
      box.focus();
      setOut('layout-result', '…', 'type a sentence in your normal layout', null);
      setOut('layout-score', '—', 'confidence', null);
      setOut('layout-breakdown', '—', 'all candidate layouts', null);
      explain('');
    });

    // The panel runs itself when the box loses focus — that has been the
    // behaviour since the first release, so there is no button to press.
    box.addEventListener('blur', analyse);
  })();

  /* =========================================================
     4. N-key rollover
     ========================================================= */
  (function rollover() {
    var pad = $('#roll-pad');
    if (!pad) return;
    var keys = ['ShiftLeft', 'ControlLeft', 'AltLeft', 'KeyM'];
    var held = {};
    var lg = $('#roll-log');

    keys.forEach(function (code) {
      var el = pad.querySelector('[data-roll="' + code + '"]');
      if (!el) return;
      window.addEventListener('keydown', function (e) {
        if (e.code === code && !e.repeat) {
          held[code] = true;
          el.classList.add('hit');
          update();
        }
      }, true);
      window.addEventListener('keyup', function (e) {
        if (e.code === code) {
          held[code] = false;
          el.classList.remove('hit');
          update();
        }
      }, true);
    });

    function update() {
      var count = keys.filter(function (c) { return held[c]; }).length;
      setOut('roll-count', count + ' / 4', 'keys held right now', count >= 4 ? 'ok' : count >= 2 ? 'warn' : 'bad');
      var verdict = count >= 4 ? '4-key rollover confirmed' : count >= 3 ? '3-key rollover' : count >= 2 ? '2-key rollover only' : 'fewer than 2 keys';
      setOut('roll-state', verdict, count >= 3 ? 'meets the NKRO bar for most gaming keyboards' : 'may lack anti-ghosting hardware', count >= 3 ? 'ok' : 'warn');
    }

    var start = $('#roll-start');
    if (start) start.addEventListener('click', function () {
      keys.forEach(function (c) { held[c] = false; });
      $$('.hit', pad).forEach(function (n) { n.classList.remove('hit'); });
      if (lg) lg.innerHTML = '';
      log(lg, 'hold Shift + Ctrl + Alt + M together');
      update();
    });
  })();

  /* =========================================================
     5. Modifier lock states
     ------------------------------------------------------------
     The lock state only exists on a KeyboardEvent. There is no
     pollable API for it, so it has to be read off the event itself.
     ------------------------------------------------------------ */
  (function mods() {
    var pad = $('#mod-pad');
    if (!pad) return;

    var LOCKS = [
      { out: 'mod-caps',   lamp: 'lamp-caps',   id: 'CapsLock' },
      { out: 'mod-num',    lamp: 'lamp-num',    id: 'NumLock' },
      { out: 'mod-scroll', lamp: 'lamp-scroll', id: 'ScrollLock' }
    ];
    var state = { CapsLock: false, NumLock: false, ScrollLock: false };

    function render() {
      LOCKS.forEach(function (l) {
        var on = !!state[l.id];
        var el = document.querySelector('[data-out="' + l.out + '"]');
        if (el) {
          el.textContent = on ? 'On' : 'Off';
          el.classList.toggle('pill--ok', on);
          el.classList.toggle('pill--info', !on);
        }
        var lamp = document.getElementById(l.lamp);
        if (lamp) lamp.classList.toggle('on', on);
      });
    }

    function read(e) {
      if (!e || typeof e.getModifierState !== 'function') return;
      var changed = false;
      LOCKS.forEach(function (l) {
        var on = false;
        try { on = !!e.getModifierState(l.id); } catch (err) { return; }
        if (state[l.id] !== on) { state[l.id] = on; changed = true; }
      });
      // Only touch the DOM when a lock actually flipped, so a typing-speed
      // test is not paying for a redraw on every keystroke.
      if (changed) render();
    }

    // Read on every key event. Current browsers already report the toggled
    // state on the lock key's own keydown; the matching keyup corrects it
    // on any browser that reports the pre-toggle value there instead.
    window.addEventListener('keydown', read);
    window.addEventListener('keyup', read);

    // The state survives while the tab sits in the background, so re-render
    // the cached values when the visitor comes back to the tab.
    window.addEventListener('focus', render);
    document.addEventListener('visibilitychange', render);

    render();
  })();

  /* =========================================================
     6. Response latency
     ------------------------------------------------------------
     Measured as the gap between the browser receiving the keypress
     (event.timeStamp) and the next frame the page is able to draw
     on. This is independent of how fast a human can react, so it
     reflects input handling rather than reaction time.
     ========================================================= */
  (function latency() {
    var pad = $('#lat-pad');
    if (!pad) return;
    var target = null, samples = [], running = false;
    var frameTimes = [], lastFrame = 0;
    var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var lg = $('#lat-log');

    function loop(ts) {
      if (!running) return;
      if (lastFrame) {
        frameTimes.push(ts - lastFrame);
        if (frameTimes.length > 150) frameTimes.shift();
      }
      lastFrame = ts;
      requestAnimationFrame(loop);
    }

    function refreshRate() {
      if (frameTimes.length < 10) return null;
      var s = frameTimes.slice().sort(function (a, b) { return a - b; });
      var med = s[Math.floor(s.length / 2)];
      return med > 0.4 ? Math.round(1000 / med) : null;
    }

    function next() {
      target = CHARS[Math.floor(Math.random() * CHARS.length)];
      pad.textContent = target;
    }

    function onKey(e) {
      if (!running) return;
      if (e.repeat) return; // a held key is one press, not thirty
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!target) return;
      if (e.key.toUpperCase() !== target) {
        if (e.key.length === 1) {
          log(lg, 'wrong key — pressed "' + e.key + '", expected "' + target + '"', 'x');
          pad.style.borderColor = 'var(--red)';
          setTimeout(function () { pad.style.borderColor = ''; }, 220);
        }
        return;
      }
      var evtT = e.timeStamp;
      requestAnimationFrame(function (frameT) {
        var lag = frameT - evtT;
        if (lag < 0 || lag > 500) { next(); return; }
        samples.push(lag);
        var avg = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;
        setOut('lat-count', samples.length, 'presses measured', null);
        setOut('lat-avg', avg.toFixed(1) + 'ms', 'input to next drawable frame', avg < 9 ? 'ok' : avg < 17 ? 'warn' : 'bad');
        if (samples.length > 1) {
          var sd = Math.sqrt(samples.reduce(function (a, b) { return a + (b - avg) * (b - avg); }, 0) / samples.length);
          setOut('lat-jitter', sd.toFixed(1) + 'ms', 'variation in that lag', sd < 4 ? 'ok' : sd < 8 ? 'warn' : 'bad');
        }
        var hz = refreshRate();
        if (hz) setOut('lat-refresh', hz + ' Hz', 'measured display refresh', null);
        log(lg, 'press ' + samples.length + ' — lag ' + lag.toFixed(1) + 'ms');
        next();
      });
    }

    window.addEventListener('keydown', onKey, true);

    var start = $('#lat-start');
    if (start) start.addEventListener('click', function () {
      samples = []; frameTimes = []; lastFrame = 0; running = true;
      if (lg) lg.innerHTML = '';
      log(lg, 'hit the letter shown — the clock runs on the input, not on you');
      setOut('lat-count', '0', 'presses measured', null);
      setOut('lat-avg', '…', 'measuring', null);
      setOut('lat-jitter', '—', 'need two presses', null);
      setOut('lat-refresh', '…', 'measuring', null);
      next();
      requestAnimationFrame(loop);
    });

    var stop = $('#lat-stop');
    if (stop) stop.addEventListener('click', function () {
      running = false;
      pad.textContent = 'Stopped';
    });
  })();

  /* =========================================================
     Summary
     ========================================================= */
  var summary = $('#kbd-summary');
  var LABELS = {
    'keymap-count': 'Keys pressed',
    'keymap-ghost': 'Stuck keys',
    'typing-wpm': 'Typing speed',
    'typing-acc': 'Typing accuracy',
    'typing-time': 'Typing time',
    'typing-state': 'Typing state',
    'layout-result': 'Detected layout',
    'layout-score': 'Layout match',
    'layout-breakdown': 'All candidates',
    'roll-count': 'Keys held',
    'roll-state': 'Rollover level',
    'mod-caps': 'Caps Lock',
    'mod-num': 'Num Lock',
    'mod-scroll': 'Scroll Lock',
    'lat-avg': 'Input lag',
    'lat-jitter': 'Lag jitter',
    'lat-count': 'Presses',
    'lat-refresh': 'Display refresh'
  };
  function buildSummary() {
    if (!summary) return;
    var keys = ['keymap-count', 'typing-wpm', 'layout-result', 'roll-state', 'lat-avg'];
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
})();
