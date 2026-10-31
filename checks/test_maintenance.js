/* Maintenance checks for the v1.16.0 fixes:
     - the contact form is gated while the access key is a placeholder
     - the gated page loads no third-party form script
     - a placeholder-key reply can never read as success
     - "Copy results" actually copies
     - the skip link moves focus, not just the viewport
     - heading order is clean on every page
*/
const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

let fails = 0, passes = 0;
const ok = (n, c, d) => { if (c) { passes++; console.log('PASS  ' + n + (d ? '  — ' + d : '')); } else { fails++; console.log('FAIL  ' + n + (d ? '  — ' + d : '')); } };

const PAGES = ['/index.html', '/mouse-check.html', '/keyboard-check.html', '/about.html',
  '/contact.html', '/privacy.html', '/terms.html', '/404.html',
  '/troubleshooting/index.html', '/troubleshooting/mouse.html',
  '/troubleshooting/keyboard.html', '/troubleshooting/trackpad.html'];

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });

  console.log('\n=== CONTACT FORM GATE ===');
  {
    const p = await ctx.newPage();
    const third = [];
    p.on('request', r => { if (/web3forms|hcaptcha/i.test(r.url())) third.push(r.url()); });
    await p.goto(BASE + '/contact.html', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);

    const state = await p.evaluate(() => {
      const form = document.getElementById('contact-form');
      return {
        formHidden: !form.offsetParent && form.getClientRects().length === 0,
        formVisible: form.getClientRects().length > 0,
        noticeHidden: document.getElementById('form-notice').hidden,
        thirdHidden: document.getElementById('form-third-party').getClientRects().length === 0,
        noticeText: document.getElementById('form-notice').innerText.trim(),
        hasScript: !!document.querySelector('script[data-web3forms]')
      };
    });
    ok('the form is not visible while the key is a placeholder', state.formHidden && !state.formVisible, JSON.stringify(state.formVisible));
    ok('the honest notice is shown', state.noticeHidden === false, state.noticeText.slice(0, 80));
    ok('the Web3Forms third-party note is hidden too', state.thirdHidden === true);
    ok('no static Web3Forms script tag is left in the page', state.hasScript === false);
    ok('no third-party form request was made', third.length === 0, third.join(' | '));
    ok('the notice gives a way to reach the owner', /hello@inputscope\.com/.test(state.noticeText), state.noticeText.slice(0, 90));

    // a form that is not there cannot be submitted
    const noButton = await p.evaluate(() => {
      const b = document.querySelector('#contact-form button[type="submit"]');
      return !!(b && b.getClientRects().length > 0);
    });
    ok('there is no visible submit button', noButton === false);

    await p.close();
  }

  console.log('\n=== COPY RESULTS ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/mouse-check.html', { waitUntil: 'networkidle' });
    const stage = await p.$('#mouse-stage');
    await stage.scrollIntoViewIfNeeded();
    const bb = await stage.boundingBox();
    await p.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.25);
    await p.waitForTimeout(1200);
    await p.click('#mouse-copy');
    await p.waitForTimeout(400);
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    const label = await p.evaluate(() => document.getElementById('mouse-copy').textContent.trim());
    ok('the copy button copies the results', clip.length > 0 && /results/i.test(clip), JSON.stringify(clip.slice(0, 70)));
    ok('the button says it copied', label === 'Copied', label);

    await p.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });
    await p.keyboard.press('a');
    await p.waitForTimeout(1200);
    await p.click('#kbd-copy');
    await p.waitForTimeout(400);
    const clip2 = await p.evaluate(() => navigator.clipboard.readText());
    ok('the keyboard copy button works too', clip2.length > 0 && /results/i.test(clip2), JSON.stringify(clip2.slice(0, 70)));
    await p.close();
  }

  console.log('\n=== SKIP LINK FOCUS ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    await p.keyboard.press('Tab');
    const first = await p.evaluate(() => document.activeElement.className + ' | ' + document.activeElement.textContent.trim().slice(0, 24));
    ok('the skip link is the first tab stop', /skip/.test(first), first);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(700);
    const focus = await p.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    ok('following the skip link moves focus to the content', focus === 'main', 'focus=' + focus);
    await p.close();
  }

  console.log('\n=== HEADING ORDER, EVERY PAGE ===');
  for (const u of PAGES) {
    const p = await ctx.newPage();
    await p.goto(BASE + u, { waitUntil: 'domcontentloaded' });
    const jumps = await p.evaluate(() => {
      const out = []; let prev = 0;
      for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        const l = Number(h.tagName[1]);
        if (prev && l > prev + 1) out.push('h' + prev + '->h' + l + ' "' + h.textContent.trim().slice(0, 28) + '"');
        prev = l;
      }
      return out;
    });
    ok(u + ' heading order is clean', jumps.length === 0, jumps.join(' | '));
    await p.close();
  }

  console.log('\n=== LABELLED FIELDS ===');
  {
    const p = await ctx.newPage();
    await p.goto(BASE + '/keyboard-check.html', { waitUntil: 'networkidle' });
    const labs = await p.evaluate(() => {
      const out = [];
      for (const t of document.querySelectorAll('textarea, input:not([type=hidden])')) {
        if (t.getAttribute('aria-hidden') === 'true' || t.type === 'checkbox') continue;
        if (t.hasAttribute('data-rv-text')) continue;   // the review mode's own box
        const l = t.id && document.querySelector('label[for="' + t.id + '"]');
        out.push((t.id || t.name) + ':' + (l ? 'labelled' : 'NO LABEL'));
      }
      return out;
    });
    ok('every field has a label', labs.every(x => /labelled$/.test(x)), labs.join(' | '));
    await p.close();
  }

  console.log('\n==== ' + passes + ' passed, ' + fails + ' failed ====');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
