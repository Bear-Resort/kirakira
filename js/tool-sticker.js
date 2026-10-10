/* ❖ Holo Sticker — a die-cut holographic vinyl sticker with glossy UV laminate.
   1. It sits on its backing sheet: drag the table to turn it in 3D, the foil shifts.
   2. Drag across the sticker to peel it — the fold follows your hand, and it stays
      half-peeled wherever you let go. Peel it nearly all the way and it pops free.
   3. Click and paste it onto a notebook, a laptop, a journal, a corkboard or your
      own background picture — and keep pasting. */
(function () {
  'use strict';
  const CW = 1400, CH = 1050;

  const st = {
    cut: 'rounded', border: 24, material: 'holo', pattern: 'stars', foil: 60, laminate: 'gloss',
    surface: 'notebook', size: 34, randomTilt: true,
  };

  let kit = null;               // the current sticker design (see makeKit)
  let subject = null;           // {mask, crop} from the AI picker
  let mode = 'sheet';           // 'pick' | 'sheet' | 'paste'
  const picker = Merch.picker();
  // stuck (maybe half-peeled) → lifting → free
  const anim = { phase: 'stuck', t: 0, lift: 0, from: null, auto: false };
  let fold = null;              // the peel: G = where it started at the edge, P = where that point is now
  const rot = { x: 0, y: 0, tx: 0, ty: 0 };
  let press = null, lastT = 0;
  let placed = [];              // pasted stickers: {kit, x, y, s, r}
  let holdRot = 0;              // rotation of the sticker waiting on the cursor
  let customBg = null, surfaceCache = null, surfaceKey = '';
  const ui = {};

  /* ---------- the sticker design ---------- */
  function buildPattern(k) {
    const p = App.makeCanvas(k.w, k.h), x = p.getContext('2d');
    const r = App.rng(42);
    const area = k.w * k.h / (1400 * 1050);
    x.fillStyle = '#fff';
    if (st.pattern === 'stars') {
      for (let i = 0; i < 300 * area; i++) {
        x.globalAlpha = .4 + r() * .6;
        Shapes.trace(x, r() < .7 ? 'sparkle' : 'star', r() * k.w, r() * k.h, 6 + r() * 22, r()); x.fill();
      }
    } else if (st.pattern === 'shards') {
      for (let i = 0; i < 480 * area; i++) {
        x.globalAlpha = r() * .9;
        const cx = r() * k.w, cy = r() * k.h, s = 14 + r() * 50;
        x.beginPath();
        for (let j = 0; j < 3 + (r() * 3 | 0); j++) {
          const a = j / 5 * Math.PI * 2 + r(), d = s * (.4 + r() * .6);
          x[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        }
        x.fill();
      }
    } else if (st.pattern === 'hearts') {
      for (let yy = 0, j = 0; yy < k.h + 60; yy += 60, j++) for (let xx = (j % 2) * 30; xx < k.w + 60; xx += 60) {
        x.globalAlpha = .55 + r() * .45; Shapes.trace(x, 'heart', xx, yy, 13, 0); x.fill();
      }
    } else { x.fillRect(0, 0, k.w, k.h); }
    k.pattern = p;
  }

  function makeKit() {
    const k = Merch.cut({ shape: st.cut, border: st.border, subject, maxW: CW * .62, maxH: CH * .66, pad: 230 });
    // printed sticker = white border + art
    k.S = App.makeCanvas(k.w, k.h);
    const x = k.S.getContext('2d');
    x.drawImage(k.sil, 0, 0);
    x.drawImage(k.art, 0, 0);
    k.material = st.material; k.laminate = st.laminate; k.foilAmt = st.foil;
    buildPattern(k);
    for (const n of ['comp', 'tmp', 'foil', 'flap']) k[n] = App.makeCanvas(k.w, k.h);
    k.shadowSolid = App.silhouette(k.sil, 0, '#000');
    k.shadowSoft = App.blurred(App.silhouette(k.sil, 0, 'rgba(0,0,0,.6)'), 4);
    k.shadowSmall = App.makeCanvas(k.w / 6, k.h / 6);
    // reach toward the bottom-right (where it peels) and the sticker's box
    const d = k.sil.getContext('2d').getImageData(0, 0, k.w, k.h).data;
    let x0 = k.w, y0 = k.h, x1 = 0, y1 = 0;
    k.cornerSum = 0; k.minSum = 1e9; k.samples = [];
    for (let yy = 0; yy < k.h; yy += 2) for (let xx = 0; xx < k.w; xx += 2) {
      if (d[(yy * k.w + xx) * 4 + 3] <= 128) continue;
      if (xx + yy > k.cornerSum) k.cornerSum = xx + yy;
      if (xx + yy < k.minSum) k.minSum = xx + yy;
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      if (xx + yy === k.cornerSum) k.cornerPt = [xx, yy];
      if (xx % 10 === 0 && yy % 10 === 0) k.samples.push([xx, yy]);
    }
    k.silData = d;
    const m = 54;
    k.box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    k.liner = { x: Math.max(0, x0 - m), y: Math.max(0, y0 - m) };
    k.liner.w = Math.min(k.w, x1 + m) - k.liner.x;
    k.liner.h = Math.min(k.h, y1 + m) - k.liner.y;
    buildLiner(k);
    return k;
  }

  // the glossy backing sheet, with the die-cut knife line pressed into it
  function buildLiner(k) {
    const r = k.liner;
    const c = App.makeCanvas(k.w, k.h), x = c.getContext('2d');
    x.beginPath(); App.roundRect(x, r.x, r.y, r.w, r.h, 26);
    const g = x.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    g.addColorStop(0, '#fbfaf7'); g.addColorStop(1, '#e6e3dc');
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    x.strokeStyle = 'rgba(0,0,0,.05)'; x.lineWidth = 1;
    for (let i = r.x; i < r.x + r.w + r.h; i += 14) { x.beginPath(); x.moveTo(i, r.y); x.lineTo(i - r.h, r.y + r.h); x.stroke(); }
    x.restore();
    x.drawImage(App.silhouette(k.sil, 0, 'rgba(255,255,255,.7)'), 0, 0);
    const ring = App.silhouette(k.sil, 2, 'rgba(70,60,80,.35)');
    const rc = ring.getContext('2d');
    rc.globalCompositeOperation = 'destination-out'; rc.drawImage(k.sil, 0, 0);
    x.drawImage(ring, 0, 0);
    x.fillStyle = 'rgba(60,50,70,.45)'; x.font = '20px "DotGothic16", monospace'; x.textAlign = 'right';
    x.fillText('✦ PEEL HERE ↘', r.x + r.w - 20, r.y + r.h - 16);
    k.linerC = c;
  }

  function rebuild() {
    if (!App.A) return;
    kit = makeKit();
    resetPeel();
    if (mode === 'paste') mode = 'sheet';
  }

  /* ---------- foil, shine and peel for one frame ---------- */
  function masked(k, src, maskC) {
    const t = k.tmp.getContext('2d');
    t.globalCompositeOperation = 'copy'; t.drawImage(src, 0, 0);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(maskC, 0, 0);
    t.globalCompositeOperation = 'source-over';
    return k.tmp;
  }

  function render(k, tx, ty, t, f0) {
    const c = k.comp.getContext('2d'), f = k.foil.getContext('2d');  // f = scratch for foil & shine
    const W = k.w, H = k.h;
    c.globalCompositeOperation = 'copy'; c.drawImage(k.S, 0, 0); c.globalCompositeOperation = 'source-over';
    const amt = k.foilAmt / 100;
    if (k.material !== 'vinyl') {
      f.clearRect(0, 0, W, H);
      const light = k.material === 'chrome' ? 82 : 66;
      Merch.rainbow(f, W, H, tx * W * .9 + ty * H * .5, light);
      if (st.pattern !== 'smooth') {
        f.globalCompositeOperation = 'destination-in'; f.drawImage(k.pattern, 0, 0);
        f.globalCompositeOperation = 'destination-over'; f.globalAlpha = .55;
        Merch.rainbow(f, W, H, -tx * W * .6 + W * .3, light);
        f.globalAlpha = 1; f.globalCompositeOperation = 'source-over';
      }
      if (k.material === 'glitter') {
        const r = App.rng((t / 120) | 0);
        f.fillStyle = '#fff';
        for (let i = 0; i < 700; i++) { f.globalAlpha = r(); f.fillRect(r() * W, r() * H, 2.5, 2.5); }
        f.globalAlpha = 1;
      }
      c.save();
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = .35 + amt * .6;
      c.drawImage(masked(k, k.foil, k.ring), 0, 0);
      c.globalCompositeOperation = k.material === 'chrome' ? 'overlay' : 'screen'; c.globalAlpha = amt * .55;
      c.drawImage(masked(k, k.foil, k.sil), 0, 0);
      c.restore();
    }
    // UV laminate shine
    const gx = W * (.5 + tx * .9), gy = H * (.5 + ty * .9);
    const band = c.createLinearGradient(gx - W * .35, gy - H * .35, gx + W * .35, gy + H * .35);
    const glossy = k.laminate === 'gloss';
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(.42, 'rgba(255,255,255,0)');
    band.addColorStop(.5, `rgba(255,255,255,${glossy ? .55 : .14})`);
    band.addColorStop(.56, `rgba(255,255,255,${glossy ? .08 : .1})`);
    band.addColorStop(.62, `rgba(255,255,255,${glossy ? .22 : .06})`);
    band.addColorStop(.7, 'rgba(255,255,255,0)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    f.clearRect(0, 0, W, H); f.fillStyle = band; f.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'screen'; c.drawImage(masked(k, k.foil, k.sil), 0, 0); c.restore();
    if (f0) peel(k, c, f0);
    return k.comp;
  }

  /* ---------- peeling by hand ----------
     Peeling paper is folding it: the point you pulled from (G) has moved to P, so the
     crease is the perpendicular bisector of G→P. Everything on G's side of the crease
     is lifted and mirrored across it, showing the pale backing side. */
  function foldGeo(fd) {
    const dx = fd.P[0] - fd.G[0], dy = fd.P[1] - fd.G[1], L = Math.hypot(dx, dy);
    if (L < 1) return null;
    return { nx: dx / L, ny: dy / L, mx: (fd.G[0] + fd.P[0]) / 2, my: (fd.G[1] + fd.P[1]) / 2, L };
  }
  const sideOf = (g, q) => (q[0] - g.mx) * g.nx + (q[1] - g.my) * g.ny;
  const reflect = (g, q) => { const s = sideOf(g, q); return [q[0] - 2 * s * g.nx, q[1] - 2 * s * g.ny]; };
  const alphaAt = (k, q) => {
    const x = Math.round(q[0]), y = Math.round(q[1]);
    return x < 0 || y < 0 || x >= k.w || y >= k.h ? 0 : k.silData[(y * k.w + x) * 4 + 3];
  };

  function peel(k, c, fd) {
    const g = foldGeo(fd);
    if (!g) return;
    const B = (k.w + k.h) * 2, ux = -g.ny, uy = g.nx;
    // the half of the plane on G's side of the crease
    const region = new Path2D();
    region.moveTo(g.mx + ux * B, g.my + uy * B); region.lineTo(g.mx - ux * B, g.my - uy * B);
    region.lineTo(g.mx - ux * B - g.nx * B, g.my - uy * B - g.ny * B); region.lineTo(g.mx + ux * B - g.nx * B, g.my + uy * B - g.ny * B);
    region.closePath();
    const fx = k.flap.getContext('2d');
    fx.globalCompositeOperation = 'source-over';
    fx.clearRect(0, 0, k.w, k.h);
    fx.save(); fx.clip(region); fx.drawImage(k.sil, 0, 0); fx.restore();
    c.save(); c.globalCompositeOperation = 'destination-out'; c.fill(region); c.restore();
    // backing side of the flap: shadowed right at the curl, a bright band, then soft grey
    const R = Math.max(140, g.L * .9);
    fx.globalCompositeOperation = 'source-in';
    const gr = fx.createLinearGradient(g.mx, g.my, g.mx - g.nx * R, g.my - g.ny * R);
    gr.addColorStop(0, '#a6a6b0'); gr.addColorStop(.1, '#e6e6ec'); gr.addColorStop(.28, '#fbfbfd'); gr.addColorStop(1, '#d2d2d9');
    fx.fillStyle = gr; fx.fillRect(0, 0, k.w, k.h);
    fx.globalCompositeOperation = 'source-over';
    const d = g.mx * g.nx + g.my * g.ny;
    c.save();
    c.setTransform(1 - 2 * g.nx * g.nx, -2 * g.nx * g.ny, -2 * g.nx * g.ny, 1 - 2 * g.ny * g.ny, 2 * d * g.nx, 2 * d * g.ny);
    c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 18; c.shadowOffsetX = g.nx * 10; c.shadowOffsetY = g.ny * 10 + 4;
    c.drawImage(k.flap, 0, 0);
    c.restore();
  }

  // how much of the sticker is still stuck down (0…1)
  function stuckFraction(fd) {
    const g = fd && foldGeo(fd);
    if (!g) return 1;
    let n = 0;
    for (const q of kit.samples) if (sideOf(g, q) >= 0) n++;
    return n / kit.samples.length;
  }

  // is this kit-space point on the sticker (the stuck part or the folded flap)?
  function onSticker(q) {
    const g = fold && foldGeo(fold);
    if (!g) return alphaAt(kit, q) > 128;
    if (sideOf(g, q) < 0) return false;
    return alphaAt(kit, q) > 128 || alphaAt(kit, reflect(g, q)) > 128;
  }

  // walk from q in direction (dx, dy) to the sticker's outline
  function edgeFrom(q, dx, dy) {
    let p = q.slice();
    for (let i = 0; i < 600; i++) {
      const n = [p[0] + dx * 3, p[1] + dy * 3];
      if (alphaAt(kit, n) <= 128) break;
      p = n;
    }
    return p;
  }

  function toKit(p) {
    const r = kit.liner;
    return Merch.unproject(p.x - (CW - kit.w) / 2, p.y - (CH - kit.h) / 2, r.x + r.w / 2, r.y + r.h / 2, rot.x, rot.y, 0);
  }

  function checkFinished() {
    if (fold && stuckFraction(fold) < (press ? .12 : .3)) {
      anim.phase = 'lifting'; anim.t = 0; anim.auto = false;
      anim.from = { G: fold.G.slice(), P: fold.P.slice() };
      press = null;
    }
  }

  function resetPeel() {
    fold = null;
    anim.phase = 'stuck'; anim.t = 0; anim.lift = 0; anim.auto = false; anim.from = null;
  }

  /* ---------- 1–2: on the backing sheet ---------- */
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function step(dt) {
    const a = anim;
    if (a.phase === 'stuck' && a.auto) {
      // "Peel it all": pull from the bottom-right corner toward the top-left
      if (!fold) { const c = kit.cornerPt || [kit.w - 80, kit.h - 80]; fold = { G: [c[0] - 4, c[1] - 4], P: [c[0] - 4, c[1] - 4] }; }
      fold.P[0] -= dt * .55; fold.P[1] -= dt * .5;
      checkFinished();
    } else if (a.phase === 'lifting') {
      // the curled flap springs flat as the sticker pops free
      a.t = Math.min(1, a.t + dt / 450);
      const e = ease(a.t);
      fold = { G: a.from.G, P: [App.lerp(a.from.P[0], a.from.G[0], e), App.lerp(a.from.P[1], a.from.G[1], e)] };
      a.lift = e;
      if (a.t >= 1) { a.phase = 'free'; a.lift = 1; fold = null; }
    }
  }

  function table(x) {
    x.fillStyle = '#151515'; x.fillRect(0, 0, CW, CH);
    const v = x.createRadialGradient(CW / 2, CH / 2, 100, CW / 2, CH / 2, CW * .7);
    v.addColorStop(0, 'rgba(255,255,255,.06)'); v.addColorStop(1, 'rgba(0,0,0,.4)');
    x.fillStyle = v; x.fillRect(0, 0, CW, CH);
  }

  function drawSheet(x, t) {
    const k = kit, L = anim.lift;
    const bob = Math.sin(t / 650) * 8 * L;
    const lrx = rot.x * (1 - .65 * L), lry = rot.y * (1 - .65 * L);
    const srx = rot.x + Math.sin(t / 900) * .06 * L, sry = rot.y + Math.cos(t / 1100) * .08 * L;
    const comp = render(k, sry / .9, srx / .9, t, fold);
    const r = k.liner, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    x.save();
    x.translate((CW - k.w) / 2, (CH - k.h) / 2);
    // the sheet's shadow on the table
    const P = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(q => Merch.project(q[0], q[1], cx, cy, lrx, lry, 0));
    x.save();
    x.fillStyle = 'rgba(0,0,0,.5)'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 30; x.shadowOffsetY = 18;
    x.beginPath(); P.forEach((q, i) => x[i ? 'lineTo' : 'moveTo'](q[0], q[1])); x.closePath(); x.fill();
    x.restore();
    Merch.warp(x, k.linerC, r, cx, cy, lrx, lry, 0, 0, 0);
    if (L > 0) {
      // opaque silhouette warped small, then stretched = soft shadow without seams
      const sx = k.shadowSmall.getContext('2d');
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, k.shadowSmall.width, k.shadowSmall.height);
      sx.setTransform(1 / 6, 0, 0, 1 / 6, 0, 0);
      Merch.warp(sx, k.shadowSolid, r, cx, cy, lrx, lry, 0, 26 * L, 46 * L, 1, 18);
      x.save(); x.globalAlpha = .5 * L; x.drawImage(k.shadowSmall, 0, 0, k.w, k.h); x.restore();
    }
    Merch.warp(x, comp, { x: 0, y: 0, w: k.w, h: k.h }, cx, cy, srx, sry, -170 * L, 0, -36 * L + bob);
    x.restore();
    const msg = anim.phase === 'free' ? 'drag to turn it · click to paste it somewhere ✦'
      : anim.phase !== 'stuck' ? ''
      : fold ? 'keep dragging to tear it off · drag back to press it down · let go to leave it half-peeled'
      : 'drag across the sticker to peel it · drag the dark table to turn it';
    if (msg) {
      x.font = '18px "DotGothic16", monospace'; x.fillStyle = 'rgba(255,255,255,.5)'; x.textAlign = 'center';
      x.fillText(msg, CW / 2, CH - 22); x.textAlign = 'start';
    }
  }

  /* ---------- 3: pasting ---------- */
  function buildSurface() {
    const key = st.surface + (st.surface === 'custom' && customBg ? customBg.width + 'x' + customBg.height : '') + (st.surface === 'pictureB' && App.B ? App.B.width : '');
    if (surfaceCache && key === surfaceKey) return surfaceCache;
    surfaceKey = key;
    const c = App.makeCanvas(CW, CH), x = c.getContext('2d');
    const r = App.rng(8);
    const speckle = (col, n, max) => { x.fillStyle = col; for (let i = 0; i < n; i++) { x.globalAlpha = r() * .5; x.fillRect(r() * CW, r() * CH, r() * max + .5, r() * max + .5); } x.globalAlpha = 1; };
    const s = st.surface;
    if ((s === 'custom' && customBg) || (s === 'pictureB' && App.B)) {
      x.drawImage(App.coverInto(s === 'custom' ? customBg : App.B, CW, CH), 0, 0);
    } else if (s === 'laptop') {
      x.fillStyle = '#1b1c20'; x.fillRect(0, 0, CW, CH);
      x.beginPath(); App.roundRect(x, 70, 50, CW - 140, CH - 100, 36);
      const g = x.createLinearGradient(0, 50, CW, CH);
      g.addColorStop(0, '#cfd3da'); g.addColorStop(.5, '#b5bac3'); g.addColorStop(1, '#9ea4ae');
      x.fillStyle = g; x.fill();
      x.save(); x.clip();
      x.globalAlpha = .06; x.strokeStyle = '#fff';
      for (let i = 0; i < CH; i += 3) { x.beginPath(); x.moveTo(0, i); x.lineTo(CW, i + r() * 2); x.stroke(); }
      x.restore();
      x.globalAlpha = .18; x.fillStyle = '#fff';
      Shapes.trace(x, 'sparkle', CW / 2, CH / 2, 46, 0); x.fill();
      x.globalAlpha = 1;
    } else if (s === 'journal') {
      x.fillStyle = '#2b2321'; x.fillRect(0, 0, CW, CH);
      x.fillStyle = '#b8895a'; x.beginPath(); App.roundRect(x, 120, 40, CW - 240, CH - 80, 18); x.fill();
      speckle('#7a5532', 4000, 3); speckle('#e1c39b', 2500, 2);
      x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(120, 40, 26, CH - 80);
      x.fillStyle = '#2f2a3a'; x.fillRect(CW - 300, 40, 26, CH - 80);   // elastic band
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(CW - 296, 40, 5, CH - 80);
    } else if (s === 'cork') {
      x.fillStyle = '#c99b63'; x.fillRect(0, 0, CW, CH);
      for (let i = 0; i < 9000; i++) {
        x.fillStyle = r() < .5 ? 'rgba(120,80,40,.35)' : 'rgba(240,210,160,.35)';
        x.beginPath(); x.arc(r() * CW, r() * CH, r() * 3 + .5, 0, Math.PI * 2); x.fill();
      }
      x.strokeStyle = '#8a5a2b'; x.lineWidth = 34; x.strokeRect(17, 17, CW - 34, CH - 34);
    } else if (s === 'bottle') {
      const g = x.createLinearGradient(0, 0, CW, 0);
      g.addColorStop(0, '#7fb8d6'); g.addColorStop(.25, '#cbe9f6'); g.addColorStop(.32, '#ffffff');
      g.addColorStop(.42, '#a9d6ea'); g.addColorStop(.85, '#5f9cbd'); g.addColorStop(1, '#3d7393');
      x.fillStyle = g; x.fillRect(0, 0, CW, CH);
    } else {
      // notebook page
      x.fillStyle = '#fdfaf2'; x.fillRect(0, 0, CW, CH);
      speckle('#c9bba0', 2200, 2);
      x.strokeStyle = 'rgba(90,140,210,.38)'; x.lineWidth = 2;
      for (let y = 110; y < CH; y += 40) { x.beginPath(); x.moveTo(0, y); x.lineTo(CW, y); x.stroke(); }
      x.strokeStyle = 'rgba(230,80,90,.55)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(120, 0); x.lineTo(120, CH); x.stroke();
      for (let y = 60; y < CH; y += 80) {
        x.fillStyle = '#ddd5c4'; x.beginPath(); x.arc(52, y, 16, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#8c8f96'; x.lineWidth = 6; x.beginPath(); x.arc(30, y, 24, -1.2, 1.2); x.stroke();
      }
      x.font = '600 52px "Caveat", cursive'; x.fillStyle = 'rgba(58,42,79,.75)';
      x.fillText('my oc collection ♡', 160, 92);
    }
    surfaceCache = c;
    return c;
  }

  function drawPlaced(x, k, comp, p, lifted) {
    const cx = k.box.x + k.box.w / 2, cy = k.box.y + k.box.h / 2;
    x.save();
    x.translate(p.x, p.y); x.rotate(p.r); x.scale(p.s, p.s); x.translate(-cx, -cy);
    x.globalAlpha = lifted ? .55 : .7;
    const off = lifted ? 22 : 3;
    x.drawImage(k.shadowSoft, off / p.s * .6, off / p.s);
    x.globalAlpha = 1;
    if (lifted) { x.translate(cx, cy); x.scale(1.04, 1.04); x.translate(-cx, -cy); }
    x.drawImage(comp, 0, 0);
    x.restore();
  }

  function drawPaste(x, t) {
    x.drawImage(buildSurface(), 0, 0);
    // foil shimmer follows the mouse across the whole board
    const tx = App.pointer.inside ? (App.pointer.x / CW - .5) * 1.4 : Math.sin(t / 1500) * .5;
    const ty = App.pointer.inside ? (App.pointer.y / CH - .5) * 1.4 : Math.cos(t / 1900) * .4;
    const comps = new Map();
    const compFor = k => { if (!comps.has(k)) comps.set(k, render(k, tx, ty, t, 0)); return comps.get(k); };
    for (const p of placed) drawPlaced(x, p.kit, compFor(p.kit), p, false);
    if (App.pointer.inside) {
      drawPlaced(x, kit, compFor(kit), { x: App.pointer.x, y: App.pointer.y, s: st.size / 100, r: holdRot }, true);
    }
    if (!placed.length) {
      x.font = '20px "DotGothic16", monospace'; x.textAlign = 'center';
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(CW / 2 - 320, CH - 56, 640, 38);
      x.fillStyle = '#fff'; x.fillText('click to stick it down · scroll to rotate · keep clicking for more', CW / 2, CH - 30);
      x.textAlign = 'start';
    }
  }

  function goPaste() {
    if (!kit) return;
    mode = 'paste';
    holdRot = st.randomTilt ? (Math.random() - .5) * .6 : 0;
    syncUI();
  }

  function goSheet() {
    if (st.cut === 'subject' && !subject) { mode = 'pick'; syncUI(); return; }
    mode = 'sheet';
    rebuild();
    syncUI();
  }

  function syncUI() {
    if (ui.pasteBox) ui.pasteBox.hidden = mode !== 'paste';
    if (App.current === tool) document.getElementById('stage').classList.toggle('dark', mode !== 'paste');
  }

  /* ---------- tool ---------- */
  const tool = {
    id: 'sticker', name: 'Holo Sticker', short: 'Holo Sticker', icon: '❖', group: 'merch', darkStage: true,
    hint: 'A die-cut holographic sticker on its backing sheet. Drag across the sticker to peel it — stop halfway and it stays half-peeled. Drag the table to turn it in 3D. Once it is off, click to paste it onto a notebook, a laptop or your own background, again and again.',
    cursor: 'grab',

    // paste mode exports the surface plus one layer per sticker; the 3D sheet view exports flat
    layers() {
      if (mode !== 'paste') return null;
      const L = [];
      const bg = App.makeCanvas(CW, CH); bg.getContext('2d').drawImage(buildSurface(), 0, 0);
      L.push({ name: 'Surface', canvas: bg, jpeg: true });
      const comps = new Map();
      placed.forEach((p, i) => {
        if (!comps.has(p.kit)) {
          const c = App.makeCanvas(p.kit.w, p.kit.h);
          c.getContext('2d').drawImage(render(p.kit, .25, .1, 0, null), 0, 0);   // foil frozen at a nice angle
          comps.set(p.kit, c);
        }
        const c = App.makeCanvas(CW, CH);
        drawPlaced(c.getContext('2d'), p.kit, comps.get(p.kit), p, false);
        L.push({ name: `Sticker ${i + 1}`, canvas: c });
      });
      return L;
    },

    build(box) {
      const U = App.ui;
      U.buttons(box, [
        ['✋ Peel it all', () => { if (mode !== 'sheet') goSheet(); if (anim.phase === 'stuck') anim.auto = true; }],
        ['↺ Stick it back', () => { if (mode !== 'sheet') goSheet(); else resetPeel(); }],
        ['✦ Paste mode', () => goPaste()],
        ['⟲ Face front', () => { rot.tx = 0; rot.ty = 0; }],
      ]);
      U.select(box, 'Die-cut shape', Merch.SHAPES, st.cut, v => {
        st.cut = v;
        if (v === 'subject') { subject = null; mode = 'pick'; syncUI(); App.toast('Click the character you want to cut out ✦'); }
        else { mode = 'sheet'; rebuild(); syncUI(); }
      });
      U.slider(box, 'White border', { min: 0, max: 60, value: st.border }, v => { st.border = v; if (App.A && mode !== 'pick') rebuild(); });
      U.heading(box, 'Material');
      U.seg(box, null, [['holo', 'Holographic'], ['glitter', 'Glitter'], ['chrome', 'Pearl'], ['vinyl', 'Plain vinyl']], st.material, v => { st.material = v; if (kit) kit.material = v; });
      U.select(box, 'Foil pattern', [['stars', '✦ Starry'], ['shards', '◇ Broken glass'], ['hearts', '♥ Hearts'], ['smooth', 'Smooth rainbow']], st.pattern, v => { st.pattern = v; if (kit) buildPattern(kit); });
      U.slider(box, 'Foil strength', { min: 0, max: 100, value: st.foil }, v => { st.foil = v; if (kit) kit.foilAmt = v; });
      U.seg(box, 'Laminate', [['gloss', 'Glossy UV'], ['matte', 'Matte']], st.laminate, v => { st.laminate = v; if (kit) kit.laminate = v; });

      const pb = ui.pasteBox = document.createElement('div');
      U.heading(pb, 'Paste it somewhere');
      ui.surf = U.select(pb, 'Stick it on', [['notebook', 'Notebook page'], ['laptop', 'Laptop lid'], ['journal', 'Kraft journal'], ['cork', 'Corkboard'], ['bottle', 'Water bottle'], ['pictureB', 'Picture B'], ['custom', 'My own background…']],
        st.surface, v => { st.surface = v; if (v === 'custom' && !customBg) App.toast('Upload a background picture just below ↓'); });
      Merch.fileButton(pb, '🖼 Upload a background', c => { customBg = c; st.surface = 'custom'; ui.surf.value = 'custom'; });
      U.slider(pb, 'Sticker size', { min: 10, max: 80, value: st.size, format: v => v + '%' }, v => { st.size = v; });
      U.toggle(pb, 'Random tilt for each one', st.randomTilt, v => { st.randomTilt = v; });
      U.buttons(pb, [
        ['↶ Undo', () => { placed.pop(); }],
        ['✕ Peel all off', () => { placed = []; }],
        ['↩ Make another', () => goSheet()],
      ]);
      U.note(pb, 'Change Picture A, the shape or the foil, then "Make another" — the stickers you already pasted stay put.');
      box.append(pb);
      syncUI();
    },

    onImage() {
      App.resize(CW, CH);
      surfaceCache = null;
      subject = null;
      if (st.cut === 'subject') { mode = 'pick'; syncUI(); return; }
      if (mode !== 'paste') rebuild();
      else kit = makeKit();
    },
    activate() { setTimeout(syncUI); },

    async down(p) {
      if (mode === 'pick') {
        const r = await picker.click(p);
        if (r) { subject = r; mode = 'sheet'; rebuild(); syncUI(); }
        return;
      }
      if (mode === 'paste') {
        placed.push({ kit, x: p.x, y: p.y, s: st.size / 100, r: holdRot });
        if (st.randomTilt) holdRot = (Math.random() - .5) * .6;
        return;
      }
      if (anim.phase === 'lifting') return;
      if (anim.phase === 'stuck') {
        anim.auto = false;
        const q = toKit(p);
        if (onSticker(q)) {
          // keep pulling an existing flap, or start a new peel once we know the direction
          press = { kind: 'peel', x: p.x, y: p.y, q0: q, P0: fold ? fold.P.slice() : null, moved: false };
          return;
        }
      }
      press = { kind: 'turn', x: p.x, y: p.y, rx: rot.tx, ry: rot.ty, moved: false };
    },
    move(p) {
      if (!press || !App.pointer.down) return;
      const dx = p.x - press.x, dy = p.y - press.y;
      if (Math.hypot(dx, dy) > 6) press.moved = true;
      if (!press.moved) return;
      if (press.kind === 'peel') {
        const q = toKit(p), mx = q[0] - press.q0[0], my = q[1] - press.q0[1];
        if (!press.P0) {
          // a fresh peel starts at the edge behind where you grabbed, opposite the pull
          const l = Math.hypot(mx, my) || 1;
          const G = edgeFrom(press.q0, -mx / l, -my / l);
          fold = { G, P: G.slice() };
          press.P0 = G.slice();
          press.q0 = q.slice();
          return;
        }
        fold.P = [press.P0[0] + mx, press.P0[1] + my];
        checkFinished();
        return;
      }
      rot.ty = App.clamp(press.ry + dx * .0045, -1.05, 1.05);
      rot.tx = App.clamp(press.rx - dy * .0045, -1.05, 1.05);
    },
    up() {
      if (press && press.kind === 'turn' && !press.moved && anim.phase === 'free') goPaste();
      // dragged all the way back? then it is simply stuck down again
      if (fold && anim.phase === 'stuck' && Math.hypot(fold.P[0] - fold.G[0], fold.P[1] - fold.G[1]) < 5) fold = null;
      press = null;
      checkFinished();   // let go with only a sliver still stuck: it pops off
    },
    wheel(p, e) {
      if (mode !== 'paste') return false;
      holdRot += e.deltaY * .003;
    },

    frame(t) {
      const x = App.ctx;
      x.setTransform(1, 0, 0, 1, 0, 0);
      const dt = Math.min(50, t - (lastT || t));
      lastT = t;
      App.canvas.style.cursor = mode === 'paste' ? 'none' : mode === 'pick' ? 'crosshair' : (press ? 'grabbing' : 'grab');
      if (mode === 'pick') { table(x); picker.draw(x, CW, CH, true); return; }
      if (!kit) return;
      if (mode === 'paste') { drawPaste(x, t); return; }
      step(dt);
      let hx = 0, hy = 0;
      if (App.pointer.inside && !press && !fold) { hx = (App.pointer.x / CW - .5) * .22; hy = -(App.pointer.y / CH - .5) * .18; }
      rot.y = App.lerp(rot.y, rot.ty + hx, .14);
      rot.x = App.lerp(rot.x, rot.tx + hy, .14);
      table(x);
      drawSheet(x, t);
    },
  };

  App.register(tool);
})();
