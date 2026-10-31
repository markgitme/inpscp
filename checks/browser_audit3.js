const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

let fails = 0, passes = 0;
const ok = (n, c, d) => { if (c) { passes++; console.log('PASS  ' + n + (d ? '  — ' + d : '')); } else { fails++; console.log('FAIL  ' + n + (d ? '  — ' + d : '')); } };

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  console.log('=== CLICK TESTER (clicking the stage) ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/mouse-check.html', { waitUntil: 'networkidle' });
    const stage = await p.$('#mouse-stage');
    await stage.scrollIntoViewIfNeeded();
    const bb = await stage.boundingBox();
    const before = await p.evaluate(() => document.getElementById('mouse-summary').textContent.replace(/\s+/g, ' ').trim());
    // left button area of the diagram
    await p.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.25);
    await p.waitForTimeout(1200);
    const after = await p.evaluate(() => document.getElementById('mouse-summary').textContent.replace(/\s+/g, ' ').trim());
    ok('a left click on the diagram is counted', before !== after, JSON.stringify(before) + '  ->  ' + JSON.stringify(after));
    // right button area
    const bb2 = await stage.boundingBox();
    await p.mouse.click(bb2.x + bb2.width * 0.7, bb2.y + bb2.height * 0.25, { button: 'right' });
    await p.waitForTimeout(1200);
    const after2 = await p.evaluate(() => document.getElementById('mouse-summary').textContent.replace(/\s+/g, ' ').trim());
    ok('a right click on the diagram is counted', after2 !== after, JSON.stringify(after2));
    // scroll wheel
    const bb3 = await stage.boundingBox();
    await p.mouse.move(bb3.x + bb3.width / 2, bb3.y + bb3.height / 2);
    await p.mouse.wheel(0, 120);
    await p.waitForTimeout(1200);
    const after3 = await p.evaluate(() => document.getElementById('mouse-summary').textContent.replace(/\s+/g, ' ').trim());
    ok('a scroll on the diagram is counted', after3 !== after2, JSON.stringify(after3));
    // the reset button must zero it
    await p.click('#mouse-display-reset');
    await p.waitForTimeout(1200);
    const reset = await p.evaluate(() => document.getElementById('mouse-summary').textContent.replace(/\s+/g, ' ').trim());
    ok('reset counters returns to zero', /Left clicks0/.test(reset.replace(/\s+/g, ' ')), JSON.stringify(reset));
    await p.close();
  }

  console.log('\n=== TYPING SPEED (start first, then type) ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });
    await p.click('#typing-start');
    await p.click('#typing-box');
    await p.keyboard.type('The quick brown fox jumps over the lazy dog');
    await p.waitForTimeout(300);
    const wpm = await p.evaluate(() => document.querySelector('[data-out="typing-wpm"]').textContent.trim());
    const acc = await p.evaluate(() => document.querySelector('[data-out="typing-acc"]').textContent.trim());
    ok('typing speed is a real number', wpm && wpm !== '—' && Number(wpm) > 0, 'wpm=' + wpm + ' acc=' + acc);
    await p.close();
  }

  console.log('\n=== LATENCY (needs key presses) ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = true); });
    await p.click('#lat-start');
    for (let i = 0; i < 12; i++) { await p.keyboard.press('j'); await p.waitForTimeout(70); }
    await p.waitForTimeout(400);
    const avg = await p.evaluate(() => document.querySelector('[data-out="lat-avg"]').textContent.trim());
    const cnt = await p.evaluate(() => document.querySelector('[data-out="lat-count"]').textContent.trim());
    const jit = await p.evaluate(() => document.querySelector('[data-out="lat-jitter"]').textContent.trim());
    ok('latency average is measured', avg && avg !== '…' && avg !== '—', 'avg=' + avg + ' count=' + cnt + ' jitter=' + jit);
    await p.click('#lat-stop');
    await p.waitForTimeout(200);
    const cnt2 = await p.evaluate(() => document.querySelector('[data-out="lat-count"]').textContent.trim());
    ok('stop freezes the count', cnt2 === cnt, cnt + ' -> ' + cnt2);
    await p.close();
  }

  console.log('\n=== CONTACT FORM: exact submit response ===');
  {
    const p = await ctx.newPage();
    const resp = [];
    p.on('response', async r => {
      if (r.url().includes('api.web3forms.com/submit')) {
        let body = '';
        try { body = (await r.text()).slice(0, 400); } catch (e) { body = '(unreadable)'; }
        resp.push({ status: r.status(), ct: r.headers()['content-type'], body });
      }
    });
    const failed = [];
    p.on('requestfailed', r => failed.push(r.url() + ' :: ' + (r.failure() || {}).errorText));
    await p.goto(BASE + '/contact.html', { waitUntil: 'networkidle' });
    await p.fill('#cf-email', 'probe@example.com');
    await p.fill('#cf-subject', 'probe');
    await p.fill('#cf-message', 'probe');
    await p.click('button[type="submit"]');
    await p.waitForTimeout(9000);
    console.log('   submit response:', JSON.stringify(resp, null, 1));
    console.log('   failed requests:', JSON.stringify(failed));
    const st = await p.evaluate(() => {
      const el = document.getElementById('form-status');
      return { text: el.textContent.trim(), cls: el.className };
    });
    console.log('   visitor sees:', JSON.stringify(st));
    await p.close();
  }

  console.log('\n==== ' + passes + ' passed, ' + fails + ' failed ====');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
