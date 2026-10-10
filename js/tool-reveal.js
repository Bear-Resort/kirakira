/* ✦ Peek-a-boo — two "difference" pictures (eyes open / eyes closed…).
   Flashlight mode: the room is dark, and a real torch beam — hot core, soft
   spill, no hard edge, a little flicker and drifting dust — shows Picture B
   wherever you point it. Shape mode: B shows through a ✦ sparkle or other shape. */
(function () {
  'use strict';

  const st = {
    mode: 'torch', size: 34, dark: 10, tint: 'cold', flicker: true, trail: true, dust: true,
    shape: 'sparkle', soft: 18, spin: true, outline: true, sparkles: true, swap: true, // 2nd picture in front, the flashlight finds the 1st
  };
  const TINTS = { cold: [215, 228, 255], warm: [255, 214, 160], green: [200, 255, 180], red: [255, 120, 105] };

  let w = 0, h = 0, Bfit = null, Afit = null, darkA = null, litB = null, fallback = false;
  let mask = null, mctx = null, tmp = null, tctx = null, trail = null, trx = null;
  const cur = { x: 0, y: 0, r: 0, rot: 0 };
  let pins = [], parts = [], dust = [], on = true, flick = 1, flickT = 0;

  function baseR() { return st.size / 100 * Math.min(w, h) * .55; }
  function traceAt(c, x, y, r, rot) { Shapes.trace(c, st.shape, x, y, r, rot); }

  function spawn(x, y, r) {
    if (!st.sparkles || parts.length > 90) return;
    const a = Math.random() * Math.PI * 2;
    parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: Math.cos(a) * .6, vy: Math.sin(a) * .6 - .4, life: 1, s: (4 + Math.random() * 10) * Math.min(w, h) / 900 });
  }

  // the dark room: Picture A barely visible, cold and grainy
  function makeDark() {
    darkA = App.makeCanvas(w, h);
    const x = darkA.getContext('2d');
    x.drawImage(Afit, 0, 0);
    const id = x.getImageData(0, 0, w, h), d = id.data, k = st.dark / 100;
    for (let i = 0; i < d.length; i += 4) {
      const l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
      d[i] = l * k * .7; d[i + 1] = l * k * .8; d[i + 2] = l * k * 1.15 + 3;
    }
    x.putImageData(id, 0, 0);
    // what the torch reveals, tinted by the bulb colour
    litB = App.makeCanvas(w, h);
    const lx = litB.getContext('2d');
    lx.drawImage(Bfit, 0, 0);
    const [r, g, b] = TINTS[st.tint];
    lx.globalCompositeOperation = 'multiply';
    lx.fillStyle = `rgb(${r},${g},${b})`; lx.fillRect(0, 0, w, h);
    lx.globalCompositeOperation = 'source-over';
  }

  function makeDust() {
    const r = App.rng(3);
    dust = Array.from({ length: 140 }, () => ({ x: r() * w, y: r() * h, z: .4 + r() * .9, ph: r() * 6.28 }));
  }

  // where the torch is held from: just below the bottom edge, so the beam stretches as you aim away
  function beam(c, x0, y0, r, alpha) {
    const hx = w / 2, hy = h * 1.25;
    const dx = x0 - hx, dy = y0 - hy, dist = Math.hypot(dx, dy);
    const stretch = 1 + Math.min(1.1, dist / h * .55);
    c.save();
    c.globalAlpha = alpha;
    c.translate(x0, y0);
    c.rotate(Math.atan2(dy, dx));
    c.scale(stretch, 1 / Math.sqrt(stretch));
    c.rotate(cur.rot);
    c.drawImage(App.beamTexture(), -r, -r, r * 2, r * 2);
    c.restore();
  }

  function frameTorch(t) {
    const x = App.ctx;
    // flicker: mostly steady, with the odd nervous dip
    if (st.flicker) {
      if (flickT > 0) { flickT--; flick = .35 + Math.random() * .4; }
      else { flick = App.lerp(flick, .96 + Math.sin(t / 90) * .03 + (Math.random() - .5) * .04, .3); if (Math.random() < .006) flickT = 3 + (Math.random() * 8 | 0); }
    } else flick = 1;
    const power = on ? flick : 0;
    cur.rot += .0015;

    mctx.globalCompositeOperation = 'copy';
    mctx.fillStyle = 'rgba(0,0,0,0)'; mctx.fillRect(0, 0, w, h);
    mctx.globalCompositeOperation = 'source-over';
    if (power > 0) {
      beam(mctx, cur.x, cur.y, cur.r * 2.4, .16 * power);      // dim spill
      beam(mctx, cur.x, cur.y, cur.r, power);                  // the beam
    }
    // ghost trail: the light lingers a moment where it has been
    if (st.trail) {
      trx.globalCompositeOperation = 'destination-out';
      trx.fillStyle = 'rgba(0,0,0,.14)'; trx.fillRect(0, 0, w, h);
      trx.globalCompositeOperation = 'source-over';
      trx.globalAlpha = .35; trx.drawImage(mask, 0, 0); trx.globalAlpha = 1;
      mctx.globalAlpha = .6; mctx.drawImage(trail, 0, 0); mctx.globalAlpha = 1;
    }

    x.drawImage(darkA, 0, 0);
    tctx.globalCompositeOperation = 'copy'; tctx.drawImage(litB, 0, 0);
    tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(mask, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    x.drawImage(tmp, 0, 0);

    // a faint bloom in the hot core
    if (power > 0) {
      x.save(); x.globalCompositeOperation = 'screen';
      const [r, g, b] = TINTS[st.tint];
      const gr = x.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, cur.r * .45);
      gr.addColorStop(0, `rgba(${r},${g},${b},${.22 * power})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h); x.restore();
    }
    // dust drifting through the beam
    if (st.dust && power > 0) {
      x.save(); x.globalCompositeOperation = 'lighter';
      const R = cur.r;
      for (const p of dust) {
        p.x += Math.sin(t / 2000 + p.ph) * .25 * p.z; p.y += (.12 + Math.cos(t / 2600 + p.ph) * .1) * p.z;
        if (p.y > h) p.y = 0; if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        const d = Math.hypot(p.x - cur.x, p.y - cur.y) / R;
        if (d > 1) continue;
        x.globalAlpha = (1 - d) * .7 * power;
        x.fillStyle = '#fff';
        x.beginPath(); x.arc(p.x, p.y, p.z * Math.min(w, h) / 900 * 1.6, 0, Math.PI * 2); x.fill();
      }
      x.restore();
    }
    // heavy vignette + grain
    const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.max(w, h) * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)');
    x.fillStyle = v; x.fillRect(0, 0, w, h);
    App.drawGrain(x, w, h, .22);
  }

  function frameShapes() {
    const x = App.ctx;
    if (st.spin) cur.rot += .006;
    const soft = st.soft / 100 * cur.r * .5;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = '#fff';
    const holes = pins.concat([cur]);
    for (const p of holes) {
      if (soft > .5) {
        // shadow-only trick: draw far off-canvas, let the blurred shadow land in place
        mctx.save();
        mctx.shadowColor = '#fff'; mctx.shadowBlur = soft; mctx.shadowOffsetX = w * 3;
        traceAt(mctx, p.x - w * 3, p.y, p.r, p.rot); mctx.fill();
        mctx.restore();
      } else { traceAt(mctx, p.x, p.y, p.r, p.rot); mctx.fill(); }
    }
    x.drawImage(Afit, 0, 0);
    tctx.globalCompositeOperation = 'copy'; tctx.drawImage(Bfit, 0, 0);
    tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(mask, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
    x.drawImage(tmp, 0, 0);
    if (st.outline) {
      x.save();
      x.strokeStyle = 'rgba(255,255,255,.95)';
      x.lineWidth = Math.max(2, Math.min(w, h) / 260);
      x.shadowColor = '#ff7ab0'; x.shadowBlur = 16;
      for (const p of holes) { traceAt(x, p.x, p.y, p.r, p.rot); x.stroke(); }
      x.restore();
    }
    const keep = [];
    for (const q of parts) {
      q.x += q.vx; q.y += q.vy; q.life -= .018;
      if (q.life <= 0) continue;
      keep.push(q);
      x.globalAlpha = q.life;
      x.fillStyle = q.life > .6 ? '#fff' : '#ffe08a';
      Shapes.trace(x, 'sparkle', q.x, q.y, q.s * (.5 + q.life * .5), 0); x.fill();
    }
    parts = keep;
    x.globalAlpha = 1;
  }

  let ui = {};
  function syncUI() {
    if (ui.torch) ui.torch.hidden = st.mode !== 'torch';
    if (ui.shapes) ui.shapes.hidden = st.mode !== 'shapes';
  }

  const tool = {
    id: 'reveal', name: 'Peek-a-boo', short: 'Peek-a-boo', icon: '✦', wantsB: true,
    hint: 'Two "difference" pictures (eyes open / eyes closed, day / night). In the dark, a flashlight beam shows Picture B wherever you point it — soft, flickering, a little eerie. Click to switch the torch off and on; scroll to resize.',
    cursor: 'none',

    build(box) {
      const U = App.ui;
      U.seg(box, 'Light', [['torch', '🔦 Flashlight'], ['shapes', '✦ Shapes']], st.mode, v => { st.mode = v; syncUI(); });
      U.slider(box, 'Size', { min: 5, max: 100, value: st.size }, v => { st.size = v; });
      const tb = ui.torch = document.createElement('div');
      U.slider(tb, 'How dark the room is', { min: 0, max: 40, value: st.dark, format: v => 40 - v }, v => { st.dark = v; if (App.A) makeDark(); });
      U.seg(tb, 'Bulb', [['cold', 'Cold LED'], ['warm', 'Old bulb'], ['green', 'Sickly green'], ['red', 'Red']], st.tint, v => { st.tint = v; if (App.A) makeDark(); });
      U.toggle(tb, 'Flicker', st.flicker, v => { st.flicker = v; });
      U.toggle(tb, 'Light lingers (ghost trail)', st.trail, v => { st.trail = v; if (trx) trx.clearRect(0, 0, w, h); });
      U.toggle(tb, 'Dust in the beam', st.dust, v => { st.dust = v; });
      box.append(tb);
      const sb = ui.shapes = document.createElement('div');
      U.select(sb, 'Shape', ['sparkle', 'circle', 'heart', 'star', 'diamond', 'moon', 'flower'].map(n => [n, Shapes.labels[n]]), st.shape, v => { st.shape = v; });
      U.slider(sb, 'Soft edge', { min: 0, max: 100, value: st.soft }, v => { st.soft = v; });
      U.toggle(sb, 'Slowly spin', st.spin, v => { st.spin = v; });
      U.toggle(sb, 'Glowing outline', st.outline, v => { st.outline = v; });
      U.toggle(sb, 'Sparkle trail', st.sparkles, v => { st.sparkles = v; });
      U.buttons(sb, [['✕ Clear pinned peeks', () => { pins = []; }]]);
      U.note(sb, 'Click to pin a peek-hole in place.');
      box.append(sb);
      U.toggle(box, 'Swap A ⇄ B', st.swap, v => { st.swap = v; tool.onImage(); });
      U.note(box, 'No Picture B yet? A manga-ink version of Picture A is used until you add one. For a spooky reveal, use the same scene with something different in it.');
      syncUI();
    },

    onImage() {
      w = App.A.width; h = App.A.height;
      App.resize(w, h);
      fallback = !App.B;
      const other = App.B ? App.coverInto(App.B, w, h) : App.mangaVersion(App.A);
      Afit = st.swap ? other : App.A;
      Bfit = st.swap ? App.A : other;
      mask = App.makeCanvas(w, h); mctx = mask.getContext('2d');
      tmp = App.makeCanvas(w, h); tctx = tmp.getContext('2d');
      trail = App.makeCanvas(w, h); trx = trail.getContext('2d');
      makeDark(); makeDust();
      if (!cur.r) { cur.x = w / 2; cur.y = h / 2; }
      pins = [];
    },

    down(p) {
      if (st.mode === 'torch') on = !on;
      else pins.push({ x: p.x, y: p.y, r: baseR(), rot: cur.rot });
    },
    wheel(p, e) { st.size = App.clamp(st.size - e.deltaY * .03, 5, 100); },

    frame(t) {
      if (!Afit) return;
      let tx, ty;
      if (App.pointer.inside) { tx = App.pointer.x; ty = App.pointer.y; }
      else { const s = t / 2600; tx = w / 2 + Math.sin(s) * w * .3; ty = h / 2 + Math.sin(s * 2.3) * h * .2; }
      const px = cur.x, py = cur.y;
      // a hand-held torch lags and sways a little
      const k = st.mode === 'torch' ? .12 : .22;
      cur.x = App.lerp(cur.x, tx, k) + (st.mode === 'torch' ? Math.sin(t / 700) * .6 : 0);
      cur.y = App.lerp(cur.y, ty, k) + (st.mode === 'torch' ? Math.cos(t / 900) * .6 : 0);
      cur.r = App.lerp(cur.r || baseR(), baseR(), .2);
      if (st.mode === 'torch') { frameTorch(t); }
      else {
        if (Math.hypot(cur.x - px, cur.y - py) > 2 || Math.random() < .15) spawn(cur.x, cur.y, cur.r * .8);
        frameShapes();
      }
      if (fallback) {
        const x = App.ctx;
        x.font = `${Math.round(h / 34)}px "DotGothic16", monospace`;
        x.fillStyle = 'rgba(0,0,0,.55)';
        const label = 'add Picture B for your own difference pair';
        const tw = x.measureText(label).width;
        x.fillRect(10, h - h / 34 - 22, tw + 20, h / 34 + 14);
        x.fillStyle = '#fff'; x.fillText(label, 20, h - 18);
      }
    },
  };

  App.register(tool);
})();
