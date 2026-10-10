/* Layered export for designers: HTML or SVG instead of a flat PNG.
   A tool can offer tool.layers(), returning a list from the bottom up of
     { name, canvas, blend?, opacity? }                       — a picture layer
     { name, text, x, y, font, size, weight?, color, rot?, align?, spacing? } — a real text layer
   (x, y = text baseline start, or end when align is 'right').
   Picture layers are trimmed to their visible pixels and embedded as PNG data.
   Tools without layers() export the whole canvas as one picture layer. */
(function () {
  'use strict';

  const FONTS = 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=DotGothic16&family=Caveat:wght@600&family=Special+Elite&display=swap';

  // trim a full-size layer canvas down to the pixels that are actually drawn
  function trim(c, jpeg) {
    const w = c.width, h = c.height;
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
    x1 = Math.min(w, x1 + 3); y1 = Math.min(h, y1 + 3);
    const out = App.makeCanvas(x1 - x0, y1 - y0);
    out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return { url: out.toDataURL(jpeg ? 'image/jpeg' : 'image/png', .9), x: x0, y: y0, w: out.width, h: out.height };
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const slug = (s, i) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layer') + '-' + i;
  const deg = r => +(r * 180 / Math.PI).toFixed(3);

  function collect() {
    const tool = App.current;
    const W = App.canvas.width, H = App.canvas.height;
    let layers = tool.layers && tool.layers();
    if (!layers || !layers.length) {
      const flat = App.makeCanvas(W, H);
      flat.getContext('2d').drawImage((tool.exportCanvas && tool.exportCanvas()) || App.canvas, 0, 0);
      layers = [{ name: tool.name + ' artwork', canvas: flat }];
    }
    const out = [];
    for (const L of layers) {
      if (L.text != null) { if (String(L.text).trim()) out.push(L); continue; }
      if (L.w != null) {
        // already placed and sized by the tool (e.g. a half-resolution texture stretched over the page)
        out.push(Object.assign({}, L, { url: L.canvas.toDataURL(L.jpeg ? 'image/jpeg' : 'image/png', .86), x: L.x || 0, y: L.y || 0 }));
        continue;
      }
      const t = trim(L.canvas, L.jpeg);
      if (t) out.push(Object.assign({}, L, t));
    }
    return { W, H, layers: out, title: `KIRA·KIRA — ${tool.name}` };
  }

  function textWidth(L) {
    const c = App.makeCanvas(4, 4).getContext('2d');
    c.font = `${L.weight || 400} ${L.size}px ${L.font}`;
    return c.measureText(L.text).width + (L.spacing || 0) * L.text.length;
  }

  /* ---------- HTML ---------- */
  function toHTML(doc) {
    const items = doc.layers.map((L, i) => {
      const id = slug(L.name, i + 1);
      if (L.text != null) {
        const wpx = textWidth(L);
        const left = L.align === 'right' ? L.x - wpx : L.x;
        const top = L.y - L.size * .82;                       // baseline → top of the line box
        const ox = (L.align === 'right' ? wpx : 0), oy = L.size * .82;
        return `    <!-- ${esc(L.name)} (real text: click to edit) -->
    <div class="layer text" id="${id}" data-name="${esc(L.name)}" contenteditable="true" spellcheck="false" style="left:${left.toFixed(1)}px; top:${top.toFixed(1)}px; font-family:${esc(L.font)}; font-size:${L.size}px; font-weight:${L.weight || 400}; color:${L.color}; letter-spacing:${L.spacing || 0}px; transform-origin:${ox.toFixed(1)}px ${oy.toFixed(1)}px; transform:rotate(${deg(L.rot || 0)}deg);">${esc(L.text)}</div>`;
      }
      const extra = (L.blend ? ` mix-blend-mode:${L.blend};` : '') + (L.opacity != null ? ` opacity:${L.opacity};` : '');
      return `    <!-- ${esc(L.name)} -->
    <img class="layer" id="${id}" data-name="${esc(L.name)}" alt="${esc(L.name)}" draggable="false" style="left:${L.x}px; top:${L.y}px; width:${L.w}px; height:${L.h}px;${extra}" src="${L.url}">`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(doc.title)}</title>
<link rel="stylesheet" href="${FONTS}">
<style>
  /* The artboard is ${doc.W} × ${doc.H} px. Every element inside it is one layer, listed bottom to top.
     Move a layer with left/top, rotate it with transform, hide it with display:none,
     reorder layers by moving their lines. Text layers are real, editable text. */
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #1c1b22; font-family: system-ui, sans-serif; }
  .artboard { position: relative; width: ${doc.W}px; height: ${doc.H}px; overflow: hidden; transform-origin: top left; isolation: isolate; }
  .layer { position: absolute; display: block; margin: 0; white-space: pre; line-height: 1; user-select: none; }
  .text { user-select: text; outline: none; cursor: text; }
  .layer.picked { outline: 2px dashed #ff5c8a; outline-offset: 2px; }
  .hint { position: fixed; left: 12px; bottom: 10px; color: #aaa; font-size: 12px; }
</style>
</head>
<body>
  <div class="artboard" id="artboard">
${items}
  </div>
  <p class="hint">Drag any layer to move it · click text to edit it · made with KIRA·KIRA atelier</p>
<script>
  // Fit the artboard to the window, and let layers be dragged around. Delete this script to get a plain static page.
  const board = document.getElementById('artboard');
  let k = 1;
  function fit() {
    k = Math.min(1, (innerWidth - 32) / ${doc.W}, (innerHeight - 48) / ${doc.H});
    board.style.transform = 'scale(' + k + ')';
    board.style.marginRight = (${doc.W} * k - ${doc.W}) + 'px';
    board.style.marginBottom = (${doc.H} * k - ${doc.H}) + 'px';
  }
  addEventListener('resize', fit); fit();
  let drag = null;
  board.addEventListener('pointerdown', e => {
    const el = e.target.closest('.layer');
    if (!el || (el.classList.contains('text') && document.activeElement === el)) return;
    document.querySelectorAll('.picked').forEach(p => p.classList.remove('picked'));
    el.classList.add('picked');
    drag = { el, x: e.clientX, y: e.clientY, l: parseFloat(el.style.left), t: parseFloat(el.style.top), moved: false };
  });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / k, dy = (e.clientY - drag.y) / k;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved) { drag.el.style.left = (drag.l + dx) + 'px'; drag.el.style.top = (drag.t + dy) + 'px'; e.preventDefault(); }
  });
  addEventListener('pointerup', () => { drag = null; });
</script>
</body>
</html>
`;
  }

  /* ---------- SVG ---------- */
  function toSVG(doc) {
    const items = doc.layers.map((L, i) => {
      const id = slug(L.name, i + 1);
      if (L.text != null) {
        const rot = L.rot ? ` transform="rotate(${deg(L.rot)} ${L.x.toFixed(1)} ${L.y.toFixed(1)})"` : '';
        return `  <text id="${id}" x="${L.x.toFixed(1)}" y="${L.y.toFixed(1)}"${rot} font-family="${esc(L.font)}" font-size="${L.size}" font-weight="${L.weight || 400}" fill="${L.color}" letter-spacing="${L.spacing || 0}" text-anchor="${L.align === 'right' ? 'end' : 'start'}" xml:space="preserve">${esc(L.text)}</text>`;
      }
      const style = (L.blend ? `mix-blend-mode:${L.blend};` : '');
      return `  <g id="${id}"${L.opacity != null ? ` opacity="${L.opacity}"` : ''}${style ? ` style="${style}"` : ''}>
    <image x="${L.x}" y="${L.y}" width="${L.w}" height="${L.h}" href="${L.url}"/>
  </g>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${esc(doc.title)} — every <g> / <text> is one named layer, bottom to top. Text is real, editable text. -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${doc.W}" height="${doc.H}" viewBox="0 0 ${doc.W} ${doc.H}">
  <defs><style><![CDATA[@import url('${FONTS}');]]></style></defs>
${items}
</svg>
`;
  }

  function download(text, type, ext) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kirakira-${App.current.id}.${ext}`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  App.exportLayered = function (format) {
    if (!App.A) { App.toast('Add a picture first ✦'); return; }
    App.busy('Packing the layers…');
    setTimeout(() => {
      try {
        const doc = collect();
        if (format === 'svg') download(toSVG(doc), 'image/svg+xml', 'svg');
        else download(toHTML(doc), 'text/html', 'html');
        App.toast(`Saved ${doc.layers.length} layer${doc.layers.length === 1 ? '' : 's'} as ${format.toUpperCase()} ✦`);
      } catch (err) {
        console.error(err);
        App.toast('Could not export the layers — try Save as PNG.');
      }
      App.busy(false);
    }, 30);
  };

  App._layeredExport = { collect, toHTML, toSVG };   // used by the tests

  document.getElementById('exportHtml').addEventListener('click', () => App.exportLayered('html'));
  document.getElementById('exportSvg').addEventListener('click', () => App.exportLayered('svg'));
})();
