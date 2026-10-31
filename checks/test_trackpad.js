const { chromium } = require('/usr/local/lib/node_modules/playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

(async () => {
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  const results = [];
  const ok = (name, cond, detail) => {
    results.push({ name, pass: !!cond, detail: detail || '' });
    console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
  };

  // ---------- load ----------
  await page.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });
  ok('page loads', true, await page.title());
  // the keyboard tool must still work alongside the trackpad block
  await page.keyboard.down('a');          // the cap lights on keydown and clears on keyup
  await page.waitForTimeout(120);
  const keyLit = await page.evaluate(() => {
    const k = document.querySelector('.kbd-key[data-code="KeyA"]');
    return k ? k.classList.contains('hit') : false;
  });
  await page.keyboard.up('a');
  await page.waitForTimeout(120);
  const keyCount = await page.textContent('[data-out="keymap-count"]');
  ok('the key tester still works', keyLit && keyCount === '1', 'KeyA lit=' + keyLit + ' count=' + keyCount);

  const struct = await page.evaluate(() => ({
    pad: !!document.querySelector('#trackpad-pad'),
    dot: !!document.querySelector('#trackpad-dot'),
    log: !!document.querySelector('#trackpad-log'),
    tpCards: document.querySelectorAll('#trackpad-display ~ .card-grid .check-card').length,
    outs: document.querySelectorAll('[data-out]').length,
    verdicts: document.querySelectorAll('.verdict__line').length
  }));
  ok('structure present', struct.pad && struct.dot && struct.log, JSON.stringify(struct));
  ok('three trackpad check cards', struct.tpCards === 3, struct.tpCards + ' trackpad cards');
  ok('verdict blocks present', struct.verdicts >= 3, struct.verdicts + ' verdicts');

  // ---------- tester: click, drag, scroll ----------
  const pad = await page.$('#trackpad-pad');
  // the trackpad block sits below the fold on the keyboard page
  await pad.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await pad.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  await page.mouse.click(cx, cy);
  await page.waitForTimeout(60);
  const clicks1 = await page.textContent('[data-out="tp-clicks"]');
  ok('click counted', clicks1 === '1', 'tp-clicks=' + clicks1);

  // drag: press, move, release
  await page.mouse.move(cx - 40, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  const drags1 = await page.textContent('[data-out="tp-drags"]');
  ok('drag counted', drags1 === '1', 'tp-drags=' + drags1);

  // a drag must not select the text underneath the pointer
  const sel = await page.evaluate(() => window.getSelection().toString());
  ok('drag does not select text', sel.trim() === '', 'selection="' + sel.trim().slice(0, 40) + '"');

  // scroll on the pad
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(60);
  const scrolls1 = await page.textContent('[data-out="tp-scrolls"]');
  ok('scroll counted', scrolls1 === '1', 'tp-scrolls=' + scrolls1);

  // button state returns to up
  const btn = await page.textContent('[data-out="tp-button"]');
  ok('button state returns to up', btn === 'up', 'tp-button=' + btn);

  // trail dot moved
  const dotPos = await page.evaluate(() => {
    const d = document.querySelector('#trackpad-dot');
    return { left: d.style.left, top: d.style.top, op: getComputedStyle(d).opacity };
  });
  ok('trail dot follows the pointer', dotPos.left !== '' && dotPos.left !== '0px', JSON.stringify(dotPos));

  // chips light up
  const chips = await page.evaluate(() => ({
    clicks: document.querySelector('#tp-chip-clicks').classList.contains('is-on'),
    drags: document.querySelector('#tp-chip-drags').classList.contains('is-on'),
    scrolls: document.querySelector('#tp-chip-scrolls').classList.contains('is-on')
  }));
  ok('counter chips light up', chips.clicks && chips.drags && chips.scrolls, JSON.stringify(chips));

  // ---------- the numpad is on the map and works ----------
  const np = await page.evaluate(() => {
    const codes = [...document.querySelectorAll('#keymap .kbd-key')].map(k => k.dataset.code);
    const npCodes = codes.filter(c => c.startsWith('Numpad') || c === 'NumLock');
    const alpha = codes.filter(c => !(c.startsWith('Numpad') || c === 'NumLock'));
    // every alpha row must fill exactly 15 units, so the rows line up
    const rows = [...document.querySelectorAll('#keymap .kbd-alpha > .kbd-row, #keymap .kbd-alpha > div')]
      .filter(el => el.getBoundingClientRect().height > 0);
    return { total: codes.length, np: npCodes.length, alpha: alpha.length, dupes: codes.length - new Set(codes).size };
  });
  ok('the map has 94 keys with no duplicates', np.total === 94 && np.dupes === 0, JSON.stringify(np));
  ok('the numpad is present', np.np === 17, np.np + ' numpad keys');

  await page.keyboard.down('Numpad7');
  await page.waitForTimeout(120);
  const npLit = await page.evaluate(() => {
    const k = document.querySelector('[data-code="Numpad7"]');
    return k ? k.classList.contains('hit') : false;
  });
  await page.keyboard.up('Numpad7');
  ok('a numpad key lights up', npLit, 'Numpad7');

  // the numpad rows must line up with the alpha block rows
  const align = await page.evaluate(() => {
    const a = [...document.querySelectorAll('#keymap .kbd-alpha > div')].map(e => Math.round(e.getBoundingClientRect().top));
    const n = [...document.querySelectorAll('#keymap .kbd-numpad > div')].map(e => Math.round(e.getBoundingClientRect().top));
    const aU = [...new Set(a)].sort((x,y)=>x-y);
    const nU = [...new Set(n)].sort((x,y)=>x-y);
    // the numpad's top row sits level with the alpha block's first row
    return { alphaRows: aU.length, numpadRows: nU.length, aligned: nU[0] === aU[0] };
  });
  ok('the numpad rows line up with the alpha block', align.aligned, JSON.stringify(align));

  // ---------- the trackpad display ----------
  const disp = await page.$('#tp-display-pad');
  await disp.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const dbox = await disp.boundingBox();
  await page.mouse.move(dbox.x + dbox.width / 2, dbox.y + dbox.height / 3);
  await page.waitForTimeout(150);
  const dstate = await page.evaluate(() => {
    const pad = document.querySelector('#tp-display-pad');
    const dot = document.querySelector('#tp-display-dot');
    return { live: pad.classList.contains('is-live'), left: dot.style.left, op: getComputedStyle(dot).opacity };
  });
  ok('the trackpad display answers the pointer', dstate.live && dstate.left !== '' && dstate.op === '1', JSON.stringify(dstate));
  await page.mouse.down();
  await page.waitForTimeout(120);
  const down = await page.evaluate(() => document.querySelector('#tp-display-surface').classList.contains('is-tapped'));
  await page.mouse.up();
  ok('the trackpad display lights on press', down, 'is-down=' + down);

  // ---------- pointer response ----------
  await page.click('#ptr-start');
  await page.waitForTimeout(300);
  // move the pointer for 1.5s
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(cx + Math.sin(i / 4) * 120, cy + Math.cos(i / 5) * 80);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(600);
  const ptr = await page.evaluate(() => ({
    hz: document.querySelector('[data-out="ptr-hz"]').textContent,
    jitter: document.querySelector('[data-out="ptr-jitter"]').textContent,
    step: document.querySelector('[data-out="ptr-step"]').textContent,
    line: document.querySelector('#ptr-verdict-line').textContent,
    detail: document.querySelector('#ptr-verdict-detail').textContent
  }));
  ok('pointer rate measured', /\d+ Hz/.test(ptr.hz), JSON.stringify(ptr));
  ok('pointer jitter measured', /\d+(\.\d+)? ms/.test(ptr.jitter), ptr.jitter);
  ok('pointer verdict is a sentence', ptr.line.length > 10 && !/^Ready/.test(ptr.line), ptr.line);

  // ---------- scroll response: notched wheel ----------
  await page.click('#scr-start');
  await page.waitForTimeout(200);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
  await page.waitForTimeout(2400);
  const scr1 = await page.evaluate(() => ({
    type: document.querySelector('[data-out="scr-type"]').textContent,
    hz: document.querySelector('[data-out="scr-hz"]').textContent,
    delta: document.querySelector('[data-out="scr-delta"]').textContent,
    vary: document.querySelector('[data-out="scr-vary"]').textContent,
    line: document.querySelector('#scr-verdict-line').textContent
  }));
  ok('notched wheel detected', scr1.type === 'Mouse wheel', JSON.stringify(scr1));
  ok('scroll rate reported', /Hz/.test(scr1.hz), scr1.hz);

  // ---------- scroll response: trackpad-like ----------
  await page.click('#scr-start');
  await page.waitForTimeout(200);
  const deltas = [3, 5, 2, 8, 4, 6, 3, 9, 2, 5, 7, 4];
  for (const d of deltas) { await page.mouse.wheel(0, d); await page.waitForTimeout(45); }
  await page.waitForTimeout(2400);
  const scr2 = await page.evaluate(() => ({
    type: document.querySelector('[data-out="scr-type"]').textContent,
    vary: document.querySelector('[data-out="scr-vary"]').textContent,
    line: document.querySelector('#scr-verdict-line').textContent
  }));
  ok('smooth scroll detected as trackpad', scr2.type === 'Trackpad', JSON.stringify(scr2));

  // ---------- gestures: horizontal swipe + pinch ----------
  await page.click('#gst-start');
  await page.waitForTimeout(200);
  await page.mouse.wheel(40, 0);
  await page.waitForTimeout(120);
  await page.mouse.wheel(-40, 0);
  await page.waitForTimeout(120);
  // a pinch: control-modified small scroll
  await page.evaluate(() => {
    const el = document.querySelector('#trackpad-pad');
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 4, deltaMode: 0, ctrlKey: true, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  const gst = await page.evaluate(() => ({
    swipe: document.querySelector('[data-out="gst-swipe"]').textContent,
    pinch: document.querySelector('[data-out="gst-pinch"]').textContent,
    state: document.querySelector('[data-out="gst-state"]').textContent,
    line: document.querySelector('#gst-verdict-line').textContent
  }));
  ok('swipe counted', gst.swipe === '2', JSON.stringify(gst));
  ok('pinch counted', gst.pinch === '1', gst.pinch);
  ok('gesture state both working', gst.state === 'both working', gst.state);

  // ctrl+wheel with a big delta must NOT be counted as a pinch
  await page.evaluate(() => {
    const el = document.querySelector('#trackpad-pad');
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, deltaMode: 0, ctrlKey: true, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  const pinchAfter = await page.textContent('[data-out="gst-pinch"]');
  ok('ctrl+wheel with a big delta is not a pinch', pinchAfter === '1', 'gst-pinch=' + pinchAfter);

  // ---------- no separate trackpad summary row ----------
  const summaryPresent = await page.evaluate(() => !!document.querySelector('#trackpad-summary'));
  ok('the trackpad has no separate summary row', !summaryPresent, 'the keyboard page keeps one summary');

  // ---------- reset ----------
  await page.click('#trackpad-reset');
  await page.waitForTimeout(200);
  const afterReset = await page.evaluate(() => ({
    clicks: document.querySelector('[data-out="tp-clicks"]').textContent,
    drags: document.querySelector('[data-out="tp-drags"]').textContent,
    scrolls: document.querySelector('[data-out="tp-scrolls"]').textContent,
    chip: document.querySelector('#tp-chip-clicks').classList.contains('is-on')
  }));
  ok('reset clears the counters', afterReset.clicks === '0' && afterReset.drags === '0' && afterReset.scrolls === '0' && !afterReset.chip, JSON.stringify(afterReset));

  // ---------- screenshots ----------
  await page.screenshot({ path: '/workspace/output/tp-desktop.png', fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/workspace/output/tp-full.png', fullPage: true });

  // ---------- mobile ----------
  for (const w of [390, 768]) {
    const m = await ctx.newPage();
    const merr = [];
    m.on('pageerror', e => merr.push(e.message));
    await m.setViewportSize({ width: w, height: 800 });
    await m.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('no horizontal overflow at ' + w + 'px', overflow <= 0, 'overflow=' + overflow + 'px');
    ok('no page errors at ' + w + 'px', merr.length === 0, merr.join('; '));
    if (w === 390) await m.screenshot({ path: '/workspace/output/tp-mobile.png', fullPage: false });
    await m.close();
  }

  // ---------- all pages console check ----------
  const pages = ['index.html', 'mouse-check.html', 'keyboard-check.html',
    'about.html', 'contact.html', 'privacy.html', 'terms.html', '404.html',
    'troubleshooting/index.html', 'troubleshooting/mouse.html', 'troubleshooting/keyboard.html'];
  for (const p of pages) {
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(BASE + '/' + p, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(400);
    ok('clean console: ' + p, errs.length === 0, errs.slice(0, 2).join(' | '));
    await pg.close();
  }

  ok('no console errors on the keyboard page', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  const failed = results.filter(r => !r.pass);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach(f => console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : '')));
    process.exit(1);
  }
})();
