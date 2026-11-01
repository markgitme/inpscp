/* ==========================================================================
   The colour-theme picker.

   A theme is a set of CSS variables on :root (and on html[data-theme="…"]),
   so switching the theme is a matter of setting one attribute on <html>.
   There is no stylesheet to fetch and therefore nothing to flash: the
   attribute is set before the page paints by an inline script in <head>.

   The picker itself lives on the home page only. Every other page still
   honours the choice — it reads the same stored value — but does not offer
   the control, because a reader who has already chosen does not need to be
   asked again on every page, and a reader who has not does not need to see
   a dropdown they were not looking for.

   The choice is remembered in localStorage, so a visitor who picked a theme
   gets the same one next time.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'inputscope-theme';

  var THEMES = {
    monochrome: { chrome: '#0c0c0d' },
    ember:     { chrome: '#100e0c' },
    daylight:  { chrome: '#f6f4ef' }
  };
  var DEFAULT_THEME = 'monochrome';

  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  var select = document.querySelector('[data-theme-select]');

  function known(theme) {
    return Object.prototype.hasOwnProperty.call(THEMES, theme);
  }

  function apply(theme, save) {
    if (!known(theme)) theme = DEFAULT_THEME;

    root.setAttribute('data-theme', theme);

    /* the browser chrome — the phone's status bar, the tab strip — follows */
    if (meta && THEMES[theme].chrome) {
      meta.setAttribute('content', THEMES[theme].chrome);
    }

    if (save) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* private mode */ }
    }
    return theme;
  }

  /* a stored choice wins over the default, on every page */
  var stored = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
  var theme = apply(known(stored) ? stored : DEFAULT_THEME, false);

  /* the control, where there is one */
  if (select) {
    select.value = theme;
    select.addEventListener('change', function () {
      apply(select.value, true);
    });
  }
})();
