/* ▤ CCD Cam — your picture as if it were shot on an early-2000s CCD digicam and
   shown on the little screen on its back, lying on a tartan tablecloth. The
   photo gets the real CCD look: low resolution, punchy colour, blown highlights
   that bloom, purple fringing, vertical smear from bright lights, sensor noise,
   over-sharpening and JPEG blockiness. Click to "take" another shot. */
(function () {
  'use strict';
  const CW = 1400, CH = 1050;

  const st = { view: 'camera', cam: 'cam08', body: 'silver', cloth: 'red', flash: false, night: false, osd: true, wb: 'cool', res: 640 };

  let shot = null, shotKey = '', frameNo = 42, flashT = 0, seed = 1, clothC = null, clothKey = '';
  const glare = { x: .3, y: .2 };

  /* ---------- the CCD photo ---------- */
  function ccd() {
    const W = st.res, H = Math.round(W * .75);
    const A = App.A;
    // crop to 4:3 like the sensor, and shrink to the camera's real resolution
    const base = App.coverInto(A, W, H);
    const x = base.getContext('2d');
    const id = x.getImageData(0, 0, W, H), d = id.data;
    const r = App.rng(seed * 7919);
    const L = new Float32Array(W * H);
    const cx = W / 2, cy = H / 2, md = cx * cx + cy * cy;
    for (let y = 0, i = 0; y < H; y++) for (let xx = 0; xx < W; xx++, i++) {
      const k = i * 4;
      let R = d[k], G = d[k + 1], B = d[k + 2];
      if (st.flash) {
        // on-camera flash: the middle blasted bright, the background falls off fast
        const f = (xx - cx) ** 2 + (y - cy) ** 2;
        const m = 1.22 - f / md * .95;
        R *= m; G *= m; B *= m;
      }
      if (st.night) { R *= .55; G *= .55; B *= .6; }
      // punchy CCD colour: more contrast and saturation
      const l = .299 * R + .587 * G + .114 * B;
      R = l + (R - l) * 1.3; G = l + (G - l) * 1.3; B = l + (B - l) * 1.3;
      R = (R - 120) * 1.18 + 128; G = (G - 120) * 1.18 + 128; B = (B - 120) * 1.18 + 128;
      if (st.wb === 'cool') { R -= 6; B += 12; }
      else if (st.wb === 'warm') { R += 14; G += 4; B -= 12; }
      else if (st.wb === 'green') { G += 12; R -= 4; B -= 4; }     // fluorescent-light cast
      // sensor noise — chunkier and more coloured in the shadows
      const sh = 1 - App.clamp(l / 255, 0, 1);
      const nAmt = (st.night ? 34 : 12) * (.4 + sh);
      const n = (r() - .5) * nAmt;
      R += n + (r() - .5) * nAmt * .6; G += n; B += n + (r() - .5) * nAmt * .8;
      d[k] = R; d[k + 1] = G; d[k + 2] = B;
      L[i] = .299 * d[k] + .587 * d[k + 1] + .114 * d[k + 2];
    }
    x.putImageData(id, 0, 0);

    // over-sharpening halos (in-camera unsharp mask)
    const soft = App.blurred(base, 2).getContext('2d').getImageData(0, 0, W, H).data;
    const id2 = x.getImageData(0, 0, W, H), e = id2.data;
    for (let k = 0; k < e.length; k += 4) for (let c = 0; c < 3; c++) e[k + c] = e[k + c] + (e[k + c] - soft[k + c]) * .9;
    // JPEG: chroma smeared over 2×2, light 8×8 blockiness
    for (let by = 0; by < H; by += 8) for (let bx = 0; bx < W; bx += 8) {
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let y = by; y < Math.min(H, by + 8); y++) for (let xx = bx; xx < Math.min(W, bx + 8); xx++) { const k = (y * W + xx) * 4; sr += e[k]; sg += e[k + 1]; sb += e[k + 2]; n++; }
      sr /= n; sg /= n; sb /= n;
      for (let y = by; y < Math.min(H, by + 8); y++) for (let xx = bx; xx < Math.min(W, bx + 8); xx++) {
        const k = (y * W + xx) * 4;
        e[k] = e[k] * .86 + sr * .14; e[k + 1] = e[k + 1] * .9 + sg * .1; e[k + 2] = e[k + 2] * .84 + sb * .16;
      }
    }
    x.putImageData(id2, 0, 0);

    // blown highlights bloom and get a purple fringe; very bright spots smear vertically
    const hi = App.makeCanvas(W, H), hx = hi.getContext('2d'), hd = hx.createImageData(W, H);
    const colHot = new Uint16Array(W);
    for (let i = 0; i < W * H; i++) {
      const v = App.clamp((L[i] - 205) / 50, 0, 1);
      hd.data[i * 4] = hd.data[i * 4 + 1] = hd.data[i * 4 + 2] = 255; hd.data[i * 4 + 3] = v * 255;
      if (L[i] > 250) colHot[i % W]++;
    }
    hx.putImageData(hd, 0, 0);
    const bloom = App.blurred(hi, 8);
    const fringe = App.blurred(hi, 3);
    const fc = fringe.getContext('2d');
    fc.globalCompositeOperation = 'source-in'; fc.fillStyle = 'rgb(160,60,255)'; fc.fillRect(0, 0, W, H);
    fc.globalCompositeOperation = 'destination-out'; fc.drawImage(hi, 0, 0);
    x.save();
    x.globalCompositeOperation = 'screen';
    x.globalAlpha = .55; x.drawImage(bloom, 0, 0);
    x.globalAlpha = .45; x.drawImage(fringe, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'lighter';
    // only small, very bright spots smear (a whole bright sky would not)
    if (st.night) for (let xx = 0; xx < W; xx++) if (colHot[xx] > 1 && colHot[xx] < H * .03) { x.fillStyle = `rgba(255,240,240,${Math.min(.18, colHot[xx] / 40)})`; x.fillRect(xx, 0, 1, H); }
    x.restore();
    return base;
  }

  function getShot() {
    const key = [st.flash, st.night, st.wb, st.res, seed, App.A.width, App.A.height].join('|');
    if (!shot || key !== shotKey || shot.src !== App.A) { shot = { c: ccd(), src: App.A }; shotKey = key; }
    return shot.c;
  }

  /* ---------- tablecloth ---------- */
  // Real tartans are woven from a "sett": a list of thread colours and counts, mirrored, used for both
  // warp and weft. Where the two cross, the colours mix — that is what makes the checks look woven.
  const SETTS = {
    // Royal Stewart-style: big red squares, green / navy bands, fine white and yellow lines
    red: [['#e3171f', 96], ['#7a1018', 3], ['#e3171f', 8], ['#13151c', 3], ['#f4f1e6', 2], ['#13151c', 3],
      ['#e3171f', 8], ['#22357a', 3], ['#0e6a3b', 28], ['#13151c', 3], ['#f2c12e', 2], ['#13151c', 3], ['#0e6a3b', 10]],
    // Black Watch-style: deep green and navy with black, a thin red line
    green: [['#1f4d33', 40], ['#0e1424', 6], ['#1f4d33', 6], ['#0e1424', 6], ['#1f4d33', 6], ['#1b2550', 26],
      ['#0e1424', 8], ['#b8222b', 3], ['#0e1424', 8], ['#1b2550', 26], ['#0e1424', 6], ['#d9c46a', 2], ['#0e1424', 6]],
  };

  function settTile(sett, unit) {
    const stripes = sett.concat(sett.slice().reverse()); // a sett is mirrored around its pivots
    const L = stripes.reduce((a, s) => a + s[1], 0) * unit;
    const c = App.makeCanvas(L, L), x = c.getContext('2d');
    let p = 0;
    for (const [col, n] of stripes) { x.fillStyle = col; x.fillRect(p, 0, n * unit, L); p += n * unit; } // warp
    p = 0;
    x.globalAlpha = .5;                                                                                      // weft
    for (const [col, n] of stripes) { x.fillStyle = col; x.fillRect(0, p, L, n * unit); p += n * unit; }
    x.globalAlpha = 1;
    // 2/2 twill: thread-sized diagonal ribs
    for (let i = -L; i < L; i += unit * 2) {
      x.strokeStyle = 'rgba(0,0,0,.16)'; x.lineWidth = unit * .55;
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + L, L); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = unit * .3;
      x.beginPath(); x.moveTo(i + unit, 0); x.lineTo(i + unit + L, L); x.stroke();
    }
    return c;
  }

  function cloth() {
    if (clothC && clothKey === st.cloth) return clothC;
    clothKey = st.cloth;
    const c = App.makeCanvas(CW, CH), x = c.getContext('2d');
    if (st.cloth === 'gingham') {
      x.fillStyle = '#f4efe6'; x.fillRect(0, 0, CW, CH);
      x.globalAlpha = .4; x.fillStyle = '#c94b5a';
      for (let i = -92; i < CW + 92; i += 92) x.fillRect(i + 143, 0, 46, CH);
      for (let i = -92; i < CH + 92; i += 92) x.fillRect(0, i + 143, CW, 46);
      x.globalAlpha = 1;
    } else {
      // laid diagonally on the table, like a picnic cloth
      x.save();
      x.translate(CW / 2, CH / 2); x.rotate(Math.PI / 4);
      x.fillStyle = x.createPattern(settTile(SETTS[st.cloth] || SETTS.red, 1.15), 'repeat');
      x.fillRect(-CW, -CW, CW * 2, CW * 2);
      x.restore();
    }
    // fabric fuzz and a soft vignette, like a photo taken under a lamp
    const r = App.rng(2);
    for (let i = 0; i < 6000; i++) { x.fillStyle = r() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; x.fillRect(r() * CW, r() * CH, 2, 1); }
    const v = x.createRadialGradient(CW / 2, CH / 2, CH * .35, CW / 2, CH / 2, CW * .72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
    x.fillStyle = v; x.fillRect(0, 0, CW, CH);
    return (clothC = c);
  }

  /* ---------- camera templates (assets/cameras, cut out by scripts/cut-cameras.mjs) ---------- */
  const CAM_NAMES = {
    cam01: 'Cherry blossom Nikon', cam02: 'Pink sticker cam', cam03: 'Flip phone', cam04: 'Black cam with stickers',
    cam05: 'White mirrorless', cam06: 'Silver Canon', cam07: 'Rose gold', cam08: 'Pink flip screen',
    cam09: 'Silver compact', cam10: 'Tilted sticker cam', cam11: 'Pink mini',
  };
  const CAMS = { list: [], img: {}, loading: null };
  function loadCams() {
    if (!CAMS.loading) {
      CAMS.loading = fetch('assets/cameras/cameras.json')
        .then(r => (r.ok ? r.json() : []))
        .then(list => {
          CAMS.list = list;
          for (const c of list) { const im = new Image(); im.src = 'assets/cameras/' + c.file; CAMS.img[c.id] = im; }
          return list;
        })
        .catch(() => []);
    }
    return CAMS.loading;
  }
  const camReady = id => { const im = CAMS.img[id]; return !!(im && im.complete && im.naturalWidth); };
  const camItems = () => [['drawn', 'KiraShot (drawn)', null]].concat(CAMS.list.map(c => [c.id, CAM_NAMES[c.id] || c.id, 'assets/cameras/' + c.file]));

  /** A template camera on the cloth, with the shot mapped onto its screen's four corners. */
  function drawTemplate(x, img, cam, im) {
    const k = Math.min(CW * .8 / cam.w, CH * .8 / cam.h);
    const w = cam.w * k, h = cam.h * k, ox = (CW - w) / 2, oy = (CH - h) / 2;
    x.save();
    x.translate(CW / 2, CH / 2); x.rotate(-.04); x.translate(-CW / 2, -CH / 2);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    // 1. the camera and its shadow on the cloth
    x.save();
    x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 40; x.shadowOffsetX = 14; x.shadowOffsetY = 24;
    x.drawImage(im, ox, oy, w, h);
    x.restore();
    // 2. the LCD, clipped to the screen (grown a touch so it slides under the bezel)
    const P = cam.screen.map(([px, py]) => [ox + (px + .5) * k, oy + (py + .5) * k]);
    const [tl, tr, , bl] = P;
    const W = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]), H = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
    const cx = P.reduce((a, p) => a + p[0], 0) / 4, cy = P.reduce((a, p) => a + p[1], 0) / 4, grow = 1 + 8 / Math.min(W, H);
    x.save();
    x.beginPath();
    P.forEach(([px, py], i) => { const gx = cx + (px - cx) * grow, gy = cy + (py - cy) * grow; if (i) x.lineTo(gx, gy); else x.moveTo(gx, gy); });
    x.closePath(); x.clip();
    x.transform((tr[0] - tl[0]) / W, (tr[1] - tl[1]) / W, (bl[0] - tl[0]) / H, (bl[1] - tl[1]) / H, tl[0], tl[1]);
    drawScreen(x, { x: -6, y: -6, w: W + 12, h: H + 12 }, img);
    x.restore();
    // 3. the camera again on top, so its bezel overlaps the picture's edge
    x.drawImage(im, ox, oy, w, h);
    x.restore();
  }

  /* ---------- the camera ---------- */
  const BODIES = {
    silver: ['#f2f3f5', '#c4c8cf', '#8e949d'], pink: ['#ffe3ec', '#f2b3c6', '#c47d95'],
    black: ['#5a5c63', '#2d2f34', '#17181b'], mint: ['#e5f7ef', '#b5dfcc', '#7fb39c'],
  };

  function screenRect() { return { x: CW / 2 - 395, y: CH / 2 - 205, w: 480, h: 360 }; }

  function drawOSD(x, s) {
    const fs = Math.round(s.h * .055);
    x.save();
    x.font = `${fs}px "DotGothic16", monospace`;
    x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowOffsetX = 1; x.shadowOffsetY = 1;
    const pad = fs * .7;
    x.fillText('▶', s.x + pad, s.y + pad + fs * .8);
    x.fillText(`100-${String(frameNo).padStart(4, '0')}`, s.x + pad + fs * 1.4, s.y + pad + fs * .8);
    // battery
    const bxx = s.x + s.w - pad - fs * 1.8, byy = s.y + pad;
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(bxx, byy, fs * 1.5, fs * .8);
    x.fillRect(bxx + fs * 1.5, byy + fs * .25, fs * .15, fs * .3);
    x.fillRect(bxx + 3, byy + 3, fs * .9, fs * .8 - 6);
    const now = new Date();
    const date = `2004/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    x.fillText(date, s.x + pad, s.y + s.h - pad);
    x.textAlign = 'right';
    x.fillText(`${st.res === 640 ? '640x480' : st.res === 1024 ? '1024x768' : '320x240'}  ★`, s.x + s.w - pad, s.y + s.h - pad);
    if (st.flash) x.fillText('⚡', s.x + s.w - pad, s.y + pad + fs * 2.2);
    x.restore();
  }

  function drawScreen(x, s, img) {
    x.save();
    x.beginPath(); App.roundRect(x, s.x, s.y, s.w, s.h, 6); x.clip();
    x.fillStyle = '#000'; x.fillRect(s.x, s.y, s.w, s.h);
    x.imageSmoothingEnabled = true;
    // a cheap LCD: slightly washed out and blue. Cover-fit, so tall or wide screens never stretch the photo.
    const ks = Math.max(s.w / img.width, s.h / img.height), sw = s.w / ks, sh = s.h / ks;
    x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, s.x, s.y, s.w, s.h);
    x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(20,30,60,.22)'; x.fillRect(s.x, s.y, s.w, s.h);
    x.globalCompositeOperation = 'source-over';
    if (st.osd) drawOSD(x, s);
    // pixel grid
    x.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = s.x; i < s.x + s.w; i += 3) x.fillRect(i, s.y, 1, s.h);
    for (let j = s.y; j < s.y + s.h; j += 3) x.fillRect(s.x, j, s.w, 1);
    // glare on the plastic screen cover, following the mouse
    const gx = s.x + s.w * glare.x, gy = s.y + s.h * glare.y;
    const g = x.createLinearGradient(gx - s.w * .5, gy - s.h * .5, gx + s.w * .5, gy + s.h * .5);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.46, 'rgba(255,255,255,0)');
    g.addColorStop(.5, 'rgba(255,255,255,.22)'); g.addColorStop(.58, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(s.x, s.y, s.w, s.h);
    const r = App.rng(6);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(s.x + r() * s.w, s.y + r() * s.h, r() * 1.6, 0, Math.PI * 2); x.fill(); }
    x.restore();
  }

  function metal(x, x0, y0, x1, y1, cols) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, cols[0]); g.addColorStop(.45, cols[1]); g.addColorStop(.55, cols[0]); g.addColorStop(1, cols[2]);
    return g;
  }

  function drawCamera(x, img) {
    const M = BODIES[st.body];
    const bw = 900, bh = 560, bx0 = CW / 2 - bw / 2, by0 = CH / 2 - bh / 2;
    x.save();
    x.translate(CW / 2, CH / 2); x.rotate(-.05); x.translate(-CW / 2, -CH / 2);

    // wrist strap with a little charm
    x.save();
    x.strokeStyle = '#1d1d22'; x.lineWidth = 18; x.lineCap = 'round';
    x.beginPath(); x.moveTo(bx0 + bw - 20, by0 + 90); x.bezierCurveTo(bx0 + bw + 160, by0 + 40, bx0 + bw + 230, by0 + 330, bx0 + bw + 110, by0 + 420); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#ff7fa6'; Shapes.trace(x, 'heart', bx0 + bw + 112, by0 + 446, 26, .2); x.fill();
    x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(bx0 + bw + 104, by0 + 436, 6, 0, Math.PI * 2); x.fill();
    x.restore();

    // body
    x.save();
    x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 50; x.shadowOffsetX = 18; x.shadowOffsetY = 30;
    x.beginPath(); App.roundRect(x, bx0, by0, bw, bh, 70);
    x.fillStyle = metal(x, bx0, by0, bx0 + bw * .4, by0 + bh, M); x.fill();
    x.restore();
    // brushed lines + edge highlight
    x.save();
    x.beginPath(); App.roundRect(x, bx0, by0, bw, bh, 70); x.clip();
    x.strokeStyle = 'rgba(255,255,255,.07)'; x.lineWidth = 1;
    for (let i = by0; i < by0 + bh; i += 2) { x.beginPath(); x.moveTo(bx0, i); x.lineTo(bx0 + bw, i + .6); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 4;
    x.beginPath(); App.roundRect(x, bx0 + 3, by0 + 3, bw - 6, bh - 6, 66); x.stroke();
    x.restore();

    // screen bezel and the screen
    const s = screenRect();
    x.fillStyle = '#121316';
    x.beginPath(); App.roundRect(x, s.x - 22, s.y - 22, s.w + 44, s.h + 44, 18); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.stroke();
    drawScreen(x, s, img);

    // optical viewfinder + LED
    x.fillStyle = '#0b0c0e'; x.beginPath(); App.roundRect(x, s.x + s.w + 60, by0 + 40, 110, 70, 14); x.fill();
    const vg = x.createLinearGradient(s.x + s.w + 60, by0 + 40, s.x + s.w + 170, by0 + 110);
    vg.addColorStop(0, 'rgba(120,140,190,.5)'); vg.addColorStop(.5, 'rgba(0,0,0,0)');
    x.fillStyle = vg; x.beginPath(); App.roundRect(x, s.x + s.w + 66, by0 + 46, 98, 58, 10); x.fill();
    x.fillStyle = '#52ff7a'; x.shadowColor = '#52ff7a'; x.shadowBlur = 12;
    x.beginPath(); x.arc(s.x + s.w + 200, by0 + 74, 6, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;

    // control pad
    const px = s.x + s.w + 150, py = by0 + 300;
    x.fillStyle = metal(x, px - 90, py - 90, px + 90, py + 90, ['#ffffff', '#b9bec6', '#7c828b']);
    x.beginPath(); x.arc(px, py, 88, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#2b2d33'; x.font = '18px "DotGothic16", monospace'; x.textAlign = 'center';
    x.fillText('⚡', px, py - 56); x.fillText('◀', px - 62, py + 6); x.fillText('▶', px + 62, py + 6); x.fillText('▼', px, py + 70);
    x.fillStyle = metal(x, px - 34, py - 34, px + 34, py + 34, M);
    x.beginPath(); x.arc(px, py, 34, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.stroke();
    x.fillStyle = '#2b2d33'; x.font = '15px "DotGothic16", monospace'; x.fillText('FUNC', px, py - 2); x.fillText('SET', px, py + 16);
    // small buttons
    const labels = ['MENU', 'DISP.', '▶', '🗑'];
    labels.forEach((l, i) => {
      const yy = by0 + 160 + i * 0, xx = s.x + s.w + 70 + i * 62;
      x.fillStyle = '#d7dbe1'; x.beginPath(); App.roundRect(x, xx, by0 + 430, 46, 24, 12); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.3)'; x.stroke();
      x.fillStyle = '#4a4d55'; x.font = '13px "DotGothic16", monospace'; x.fillText(l, xx + 23, by0 + 470);
      void yy;
    });
    // branding (made up)
    x.textAlign = 'left';
    x.fillStyle = st.body === 'black' ? 'rgba(255,255,255,.75)' : 'rgba(40,42,48,.75)';
    x.font = 'italic 700 30px Georgia, serif';
    x.fillText('KiraShot', s.x - 4, s.y + s.h + 64);
    x.font = '14px "DotGothic16", monospace';
    x.fillText('DIGITAL  ·  4.0 MEGA PIXELS  ·  3× ZOOM', s.x + 150, s.y + s.h + 62);
    x.textAlign = 'start';
    x.restore();
  }

  /* ---------- tool ---------- */
  const tool = {
    id: 'ccd', name: 'CCD Cam', short: 'CCD Cam', icon: '▤',
    hint: 'Your picture as an early-2000s CCD digicam shot, shown on the little screen on the back of the camera — punchy colour, blown highlights, purple fringing, sensor noise, JPEG blocks. Click to take another shot.',
    cursor: 'pointer',

    build(box) {
      const U = App.ui;
      const nextCam = () => {
        const ids = camItems().map(i => i[0]);
        st.cam = ids[(ids.indexOf(st.cam) + 1) % ids.length]; st.view = 'camera';
        if (picker) picker.set(st.cam);
        if (showSeg) showSeg.set('camera');
      };
      U.buttons(box, [['📷 Next camera', nextCam], ['📸 Take another shot', () => { seed++; frameNo++; flashT = 1; }]]);
      const picker = U.pictures ? U.pictures(box, 'Camera', camItems(), st.cam, v => { st.cam = v; st.view = 'camera'; if (showSeg) showSeg.set('camera'); }) : null;
      if (picker && !CAMS.list.length) loadCams().then(() => picker.setItems(camItems(), st.cam));
      U.seg(box, 'Tablecloth', [['red', 'Red tartan'], ['green', 'Green tartan'], ['gingham', 'Gingham']], st.cloth, v => { st.cloth = v; });
      const showSeg = U.seg(box, 'Show', [['camera', '📷 On the camera'], ['photo', '🖼 Just the photo']], st.view, v => { st.view = v; });
      U.seg(box, 'Camera colour', [['silver', 'Silver'], ['pink', 'Pink'], ['mint', 'Mint'], ['black', 'Black']], st.body, v => {
        st.body = v; st.cam = 'drawn'; if (picker) picker.set('drawn'); // colours belong to the drawn KiraShot
      });
      U.heading(box, 'The shot');
      U.toggle(box, 'Built-in flash', st.flash, v => { st.flash = v; });
      U.toggle(box, 'Night (noisy)', st.night, v => { st.night = v; });
      U.seg(box, 'White balance', [['cool', 'Auto (cool)'], ['warm', 'Indoor'], ['green', 'Fluorescent'], ['none', 'Neutral']], st.wb, v => { st.wb = v; });
      U.seg(box, 'Resolution', [['320', '320×240'], ['640', '640×480'], ['1024', '1024×768']], String(st.res), v => { st.res = +v; });
      U.toggle(box, 'Screen icons (frame no., battery, date)', st.osd, v => { st.osd = v; });
    },

    onImage() { App.resize(CW, CH); shot = null; loadCams(); },

    down() { seed++; frameNo++; flashT = 1; },
    move(p) { glare.x = .1 + p.x / CW * .8; glare.y = .1 + p.y / CH * .8; },

    frame() {
      const x = App.ctx;
      x.setTransform(1, 0, 0, 1, 0, 0);
      const img = getShot();
      if (st.view === 'photo') {
        // the photo on its own, as it would come off the memory card
        x.fillStyle = '#111'; x.fillRect(0, 0, CW, CH);
        const s = Math.min(CW * .92 / img.width, CH * .92 / img.height);
        const w = img.width * s, h = img.height * s;
        x.imageSmoothingEnabled = st.res > 320;
        x.drawImage(img, (CW - w) / 2, (CH - h) / 2, w, h);
        x.imageSmoothingEnabled = true;
        if (st.osd) {
          x.font = '28px "DotGothic16", monospace'; x.fillStyle = 'rgba(255,150,60,.95)'; x.textAlign = 'right';
          x.shadowColor = 'rgba(255,90,0,.8)'; x.shadowBlur = 8;
          const now = new Date();
          x.fillText(`'04 ${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}`, (CW + w) / 2 - 30, (CH + h) / 2 - 26);
          x.shadowBlur = 0; x.textAlign = 'start';
        }
      } else {
        x.drawImage(cloth(), 0, 0);
        const cam = st.cam !== 'drawn' && CAMS.list.find(c => c.id === st.cam);
        if (cam && camReady(cam.id)) drawTemplate(x, img, cam, CAMS.img[cam.id]);
        else drawCamera(x, img); // the drawn KiraShot (also while a template is still loading)
      }
      if (flashT > 0) {
        x.fillStyle = `rgba(255,255,255,${flashT})`; x.fillRect(0, 0, CW, CH);
        flashT = Math.max(0, flashT - .08);
      }
    },
  };

  App.register(tool);
})();
