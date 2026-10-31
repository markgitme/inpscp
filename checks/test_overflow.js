const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';
const PAGES = ['/index.html', '/mouse-check.html', '/keyboard-check.html',
               '/troubleshooting/mouse.html', '/troubleshooting/keyboard.html',
               '/troubleshooting/trackpad.html'];
const WIDTHS = [360, 390, 430, 768, 1024, 1280];
let fails = 0;
(async () => {
  const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  for (const w of WIDTHS) {
    const page = await b.newPage({ viewport: { width: w, height: 900 } });
    for (const p of PAGES) {
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const bad = await page.evaluate(() => {
        const out = [];
        const vw = document.documentElement.clientWidth;
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.left < -500) return;          // off-screen skip link and friends
          if (r.right > vw + 1.5) {
            const cs = getComputedStyle(el);
            if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.position === 'fixed') return;
            let par = el.parentElement, scrollable = false;
            while (par) {
              const pcs = getComputedStyle(par);
              if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') { scrollable = true; break; }
              par = par.parentElement;
            }
            if (scrollable) return;
            out.push(el.tagName + '.' + (el.className || '').toString().split(' ')[0] +
                     ' [' + Math.round(r.left) + '..' + Math.round(r.right) + '] vw=' + vw);
          }
        });
        return out.slice(0, 4);
      });
      if (bad.length) { fails++; console.log('FAIL ' + w + 'px ' + p + '  ' + bad.join(' | ')); }
    }
    await page.close();
    console.log('checked ' + w + 'px');
  }
  await b.close();
  console.log(fails ? fails + ' overflow failures' : 'no overflow at any width');
  process.exit(fails ? 1 : 0);
})();
