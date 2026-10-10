/* Shared pieces for the OC merch simulators (sticker, acrylic charm, badge):
   die-cutting the picture, choosing a character with the AI cutter, real
   perspective warping, and an orthographic "turn this flat thing" transform. */
(function () {
  'use strict';

  const M = window.Merch = {};

  // Bounding box of a mask's opaque pixels, grown by `padFrac` of its size.
  M.bounds = function (mask, padFrac) {
    const w = mask.width, h = mask.height;
    const d = mask.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 <= x0 || y1 <= y0) return null;
    const px = (x1 - x0) * (padFrac || 0), py = (y1 - y0) * (padFrac || 0);
    x0 = Math.max(0, x0 - px); y0 = Math.max(0, y0 - py);
    return { x: x0, y: y0, w: Math.min(w, x1 + px) - x0, h: Math.min(h, y1 + py) - y0 };
  };

  M.SHAPES = [['rounded', 'Rounded square'], ['circle', 'Circle / oval'], ['heart', '♥ Heart'], ['star', '★ Star'],
    ['sparkle', '✦ Sparkle'], ['flower', '✿ Flower'], ['subject', '✨ AI: cut around the character']];

  M.shapePath = function (x, shape, px, py, w, h) {
    const cx = px + w / 2, cy = py + h / 2, r = Math.min(w, h) / 2;
    if (shape === 'circle') { x.beginPath(); x.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); }
    else if (shape === 'rounded' || shape === 'subject' || !Shapes[shape]) { x.beginPath(); App.roundRect(x, px, py, w, h, Math.min(w, h) * .12); }
    else Shapes.trace(x, shape, cx, cy, r * (shape === 'heart' ? 1 : 1.05), 0);
  };

  /* Die-cut the current picture.
     opts: shape, border (px), subject ({mask, crop} from the AI picker, or null),
           maxW / maxH (art size), pad (empty space around the cut, px)
     Returns a "kit": canvases all the same size —
       art  (picture clipped to the cut), mask (the cut), sil (cut grown by the border),
       ring (just the border), plus w, h. */
  M.cut = function (opts) {
    const A = App.A;
    const subj = opts.shape === 'subject' && opts.subject;
    const cr = (subj && subj.crop) || { x: 0, y: 0, w: A.width, h: A.height };
    const s = Math.min(opts.maxW / cr.w, opts.maxH / cr.h);
    const aw = Math.round(cr.w * s), ah = Math.round(cr.h * s);
    const pad = Math.round(opts.pad + opts.border);
    const w = aw + pad * 2, h = ah + pad * 2;

    const mask = App.makeCanvas(w, h), mx = mask.getContext('2d');
    if (subj) mx.drawImage(subj.mask, cr.x, cr.y, cr.w, cr.h, pad, pad, aw, ah);
    else { mx.fillStyle = '#fff'; M.shapePath(mx, opts.shape, pad, pad, aw, ah); mx.fill(); }

    const art = App.makeCanvas(w, h), ax = art.getContext('2d');
    ax.imageSmoothingQuality = 'high';
    ax.drawImage(A, cr.x, cr.y, cr.w, cr.h, pad, pad, aw, ah);
    ax.globalCompositeOperation = 'destination-in';
    ax.drawImage(mask, 0, 0);

    const sil = App.silhouette(mask, opts.border);
    const ring = App.makeCanvas(w, h), rx = ring.getContext('2d');
    rx.drawImage(sil, 0, 0);
    rx.globalCompositeOperation = 'destination-out';
    rx.drawImage(mask, 0, 0);
    return { w, h, art, mask, sil, ring };
  };

  /* The "click your character" step. Shows the picture, waits for a click,
     and resolves with {mask, crop} from the AI cutter (or null). */
  M.picker = function () {
    let place = null, busy = false;
    return {
      draw(x, CW, CH, dark) {
        const A = App.A;
        const s = Math.min(CW * .9 / A.width, CH * .8 / A.height);
        place = { x: (CW - A.width * s) / 2, y: (CH - A.height * s) / 2 - 20, s };
        x.drawImage(A, place.x, place.y, A.width * s, A.height * s);
        x.font = '700 30px "Zen Maru Gothic", sans-serif'; x.textAlign = 'center';
        x.fillStyle = dark ? '#fff' : '#2a2533';
        x.fillText('✨ click the character to cut around it', CW / 2, CH - 34);
        x.textAlign = 'start';
      },
      async click(p) {
        if (busy || !place) return null;
        const ix = (p.x - place.x) / place.s, iy = (p.y - place.y) / place.s;
        if (ix < 0 || iy < 0 || ix > App.A.width || iy > App.A.height) return null;
        busy = true;
        App.busy('Cutting around the character…');
        try {
          const m = await App.segmentAt(App.A, ix, iy);
          return { mask: m, crop: M.bounds(m, .04) };
        } catch (err) {
          console.error(err);
          App.toast('The AI cutter could not load (offline?). Pick a shape instead.', 5000);
          return null;
        } finally { App.busy(false); busy = false; }
      },
    };
  };

  /* ---------- perspective warp with many small affine triangles ---------- */
  const FOCAL = 2100;
  M.project = function (px, py, cx, cy, rx, ry, z) {
    const u = px - cx, v = py - cy;
    const x1 = u * Math.cos(ry), z1 = -u * Math.sin(ry);
    const y2 = v * Math.cos(rx) - z1 * Math.sin(rx), z2 = v * Math.sin(rx) + z1 * Math.cos(rx) + z;
    const k = FOCAL / (FOCAL + z2);
    return [cx + x1 * k, cy + y2 * k];
  };

  // Inverse of project(): which point on the flat object is under screen point (X, Y)?
  M.unproject = function (X, Y, cx, cy, rx, ry, z) {
    let u = X, v = Y;
    for (let i = 0; i < 8; i++) {
      const p = M.project(u, v, cx, cy, rx, ry, z);
      const pu = M.project(u + 1, v, cx, cy, rx, ry, z), pv = M.project(u, v + 1, cx, cy, rx, ry, z);
      const a = pu[0] - p[0], b = pv[0] - p[0], c = pu[1] - p[1], d = pv[1] - p[1];
      const det = a * d - b * c;
      if (!det) break;
      const ex = X - p[0], ey = Y - p[1];
      u += (d * ex - b * ey) / det; v += (a * ey - c * ex) / det;
    }
    return [u, v];
  };

  function tri(x, src, s0, s1, s2, d0, d1, d2, gp) {
    const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (!den) return;
    const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
    const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
    const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
    const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
    const e = d0[0] - a * s0[0] - c * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
    // grow the clip a little so neighbouring triangles overlap (no seams)
    const mx = (d0[0] + d1[0] + d2[0]) / 3, my = (d0[1] + d1[1] + d2[1]) / 3;
    const grow = q => { const dx = q[0] - mx, dy = q[1] - my, l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * gp, q[1] + dy / l * gp]; };
    const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);
    x.save();
    x.beginPath(); x.moveTo(g0[0], g0[1]); x.lineTo(g1[0], g1[1]); x.lineTo(g2[0], g2[1]); x.closePath();
    x.clip();
    x.transform(a, b, c, d, e, f);
    const sx = Math.max(0, Math.floor(Math.min(s0[0], s1[0], s2[0])) - 2), sy = Math.max(0, Math.floor(Math.min(s0[1], s1[1], s2[1])) - 2);
    const ex = Math.min(src.width, Math.ceil(Math.max(s0[0], s1[0], s2[0])) + 2), ey = Math.min(src.height, Math.ceil(Math.max(s0[1], s1[1], s2[1])) + 2);
    if (ex > sx && ey > sy) x.drawImage(src, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
    x.restore();
  }

  // Draw the `rect` part of `src` turned by rx/ry around (cx, cy), pushed toward
  // the viewer by -z, then shifted by (dx, dy). Coordinates are src pixels.
  M.warp = function (x, src, rect, cx, cy, rx, ry, z, dx, dy, alpha, gp) {
    gp = gp || 3;
    x.globalAlpha = alpha == null ? 1 : alpha;
    if (Math.abs(rx) + Math.abs(ry) < .002 && !z) {
      x.drawImage(src, rect.x, rect.y, rect.w, rect.h, rect.x + dx, rect.y + dy, rect.w, rect.h);
      x.globalAlpha = 1;
      return;
    }
    const N = 12, Mv = 10, P = [];
    for (let j = 0; j <= Mv; j++) for (let i = 0; i <= N; i++) {
      const sx = rect.x + rect.w * i / N, sy = rect.y + rect.h * j / Mv;
      const q = M.project(sx, sy, cx, cy, rx, ry, z);
      P.push({ s: [sx, sy], d: [q[0] + dx, q[1] + dy] });
    }
    for (let j = 0; j < Mv; j++) for (let i = 0; i < N; i++) {
      const p00 = P[j * (N + 1) + i], p10 = P[j * (N + 1) + i + 1], p01 = P[(j + 1) * (N + 1) + i], p11 = P[(j + 1) * (N + 1) + i + 1];
      tri(x, src, p00.s, p10.s, p11.s, p00.d, p10.d, p11.d, gp);
      tri(x, src, p00.s, p11.s, p01.s, p00.d, p11.d, p01.d, gp);
    }
    x.globalAlpha = 1;
  };

  /* ---------- orthographic turn (cheap, exact for flat objects) ----------
     Turning a flat object by ry (around the vertical axis) then rx (around the
     horizontal axis) is the affine matrix below; `depth` is where a point
     `z` in front of the face moves on screen, used to stack layers into thickness. */
  M.turn = function (rx, ry) {
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    return {
      m: [cy, sy * sx, 0, cx],            // canvas transform(a, b, c, d)
      depth: [sy, -cy * sx],              // screen offset per unit of z
      facing: cy * cx > 0,                // looking at the front?
    };
  };

  /* ---------- shared look helpers ---------- */
  M.rainbow = function (x, w, h, shift, light) {
    const g = x.createLinearGradient(-w * .2 + shift, -h * .2, w * 1.2 + shift, h * 1.2);
    const hues = [0, 40, 70, 140, 190, 230, 280, 320, 360, 40, 70, 140, 190, 230, 280, 330];
    hues.forEach((hh, i) => g.addColorStop(i / (hues.length - 1), `hsl(${hh},100%,${light || 66}%)`));
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  };

  // a sprinkle of points inside a mask, for glitter that twinkles as the object turns
  M.glitterPoints = function (mask, n, seed) {
    const w = mask.width, h = mask.height;
    const d = mask.getContext('2d').getImageData(0, 0, w, h).data;
    const r = App.rng(seed || 5), pts = [];
    for (let t = 0; t < n * 20 && pts.length < n; t++) {
      const x = r() * w | 0, y = r() * h | 0;
      if (d[(y * w + x) * 4 + 3] > 200) pts.push({ x, y, ph: r() * Math.PI * 2, s: 2 + r() * 6, k: 4 + r() * 6 });
    }
    return pts;
  };

  M.drawGlitter = function (x, pts, rx, ry, t, scale) {
    x.save();
    x.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const b = Math.pow(Math.max(0, Math.cos(p.ph + ry * p.k + rx * (p.k * .7) + t / 1800)), 18);
      if (b < .05) continue;
      x.globalAlpha = b;
      x.fillStyle = b > .6 ? '#fff' : `hsl(${(p.ph * 57) % 360},100%,80%)`;
      Shapes.trace(x, 'sparkle', p.x, p.y, p.s * (scale || 1) * (.6 + b), 0); x.fill();
    }
    x.restore();
  };

  // A hidden file picker behind a button; calls back with a working canvas.
  M.fileButton = function (parent, label, onCanvas) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
    input.addEventListener('change', () => {
      const f = input.files[0];
      input.value = '';
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = App.makeCanvas(img.naturalWidth * s, img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        onCanvas(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); App.toast('Could not read that picture.'); };
      img.src = url;
    });
    parent.append(input);
    App.ui.buttons(parent, [[label, () => input.click()]]);
  };
})();
