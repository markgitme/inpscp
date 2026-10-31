/* The layout detector, driven through every branch it can take.
   The case that started this: a Japanese layout producing kana. */
const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

let fails = 0, passes = 0;
const ok = (n, c, d) => { if (c) { passes++; console.log('PASS  ' + n + (d ? '  — ' + d : '')); } else { fails++; console.log('FAIL  ' + n + (d ? '  — ' + d : '')); } };

// An input method composes characters and commits them as an input event.
// The keydown events carry the ASCII composition keystrokes; the kana only
// ever appears in the box's text. This is how the owner hit the bug.
async function typeWithRealIME(page, kana, romaji) {
  await page.click('#layout-start');
  await page.click('#layout-box');
  await page.evaluate(([kana, romaji]) => {
    const box = document.getElementById('layout-box');
    const codes = ['KeyI','KeyK','KeyU','KeyR','KeyA','KeyD','KeyE','KeyS','KeyO','KeyN'];
    for (let i = 0; i < romaji.length; i++) {
      // this is what a browser reports while an input method is processing
      box.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Process', code: codes[i % codes.length], bubbles: true,
        isComposing: true, keyCode: 229, which: 229
      }));
    }
    box.value = kana;
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }, [kana, romaji]);
  await page.evaluate(() => document.getElementById('layout-box').blur());
  await p_wait(250);
  return page.evaluate(() => {
    const g = id => { const e = document.querySelector('[data-out="' + id + '"]'); return e ? e.textContent.trim() : null; };
    return {
      result: g('layout-result'), score: g('layout-score'), breakdown: g('layout-breakdown'),
      explain: (document.getElementById('layout-explain') || {}).textContent || '',
      tone: (document.querySelector('[data-out="layout-result"]') || {}).className
    };
  });
}

async function typeWithIME(page, kana, romaji) {
  await page.click('#layout-start');
  await page.click('#layout-box');
  await page.evaluate(([kana, romaji]) => {
    const box = document.getElementById('layout-box');
    const codes = ['KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI','KeyJ','KeyK','KeyL','Semicolon','Quote','Period','Comma'];
    for (let i = 0; i < romaji.length; i++) {
      box.dispatchEvent(new KeyboardEvent('keydown', {
        key: romaji[i], code: codes[i % codes.length], bubbles: true, isComposing: true, keyCode: 229
      }));
    }
    // the composition commits: the box text changes, no keydown fires
    box.value = kana;
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }, [kana, romaji]);
  await page.evaluate(() => document.getElementById('layout-box').blur());
  await p_wait(250);
  return page.evaluate(() => {
    const g = id => { const e = document.querySelector('[data-out="' + id + '"]'); return e ? e.textContent.trim() : null; };
    return {
      result: g('layout-result'), score: g('layout-score'), breakdown: g('layout-breakdown'),
      explain: (document.getElementById('layout-explain') || {}).textContent || '',
      tone: (document.querySelector('[data-out="layout-result"]') || {}).className
    };
  });
}
const p_wait = ms => new Promise(r => setTimeout(r, ms));

// Type into the box the way a browser would, with a chosen key -> character map.
async function typeInto(page, pairs, shifted) {
  await page.click('#layout-start');
  await page.click('#layout-box');
  await page.evaluate(([pairs, shifted]) => {
    const box = document.getElementById('layout-box');
    let text = '';
    for (const [code, ch] of pairs) {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code, bubbles: true, shiftKey: !!shifted }));
      text += ch;
    }
    box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }, [pairs, shifted]);
  await page.evaluate(() => document.getElementById('layout-box').blur());
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const g = id => { const e = document.querySelector('[data-out="' + id + '"]'); return e ? e.textContent.trim() : null; };
    return {
      result: g('layout-result'), score: g('layout-score'), breakdown: g('layout-breakdown'),
      explain: (document.getElementById('layout-explain') || {}).textContent || '',
      tone: (document.querySelector('[data-out="layout-result"]') || {}).className
    };
  });
}

const KANA = 'ちぬあきuten式か、。「」';
const KANA_CODES = ['KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI','KeyJ','KeyK','KeyL','Semicolon','Quote','Period','Comma'];

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });

  console.log('\n=== 0. THE BUTTON IS GONE (the panel runs itself on blur) ===');
  {
    const has = await page.evaluate(() => !!document.getElementById('layout-analyze'));
    ok('there is no Detect layout button', has === false, String(has));
  }

  console.log('\n=== 1. A JAPANESE LAYOUT (kana) ===');
  {
    const r = await typeInto(page, KANA.split('').map((ch, i) => [KANA_CODES[i % KANA_CODES.length], ch]));
    console.log('   ', JSON.stringify(r));
    ok('it says the layout is not an English one', r.result === 'Not an English layout', r.result);
    ok('the reading is toned as a warning', /warn/.test(r.tone || ''), r.tone);
    ok('it explains what to do', /English/i.test(r.explain), r.explain.slice(0, 90));
    ok('the match row is cleared', r.score === '—', r.score);
    ok('the candidates row is cleared', r.breakdown === '—', r.breakdown);
    ok('no reading is left blank', !!r.result && !!r.explain);
  }

  console.log('\n=== 1b. THE OWNER\'S CASE: A JAPANESE IME, SEVEN CHARACTERS ===');
  {
    const r = await typeWithIME(page, 'いくらですか', 'ikura desuka');
    console.log('   ', JSON.stringify(r));
    ok('a short IME input still answers', r.result === 'Not an English layout', r.result);
    ok('it is not the length message', !/dozen|more text/i.test(r.explain), r.explain.slice(0, 80));
    ok('the reading is toned as a warning', /warn/.test(r.tone || ''), r.tone);
    ok('it points at the input method', /input method/i.test(r.explain), r.explain.slice(0, 100));
    ok('it reassures about the hardware', /hardware/i.test(r.explain), r.explain.slice(0, 140));
  }

  console.log('\n=== 1b2. A REAL INPUT METHOD: keydown reports "Process", keyCode 229 ===');
  {
    const r = await typeWithRealIME(page, 'わたしはにほんごをべんきょうします', 'watashihanihongobenkyou');
    console.log('   ', JSON.stringify(r));
    ok('the IME keystrokes are recorded', r.result !== 'Nothing was recorded' && !/Nothing was recorded/.test(r.explain), r.explain.slice(0, 90));
    ok('it answers with the English-layout reading', r.result === 'Not an English layout', r.result);
    ok('it is not the length message', !/dozen|more text/i.test(r.explain), r.explain.slice(0, 80));
    ok('it points at the input method', /input method/i.test(r.explain), r.explain.slice(0, 100));
  }

  console.log('\n=== 1b3. A PASTED PHRASE: no keystroke at all ===');
  {
    await page.click('#layout-start');
    await page.click('#layout-box');
    await page.evaluate(() => {
      const box = document.getElementById('layout-box');
      box.value = 'わたしはにほんごをべんきょうします';
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => document.getElementById('layout-box').blur());
    await p_wait(250);
    const r = await page.evaluate(() => {
      const g = id => { const e = document.querySelector('[data-out="' + id + '"]'); return e ? e.textContent.trim() : null; };
      return { result: g('layout-result'), explain: (document.getElementById('layout-explain') || {}).textContent || '' };
    });
    console.log('   ', JSON.stringify(r));
    ok('a pasted phrase is answered, not dismissed', r.result === 'Not an English layout', r.result);
    ok('it is not the nothing-recorded message', !/Nothing was recorded/.test(r.explain), r.explain.slice(0, 80));
  }

  console.log('\n=== 1c. FULL-WIDTH KATAKANA, FOUR CHARACTERS ===');
  {
    const r = await typeWithIME(page, 'コンビニ', 'konbini');
    console.log('   ', JSON.stringify(r));
    ok('full-width katakana answers too', r.result === 'Not an English layout', r.result);
  }

  console.log('\n=== 2. A JAPANESE LAYOUT THAT ALSO TYPED DIGITS (the false-positive case) ===');
  {
    const pairs = KANA.split('').map((ch, i) => [KANA_CODES[i % KANA_CODES.length], ch]);
    pairs.push(['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3']);
    const r = await typeInto(page, pairs);
    console.log('   ', JSON.stringify(r));
    ok('it does not name a layout', r.result === 'Not an English layout', r.result);
    ok('it does not claim QWERTY', r.result !== 'US QWERTY', r.result);
  }

  console.log('\n=== 3. NORMAL ENGLISH (the working case) ===');
  {
    const pairs = [];
    // code -> the character that key produces on a US QWERTY board
    const qwerty = { KeyQ:'q',KeyW:'w',KeyE:'e',KeyR:'r',KeyT:'t',KeyY:'y',KeyU:'u',KeyI:'i',KeyO:'o',KeyP:'p',
      KeyA:'a',KeyS:'s',KeyD:'d',KeyF:'f',KeyG:'g',KeyH:'h',KeyJ:'j',KeyK:'k',KeyL:'l',
      KeyZ:'z',KeyX:'x',KeyC:'c',KeyV:'v',KeyB:'b',KeyN:'n',KeyM:'m',Space:' ' };
    for (const ch of 'the quick brown fox jumps over the lazy dog') {
      const code = Object.keys(qwerty).find(k => qwerty[k] === ch);
      pairs.push([code, ch]);
    }
    const r = await typeInto(page, pairs);
    console.log('   ', JSON.stringify(r));
    ok('it still detects US QWERTY', r.result === 'US QWERTY', r.result);
    ok('the match is 100%', r.score === '100%', r.score);
    ok('the candidates are listed', /US QWERTY 100%/.test(r.breakdown || ''), r.breakdown);
    ok('a 100% match is not called weak', !/weaker/i.test(r.explain), r.explain.slice(0, 90));
    ok('the reason for the lower confidence is given', /close behind/i.test(r.explain), r.explain.slice(0, 90));
  }

  console.log('\n=== 3b. ENGLISH PLUS THE PUNCTUATION ROW (should reach High confidence) ===');
  {
    const qwerty = { KeyQ:'q',KeyW:'w',KeyE:'e',KeyR:'r',KeyT:'t',KeyY:'y',KeyU:'u',KeyI:'i',KeyO:'o',KeyP:'p',
      KeyA:'a',KeyS:'s',KeyD:'d',KeyF:'f',KeyG:'g',KeyH:'h',KeyJ:'j',KeyK:'k',KeyL:'l',
      KeyZ:'z',KeyX:'x',KeyC:'c',KeyV:'v',KeyB:'b',KeyN:'n',KeyM:'m',Space:' ',
      Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',BracketLeft:'[',BracketRight:']' };
    const pairs = [];
    for (const ch of 'the quick brown fox, jumps over; the lazy dog.\'s [cat] /dog') {
      const code = Object.keys(qwerty).find(k => qwerty[k] === ch);
      if (code) pairs.push([code, ch]);
    }
    const r = await typeInto(page, pairs);
    console.log('   ', JSON.stringify(r));
    ok('it still detects US QWERTY', r.result === 'US QWERTY', r.result);
    ok('the tone is good now', /ok/.test(r.tone || ''), r.tone);
    ok('the explanation is a clear match', /clear match/i.test(r.explain), r.explain.slice(0, 90));
  }

  console.log('\n=== 3c. TWELVE IDENTICAL LETTERS (they cannot separate the layouts) ===');
  {
    const pairs = [];
    for (let i = 0; i < 12; i++) pairs.push(['KeyA', 'a']);
    const r = await typeInto(page, pairs);
    console.log('   ', JSON.stringify(r));
    ok('it refuses to name a layout', r.result === 'Ambiguous', r.result);
    ok('it says why', /match several layouts equally well/i.test(r.explain), r.explain.slice(0, 100));
    ok('it asks for more keys', /more keys/i.test(r.explain), r.explain.slice(0, 140));
  }

  console.log('\n=== 4. A FRENCH AZERTY KEYBOARD ===');
  {
    // AZERTY: the physical KeyQ produces 'a', KeyA produces 'q', KeyW produces 'z', KeyM produces ';'
    const az = { KeyQ:'a',KeyW:'z',KeyE:'e',KeyR:'r',KeyT:'t',KeyY:'y',KeyU:'u',KeyI:'i',KeyO:'o',KeyP:'p',
      KeyA:'q',KeyS:'s',KeyD:'d',KeyF:'f',KeyG:'g',KeyH:'h',KeyJ:'j',KeyK:'k',KeyL:'l',
      KeyZ:'w',KeyX:'x',KeyC:'c',KeyV:'v',KeyB:'b',KeyN:'n',KeyM:';',Space:' ' };
    const pairs = [];
    for (const ch of 'the quick brown fox jumps over the lazy dog') {
      const code = Object.keys(az).find(k => az[k] === ch);
      if (code) pairs.push([code, ch]);
    }
    const r = await typeInto(page, pairs);
    console.log('   ', JSON.stringify(r));
    ok('it detects AZERTY', r.result === 'AZERTY', r.result);
  }

  console.log('\n=== 5. TOO SHORT ===');
  {
    const r = await typeInto(page, [['KeyA','a'],['KeyB','b'],['KeyC','c']]);
    console.log('   ', JSON.stringify(r));
    ok('it asks for more text', r.result === '—' && /dozen|more text/i.test(r.explain), r.explain.slice(0, 70));
    ok('the candidates row is still cleared', r.breakdown === '—', r.breakdown);
  }

  console.log('\n=== 6. NOTHING TYPED IN THE BOX ===');
  {
    await page.click('#layout-start');
    await page.fill('#layout-box', 'a sentence typed somewhere else entirely');
    await page.evaluate(() => document.getElementById('layout-box').blur());
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({
      result: document.querySelector('[data-out="layout-result"]').textContent.trim(),
      explain: (document.getElementById('layout-explain') || {}).textContent || ''
    }));
    console.log('   ', JSON.stringify(r));
    ok('it says nothing was recorded', /nothing was recorded/i.test(r.explain), r.explain.slice(0, 70));
  }

  console.log('\n=== 7. PUNCTUATION ONLY ===');
  {
    const r = await typeInto(page, '!!!!!!!!!!!!'.split('').map(ch => ['Digit1', ch]), true);
    console.log('   ', JSON.stringify(r));
    ok('it asks for letters', /letters/i.test(r.explain), r.explain.slice(0, 80));
    ok('it does not name a layout', r.result === '—' || r.result === 'No layout matched', r.result);
  }

  console.log('\n=== 8. THE CLEAR BUTTON RESETS THE EXPLANATION ===');
  {
    await page.click('#layout-start');
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => (document.getElementById('layout-explain') || {}).textContent || '');
    ok('the explanation is cleared', r.trim() === '', JSON.stringify(r));
  }

  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log('\n==== ' + passes + ' passed, ' + fails + ' failed ====');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
