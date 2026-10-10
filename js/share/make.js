/* ✦ make.html — write a note, get a WeChat-ready poster with a QR code to play.html. */
(function () {
  'use strict';
  const KK = window.KK, QR = window.QR;
  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const track = name => { try { if (window.KKStats) window.KKStats.use(name); } catch (e) { /* ignore */ } };
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);

  let lang = KK.pickLang(navigator.language, store.get('kk-lang'));
  const tx = (k, v) => KK.t(lang, k, v);
  const playBase = new URL('play.html', location.href).href.replace(/[#?].*$/, '');
  const touched = { message: false, from: false };
  let themeId = 'cream', previewTimer = 0, draftTimer = 0, lastPreviewKey = '', lastFocus = null, toastTimer = 0, posterItem = null;

  // ---------------- form state ----------------
  const read = () => ({ message: $('msg').value, from: $('from').value, theme: themeId });

  function check(forceErrors) {
    const f = read();
    const v = KK.validate(f.message, f.from);
    const n = KK.visibleLength(KK.cleanText(f.message));
    const count = $('msgCount');
    count.textContent = tx('counter', { n, max: KK.LIMITS.message });
    count.classList.toggle('is-over', n > KK.LIMITS.message);

    for (const field of ['message', 'from']) {
      const err = v.errors.find(e => e.field === field);
      const input = field === 'message' ? $('msg') : $('from');
      const box = field === 'message' ? $('msgErr') : $('fromErr');
      // "too long" shows while typing; "empty" waits until the person has tried.
      const show = err && (forceErrors || touched[field] || err.key !== 'err_empty');
      box.hidden = !show;
      box.textContent = show ? tx(err.key, err.vars) : '';
      input.setAttribute('aria-invalid', show ? 'true' : 'false');
    }
    const url = v.ok ? KK.buildPlayUrl(playBase, { message: v.message, from: v.from, theme: themeId }) : null;
    $('tryFirst').href = url || playBase;
    return { v, url };
  }

  // ---------------- preview ----------------
  function previewData() {
    const f = read();
    const v = KK.validate(f.message, f.from);
    let message = KK.cleanText(f.message);
    if (!message) message = tx('field_message_ph');
    const gs = KK.graphemes(message);
    if (gs.length > KK.LIMITS.message) message = gs.slice(0, KK.LIMITS.message).join('') + '…';
    const from = KK.cleanText(f.from).replace(/\n/g, ' ');
    const url = v.ok ? KK.buildPlayUrl(playBase, { message: v.message, from: v.from, theme: themeId }) : playBase;
    return { data: { message, from: KK.graphemes(from).slice(0, KK.LIMITS.from).join(''), theme: themeId }, url };
  }
  function schedulePreview() {
    $('preview').classList.add('is-stale');
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 160);
  }
  function renderPreview() {
    const { data, url } = previewData();
    const key = JSON.stringify([data, url]);
    const c = $('preview');
    if (key !== lastPreviewKey) {
      lastPreviewKey = key;
      const { canvas } = KK.renderPoster(data, url, QR);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(canvas, 0, 0, c.width, c.height);
    }
    c.classList.remove('is-stale');
  }

  // ---------------- themes ----------------
  function buildThemes() {
    const box = $('themes');
    box.textContent = '';
    for (const id of KK.THEME_IDS) {
      const th = KK.THEMES[id];
      const label = document.createElement('label');
      label.className = 'theme-opt';
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'theme'; input.value = id; input.checked = id === themeId;
      input.addEventListener('change', () => { themeId = id; saveDraft(); check(false); schedulePreview(); });
      const span = document.createElement('span');
      const dot = document.createElement('i');
      dot.style.background = `linear-gradient(135deg, ${th.bg} 0 50%, ${th.accent} 50% 100%)`;
      span.append(dot, document.createTextNode(th.name[lang]));
      label.append(input, span);
      box.append(label);
    }
  }

  // ---------------- language ----------------
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tx(el.dataset.i18n); });
    $('lang').textContent = tx('lang_toggle');
    $('lang').setAttribute('aria-label', tx('lang_toggle_label'));
    $('resultClose').setAttribute('aria-label', tx('close'));
    $('preview').setAttribute('aria-label', tx('preview_label'));
    $('msg').placeholder = tx('field_message_ph');
    $('from').placeholder = tx('field_from_ph');
    $('resultHint').textContent = inWeChat ? tx('result_hint_wechat') : tx('result_hint_other');
    document.title = tx('make_title') + ' · KIRA·KIRA';
    buildThemes();
    check(false);
    schedulePreview(); // placeholder text in the preview follows the language
  }

  // ---------------- drafts ----------------
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => store.set('kk-draft', JSON.stringify(read())), 300);
  }
  function loadDraft() {
    try {
      const d = JSON.parse(store.get('kk-draft') || 'null');
      if (!d) return;
      if (typeof d.message === 'string') $('msg').value = d.message;
      if (typeof d.from === 'string') $('from').value = d.from;
      if (KK.THEME_IDS.includes(d.theme)) themeId = d.theme;
    } catch (e) { /* ignore a broken draft */ }
  }

  // ---------------- feedback ----------------
  function toast(msg, isError) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 4200 : 2200);
  }

  // ---------------- create ----------------
  function create(e) {
    e.preventDefault();
    touched.message = touched.from = true;
    const { v, url } = check(true);
    if (!v.ok) {
      const first = v.errors[0].field === 'from' ? $('from') : $('msg');
      first.focus();
      return;
    }
    const btn = $('create');
    if (btn.getAttribute('aria-busy') === 'true') return;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = tx('creating');
    lastFocus = btn;
    // let the busy state paint before the (blocking) canvas work
    setTimeout(() => {
      try {
        const { canvas } = KK.renderPoster({ message: v.message, from: v.from, theme: themeId }, url, QR);
        window.KKSave.prepare(canvas, 'kirakira-poster.png').then(item => {
          posterItem = item;
          const img = $('posterImg');
          img.src = item.url;
          img.alt = tx('poster_headline') + ' — ' + v.message;
          $('savePoster').textContent = window.KKSave.label(item, lang);
          $('openLink').href = url;
          $('linkField').value = url;
          openResult();
          track('poster-create');
        }).catch(() => toast(lang === 'zh' ? '生成失败，请再试一次' : 'Couldn’t create the poster. Try again.', true))
          .then(() => { btn.removeAttribute('aria-busy'); btn.textContent = tx('create'); });
      } catch (err) {
        toast(lang === 'zh' ? '生成失败，请再试一次' : 'Couldn’t create the poster. Try again.', true);
        btn.removeAttribute('aria-busy');
        btn.textContent = tx('create');
      }
    }, 30);
  }

  function openResult() {
    $('result').hidden = false;
    $('resultTitle').focus({ preventScroll: true });
  }
  function closeResult() {
    $('result').hidden = true;
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function trapFocus(e, box) {
    const f = Array.from(box.querySelectorAll('a[href], button, input, [tabindex="-1"]')).filter(el => !el.hidden && !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  async function copyLink() {
    const url = $('linkField').value;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      toast(tx('copied'));
    } catch (e) {
      const f = $('linkField');
      f.focus(); f.select(); f.setSelectionRange(0, url.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      toast(ok ? tx('copied') : tx('copy_failed'), !ok);
    }
  }

  // ---------------- wire up ----------------
  function init() {
    loadDraft();
    $('localBanner').hidden = !KK.isLocalHost(location);
    applyLang();
    renderPreview();

    $('msg').addEventListener('input', () => { saveDraft(); check(false); schedulePreview(); });
    $('from').addEventListener('input', () => { saveDraft(); check(false); schedulePreview(); });
    $('msg').addEventListener('blur', () => { if ($('msg').value) touched.message = true; check(false); });
    $('from').addEventListener('blur', () => { touched.from = true; check(false); });
    $('from').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('from').blur(); } });
    $('form').addEventListener('submit', create);
    $('tryFirst').addEventListener('click', e => {
      const { v } = check(true);
      if (!v.ok) { e.preventDefault(); touched.message = true; check(true); $('msg').focus(); }
    });
    $('lang').addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      store.set('kk-lang', lang);
      applyLang();
      track('lang-' + lang);
    });
    $('copy').addEventListener('click', copyLink);
    $('savePoster').addEventListener('click', () => {
      if (!posterItem) return;
      window.KKSave.save(posterItem, lang).then(r => {
        if (r === 'shared') toast(window.KKSave.t(lang, 'saved'));
        track('poster-save-' + r);
      });
    });
    $('resultClose').addEventListener('click', closeResult);
    $('result').addEventListener('click', e => { if (e.target === e.currentTarget) closeResult(); });
    $('linkField').addEventListener('focus', e => e.target.select());
    document.addEventListener('keydown', e => {
      if ($('result').hidden) return;
      if (e.key === 'Escape') closeResult();
      if (e.key === 'Tab') trapFocus(e, $('result'));
    });
  }

  window.__kkMake = { check, read, playBase };
  init();
})();
