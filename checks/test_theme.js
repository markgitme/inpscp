/* The theme picker: the labels the reader sees, the internal names the code
 * reads, and the wiring from one to the other.
 *
 * The picker shows three words — Dark, Ember, Light — while the code reads
 * three internal names — monochrome, ember, daylight. Those two sets do not
 * have to match, and these checks exist so that nobody has to take that on
 * trust: the reader-facing labels are pinned, the internal values are pinned,
 * and every theme is proved to paint its own palette when it is chosen.
 *
 * The picker lives on the home page only. Every other page still honours the
 * choice, so that is checked too.
 */
const { chromium } = require('/usr/local/lib/node_modules/playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8899';
const EXEC = process.env.CHROME_PATH ||
  '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome';

const THEMES = {
  monochrome: { bg: 'rgb(12, 12, 13)',    chrome: '#0c0c0d' },
  ember:     { bg: 'rgb(16, 14, 12)',    chrome: '#100e0c' },
  daylight:  { bg: 'rgb(246, 244, 239)', chrome: '#f6f4ef' }
};
const LABELS = ['Dark', 'Ember', 'Light'];
const VALUES = ['monochrome', 'ember', 'daylight'];

let fails = 0, passes = 0;
function ok(cond, name, detail) {
  if (cond) { passes++; console.log('PASS ' + name); }
  else { fails++; console.log('FAIL ' + name + (detail !== undefined ? '  — ' + detail : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.querySelector('[data-theme-select]'));

  // the words on screen
  const labels = await page.$$eval('[data-theme-select] option', os => os.map(o => o.textContent.trim()));
  ok(JSON.stringify(labels) === JSON.stringify(LABELS),
     'the picker shows ' + LABELS.join(', '), JSON.stringify(labels));

  // the names in the code
  const values = await page.$$eval('[data-theme-select] option', os => os.map(o => o.value));
  ok(JSON.stringify(values) === JSON.stringify(VALUES),
     'the option values are ' + VALUES.join(', '), JSON.stringify(values));

  // a fresh visitor gets the default
  const fresh = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor
  }));
  ok(fresh.attr === 'monochrome', 'a fresh visitor gets data-theme="monochrome"', fresh.attr);
  ok(fresh.bg === THEMES.monochrome.bg, 'the default paints the Monochrome palette', fresh.bg);

  // each theme paints its own palette
  for (const value of VALUES) {
    await page.selectOption('[data-theme-select]', value);
    await page.waitForFunction(v => document.documentElement.getAttribute('data-theme') === v, value);
    const got = await page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      stored: localStorage.getItem('inputscope-theme'),
      chrome: document.querySelector('meta[name="theme-color"]').getAttribute('content')
    }));
    ok(got.bg === THEMES[value].bg, 'choosing ' + value + ' paints its own palette', got.bg);
    ok(got.stored === value, 'choosing ' + value + ' stores the value, not the label', got.stored);
    ok(got.chrome === THEMES[value].chrome, 'the browser chrome colour follows ' + value, got.chrome);

    // the highlighted word is painted with a transparent colour, so it only
    // shows if the background is clipped to the text. A theme that used the
    // `background` shorthand would reset the clip and the word would vanish.
    const grad = await page.evaluate(() => {
      const el = document.querySelector('.grad');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { clip: cs.backgroundClip, webkit: cs.webkitBackgroundClip,
               color: cs.color, w: r.width, h: r.height };
    });
    ok(grad !== null, 'the highlighted word exists in ' + value);
    ok(grad && grad.clip === 'text' && grad.webkit === 'text',
       'the highlighted word is clipped to its text in ' + value,
       grad ? grad.clip + ' / ' + grad.webkit : 'no .grad element');
    ok(grad && grad.w > 0 && grad.h > 0,
       'the highlighted word still has size in ' + value,
       grad ? grad.w + 'x' + grad.h : '');
  }

  // the choice carries to another page, and that page offers no picker
  await page.goto(BASE + '/mouse-check.html', { waitUntil: 'load' });
  const carried = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor
  }));
  ok(carried.attr === 'daylight', 'the choice carries to another page', carried.attr);
  ok(carried.bg === THEMES.daylight.bg, 'and that page paints the chosen palette', carried.bg);
  const pickers = await page.$$eval('[data-theme-select]', e => e.length);
  ok(pickers === 0, 'no picker on the mouse page', String(pickers));

  // the headset pages do carry the picker, and choosing on one of them works
  await page.goto(BASE + '/headset-check.html', { waitUntil: 'load' });
  const hsPickers = await page.$$eval('[data-theme-select]', e => e.length);
  ok(hsPickers === 1, 'the headset page carries the picker', String(hsPickers));
  await page.selectOption('[data-theme-select]', 'ember');
  await page.waitForTimeout(150);
  const onHeadset = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    stored: localStorage.getItem('inputscope-theme')
  }));
  ok(onHeadset.attr === 'ember', 'choosing on the headset page changes the theme', onHeadset.attr);
  ok(onHeadset.bg === THEMES.ember.bg, 'and the headset page paints the chosen palette', onHeadset.bg);
  ok(onHeadset.stored === 'ember', 'and the choice is stored for the next page', String(onHeadset.stored));

  await page.goto(BASE + '/troubleshooting/headset.html', { waitUntil: 'load' });
  const onGuide = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    pickers: document.querySelectorAll('[data-theme-select]').length
  }));
  ok(onGuide.attr === 'ember', 'the choice carries to the headphone guide', onGuide.attr);
  ok(onGuide.pickers === 1, 'the guide carries the picker too', String(onGuide.pickers));

  ok(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
