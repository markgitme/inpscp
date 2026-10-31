/* Drives the trackpad surfaces on the keyboard page:
     - the shape (a movement surface with a left/right button strip)
     - the browser context menu is suppressed inside both pads
     - the dot stays on the movement surface
     - the button areas report left and right
*/
const { chromium } = require('/usr/local/lib/node_modules/playwright');

let pass = 0, fail = 0;
function ok(name, cond, note) {
  if (cond) { pass++; console.log('PASS  ' + name + (note ? '  — ' + note : '')); }
  else { fail++; console.log('FAIL  ' + name + (note ? '  — ' + note : '')); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto((process.env.BASE_URL || 'http://127.0.0.1:8899') + '/keyboard-check.html', { waitUntil: 'networkidle' });

  // ---------- the shape ----------
  const shape = await page.evaluate(() => {
    const grab = (padId) => {
      const pad = document.querySelector(padId);
      if (!pad) return null;
      const surface = pad.querySelector('.tp-surface');
      const buttons = pad.querySelectorAll('.tp-btn');
      return {
        surface: !!surface,
        buttons: buttons.length,
        left: !!pad.querySelector('.tp-btn--left'),
        right: !!pad.querySelector('.tp-btn--right'),
        surfaceBottom: surface ? surface.getBoundingClientRect().bottom : 0,
        buttonsTop: buttons[0] ? buttons[0].getBoundingClientRect().top : 0
      };
    };
    return { display: grab('#tp-display-pad'), tester: grab('#trackpad-pad') };
  });
  ok('the display has a surface and two buttons',
    shape.display && shape.display.surface && shape.display.buttons === 2 && shape.display.left && shape.display.right,
    JSON.stringify(shape.display));
  ok('the tester has a surface and two buttons',
    shape.tester && shape.tester.surface && shape.tester.buttons === 2 && shape.tester.left && shape.tester.right,
    JSON.stringify(shape.tester));
  // the seam between the two is 1px — that is the border-top of the strip
  const seam = (s) => s.buttonsTop - s.surfaceBottom;
  ok('the button strip sits below the movement surface',
    seam(shape.display) >= 0 && seam(shape.display) <= 1 &&
    seam(shape.tester) >= 0 && seam(shape.tester) <= 1,
    'display seam ' + seam(shape.display).toFixed(2) + 'px, tester seam ' + seam(shape.tester).toFixed(2) + 'px');

  // ---------- the context menu is swallowed ----------
  for (const id of ['#tp-display-pad', '#trackpad-pad']) {
    const prevented = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    }, id);
    ok('the context menu is suppressed inside ' + id, prevented, 'defaultPrevented=' + prevented);
  }

  // ---------- the dot stays on the surface ----------
  const surface = await page.$('#trackpad-surface');
  await surface.scrollIntoViewIfNeeded();
  const sbox = await surface.boundingBox();
  await page.mouse.move(sbox.x + sbox.width * 0.4, sbox.y + sbox.height * 0.4);
  await page.waitForTimeout(120);
  const dotAt = await page.evaluate(() => {
    const d = document.querySelector('#trackpad-dot');
    return { left: d.style.left, top: d.style.top };
  });
  ok('the dot follows the pointer on the surface', dotAt.left !== '' && dotAt.top !== '', JSON.stringify(dotAt));

  const strip = await page.$('#trackpad-btn-right');
  const stbox = await strip.boundingBox();
  await page.mouse.move(stbox.x + stbox.width / 2, stbox.y + stbox.height / 2);
  await page.waitForTimeout(150);
  const dotAfter = await page.evaluate(() => document.querySelector('#trackpad-dot').style.left);
  ok('the dot does not travel into the button strip', dotAfter === dotAt.left,
    'left stayed ' + dotAfter);

  // ---------- a tap on the surface ----------
  await page.evaluate(() => document.querySelector('#trackpad-reset').click());
  await page.mouse.move(sbox.x + sbox.width * 0.4, sbox.y + sbox.height * 0.4);
  await page.mouse.down();
  await page.waitForTimeout(100);
  const tapped = await page.evaluate(() => ({
    tapped: document.querySelector('#trackpad-surface').classList.contains('is-tapped'),
    left: document.querySelector('#trackpad-btn-left').classList.contains('is-down'),
    right: document.querySelector('#trackpad-btn-right').classList.contains('is-down'),
    button: document.querySelector('[data-out="tp-button"]').textContent.trim()
  }));
  await page.mouse.up();
  ok('a tap tints the surface and lights the left button',
    tapped.tapped && tapped.left && !tapped.right, JSON.stringify(tapped));
  ok('a tap reports the left button', tapped.button === 'left', tapped.button);

  // ---------- the left button area ----------
  await page.evaluate(() => document.querySelector('#trackpad-reset').click());
  const lbox = await (await page.$('#trackpad-btn-left')).boundingBox();
  await page.mouse.move(lbox.x + lbox.width / 2, lbox.y + lbox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const leftDown = await page.evaluate(() => ({
    left: document.querySelector('#trackpad-btn-left').classList.contains('is-down'),
    right: document.querySelector('#trackpad-btn-right').classList.contains('is-down'),
    button: document.querySelector('[data-out="tp-button"]').textContent.trim()
  }));
  await page.mouse.up();
  ok('the left button area lights and reports left',
    leftDown.left && !leftDown.right && leftDown.button === 'left', JSON.stringify(leftDown));

  // ---------- the right button area cannot be faked with a left click ----------
  await page.evaluate(() => document.querySelector('#trackpad-reset').click());
  const rbox = await (await page.$('#trackpad-btn-right')).boundingBox();
  await page.mouse.move(rbox.x + rbox.width / 2, rbox.y + rbox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const faked = await page.evaluate(() => ({
    left: document.querySelector('#trackpad-btn-left').classList.contains('is-down'),
    right: document.querySelector('#trackpad-btn-right').classList.contains('is-down'),
    button: document.querySelector('[data-out="tp-button"]').textContent.trim(),
    log: document.querySelector('#trackpad-log').textContent
  }));
  await page.mouse.up();
  await page.waitForTimeout(120);
  ok('a left click cannot light the right button area',
    !faked.right && faked.left && faked.button === 'left', JSON.stringify(faked));
  ok('a left click is never logged as a right click',
    !/right click/.test(faked.log), faked.log.trim().slice(-48));

  // ---------- a real right-click on the surface reads as a right button ----------
  await page.evaluate(() => document.querySelector('#trackpad-reset').click());
  const surf2 = await (await page.$('#trackpad-surface')).boundingBox();
  await page.mouse.move(surf2.x + surf2.width / 2, surf2.y + surf2.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(150);
  const rcLit = await page.evaluate(() => ({
    right: document.querySelector('#trackpad-btn-right').classList.contains('is-down'),
    left: document.querySelector('#trackpad-btn-left').classList.contains('is-down')
  }));
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(150);
  const rc = await page.evaluate(() => document.querySelector('#trackpad-log').textContent);
  ok('a real right-click lights the right button area', rcLit.right && !rcLit.left, JSON.stringify(rcLit));
  ok('a right-click is logged as a right button', /right click/.test(rc), rc.trim().slice(-48));

  // ---------- the counters still work ----------
  await page.evaluate(() => document.querySelector('#trackpad-reset').click());
  const surf3 = await (await page.$('#trackpad-surface')).boundingBox();
  await page.mouse.click(surf3.x + surf3.width / 2, surf3.y + surf3.height / 2);
  await page.waitForTimeout(150);
  const counts = await page.evaluate(() => ({
    clicks: document.querySelector('[data-out="tp-clicks"]').textContent.trim(),
    drags: document.querySelector('[data-out="tp-drags"]').textContent.trim(),
    button: document.querySelector('[data-out="tp-button"]').textContent.trim()
  }));
  ok('a tap on the surface counts a click', counts.clicks === '1' && counts.drags === '0', JSON.stringify(counts));
  ok('the button returns to up after release', counts.button === 'up', counts.button);

  // ---------- the display answers the pointer and lights its own buttons ----------
  const dsurfEl = await page.$('#tp-display-surface');
  await dsurfEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const dsurf = await dsurfEl.boundingBox();
  await page.mouse.move(dsurf.x + dsurf.width / 2, dsurf.y + dsurf.height / 2);
  await page.waitForTimeout(150);
  const dstate = await page.evaluate(() => ({
    live: document.querySelector('#tp-display-pad').classList.contains('is-live'),
    left: document.querySelector('#tp-display-dot').style.left
  }));
  ok('the display dot follows the pointer', dstate.live && dstate.left !== '', JSON.stringify(dstate));

  const drbox = await (await page.$('#tp-display-btn-right')).boundingBox();
  await page.mouse.move(drbox.x + drbox.width / 2, drbox.y + drbox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const dLeft = await page.evaluate(() => ({
    right: document.querySelector('#tp-display-btn-right').classList.contains('is-down'),
    left: document.querySelector('#tp-display-btn-left').classList.contains('is-down')
  }));
  await page.mouse.up();
  await page.waitForTimeout(120);
  ok('a left click on the display does not light its right button',
    !dLeft.right && dLeft.left, JSON.stringify(dLeft));

  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(120);
  const dRight = await page.evaluate(() => document.querySelector('#tp-display-btn-right').classList.contains('is-down'));
  await page.mouse.up({ button: 'right' });
  ok('a real right-click lights the display right button', dRight, 'is-down=' + dRight);

  ok('no console errors', errors.length === 0, errors.join(' | '));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
