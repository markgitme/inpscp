/* =========================================================
   InputScope — review mode
   ------------------------------------------------------------
   Lets you click any element on the live page, attach a note,
   and export every note as copy-paste text for the developer.

   Activate with ?review=1 in the URL, or the floating button.
   Once activated it stays available on other pages.
   Alt+R arms / disarms capture so you can still use the page.
   Notes persist in localStorage per page and per site.
   ========================================================= */
(function () {
  'use strict';

  var NOTE_KEY = 'inputscope_review_notes_v1';
  var MODE_KEY = 'inputscope_review_mode_v1';

  var state = {
    active: false,    // review panel visible
    armed: false,     // clicks are captured for annotation
    notes: [],
    byPage: {},
    seq: 1,
    editing: null,
    pending: null
  };

  /* ---------------- storage ---------------- */
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(NOTE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveAll() {
    try { localStorage.setItem(NOTE_KEY, JSON.stringify(state.byPage)); } catch (e) {}
  }
  function pageKey() { return location.pathname + location.search.replace(/[?&]review=1/, '').replace(/[?&]review=0/, ''); }
  function setFlag(v) { try { localStorage.setItem(MODE_KEY, v); } catch (e) {} }
  function getFlag() { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } }

  function refreshPageNotes() {
    var all = loadAll();
    state.byPage = all;
    state.notes = all[pageKey()] || [];
    state.seq = 1;
    state.notes.forEach(function (n) { if (n.id >= state.seq) state.seq = n.id + 1; });
  }

  /* ---------------- element description ---------------- */
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + el.id;
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node.tagName !== 'HTML') {
      var tag = node.tagName.toLowerCase();
      if (node.id) { parts.unshift('#' + node.id); break; }
      var cls = (node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      var part = tag;
      if (cls.length) part += '.' + cls.join('.');
      var parent = node.parentElement;
      if (parent) {
        var sibs = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function shortLabel(el) {
    if (!el || el.nodeType !== 1) return 'unknown';
    var tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return tag + (cls.length ? '.' + cls.join('.') : '');
  }

  function snippet(el) {
    if (!el) return '';
    var t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t && el.getAttribute && el.getAttribute('aria-label')) t = el.getAttribute('aria-label');
    if (!t && el.getAttribute && el.getAttribute('placeholder')) t = el.getAttribute('placeholder');
    return t.slice(0, 90);
  }

  /* ---------------- DOM: toggle button ---------------- */
  var toggle = document.createElement('button');
  toggle.className = 'rv-toggle rv-hidden';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Toggle review mode');
  toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>Review</span>';
  document.body.appendChild(toggle);

  /* ---------------- DOM: banner ---------------- */
  var banner = document.createElement('div');
  banner.className = 'rv-banner rv-hidden';
  banner.innerHTML =
    '<span class="rv-banner__count" data-rv-count>0</span>' +
    '<strong>Review mode</strong>' +
    '<button type="button" data-rv-arm class="rv-btn rv-btn--primary">Capture on</button>' +
    '<button type="button" data-rv-copy>Copy notes</button>' +
    '<button type="button" data-rv-json>JSON</button>' +
    '<button type="button" data-rv-clear>Clear page</button>' +
    '<button type="button" class="rv-close" data-rv-close aria-label="Close">&times;</button>';
  document.body.appendChild(banner);

  var countEl = banner.querySelector('[data-rv-count]');
  var armBtn = banner.querySelector('[data-rv-arm]');

  /* ---------------- DOM: capture layer ---------------- */
  var capture = document.createElement('div');
  capture.className = 'rv-capture rv-hidden';
  document.body.appendChild(capture);

  /* ---------------- DOM: highlight box ---------------- */
  var highlight = document.createElement('div');
  highlight.className = 'rv-highlight rv-hidden';
  highlight.innerHTML = '<span class="rv-highlight__tag"></span>';
  document.body.appendChild(highlight);

  /* ---------------- DOM: editor ---------------- */
  var editor = document.createElement('div');
  editor.className = 'rv-editor rv-hidden';
  editor.innerHTML =
    '<div class="rv-editor__head">' +
      '<span class="rv-editor__num" data-rv-num>1</span>' +
      '<span class="rv-editor__path" data-rv-path></span>' +
    '</div>' +
    '<textarea data-rv-text placeholder="What should change here?"></textarea>' +
    '<div class="rv-editor__row">' +
      '<button type="button" class="rv-save" data-rv-save>Save note</button>' +
      '<button type="button" class="rv-del" data-rv-del title="Delete note">✕</button>' +
    '</div>';
  document.body.appendChild(editor);

  var edNum = editor.querySelector('[data-rv-num]');
  var edPath = editor.querySelector('[data-rv-path]');
  var edText = editor.querySelector('[data-rv-text]');

  /* ---------------- toast ---------------- */
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'rv-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1900);
  }

  /* ---------------- markers ---------------- */
  var markerLayer = document.createElement('div');
  markerLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9002;';
  document.body.appendChild(markerLayer);

  function renderMarkers() {
    markerLayer.innerHTML = '';
    state.notes.forEach(function (n) {
      var m = document.createElement('button');
      m.type = 'button';
      m.className = 'rv-marker';
      m.textContent = String(n.id);
      m.dataset.id = String(n.id);
      m.style.pointerEvents = 'auto';
      m.title = n.note || '(no note yet)';
      markerLayer.appendChild(m);
    });
    positionMarkers();
    updateCount();
  }

  function positionMarkers() {
    state.notes.forEach(function (n) {
      var m = markerLayer.querySelector('.rv-marker[data-id="' + n.id + '"]');
      if (!m) return;
      var el = null;
      try { el = n.selector ? document.querySelector(n.selector) : null; } catch (e) { el = null; }
      if (el) {
        var r = el.getBoundingClientRect();
        n._x = r.left + window.pageXOffset + 7;
        n._y = r.top + window.pageYOffset + 7;
        n._found = true;
      } else {
        n._found = false;
      }
      m.style.left = (n._x || 0) + 'px';
      m.style.top = (n._y || 0) + 'px';
      m.classList.toggle('is-anchored', !!n._found);
    });
  }

  function updateCount() {
    var total = 0;
    Object.keys(state.byPage).forEach(function (k) { total += (state.byPage[k] || []).length; });
    countEl.textContent = state.notes.length + (total > state.notes.length ? ' / ' + total : '');
  }

  /* ---------------- editor ---------------- */
  function openEditor(pending) {
    state.pending = pending;
    state.editing = null;
    edNum.textContent = String(pending.id);
    edPath.textContent = pending.label;
    edPath.title = pending.selector + (pending.snippet ? ' — "' + pending.snippet + '"' : '');
    edText.value = '';
    edText.placeholder = 'What should change here?';
    editor.classList.remove('rv-hidden');
    positionEditor(pending.x, pending.y);
    setTimeout(function () { edText.focus(); }, 30);
    showHighlight(pending.el);
  }

  function openExisting(note) {
    state.editing = note;
    state.pending = null;
    edNum.textContent = String(note.id);
    edPath.textContent = note.label;
    edPath.title = note.selector;
    edText.value = note.note || '';
    editor.classList.remove('rv-hidden');
    var el = null;
    try { el = document.querySelector(note.selector); } catch (e) {}
    showHighlight(el);
    // position from the element's viewport rect, not its document coords
    var vx = window.innerWidth / 2, vy = window.innerHeight / 2;
    if (el) {
      var r = el.getBoundingClientRect();
      vx = r.left + r.width / 2;
      vy = r.top + r.height / 2;
    } else if (note._x != null) {
      vx = note._x - window.pageXOffset;
      vy = note._y - window.pageYOffset;
    }
    positionEditor(vx, vy);
    setTimeout(function () { edText.focus(); edText.select(); }, 30);
  }

  function positionEditor(x, y) {
    editor.style.left = '0px'; editor.style.top = '0px';
    var r = editor.getBoundingClientRect();
    var left = (x || 0) - r.width / 2;
    var top = (y || 0) + 18;
    left = Math.max(14, Math.min(left, window.innerWidth - r.width - 14));
    if (top + r.height > window.innerHeight - 14) top = Math.max(14, (y || 0) - r.height - 18);
    editor.style.left = left + 'px';
    editor.style.top = top + 'px';
  }

  function showHighlight(el) {
    if (!el) { highlight.classList.add('rv-hidden'); return; }
    var r = el.getBoundingClientRect();
    highlight.classList.remove('rv-hidden');
    highlight.style.left = (r.left + window.pageXOffset - 3) + 'px';
    highlight.style.top = (r.top + window.pageYOffset - 3) + 'px';
    highlight.style.width = (r.width + 6) + 'px';
    highlight.style.height = (r.height + 6) + 'px';
    highlight.querySelector('.rv-highlight__tag').textContent = shortLabel(el);
  }

  function hideEditor() {
    editor.classList.add('rv-hidden');
    highlight.classList.add('rv-hidden');
    state.pending = null;
    state.editing = null;
  }

  /* ---------------- capture click ---------------- */
  capture.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();

    // the overlay itself sits on top, so look through it
    capture.style.pointerEvents = 'none';
    var el = document.elementFromPoint(e.clientX, e.clientY);
    capture.style.pointerEvents = '';

    if (!el || el === capture) return;
    if (el.closest && el.closest('.rv-marker, .rv-editor, .rv-banner, .rv-toggle')) return;

    var id = state.seq++;
    var pending = {
      id: id,
      el: el,
      x: e.clientX,          // viewport coords — the editor is position:fixed
      y: e.clientY,
      pageX: e.pageX,        // document coords — used to anchor the marker
      pageY: e.pageY,
      selector: cssPath(el),
      label: shortLabel(el),
      snippet: snippet(el)
    };
    openEditor(pending);
    capture.classList.add('rv-hidden');
  });

  /* ---------------- marker clicks ---------------- */
  markerLayer.addEventListener('click', function (e) {
    var m = e.target.closest('.rv-marker');
    if (!m) return;
    e.preventDefault();
    e.stopPropagation();
    var id = Number(m.dataset.id);
    var note = state.notes.filter(function (n) { return n.id === id; })[0];
    if (note) openExisting(note);
  });

  /* ---------------- save / delete ---------------- */
  function saveNote() {
    var text = edText.value.trim();
    if (state.editing) {
      state.editing.note = text;
      persist();
    } else if (state.pending) {
      var p = state.pending;
      state.notes.push({
        id: p.id,
        selector: p.selector,
        label: p.label,
        snippet: p.snippet,
        note: text,
        x: p.pageX,
        y: p.pageY,
        ts: new Date().toISOString()
      });
      persist();
      renderMarkers();
    }
    hideEditor();
    if (state.active && state.armed) capture.classList.remove('rv-hidden');
    toast('Note saved');
  }

  function deleteNote() {
    if (state.editing) {
      state.notes = state.notes.filter(function (n) { return n.id !== state.editing.id; });
      persist();
      renderMarkers();
    }
    hideEditor();
    if (state.active && state.armed) capture.classList.remove('rv-hidden');
    toast('Note deleted');
  }

  function persist() {
    state.byPage[pageKey()] = state.notes;
    saveAll();
    updateCount();
  }

  edText.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
    if (e.key === 'Escape') {
      e.preventDefault();
      hideEditor();
      if (state.active && state.armed) capture.classList.remove('rv-hidden');
    }
  });
  editor.querySelector('[data-rv-save]').addEventListener('click', saveNote);
  editor.querySelector('[data-rv-del]').addEventListener('click', deleteNote);

  /* ---------------- export ---------------- */
  function exportMarkdown() {
    var lines = [];
    var total = 0;
    Object.keys(state.byPage).forEach(function (k) { total += (state.byPage[k] || []).length; });
    lines.push('# InputScope review');
    lines.push('');
    lines.push('_' + total + ' note' + (total === 1 ? '' : 's') + ' across ' + Object.keys(state.byPage).length + ' page(s)._');
    lines.push('');

    Object.keys(state.byPage).sort().forEach(function (page) {
      var notes = state.byPage[page] || [];
      if (!notes.length) return;
      lines.push('## ' + page);
      lines.push('');
      notes.forEach(function (n) {
        var snip = n.snippet ? ' — "' + n.snippet + '"' : '';
        lines.push(n.id + '. **' + n.label + '**' + snip);
        lines.push('   - selector: `' + n.selector + '`');
        lines.push('   - note: ' + (n.note ? n.note.replace(/\n+/g, ' ') : '_(none)_'));
        lines.push('');
      });
    });
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      resolve();
    });
  }

  banner.querySelector('[data-rv-copy]').addEventListener('click', function () {
    if (!state.notes.length && !Object.keys(state.byPage).length) { toast('No notes yet'); return; }
    copyText(exportMarkdown()).then(function () { toast('Review notes copied — paste to me'); });
  });

  banner.querySelector('[data-rv-json]').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state.byPage, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inputscope-review.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('JSON downloaded');
  });

  banner.querySelector('[data-rv-clear]').addEventListener('click', function () {
    if (!state.notes.length) return;
    if (!confirm('Clear all ' + state.notes.length + ' note(s) on this page?')) return;
    state.notes = [];
    persist();
    renderMarkers();
    toast('Page notes cleared');
  });

  banner.querySelector('[data-rv-close]').addEventListener('click', function () {
    setActive(false);
    setFlag('0');
    toggle.classList.add('rv-hidden');
  });

  /* ---------------- arm / disarm ---------------- */
  function setArmed(on) {
    state.armed = on;
    armBtn.textContent = on ? 'Capture on' : 'Capture off';
    armBtn.classList.toggle('rv-btn--primary', on);
    if (on) {
      capture.classList.remove('rv-hidden');
      document.body.classList.add('rv-armed');
    } else {
      capture.classList.add('rv-hidden');
      document.body.classList.remove('rv-armed');
    }
  }
  armBtn.addEventListener('click', function () {
    setArmed(!state.armed);
    toast(state.armed ? 'Capture on — click any element' : 'Capture off — the page works normally');
  });

  /* ---------------- mode switching ---------------- */
  function setActive(on) {
    state.active = on;
    banner.classList.toggle('rv-hidden', !on);
    toggle.classList.toggle('is-on', on);
    toggle.querySelector('span').textContent = on ? 'Reviewing' : 'Review';
    if (!on) {
      hideEditor();
      setArmed(false);
    }
    try { localStorage.setItem(MODE_KEY, on ? '1' : '0'); } catch (e) {}
    if (on) {
      renderMarkers();
      setArmed(true);
      toast('Review mode — click any element to add a note');
    }
  }

  toggle.addEventListener('click', function () {
    setActive(!state.active);
  });

  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      if (!state.active) { setActive(true); }
      else { setArmed(!state.armed); }
      return;
    }
    if (e.key === 'Escape' && state.active && editor.classList.contains('rv-hidden')) {
      setArmed(false);
      toast('Capture off — the page works normally');
    }
  });

  window.addEventListener('scroll', function () { positionMarkers(); }, { passive: true });
  window.addEventListener('resize', function () { positionMarkers(); });

  /* ---------------- boot ---------------- */
  refreshPageNotes();

  var params = new URLSearchParams(location.search);
  var wanted = params.get('review');
  var saved = getFlag();

  if (wanted === '1' || wanted === 'on') {
    toggle.classList.remove('rv-hidden');
    setFlag('1');
    setActive(true);
  } else if (wanted === '0' || wanted === 'off') {
    setFlag('0');
    toggle.classList.add('rv-hidden');
  } else if (saved === '1') {
    // the owner has used review mode before — keep the button handy
    toggle.classList.remove('rv-hidden');
  }

  window.InputScopeReview = {
    activate: function () { toggle.classList.remove('rv-hidden'); setActive(true); },
    deactivate: function () { setActive(false); },
    arm: function () { setArmed(true); },
    disarm: function () { setArmed(false); },
    exportMarkdown: exportMarkdown,
    notes: function () { return state.notes; }
  };
})();
