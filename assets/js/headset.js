/* =========================================================
   InputScope — Headset Check

   The headphone half of a headset, on its own page.

   This half CANNOT be measured. The browser can generate a tone in
   the left channel or the right channel, but it never learns what
   arrived in either ear — so the page asks the reader to mark what
   they heard and reports the marks. It does not pretend to be a
   measurement.

   The drawing is a typical headset. The ear cup for the channel being
   played lights and pulses, every other cup goes dark when the tone
   stops, and a side you marked silent is shown in red — the drawing
   shows what is sounding now, not what was sounded earlier.

   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function setOut(key, value, note, tone) {
    var v = document.querySelector('[data-out="' + key + '"]');
    var n = document.querySelector('[data-note="' + key + '"]');
    if (v) {
      v.textContent = value;
      if (tone) {
        v.classList.remove('ok', 'warn', 'bad');
        v.classList.add(tone);
      }
    }
    if (n) n.textContent = note || '';
  }

  function setVerdict(lineEl, detailEl, line, detail, tone) {
    if (lineEl) {
      lineEl.textContent = line;
      lineEl.classList.remove('ok', 'warn', 'bad');
      if (tone) lineEl.classList.add(tone);
    }
    if (detailEl) detailEl.textContent = detail;
  }

  var outState = $('#headset-output');
  if (!outState) return;

  var outVerdict = $('#hs-out-verdict-line');
  var outDetail = $('#hs-out-verdict-detail');
  var outBadge = $('#hs-out-badge');
  var freqSelect = $('#hs-freq');
  var soundSelect = $('#hs-sound');
  var diagram = $('#hs-diagram');

  var outCtx = null;
  var osc = null;
  var oscGain = null;
  var sources = [];      /* every source currently sounding */
  var noiseBuf = null;

  var marks = { left: null, right: null };
  var playing = null;   /* 'left', 'right' or 'both' — what is sounding now */

  /* =========================================================
     THE DIAGRAM

     The cups carry the live state: the cup for the channel being
     played lights and pulses, and every other cup goes dark when the
     tone stops. A side the reader has marked silent stays red,
     because that is their answer rather than a live reading.
     ========================================================= */
  function paintDiagram() {
    if (!diagram) return;
    ['left', 'right'].forEach(function (side) {
      var cup = diagram.querySelector('[data-cup="' + side + '"]');
      if (!cup) return;
      var silent = marks[side] === 'silent';
      var lit = (playing === side || playing === 'both') && !silent;
      cup.classList.toggle('is-lit', lit);
      cup.classList.toggle('is-silent', silent);
    });
  }

  function paintMarks() {
    ['left', 'right'].forEach(function (side) {
      ['heard', 'silent'].forEach(function (value) {
        var b = document.querySelector('[data-hs-mark="' + side + '-' + value + '"]');
        if (b) b.classList.toggle('is-on', marks[side] === value);
      });
    });
  }

  function outContext() {
    if (!outCtx) outCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (outCtx.state === 'suspended') outCtx.resume();
    return outCtx;
  }

  function stopTone() {
    /* Take the current tone off the page's variables before stopping it.
       An oscillator that is stopped fires its `ended` event a moment later,
       and that handler must not silence whatever is playing by then. */
    var dying = sources;
    sources = [];
    osc = null;
    oscGain = null;
    if (outCtx) {
      dying.forEach(function (s) {
        try {
          if (s.gain && s.gain.gain) {
            var t = outCtx.currentTime;
            s.gain.gain.cancelScheduledValues(t);
            s.gain.gain.setValueAtTime(s.gain.gain.value, t);
            s.gain.gain.linearRampToValueAtTime(0, t + 0.05);
          }
        } catch (e) { /* the context may already be closed */ }
      });
    }
    dying.forEach(function (s) { try { s.src.stop(); } catch (e) {} });
    setOut('hs-freq', '—', 'the frequency playing right now');
    playing = null;
    paintDiagram();
  }

  /* A steady tone. One sine, faded in over 40 ms so it does not click. */
  function steadyVoice(ctx, freq, when) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, when);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.18, when + 0.04);
    o.connect(g);
    o.start(when);
    o.stop(when + 2);
    return { node: g, sources: [{ src: o, gain: g }], last: o, end: when + 2 };
  }

  /* A plucked string, synthesised rather than sampled.

     Six partials, each with its own decay — the high ones die first, which
     is what makes a struck string sound struck rather than beeped — and a
     short burst of filtered noise for the pluck itself. The whole voice is
     generated in the browser, so there is no recording and no licence
     attached to it. */
  function stringVoice(ctx, freq, when) {
    var body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    /* the string darkens as it decays. The cut-off is not simply a
       multiple of the pitch, because a low note would then lose every
       partial that makes it sound like a string at all. */
    body.frequency.setValueAtTime(Math.min(freq * 12, 14000), when);
    body.frequency.exponentialRampToValueAtTime(Math.max(freq * 4, 400), when + 0.6);
    body.Q.value = 0.7;

    var voice = ctx.createGain();
    /* The partials are in phase at the attack, so their amplitudes add.
       Six partials plus the pluck come to about 2.5 at full scale, and
       this gain is what keeps the note under 1.0 — a plucked string that
       clips is a distorted pluck, not a louder one. */
    voice.gain.value = 0.25;
    body.connect(voice);

    var partials = [
      [1, 1.00, 2.60],
      [2, 0.52, 1.60],
      [3, 0.30, 1.10],
      [4, 0.17, 0.80],
      [5, 0.10, 0.55],
      [6, 0.06, 0.40]
    ];
    var made = [];
    var last = null;
    partials.forEach(function (p) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * p[0], when);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(p[1], when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + p[2]);
      o.connect(g);
      g.connect(body);
      o.start(when);
      o.stop(when + p[2] + 0.05);
      made.push({ src: o, gain: g });
      if (p[0] === 1) last = o;   /* the fundamental outlives the rest */
    });

    /* the pluck: a very short filtered noise burst */
    var noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    var nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(Math.min(freq * 4, 8000), when);
    nf.Q.value = 1.2;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35, when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    noise.connect(nf); nf.connect(ng); ng.connect(body);
    noise.start(when);
    noise.stop(when + 0.12);
    made.push({ src: noise, gain: ng });

    return { node: voice, sources: made, last: last, end: when + 2.65 };
  }

  function noiseBuffer(ctx) {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 0.12);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return noiseBuf;
  }

  /* Play a sound into chosen channels only. A ChannelMergerNode puts the
     signal into one side of the stereo pair; a mono source is used, so
     "left" really is the left channel and not a pan. */
  function playTone(which) {
    var ctx = outContext();
    stopTone();

    var freq = 1000;
    if (freqSelect) freq = parseFloat(freqSelect.value) || 1000;
    var timbre = soundSelect && soundSelect.value === 'string' ? 'string' : 'tone';

    var merger = ctx.createChannelMerger(2);
    merger.connect(ctx.destination);

    var when = ctx.currentTime + 0.02;
    var v = timbre === 'string' ? stringVoice(ctx, freq, when) : steadyVoice(ctx, freq, when);

    if (which === 'left') {
      v.node.connect(merger, 0, 0);
    } else if (which === 'right') {
      v.node.connect(merger, 0, 1);
    } else {
      v.node.connect(merger, 0, 0); v.node.connect(merger, 0, 1);
    }

    osc = v.last;
    oscGain = v.sources[0] ? v.sources[0].gain : null;
    sources = v.sources;
    setOut('hs-freq', Math.round(freq) + ' Hz', 'the frequency playing right now');

    var endOsc = v.last;
    endOsc.onended = function () { if (osc === endOsc) stopTone(); };

    /* the cup for the channel being played lights, and every other cup
       goes dark — the drawing shows what is sounding now, not what was
       sounded earlier */
    playing = which;
    paintDiagram();
  }

  function reportMarks() {
    setOut('hs-left', marks.left === 'heard' ? 'Heard it' : marks.left === 'silent' ? 'Silent' : '—',
      'what you heard in your left ear',
      marks.left === 'heard' ? 'ok' : marks.left === 'silent' ? 'bad' : null);
    setOut('hs-right', marks.right === 'heard' ? 'Heard it' : marks.right === 'silent' ? 'Silent' : '—',
      'what you heard in your right ear',
      marks.right === 'heard' ? 'ok' : marks.right === 'silent' ? 'bad' : null);
    paintDiagram();
    reportOutVerdict();
  }

  function reportOutVerdict() {
    var l = marks.left, r = marks.right;
    if (outBadge) {
      if (!l && !r) { outBadge.textContent = 'Not marked'; outBadge.className = 'hs-badge'; }
      else { outBadge.textContent = 'Marked'; outBadge.className = 'hs-badge hs-badge--live'; }
    }
    if (!l && !r) {
      setVerdict(outVerdict, outDetail,
        'Nothing marked yet.',
        'Play the left channel, then the right, then mark each one. A tone in the wrong ear means the channels are reversed; both ears hearing the same tone means the signal is mono.',
        null);
      return;
    }
    if (l === 'silent' && r === 'silent') {
      setVerdict(outVerdict, outDetail,
        'Neither side played.',
        'Nothing came out of either ear. The tone is generated in the browser, so the signal reached the output device — check the volume and which device is selected.',
        'bad');
      return;
    }
    if (l === 'silent' || r === 'silent') {
      var dead = l === 'silent' ? 'left' : 'right';
      setVerdict(outVerdict, outDetail,
        'Your ' + dead + ' ear heard nothing.',
        'The other side played. One channel reached one ear and the other did not.',
        'bad');
      return;
    }
    /* Both sides have to be marked before the pair can be called working.
       One side marked is one side checked, and saying so is the honest
       answer — claiming both are working from a single mark is not. */
    if (l === 'heard' && r === 'heard') {
      setVerdict(outVerdict, outDetail,
        'Both sides are working.',
        'Each channel arrived in the ear you marked. The browser cannot hear this — the answer is what you told it.',
        'ok');
      return;
    }
    var one = l === 'heard' ? 'left' : 'right';
    var other = l === 'heard' ? 'right' : 'left';
    setVerdict(outVerdict, outDetail,
      'Your ' + one + ' ear is working.',
      'You have marked the ' + one + ' ear. The ' + other + ' ear has not been marked yet, so this is not yet a verdict on the pair.',
      'warn');
  }

  $$('[data-hs-play]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var which = btn.getAttribute('data-hs-play');
      if (which === 'stop') { stopTone(); return; }
      playTone(which);
    });
  });

  /* The tone check is a selector, not a player. Choosing a tone or a
     sound makes no noise at all — the channel check above is what plays
     the sound, so a dropdown that played on top of it would double up
     and would play when the reader only meant to look at the list. The
     value is read when the sound is played, so the two dropdowns need no
     listener of their own. */

  $$('[data-hs-mark]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-hs-mark');
      var side = key.indexOf('left') === 0 ? 'left' : 'right';
      var value = key.indexOf('heard') !== -1 ? 'heard' : 'silent';
      marks[side] = marks[side] === value ? null : value;
      /* Both buttons for that side are repainted, so marking a side silent
         clears the "I heard it" button rather than leaving it looking
         clicked. */
      paintMarks();
      reportMarks();
    });
  });

  paintMarks();
  reportMarks();
})();
