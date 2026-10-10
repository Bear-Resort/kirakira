/* ◇ Acrylic Charm — your OC printed on a die-cut clear acrylic keychain, hanging
   from a chain. Drag it to swing and spin it; it twists back to face you. Turn it
   past sideways and you see the mirrored print through the back of the acrylic. */
(function () {
  'use strict';
  const CW = 1400, CH = 1050;

  const st = {
    cut: 'subject', border: 26, thick: 16, material: 'clear', print: 'white', metal: 'silver', bg: 'pastel',
  };
  const METALS = {
    silver: ['#f4f6f8', '#9aa3ad', '#5d6670'],
    gold: ['#fff2c2', '#d9a93d', '#8a6416'],
    rose: ['#ffe3dc', '#d99a8c', '#8e5448'],
    black: ['#9a9aa3', '#3c3c44', '#141418'],
  };

  let kit = null, subject = null, mode = 'charm';
  const picker = Merch.picker();
  // physics: swing angle (pendulum) and spin around the chain
  const ph = { th: 0, thv: 0, ry: 0, ryv: 0 };
  let press = null, lastT = 0, glitter = [];
  const anchor = { x: CW / 2, y: 120 };

  function makeKit() {
    const k = Merch.cut({ shape: st.cut === 'subject' && !subject ? 'rounded' : st.cut, border: st.border, subject, maxW: 560, maxH: 600, pad: 40 });
    const x0 = Merch.bounds(k.sil, 0) || { x: 0, y: 0, w: k.w, h: k.h };
    // hole near the top of the acrylic, inside the clear border
    const d = k.sil.getContext('2d').getImageData(0, 0, k.w, k.h).data;
    const hr = Math.max(9, st.border * .42);
    let hx = x0.x + x0.w / 2, hy = x0.y + hr * 2;
    // walk down from the top at the centre column until there is acrylic all round the hole
    for (let y = x0.y; y < x0.y + x0.h / 2; y += 2) {
      const ok = [[0, -hr * 1.8], [-hr * 1.8, 0], [hr * 1.8, 0], [0, 0]].every(([dx, dy]) => {
        const px = Math.round(hx + dx), py = Math.round(y + dy);
        return px >= 0 && py >= 0 && px < k.w && py < k.h && d[(py * k.w + px) * 4 + 3] > 200;
      });
      if (ok) { hy = y; break; }
    }
    k.hole = { x: hx, y: hy, r: hr };
    const punch = c => { const x = c.getContext('2d'); x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(hx, hy, hr, 0, Math.PI * 2); x.fill(); x.restore(); };

    // acrylic slab colour used for the stacked edge layers
    k.edge = App.silhouette(k.sil, 0, st.material === 'frost' ? 'rgba(235,240,250,.07)' : 'rgba(150,195,220,.05)');
    punch(k.edge);
    // the face: clear acrylic, print, highlights get added per frame
    k.base = App.makeCanvas(k.w, k.h);
    const b = k.base.getContext('2d');
    b.drawImage(App.silhouette(k.sil, 0, st.material === 'frost' ? 'rgba(245,248,255,.55)' : 'rgba(235,245,255,.16)'), 0, 0);
    if (st.material === 'holo') {
      const film = App.makeCanvas(k.w, k.h), f = film.getContext('2d');
      Merch.rainbow(f, k.w, k.h, 0, 78);
      f.globalCompositeOperation = 'destination-in'; f.drawImage(k.sil, 0, 0);
      b.globalAlpha = .45; b.drawImage(film, 0, 0); b.globalAlpha = 1;
    }
    if (st.print === 'white') b.drawImage(App.silhouette(k.mask, 0, '#fff'), 0, 0);   // white ink underlayer
    b.globalAlpha = st.print === 'white' ? 1 : .82;
    b.drawImage(k.art, 0, 0);
    b.globalAlpha = 1;
    // polished edge: a thin bright rim just inside the outline
    const rim = App.silhouette(k.sil, 0, 'rgba(255,255,255,.9)');
    const rc = rim.getContext('2d');
    rc.globalCompositeOperation = 'destination-out';
    rc.drawImage(App.silhouette(k.sil, 0), 3, 3);
    b.drawImage(rim, 0, 0);
    punch(k.base);
    // ring around the hole
    b.strokeStyle = 'rgba(255,255,255,.8)'; b.lineWidth = 2;
    b.beginPath(); b.arc(hx, hy, hr + 1, 0, Math.PI * 2); b.stroke();

    k.face = App.makeCanvas(k.w, k.h);
    k.tmp = App.makeCanvas(k.w, k.h);
    k.shadow = App.blurred(App.silhouette(k.sil, 0, 'rgba(40,20,60,.9)'), 8);
    glitter = st.material === 'glitter' ? Merch.glitterPoints(k.sil, 260, 9) : [];
    return k;
  }

  function rebuild() { if (App.A) kit = makeKit(); }

  function faceFor(t) {
    const k = kit, f = k.face.getContext('2d');
    f.globalCompositeOperation = 'copy'; f.drawImage(k.base, 0, 0); f.globalCompositeOperation = 'source-over';
    // moving reflection streaks as it spins
    const s = Math.sin(ph.ry), g = f.createLinearGradient(0, 0, k.w, k.h * .6);
    const p = .5 + s * .45;
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(App.clamp(p - .08, 0, 1), 'rgba(255,255,255,0)');
    g.addColorStop(App.clamp(p, 0, 1), 'rgba(255,255,255,.55)');
    g.addColorStop(App.clamp(p + .03, 0, 1), 'rgba(255,255,255,.1)');
    g.addColorStop(App.clamp(p + .08, 0, 1), 'rgba(255,255,255,.3)');
    g.addColorStop(App.clamp(p + .13, 0, 1), 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    const tx = k.tmp.getContext('2d');
    tx.globalCompositeOperation = 'copy'; tx.fillStyle = g; tx.fillRect(0, 0, k.w, k.h);
    tx.globalCompositeOperation = 'destination-in'; tx.drawImage(k.base, 0, 0);
    tx.globalCompositeOperation = 'source-over';
    f.save(); f.globalCompositeOperation = 'screen'; f.drawImage(k.tmp, 0, 0); f.restore();
    if (glitter.length) Merch.drawGlitter(f, glitter, 0, ph.ry, t, 1.2);
    return k.face;
  }

  /* ---------- scene ---------- */
  function background(x) {
    const g = x.createLinearGradient(0, 0, 0, CH);
    if (st.bg === 'night') { g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#3b2a63'); }
    else if (st.bg === 'white') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ecebf2'); }
    else { g.addColorStop(0, '#ffe3ef'); g.addColorStop(1, '#e2dcff'); }
    x.fillStyle = g; x.fillRect(0, 0, CW, CH);
    const r = App.rng(2);
    x.fillStyle = st.bg === 'night' ? 'rgba(255,240,180,.7)' : 'rgba(255,255,255,.85)';
    for (let i = 0; i < 26; i++) { Shapes.trace(x, 'sparkle', r() * CW, r() * CH, 6 + r() * 14, 0); x.fill(); }
  }

  function metalStroke(x, w, glint) {
    const m = METALS[st.metal];
    x.lineCap = 'round';
    x.strokeStyle = m[2]; x.lineWidth = w + 3; x.stroke();
    x.strokeStyle = m[1]; x.lineWidth = w; x.stroke();
    x.strokeStyle = m[0]; x.lineWidth = Math.max(1.5, w * .3); x.globalAlpha = glint == null ? .9 : glint; x.stroke(); x.globalAlpha = 1;
  }

  function drawChain(x, from, to) {
    const L = Math.hypot(to.x - from.x, to.y - from.y), n = Math.max(2, Math.round(L / 26));
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      const cx = from.x + (to.x - from.x) * t, cy = from.y + (to.y - from.y) * t;
      x.save(); x.translate(cx, cy); x.rotate(ang);
      x.beginPath();
      if (i % 2) x.ellipse(0, 0, 15, 2.5, 0, 0, Math.PI * 2);       // link seen side-on
      else x.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);                // link seen face-on
      metalStroke(x, 4);
      x.restore();
    }
  }

  function drawKeyring(x) {
    // big split ring at the top + a little connector
    x.save();
    x.beginPath(); x.ellipse(anchor.x, anchor.y - 58, 54, 54, 0, 0, Math.PI * 2); metalStroke(x, 7);
    x.beginPath(); x.ellipse(anchor.x + 3, anchor.y - 56, 50, 50, 0, -.4, Math.PI * 1.7); metalStroke(x, 5, .6);
    x.beginPath(); x.ellipse(anchor.x, anchor.y - 6, 9, 14, 0, 0, Math.PI * 2); metalStroke(x, 5);
    x.restore();
  }

  function draw(x, t) {
    background(x);
    const k = kit;
    const chainLen = 120;
    const holeW = { x: anchor.x + Math.sin(ph.th) * chainLen, y: anchor.y + Math.cos(ph.th) * chainLen };
    const T = Merch.turn(.12, ph.ry);
    const rotZ = -ph.th;

    const place = (dz, img, alpha) => {
      x.save();
      x.translate(holeW.x, holeW.y);
      x.rotate(rotZ);
      x.translate(T.depth[0] * dz, T.depth[1] * dz);
      x.transform(T.m[0], T.m[1], T.m[2], T.m[3], 0, 0);
      x.translate(-k.hole.x, -k.hole.y);
      if (alpha != null) x.globalAlpha = alpha;
      x.drawImage(img, 0, 0);
      x.restore();
    };

    // soft shadow on the wall behind
    x.save(); x.globalAlpha = .22; x.translate(36, 46);
    place(0, k.shadow);
    x.restore();

    drawKeyring(x);
    drawChain(x, anchor, holeW);

    // thickness: stack translucent copies of the slab, farthest first.
    // From the front the print (z = 0) is nearest; from behind you look at it through the acrylic.
    const n = 10, th = st.thick;
    const front = T.facing;
    if (!front) place(0, faceFor(t));
    for (let i = 0; i <= n; i++) place(front ? -th + th * i / n : -th * i / n, k.edge);
    if (front) place(0, faceFor(t));

    // jump ring through the hole (perpendicular to the charm)
    x.save();
    x.translate(holeW.x, holeW.y);
    x.rotate(rotZ);
    x.beginPath();
    x.ellipse(0, -k.hole.r * .2, Math.max(3, Math.abs(Math.sin(ph.ry + Math.PI / 2)) * 3 + Math.abs(Math.cos(ph.ry)) * 3 + Math.abs(Math.sin(ph.ry)) * 16), 20, 0, 0, Math.PI * 2);
    metalStroke(x, 5);
    x.restore();

    x.font = '18px "DotGothic16", monospace'; x.textAlign = 'center';
    x.fillStyle = st.bg === 'night' ? 'rgba(255,255,255,.6)' : 'rgba(42,37,51,.55)';
    x.fillText('drag it to swing & spin · double-click to flip', CW / 2, CH - 24);
    x.textAlign = 'start';
  }

  function stepPhysics(dt) {
    const k = dt / 16.7;
    if (!press) {
      ph.thv += -Math.sin(ph.th) * .0075 * k;
      ph.thv *= Math.pow(.988, k);
      // the chain twists it back toward facing front (nearest full turn)
      const target = Math.round(ph.ry / (Math.PI * 2)) * Math.PI * 2;
      ph.ryv += -(ph.ry - target) * .0022 * k;
      ph.ryv *= Math.pow(.985, k);
    }
    ph.th += ph.thv * k;
    ph.ry += ph.ryv * k;
  }

  const tool = {
    id: 'acrylic', name: 'Acrylic Charm', short: 'Acrylic Charm', icon: '◇', group: 'merch',
    hint: 'Your OC as a clear acrylic keychain charm. Drag it to swing and spin — it twists back to face you, and from behind you see the print mirrored through the acrylic.',
    cursor: 'grab',

    build(box) {
      const U = App.ui;
      U.buttons(box, [
        ['🌀 Spin it', () => { ph.ryv += .32; }],
        ['〰 Swing it', () => { ph.thv += .06; }],
        ['↔ Flip', () => { ph.ryv += .16; }],
      ]);
      U.select(box, 'Cut shape', Merch.SHAPES, st.cut, v => {
        st.cut = v;
        if (v === 'subject' && !subject) { mode = 'pick'; App.toast('Click your character ✦'); } else rebuild();
      });
      U.slider(box, 'Clear border', { min: 10, max: 70, value: st.border }, v => { st.border = v; if (mode !== 'pick') rebuild(); });
      U.slider(box, 'Thickness', { min: 4, max: 40, value: st.thick, format: v => (v / 5).toFixed(1) + 'mm' }, v => { st.thick = v; });
      U.heading(box, 'Material');
      U.seg(box, null, [['clear', 'Clear'], ['holo', 'Holo film'], ['glitter', 'Glitter'], ['frost', 'Frosted']], st.material, v => { st.material = v; rebuild(); });
      U.seg(box, 'Print', [['white', 'With white ink'], ['clear', 'See-through ink']], st.print, v => { st.print = v; rebuild(); });
      U.seg(box, 'Hardware', [['silver', 'Silver'], ['gold', 'Gold'], ['rose', 'Rose gold'], ['black', 'Black']], st.metal, v => { st.metal = v; });
      U.seg(box, 'Background', [['pastel', 'Pastel'], ['white', 'White'], ['night', 'Night']], st.bg, v => { st.bg = v; });
      U.buttons(box, [['✨ Re-pick character', () => { subject = null; st.cut = 'subject'; mode = 'pick'; }]]);
      U.note(box, '"AI: cut around the character" makes the classic die-cut charm outline. The clear border is the acrylic margin around your art.');
    },

    onImage() {
      App.resize(CW, CH);
      subject = null;
      if (st.cut === 'subject') { mode = 'pick'; return; }
      mode = 'charm';
      rebuild();
    },

    async down(p, e) {
      if (mode === 'pick') {
        const r = await picker.click(p);
        if (r) { subject = r; mode = 'charm'; rebuild(); }
        return;
      }
      if (e.detail === 2) { ph.ryv += .16; return; }   // double-click flips
      press = { x: p.x, y: p.y, lx: p.x, t: performance.now() };
    },
    move(p) {
      if (!press || !App.pointer.down) return;
      // swing toward the pointer, spin with sideways motion
      const want = App.clamp(Math.atan2(p.x - anchor.x, Math.max(40, p.y - anchor.y)), -1.1, 1.1);
      ph.thv = (want - ph.th) * .25;
      ph.ryv = App.clamp(ph.ryv * .6 + (p.x - press.lx) * .006, -.6, .6);
      press.lx = p.x;
    },
    up() { press = null; },

    frame(t) {
      const x = App.ctx;
      x.setTransform(1, 0, 0, 1, 0, 0);
      const dt = Math.min(50, t - (lastT || t));
      lastT = t;
      App.canvas.style.cursor = mode === 'pick' ? 'crosshair' : press ? 'grabbing' : 'grab';
      if (mode === 'pick') { background(x); picker.draw(x, CW, CH, st.bg === 'night'); return; }
      if (!kit) return;
      stepPhysics(dt);
      draw(x, t);
    },
  };

  App.register(tool);
})();
