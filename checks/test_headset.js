/* The headset tester, driven in a real browser.
 *
 * The headphone half of a headset cannot be measured, so the check does the
 * two things that can be checked:
 *
 *   - it records HOW the tone is routed. The call is
 *     gain.connect(merger, 0, 0), which runs the SOURCE's connect, so the
 *     patch has to go on AudioNode — patching the merger's own prototype
 *     would never see it. "left" must land on input 0 of the merger and
 *     "right" on input 1, not on a pan.
 *   - it drives the drawing. The ear cups carry the live state, so the
 *     check asserts that the cup for the channel being played lights and
 *     the other does not, that pressing the other channel clears the first
 *     cup, that everything goes dark when the tone has finished, and that a
 *     side marked silent turns red.
 *
 * What it proves:
 *   1. the drawing has one ear cup per side
 *   2. the tone list is exactly the three tones, with the labels the page
 *      promises, 100 Hz by default, and two sounds to choose from
 *   3. the tone check has no button of its own
 *   4. choosing a tone or a sound makes no sound at all — the channel
 *      check is what plays the sound
 *   5. the left tone goes into channel 0 and the right into channel 1
 *   6. both channels are used when both sides are asked for
 *   7. a replaced tone is not silenced by the one it replaced
 *   8. the chosen frequency is the one that is played
 *   9. the string note is built on the chosen pitch out of several partials,
 *      and the steady tone is a single oscillator
 *  10. the note is measured at the output, so a note that clips is caught
 *      and the loudest frequency in it has to be the pitch that was chosen
 *  11. the cup for the channel being played lights, and the other does not
 *  12. pressing the other channel clears the first cup
 *  13. every cup goes dark when the tone has finished
 *  14. marking a side silent clears that side's "I heard it" button
 *  15. one marked side does not report both sides as working
 *  16. every reading declares a starting line
 *  17. the page has no console errors
 */
const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

let fails = 0, passes = 0;
function ok(cond, name, detail) {
  if (cond) { passes++; console.log('PASS ' + name); }
  else { fails++; console.log('FAIL ' + name + (detail !== undefined ? '  — ' + detail : '')); }
}

/* Install the recorders before any script runs. */
const FAKE = `
  (function () {
    var hs = { merges: [], oscillators: [] };

    var origConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, out, inp) {
      if (dest instanceof ChannelMergerNode && typeof inp === 'number') {
        /* the gain of the node doing the connecting matters: the polarity
           check is the one that inverts a channel with a gain of -1 */
        hs.merges.push({
          out: out, in: inp,
          gain: (this.gain && typeof this.gain.value === 'number') ? this.gain.value : null
        });
      }
      return origConnect.apply(this, arguments);
    };

    var origStart = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function () {
      hs.oscillators.push(this);
      return origStart.apply(this, arguments);
    };

    /* Tap what the page actually sends to the output, so the peak of the
       note can be measured rather than assumed. The real destination is
       kept and the tap is added alongside it, so nothing is muted. */
    var realDestination = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination').get;
    Object.defineProperty(BaseAudioContext.prototype, 'destination', {
      configurable: true,
      get: function () {
        if (!this.__tap) {
          var tap = this.createGain();
          var analyser = this.createAnalyser();
          analyser.fftSize = 4096;
          analyser.smoothingTimeConstant = 0;   /* no blending with the note before */
          tap.connect(realDestination.call(this));
          tap.connect(analyser);
          this.__tap = tap;
          window.__tapAnalyser = analyser;
        }
        return this.__tap;
      }
    });

    window.__hs = hs;
  })();
`;

const out = (page, key) => page.$eval('[data-out="' + key + '"]', e => e.textContent.trim());
const cupState = (page, side) => page.evaluate(
  s => {
    var cup = document.querySelector('#hs-diagram [data-cup="' + s + '"]');
    if (!cup) return null;
    return {
      lit: cup.classList.contains('is-lit'),
      silent: cup.classList.contains('is-silent')
    };
  }, side);

/* Measure the output for a while: the peak, so a note that clips is
   caught, and the loudest frequency, so a note at the wrong pitch is
   caught.

   Two details matter here. The analyser's smoothing is switched off, or
   it blends the new note with the one before it and the pitch reads one
   step behind. And the spectrum is taken after a short delay, because
   the analyser's window still holds the previous note at the moment the
   new one starts — which is how a pitch check passes for the wrong
   reason. The peak is measured over the whole window, because the
   attack is where a note would clip. */
const measure = (page, ms) => page.evaluate(d => new Promise(resolve => {
  var an = window.__tapAnalyser;
  if (!an) { resolve(null); return; }
  var data = new Float32Array(an.fftSize);
  var bins = new Float32Array(an.frequencyBinCount);
  var peak = 0, sum = 0, n = 0;
  var best = { peak: 0, hz: 0 };
  var t0 = performance.now();
  function tick() {
    an.getFloatTimeDomainData(data);
    var p = 0;
    for (var i = 0; i < data.length; i++) {
      var v = Math.abs(data[i]);
      if (v > p) p = v;
      if (v > peak) peak = v;
      sum += v * v; n++;
    }
    var elapsed = performance.now() - t0;
    if (elapsed > 160 && p > best.peak) {
      an.getFloatFrequencyData(bins);
      var binHz = an.context.sampleRate / an.fftSize, hz = 0, db = -999;
      for (var i = 1; i < bins.length; i++) if (bins[i] > db) { db = bins[i]; hz = Math.round(i * binHz); }
      best = { peak: p, hz: hz };
    }
    if (elapsed < d) requestAnimationFrame(tick);
    else resolve({ peak: peak, rms: Math.sqrt(sum / n), loudest: best.hz });
  }
  tick();
}), ms);

(async () => {
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(FAKE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + '/headset-check.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.querySelector('#hs-diagram'));

  /* ---------- 1. the drawing has one cup per side ---------- */
  const cups = await page.$$eval('#hs-diagram [data-cup]', els => els.map(e => e.getAttribute('data-cup')));
  ok(cups.length === 2 && cups.indexOf('left') !== -1 && cups.indexOf('right') !== -1,
     'the drawing has one ear cup per side', cups.join(','));

  /* ---------- 2. the tone list is exactly what the page promises ---------- */
  const tones = await page.$$eval('#hs-freq option', els => els.map(e => ({
    value: e.value, label: e.textContent.trim()
  })));
  ok(tones.length === 3, 'there are three tones', String(tones.length));
  ok(tones.map(t => t.value).join(',') === '100,250,1000',
     'the tones are 100 Hz, 250 Hz and 1 kHz', tones.map(t => t.value).join(','));
  ok(tones[0].label === '100 Hz — low', '100 Hz is labelled low', tones[0].label);
  ok(tones[1].label === '250 Hz — mid', '250 Hz is labelled mid', tones[1].label);
  ok(tones[2].label === '1 kHz — High', '1 kHz is labelled High', tones[2].label);

  const defaultTone = await page.$eval('#hs-freq', e => e.value);
  ok(defaultTone === '100', 'the default tone is 100 Hz', defaultTone);

  const soundOptions = await page.$$eval('#hs-sound option', els => els.map(e => e.value));
  ok(soundOptions.join(',') === 'tone,string',
     'there are two sounds, a steady tone and a string note', soundOptions.join(','));

  /* the tone check has no play or stop of its own — the channel check
     above already plays the sound */
  const toneButtons = await page.evaluate(() =>
    document.querySelector('#hs-freq').closest('.hs-controls').querySelectorAll('button').length);
  ok(toneButtons === 0, 'the tone check has no button of its own', String(toneButtons));

  /* ---------- 3. choosing a tone or a sound makes no sound at all ----------
     The tone check is a selector. The channel check above is what plays
     the sound, so a dropdown that played on its own would double up —
     and would play when the reader only meant to look at the list. */
  await page.evaluate(() => { window.__hs.merges.length = 0; window.__hs.oscillators.length = 0; });
  await page.selectOption('#hs-freq', '1000');
  await page.selectOption('#hs-sound', 'string');
  await page.$eval('#hs-freq', el => el.click());
  await page.$eval('#hs-sound', el => el.click());
  await page.waitForTimeout(300);
  const choseQuietly = await page.evaluate(() => ({
    merges: window.__hs.merges.length,
    oscillators: window.__hs.oscillators.length,
    reading: document.querySelector('[data-out="hs-freq"]').textContent.trim()
  }));
  ok(choseQuietly.merges === 0, 'choosing a tone or a sound plays nothing',
     JSON.stringify(choseQuietly));
  ok(choseQuietly.oscillators === 0, 'choosing a tone or a sound starts no oscillator',
     String(choseQuietly.oscillators));
  ok(choseQuietly.reading === '—', 'nothing is shown as playing after choosing',
     choseQuietly.reading);

  /* ---------- 4 + 5. the channel routing ---------- */
  for (const [which, wantIn] of [['left', 0], ['right', 1]]) {
    await page.evaluate(() => { window.__hs.merges.length = 0; });
    await page.click('[data-hs-play="' + which + '"]');
    await page.waitForFunction(() => window.__hs.merges.length > 0);
    const merges = await page.evaluate(() => window.__hs.merges);
    ok(merges.some(m => m.in === wantIn),
       'the ' + which + ' tone goes into channel ' + wantIn,
       JSON.stringify(merges));
  }

  await page.evaluate(() => { window.__hs.merges.length = 0; });
  await page.click('[data-hs-play="both"]');
  await page.waitForFunction(() => window.__hs.merges.length > 1);
  const bothMerges = await page.evaluate(() => window.__hs.merges);
  ok(bothMerges.some(m => m.in === 0) && bothMerges.some(m => m.in === 1),
     'both channels are used when both sides are asked for', JSON.stringify(bothMerges));

  /* ---------- 5. a replaced tone is not silenced by the one it replaced ---------- */
  await page.click('[data-hs-play="left"]');
  await page.waitForTimeout(120);
  await page.click('[data-hs-play="right"]');
  await page.waitForTimeout(250);
  const stillPlaying = await out(page, 'hs-freq');
  ok(stillPlaying !== '—', 'the second tone is not silenced by the first one stopping', stillPlaying);

  /* ---------- 6. the chosen frequency is the one that is played ---------- */
  await page.evaluate(() => { window.__hs.oscillators.length = 0; });
  await page.selectOption('#hs-freq', '250');
  await page.click('[data-hs-play="both"]');
  await page.waitForFunction(() => window.__hs.oscillators.length > 0);
  await page.waitForTimeout(200);
  const oscFreq = await page.evaluate(() => window.__hs.oscillators[0].frequency.value);
  const chosenPitch = await page.$eval('#hs-freq', e => Number(e.value));
  ok(Math.abs(oscFreq - chosenPitch) < 1,
     'the chosen frequency is the one that is played', oscFreq + ' vs ' + chosenPitch);
  const playing = await out(page, 'hs-freq');
  ok(/250\s?Hz/.test(playing), 'the frequency reading names what is playing', playing);

  /* ---------- 6b. the string note is synthesised at the chosen pitch ---------- */
  await page.evaluate(() => { window.__hs.oscillators.length = 0; });
  await page.selectOption('#hs-sound', 'string');
  await page.click('[data-hs-play="both"]');
  await page.waitForFunction(() => window.__hs.oscillators.length > 0);
  await page.waitForTimeout(200);
  const stringFreq = await page.evaluate(() => window.__hs.oscillators[0].frequency.value);
  const partialCount = await page.evaluate(() => window.__hs.oscillators.length);
  ok(Math.abs(stringFreq - chosenPitch) < 1,
     'the string note is built on the chosen pitch', stringFreq + ' vs ' + chosenPitch);
  ok(partialCount >= 6, 'the string note has several partials', String(partialCount));

  /* and back to the steady tone */
  await page.selectOption('#hs-sound', 'tone');
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__hs.oscillators.length = 0; });
  await page.selectOption('#hs-freq', '250');
  await page.click('[data-hs-play="both"]');
  await page.waitForFunction(() => window.__hs.oscillators.length > 0);
  const steadyCount = await page.evaluate(() => window.__hs.oscillators.length);
  ok(steadyCount === 1, 'the steady tone is a single oscillator', String(steadyCount));

  /* ---------- 6c. the note is measured at the output, not assumed ---------- */
  /* a real click first, so the audio context is running — a select
     changed by script is not a user gesture */
  await page.click('[data-hs-play="left"]');
  await page.waitForTimeout(300);
  await page.selectOption('#hs-sound', 'string');
  await page.selectOption('#hs-freq', '250');
  await page.click('[data-hs-play="both"]');
  const measured = await measure(page, 700);
  ok(measured && measured.peak > 0.02, 'the string note makes a sound',
     measured ? String(measured.peak) : 'no analyser');
  ok(measured && measured.peak < 1, 'the string note does not clip',
     measured ? String(measured.peak) : 'no analyser');
  ok(measured && Math.abs(measured.loudest - 250) <= 25,
     'the loudest frequency in the note is the pitch that was chosen',
     measured ? measured.loudest + ' Hz' : 'no analyser');

  /* and the steady tone, for comparison */
  await page.selectOption('#hs-sound', 'tone');
  await page.waitForTimeout(250);
  await page.selectOption('#hs-freq', '1000');
  await page.click('[data-hs-play="both"]');
  const steady = await measure(page, 500);
  ok(steady && steady.peak > 0.02, 'the steady tone makes a sound',
     steady ? String(steady.peak) : 'no analyser');
  ok(steady && steady.peak < 1, 'the steady tone does not clip',
     steady ? String(steady.peak) : 'no analyser');
  ok(steady && Math.abs(steady.loudest - 1000) <= 25,
     'the loudest frequency in the tone is the pitch that was chosen',
     steady ? steady.loudest + ' Hz' : 'no analyser');

  /* ---------- 7 to 9. the drawing, from a fresh page ----------
     The routing tests above already played both sides, so the drawing
     would already be showing something. Reload to start from a clean
     state and check the sequence properly. */
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!document.querySelector('#hs-diagram'));

  const anyLit = async () => page.evaluate(() =>
    document.querySelectorAll('#hs-diagram [data-cup].is-lit').length);

  ok((await anyLit()) === 0, 'nothing is lit before anything has been played');

  await page.click('[data-hs-play="left"]');
  await page.waitForTimeout(150);
  const leftLit = await cupState(page, 'left');
  const rightLit = await cupState(page, 'right');
  ok(leftLit && leftLit.lit, 'the left cup lights when the left channel plays', JSON.stringify(leftLit));
  ok(rightLit && !rightLit.lit, 'the right cup stays dark when the left channel plays', JSON.stringify(rightLit));

  /* pressing the other channel replaces the light, it does not add to it */
  await page.click('[data-hs-play="right"]');
  await page.waitForTimeout(150);
  const afterRight = await cupState(page, 'left');
  const rightNow = await cupState(page, 'right');
  ok(afterRight && !afterRight.lit, 'the left cup goes dark when the right channel plays', JSON.stringify(afterRight));
  ok(rightNow && rightNow.lit, 'the right cup lights when the right channel plays', JSON.stringify(rightNow));

  /* both at once */
  await page.click('[data-hs-play="both"]');
  await page.waitForTimeout(150);
  ok((await anyLit()) === 2, 'both cups light when both channels are asked for', String(await anyLit()));

  /* and when the tone finishes, everything goes dark again — the drawing
     shows what is sounding now, not what was sounded earlier */
  await page.waitForTimeout(2200);
  ok((await anyLit()) === 0, 'every cup goes dark when the tone has finished', String(await anyLit()));
  const freqAfter = await out(page, 'hs-freq');
  ok(freqAfter === '—', 'the frequency reading clears when the tone has finished', freqAfter);

  /* ---------- 10. the verdict does not claim both sides from one mark ---------- */
  await page.click('[data-hs-mark="left-heard"]');
  let buttons = await page.evaluate(() => ({
    heard: document.querySelector('[data-hs-mark="left-heard"]').classList.contains('is-on'),
    silent: document.querySelector('[data-hs-mark="left-silent"]').classList.contains('is-on')
  }));
  ok(buttons.heard && !buttons.silent, 'marking a side heard lights that button only', JSON.stringify(buttons));

  const oneVerdict = await page.$eval('#hs-out-verdict-line', e => e.textContent.trim());
  ok(!/both sides are working/i.test(oneVerdict),
     'one marked side does not report both sides as working', oneVerdict);
  ok(/left ear is working/i.test(oneVerdict), 'one marked side reports that side working', oneVerdict);

  /* ---------- 11. marking the same side silent clears the other button ---------- */
  await page.click('[data-hs-mark="left-silent"]');
  buttons = await page.evaluate(() => ({
    heard: document.querySelector('[data-hs-mark="left-heard"]').classList.contains('is-on'),
    silent: document.querySelector('[data-hs-mark="left-silent"]').classList.contains('is-on')
  }));
  ok(!buttons.heard && buttons.silent,
     'marking the same side silent clears the "I heard it" button', JSON.stringify(buttons));

  const leftSilent = await cupState(page, 'left');
  ok(leftSilent && leftSilent.silent, 'a side marked silent turns red', JSON.stringify(leftSilent));
  const silentVerdict = await page.$eval('#hs-out-verdict-line', e => e.textContent.trim());
  ok(/left ear heard nothing/i.test(silentVerdict),
     'the verdict names the ear that heard nothing', silentVerdict);

  /* ---------- 12. both sides marked heard ---------- */
  await page.click('[data-hs-mark="right-heard"]');
  const rightMarked = await out(page, 'hs-right');
  ok(rightMarked === 'Heard it', 'the right mark is recorded', rightMarked);
  const stillSilent = await page.$eval('#hs-out-verdict-line', e => e.textContent.trim());
  ok(/left ear heard nothing/i.test(stillSilent),
     'the silent side still names itself while the other side is marked heard', stillSilent);

  await page.click('[data-hs-mark="left-heard"]');
  const leftMarked = await out(page, 'hs-left');
  ok(leftMarked === 'Heard it', 'the left mark is recorded', leftMarked);
  const bothVerdict = await page.$eval('#hs-out-verdict-line', e => e.textContent.trim());
  ok(/both sides are working/i.test(bothVerdict), 'the verdict reports both sides working', bothVerdict);

  /* ---------- 13. the tone check sits under the channel check ---------- */
  const order = await page.evaluate(() => {
    var heads = Array.prototype.slice.call(document.querySelectorAll('.hs-subhead'));
    return heads.map(h => h.textContent.trim());
  });
  ok(order.indexOf('Channel check') !== -1 && order.indexOf('Tone check') !== -1,
     'both sub-headings are present', order.join(' | '));
  ok(order.indexOf('Channel check') < order.indexOf('Tone check'),
     'the tone check comes after the channel check', order.join(' | '));

  /* ---------- 14. the advanced diagnostics ---------- */
  /* the section is collapsed to start with, so open it the way a reader
     would — by clicking the summary */
  ok(await page.$eval('details.advanced-wrap', e => !e.open),
     'the advanced diagnostics section starts collapsed');
  await page.click('details.advanced-wrap > summary');
  await page.waitForTimeout(200);
  ok(await page.$eval('details.advanced-wrap', e => e.open),
     'the advanced diagnostics section opens');

  const advanced = await page.evaluate(() => ({
    open: !!document.querySelector('details.advanced-wrap'),
    panels: Array.prototype.slice.call(document.querySelectorAll('.advanced-grid .panel h3')).map(h => h.textContent.trim())
  }));
  ok(advanced.open, 'the advanced diagnostics section is there', JSON.stringify(advanced));
  ok(advanced.panels.indexOf('Polarity') !== -1 && advanced.panels.indexOf('Frequency sweep') !== -1,
     'the advanced section holds the polarity check and the frequency sweep', advanced.panels.join(' | '));

  /* the sweep: it starts low, climbs, and never leaves the range */
  await page.evaluate(() => { window.__hs.oscillators.length = 0; });
  await page.click('[data-hs-sweep="play"]');
  await page.waitForTimeout(250);
  const sweepStart = await out(page, 'hs-sweep');
  await page.waitForTimeout(3500);
  const sweepMid = await out(page, 'hs-sweep');
  const sweepFreq = await page.evaluate(() => window.__hs.oscillators[0].frequency.value);
  ok(/^\d+ Hz$/.test(sweepStart), 'the sweep reports the frequency it is on', sweepStart);
  ok(parseFloat(sweepStart) <= 60, 'the sweep starts at the bottom of the range', sweepStart);
  ok(parseFloat(sweepMid) > parseFloat(sweepStart), 'the sweep climbs', sweepStart + ' -> ' + sweepMid);
  ok(sweepFreq <= 1000, 'the sweep never goes above 1 kHz', String(sweepFreq));
  const sweepFill = await page.$eval('#hs-sweep-fill', e => e.style.width);
  ok(parseFloat(sweepFill) > 0, 'the sweep bar moves', sweepFill);

  await page.click('[data-hs-sweep="stop"]');
  await page.waitForTimeout(200);
  ok((await out(page, 'hs-sweep')) === '—', 'the sweep readout clears when it is stopped', await out(page, 'hs-sweep'));

  /* the polarity comparison: three notes, and the middle one has the
     right channel inverted */
  await page.evaluate(() => { window.__hs.merges.length = 0; window.__hs.oscillators.length = 0; });
  await page.click('[data-hs-polar="play"]');
  await page.waitForTimeout(300);
  const polarMerges = await page.evaluate(() => window.__hs.merges);
  const polarNotes = await page.evaluate(() => window.__hs.oscillators.length);
  ok(polarNotes === 3, 'the comparison plays three notes', String(polarNotes));
  ok(polarMerges.length === 6, 'each note goes to both channels', JSON.stringify(polarMerges.map(m => m.in)));
  const inverted = polarMerges.filter(m => m.gain !== null && m.gain < 0);
  ok(inverted.length === 1 && inverted[0].in === 1,
     'one note inverts the right channel only', JSON.stringify(inverted));

  /* the comparison runs for its full length — the first note ending must
     not silence the two behind it. The three notes are two seconds each
     with a six-hundred-millisecond gap between them, so the last one ends
     at about seven and a quarter seconds. */
  await page.waitForTimeout(2100);
  ok((await out(page, 'hs-freq')) !== '—',
     'the comparison is still sounding after its first note has ended', await out(page, 'hs-freq'));
  await page.waitForTimeout(6500);
  ok((await out(page, 'hs-freq')) === '—',
     'the comparison finishes and clears the reading', await out(page, 'hs-freq'));

  await page.click('[data-hs-polar="same"]');
  const sameVerdict = await page.$eval('#hs-polar-verdict-line', e => e.textContent.trim());
  ok(/wired backwards/i.test(sameVerdict), 'the same verdict names a reversed driver', sameVerdict);
  const polarState = await page.evaluate(() => ({
    same: document.querySelector('[data-hs-polar="same"]').classList.contains('is-on'),
    different: document.querySelector('[data-hs-polar="different"]').classList.contains('is-on'),
    reading: document.querySelector('[data-out="hs-polar"]').textContent.trim()
  }));
  ok(polarState.same && !polarState.different, 'the chosen answer is painted and the other one cleared', JSON.stringify(polarState));
  ok(/same/i.test(polarState.reading), 'the comparison reading records the answer', polarState.reading);

  await page.click('[data-hs-polar="different"]');
  const diffVerdict = await page.$eval('#hs-polar-verdict-line', e => e.textContent.trim());
  ok(/wiring is correct/i.test(diffVerdict), 'the different verdict says the wiring is correct', diffVerdict);
  const polarState2 = await page.evaluate(() => ({
    same: document.querySelector('[data-hs-polar="same"]').classList.contains('is-on'),
    different: document.querySelector('[data-hs-polar="different"]').classList.contains('is-on')
  }));
  ok(!polarState2.same && polarState2.different, 'the previous answer is cleared when the other is chosen', JSON.stringify(polarState2));

  /* ---------- 15. every reading declares a starting line ---------- */
  const notes = await page.$$eval('[data-note]', els => els.map(e => ({
    key: e.getAttribute('data-note'), text: e.textContent.trim()
  })));
  const empty = notes.filter(n => !n.text);
  ok(empty.length === 0, 'every reading declares a starting line',
     empty.map(n => n.key).join(','));

  ok(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
