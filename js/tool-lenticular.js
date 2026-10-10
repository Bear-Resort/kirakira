/* ▥ Lenticular Card — the ridged plastic "flip" card from cereal boxes and anime
   merch. Pictures A and B are interlaced under tiny lenses; move the mouse left
   and right to tilt the card and watch it flip, with ghosting mid-way, ridge
   shading and a sliding glare. */
(function () {
  'use strict';

  const st = { lenses: 110, sweep: 45, ridges: 55, glare: 60, auto: true, persp: 60, edge: true };

  let CW = 0, CH = 0, cw = 0, ch = 0, ox = 0, oy = 0;
  let A = null, B = null, flat = null, fctx = null, ridgeTile = null, fallback = false;
  let tilt = 0, tiltY = 0;

  function makeRidgeTile(L) {
    const c = App.makeCanvas(Math.max(2, L), 4), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, c.width, 0);
    g.addColorStop(0, 'rgba(0,0,0,.55)');
    g.addColorStop(.25, 'rgba(255,255,255,.0)');
    g.addColorStop(.42, 'rgba(255,255,255,.55)');
    g.addColorStop(.6, 'rgba(255,255,255,.0)');
    g.addColorStop(1, 'rgba(0,0,0,.4)');
    x.fillStyle = g; x.fillRect(0, 0, c.width, 4);
    return c;
  }

  function layout() {
    const s = Math.min(1100 / App.A.width, 820 / App.A.height, 1.4);
    cw = Math.round(App.A.width * s); ch = Math.round(App.A.height * s);
    CW = cw + 260; CH = ch + 200;
    ox = (CW - cw) / 2; oy = (CH - ch) / 2 - 10;
    App.resize(CW, CH);
    const fit = (src) => { const c = App.makeCanvas(cw, ch); c.getContext('2d').drawImage(src, 0, 0, cw, ch); return c; };
    A = fit(App.A);
    fallback = !App.B;
    B = App.B ? App.coverInto(App.B, cw, ch) : fit(App.mangaVersion(App.A));
    flat = App.makeCanvas(cw, ch); fctx = flat.getContext('2d');
    ridgeTile = makeRidgeTile(Math.round(cw / st.lenses));
  }

  // build the flat card for the current tilt
  function buildFlat() {
    const n = st.lenses, L = cw / n;
    const v = (tilt + 1) / 2;
    const spread = st.sweep / 100;
    fctx.globalAlpha = 1;
    fctx.drawImage(A, 0, 0);
    for (let i = 0; i < n; i++) {
      // each lens sees the card from a slightly different angle, so the flip sweeps across
      const p = v + (i / n - .5) * spread;
      const t = App.clamp((p - .42) / .16, 0, 1);
      if (t <= 0) continue;
      const x0 = Math.floor(i * L), x1 = Math.floor((i + 1) * L);
      // mid-flip ghosting: half of each lens still shows the other picture
      if (t < 1) {
        const half = Math.max(1, Math.round((x1 - x0) * t));
        fctx.globalAlpha = .55 + .45 * t;
        fctx.drawImage(B, x0, 0, half, ch, x0, 0, half, ch);
        fctx.globalAlpha = t * .6;
        fctx.drawImage(B, x0 + half, 0, x1 - x0 - half, ch, x0 + half, 0, x1 - x0 - half, ch);
      } else {
        fctx.globalAlpha = 1;
        fctx.drawImage(B, x0, 0, x1 - x0, ch, x0, 0, x1 - x0, ch);
      }
    }
    fctx.globalAlpha = 1;

    // lens ridges — highlight inside each lens shifts with the tilt
    if (st.ridges > 0) {
      const pat = fctx.createPattern(ridgeTile, 'repeat');
      fctx.save();
      fctx.globalAlpha = st.ridges / 100 * .5;
      fctx.globalCompositeOperation = 'overlay';
      fctx.translate(tilt * L * .5, 0);
      fctx.fillStyle = pat; fctx.fillRect(-L, 0, cw + L * 2, ch);
      fctx.restore();
    }
    // glare sliding across the plastic
    if (st.glare > 0) {
      const gx = cw * (.5 - tilt * .9), gy = ch * (.5 - tiltY * .6);
      const g = fctx.createLinearGradient(gx - cw * .4, gy - ch * .5, gx + cw * .4, gy + ch * .5);
      const a = st.glare / 100;
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(.45, 'rgba(255,255,255,0)');
      g.addColorStop(.5, `rgba(255,255,255,${.45 * a})`);
      g.addColorStop(.53, `rgba(255,250,235,${.18 * a})`);
      g.addColorStop(.6, `rgba(200,230,255,${.12 * a})`);
      g.addColorStop(.66, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      fctx.save();
      fctx.globalCompositeOperation = 'screen';
      fctx.fillStyle = g; fctx.fillRect(0, 0, cw, ch);
      fctx.restore();
    }
  }

  // round-cornered alpha so the perspective columns inherit the card shape
  function clipCard() {
    fctx.save();
    fctx.globalCompositeOperation = 'destination-in';
    fctx.beginPath(); App.roundRect(fctx, 0, 0, cw, ch, Math.min(cw, ch) * .045); fctx.fill();
    fctx.restore();
  }

  function present() {
    const x = App.ctx;
    // soft desk background
    const bg = x.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, '#efe6f7'); bg.addColorStop(1, '#d9cde8');
    x.fillStyle = bg; x.fillRect(0, 0, CW, CH);

    const amt = st.persp / 100;
    const ang = tilt * .55 * amt;                  // rotateY, radians
    const squash = Math.cos(ang);
    const cols = 160, colW = cw / cols;
    const drawW = cw * squash, x0 = CW / 2 - drawW / 2;

    // shadow on the desk
    x.save();
    x.fillStyle = 'rgba(60,40,90,.28)';
    x.shadowColor = 'rgba(60,40,90,.35)';
    x.shadowBlur = 40; x.shadowOffsetY = 26;
    x.beginPath(); App.roundRect(x, x0 + tilt * -20, oy + 12, drawW, ch, 20); x.fill();
    x.restore();

    // card edge thickness on the side turned toward you
    if (st.edge && Math.abs(ang) > .01) {
      const th = Math.min(18, Math.abs(Math.sin(ang)) * 60);
      const side = ang > 0 ? x0 - th : x0 + drawW;
      const hNear = ch * (1 + Math.sin(Math.abs(ang)) * .12);
      x.fillStyle = '#b9aecb';
      x.fillRect(side, oy + (ch - hNear) / 2 + 6, th, hNear - 12);
    }
    // draw the flat card as columns with per-column height = cheap perspective
    for (let i = 0; i < cols; i++) {
      const u = i / (cols - 1) - .5;              // -.5 … .5 across the card
      const hs = 1 + Math.sin(-ang) * u * .24 * 2; // near side taller
      const hh = ch * hs;
      const dx = x0 + i * colW * squash;
      x.drawImage(flat, i * colW, 0, colW + .6, ch, dx, oy + (ch - hh) / 2 , colW * squash + .8, hh);
    }

    if (fallback) {
      x.font = '20px "DotGothic16", monospace';
      x.fillStyle = '#6b6377'; x.textAlign = 'center';
      x.fillText('add Picture B to flip between your own two pictures', CW / 2, CH - 28);
      x.textAlign = 'start';
    }
  }

  const tool = {
    id: 'lenticular', name: 'Lenticular Card', short: 'Lenticular', icon: '▥', group: 'merch', wantsB: true,
    hint: 'A ridged "flip" card like anime merch and cereal-box prizes. Pictures A and B are interlaced under tiny lenses — move the mouse left and right to tilt the card and flip it.',
    cursor: 'ew-resize',

    build(box) {
      const ui = App.ui;
      ui.slider(box, 'Lens count', { min: 30, max: 240, value: st.lenses }, v => { st.lenses = v; if (App.A) ridgeTile = makeRidgeTile(Math.round(cw / v)); });
      ui.slider(box, 'Flip sweep across card', { min: 0, max: 100, value: st.sweep }, v => { st.sweep = v; });
      ui.slider(box, 'Ridge texture', { min: 0, max: 100, value: st.ridges }, v => { st.ridges = v; });
      ui.slider(box, 'Plastic glare', { min: 0, max: 100, value: st.glare }, v => { st.glare = v; });
      ui.slider(box, '3D tilt', { min: 0, max: 100, value: st.persp }, v => { st.persp = v; });
      ui.toggle(box, 'Card edge thickness', st.edge, v => { st.edge = v; });
      ui.toggle(box, 'Wobble by itself when the mouse is away', st.auto, v => { st.auto = v; });
      ui.note(box, 'Best with a "difference" pair: eyes open / closed, day / night, before / after a transformation.');
    },

    onImage() { layout(); },

    frame(t) {
      if (!flat) return;
      let target = tilt, ty = 0;
      if (App.pointer.inside) { target = App.clamp((App.pointer.x / CW - .5) * 2.4, -1, 1); ty = (App.pointer.y / CH - .5) * 2; }
      else if (st.auto) target = Math.sin(t / 1300);
      tilt = App.lerp(tilt, target, .14);
      tiltY = App.lerp(tiltY, ty, .14);
      buildFlat();
      clipCard();
      present();
    },
  };

  App.register(tool);
})();
