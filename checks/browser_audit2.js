const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

let fails = 0, passes = 0;
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log('PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else { fails++; console.log('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // ---------- MOUSE TOOL ----------
  console.log('\n=== MOUSE TOOL ===');
  {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await p.goto(BASE + '/mouse-check.html', { waitUntil: 'networkidle' });

    // click tester: the summary tiles must react to a real click
    const disp = await p.$('#mouse-display');
    ok('click tester display exists', !!disp);
    if (disp) {
      await disp.scrollIntoViewIfNeeded();
      const bb = await disp.boundingBox();
      const before = await p.evaluate(() => document.getElementById('mouse-summary').textContent.trim());
      await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await p.waitForTimeout(1200);
      const after = await p.evaluate(() => document.getElementById('mouse-summary').textContent.trim());
      ok('click tester summary changes after a click', before !== after, JSON.stringify(before) + ' -> ' + JSON.stringify(after));
      const pill = await p.evaluate(() => document.getElementById('mouse-summary-pill').textContent.trim());
      console.log('   summary pill:', JSON.stringify(pill));
    }

    // advanced diagnostics live inside a <details> — open it, then check the controls
    const det = await p.$('details');
    ok('mouse page has a details panel', !!det);
    if (det) {
      await p.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = true); });
      await p.waitForTimeout(200);
      for (const id of ['drag-start', 'scroll-start', 'motion-start', 'motion-reset', 'hover-start',
        'precision-start', 'dbl-start', 'polling-start', 'mouse-display-reset', 'mouse-copy']) {
        const el = await p.$('#' + id);
        ok('button #' + id + ' visible once panels are open', el ? await el.isVisible() : false);
      }
      // every advanced control must be clickable without throwing
      for (const id of ['drag-start', 'scroll-start', 'motion-start', 'hover-start', 'precision-start', 'dbl-start', 'polling-start']) {
        const el = await p.$('#' + id);
        if (!el) continue;
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await el.click({ timeout: 3000 }).catch(e => ok('click #' + id, false, e.message));
      }
      await p.waitForTimeout(800);
    }
    ok('mouse page: no console errors after interaction', errs.length === 0, errs.join(' | ').slice(0, 200));
    await p.close();
  }

  // ---------- KEYBOARD TOOL ----------
  console.log('\n=== KEYBOARD TOOL ===');
  {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await p.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });

    await p.keyboard.down('a');
    await p.waitForTimeout(120);
    const lit = await p.evaluate(() => {
      const k = document.querySelector('[data-code="KeyA"]');
      return k ? k.className : null;
    });
    ok('key map lights KeyA on keydown', /hit/.test(String(lit)), String(lit));
    await p.keyboard.up('a');
    await p.waitForTimeout(120);
    const unlit = await p.evaluate(() => {
      const k = document.querySelector('[data-code="KeyA"]');
      return k ? k.className : null;
    });
    ok('key map clears KeyA on keyup', !/hit/.test(String(unlit)), String(unlit));

    // typing speed
    await p.click('#typing-box');
    await p.keyboard.type('The quick brown fox jumps over the lazy dog');
    await p.click('#typing-start');
    await p.waitForTimeout(700);
    const wpm = await p.evaluate(() => document.querySelector('[data-out="typing-wpm"]').textContent.trim());
    ok('typing speed produces a number', wpm && wpm !== '—', 'wpm=' + wpm);

    // key map counter
    const cnt = await p.evaluate(() => document.querySelector('[data-out="keymap-count"]').textContent.trim());
    ok('key map counter shows a number', cnt && cnt !== '—', 'count=' + cnt);

    // latency panel
    await p.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = true); });
    await p.waitForTimeout(200);
    for (const id of ['lat-start', 'lat-stop', 'layout-start', 'layout-analyze', 'roll-start', 'ptr-start', 'scr-start', 'gst-start', 'trackpad-reset']) {
      const el = await p.$('#' + id);
      ok('button #' + id + ' visible once panels are open', el ? await el.isVisible() : false);
    }
    const lat = await p.$('#lat-start');
    if (lat) { await lat.scrollIntoViewIfNeeded(); await lat.click(); await p.waitForTimeout(1200); }
    const latv = await p.evaluate(() => document.querySelector('[data-out="lat-avg"]').textContent.trim());
    ok('latency sample produces a number', latv && latv !== '—', 'lat-avg=' + latv);

    ok('keyboard page: no console errors after interaction', errs.length === 0, errs.join(' | ').slice(0, 200));
    await p.close();
  }

  // ---------- CONTACT FORM: what does the visitor actually see ----------
  console.log('\n=== CONTACT FORM (real browser) ===');
  {
    const p = await ctx.newPage();
    const responses = [];
    p.on('response', async r => {
      if (r.url().includes('web3forms')) {
        let body = '';
        try { body = (await r.text()).slice(0, 300); } catch (e) { body = '(unreadable)'; }
        responses.push({ status: r.status(), body });
      }
    });
    await p.goto(BASE + '/contact.html', { waitUntil: 'networkidle' });
    await p.fill('#cf-name', 'Maintenance check');
    await p.fill('#cf-email', 'probe@example.com');
    await p.fill('#cf-subject', 'probe');
    await p.fill('#cf-message', 'probe');
    await p.click('button[type="submit"]');
    await p.waitForTimeout(8000);
    const st = await p.evaluate(() => {
      const el = document.getElementById('form-status');
      return el ? { text: el.textContent.trim(), cls: el.className } : null;
    });
    console.log('   web3forms response:', JSON.stringify(responses));
    console.log('   visitor sees:      ', JSON.stringify(st));
    ok('visitor gets a truthful status', !!st && !!st.text, JSON.stringify(st));
    ok('no false success on an undelivered message', !/on its way|thanks/i.test(st.text), st.text);
    await p.close();
  }

  // ---------- REVIEW MODE ----------
  console.log('\n=== REVIEW MODE ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/index.html?review=1', { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const rev = await p.evaluate(() => ({
      banner: !!document.querySelector('.rv-banner:not(.rv-hidden)'),
      toggle: !!document.querySelector('.rv-toggle:not(.rv-hidden)'),
      cls: (document.querySelector('.rv-banner') || {}).className
    }));
    ok('?review=1 shows the review banner', rev.banner, JSON.stringify(rev));
    ok('the review toggle is available', rev.toggle, JSON.stringify(rev));
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const off = await p.evaluate(() => !!document.querySelector('.rv-banner:not(.rv-hidden)'));
    ok('review mode is off without the query string', !off);
    await p.close();
  }

  console.log('\n==== ' + passes + ' passed, ' + fails + ' failed ====');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
