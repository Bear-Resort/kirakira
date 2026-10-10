/* ▦ ASCII Paint — brush retro text-mode characters onto parts of the picture.
   "Colour bucket" fills every connected area of similar colour in one click,
   which is perfect for flat-coloured anime art (hair, sky, clothes…). */
(function () {
  'use strict';

  const CHARSETS = {
    classic: ' .:-=+*#%@',
    blocks: ' ░▒▓█',
    sparkle: ' ·.:+*✧✦★',
    binary: '01',
    kana: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ',
  };
  const RANDOM_SETS = { binary: 1, kana: 1 };
  const CGA = [[85, 255, 255], [255, 85, 255], [255, 255, 255], [255, 255, 85], [85, 255, 85], [255, 85, 85]];

  const st = { cell: 12, charset: 'classic', color: 'original', bg: 'terminal', tool: 'brush', brush: 3, tol: 34, scan: true, glow: true };

  let w = 0, h = 0, cols = 0, rows = 0;
  let col = null;         // Float32Array r,g,b,lum per cell
  let painted = null;     // Uint8Array per cell
  let layer = null, lctx = null;
  let glowC = null;
  let dirty = true, last = null, lockRef = null;

  function sample() {
    cols = Math.ceil(w / st.cell); rows = Math.ceil(h / st.cell);
    const s = App.makeCanvas(cols, rows), x = s.getContext('2d');
    x.imageSmoothingQuality = 'high';
    // map exactly cols*cell × rows*cell source pixels onto the grid so cells line up
    x.drawImage(App.A, 0, 0, cols * st.cell, rows * st.cell, 0, 0, cols, rows);
    const d = x.getImageData(0, 0, cols, rows).data;
    col = new Float32Array(cols * rows * 4);
    for (let i = 0; i < cols * rows; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = b;
      col[i * 4 + 3] = (.299 * r + .587 * g + .114 * b) / 255;
    }
  }

  function inkFor(i) {
    const r = col[i * 4], g = col[i * 4 + 1], b = col[i * 4 + 2], l = col[i * 4 + 3];
    const dark = st.bg !== 'paper';
    switch (st.color) {
      case 'green': return `rgba(70,255,120,${.35 + l * .65})`;
      case 'amber': return `rgba(255,176,0,${.35 + l * .65})`;
      case 'cga': {
        let best = CGA[0], bd = 1e9;
        for (const c of CGA) { const dd = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (dd < bd) { bd = dd; best = c; } }
        return `rgb(${best[0]},${best[1]},${best[2]})`;
      }
      case 'ink': return dark ? '#e9e4f2' : '#1d1830';
      default: {
        // keep the original hue but make sure it glows on a dark screen
        if (!dark) return `rgb(${r * .8},${g * .8},${b * .8})`;
        const boost = l < .35 ? .35 / Math.max(l, .05) : 1;
        return `rgb(${Math.min(255, r * boost + 30)},${Math.min(255, g * boost + 30)},${Math.min(255, b * boost + 30)})`;
      }
    }
  }

  function charFor(i, cx, cy) {
    const set = CHARSETS[st.charset];
    const l = col[i * 4 + 3];
    const density = st.bg === 'paper' ? 1 - l : l;
    if (RANDOM_SETS[st.charset]) {
      if (density < .1) return ' ';
      const hsh = Math.abs(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453) % 1;
      return set[Math.floor(hsh * set.length)];
    }
    const k = Math.min(set.length - 1, Math.floor(density * set.length));
    return set[Math.max(st.bg === 'image' ? 1 : 0, k)];
  }

  function drawCell(cx, cy) {
    const i = cy * cols + cx, s = st.cell, x0 = cx * s, y0 = cy * s;
    lctx.clearRect(x0, y0, s, s);
    if (!painted[i]) return;
    if (st.bg === 'terminal') { lctx.fillStyle = '#0c0b12'; lctx.fillRect(x0, y0, s, s); }
    else if (st.bg === 'paper') { lctx.fillStyle = '#f3ead6'; lctx.fillRect(x0, y0, s, s); }
    else if (st.bg === 'image') { lctx.fillStyle = 'rgba(10,8,20,.55)'; lctx.fillRect(x0, y0, s, s); }
    const ch = charFor(i, cx, cy);
    if (ch !== ' ') {
      lctx.fillStyle = inkFor(i);
      lctx.fillText(ch, x0 + s / 2, y0 + s / 2 + s * .05);
    }
    if (st.scan && st.bg !== 'paper') {
      lctx.fillStyle = 'rgba(0,0,0,.28)';
      for (let y = y0 + 1; y < y0 + s; y += 3) lctx.fillRect(x0, y, s, 1);
    }
  }

  function setFont() {
    lctx.font = `${Math.round(st.cell * 1.08)}px "DotGothic16", "Courier New", monospace`;
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
  }

  function redrawAll() {
    lctx.clearRect(0, 0, w, h);
    setFont();
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if (painted[cy * cols + cx]) drawCell(cx, cy);
    dirty = true;
  }

  function rebuild(keep) {
    const old = painted, oc = cols, os = st._lastCell || st.cell;
    sample();
    painted = new Uint8Array(cols * rows);
    if (keep && old) {
      // carry the painted area over to the new cell size
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        const ox = Math.floor(cx * st.cell / os), oy = Math.floor(cy * st.cell / os);
        if (old[oy * oc + ox]) painted[cy * cols + cx] = 1;
      }
    }
    st._lastCell = st.cell;
    redrawAll();
  }

  function colorDist(a, b) {
    const dr = col[a * 4] - col[b * 4], dg = col[a * 4 + 1] - col[b * 4 + 1], db = col[a * 4 + 2] - col[b * 4 + 2];
    return Math.sqrt(dr * dr * .3 + dg * dg * .59 + db * db * .11);
  }

  function paintAt(px, py, erase) {
    const cx0 = Math.floor(px / st.cell), cy0 = Math.floor(py / st.cell), R = st.brush;
    setFont();
    for (let cy = cy0 - R; cy <= cy0 + R; cy++) for (let cx = cx0 - R; cx <= cx0 + R; cx++) {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      if ((cx - cx0) ** 2 + (cy - cy0) ** 2 > R * R + R) continue;
      const i = cy * cols + cx;
      if (lockRef != null && colorDist(i, lockRef) > st.tol) continue;
      const v = erase ? 0 : 1;
      if (painted[i] !== v) { painted[i] = v; drawCell(cx, cy); }
    }
    dirty = true;
  }

  function strokeTo(p, erase) {
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    const steps = Math.max(1, Math.ceil(dist / st.cell));
    for (let i = 1; i <= steps; i++) paintAt(App.lerp(last.x, p.x, i / steps), App.lerp(last.y, p.y, i / steps), erase);
    last = p;
  }

  function bucket(px, py) {
    const sx = Math.floor(px / st.cell), sy = Math.floor(py / st.cell);
    if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) return;
    const seed = sy * cols + sx;
    const seen = new Uint8Array(cols * rows);
    const stack = [seed];
    seen[seed] = 1;
    setFont();
    while (stack.length) {
      const i = stack.pop();
      painted[i] = 1;
      drawCell(i % cols, (i / cols) | 0);
      const cx = i % cols, cy = (i / cols) | 0;
      const nb = [cx > 0 ? i - 1 : -1, cx < cols - 1 ? i + 1 : -1, cy > 0 ? i - cols : -1, cy < rows - 1 ? i + cols : -1];
      for (const n of nb) {
        if (n < 0 || seen[n]) continue;
        seen[n] = 1;
        if (colorDist(n, seed) <= st.tol) stack.push(n);
      }
    }
    dirty = true;
  }

  const tool = {
    id: 'ascii', name: 'ASCII Paint', short: 'ASCII Paint', icon: '▦',
    hint: 'Paint retro text-mode characters onto your picture. Use the colour bucket to fill a whole area of similar colour (hair, sky, a jacket…) in one click. Right-click drag erases.',
    cursor: 'none',

    build(box) {
      const ui = App.ui;
      ui.seg(box, 'Tool', [['brush', '🖌 Brush'], ['bucket', '🪣 Colour bucket'], ['erase', '⌫ Eraser']], st.tool, v => { st.tool = v; });
      ui.slider(box, 'Brush size (cells)', { min: 0, max: 14, value: st.brush }, v => { st.brush = v; });
      ui.slider(box, 'Colour tolerance', { min: 5, max: 120, value: st.tol }, v => { st.tol = v; });
      ui.toggle(box, 'Brush stays inside the colour you start on', !!st.lock, v => { st.lock = v; });
      ui.heading(box, 'Look');
      ui.slider(box, 'Character size', { min: 6, max: 32, value: st.cell, format: v => v + 'px' }, v => { st.cell = v; if (App.A) rebuild(true); });
      ui.select(box, 'Characters', [['classic', ' .:-=+*#%@  classic'], ['blocks', '░▒▓█  blocks'], ['sparkle', '·+*✧✦★  sparkle'], ['binary', '0101  binary'], ['kana', 'ｱｲｳｴｵ  half-width kana']],
        st.charset, v => { st.charset = v; if (App.A) redrawAll(); });
      ui.select(box, 'Ink colour', [['original', 'Picture colours'], ['green', 'Green phosphor'], ['amber', 'Amber monitor'], ['cga', 'CGA 4-colour'], ['ink', 'Single ink']],
        st.color, v => { st.color = v; if (App.A) redrawAll(); });
      ui.select(box, 'Screen behind text', [['terminal', 'Black terminal'], ['image', 'See-through'], ['paper', 'Old paper']],
        st.bg, v => { st.bg = v; if (App.A) redrawAll(); });
      ui.toggle(box, 'CRT scanlines', st.scan, v => { st.scan = v; if (App.A) redrawAll(); });
      ui.toggle(box, 'Phosphor glow', st.glow, v => { st.glow = v; dirty = true; });
      ui.buttons(box, [
        ['▦ Fill everything', () => { painted.fill(1); redrawAll(); }],
        ['✕ Clear', () => { painted.fill(0); redrawAll(); }],
      ]);
    },

    onImage() {
      w = App.A.width; h = App.A.height;
      App.resize(w, h);
      layer = App.makeCanvas(w, h); lctx = layer.getContext('2d');
      const hadPaint = painted && painted.some(v => v);
      rebuild(hadPaint);
      if (!hadPaint) {
        // start with a diagonal band so the effect is visible straight away
        for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
          const t = cx / cols - cy / rows * .6;
          if (t > .52 && t < .78) painted[cy * cols + cx] = 1;
        }
        redrawAll();
      }
    },

    down(p, e) {
      const erase = st.tool === 'erase' || e.button === 2;
      if (st.tool === 'bucket' && !erase) { bucket(p.x, p.y); return; }
      lockRef = st.lock ? Math.floor(p.y / st.cell) * cols + Math.floor(p.x / st.cell) : null;
      last = p; this._erase = erase;
      paintAt(p.x, p.y, erase);
    },
    move(p) {
      if (App.pointer.down && last) strokeTo(p, this._erase);
      else dirty = true;
    },
    up() { last = null; lockRef = null; },
    leave() { dirty = true; },

    frame() {
      if (!dirty || !layer) return;
      dirty = false;
      const x = App.ctx;
      x.drawImage(App.A, 0, 0);
      x.drawImage(layer, 0, 0);
      if (st.glow && st.bg !== 'paper') {
        glowC = App.blurred(layer, 8);
        x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .45;
        x.drawImage(glowC, 0, 0); x.restore();
      }
      if (App.pointer.inside && st.tool !== 'bucket') {
        x.strokeStyle = '#ff5c8a'; x.lineWidth = 2; x.setLineDash([4, 4]);
        x.beginPath(); x.arc(App.pointer.x, App.pointer.y, (st.brush + .5) * st.cell, 0, Math.PI * 2); x.stroke();
        x.setLineDash([]);
      } else if (App.pointer.inside) {
        x.fillStyle = '#ff5c8a';
        Shapes.trace(x, 'sparkle', App.pointer.x, App.pointer.y, 14, 0); x.fill();
      }
    },
  };

  App.register(tool);
})();
