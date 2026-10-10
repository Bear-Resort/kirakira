/* ◐ Spotlight Stage — a character stands in front of a wall in a dark room and
   your mouse is the flashlight. The beam lights them, and their shadow is thrown
   onto the wall behind — bigger and softer the closer the light, sliding the
   opposite way as you move. Best with a white-background or transparent PNG. */
(function () {
  'use strict';
  const CW = 1500, CH = 1000;

  const st = {
    backdrop: 'plaster', bulb: 'cold', beam: 46, wall: 55, dark: 7, height: 74,
    flicker: true, lag: false, dust: true, tol: 30,
  };
  const BULBS = { cold: [214, 226, 255], warm: [255, 210, 150], green: [196, 255, 176], red: [255, 110, 96], moon: [150, 180, 255] };

  let subj = null;        // {img, mask} cropped to the character, in picture pixels
  let place = null;       // where the character stands {x, y, w, h}
  let wallC = null, wallKey = '';
  let beamC, bx, litC, lx, tmp, tx;
  const L = { x: CW * .4, y: CH * .45 }, S = { x: CW * .4, y: CH * .45 };   // light, and the (maybe lagging) light the shadow follows
  let dust = [], flick = 1, flickT = 0, mode = 'stage', status = '';
  const picker = Merch.picker();

  /* ---------- cutting the character out ---------- */
  // transparent PNG → use its alpha; white background → flood-fill the white from the edges
  function extract(src) {
    const w = src.width, h = src.height;
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    let clear = 0, n = 0;
    for (let i = 3; i < d.length; i += 4 * 9) { n++; if (d[i] < 200) clear++; }
    const m = App.makeCanvas(w, h), mx = m.getContext('2d'), md = mx.createImageData(w, h);
    if (clear > n * .02) {
      for (let i = 0; i < d.length; i += 4) { md.data[i] = md.data[i + 1] = md.data[i + 2] = 255; md.data[i + 3] = d[i + 3]; }
      mx.putImageData(md, 0, 0);
      return m;
    }
    const tol = 255 - st.tol * 2.2;
    const bgLike = i => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return Math.min(r, g, b) > tol && Math.max(r, g, b) - Math.min(r, g, b) < 40; };
    // is the border mostly white?
    let white = 0, tot = 0;
    for (let x = 0; x < w; x += 3) { tot += 2; if (bgLike(x)) white++; if (bgLike((h - 1) * w + x)) white++; }
    for (let y = 0; y < h; y += 3) { tot += 2; if (bgLike(y * w)) white++; if (bgLike(y * w + w - 1)) white++; }
    if (white < tot * .6) return null;
    const bg = new Uint8Array(w * h), stack = [];
    const push = i => { if (!bg[i] && bgLike(i)) { bg[i] = 1; stack.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
    }
    for (let i = 0; i < w * h; i++) { md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = bg[i] ? 0 : 255; }
    mx.putImageData(md, 0, 0);
    return App.blurred(m, 2);   // soften the cut edge a touch
  }

  function setSubject(mask) {
    const A = App.A;
    const b = Merch.bounds(mask, .01) || { x: 0, y: 0, w: A.width, h: A.height };
    const img = App.makeCanvas(b.w, b.h), ix = img.getContext('2d');
    ix.drawImage(A, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    ix.globalCompositeOperation = 'destination-in';
    ix.drawImage(mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    // a soft-edged silhouette with room around it, for the shadow
    const pad = Math.round(Math.max(b.w, b.h) * .06);
    const padded = App.makeCanvas(b.w + pad * 2, b.h + pad * 2);
    padded.getContext('2d').drawImage(App.silhouette(img, 0, '#000'), pad, pad);
    subj = { img, soft: App.blurred(padded, 4), pad };
    layout();
  }

  async function findSubject() {
    subj = null;
    const auto = extract(App.A);
    if (auto) { setSubject(auto); status = ''; return; }
    // not a white/transparent picture: ask the AI for whatever is in the middle
    status = 'Finding the character…';
    try {
      const m = await App.segmentAt(App.A, App.A.width / 2, App.A.height * .45);
      setSubject(m);
      status = '';
    } catch (err) {
      console.error(err);
      const all = App.makeCanvas(App.A.width, App.A.height);
      all.getContext('2d').fillRect(0, 0, all.width, all.height);
      setSubject(all);
      App.toast('Could not find a character automatically — a white-background or transparent PNG works best.', 6000);
      status = '';
    }
  }

  function layout() {
    const hgt = CH * st.height / 100;
    const s = Math.min(hgt / subj.img.height, CW * .7 / subj.img.width);
    const w = subj.img.width * s, h = subj.img.height * s;
    place = { x: (CW - w) / 2, y: CH * .9 - h, w, h };
  }

  /* ---------- the room ---------- */
  function buildWall() {
    const key = st.backdrop;
    if (wallC && wallKey === key) return wallC;
    wallKey = key;
    wallC = App.makeCanvas(CW, CH);
    const x = wallC.getContext('2d'), r = App.rng(14);
    const floorY = CH * .88;
    if (st.backdrop === 'curtain') {
      for (let i = 0; i < CW; i += 2) {
        const f = .55 + .45 * Math.sin(i / 38 + Math.sin(i / 170) * 2);
        x.fillStyle = `rgb(${120 * f + 30},${18 * f + 8},${28 * f + 10})`;
        x.fillRect(i, 0, 2, floorY);
      }
    } else if (st.backdrop === 'brick') {
      x.fillStyle = '#6d6560'; x.fillRect(0, 0, CW, floorY);
      for (let y = 0, row = 0; y < floorY; y += 34, row++) {
        for (let xx = (row % 2) * -45; xx < CW; xx += 90) {
          const v = 120 + r() * 40;
          x.fillStyle = `rgb(${v},${v * .9},${v * .85})`;
          x.fillRect(xx + 3, y + 3, 84, 28);
        }
      }
    } else {
      x.fillStyle = '#b9b2a8'; x.fillRect(0, 0, CW, floorY);
      for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},${r() < .5 ? 0 : 255},.04)`; x.fillRect(r() * CW, r() * floorY, 2 + r() * 4, 2 + r() * 4); }
      // old stains
      for (let i = 0; i < 12; i++) {
        const sx = r() * CW, sy = r() * floorY, sr = 40 + r() * 160;
        const g = x.createRadialGradient(sx, sy, 0, sx, sy, sr);
        g.addColorStop(0, 'rgba(70,60,40,.16)'); g.addColorStop(1, 'rgba(70,60,40,0)');
        x.fillStyle = g; x.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      }
    }
    // floorboards
    const fg = x.createLinearGradient(0, floorY, 0, CH);
    fg.addColorStop(0, '#6a5442'); fg.addColorStop(1, '#3d2f25');
    x.fillStyle = fg; x.fillRect(0, floorY, CW, CH - floorY);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2;
    for (let i = -10; i <= 10; i++) { x.beginPath(); x.moveTo(CW / 2 + i * 40, floorY); x.lineTo(CW / 2 + i * 190, CH); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, floorY - 3, CW, 6);
    return wallC;
  }

  function makeDust() {
    const r = App.rng(8);
    dust = Array.from({ length: 220 }, () => ({ x: r() * CW, y: r() * CH, z: .3 + r(), ph: r() * 6.28 }));
  }

  /* ---------- one frame ---------- */
  function draw(t) {
    const x = App.ctx;
    const [cr, cg, cb] = BULBS[st.bulb];
    if (st.flicker) {
      if (flickT > 0) { flickT--; flick = .25 + Math.random() * .5; }
      else { flick = App.lerp(flick, .95 + Math.sin(t / 80) * .03 + (Math.random() - .5) * .05, .3); if (Math.random() < .005) flickT = 2 + (Math.random() * 9 | 0); }
    } else flick = 1;
    const amb = st.dark / 100;
    const R = CH * st.beam / 100;
    // how far the wall is behind the character: the shadow is the character scaled about the light
    const k = 1.12 + st.wall / 100 * 1.1;

    // light falling on the wall: soft beam minus the shadow
    bx.globalCompositeOperation = 'copy';
    bx.fillStyle = `rgb(${amb * 255 * .8},${amb * 255 * .85},${amb * 255})`; bx.fillRect(0, 0, CW, CH);
    bx.globalCompositeOperation = 'source-over';
    const beamLayer = tmp;
    tx.globalCompositeOperation = 'copy'; tx.fillStyle = 'rgba(0,0,0,0)'; tx.fillRect(0, 0, CW, CH);
    tx.globalCompositeOperation = 'source-over';
    tx.globalAlpha = flick;
    tx.drawImage(App.beamTexture(), L.x - R * k, L.y - R * k, R * 2 * k, R * 2 * k);
    tx.globalAlpha = .12 * flick;
    tx.drawImage(App.beamTexture(), L.x - R * k * 2.4, L.y - R * k * 2.4, R * 4.8 * k, R * 4.8 * k);
    tx.globalAlpha = 1;
    // the shadow: penumbra grows with distance, so draw it a little blurred and larger
    tx.save();
    tx.globalCompositeOperation = 'destination-out';
    tx.translate(S.x, S.y); tx.scale(k, k); tx.translate(-S.x, -S.y);
    const ps = place.w / subj.img.width, pp = subj.pad * ps;
    tx.globalAlpha = .93;
    tx.drawImage(subj.soft, place.x - pp, place.y - pp, place.w + pp * 2, place.h + pp * 2);
    tx.restore();
    // tint the light with the bulb colour and add it to the ambient
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = `rgb(${cr},${cg},${cb})`; tx.fillRect(0, 0, CW, CH);
    tx.globalCompositeOperation = 'source-over';
    bx.globalCompositeOperation = 'lighter'; bx.drawImage(beamLayer, 0, 0); bx.globalCompositeOperation = 'source-over';

    x.drawImage(buildWall(), 0, 0);
    x.save(); x.globalCompositeOperation = 'multiply'; x.drawImage(beamC, 0, 0); x.restore();

    // contact shadow at the feet
    x.save();
    x.fillStyle = 'rgba(0,0,0,.6)'; x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 30;
    x.beginPath(); x.ellipse(place.x + place.w / 2 - (L.x - CW / 2) * .08, place.y + place.h - 6, place.w * .32, 16, 0, 0, Math.PI * 2); x.fill();
    x.restore();

    // light falling on the character (closer to the torch → smaller, brighter pool)
    lx.globalCompositeOperation = 'copy';
    lx.fillStyle = `rgb(${amb * 255 * .9},${amb * 255 * .95},${amb * 255 * 1.1})`; lx.fillRect(0, 0, CW, CH);
    lx.globalCompositeOperation = 'lighter';
    lx.globalAlpha = flick;
    tx.globalCompositeOperation = 'copy'; tx.drawImage(App.beamTexture(), L.x - R * 1.25, L.y - R * 1.25, R * 2.5, R * 2.5);
    tx.globalCompositeOperation = 'source-in'; tx.fillStyle = `rgb(${cr},${cg},${cb})`; tx.fillRect(0, 0, CW, CH);
    tx.globalCompositeOperation = 'source-over';
    lx.drawImage(tmp, 0, 0);
    lx.globalAlpha = 1;
    // the side facing away from the torch falls into shade
    const side = App.clamp((L.x - (place.x + place.w / 2)) / (place.w * 1.2), -1, 1);
    const sg = lx.createLinearGradient(place.x, 0, place.x + place.w, 0);
    sg.addColorStop(0, `rgba(0,0,0,${App.clamp(side, 0, 1) * .55})`);
    sg.addColorStop(1, `rgba(0,0,0,${App.clamp(-side, 0, 1) * .55})`);
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = sg; lx.fillRect(place.x, place.y, place.w, place.h);

    tx.globalCompositeOperation = 'copy'; tx.fillStyle = 'rgba(0,0,0,0)'; tx.fillRect(0, 0, CW, CH);
    tx.globalCompositeOperation = 'source-over';
    tx.drawImage(subj.img, place.x, place.y, place.w, place.h);
    tx.globalCompositeOperation = 'multiply'; tx.drawImage(litC, 0, 0);
    tx.globalCompositeOperation = 'destination-in'; tx.drawImage(subj.img, place.x, place.y, place.w, place.h);
    tx.globalCompositeOperation = 'source-over';
    x.drawImage(tmp, 0, 0);

    // dust motes glowing only inside the beam
    if (st.dust) {
      x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = `rgb(${cr},${cg},${cb})`;
      for (const p of dust) {
        p.x += Math.sin(t / 2100 + p.ph) * .3 * p.z; p.y += (.1 + Math.cos(t / 2500 + p.ph) * .12) * p.z;
        if (p.y > CH) p.y = 0; if (p.x < 0) p.x = CW; if (p.x > CW) p.x = 0;
        const d = Math.hypot(p.x - L.x, p.y - L.y) / R;
        if (d > 1) continue;
        x.globalAlpha = (1 - d) * .55 * flick;
        x.beginPath(); x.arc(p.x, p.y, p.z * 1.7, 0, Math.PI * 2); x.fill();
      }
      x.restore();
    }
    // eerie finish: deep vignette, cold cast, grain
    const v = x.createRadialGradient(CW / 2, CH / 2, CH * .25, CW / 2, CH / 2, CW * .72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,6,.8)');
    x.fillStyle = v; x.fillRect(0, 0, CW, CH);
    App.drawGrain(x, CW, CH, .25);
  }

  const tool = {
    id: 'stage', name: 'Spotlight Stage', short: 'Spotlight', icon: '◐',
    hint: 'A character stands in a dark room and your mouse is the flashlight: it lights them and throws their shadow on the wall — it grows, softens and slides as you move. A white-background or transparent PNG of a person works best.',
    cursor: 'none',

    build(box) {
      const U = App.ui;
      U.select(box, 'Backdrop', [['plaster', 'Old plaster wall'], ['curtain', 'Red stage curtain'], ['brick', 'Brick wall']], st.backdrop, v => { st.backdrop = v; });
      U.seg(box, 'Bulb', [['cold', 'Cold'], ['warm', 'Tungsten'], ['moon', 'Moonlight'], ['green', 'Sickly'], ['red', 'Red']], st.bulb, v => { st.bulb = v; });
      U.slider(box, 'Beam size', { min: 15, max: 90, value: st.beam }, v => { st.beam = v; });
      U.slider(box, 'Wall distance (shadow size)', { min: 0, max: 100, value: st.wall }, v => { st.wall = v; });
      U.slider(box, 'How dark the room is', { min: 0, max: 30, value: st.dark, format: v => 30 - v }, v => { st.dark = v; });
      U.slider(box, 'Character height', { min: 40, max: 90, value: st.height, format: v => v + '%' }, v => { st.height = v; if (subj) layout(); });
      U.toggle(box, 'Flicker', st.flicker, v => { st.flicker = v; });
      U.toggle(box, 'The shadow lags behind… (eerie)', st.lag, v => { st.lag = v; });
      U.toggle(box, 'Dust in the beam', st.dust, v => { st.dust = v; });
      U.heading(box, 'Cut-out');
      U.slider(box, 'White-background tolerance', { min: 5, max: 80, value: st.tol }, v => { st.tol = v; });
      U.buttons(box, [
        ['↻ Cut again', () => { if (App.A) findSubject(); }],
        ['✨ Click the person (AI)', () => { mode = 'pick'; }],
      ]);
      U.note(box, 'Transparent PNGs use their own cut-out. White backgrounds are keyed out automatically. Anything else: the AI finds the person (needs internet the first time).');
    },

    onImage() {
      App.resize(CW, CH);
      beamC = App.makeCanvas(CW, CH); bx = beamC.getContext('2d');
      litC = App.makeCanvas(CW, CH); lx = litC.getContext('2d');
      tmp = App.makeCanvas(CW, CH); tx = tmp.getContext('2d');
      makeDust();
      mode = 'stage';
      findSubject();
    },

    async down(p) {
      if (mode === 'pick') {
        const r = await picker.click(p);
        if (r) {
          const m = App.makeCanvas(App.A.width, App.A.height);
          m.getContext('2d').drawImage(r.mask, 0, 0);
          setSubject(m);
        }
        mode = 'stage';
      }
    },

    frame(t) {
      const x = App.ctx;
      x.setTransform(1, 0, 0, 1, 0, 0);
      App.canvas.style.cursor = mode === 'pick' ? 'crosshair' : 'none';
      if (mode === 'pick') { x.fillStyle = '#111'; x.fillRect(0, 0, CW, CH); picker.draw(x, CW, CH, true); return; }
      if (!subj) {
        x.fillStyle = '#0b0b0f'; x.fillRect(0, 0, CW, CH);
        x.font = '700 28px "Zen Maru Gothic", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#aaa';
        x.fillText(status || 'Preparing the stage…', CW / 2, CH / 2); x.textAlign = 'start';
        return;
      }
      let gx, gy;
      if (App.pointer.inside) { gx = App.pointer.x; gy = App.pointer.y; }
      else { const s = t / 3000; gx = CW / 2 + Math.sin(s) * CW * .3; gy = CH * .42 + Math.sin(s * 1.7) * CH * .15; }
      // a hand-held torch: a little lag and sway
      L.x = App.lerp(L.x, gx, .12) + Math.sin(t / 650) * .7;
      L.y = App.lerp(L.y, gy, .12) + Math.cos(t / 820) * .7;
      const lag = st.lag ? .025 : 1;
      S.x = App.lerp(S.x, L.x, lag); S.y = App.lerp(S.y, L.y, lag);
      draw(t);
    },
  };

  App.register(tool);
})();
