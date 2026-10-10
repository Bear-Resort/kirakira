/* ◈ Subject Swap — click an object (an ice cream, a character, a cat…) and an AI
   model cuts it out. Only that object is restyled: pixel-art sprite, anime cel
   shading, manga screentone, pencil sketch, holographic or glitch. */
(function () {
  'use strict';

  const PALETTES = {
    pico8: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'],
    sweetie: ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'],
    gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    none: null,
  };
  const hexRGB = hx => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
  for (const k in PALETTES) if (PALETTES[k]) PALETTES[k] = PALETTES[k].map(hexRGB);

  const st = {
    tool: 'magic', click: 'new', style: 'pixel', block: 14, palette: 'none', spriteOutline: true,
    bg: 'keep', sticker: true, outline: 10, brush: 30, showSel: true,
  };

  let w = 0, h = 0;
  let mask = null;            // what you selected (alpha)
  let styled = null, styledMask = null, styleKey = '';
  let hasMask = false, dirty = true, last = null, loading = false;

  /* ---------- styles ---------- */
  function nearest(pal, r, g, b) {
    let best = pal[0], bd = 1e9;
    for (const c of pal) {
      const d = (c[0] - r) ** 2 * .3 + (c[1] - g) ** 2 * .59 + (c[2] - b) ** 2 * .11;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function pixelStyle() {
    const bs = st.block, cols = Math.ceil(w / bs), rows = Math.ceil(h / bs);
    const sm = App.makeCanvas(cols, rows), sx = sm.getContext('2d');
    sx.imageSmoothingQuality = 'high';
    sx.drawImage(App.A, 0, 0, cols, rows);
    const mm = App.makeCanvas(cols, rows), mx = mm.getContext('2d');
    mx.imageSmoothingQuality = 'high';
    mx.drawImage(mask, 0, 0, cols, rows);
    const px = sx.getImageData(0, 0, cols, rows), md = mx.getImageData(0, 0, cols, rows).data, d = px.data;
    const inside = new Uint8Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) inside[i] = md[i * 4 + 3] > 90 ? 1 : 0;
    const pal = PALETTES[st.palette];
    for (let i = 0; i < cols * rows; i++) {
      if (!inside[i]) { d[i * 4 + 3] = 0; continue; }
      let r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (pal) [r, g, b] = nearest(pal, r * 1.05, g * 1.05, b * 1.05);
      else {
        const l = (r + g + b) / 3;
        r = App.clamp(l + (r - l) * 1.25, 0, 255); g = App.clamp(l + (g - l) * 1.25, 0, 255); b = App.clamp(l + (b - l) * 1.25, 0, 255);
        r = Math.round(r / 42.5) * 42.5; g = Math.round(g / 42.5) * 42.5; b = Math.round(b / 42.5) * 42.5;
      }
      if (st.spriteOutline) {
        const cx = i % cols, cy = (i / cols) | 0;
        const edge = cx === 0 || cy === 0 || cx === cols - 1 || cy === rows - 1 ||
          !inside[i - 1] || !inside[i + 1] || !inside[i - cols] || !inside[i + cols];
        if (edge) { const o = pal ? pal[0] : [20, 16, 30]; r = o[0]; g = o[1]; b = o[2]; }
      }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    sx.putImageData(px, 0, 0);
    const out = App.makeCanvas(w, h), o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(sm, 0, 0, cols * bs, rows * bs);
    return { canvas: out, ownMask: true };
  }

  function lumArray(src) {
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    const L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
    return L;
  }

  function celStyle() {
    const soft = App.blurred(App.A, 2);
    const out = App.makeCanvas(w, h), o = out.getContext('2d');
    o.drawImage(soft, 0, 0);
    const id = o.getImageData(0, 0, w, h), d = id.data;
    const L = lumArray(App.A);
    const lv = 4, step = 255 / (lv - 1);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, j = i * 4;
      // posterise + boost saturation for a flat anime-cel look
      const l = .299 * d[j] + .587 * d[j + 1] + .114 * d[j + 2];
      for (let c = 0; c < 3; c++) {
        const v = l + (d[j + c] - l) * 1.35;
        d[j + c] = Math.round(v / step) * step * .85 + v * .15;
      }
      const gx = L[i + 1 - w] + 2 * L[i + 1] + L[i + 1 + w] - L[i - 1 - w] - 2 * L[i - 1] - L[i - 1 + w];
      const gy = L[i - 1 + w] + 2 * L[i + w] + L[i + 1 + w] - L[i - 1 - w] - 2 * L[i - w] - L[i + 1 - w];
      if (gx * gx + gy * gy > 9000) { d[j] = 40; d[j + 1] = 30; d[j + 2] = 55; }
    }
    o.putImageData(id, 0, 0);
    return { canvas: out };
  }

  function halftoneStyle() {
    const out = App.makeCanvas(w, h), o = out.getContext('2d');
    o.fillStyle = '#fbf7ee'; o.fillRect(0, 0, w, h);
    const s = Math.max(4, Math.round(st.block * .6));
    const cols = Math.ceil(w / s), rows = Math.ceil(h / s);
    const sm = App.makeCanvas(cols, rows), sx = sm.getContext('2d');
    sx.drawImage(App.A, 0, 0, cols, rows);
    const d = sx.getImageData(0, 0, cols, rows).data;
    const mono = st.palette === 'gameboy' || st.palette === 'none';
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const i = (cy * cols + cx) * 4;
      const l = (.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / 255;
      const r = s * .72 * Math.sqrt(1 - l);
      if (r < .4) continue;
      o.fillStyle = mono ? '#1d1830' : `rgb(${d[i] * .7},${d[i + 1] * .7},${d[i + 2] * .7})`;
      const ox = cx * s + (cy % 2 ? s / 2 : 0) + s / 2;
      o.beginPath(); o.arc(ox, cy * s + s / 2, r, 0, Math.PI * 2); o.fill();
    }
    return { canvas: out };
  }

  function sketchStyle() {
    const L = lumArray(App.A);
    const inv = App.makeCanvas(w, h), ix = inv.getContext('2d');
    const id = ix.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 255 - L[i]; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    ix.putImageData(id, 0, 0);
    const blur = App.blurred(inv, 6).getContext('2d').getImageData(0, 0, w, h).data;
    const out = App.makeCanvas(w, h), o = out.getContext('2d');
    const od = o.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.min(255, L[i] * 255 / (256 - blur[i * 4]));   // colour dodge = pencil lines
      const t = Math.pow(v / 255, 2.2) * 255;
      od.data[i * 4] = t * .98 + 4; od.data[i * 4 + 1] = t * .95 + 4; od.data[i * 4 + 2] = t * .9 + 10; od.data[i * 4 + 3] = 255;
    }
    o.putImageData(od, 0, 0);
    return { canvas: out };
  }

  function holoStyle() {
    const out = App.makeCanvas(w, h), o = out.getContext('2d');
    o.drawImage(App.A, 0, 0);
    const id = o.getImageData(0, 0, w, h), d = id.data;
    const rand = App.rng(3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4;
      const l = (.299 * d[j] + .587 * d[j + 1] + .114 * d[j + 2]) / 255;
      const hue = ((x + y) / (w + h) * 720 + l * 220) % 360;
      const k = hue / 60, c = .75, xx = c * (1 - Math.abs(k % 2 - 1));
      let r = 0, g = 0, b = 0;
      if (k < 1) { r = c; g = xx; } else if (k < 2) { r = xx; g = c; } else if (k < 3) { g = c; b = xx; }
      else if (k < 4) { g = xx; b = c; } else if (k < 5) { r = xx; b = c; } else { r = c; b = xx; }
      const m = .3;
      for (const [ci, v] of [[0, r], [1, g], [2, b]]) {
        const hv = (v + m) * 255;
        const base = d[j + ci];
        d[j + ci] = 255 - (255 - base) * (255 - hv) / 255 * .85;   // screen blend
      }
      if (rand() < .004) { d[j] = d[j + 1] = d[j + 2] = 255; }
    }
    o.putImageData(id, 0, 0);
    return { canvas: out };
  }

  function glitchStyle() {
    const out = App.makeCanvas(w, h), o = out.getContext('2d');
    const off = Math.max(4, w / 120);
    o.globalCompositeOperation = 'lighter';
    for (const [col, dx] of [['#f00', -off], ['#0f0', 0], ['#00f', off]]) {
      const ch = App.makeCanvas(w, h), c = ch.getContext('2d');
      c.drawImage(App.A, 0, 0);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, w, h);
      o.drawImage(ch, dx, 0);
    }
    o.globalCompositeOperation = 'source-over';
    const rand = App.rng(21);
    const copy = App.makeCanvas(w, h); copy.getContext('2d').drawImage(out, 0, 0);
    for (let i = 0; i < 22; i++) {
      const y = rand() * h, sh = 4 + rand() * h / 24, dx = (rand() - .5) * w / 8;
      o.drawImage(copy, 0, y, w, sh, dx, y, w, sh);
    }
    o.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = 0; y < h; y += 3) o.fillRect(0, y, w, 1);
    return { canvas: out };
  }

  const STYLES = {
    pixel: ['👾 Pixel-art sprite', pixelStyle], cel: ['🎨 Anime cel shading', celStyle],
    halftone: ['⚫ Manga screentone', halftoneStyle], sketch: ['✏ Pencil sketch', sketchStyle],
    holo: ['🌈 Holographic foil', holoStyle], glitch: ['📼 VHS glitch', glitchStyle],
  };

  function ensureStyled() {
    const key = [st.style, st.block, st.palette, st.spriteOutline, st.style === 'pixel' ? maskVersion : 0].join('|');
    if (styled && key === styleKey) return;
    styleKey = key;
    const r = STYLES[st.style][1]();
    styled = r.canvas;
    styledMask = r.ownMask ? r.canvas : null;
  }
  let maskVersion = 0;
  function maskChanged() { maskVersion++; dirty = true; }

  function background(x) {
    const A = App.A;
    if (st.bg === 'keep') { x.drawImage(A, 0, 0); return; }
    if (st.bg === 'blur') { x.drawImage(App.blurred(A, 12), 0, 0); return; }
    if (st.bg === 'paper') {
      x.fillStyle = '#fdf6e9'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,92,138,.18)';
      const s = Math.max(w, h) / 18;
      for (let yy = 0; yy < h + s; yy += s) for (let xx = 0; xx < w + s; xx += s) {
        Shapes.trace(x, 'sparkle', xx + ((yy / s) % 2 ? s / 2 : 0), yy, s * .18, 0); x.fill();
      }
      return;
    }
    x.drawImage(A, 0, 0);
    if (st.bg === 'gray' || st.bg === 'dim') {
      const id = x.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
        const k = st.bg === 'dim' ? .45 : 1;
        d[i] = l * k; d[i + 1] = l * k; d[i + 2] = l * k * (st.bg === 'dim' ? 1.3 : 1);
      }
      x.putImageData(id, 0, 0);
    }
  }

  function compose() {
    const x = App.ctx;
    background(x);
    if (!hasMask) return;
    ensureStyled();
    const shapeMask = styledMask || mask;
    if (st.sticker && st.outline > 0) {
      const sil = App.silhouette(shapeMask, st.outline * Math.max(w, h) / 1000);
      x.save();
      x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 14; x.shadowOffsetY = 6;
      x.drawImage(sil, 0, 0);
      x.restore();
    }
    const cut = App.makeCanvas(w, h), c = cut.getContext('2d');
    c.drawImage(styled, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(shapeMask, 0, 0);
    x.drawImage(cut, 0, 0);
    if (st.showSel && st.tool !== 'magic') {
      const tint = App.silhouette(mask, 0, 'rgba(255,92,138,.4)');
      x.drawImage(tint, 0, 0);
    }
  }

  async function magic(p) {
    if (loading) return;
    loading = true;
    App.busy(segReady ? 'Finding the object…' : 'Waking up the AI cutter (first time takes a few seconds)…');
    try {
      const m = await App.segmentAt(App.A, p.x, p.y);
      segReady = true;
      const mx = mask.getContext('2d');
      if (st.click === 'new') { mx.clearRect(0, 0, w, h); mx.drawImage(m, 0, 0); }
      else if (st.click === 'add') mx.drawImage(m, 0, 0);
      else { mx.globalCompositeOperation = 'destination-out'; mx.drawImage(m, 0, 0); mx.globalCompositeOperation = 'source-over'; }
      hasMask = true;
      maskChanged();
    } catch (err) {
      console.error(err);
      App.toast('The AI cutter could not load (are you offline?). Use the "Paint +" brush to select the object by hand.', 6000);
      st.tool = 'add'; if (toolSeg) toolSeg.set('add');
    }
    App.busy(false);
    loading = false;
  }
  let segReady = false, toolSeg = null;

  const tool = {
    id: 'subject', name: 'Subject Swap', short: 'Subject Swap', icon: '◈',
    hint: 'Click an object — the ice cream, the character, a cat — and AI cuts it out. Only that part is restyled: turn it into a pixel-art sprite, anime cels, manga screentone and more.',
    cursor: 'crosshair',

    build(box) {
      const ui = App.ui;
      toolSeg = ui.seg(box, 'Select with', [['magic', '✨ AI click'], ['add', '🖌 Paint +'], ['erase', '⌫ Paint −']], st.tool, v => { st.tool = v; dirty = true; });
      ui.seg(box, 'AI click', [['new', 'New'], ['add', 'Add'], ['sub', 'Subtract']], st.click, v => { st.click = v; });
      ui.slider(box, 'Paint brush size', { min: 4, max: 120, value: st.brush }, v => { st.brush = v; });
      ui.toggle(box, 'Tint the selection while painting', st.showSel, v => { st.showSel = v; dirty = true; });
      ui.buttons(box, [
        ['Select all', () => { const m = mask.getContext('2d'); m.fillStyle = '#fff'; m.fillRect(0, 0, w, h); hasMask = true; maskChanged(); }],
        ['Invert', () => { const m = mask.getContext('2d'); m.globalCompositeOperation = 'xor'; m.fillStyle = '#fff'; m.fillRect(0, 0, w, h); m.globalCompositeOperation = 'source-over'; hasMask = true; maskChanged(); }],
        ['Clear', () => { mask.getContext('2d').clearRect(0, 0, w, h); hasMask = false; maskChanged(); }],
      ]);
      ui.heading(box, 'New style for the object');
      ui.select(box, 'Style', Object.entries(STYLES).map(([k, v]) => [k, v[0]]), st.style, v => { st.style = v; dirty = true; });
      ui.slider(box, 'Pixel / dot size', { min: 4, max: 48, value: st.block }, v => { st.block = v; dirty = true; });
      ui.select(box, 'Palette', [['none', 'Keep colours (posterised)'], ['pico8', 'PICO-8'], ['sweetie', 'Sweetie 16'], ['gameboy', 'Game Boy green']], st.palette, v => { st.palette = v; dirty = true; });
      ui.toggle(box, 'Dark sprite outline (pixel art)', st.spriteOutline, v => { st.spriteOutline = v; dirty = true; });
      ui.heading(box, 'Around it');
      ui.select(box, 'Background', [['keep', 'Keep as is'], ['gray', 'Black & white (colour pop)'], ['dim', 'Dim night'], ['blur', 'Dreamy blur'], ['paper', 'Sparkle sticker paper']], st.bg, v => { st.bg = v; dirty = true; });
      ui.toggle(box, 'White sticker border', st.sticker, v => { st.sticker = v; dirty = true; });
      ui.slider(box, 'Border width', { min: 0, max: 40, value: st.outline }, v => { st.outline = v; dirty = true; });
      ui.note(box, 'The AI model is downloaded the first time you click (about 6 MB), so it needs internet once. Works best on clear, separate objects; touch up with Paint + / −.');
      App.loadSegmenter().then(() => { segReady = true; }, () => {});
    },

    onImage() {
      w = App.A.width; h = App.A.height;
      App.resize(w, h);
      mask = App.makeCanvas(w, h);
      hasMask = false; styled = null;
      maskChanged();
    },

    down(p, e) {
      if (st.tool === 'magic' && e.button !== 2) { magic(p); return; }
      last = p;
      this._erase = st.tool === 'erase' || e.button === 2;
      App.paintMask(mask, p.x, p.y, p.x, p.y, st.brush * Math.max(w, h) / 1000, this._erase);
      hasMask = true; maskChanged();
    },
    move(p) {
      if (!App.pointer.down || !last) return;
      App.paintMask(mask, last.x, last.y, p.x, p.y, st.brush * Math.max(w, h) / 1000, this._erase);
      last = p; maskChanged();
    },
    up() { last = null; },

    frame() {
      if (!dirty || !mask) return;
      dirty = false;
      compose();
      if (!hasMask) {
        const x = App.ctx, fs = Math.round(Math.max(18, w / 40));
        x.font = `700 ${fs}px "Zen Maru Gothic", sans-serif`;
        const msg = st.tool === 'magic' ? '✨ click the object you want to restyle' : '🖌 paint over the object';
        const tw = x.measureText(msg).width;
        x.fillStyle = 'rgba(42,37,51,.75)';
        x.beginPath(); App.roundRect(x, (w - tw) / 2 - 18, h - fs * 2.6, tw + 36, fs * 1.8, fs * .9); x.fill();
        x.fillStyle = '#fff'; x.textAlign = 'center';
        x.fillText(msg, w / 2, h - fs * 1.35);
        x.textAlign = 'start';
      }
    },
  };

  App.register(tool);
})();
