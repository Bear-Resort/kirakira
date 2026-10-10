/* Visitor + usage counter, powered by GoatCounter (https://www.goatcounter.com).
   No cookies, no personal data; the #fragment (where notes travel) is never sent.
   Set GC_CODE to your GoatCounter site code (the "xxx" in xxx.goatcounter.com).
   Left empty, nothing is loaded and every call below is a harmless no-op.

   Counted:
     - page views (visits)                                   -> automatic
     - "uses": elements with data-track="name", uploads, PNG/HTML/SVG saves -> events
   Shown: a small "✦ N visits" badge on the atelier pages, if "Allow adding visitor
   counts on your website" is turned on in GoatCounter's settings.

   API for other scripts: KKStats.use(name), KKStats.count(path) -> Promise<number|null> */
(function () {
  'use strict';
  const GC_CODE = 'kirakira';

  const noop = { use() {}, count() { return Promise.resolve(null); } };
  window.KKStats = noop;
  if (!GC_CODE) return;

  const base = `https://${GC_CODE}.goatcounter.com`;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `${base}/count`;
  document.head.append(s);

  const queued = [];
  function use(name) {
    if (!name) return;
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: `use-${name}`, title: `Use: ${name}`, event: true });
      } else if (queued.length < 20) queued.push(name); // script still loading
    } catch (e) { /* counting must never break the site */ }
  }
  s.addEventListener('load', () => { queued.splice(0).forEach(use); });

  function count(path) {
    const p = path === 'TOTAL' ? 'TOTAL' : encodeURIComponent(path);
    return fetch(`${base}/counter/${p}.json`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d && d.count ? Number(String(d.count).replace(/[^\d]/g, '')) || null : null))
      .catch(() => null);
  }
  window.KKStats = { use, count };

  // Count uses without touching the tools themselves.
  const IDS = { exportBtn: 'save-png', exportHtml: 'save-html', exportSvg: 'save-svg', download: 'darkroom-save' };
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-track], #exportBtn, #exportHtml, #exportSvg, #download');
    if (t) use(t.dataset.track || IDS[t.id]);
  }, true);
  document.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'file' && e.target.files && e.target.files.length) use('upload');
  }, true);
  document.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) use('upload');
  }, true);

  // Public visit badge — only on the atelier tools, not on the note pages.
  if (document.body.classList.contains('play') || document.body.classList.contains('make')) return;
  count('TOTAL').then(n => {
    if (!n) return;
    const badge = document.createElement('div');
    badge.textContent = `✦ ${n.toLocaleString()} visits`;
    badge.setAttribute('aria-label', `${n} visits so far`);
    Object.assign(badge.style, {
      position: 'fixed', right: '12px', bottom: '12px', zIndex: 50,
      padding: '4px 10px', borderRadius: '999px', font: '600 12px/1.4 system-ui, sans-serif',
      background: 'rgba(255,255,255,.9)', color: '#2a2533', boxShadow: '0 1px 4px rgba(0,0,0,.15)',
      pointerEvents: 'none',
    });
    document.body.append(badge);
  });
})();
