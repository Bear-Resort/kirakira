/* ▣ Retro Window — the picture becomes a Windows-98 desktop. Drag a box over a
   detail and it pops open in its own zoomed-in "DETAIL_01.BMP" window. Add
   error pop-ups and progress bars for extra nostalgia. */
(function () {
  'use strict';

  const THEMES = {
    classic: { face: '#c0c0c0', hi: '#ffffff', lite: '#dfdfdf', shade: '#808080', dark: '#000000', t1: '#000080', t2: '#1084d0', desk: '#008080', text: '#000' },
    lilac: { face: '#e4d8f5', hi: '#ffffff', lite: '#f3ecfc', shade: '#9a86b8', dark: '#3a2a4f', t1: '#7b4fd6', t2: '#f39ac8', desk: '#f7c6d9', text: '#2a1f3a' },
    mint: { face: '#cfe6dc', hi: '#ffffff', lite: '#e6f4ee', shade: '#6f9a88', dark: '#1d3a30', t1: '#1f6f5c', t2: '#58c7a8', desk: '#253a4a', text: '#14281f' },
  };

  const st = { desktop: true, zoom: 3, pixelated: true, callout: true, theme: 'classic', popup: 'Too cute. Cannot compute.' };

  let u = 1, W = 0, H = 0, img = { x: 0, y: 0, w: 0, h: 0 };
  let wins = [], counter = 0, sel = null, drag = null, ants = 0;
  let T = THEMES.classic;

  const font = (px, bold) => `${bold ? 'bold ' : ''}${Math.round(px * u)}px "DotGothic16", "MS Sans Serif", Tahoma, sans-serif`;

  /* ---------- chrome primitives ---------- */
  function bevel(x, rx, ry, rw, rh, sunken) {
    const [a, b, c, d] = sunken ? [T.shade, T.dark, T.hi, T.lite] : [T.hi, T.lite, T.dark, T.shade];
    x.fillStyle = a; x.fillRect(rx, ry, rw, u); x.fillRect(rx, ry, u, rh);
    x.fillStyle = b; x.fillRect(rx + u, ry + u, rw - 2 * u, u); x.fillRect(rx + u, ry + u, u, rh - 2 * u);
    x.fillStyle = c; x.fillRect(rx, ry + rh - u, rw, u); x.fillRect(rx + rw - u, ry, u, rh);
    x.fillStyle = d; x.fillRect(rx + u, ry + rh - 2 * u, rw - 2 * u, u); x.fillRect(rx + rw - 2 * u, ry + u, u, rh - 2 * u);
  }

  function button(x, rx, ry, rw, rh, label, pressed) {
    x.fillStyle = T.face; x.fillRect(rx, ry, rw, rh);
    bevel(x, rx, ry, rw, rh, pressed);
    if (label) {
      x.fillStyle = T.text; x.font = font(11);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(label, rx + rw / 2, ry + rh / 2 + u);
      x.textAlign = 'start'; x.textBaseline = 'alphabetic';
    }
  }

  const TITLE = 18, PAD = 4;
  // returns the content rect of a window frame drawn at (rx, ry) with content size cw×ch
  function frame(x, rx, ry, cw, ch, title, opts) {
    opts = opts || {};
    const fw = cw + (PAD * 2 + 2) * u, top = (PAD + TITLE + 2 + (opts.menu ? 18 : 0)) * u;
    const fh = ch + top + (PAD + 2 + (opts.status ? 18 : 0)) * u;
    x.fillStyle = T.face; x.fillRect(rx, ry, fw, fh);
    bevel(x, rx, ry, fw, fh, false);
    // title bar
    const tx = rx + 3 * u, ty = ry + 3 * u, tw = fw - 6 * u, th = TITLE * u;
    const g = x.createLinearGradient(tx, 0, tx + tw, 0);
    g.addColorStop(0, opts.inactive ? '#808080' : T.t1); g.addColorStop(1, opts.inactive ? '#b5b5b5' : T.t2);
    x.fillStyle = g; x.fillRect(tx, ty, tw, th);
    x.fillStyle = '#fff'; x.font = font(11, true); x.textBaseline = 'middle';
    // tiny icon
    x.fillStyle = opts.icon || '#ffd35c'; x.fillRect(tx + 3 * u, ty + 4 * u, 10 * u, 10 * u);
    x.fillStyle = '#fff';
    x.fillText(title, tx + 17 * u, ty + th / 2 + u);
    x.textBaseline = 'alphabetic';
    // _ □ ×
    const bw = 16 * u, bh = 14 * u, by = ty + 2 * u;
    const glyphs = opts.closeOnly ? ['×'] : ['_', '□', '×'];
    glyphs.forEach((gl, k) => {
      const fromRight = glyphs.length - 1 - k;
      const bx = tx + tw - 2 * u - bw - fromRight * bw - (fromRight ? 2 * u : 0);
      button(x, bx, by, bw, bh, '', false);
      x.fillStyle = T.text; x.font = font(12, true); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(gl, bx + bw / 2, by + bh / 2 + (gl === '_' ? -2 * u : u));
      x.textAlign = 'start'; x.textBaseline = 'alphabetic';
    });
    let cy = ty + th + 2 * u;
    if (opts.menu) {
      x.fillStyle = T.text; x.font = font(11);
      let mx = rx + 8 * u;
      for (const m of opts.menu) { x.fillText(m, mx, cy + 13 * u); mx += x.measureText(m).width + 12 * u; }
      cy += 18 * u;
    }
    const content = { x: rx + (PAD + 1) * u, y: cy + u, w: cw, h: ch };
    bevel(x, content.x - 2 * u, content.y - 2 * u, cw + 4 * u, ch + 4 * u, true);
    if (opts.status) {
      const sy = content.y + ch + 4 * u;
      bevel(x, content.x - 2 * u, sy, cw + 4 * u, 16 * u, true);
      x.fillStyle = T.text; x.font = font(10);
      x.fillText(opts.status, content.x + 4 * u, sy + 12 * u);
    }
    return { frame: { x: rx, y: ry, w: fw, h: fh }, title: { x: tx, y: ty, w: tw, h: th }, content, close: { x: tx + tw - bw - 2 * u, y: by, w: bw, h: bh } };
  }

  /* ---------- layout ---------- */
  function layout() {
    const A = App.A;
    u = Math.max(1, Math.round(Math.max(A.width, A.height) / 650));
    if (st.desktop) {
      const m = 26 * u;
      img = { x: m + (PAD + 1) * u, y: m + (PAD + TITLE + 22) * u + u, w: A.width, h: A.height };
      W = A.width + m * 2 + (PAD * 2 + 2) * u;
      H = img.y + A.height + (PAD + 22) * u + m + 30 * u;
    } else {
      img = { x: 0, y: 0, w: A.width, h: A.height };
      W = A.width; H = A.height;
    }
    App.resize(W, H);
  }

  function clampWin(win) {
    const r = win.rect;
    if (!r) return;
    win.x = App.clamp(win.x, -r.frame.w * .6, W - r.frame.w * .4);
    win.y = App.clamp(win.y, 0, H - 30 * u);
  }

  function addZoom(sx, sy, sw, sh) {
    counter++;
    let z = st.zoom;
    const maxW = W * .55, maxH = H * .55;
    z = Math.min(z, maxW / sw, maxH / sh);
    const cw = Math.round(sw * z), ch = Math.round(sh * z);
    const fw = cw + 40 * u;
    // place it beside the selection
    let wx = img.x + sx + sw + 30 * u;
    if (wx + fw > W) wx = img.x + sx - fw - 30 * u;
    if (wx < 0) wx = W - fw - 10 * u;
    let wy = img.y + sy - 40 * u;
    wy = App.clamp(wy, 6 * u, Math.max(6 * u, H - ch - 90 * u));
    wins.push({ kind: 'zoom', sx, sy, sw, sh, z, x: wx, y: wy, title: `DETAIL_${String(counter).padStart(2, '0')}.BMP` });
  }

  function addPopup(kind) {
    counter++;
    wins.push({
      kind, x: W * (.15 + Math.random() * .45), y: H * (.12 + Math.random() * .45),
      title: kind === 'error' ? 'Error' : 'Downloading…', text: st.popup, born: performance.now(),
    });
  }

  /* ---------- drawing ---------- */
  function marching(x, rx, ry, rw, rh) {
    x.save();
    x.lineWidth = Math.max(1, u);
    x.strokeStyle = '#000'; x.setLineDash([4 * u, 4 * u]); x.lineDashOffset = -ants;
    x.strokeRect(rx + .5, ry + .5, rw, rh);
    x.strokeStyle = '#fff'; x.lineDashOffset = -ants + 4 * u;
    x.strokeRect(rx + .5, ry + .5, rw, rh);
    x.restore();
  }

  function drawDesktop(x) {
    if (!st.desktop) { x.drawImage(App.A, 0, 0); return; }
    x.fillStyle = T.desk; x.fillRect(0, 0, W, H);
    if (st.theme === 'lilac') {
      x.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < W; i += 24 * u) for (let j = 0; j < H; j += 24 * u) if (((i + j) / (24 * u)) % 2 === 0) x.fillRect(i, j, 24 * u, 24 * u);
    }
    const m = 26 * u;
    const r = frame(x, m, m, App.A.width, App.A.height, 'my_oshi.bmp - Paint', {
      menu: ['File', 'Edit', 'View', 'Image', 'Help'], status: `${App.A.width}×${App.A.height}  ·  drag a box to zoom in`,
    });
    x.drawImage(App.A, r.content.x, r.content.y);
    img.x = r.content.x; img.y = r.content.y;
    // taskbar
    const tb = 30 * u, ty = H - tb;
    x.fillStyle = T.face; x.fillRect(0, ty, W, tb);
    x.fillStyle = T.hi; x.fillRect(0, ty + u, W, u);
    button(x, 3 * u, ty + 4 * u, 62 * u, tb - 7 * u, '', false);
    x.fillStyle = '#ff5c8a'; x.font = font(13, true); x.fillText('✦', 9 * u, ty + 20 * u);
    x.fillStyle = T.text; x.font = font(11, true); x.fillText('Start', 24 * u, ty + 19 * u);
    let bx = 72 * u;
    for (const wn of [{ title: 'my_oshi.bmp' }].concat(wins)) {
      if (bx + 110 * u > W - 80 * u) break;
      button(x, bx, ty + 4 * u, 106 * u, tb - 7 * u, '', wn === wins[wins.length - 1]);
      x.fillStyle = T.text; x.font = font(10);
      x.fillText(wn.title.slice(0, 15), bx + 6 * u, ty + 19 * u);
      bx += 110 * u;
    }
    const now = new Date();
    const clock = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    bevel(x, W - 70 * u, ty + 4 * u, 66 * u, tb - 7 * u, true);
    x.fillStyle = T.text; x.font = font(11); x.fillText(clock, W - 52 * u, ty + 19 * u);
  }

  function drawZoom(x, wn, active) {
    const cw = Math.round(wn.sw * wn.z), ch = Math.round(wn.sh * wn.z);
    if (st.callout) {
      x.save();
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = Math.max(1, u);
      x.setLineDash([2 * u, 3 * u]);
      const sx = img.x + wn.sx, sy = img.y + wn.sy;
      const fr = wn.rect ? wn.rect.frame : { x: wn.x, y: wn.y, w: cw + 10 * u, h: ch + 46 * u };
      const fx = wn.x, fy = wn.y, fw = fr.w, fh = fr.h;
      for (const [a, b] of [[[sx, sy], [fx, fy]], [[sx + wn.sw, sy], [fx + fw, fy]], [[sx, sy + wn.sh], [fx, fy + fh]], [[sx + wn.sw, sy + wn.sh], [fx + fw, fy + fh]]]) {
        x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
      }
      x.restore();
    }
    marching(x, img.x + wn.sx, img.y + wn.sy, wn.sw, wn.sh);
    const r = frame(x, wn.x, wn.y, cw, ch, wn.title, { status: `Zoom ${Math.round(wn.z * 100)}%  ·  scroll to zoom`, inactive: !active, icon: '#8bd3ff' });
    x.save();
    x.imageSmoothingEnabled = !st.pixelated;
    x.beginPath(); x.rect(r.content.x, r.content.y, cw, ch); x.clip();
    x.drawImage(App.A, wn.sx, wn.sy, wn.sw, wn.sh, r.content.x, r.content.y, cw, ch);
    x.restore();
    wn.rect = r;
  }

  function drawPopup(x, wn, active) {
    const cw = 250 * u, ch = 78 * u;
    const r = frame(x, wn.x, wn.y, cw, ch, wn.title, { closeOnly: true, inactive: !active, icon: wn.kind === 'error' ? '#ff5c5c' : '#8bd3ff' });
    // the dialog body is flat face colour, not sunken
    x.fillStyle = T.face; x.fillRect(r.content.x - 2 * u, r.content.y - 2 * u, cw + 4 * u, ch + 4 * u);
    const cx = r.content.x, cy = r.content.y;
    if (wn.kind === 'error') {
      x.fillStyle = '#e02020'; x.beginPath(); x.arc(cx + 22 * u, cy + 22 * u, 14 * u, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 3 * u;
      x.beginPath(); x.moveTo(cx + 16 * u, cy + 16 * u); x.lineTo(cx + 28 * u, cy + 28 * u);
      x.moveTo(cx + 28 * u, cy + 16 * u); x.lineTo(cx + 16 * u, cy + 28 * u); x.stroke();
      x.fillStyle = T.text; x.font = font(11);
      wrap(x, wn.text, cx + 46 * u, cy + 18 * u, cw - 54 * u, 14 * u);
      const ok = { x: cx + cw / 2 - 36 * u, y: cy + ch - 26 * u, w: 72 * u, h: 22 * u };
      button(x, ok.x, ok.y, ok.w, ok.h, 'OK', false);
      x.strokeStyle = T.text; x.setLineDash([u, u]); x.lineWidth = u;
      x.strokeRect(ok.x + 4 * u, ok.y + 4 * u, ok.w - 8 * u, ok.h - 8 * u); x.setLineDash([]);
      r.ok = ok;
    } else {
      x.fillStyle = T.text; x.font = font(11);
      x.fillText(wn.text.slice(0, 40), cx + 8 * u, cy + 18 * u);
      const pct = Math.min(99, Math.floor(((performance.now() - wn.born) / 90) % 100));
      const bar = { x: cx + 8 * u, y: cy + 30 * u, w: cw - 16 * u, h: 20 * u };
      bevel(x, bar.x, bar.y, bar.w, bar.h, true);
      x.fillStyle = '#fff'; x.fillRect(bar.x + 2 * u, bar.y + 2 * u, bar.w - 4 * u, bar.h - 4 * u);
      const blocks = Math.floor((bar.w - 6 * u) / (10 * u) * pct / 100);
      x.fillStyle = T.t1;
      for (let i = 0; i < blocks; i++) x.fillRect(bar.x + 3 * u + i * 10 * u, bar.y + 4 * u, 8 * u, bar.h - 8 * u);
      x.fillText(`${pct}% · ${Math.max(1, Math.round((100 - pct) / 9))} sec left`, cx + 8 * u, cy + 68 * u);
    }
    wn.rect = r;
  }

  function wrap(x, text, tx, ty, maxW, lh) {
    const words = text.split(' ');
    let line = '', y = ty;
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (x.measureText(test).width > maxW && line) { x.fillText(line, tx, y); line = wd; y += lh; }
      else line = test;
    }
    x.fillText(line, tx, y);
  }

  const inR = (p, r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  const tool = {
    id: 'window', name: 'Retro Window', short: 'Retro Window', icon: '▣',
    hint: 'Your picture becomes a Windows-98 desktop. Drag a box over a detail (an eye, a hair clip…) and it pops open in its own zoomed window. Drag windows by the title bar, scroll to zoom, × to close.',
    cursor: 'crosshair',

    build(box) {
      const ui = App.ui;
      ui.toggle(box, 'Desktop + taskbar around the picture', st.desktop, v => { st.desktop = v; wins = []; if (App.A) layout(); });
      ui.seg(box, 'Theme', [['classic', 'Win98 grey'], ['lilac', 'Lilac'], ['mint', 'Mint']], st.theme, v => { st.theme = v; T = THEMES[v]; });
      ui.slider(box, 'Zoom for new windows', { min: 1.5, max: 8, step: .5, value: st.zoom, format: v => v + '×' }, v => { st.zoom = v; });
      ui.toggle(box, 'Chunky pixel zoom', st.pixelated, v => { st.pixelated = v; });
      ui.toggle(box, 'Callout lines', st.callout, v => { st.callout = v; });
      ui.heading(box, 'Pop-ups');
      ui.text(box, 'Pop-up message', st.popup, v => { st.popup = v; });
      ui.buttons(box, [
        ['⚠ Error pop-up', () => addPopup('error')],
        ['▤ Progress bar', () => addPopup('progress')],
      ]);
      ui.buttons(box, [['✕ Close all windows', () => { wins = []; }]]);
    },

    onImage() { layout(); wins = []; counter = 0; },

    down(p) {
      for (let i = wins.length - 1; i >= 0; i--) {
        const wn = wins[i], r = wn.rect;
        if (!r || !inR(p, r.frame)) continue;
        wins.splice(i, 1); wins.push(wn);              // focus
        if (inR(p, r.close) || (r.ok && inR(p, r.ok))) { wins.pop(); return; }
        if (inR(p, r.title)) { drag = { wn, dx: p.x - wn.x, dy: p.y - wn.y, mode: 'move' }; return; }
        if (wn.kind === 'zoom' && inR(p, r.content)) { drag = { wn, px: p.x, py: p.y, sx: wn.sx, sy: wn.sy, mode: 'pan' }; App.canvas.style.cursor = 'grabbing'; }
        return;
      }
      if (inR(p, img)) sel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    },
    move(p) {
      if (drag && drag.mode === 'move') { drag.wn.x = p.x - drag.dx; drag.wn.y = p.y - drag.dy; clampWin(drag.wn); return; }
      if (drag && drag.mode === 'pan') {
        const wn = drag.wn;
        wn.sx = App.clamp(drag.sx - (p.x - drag.px) / wn.z, 0, App.A.width - wn.sw);
        wn.sy = App.clamp(drag.sy - (p.y - drag.py) / wn.z, 0, App.A.height - wn.sh);
        return;
      }
      if (sel) { sel.x1 = App.clamp(p.x, img.x, img.x + img.w); sel.y1 = App.clamp(p.y, img.y, img.y + img.h); return; }
      let cur = inR(p, img) ? 'crosshair' : 'default';
      for (let i = wins.length - 1; i >= 0; i--) {
        const r = wins[i].rect;
        if (r && inR(p, r.frame)) { cur = inR(p, r.title) ? 'move' : (wins[i].kind === 'zoom' && inR(p, r.content) ? 'grab' : 'default'); break; }
      }
      App.canvas.style.cursor = cur;
    },
    up() {
      if (sel) {
        const x0 = Math.min(sel.x0, sel.x1) - img.x, y0 = Math.min(sel.y0, sel.y1) - img.y;
        const sw = Math.abs(sel.x1 - sel.x0), sh = Math.abs(sel.y1 - sel.y0);
        if (sw > 10 && sh > 10) addZoom(x0, y0, sw, sh);
        sel = null;
      }
      drag = null;
    },
    wheel(p, e) {
      for (let i = wins.length - 1; i >= 0; i--) {
        const wn = wins[i];
        if (wn.kind === 'zoom' && wn.rect && inR(p, wn.rect.frame)) {
          const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
          const nz = App.clamp(wn.z * f, 1, 12);
          if (wn.sw * nz < W * .8 && wn.sh * nz < H * .8) wn.z = nz;
          return;
        }
      }
      return false;
    },

    frame() {
      if (!App.A) return;
      ants = (ants + .5) % (8 * u);
      const x = App.ctx;
      x.imageSmoothingEnabled = true;
      drawDesktop(x);
      wins.forEach((wn, i) => {
        const active = i === wins.length - 1;
        if (wn.kind === 'zoom') drawZoom(x, wn, active); else drawPopup(x, wn, active);
      });
      if (sel) marching(x, Math.min(sel.x0, sel.x1), Math.min(sel.y0, sel.y1), Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0));
    },
  };

  App.register(tool);
})();
