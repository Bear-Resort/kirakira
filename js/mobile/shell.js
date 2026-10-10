/* ✦ Phone shell for the KIRA·KIRA effects.
   The 13 effects are unchanged desktop modules; this file gives them a phone layout:
   home → editor (one effect at a time) → save. It also translates every label as the
   effects build their settings, keeps only the first few settings in view ("更多设置"
   holds the rest), turns two-finger pinches into the scroll-wheel the effects expect,
   and saves in a way that works inside WeChat, iOS and Android. */
(function () {
  'use strict';
  const App = window.App, ZH = window.KK_ZH;
  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const track = name => { try { if (window.KKStats) window.KKStats.use(name); } catch (e) { /* ignore */ } };
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PHONE_MAX_SIDE = 1280;     // phones get smaller working pictures so every effect stays smooth
  const MAIN_CONTROLS = 3;         // settings shown before "更多设置"

  let lang = store.get('kk-lang') || (/^zh\b/i.test(navigator.language || '') ? 'zh' : 'en');
  if (lang !== 'zh' && lang !== 'en') lang = 'en';
  const missing = new Set();
  window.__kkMissing = missing;

  // ---------------- strings ----------------
  const M = {
    zh: {
      home_title: '把照片变好玩', home_sub: '13 种玩法 · 照片只在你手机里，不会上传', pick_photo: '选一张照片',
      try_demo: '先用示例图玩玩', all_effects: '所有玩法', note_link: '✦ 雾里的悄悄话：做一张能擦开的海报',
      desktop_link: '电脑版', need_b: '这个玩法要两张照片，现在用的是自动生成的第二张', pick_b: '选第二张',
      adjust: '调整', save: '保存', change_photo: '换照片', more: '更多设置', filters: '滤镜（所有玩法都适用）',
      done: '好了', got_it: '知道了', saved_title: '做好了 ✦', save_to_photos: '保存到相册', download: '下载图片',
      make_note: '做成悄悄话海报', adjust_title: '调整 · {name}', back: '返回', help: '怎么玩', close: '关闭',
      save_hint_wechat: '长按图片，选「保存图片」', save_hint_share: '点「保存到相册」，在菜单里选「存储图像」',
      save_hint_other: '点「下载图片」，也可以长按或右键图片保存', photo_ready: '照片换好了 ✦', photo_b_ready: '第二张照片好了 ✦',
      saved: '已保存 ✦', share_failed: '没能打开分享，长按图片保存吧', preparing: '正在准备图片…',
      lang_toggle: 'EN', lang_label: 'Switch to English', strip_label: '玩法', editor_label: '编辑',
      not_image: '这不是图片，换一张 JPG 或 PNG 试试', read_fail: '读不了这张照片，换一张试试',
      no_settings: '这个玩法不用调，直接玩就好 ✦',
    },
    en: {
      home_title: 'Make your photos fun', home_sub: '13 effects · your photos stay on your phone', pick_photo: 'Pick a photo',
      try_demo: 'Try the demo picture', all_effects: 'All effects', note_link: '✦ A note in the fog: make a poster friends wipe open',
      desktop_link: 'Desktop version', need_b: 'This effect uses two photos — an automatic second one is in for now', pick_b: 'Pick a 2nd',
      adjust: 'Adjust', save: 'Save', change_photo: 'Photo', more: 'More settings', filters: 'Filters (for every effect)',
      done: 'Done', got_it: 'Got it', saved_title: 'All done ✦', save_to_photos: 'Save to Photos', download: 'Download',
      make_note: 'Make a fog-note poster', adjust_title: 'Adjust · {name}', back: 'Back', help: 'How to play', close: 'Close',
      save_hint_wechat: 'Long-press the picture, then choose “Save Image”', save_hint_share: 'Tap “Save to Photos”, then choose “Save Image”',
      save_hint_other: 'Tap “Download”, or long-press / right-click the picture', photo_ready: 'Photo ready ✦', photo_b_ready: 'Second photo ready ✦',
      saved: 'Saved ✦', share_failed: 'Couldn’t open sharing — long-press the picture to save it', preparing: 'Getting your picture ready…',
      lang_toggle: '中', lang_label: '切换到中文', strip_label: 'Effects', editor_label: 'Editor',
      not_image: 'That isn’t a picture — try a JPG or PNG', read_fail: 'Couldn’t read that photo — try another one',
      no_settings: 'Nothing to adjust here — just play ✦',
    },
  };
  const m = (k, v) => {
    let s = (M[lang] && M[lang][k]) || M.en[k] || k;
    if (v) s = s.replace(/\{(\w+)\}/g, (x, n) => (n in v ? v[n] : x));
    return s;
  };
  const curId = () => (App.current && App.current.id) || '';
  function tr(s) {
    if (lang !== 'zh' || typeof s !== 'string' || !s) return s;
    const by = ZH.byTool && ZH.byTool[curId()];
    if (by && by[s] != null) return by[s];
    if (ZH.t[s] != null) return ZH.t[s];
    if (/[A-Za-z]{2}/.test(s) && !/^#[0-9a-f]{3,8}$/i.test(s) && !/^[\d.\s×x-]+\s*(px|mm|cm|%)?$/i.test(s)) missing.add(s);
    return s;
  }
  const toolName = t => (lang === 'zh' && ZH.tools[t.id] ? ZH.tools[t.id].name : (t.short || t.name));
  const toolHowto = t => (ZH.tools[t.id] ? (lang === 'zh' ? ZH.tools[t.id].howto : ZH.tools[t.id].howtoEn) : t.hint);

  // ---------------- translate the effects' settings as they are built ----------------
  const U = App.ui, orig = Object.assign({}, U);
  const opts = list => list.map(([v, t]) => [v, tr(t)]);
  U.slider = (p, label, o, fn) => orig.slider(p, tr(label), o && o.format ? Object.assign({}, o, { format: v => tr(String(o.format(v))) }) : o, fn);
  U.select = (p, label, list, value, fn) => orig.select(p, tr(label), opts(list), value, fn);
  U.seg = (p, label, list, value, fn) => orig.seg(p, label && tr(label), opts(list), value, fn);
  U.toggle = (p, label, value, fn) => orig.toggle(p, tr(label), value, fn);
  U.color = (p, label, value, fn) => orig.color(p, tr(label), value, fn);
  U.text = (p, label, value, fn) => orig.text(p, tr(label), value, fn);
  U.buttons = (p, list) => orig.buttons(p, list.map(([t, fn]) => [tr(t), fn]));
  U.note = (p, html) => orig.note(p, tr(html));
  U.heading = (p, text) => orig.heading(p, tr(text));
  const origToast = App.toast, origBusy = App.busy;
  App.toast = (msg, ms) => origToast(tr(msg), ms);
  App.busy = msg => origBusy(msg && tr(msg));

  // Phones: decode, shrink and then hand the picture to the engine; a new own photo drops the demo's 2nd picture.
  App.loadFile = function (file, which) {
    if (!file) return;
    if (file.type && !/^image\//.test(file.type)) { App.toast(m('not_image')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    App.busy('…');
    img.onload = () => {
      URL.revokeObjectURL(url);
      const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.min(1, PHONE_MAX_SIDE / Math.max(iw, ih));
      const c = App.makeCanvas(iw * s, ih * s), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, c.width, c.height);
      if (which === 'A') { App.rawB = null; App.B = null; }
      App.busy(null);
      App.setPicture(which, c);
      if (which === 'A') { store.set('kk-own', '1'); openEditor(lastToolId()); }
      origToast(m(which === 'A' ? 'photo_ready' : 'photo_b_ready'), 1800);
      updateNeedB();
      track(which === 'A' ? 'm-photo' : 'm-photo-b');
    };
    img.onerror = () => { URL.revokeObjectURL(url); App.busy(null); App.toast(m('read_fail')); };
    img.src = url;
  };

  // ---------------- settings sheet layout ----------------
  /** Keep the first few settings in view; buttons become quick actions; the rest go under "更多设置". */
  function arrangeControls() {
    const box = $('toolControls'), quick = $('quick'), more = $('moreControls');
    // Arrange each build once: the marker vanishes when the engine rebuilds the box.
    if (box.querySelector(':scope > [data-arranged]')) return;
    quick.textContent = ''; more.textContent = '';
    const kids = Array.from(box.children);
    let shown = 0, pendingHeading = null;
    for (const el of kids) {
      if (el.classList.contains('btn-row')) { quick.append(el); continue; }
      if (el.classList.contains('note')) { more.append(el); continue; }
      if (el.classList.contains('ctrl-heading')) { pendingHeading = el; continue; }
      const toMain = shown < MAIN_CONTROLS;
      const dest = toMain ? box : more;
      if (pendingHeading) { dest.append(pendingHeading); pendingHeading = null; }
      dest.append(el);
      if (toMain) shown++;
    }
    if (pendingHeading) more.append(pendingHeading);
    $('moreControls').hidden = !more.children.length;
    if (!box.children.length && !quick.children.length) {
      const p = document.createElement('p'); p.className = 'empty-note'; p.textContent = m('no_settings'); box.append(p);
    }
    const mark = document.createElement('i'); mark.hidden = true; mark.dataset.arranged = '1'; box.append(mark);
  }

  // ---------------- tools ----------------
  const tabFor = id => document.querySelector(`#tabs .tab[data-id="${id}"]`);
  const lastToolId = () => {
    const saved = store.get('kirakira-tool');
    return App.tools.some(t => t.id === saved) ? saved : App.tools[0].id;
  };

  function selectTool(id) {
    const tab = tabFor(id);
    if (!tab) return;
    if (!App.current || App.current.id !== id) {
      $('quick').textContent = ''; $('moreControls').textContent = '';
      tab.click();
    }
    afterSelect();
  }
  function rebuildControls() { // same tool, new language
    $('toolControls').textContent = ''; $('quick').textContent = ''; $('moreControls').textContent = '';
    App.current.build($('toolControls'));
    afterSelect();
  }
  function afterSelect() {
    const t = App.current;
    arrangeControls();
    $('edIcon').textContent = t.icon;
    $('edName').textContent = toolName(t);
    $('adjustTitle').textContent = m('adjust_title', { name: toolName(t) });
    $('helpTitle').textContent = t.icon + ' ' + toolName(t);
    $('helpHowto').textContent = toolHowto(t);
    $('toolHint').textContent = lang === 'zh' ? '' : t.hint;
    $('toolHint').hidden = lang === 'zh';
    showCoach();
    updateNeedB();
    document.querySelectorAll('.chip-tool').forEach(c => {
      const on = c.dataset.id === t.id;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function updateNeedB() {
    $('needB').hidden = !(App.current && App.current.wantsB && !App.rawB);
  }

  let coachTimer = 0;
  function showCoach() {
    const c = $('coach');
    c.textContent = '☝ ' + toolHowto(App.current);
    c.classList.add('on');
    clearTimeout(coachTimer);
    coachTimer = setTimeout(hideCoach, 6000);
  }
  function hideCoach() { $('coach').classList.remove('on'); }

  // ---------------- screens ----------------
  function buildTiles() {
    const tiles = $('tiles'), strip = $('strip');
    tiles.textContent = ''; strip.textContent = '';
    for (const group of ['play', 'merch']) {
      const label = lang === 'zh' ? ZH.groups[group] : (group === 'play' ? 'Photo play' : 'OC merch');
      const h = document.createElement('p'); h.className = 'tile-group'; h.textContent = label;
      tiles.append(h);
      const sh = document.createElement('span'); sh.className = 'strip-group'; sh.textContent = label;
      strip.append(sh);
      for (const t of App.tools.filter(x => (x.group || 'play') === group)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'tile'; b.dataset.id = t.id;
        b.innerHTML = '<span class="tile-icon" aria-hidden="true"></span><span class="tile-name"></span>';
        b.querySelector('.tile-icon').textContent = t.icon;
        b.querySelector('.tile-name').textContent = toolName(t);
        b.addEventListener('click', () => { openEditor(t.id); track('m-tile-' + t.id); });
        tiles.append(b);

        const c = document.createElement('button');
        c.type = 'button'; c.className = 'chip-tool'; c.dataset.id = t.id;
        c.innerHTML = '<span class="chip-icon" aria-hidden="true"></span><span class="chip-name"></span>';
        c.querySelector('.chip-icon').textContent = t.icon;
        c.querySelector('.chip-name').textContent = toolName(t);
        c.addEventListener('click', () => { selectTool(t.id); track('m-tool-' + t.id); });
        strip.append(c);
      }
    }
    const dr = document.createElement('a');
    dr.className = 'tile tile-link'; dr.href = 'darkroom/index.html';
    dr.innerHTML = '<span class="tile-icon" aria-hidden="true">◐</span><span class="tile-name"></span>';
    dr.querySelector('.tile-name').textContent = lang === 'zh' ? '暗房（4 种）' : 'Darkroom (4)';
    tiles.append(dr);
  }

  function openEditor(id) {
    $('home').hidden = true;
    $('editor').hidden = false;
    selectTool(id || lastToolId());
    if (history.state !== 'editor') history.pushState('editor', '', '#edit');
    document.body.classList.add('in-editor');
  }
  function showHome() {
    $('editor').hidden = true;
    $('home').hidden = false;
    document.body.classList.remove('in-editor');
    closeSheets();
  }
  window.addEventListener('popstate', () => {
    if (anyOpen()) { closeSheets(); history.pushState('editor', '', '#edit'); return; }
    if (!$('editor').hidden) showHome();
  });

  // ---------------- sheets & dialogs ----------------
  let lastFocus = null;
  const SHEETS = ['adjustBox', 'helpBox', 'saveBox'];
  const anyOpen = () => SHEETS.some(id => !$(id).hidden);
  function openSheet(id, focusId) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
    const f = $(focusId);
    if (f) f.focus({ preventScroll: true });
  }
  function closeSheets() {
    let was = false;
    SHEETS.forEach(id => { if (!$(id).hidden) { $(id).hidden = true; was = true; } });
    if (was && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function trapFocus(e) {
    const box = SHEETS.map($).find(b => !b.hidden);
    if (!box) return;
    const f = Array.from(box.querySelectorAll('a[href], button, input, select, summary, [tabindex="-1"]'))
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------------- save ----------------
  let saveFile = null;
  function openSave() {
    if (!App.A) { App.toast('Add a picture first ✦'); return; }
    const src = (App.current.exportCanvas && App.current.exportCanvas()) || App.canvas;
    App.busy(m('preparing'));
    // let the spinner paint before the (blocking) encode
    setTimeout(() => {
      let url;
      try { url = src.toDataURL('image/png'); } catch (e) { App.busy(null); App.toast(m('read_fail')); return; }
      const name = `kirakira-${App.current.id}.png`;
      fetch(url).then(r => r.blob()).then(blob => {
        saveFile = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
        const canShare = !inWeChat && saveFile && navigator.canShare && navigator.canShare({ files: [saveFile] });
        $('saveImg').src = url;
        $('saveImg').alt = toolName(App.current);
        $('shareFile').hidden = !canShare;
        const dl = $('downloadFile');
        dl.hidden = inWeChat || canShare;
        dl.href = url; dl.download = name;
        $('saveHint').textContent = m(inWeChat ? 'save_hint_wechat' : canShare ? 'save_hint_share' : 'save_hint_other');
        App.busy(null);
        openSheet('saveBox', 'saveTitle');
        track('m-save-' + App.current.id);
      }).catch(() => { App.busy(null); App.toast(m('read_fail')); });
    }, 30);
  }
  async function shareFile() {
    if (!saveFile) return;
    try {
      await navigator.share({ files: [saveFile], title: 'KIRA·KIRA' });
      origToast(m('saved'), 1800);
    } catch (e) {
      if (e && e.name === 'AbortError') return; // the person closed the share sheet
      origToast(m('share_failed'), 3200);
      $('downloadFile').hidden = false;
    }
  }

  // ---------------- touch: pinch → wheel, double-tap → dblclick ----------------
  function bindGestures() {
    const stage = $('stage'), canvas = $('canvas');
    const pts = new Map();
    let pinch = null, lastTap = null;
    const dist = () => { const [a, b] = Array.from(pts.values()); return Math.hypot(a.x - b.x, a.y - b.y); };
    const mid = () => { const [a, b] = Array.from(pts.values()); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    stage.addEventListener('pointerdown', e => {
      hideCoach();
      if (e.target !== canvas) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        // second finger: end the one-finger drag and turn this into a pinch
        const [firstId] = pts.keys();
        const p = pts.get(firstId);
        canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: firstId, clientX: p.x, clientY: p.y, bubbles: true }));
        pinch = { d: dist() };
        e.stopImmediatePropagation();
      } else if (pts.size > 2 || pinch) e.stopImmediatePropagation();
    }, true);
    stage.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.get(e.pointerId).x = e.clientX; pts.get(e.pointerId).y = e.clientY;
      if (!pinch) return;
      e.stopImmediatePropagation();
      if (pts.size < 2 || !App.current || !App.current.wheel) return;
      const d = dist(), c = mid();
      const delta = (pinch.d - d) * 2.2; // spread fingers = zoom in = wheel up
      if (Math.abs(delta) > 1) {
        canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: delta, clientX: c.x, clientY: c.y, bubbles: true, cancelable: true }));
        pinch.d = d;
      }
    }, true);
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      const wasPinch = !!pinch;
      pts.delete(e.pointerId);
      if (wasPinch) { e.stopImmediatePropagation(); if (!pts.size) pinch = null; return; }
      if (e.type === 'pointerup') { // double-tap → dblclick (badge: see the back)
        const now = performance.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
          canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: e.clientX, clientY: e.clientY, bubbles: true }));
          lastTap = null;
        } else lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    };
    stage.addEventListener('pointerup', end, true);
    stage.addEventListener('pointercancel', e => { if (e.isTrusted) end(e); }, true);
    // the browser's own dblclick on touch would double-fire with ours
    canvas.addEventListener('dblclick', e => { if (e.isTrusted && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) e.stopImmediatePropagation(); }, true);
    stage.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  }

  // ---------------- language ----------------
  function applyStatic() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-m]').forEach(el => { el.textContent = m(el.dataset.m); });
    $('lang').textContent = m('lang_toggle');
    $('lang').setAttribute('aria-label', m('lang_label'));
    $('backHome').setAttribute('aria-label', m('back'));
    $('helpBtn').setAttribute('aria-label', m('help'));
    $('saveClose').setAttribute('aria-label', m('close'));
    $('strip').setAttribute('aria-label', m('strip_label'));
    document.title = 'KIRA·KIRA · ' + m('home_title');
  }
  function translateFilters() {
    document.querySelectorAll('#presets .chip, #filterSliders .ctrl-label > span:first-child').forEach(el => {
      if (!el.dataset.en) el.dataset.en = el.textContent;
      el.textContent = lang === 'zh' ? (ZH.t[el.dataset.en] || el.dataset.en) : el.dataset.en;
    });
  }
  function setLang(l) {
    lang = l; store.set('kk-lang', l);
    applyStatic(); buildTiles(); translateFilters();
    if (App.current) rebuildControls();
    track('lang-' + l);
  }

  // ---------------- start ----------------
  function init() {
    const ui0 = lang; lang = 'en'; // the engine's filter UI is built in English first, then translated
    App.start();
    lang = ui0;
    applyStatic();
    buildTiles();
    translateFilters();
    rebuildControls(); // the first effect was built during start-up in English
    bindGestures();

    $('lang').addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh'));
    $('pickA').addEventListener('click', () => $('fileA').click());
    $('changePhoto').addEventListener('click', () => $('fileA').click());
    $('pickB').addEventListener('click', () => $('fileB').click());
    $('tryDemo').addEventListener('click', () => {
      $('demoBtn').click();
      openEditor(lastToolId());
    });
    $('backHome').addEventListener('click', () => { if (history.state === 'editor') history.back(); else showHome(); });
    $('adjustBtn').addEventListener('click', () => { openSheet('adjustBox', 'adjustTitle'); track('m-adjust'); });
    $('adjustDone').addEventListener('click', closeSheets);
    $('helpBtn').addEventListener('click', () => openSheet('helpBox', 'helpTitle'));
    $('helpDone').addEventListener('click', closeSheets);
    $('saveBtn').addEventListener('click', openSave);
    $('saveClose').addEventListener('click', closeSheets);
    $('shareFile').addEventListener('click', shareFile);
    SHEETS.forEach(id => $(id).addEventListener('click', e => { if (e.target === e.currentTarget) closeSheets(); }));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && anyOpen()) closeSheets();
      if (e.key === 'Tab' && anyOpen()) trapFocus(e);
    });
    // after a picture changes, the engine re-runs the effect; keep the "2nd photo" hint current
    $('fileB').addEventListener('change', () => setTimeout(updateNeedB, 0));

    if (location.hash === '#edit') history.replaceState(null, '', location.pathname + location.search);
  }

  window.__kkShell = { selectTool, openEditor, showHome, arrangeControls, missing, setLang, openSave };
  init();
})();
