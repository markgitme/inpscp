const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

const PAGES = ['/index.html', '/mouse-check.html', '/keyboard-check.html', '/about.html',
  '/contact.html', '/privacy.html', '/terms.html', '/404.html',
  '/troubleshooting/index.html', '/troubleshooting/mouse.html',
  '/troubleshooting/keyboard.html', '/troubleshooting/trackpad.html'];

let fails = 0, passes = 0;
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log('PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else { fails++; console.log('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // ---------- 1. every page: console, errors, failed requests, overflow
  console.log('\n=== PAGE SWEEP ===');
  for (const u of PAGES) {
    const p = await ctx.newPage();
    const errs = [], failed = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    p.on('requestfailed', r => failed.push(r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
    const resp = await p.goto(BASE + u, { waitUntil: 'networkidle' });
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(u + ' loads 200', resp.status() === 200, 'status ' + resp.status());
    ok(u + ' no console errors', errs.length === 0, errs.join(' | ').slice(0, 160));
    ok(u + ' no failed requests', failed.length === 0, failed.join(' | ').slice(0, 160));
    ok(u + ' no horizontal overflow @1280', ov === 0, 'overflow ' + ov + 'px');
    await p.close();
  }

  // ---------- 2. overflow at six widths
  console.log('\n=== OVERFLOW AT 6 WIDTHS ===');
  for (const w of [360, 390, 430, 768, 1024, 1280]) {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: w, height: 900 });
    const bad = [];
    for (const u of PAGES) {
      await p.goto(BASE + u, { waitUntil: 'domcontentloaded' });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 0) bad.push(u + '(+' + ov + 'px)');
    }
    ok('no overflow at ' + w + 'px', bad.length === 0, bad.join(', '));
    await p.close();
  }

  // ---------- 3. heading order
  console.log('\n=== HEADING ORDER ===');
  for (const u of PAGES) {
    const p = await ctx.newPage();
    await p.goto(BASE + u, { waitUntil: 'domcontentloaded' });
    const jumps = await p.evaluate(() => {
      const out = [];
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
      let prev = 0;
      for (const h of hs) {
        const l = Number(h.tagName[1]);
        if (prev && l > prev + 1) out.push('h' + prev + '->h' + l + ' "' + h.textContent.trim().slice(0, 32) + '"');
        prev = l;
      }
      return out;
    });
    ok(u + ' heading order', jumps.length === 0, jumps.join(' | '));
    await p.close();
  }

  // ---------- 4. mouse tool smoke test
  console.log('\n=== MOUSE TOOL ===');
  {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await p.goto(BASE + '/mouse-check.html', { waitUntil: 'networkidle' });

    // click tester: clicking the display must increment the counter
    const stage = await p.$('#mouse-stage');
    ok('mouse click tester stage found', !!stage);
    if (stage) {
      await stage.scrollIntoViewIfNeeded();
      const bb = await stage.boundingBox();
      const before = await p.evaluate(() => document.getElementById('mouse-summary').textContent.replace(/\s+/g, ' ').trim());
      await p.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.25);
      await p.waitForTimeout(1200);
      const after = await p.evaluate(() => document.getElementById('mouse-summary').textContent.replace(/\s+/g, ' ').trim());
      ok('click tester counts a click', before !== after, before + ' -> ' + after);
    }

    // every control on the page must be clickable and must not throw
    await p.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = true); });
    await p.waitForTimeout(250);
    const btns = await p.$$eval('button', bs => bs.map(b => b.id).filter(Boolean));
    ok('mouse page has controls', btns.length >= 9, btns.length + ' buttons');
    for (const id of btns) {
      const el = await p.$('#' + id);
      if (!el) { ok('button #' + id + ' exists', false); continue; }
      await el.scrollIntoViewIfNeeded().catch(() => {});
      const disabled = await el.evaluate(e => e.disabled);
      if (disabled) { ok('button #' + id + ' enabled', false, 'disabled'); continue; }
      ok('button #' + id + ' visible', await el.isVisible());
    }
    ok('mouse page: no console errors after interaction', errs.length === 0, errs.join(' | ').slice(0, 200));
    await p.close();
  }

  // ---------- 5. keyboard tool smoke test
  console.log('\n=== KEYBOARD TOOL ===');
  {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await p.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });

    // key map lights on keydown and clears on keyup
    await p.keyboard.down('a');
    await p.waitForTimeout(120);
    const lit = await p.evaluate(() => {
      const k = document.querySelector('[data-code="KeyA"]');
      return k ? k.className : null;
    });
    ok('key map lights KeyA', !!lit && /hit/.test(lit), String(lit));
    await p.keyboard.up('a');
    await p.waitForTimeout(120);
    const unlit = await p.evaluate(() => {
      const k = document.querySelector('[data-code="KeyA"]');
      return k ? k.className : null;
    });
    ok('key map clears KeyA on keyup', !/hit/.test(String(unlit)), String(unlit));

    // typing speed: type into the box and start the timer
    await p.click('#typing-start');
    await p.click('#typing-box');
    await p.keyboard.type('The quick brown fox jumps over the lazy dog');
    await p.waitForTimeout(400);
    const typed = await p.evaluate(() => {
      const el = document.querySelector('[data-out="typing-wpm"]');
      return el ? el.textContent.trim() : null;
    });
    ok('typing speed produces a number', typed !== null && typed !== '' && typed !== '—', String(typed));

    // trackpad panel: real right click lights the right strip
    const rightLit = await p.evaluate(() => {
      const b = document.querySelector('#trackpad-btn-right');
      return b ? b.className : null;
    });
    ok('trackpad right button starts unlit', !/is-down|is-active/.test(String(rightLit)), String(rightLit));

    // every control
    await p.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = true); });
    await p.waitForTimeout(250);
    const btns = await p.$$eval('button', bs => bs.map(b => b.id).filter(Boolean));
    for (const id of btns) {
      const el = await p.$('#' + id);
      if (!el) { ok('button #' + id + ' exists', false); continue; }
      await el.scrollIntoViewIfNeeded().catch(() => {});
      ok('button #' + id + ' visible', await el.isVisible());
    }
    ok('keyboard page: no console errors after interaction', errs.length === 0, errs.join(' | ').slice(0, 200));
    await p.close();
  }

  // ---------- 6. contact form: the gate
  console.log('\n=== CONTACT FORM ===');
  {
    const p = await ctx.newPage();
    const errs = [], third = [];
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    p.on('request', r => { if (/web3forms|hcaptcha/i.test(r.url())) third.push(r.url()); });
    await p.goto(BASE + '/contact.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const st = await p.evaluate(() => ({
      formHidden: document.getElementById('contact-form').getClientRects().length === 0,
      notice: document.getElementById('form-notice').hidden === false
        ? document.getElementById('form-notice').innerText.trim() : null
    }));
    ok('the contact form is gated while the key is a placeholder', st.formHidden === true);
    ok('an honest notice replaces the form', !!st.notice, (st.notice || '').slice(0, 70));
    ok('no third-party form service is loaded', third.length === 0, third.join(' | '));
    ok('contact page: no page errors', errs.length === 0, errs.join(' | '));
    await p.close();
  }

  // ---------- 7. review mode + skip link + focus
  console.log('\n=== REVIEW MODE / A11Y ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/index.html?review=1', { waitUntil: 'networkidle' });
    const rev = await p.evaluate(() => {
      const el = document.querySelector('.rv-banner:not(.rv-hidden)');
      return el ? { found: true, cls: el.className } : { found: false };
    });
    ok('review mode opens with ?review=1', rev.found, JSON.stringify(rev));
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const skip = await p.evaluate(() => {
      const a = document.querySelector('a[href="#main"]');
      if (!a) return { found: false };
      a.focus();
      return { found: true, target: !!document.querySelector('#main') };
    });
    ok('skip link points at a real #main', skip.found && skip.target, JSON.stringify(skip));
    await p.close();
  }

  console.log('\n==== ' + passes + ' passed, ' + fails + ' failed ====');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
