/* Every reading should be able to explain itself.
   The defect: setOut() writes a unit line into [data-note="key"], and no
   page had such an element, so all 48 unit lines were silently discarded.
   This drives the real pages and checks the lines actually appear. */
const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

let fails = 0, passes = 0;
const ok = (n, c, d) => { if (c) { passes++; console.log('PASS  ' + n + (d ? '  — ' + d : '')); } else { fails++; console.log('FAIL  ' + n + (d ? '  — ' + d : '')); } };

const noteText = (page, key) => page.evaluate(k => {
  const n = document.querySelector('[data-note="' + k + '"]');
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return { text: n.textContent.trim(), h: Math.round(r.height) };
}, key);

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });

  // ---------------------------------------------------------------- mouse ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.goto(BASE + '/mouse-check.html', { waitUntil: 'networkidle' });

    const count = await page.evaluate(() => document.querySelectorAll('[data-note]').length);
    ok('mouse page has a unit line for all 17 readings', count === 17, 'found ' + count);

    // every reading explains itself the moment the page opens
    const blank = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-note]').forEach(n => {
        const r = n.getBoundingClientRect();
        if (!n.textContent.trim() || r.height === 0) {
          out.push(n.getAttribute('data-note') + '(' + Math.round(r.height) + 'px)');
        }
      });
      return out;
    });
    ok('every mouse reading has a visible unit line at load', blank.length === 0, blank.join(' '));

    // the byline
    const byline = await page.evaluate(() => {
      const b = document.querySelector('p.byline');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { text: b.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(r.height), size: getComputedStyle(b).fontSize };
    });
    ok('mouse page carries a visible byline', !!byline && byline.h > 0, byline && byline.text);
    ok('byline is small type, not the lead size', byline && parseFloat(byline.size) < 15, byline && byline.size);

    // precision: click a blue target (the target itself does not take the
    // click — the pad does, at the target's position)
    await page.click('#precision-start');
    await page.waitForTimeout(150);
    const t = await page.$('.hitpad__target');
    if (t) {
      const bb = await t.boundingBox();
      await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.waitForTimeout(150);
    }
    for (const k of ['precision-acc', 'precision-err', 'precision-streak']) {
      const n = await noteText(page, k);
      ok('mouse: ' + k + ' has a unit line', !!n && n.text.length > 0 && n.h > 0, n && n.text);
    }
    ok('precision-acc unit line names the denominator',
      (await noteText(page, 'precision-acc')).text.includes('attempts'),
      (await noteText(page, 'precision-acc')).text);

    // double click
    await page.click('#dbl-pad').catch(() => {});
    await page.waitForTimeout(60);
    await page.click('#dbl-pad').catch(() => {});
    await page.waitForTimeout(120);
    const dbl = await noteText(page, 'dbl-time');
    ok('mouse: dbl-time has a unit line', !!dbl && dbl.text.length > 0, dbl && dbl.text);

    // polling: start it and keep the mouse moving so the reading arrives
    await page.click('#polling-start');
    const stage = await page.$('#mouse-stage');
    const sb = stage ? await stage.boundingBox() : null;
    if (sb) {
      for (let i = 0; i < 24; i++) {
        await page.mouse.move(sb.x + 20 + (i % 8) * 12, sb.y + 20 + (i % 5) * 10);
        await page.waitForTimeout(30);
      }
    }
    await page.waitForTimeout(1400);
    const pollNote = await noteText(page, 'poll-hz');
    ok('mouse: poll-hz has a unit line', !!pollNote && pollNote.text.length > 0, pollNote && pollNote.text);

    // the summary tiles
    await page.waitForTimeout(1100);
    const tiles = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#mouse-summary .tile').forEach(t => {
        out.push({
          k: (t.querySelector('.tile__k') || {}).textContent,
          v: (t.querySelector('.tile__v') || {}).textContent,
          n: ((t.querySelector('.tile__note') || {}).textContent || '').trim(),
          h: Math.round((t.querySelector('.tile__note') || {getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height)
        });
      });
      return out;
    });
    ok('mouse summary has 7 tiles', tiles.length === 7, 'found ' + tiles.length);
    const withNote = tiles.filter(t => t.n.length > 0);
    ok('mouse summary tiles carry a unit line once measured', withNote.length >= 2,
      withNote.map(t => t.k + ': ' + t.n).join(' | '));
    const emptyTiles = tiles.filter(t => t.n.length === 0);
    ok('empty tile notes take no space', emptyTiles.every(t => t.h === 0),
      emptyTiles.map(t => t.k + '(' + t.h + 'px)').join(' '));

    // the readings that already show a value carry their unit line from load
    const atLoad = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('[data-note]').forEach(n => {
        out[n.getAttribute('data-note')] = n.textContent.trim();
      });
      return out;
    });
    for (const k of ['precision-streak', 'drag-score', 'scroll-up', 'scroll-h']) {
      ok('mouse: ' + k + ' explains itself before anything is measured',
        (atLoad[k] || '').length > 0, atLoad[k]);
    }

    ok('mouse page has no console errors', errs.length === 0, errs.join(' ; '));
    await page.close();
  }

  // -------------------------------------------------------------- keyboard ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });

    const count = await page.evaluate(() => document.querySelectorAll('[data-note]').length);
    ok('keyboard page has a unit line for all 34 readings', count === 34, 'found ' + count);

    const blank = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-note]').forEach(n => {
        const r = n.getBoundingClientRect();
        if (!n.textContent.trim() || r.height === 0) {
          out.push(n.getAttribute('data-note') + '(' + Math.round(r.height) + 'px)');
        }
      });
      return out;
    });
    ok('every keyboard reading has a visible unit line at load', blank.length === 0, blank.join(' '));

    const byline = await page.evaluate(() => {
      const b = document.querySelector('p.byline');
      if (!b) return null;
      return { text: b.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(b.getBoundingClientRect().height) };
    });
    ok('keyboard page carries a visible byline', !!byline && byline.h > 0, byline && byline.text);

    // modifier lamps: written at load
    for (const k of ['mod-caps', 'mod-num', 'mod-scroll']) {
      const n = await noteText(page, k);
      ok('keyboard: ' + k + ' has a unit line', !!n && n.text.length > 0 && n.h > 0, n && n.text);
    }
    // trackpad counter chips
    for (const k of ['tp-clicks', 'tp-drags', 'tp-scrolls', 'tp-button']) {
      const n = await noteText(page, k);
      ok('keyboard: ' + k + ' has a unit line', !!n && n.text.length > 0 && n.h > 0, n && n.text);
    }
    // typing
    await page.click('#typing-start');
    await page.click('#typing-box');
    await page.keyboard.type('the quick brown fox', { delay: 12 });
    await page.waitForTimeout(700);
    const wpm = await noteText(page, 'typing-wpm');
    ok('typing-wpm unit line says words per minute', wpm && wpm.text === 'words per minute', wpm && wpm.text);
    const samp = await noteText(page, 'typing-sample');
    ok('the sample has a caption', samp && samp.text.length > 0, samp && samp.text);

    // layout
    await page.click('#layout-box');
    await page.keyboard.type('the quick brown fox jumps over the lazy dog', { delay: 8 });
    await page.evaluate(() => document.getElementById('layout-box').blur());
    await page.waitForTimeout(500);
    for (const k of ['layout-result', 'layout-score', 'layout-breakdown']) {
      const n = await noteText(page, k);
      ok('keyboard: ' + k + ' has a unit line', !!n && n.text.length > 0 && n.h > 0, n && n.text);
    }

    // summary tiles
    await page.waitForTimeout(1100);
    const tiles = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#kbd-summary .tile').forEach(t => {
        out.push({
          k: (t.querySelector('.tile__k') || {}).textContent,
          n: ((t.querySelector('.tile__note') || {}).textContent || '').trim(),
          h: Math.round((t.querySelector('.tile__note') || {getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height)
        });
      });
      return out;
    });
    ok('keyboard summary has 5 tiles', tiles.length === 5, 'found ' + tiles.length);
    const withNote = tiles.filter(t => t.n.length > 0);
    ok('keyboard summary tiles carry a unit line', withNote.length >= 4,
      withNote.map(t => t.k + ': ' + t.n).join(' | '));

    // latency: press a key in the pad and the fifth tile fills too
    await page.evaluate(() => {
      document.querySelectorAll('details.advanced-wrap').forEach(d => { d.open = true; });
    });
    await page.waitForTimeout(150);
    await page.click('#lat-start');
    await page.click('#lat-pad');
    for (const k of ['KeyA', 'KeyS', 'KeyD', 'KeyF']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1200);
    const lat = await noteText(page, 'lat-avg');
    ok('keyboard: lat-avg has a unit line', !!lat && lat.text.length > 0, lat && lat.text);
    const tiles2 = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#kbd-summary .tile').forEach(t => {
        out.push(((t.querySelector('.tile__k') || {}).textContent || '') + ': ' +
                 (((t.querySelector('.tile__note') || {}).textContent || '').trim()));
      });
      return out;
    });
    ok('all 5 keyboard summary tiles carry a unit line',
      tiles2.filter(t => t.split(': ')[1]).length === 5, tiles2.join(' | '));

    const atLoad = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('[data-note]').forEach(n => {
        out[n.getAttribute('data-note')] = n.textContent.trim();
      });
      return out;
    });
    for (const k of ['keymap-count', 'keymap-ghost', 'keymap-repeat', 'keymap-double',
                     'roll-count', 'lat-count', 'gst-swipe', 'gst-pinch',
                     'mod-caps', 'mod-num', 'mod-scroll',
                     'tp-clicks', 'tp-drags', 'tp-scrolls', 'tp-button']) {
      ok('keyboard: ' + k + ' explains itself before anything is measured',
        (atLoad[k] || '').length > 0, atLoad[k]);
    }

    ok('keyboard page has no console errors', errs.length === 0, errs.join(' ; '));
    await page.close();
  }

  // ----------------------------------------------------------------- home ---
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const byline = await page.evaluate(() => {
      const b = document.querySelector('p.byline');
      if (!b) return null;
      return { text: b.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(b.getBoundingClientRect().height) };
    });
    ok('home page carries a visible byline', !!byline && byline.h > 0, byline && byline.text);
    const cards = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.soon-card').forEach(c => {
        out.push(((c.querySelector('h3') || {}).textContent || '').trim() + ': ' +
                 (((c.querySelector('.soon-card__tag') || {}).textContent || '').trim()));
      });
      return out;
    });
    ok('no card claims to be in development', !cards.some(c => /development/i.test(c)), cards.join(' | '));
    ok('the gamepad card says next up', cards.some(c => /^Gamepad Test: Next up$/.test(c)), cards.join(' | '));
    ok('the headset card is only planned', cards.some(c => /^Headset Test: Planned$/.test(c)), cards.join(' | '));
    ok('home page has no console errors', errs.length === 0, errs.join(' ; '));
    await page.close();
  }

  // ------------------------------------------------------- guide bylines ---
  for (const p of ['/troubleshooting/mouse.html', '/troubleshooting/keyboard.html', '/troubleshooting/trackpad.html']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const b = await page.evaluate(() => {
      const el = document.querySelector('p.byline');
      if (!el) return null;
      return { text: el.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(el.getBoundingClientRect().height) };
    });
    ok(p + ' carries a visible byline', !!b && b.h > 0, b && b.text);
    await page.close();
  }

  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
