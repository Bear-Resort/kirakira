/* Visitor + usage counter, powered by GoatCounter (https://www.goatcounter.com).
   No cookies, no personal data. Set GC_CODE to your GoatCounter site code
   (the "xxx" in xxx.goatcounter.com). Left empty, this file does nothing.

   Counted:
     - page views (visits)                         -> automatic
     - "uses": uploading a picture, saving PNG/HTML/SVG -> events
   Shown: a small "✦ N visits" badge, if "Allow adding visitor counts on your
   website" is turned on in GoatCounter's settings. */
(function () {
  'use strict';
  const GC_CODE = '';
  if (!GC_CODE) return;

  const base = `https://${GC_CODE}.goatcounter.com`;

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `${base}/count`;
  document.head.append(s);

  function use(name) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: `use-${name}`, title: `Use: ${name}`, event: true });
      }
    } catch (e) { /* counting must never break the site */ }
  }

  // Count uses without touching the tools themselves.
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#exportBtn, #exportHtml, #exportSvg, #download');
    if (b) use({ exportBtn: 'save-png', exportHtml: 'save-html', exportSvg: 'save-svg', download: 'darkroom-save' }[b.id]);
  }, true);
  document.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'file' && e.target.files && e.target.files.length) use('upload');
  }, true);
  document.addEventListener('drop', () => use('upload'), true);

  // Public visit badge.
  fetch(`${base}/counter/TOTAL.json`)
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d || !d.count) return;
      const badge = document.createElement('div');
      badge.textContent = `✦ ${d.count} visits`;
      badge.setAttribute('aria-label', `${d.count} visits so far`);
      Object.assign(badge.style, {
        position: 'fixed', right: '12px', bottom: '12px', zIndex: 50,
        padding: '4px 10px', borderRadius: '999px', font: '600 12px/1.4 "Zen Maru Gothic", sans-serif',
        background: 'rgba(255,255,255,.85)', color: '#3a2b4a', boxShadow: '0 1px 4px rgba(0,0,0,.15)',
        pointerEvents: 'none'
      });
      document.body.append(badge);
    })
    .catch(() => {});
})();
