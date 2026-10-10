/* ✦ play.html — wipe the fog off a note someone left you. */
(function () {
  'use strict';
  const KK = window.KK;
  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const track = name => { try { if (window.KKStats) window.KKStats.use(name); } catch (e) { /* never break play */ } };
  const mq = q => !!(window.matchMedia && window.matchMedia(q).matches);
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const coarse = mq('(pointer: coarse)');
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);

  const BRUSH = 70;               // finger radius, in card units (card is 1000 wide)
  const REACH = BRUSH * 0.8;      // how close a cell centre must be to count as wiped
  const IDLE_HINT_MS = 4000;

  let lang = KK.pickLang(navigator.language, store.get('kk-lang'));
  const data = KK.parsePlayParams(location.hash, location.search);
  const S = {
    started: false, done: false, skipped: false, t0: 0, elapsed: 0, bucket: 0,
    pointers: new Map(), drips: [], raf: 0, idleTimer: 0, hintTimer: 0,
  };
  let scale = 1, fctx = null, fogPristine = null, brush = null, cov = null, textRect = null;

  const tx = (k, v) => KK.t(lang, k, v);
  const noteText = () => data.message || tx('demo_message');

  // ---------------- language ----------------
  function titleText() {
    if (data.demo) return tx('play_title_demo');
    return data.from ? tx('play_title_from', { from: data.from }) : tx('play_title_anon');
  }
  function applyLang() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tx(el.dataset.i18n); });
    const btn = $('lang');
    btn.textContent = tx('lang_toggle');
    btn.setAttribute('aria-label', tx('lang_toggle_label'));
    $('saveClose').setAttribute('aria-label', tx('close'));
    $('title').textContent = titleText();
    document.title = titleText() + ' · KIRA·KIRA';
    $('saveHint').textContent = inWeChat ? tx('save_hint_wechat') : tx('save_hint_other');
    if (cov) updateMeter(true);
    if (S.done) fillSheet();
    setStageLabel();
  }
  function setStageLabel() {
    const label = S.done
      ? noteText() + (data.from ? ' ' + tx('card_from', { from: data.from }) : '')
      : tx('play_title_anon') + ' — ' + tx('play_hint');
    $('stage').setAttribute('aria-label', label);
  }

  // ---------------- setup ----------------
  function init() {
    applyLang();
    $('lang').addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      store.set('kk-lang', lang);
      applyLang();
      if (cov) drawCard(); // the card label follows the language; the fog layer is kept as-is
      track('lang-' + lang);
    });

    if (!data.ok) {
      $('main').hidden = true;
      $('bad').hidden = false;
      track('play-bad-link');
      return;
    }

    const stage = $('stage');
    const cssW = stage.getBoundingClientRect().width || 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(560, Math.min(1000, Math.round(cssW * dpr)));
    scale = px / KK.CARD.w;

    const card = drawCard();
    const fog = $('fog');
    fog.width = card.width; fog.height = card.height;
    fctx = fog.getContext('2d');
    fogPristine = KK.renderFog(card, data);
    fctx.drawImage(fogPristine, 0, 0);
    const fx = $('fx'); fx.width = card.width; fx.height = card.height;
    brush = KK.makeBrush(BRUSH * scale);
    cov = new KK.Coverage(KK.CARD.w, KK.CARD.h, 50);

    bindPointer(fog);
    stage.addEventListener('touchmove', e => e.preventDefault(), { passive: false }); // no page bounce while wiping
    fog.addEventListener('contextmenu', e => e.preventDefault());

    $('justShow').addEventListener('click', () => finish(true));
    $('again').addEventListener('click', playAgain);
    $('save').addEventListener('click', openSave);
    $('saveClose').addEventListener('click', closeSave);
    $('saveBox').addEventListener('click', e => { if (e.target === e.currentTarget) closeSave(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('saveBox').hidden) closeSave();
      if (e.key === 'Tab' && !$('saveBox').hidden) trapFocus(e, $('saveBox'));
    });

    updateMeter(true);
    showHintSoon(700);
  }

  function drawCard() {
    const card = KK.renderCard(Object.assign({}, data, { lang }), scale);
    const el = $('card');
    el.width = card.width; el.height = card.height;
    el.getContext('2d').drawImage(card, 0, 0);
    textRect = card.textRect || null;
    return card;
  }

  // ---------------- wiping ----------------
  function toCard(ev) {
    const r = $('fog').getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * KK.CARD.w, y: (ev.clientY - r.top) / r.height * KK.CARD.h };
  }
  function segment(a, b) {
    KK.wipeStroke(fctx, brush, a.x * scale, a.y * scale, b.x * scale, b.y * scale);
    cov.mark(a.x, a.y, b.x, b.y, REACH);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (!reduceMotion && S.drips.length < 40 && Math.random() < Math.min(0.5, dist / (BRUSH * 6))) {
      S.drips.push({ x: b.x + (Math.random() - 0.5) * BRUSH, y: b.y + BRUSH * 0.6, r: 3 + Math.random() * 3, v: 1 + Math.random() * 2.2, left: 60 + Math.random() * 240 });
    }
  }
  function down(id, ev) {
    if (S.done) return;
    if (!S.started) { S.started = true; S.t0 = performance.now(); track('play-start'); }
    hideHint();
    const p = toCard(ev);
    S.pointers.set(id, p);
    segment(p, p);
    $('fog').classList.add('is-wiping');
    schedule();
  }
  function move(id, evs) {
    if (S.done || !S.pointers.has(id)) return;
    for (const ev of evs) {
      const p = toCard(ev);
      segment(S.pointers.get(id), p);
      S.pointers.set(id, p);
    }
    schedule();
  }
  function up(id) {
    S.pointers.delete(id);
    if (!S.pointers.size) $('fog').classList.remove('is-wiping');
    idleHint();
  }

  function bindPointer(el) {
    if (window.PointerEvent) {
      el.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* old WebViews */ }
        down(e.pointerId, e);
      });
      el.addEventListener('pointermove', e => {
        const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
        move(e.pointerId, list && list.length ? list : [e]);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, e => up(e.pointerId)));
      return;
    }
    // Fallback for very old in-app browsers without Pointer Events.
    el.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) down('t' + t.identifier, t); }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) move('t' + t.identifier, [t]); }, { passive: false });
    ['touchend', 'touchcancel'].forEach(n => el.addEventListener(n, e => { for (const t of e.changedTouches) up('t' + t.identifier); }));
    el.addEventListener('mousedown', e => { if (e.button === 0) down('m', e); });
    window.addEventListener('mousemove', e => move('m', [e]));
    window.addEventListener('mouseup', () => up('m'));
  }

  function schedule() { if (!S.raf) S.raf = requestAnimationFrame(frame); }
  function frame() {
    S.raf = 0;
    if (S.drips.length && !S.done) {
      fctx.save(); fctx.globalCompositeOperation = 'destination-out'; fctx.fillStyle = '#000';
      S.drips = S.drips.filter(d => {
        const dy = d.v * (0.4 + Math.random());
        fctx.beginPath(); fctx.arc(d.x * scale, d.y * scale, d.r * scale, 0, 6.283); fctx.fill();
        d.y += dy; d.left -= dy; d.x += (Math.random() - 0.5) * 0.6;
        return d.left > 0 && d.y < KK.CARD.h + 10;
      });
      fctx.restore();
      schedule();
    }
    updateMeter(false);
  }

  /** Progress toward the reveal, 0–100. */
  const progress = () => KK.revealProgress(cov, textRect);

  function updateMeter(force) {
    const p = S.done ? 100 : progress();
    $('meterFill').style.width = p + '%';
    $('meterLabel').textContent = tx('progress', { p });
    let hint = coarse ? tx('play_hint') : tx('play_hint_mouse');
    if (S.done) hint = '';
    else if (p >= 70) hint = tx('progress_close');
    else if (p > 0) hint = tx('progress_more');
    $('hint').textContent = hint;
    const bucket = Math.floor(p / 25);
    if (bucket !== S.bucket || force) {
      if (bucket > S.bucket && p < 100 && navigator.vibrate && !reduceMotion) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } }
      S.bucket = bucket;
      if (p > 0 && p < 100 && !force) $('meterLive').textContent = tx('progress', { p: bucket * 25 });
    }
    if (p >= 100 && !S.done) finish(false);
  }

  // ---------------- hint ----------------
  function showHintSoon(ms) {
    clearTimeout(S.hintTimer);
    S.hintTimer = setTimeout(() => { if (!S.done && !S.pointers.size) $('finger').classList.add('is-on'); }, ms);
  }
  function idleHint() { clearTimeout(S.idleTimer); if (!S.done) S.idleTimer = setTimeout(() => showHintSoon(0), IDLE_HINT_MS); }
  function hideHint() { clearTimeout(S.hintTimer); clearTimeout(S.idleTimer); $('finger').classList.remove('is-on'); }

  // ---------------- reveal ----------------
  function finish(skipped) {
    if (S.done) return;
    S.done = true; S.skipped = skipped;
    S.elapsed = S.started ? (performance.now() - S.t0) / 1000 : 0;
    S.pointers.clear(); S.drips = [];
    hideHint();
    $('fog').classList.add('is-gone');
    $('fog').classList.remove('is-wiping');
    $('justShow').hidden = true;
    document.body.classList.add('is-done');
    updateMeter(true);
    $('meterLive').textContent = noteText();
    setStageLabel();
    if (!reduceMotion) sparkle();
    track(skipped ? 'play-skip' : 'play-reveal');
    setTimeout(showSheet, reduceMotion ? 0 : 650);
  }
  function fillSheet() {
    const time = $('doneTime');
    time.hidden = S.skipped || !S.elapsed;
    time.textContent = tx('done_time', { s: Math.max(0.1, S.elapsed).toFixed(1) });
    const c = $('doneCount');
    if (c.dataset.n) c.textContent = tx('done_count', { n: Number(c.dataset.n).toLocaleString() });
  }
  function showSheet() {
    if (!S.done) return;
    fillSheet();
    $('done').hidden = false;
    $('doneTitle').focus({ preventScroll: true });
    if (window.KKStats && window.KKStats.count) {
      window.KKStats.count('use-play-reveal').then(n => {
        if (!n || !S.done) return;
        const c = $('doneCount'); c.dataset.n = n; c.hidden = false; fillSheet();
      }).catch(() => {});
    }
  }
  function playAgain() {
    S.done = false; S.started = false; S.skipped = false; S.elapsed = 0; S.bucket = 0;
    cov.reset();
    const fog = $('fog');
    fctx.save(); fctx.globalCompositeOperation = 'copy'; fctx.drawImage(fogPristine, 0, 0); fctx.restore();
    fog.classList.remove('is-gone');
    $('fx').getContext('2d').clearRect(0, 0, $('fx').width, $('fx').height);
    $('done').hidden = true;
    $('justShow').hidden = false;
    document.body.classList.remove('is-done');
    $('meterLive').textContent = '';
    updateMeter(true);
    setStageLabel();
    $('title').focus({ preventScroll: true });
    showHintSoon(500);
    track('play-again');
  }

  function sparkle() {
    const c = $('fx'), x = c.getContext('2d'), th = KK.theme(data.theme);
    const colors = [th.accent, th.accent2, '#ffd35c', '#ffffff'];
    const W = c.width, H = c.height, k = W / KK.CARD.w;
    const parts = Array.from({ length: 46 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, sp = (6 + Math.random() * 12) * k;
      return { x: W / 2, y: H * 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6 * k, r: (10 + Math.random() * 16) * k, c: colors[i % colors.length], rot: Math.random() * 6 };
    });
    const t0 = performance.now();
    (function tick(now) {
      const tt = (now - t0) / 1000;
      x.clearRect(0, 0, W, H);
      if (tt > 1.1 || !S.done) return;
      x.globalAlpha = Math.max(0, 1 - tt / 1.1);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.45 * k; p.vx *= 0.98; p.rot += 0.1;
        x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = p.c;
        x.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? p.r * 0.3 : p.r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        x.closePath(); x.fill(); x.restore();
      }
      x.globalAlpha = 1;
      requestAnimationFrame(tick);
    })(t0);
  }

  // ---------------- save ----------------
  let lastFocus = null;
  function openSave() {
    lastFocus = document.activeElement;
    const url = KK.renderCard(Object.assign({}, data, { lang }), 1).toDataURL('image/png');
    const img = $('saveImg');
    img.src = url;
    img.alt = noteText();
    const dl = $('saveDownload');
    dl.href = url;
    dl.parentElement.hidden = inWeChat; // WeChat's browser ignores downloads; long-press works instead
    $('saveBox').hidden = false;
    $('saveTitle').focus({ preventScroll: true });
    track('play-save');
  }
  function closeSave() {
    $('saveBox').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function trapFocus(e, box) {
    const f = Array.from(box.querySelectorAll('a[href], button, [tabindex="-1"]')).filter(el => !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // test hook (harmless in production): lets automated tests read state
  window.__kkPlay = { state: S, progress: () => (cov ? progress() : 0), data, flush: () => { if (cov) frame(); } };

  init();
})();
