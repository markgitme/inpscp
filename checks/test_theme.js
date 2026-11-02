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
  monochrome: { bg: 'rgb(12, 12, 13)',    color: 'rgb(241, 241, 242)', chrome: '#0c0c0d' },
  ember:     { bg: 'rgb(16, 14, 12)',    color: 'rgb(242, 236, 228)', chrome: '#100e0c' },
  daylight:  { bg: 'rgb(246, 244, 239)', color: 'rgb(23, 25, 28)',    chrome: '#f6f4ef' }
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

  // the pages added later carry no control, but the themes still reach them
  await page.goto(BASE + '/headset-check.html', { waitUntil: 'load' });
  const hsPickers = await page.$$eval('[data-theme-select]', e => e.length);
  ok(hsPickers === 0, 'the headset page carries no picker', String(hsPickers));
  const onHeadset = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor
  }));
  ok(onHeadset.attr === 'daylight', 'the theme reaches the headset page', onHeadset.attr);
  ok(onHeadset.bg === THEMES.daylight.bg, 'and the headset page paints the chosen palette', onHeadset.bg);

  await page.goto(BASE + '/troubleshooting/headset.html', { waitUntil: 'load' });
  const onGuide = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    pickers: document.querySelectorAll('[data-theme-select]').length
  }));
  ok(onGuide.attr === 'daylight', 'the theme reaches the headphone guide', onGuide.attr);
  ok(onGuide.bg === THEMES.daylight.bg, 'and the guide paints the chosen palette', onGuide.bg);
  ok(onGuide.pickers === 0, 'the guide carries no picker either', String(onGuide.pickers));

  // every theme reaches every page: the panels, the text and the accents
  // have to move with the palette, not just the body behind them
  for (const value of VALUES) {
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.selectOption('[data-theme-select]', value);
    await page.waitForTimeout(120);
    for (const p of ['/headset-check.html', '/troubleshooting/headset.html']) {
      await page.goto(BASE + p, { waitUntil: 'load' });
      const got = await page.evaluate(() => {
        const cs = getComputedStyle;
        const body = cs(document.body);
        const panel = document.querySelector('.panel, .doc-section');
        const h1 = document.querySelector('h1');
        return {
          attr: document.documentElement.getAttribute('data-theme'),
          bg: body.backgroundColor,
          color: body.color,
          panel: panel ? cs(panel).backgroundColor : null,
          border: panel ? cs(panel).borderColor : null,
          h1: h1 ? cs(h1).color : null
        };
      });
      const label = value + ' on ' + p;
      ok(got.attr === value, label + ': the palette is applied', got.attr);
      ok(got.bg === THEMES[value].bg, label + ': the background follows it', got.bg);
      ok(got.color === THEMES[value].color, label + ': the text colour follows it', got.color);
      ok(got.panel !== null && got.panel !== got.bg, label + ': the panel is painted from the palette', String(got.panel));
      ok(got.h1 === THEMES[value].color, label + ': the heading is painted from the palette', String(got.h1));
    }
  }

  ok(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
