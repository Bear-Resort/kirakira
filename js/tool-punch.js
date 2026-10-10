/* ✂ Paper Punch — a last-century cut-and-paste studio. Shapes are punched out of a
   faded film print (cold blue '89, warm '77, Xerox, newsprint…) and the little
   pieces float on the paper. Drag pieces, cut your own with the scissors, add a
   date imprint, masking tape and a typewriter / label-maker / ransom-note caption.
   "Confetti" mode cuts the whole picture into a mosaic of shapes instead. */
(function () {
  'use strict';
  const CW = 1800, CH = 1150;

  const st = {
    mode: 'punch', shape: 'circle', size: 24, count: 26, scatter: 35,
    bg: 'plain', bgColor: '#f8d7e3', edge: false, tape: 'masking',
    film: 'cold', photoEdge: 'white', arrange: 'above', dateOn: true, date: "'98 10 09", grain: true,
    caption: 'saturday late edition', capStyle: 'typewriter', seed: 1,
    cutTool: 'move', pinking: false, blank: false,
  };

  let pieces = [];
  let card = null;          // {x, y, w, h, b} — photo card rect and border
  let cardImg = null;       // picture scaled to the card's inner size
  let bgCache = null, bgKey = '';
  let cardLayer = null;     // card with holes, rebuilt when a piece is moved in/out
  let dirty = true;
  let drag = null;          // {p, dx, dy, under: snapshot}
  let cutting = null;       // scissors in progress: {pts, under}
  let punching = null;      // punch in progress: {x, y, r, shape, rot, under}
  let styleSeg = null;
  // tape strips and the caption label can be dragged around; positions are kept
  // relative to the photo so they follow it
  let deco = null, decoDrag = null;
  // the photo print itself can be dragged around the page too
  let cardOff = { x: 0, y: 0 }, cardDrag = null;

  const mixedPool = ['circle', 'triangle', 'heart', 'star', 'sparkle'];

  /* ---------- background papers ---------- */
  function buildBg() {
    const key = st.bg + st.bgColor;
    if (bgCache && bgKey === key) return bgCache;
    bgKey = key;
    const c = App.makeCanvas(CW, CH), x = c.getContext('2d');
    const r = App.rng(11);
    const speckle = (col, n, max) => {
      x.fillStyle = col;
      for (let i = 0; i < n; i++) { x.globalAlpha = r() * .5; x.fillRect(r() * CW, r() * CH, r() * max + .5, r() * max + .5); }
      x.globalAlpha = 1;
    };
    if (st.bg === 'plain') {
      // matte off-white art paper, like the reference
      x.fillStyle = '#f5f3ee'; x.fillRect(0, 0, CW, CH);
      speckle('#cfc8b8', 3000, 1.6);
      x.strokeStyle = 'rgba(150,140,120,.06)';
      for (let i = 0; i < 900; i++) { x.lineWidth = r(); const sx = r() * CW, sy = r() * CH; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + r() * 30 - 15, sy + r() * 6 - 3); x.stroke(); }
    } else if (st.bg === 'newspaper') {
      x.fillStyle = '#ece5d3'; x.fillRect(0, 0, CW, CH);
      speckle('#9c927c', 4000, 2);
      x.fillStyle = '#1f1d1a'; x.textAlign = 'center';
      x.font = '900 104px "Times New Roman", Georgia, serif';
      x.fillText('The Daily Cut', CW / 2, 128);
      x.font = '20px "Special Elite", "Courier New", monospace';
      x.fillText('SATURDAY  ·  LATE EDITION  ·  OCT 22 1977  ·  FIVE CENTS', CW / 2, 172);
      x.textAlign = 'start';
      x.fillRect(60, 148, CW - 120, 3); x.fillRect(60, 188, CW - 120, 2); x.fillRect(60, 193, CW - 120, 1);
      // columns of "text"
      const colW = (CW - 120 - 5 * 24) / 6;
      for (let cI = 0; cI < 6; cI++) {
        const cx = 60 + cI * (colW + 24);
        x.fillStyle = 'rgba(30,28,25,.75)';
        x.font = '700 26px Georgia, serif';
        x.fillText(['LOCAL GIRL', 'CUT & KEEP', 'STARS SEEN', 'NEW MOON', 'OC CLUB', 'WEATHER'][cI], cx, 236);
        for (let y = 262; y < CH - 40; y += 15) {
          if (r() < .06) { y += 12; continue; }
          let xx = cx;
          while (xx < cx + colW - 8) {
            const ww = 10 + r() * 46;
            x.fillStyle = `rgba(40,36,30,${.22 + r() * .18})`;
            x.fillRect(xx, y, Math.min(ww, cx + colW - xx), 7);
            xx += ww + 6;
          }
        }
        if (cI < 5) { x.fillStyle = 'rgba(30,28,25,.4)'; x.fillRect(cx + colW + 11, 214, 1.5, CH - 260); }
      }
    } else if (st.bg === 'aged') {
      x.fillStyle = '#efe2c4'; x.fillRect(0, 0, CW, CH);
      speckle('#a88d5c', 3500, 2);
      // foxing spots and darkened edges
      for (let i = 0; i < 60; i++) {
        const fx = r() * CW, fy = r() * CH, fr = 4 + r() * 30;
        const g = x.createRadialGradient(fx, fy, 0, fx, fy, fr);
        g.addColorStop(0, `rgba(150,100,40,${.15 + r() * .2})`); g.addColorStop(1, 'rgba(150,100,40,0)');
        x.fillStyle = g; x.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
      }
      const v = x.createRadialGradient(CW / 2, CH / 2, CH * .3, CW / 2, CH / 2, CW * .7);
      v.addColorStop(0, 'rgba(120,80,30,0)'); v.addColorStop(1, 'rgba(120,80,30,.45)');
      x.fillStyle = v; x.fillRect(0, 0, CW, CH);
    } else if (st.bg === 'notebook') {
      x.fillStyle = '#fdfaf2'; x.fillRect(0, 0, CW, CH);
      speckle('#c9bba0', 2500, 2);
      x.strokeStyle = 'rgba(90,140,210,.38)'; x.lineWidth = 2;
      for (let y = 120; y < CH; y += 42) { x.beginPath(); x.moveTo(0, y); x.lineTo(CW, y); x.stroke(); }
      x.strokeStyle = 'rgba(230,80,90,.55)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(130, 0); x.lineTo(130, CH); x.stroke();
      x.fillStyle = '#e3dccd';
      for (const y of [CH * .18, CH * .5, CH * .82]) {
        x.beginPath(); x.arc(56, y, 22, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.arc(58, y + 3, 22, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#e3dccd';
      }
    } else if (st.bg === 'grid') {
      x.fillStyle = '#fbfbf7'; x.fillRect(0, 0, CW, CH);
      x.strokeStyle = 'rgba(100,160,150,.28)'; x.lineWidth = 1.5;
      for (let i = 0; i < CW; i += 36) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, CH); x.stroke(); }
      for (let i = 0; i < CH; i += 36) { x.beginPath(); x.moveTo(0, i); x.lineTo(CW, i); x.stroke(); }
    } else if (st.bg === 'dots') {
      x.fillStyle = '#fffaf0'; x.fillRect(0, 0, CW, CH);
      x.fillStyle = 'rgba(60,50,80,.25)';
      for (let i = 18; i < CW; i += 36) for (let j = 18; j < CH; j += 36) { x.beginPath(); x.arc(i, j, 2.4, 0, Math.PI * 2); x.fill(); }
    } else if (st.bg === 'kraft') {
      x.fillStyle = '#c8a479'; x.fillRect(0, 0, CW, CH);
      speckle('#8a6a44', 5000, 3); speckle('#e7cfa6', 3000, 2);
      x.strokeStyle = 'rgba(110,80,40,.12)';
      for (let i = 0; i < 600; i++) {
        x.lineWidth = r() * 2;
        const sx = r() * CW, sy = r() * CH;
        x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + r() * 40 - 20, sy + r() * 10 - 5); x.stroke();
      }
    } else if (st.bg === 'mat') {
      x.fillStyle = '#2f6e57'; x.fillRect(0, 0, CW, CH);
      x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1;
      for (let i = 0; i < CW; i += 30) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, CH); x.stroke(); }
      for (let i = 0; i < CH; i += 30) { x.beginPath(); x.moveTo(0, i); x.lineTo(CW, i); x.stroke(); }
      x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 2;
      for (let i = 0; i < CW; i += 150) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, CH); x.stroke(); }
      for (let i = 0; i < CH; i += 150) { x.beginPath(); x.moveTo(0, i); x.lineTo(CW, i); x.stroke(); }
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '18px "DotGothic16", monospace';
      for (let i = 0, n = 0; i < CW; i += 150, n++) x.fillText(n, i + 4, 20);
      x.strokeStyle = 'rgba(255,255,255,.25)';
      x.beginPath(); x.moveTo(0, CH); x.lineTo(CH, 0); x.stroke();
    } else {
      x.fillStyle = st.bgColor; x.fillRect(0, 0, CW, CH);
      speckle('rgba(0,0,0,.25)', 1500, 2);
    }
    bgCache = c;
    return c;
  }

  /* ---------- layout ---------- */
  function overlaps(list, x, y, r, gap) {
    for (const q of list) {
      const dx = q.x - x, dy = q.y - y, m = q.r + r + gap;
      if (dx * dx + dy * dy < m * m) return true;
    }
    return false;
  }

  function layout() {
    const A = App.A;
    const rand = App.rng(st.seed * 977 + 13);
    const own = st.mode === 'punch' ? pieces.filter(p => p.user) : [];
    pieces = [];
    const pickShape = () => st.shape === 'mixed' ? mixedPool[Math.floor(rand() * mixedPool.length)] : st.shape;

    if (st.mode === 'punch') {
      const above = st.arrange === 'above';
      const maxW = above ? CW * .66 : CW * .54, maxH = above ? CH * .56 : CH - 260;
      const s = Math.min(maxW / A.width, maxH / A.height);
      const w = A.width * s, h = A.height * s, b = st.photoEdge === 'none' ? 0 : Math.round(Math.min(w, h) * .035) + 8;
      card = above ? { x: (CW - w) / 2, y: CH - h - b - 70, w, h, b } : { x: 190, y: (CH - h) / 2 - 30, w, h, b };
      card.x += cardOff.x; card.y += cardOff.y;
      makeCardImg();

      const base = punchSize();
      const holes = [];
      for (let i = 0, tries = 0; i < (st.blank ? 0 : st.count) && tries < 4000; tries++) {
        const r = base * (.75 + rand() * .5);
        const hx = card.x + r * 1.1 + rand() * (w - r * 2.2);
        const hy = card.y + r * 1.1 + rand() * (h - r * 2.2);
        if (overlaps(holes, hx, hy, r, r * .25)) continue;
        holes.push({ x: hx, y: hy, r });
        i++;
      }
      // scatter the pieces in the free space next to the card
      const placed = [];
      const freeX0 = card.x + w + b + 40;
      const top0 = 40, top1 = card.y - b - 30;
      for (const hole of holes) {
        let x = 0, y = 0, ok = false;
        for (let t = 0; t < 600 && !ok; t++) {
          x = App.lerp(freeX0 + hole.r, CW - hole.r - 40, rand());
          y = App.lerp(hole.r + 50, CH - hole.r - 50, rand());
          if (above) {
            // a loose cloud of dots drifting above the print
            const spread = Math.max(w + 160, CW * .55);
            x = App.clamp(card.x + w / 2 + (rand() - .5) * spread * (rand() * .5 + .5), hole.r + 30, CW - hole.r - 30);
            y = top1 - hole.r > top0 + hole.r ? App.lerp(top0 + hole.r, top1 - hole.r, Math.pow(rand(), .8)) : App.lerp(hole.r + 40, CH - hole.r - 40, rand());
            ok = !overlaps(placed, x, y, hole.r, 6) && (y + hole.r < card.y - b - 10 || x + hole.r < card.x - b || x - hole.r > card.x + w + b);
            continue;
          }
          if (freeX0 > CW - 200) {           // very wide picture: use the strip under the card instead
            x = App.lerp(card.x + hole.r, CW - hole.r - 40, rand());
            y = App.lerp(card.y + h + b + hole.r + 20, CH - hole.r - 10, rand());
          }
          ok = !overlaps(placed, x, y, hole.r, 12);
        }
        placed.push({ x, y, r: hole.r });
        const rot0 = rand() * Math.PI * 2;
        pieces.push({ shape: pickShape(), r: hole.r, hx: hole.x, hy: hole.y, rot0, x, y, d: (rand() - .5) * 1.2, home: false });
      }
      pieces.push(...own);
    } else {
      // confetti mosaic: tile the whole picture with shapes
      const maxW = CW - 260, maxH = CH - 220;
      const s = Math.min(maxW / A.width, maxH / A.height);
      const w = A.width * s, h = A.height * s;
      card = { x: (CW - w) / 2, y: (CH - h) / 2 - 20, w, h, b: 0 };
      makeCardImg();
      const g = 42 + st.size / 100 * 110;
      const jit = st.scatter / 100;
      const add = (shape, hx, hy, r, rot0) => {
        if (hx < card.x - r * .3 || hx > card.x + w + r * .3 || hy < card.y - r * .3 || hy > card.y + h + r * .3) return;
        pieces.push({
          shape, r, hx, hy, rot0,
          x: hx + (rand() - .5) * g * jit * 1.2, y: hy + (rand() - .5) * g * jit * 1.2,
          d: (rand() - .5) * jit * 1.1, home: false,
        });
      };
      if (st.shape === 'triangle') {
        const side = g * 1.15, rh = side * Math.sqrt(3) / 2, R = side / Math.sqrt(3) * .9;
        for (let j = 0, top = card.y; top < card.y + h; j++, top += rh) {
          for (let k = 0; k * side / 2 < w + side; k++) {
            const up = (k + j) % 2 === 0;
            add('triangle', card.x + k * side / 2, top + (up ? rh * 2 / 3 : rh / 3), R, up ? 0 : Math.PI);
          }
        }
      } else if (st.shape === 'circle') {
        const r = g / 2 * .94, dy = g * .87;
        for (let j = 0, y = card.y + r; y < card.y + h + r; j++, y += dy) {
          for (let x = card.x + r + (j % 2 ? g / 2 : 0); x < card.x + w + r; x += g) add('circle', x, y, r, 0);
        }
      } else if (st.shape === 'square') {
        for (let y = card.y + g / 2; y < card.y + h + g / 2; y += g) {
          for (let x = card.x + g / 2; x < card.x + w + g / 2; x += g) add('square', x, y, g / 2 * .98, 0);
        }
      } else {
        const dy = g * .9;
        for (let j = 0, y = card.y + g / 2; y < card.y + h + g / 2; j++, y += dy) {
          for (let x = card.x + g / 2 + (j % 2 ? g / 2 : 0); x < card.x + w + g / 2; x += g) {
            add(pickShape(), x, y, g * .56, (rand() - .5) * .6);
          }
        }
      }
    }
    buildCardLayer();
    dirty = true;
  }

  function makeCardImg() {
    cardImg = App.makeCanvas(card.w, card.h);
    const x = cardImg.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(App.A, 0, 0, card.w, card.h);
    filmStock(cardImg);
    if (st.dateOn && st.date && st.film !== 'halftone' && st.film !== 'xerox') dateImprint(cardImg);
  }

  // Old print processes, done per pixel.
  function filmStock(c) {
    if (st.film === 'none') return;
    const x = c.getContext('2d'), w = c.width, h = c.height;
    if (st.film === 'halftone') { halftone(c); return; }
    const id = x.getImageData(0, 0, w, h), d = id.data;
    const r = App.rng(31);
    const cx = w / 2, cy = h / 2, md = cx * cx + cy * cy;
    for (let y = 0, i = 0; y < h; y++) for (let xx = 0; xx < w; xx++, i += 4) {
      let R = d[i], G = d[i + 1], B = d[i + 2];
      const l = .299 * R + .587 * G + .114 * B;
      const n = (r() - .5) * 26;
      if (st.film === 'cold') {
        // faded cyan-blue print: low saturation, lifted blue shadows
        R = l + (R - l) * .42; G = l + (G - l) * .42; B = l + (B - l) * .42;
        R = (R - 128) * 1.08 + 128; G = (G - 128) * 1.08 + 128; B = (B - 128) * 1.08 + 128;
        R = R * .78 + 8; G = G * .9 + 20; B = B * .94 + 44;
      } else if (st.film === 'warm') {
        R = l + (R - l) * .8; G = l + (G - l) * .8; B = l + (B - l) * .8;
        R = R * .88 + 34; G = G * .86 + 22; B = B * .74 + 14;
      } else if (st.film === 'sepia') {
        const v = (l - 128) * 1.1 + 128;
        R = v * 1.02 + 22; G = v * .86 + 14; B = v * .64 + 8;
      } else if (st.film === 'mono') {
        const v = (l - 128) * 1.25 + 128;
        R = v + 4; G = v + 2; B = v;
      } else if (st.film === 'xerox') {
        // photocopy: harsh threshold with toner noise, grey paper
        const t = (l - 128) * 1.6 + 128 + (r() - .5) * 90;
        const v = t > 120 ? 232 : 26;
        R = v; G = v - 2; B = v - 8;
        if (r() < .004) R = G = B = 30;
      }
      // a little vignette, like a cheap lens
      const dx = xx - cx, dy = y - cy, vg = 1 - .28 * ((dx * dx + dy * dy) / md);
      if (st.film !== 'xerox') { R = R * vg + n; G = G * vg + n; B = B * vg + n; }
      d[i] = R; d[i + 1] = G; d[i + 2] = B;
    }
    x.putImageData(id, 0, 0);
    if (st.film === 'warm') {
      // light leak from the left edge
      x.save(); x.globalCompositeOperation = 'screen';
      const g = x.createRadialGradient(-w * .05, h * .3, 0, -w * .05, h * .3, w * .55);
      g.addColorStop(0, 'rgba(255,120,40,.75)'); g.addColorStop(.5, 'rgba(255,80,30,.25)'); g.addColorStop(1, 'rgba(255,80,30,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h); x.restore();
    }
  }

  function halftone(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    const src = App.makeCanvas(w, h); src.getContext('2d').drawImage(c, 0, 0);
    const cell = Math.max(5, Math.round(Math.min(w, h) / 120));
    const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
    const sm = App.makeCanvas(cols, rows), sx = sm.getContext('2d');
    sx.drawImage(src, 0, 0, cols, rows);
    const d = sx.getImageData(0, 0, cols, rows).data;
    x.fillStyle = '#ece4cf'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1e1c1a';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4, l = (.299 * d[k] + .587 * d[k + 1] + .114 * d[k + 2]) / 255;
      const rr = cell * .62 * Math.sqrt(1 - l);
      if (rr < .3) continue;
      x.beginPath(); x.arc(i * cell + (j % 2 ? cell / 2 : 0), j * cell, rr, 0, Math.PI * 2); x.fill();
    }
  }

  // the orange date a film camera burns into the corner of the frame
  function dateImprint(c) {
    const x = c.getContext('2d'), fs = Math.round(Math.max(18, c.height * .052));
    x.save();
    x.font = `${fs}px "DotGothic16", "Courier New", monospace`;
    x.textAlign = 'right';
    x.shadowColor = 'rgba(255,90,0,.9)'; x.shadowBlur = fs * .35;
    x.fillStyle = 'rgba(255,160,70,.92)';
    const t = st.date.split('').join(String.fromCharCode(8202));
    x.fillText(t, c.width - fs * 1.1, c.height - fs * .9);
    x.shadowBlur = 0; x.globalAlpha = .5; x.fillStyle = '#ffe3b0';
    x.fillText(t, c.width - fs * 1.1, c.height - fs * .9);
    x.restore();
  }

  function punchSize() { return Math.min(card.w, card.h) * (.05 + st.size / 100 * .13); }

  // Path of a piece centred at (x, y). Punched pieces use a named shape; pieces you
  // cut with the scissors carry their own outline (p.poly, relative to the hole centre).
  function tracePiece(c, p, x, y, rot, keep) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    if (!keep) c.beginPath();
    if (p.poly) {
      c.moveTo(p.poly[0][0], p.poly[0][1]);
      for (let i = 1; i < p.poly.length; i++) c.lineTo(p.poly[i][0], p.poly[i][1]);
      c.closePath();
    } else Shapes[p.shape](c, p.r);
    c.restore();
  }

  /* ---------- drawing ---------- */
  function buildCardLayer() {
    cardLayer = null;
    if (st.mode !== 'punch') return;
    const { x: cx, y: cy, w, h, b } = card;
    const c = App.makeCanvas(CW, CH), x = c.getContext('2d');
    if (b) {
      x.fillStyle = st.film === 'warm' || st.film === 'sepia' ? '#f4ecd9' : '#f8f6f0';
      if (st.photoEdge === 'deckled') { deckle(x, cx - b, cy - b, w + b * 2, h + b * 2, b * .32, b * .75); x.fill(); }
      else x.fillRect(cx - b, cy - b, w + b * 2, h + b * 2);
    }
    x.drawImage(cardImg, cx, cy);
    // punch the holes out of the card (pieces that are back home fill their hole)
    x.globalCompositeOperation = 'destination-out';
    for (const p of pieces) if (!p.home) { tracePiece(x, p, p.hx, p.hy, p.rot0); x.fill(); }
    x.globalCompositeOperation = 'source-over';
    cardLayer = c;
  }

  // scalloped "deckle edge" border of old photo prints
  function deckle(x, rx, ry, rw, rh, amp, step) {
    x.beginPath();
    const side = (x0, y0, x1, y1, ox, oy) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / step));
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
        x.quadraticCurveTo(App.lerp(x0, x1, tm) + ox * amp, App.lerp(y0, y1, tm) + oy * amp, App.lerp(x0, x1, t1), App.lerp(y0, y1, t1));
      }
    };
    x.moveTo(rx, ry);
    side(rx, ry, rx + rw, ry, 0, -1);
    side(rx + rw, ry, rx + rw, ry + rh, 1, 0);
    side(rx + rw, ry + rh, rx, ry + rh, 0, 1);
    side(rx, ry + rh, rx, ry, -1, 0);
    x.closePath();
  }

  function drawCard(x) {
    if (st.mode !== 'punch') {
      // a faint pencil outline where the picture used to be
      x.save();
      x.strokeStyle = 'rgba(60,50,80,.25)'; x.setLineDash([6, 8]); x.lineWidth = 2;
      x.strokeRect(card.x, card.y, card.w, card.h);
      x.restore();
      return;
    }
    x.save();
    x.shadowColor = 'rgba(40,30,20,.35)'; x.shadowBlur = 18; x.shadowOffsetX = 6; x.shadowOffsetY = 9;
    x.drawImage(cardLayer, 0, 0);
    x.restore();
    // inner shadow in each hole so it reads as a cut
    for (const p of pieces) {
      if (p.home) continue;
      x.save();
      tracePiece(x, p, p.hx, p.hy, p.rot0);
      x.clip();
      x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 10; x.shadowOffsetX = 3; x.shadowOffsetY = 4;
      x.beginPath();
      x.rect(p.hx - p.r * 3, p.hy - p.r * 3, p.r * 6, p.r * 6);
      tracePiece(x, p, p.hx, p.hy, p.rot0, true);
      x.fillStyle = '#000';
      x.fill('evenodd');
      x.restore();
    }
  }

  function ensureDeco() {
    if (deco) return deco;
    const b = card.b;
    deco = {
      cap: { dx: 0, dy: 0, rot: -.035, box: null },
      tapes: [
        { kind: 'masking', ox: card.w * .5, oy: -b + 2, rot: -.03, w: 210 },
        { kind: 'masking', ox: -b + 16, oy: card.h + b - 16, rot: .7, w: 150 },
        { kind: 'washi', ox: -b + 10, oy: -b + 6, rot: -.55, w: 170, col: '#ffb3c9' },
        { kind: 'washi', ox: card.w + b - 10, oy: -b + 6, rot: .5, w: 170, col: '#b9e3ff' },
      ],
    };
    return deco;
  }

  function drawTapes(x) {
    if (st.tape === 'none' || st.mode !== 'punch') return;
    for (const t of ensureDeco().tapes) {
      if (t.kind !== st.tape) continue;
      if (t.kind === 'washi') tape(x, card.x + t.ox, card.y + t.oy, t.rot, t.col, t.w);
      else {
        if (!t.seed) t.seed = 1 + (Math.random() * 1e6 | 0);   // keep the same torn edges while it moves
        maskingTape(x, card.x + t.ox, card.y + t.oy, t.rot, t.w, t.seed);
      }
    }
  }

  // which sticker-ish thing (caption or tape) is under the pointer?
  function hitDeco(pt) {
    if (st.mode !== 'punch' || !deco) return null;
    const local = (cx, cy, rot) => {
      const dx = pt.x - cx, dy = pt.y - cy, c = Math.cos(-rot), sn = Math.sin(-rot);
      return [dx * c - dy * sn, dx * sn + dy * c];
    };
    const b = deco.cap.box;
    if (st.caption && b) {
      const [lx, ly] = local(b.cx, b.cy, b.rot);
      if (lx >= b.x0 && lx <= b.x1 && ly >= b.y0 && ly <= b.y1) return { kind: 'cap', item: deco.cap };
    }
    for (let i = deco.tapes.length - 1; i >= 0; i--) {
      const t = deco.tapes[i];
      if (t.kind !== st.tape) continue;
      const [lx, ly] = local(card.x + t.ox, card.y + t.oy, t.rot);
      if (Math.abs(lx) <= t.w / 2 && Math.abs(ly) <= 26) return { kind: 'tape', item: t };
    }
    return null;
  }

  function tape(x, cx, cy, rot, col, w) {
    w = w || 170;
    const h = 46;
    x.save();
    x.translate(cx, cy); x.rotate(rot);
    x.beginPath();
    x.moveTo(-w / 2, -h / 2);
    for (let i = 0; i <= 8; i++) x.lineTo(-w / 2 + w * i / 8, -h / 2 + (i % 2 ? 3 : 0));
    x.lineTo(w / 2, h / 2);
    for (let i = 8; i >= 0; i--) x.lineTo(-w / 2 + w * i / 8, h / 2 - (i % 2 ? 3 : 0));
    x.closePath();
    x.fillStyle = col; x.globalAlpha = .78; x.fill();
    x.clip();
    x.globalAlpha = .35; x.fillStyle = '#fff';
    for (let i = -w; i < w; i += 22) { x.fillRect(i, -h, 9, h * 2); }
    x.restore();
  }

  // beige, slightly see-through tape with torn ends
  function maskingTape(x, cx, cy, rot, w, seed) {
    const h = 48, r = App.rng(seed || Math.round(cx * 7 + cy));
    x.save();
    x.translate(cx, cy); x.rotate(rot);
    x.beginPath();
    x.moveTo(-w / 2, -h / 2);
    x.lineTo(w / 2, -h / 2);
    for (let i = 0; i <= 8; i++) x.lineTo(w / 2 + (r() - .5) * 8, -h / 2 + h * i / 8);
    x.lineTo(-w / 2, h / 2);
    for (let i = 8; i >= 0; i--) x.lineTo(-w / 2 + (r() - .5) * 8, -h / 2 + h * i / 8);
    x.closePath();
    x.shadowColor = 'rgba(60,40,10,.18)'; x.shadowBlur = 4; x.shadowOffsetY = 2;
    x.fillStyle = 'rgba(226,212,178,.82)'; x.fill();
    x.shadowColor = 'transparent';
    x.clip();
    x.strokeStyle = 'rgba(160,140,100,.18)'; x.lineWidth = 1;
    for (let i = 0; i < 40; i++) { const yy = (r() - .5) * h; x.beginPath(); x.moveTo(-w / 2, yy); x.lineTo(w / 2, yy + (r() - .5) * 3); x.stroke(); }
    x.restore();
  }

  function piecePath(x, p) {
    tracePiece(x, p, p.x, p.y, p.rot0 + p.d);
  }

  function drawPiece(x, p, lifted) {
    const edge = st.edge ? Math.max(3, p.r * .07) : 0;
    x.save();
    x.shadowColor = lifted ? 'rgba(30,20,10,.38)' : 'rgba(30,20,10,.3)';
    x.shadowBlur = lifted ? 22 : (p.home ? 3 : 9);
    x.shadowOffsetX = lifted ? 10 : (p.home ? 1 : 3);
    x.shadowOffsetY = lifted ? 16 : (p.home ? 1 : 5);
    piecePath(x, p);
    x.fillStyle = x.strokeStyle = '#fffdf8';
    if (edge) {
      // the white paper rim: a fat stroke casts the shadow, then fill without one
      x.lineWidth = edge * 2; x.lineJoin = 'round';
      x.stroke();
      x.shadowColor = 'transparent';
    }
    x.fill();
    x.restore();

    x.save();
    piecePath(x, p);
    x.clip();
    x.translate(p.x, p.y); x.rotate(p.d); x.translate(-p.hx, -p.hy);
    x.drawImage(cardImg, card.x, card.y);
    x.restore();

    // a soft paper highlight along the top edge
    x.save();
    piecePath(x, p);
    x.clip();
    const g = x.createLinearGradient(p.x, p.y - p.r, p.x, p.y + p.r);
    g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    x.fillStyle = g; x.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    x.restore();
  }

  function captionSpot() {
    // stuck to the bottom-right corner of the print
    return { x: card.x + card.w + card.b - 30, y: card.y + card.h + card.b + 6, rot: -.035 };
  }

  // noText: draw only the strip / tape behind the words, and return the words as a
  // real-text layer description instead (for the layered HTML / SVG export)
  function drawCaption(x, noText) {
    const text = st.caption;
    if (!text) return null;
    let words = null;
    const world = (lx, ly) => [sp.x + lx * Math.cos(sp.rot) - ly * Math.sin(sp.rot), sp.y + lx * Math.sin(sp.rot) + ly * Math.cos(sp.rot)];
    const sp = captionSpot(), dc = ensureDeco().cap;
    sp.x += dc.dx; sp.y += dc.dy; sp.rot = dc.rot;
    // remember the label's box (in its own rotated frame) so it can be grabbed
    const box = dc.box = { cx: sp.x, cy: sp.y, rot: sp.rot, x0: 0, x1: 20, y0: -40, y1: 24 };
    x.save();
    x.translate(sp.x, sp.y); x.rotate(sp.rot);
    if (st.capStyle === 'typewriter') {
      x.font = '30px "Special Elite", "Courier New", monospace';
      const tw = x.measureText(text).width;
      box.x0 = -tw - 34;
      // torn strip of paper with typed letters
      x.shadowColor = 'rgba(40,30,10,.25)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
      x.fillStyle = '#fbf8ef';
      x.beginPath();
      x.moveTo(-tw - 30, -34); x.lineTo(16, -34);
      for (let i = 0; i <= 6; i++) x.lineTo(16 + (i % 2 ? 4 : -2), -34 + i * 9);
      x.lineTo(-tw - 30, 20);
      for (let i = 6; i >= 0; i--) x.lineTo(-tw - 30 + (i % 2 ? -4 : 2), -34 + i * 9);
      x.closePath(); x.fill();
      x.shadowColor = 'transparent';
      const r = App.rng(text.length * 13);
      let xx = -tw - 14;
      if (noText) {
        const [wx, wy] = world(xx, 0);
        words = { text, x: wx, y: wy, rot: sp.rot, font: '"Special Elite", "Courier New", monospace', size: 30, color: '#1e1c1a' };
      } else for (const ch of text) {
        x.globalAlpha = .7 + r() * .3;
        x.fillStyle = '#1e1c1a';
        x.fillText(ch, xx, (r() - .5) * 2.5);
        xx += x.measureText(ch).width;
      }
    } else if (st.capStyle === 'label') {
      const t = text.toUpperCase().split('').join(' ');
      x.font = '700 30px "Arial Black", Arial, sans-serif';
      const tw = x.measureText(t).width;
      box.x0 = -tw - 40;
      x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 5; x.shadowOffsetY = 3;
      x.fillStyle = '#c4202b';
      x.beginPath(); App.roundRect(x, -tw - 40, -34, tw + 50, 52, 6); x.fill();
      x.shadowColor = 'transparent';
      x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(-tw - 40, -34, tw + 50, 10);
      // embossed letters: a dark offset under bright plastic
      if (noText) {
        const [wx, wy] = world(-tw - 15, 2);
        words = { text: t, x: wx, y: wy, rot: sp.rot, font: '"Arial Black", Arial, sans-serif', size: 30, weight: 700, color: '#f7f1ea' };
      } else {
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillText(t, -tw - 14, 4);
        x.fillStyle = '#f7f1ea'; x.fillText(t, -tw - 15, 2);
      }
    } else if (st.capStyle === 'ransom') {
      const fonts = ['900 40px Georgia, serif', '900 38px Impact, "Arial Black", sans-serif', '36px "Special Elite", monospace',
        'italic 700 40px "Times New Roman", serif', '700 34px "Courier New", monospace', '38px "DotGothic16", monospace'];
      const papers = [['#f4efe2', '#151515'], ['#151515', '#f4efe2'], ['#d8312b', '#fff'], ['#efe6c8', '#1a1a1a'], ['#ffffff', '#c4202b'], ['#e9dcc0', '#2b2b2b']];
      const r = App.rng(text.length * 7 + 3);
      const glyphs = text.toUpperCase().split('').map(ch => {
        const f = fonts[Math.floor(r() * fonts.length)];
        x.font = f;
        return { ch, f, w: ch === ' ' ? 18 : x.measureText(ch).width + 14, p: papers[Math.floor(r() * papers.length)], rot: (r() - .5) * .24, dy: (r() - .5) * 8 };
      });
      let xx = -glyphs.reduce((s2, g) => s2 + g.w + 4, 0);
      box.x0 = xx; box.y0 = -36; box.y1 = 26;
      for (const g of glyphs) {
        if (g.ch !== ' ') {
          x.save();
          x.translate(xx + g.w / 2, g.dy); x.rotate(g.rot);
          x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 3; x.shadowOffsetY = 2;
          x.fillStyle = g.p[0]; x.fillRect(-g.w / 2, -30, g.w, 46);
          x.shadowColor = 'transparent';
          x.fillStyle = g.p[1]; x.font = g.f; x.textAlign = 'center';
          x.fillText(g.ch, 0, 6);
          x.restore();
        }
        xx += g.w + 4;
      }
    } else {
      x.font = '600 58px "Caveat", cursive';
      box.x0 = -x.measureText(text).width - 6; box.y0 = -44;
      x.fillStyle = st.bg === 'mat' ? '#fff' : '#3a2a4f';
      x.textAlign = 'right';
      if (noText) { const [wx, wy] = world(0, 10); words = { text, x: wx, y: wy, rot: sp.rot, font: '"Caveat", cursive', size: 58, weight: 600, color: x.fillStyle, align: 'right' }; }
      else x.fillText(text, 0, 10);
    }
    x.restore();
    return words;
  }

  // every part of the page as its own layer, bottom to top (see export.js)
  function exportLayers() {
    const L = [], full = () => App.makeCanvas(CW, CH);
    const bg = full(); bg.getContext('2d').drawImage(buildBg(), 0, 0);
    L.push({ name: 'Background paper', canvas: bg, jpeg: true });
    const pr = full(); drawCard(pr.getContext('2d'));
    L.push({ name: st.mode === 'punch' ? 'Photo print (with holes)' : 'Photo outline', canvas: pr });
    pieces.forEach((p, i) => {
      const c = full(); drawPiece(c.getContext('2d'), p, false);
      L.push({ name: `Piece ${String(i + 1).padStart(2, '0')}${p.user ? ' (hand cut)' : ''}${p.home ? ' (in its hole)' : ''}`, canvas: c });
    });
    if (st.tape !== 'none' && st.mode === 'punch') {
      ensureDeco().tapes.filter(t => t.kind === st.tape).forEach((t, i) => {
        const c = full(), x = c.getContext('2d');
        if (t.kind === 'washi') tape(x, card.x + t.ox, card.y + t.oy, t.rot, t.col, t.w);
        else maskingTape(x, card.x + t.ox, card.y + t.oy, t.rot, t.w, t.seed);
        L.push({ name: `Tape ${i + 1}`, canvas: c });
      });
    }
    if (st.caption) {
      const c = full();
      const words = drawCaption(c.getContext('2d'), true);
      L.push({ name: st.capStyle === 'ransom' ? 'Caption (ransom letters)' : 'Caption backing', canvas: c });
      if (words) L.push(Object.assign({ name: 'Caption text' }, words));
    }
    if (st.grain) {
      const g = App.makeCanvas(CW / 2, CH / 2);
      g.getContext('2d').drawImage(grain(), 0, 0, g.width, g.height);
      L.push({ name: 'Film grain & dust', canvas: g, x: 0, y: 0, w: CW, h: CH, jpeg: true, blend: 'overlay', opacity: .32 });
    }
    return L;
  }

  // film grain, dust and a couple of scratches over the whole page
  let grainC = null;
  function grain() {
    if (grainC) return grainC;
    grainC = App.makeCanvas(CW, CH);
    const x = grainC.getContext('2d');
    const small = App.makeCanvas(CW / 2, CH / 2), s2 = small.getContext('2d');
    const id = s2.createImageData(small.width, small.height), r = App.rng(77);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - .5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    s2.putImageData(id, 0, 0);
    x.drawImage(small, 0, 0, CW, CH);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = r() < .5 ? 'rgba(255,255,255,.9)' : 'rgba(20,20,20,.8)';
      x.beginPath(); x.arc(r() * CW, r() * CH, r() * 1.8 + .3, 0, Math.PI * 2); x.fill();
    }
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const sx = r() * CW; x.beginPath(); x.moveTo(sx, r() * CH * .3); x.quadraticCurveTo(sx + (r() - .5) * 60, CH * .5, sx + (r() - .5) * 40, CH * (.6 + r() * .4)); x.stroke();
    }
    return grainC;
  }

  function render(x, skip) {
    x.drawImage(buildBg(), 0, 0);
    drawCard(x);
    for (const p of pieces) if (p !== skip) drawPiece(x, p, false);
    drawTapes(x);
    drawCaption(x);
    if (st.grain) {
      x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = .32; x.drawImage(grain(), 0, 0); x.restore();
    }
  }

  /* ---------- interaction ---------- */
  function hit(pt) {
    const x = App.ctx;
    for (let i = pieces.length - 1; i >= 0; i--) {
      piecePath(x, pieces[i]);
      if (x.isPointInPath(pt.x, pt.y)) return i;
    }
    return -1;
  }

  const onPrint = pt => card && pt.x >= card.x - card.b && pt.x <= card.x + card.w + card.b && pt.y >= card.y - card.b && pt.y <= card.y + card.h + card.b;

  /* ---------- cutting it yourself ---------- */
  const inCard = pt => pt.x >= card.x && pt.x <= card.x + card.w && pt.y >= card.y && pt.y <= card.y + card.h;
  const clampCard = pt => [App.clamp(pt.x, card.x, card.x + card.w), App.clamp(pt.y, card.y, card.y + card.h)];

  // even spacing along a closed outline
  function resample(pts, step) {
    const out = [];
    let carry = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let t = carry;
      for (; t < len; t += step) out.push([a[0] + (b[0] - a[0]) * t / len, a[1] + (b[1] - a[1]) * t / len]);
      carry = t - len;
    }
    return out;
  }

  function smooth(pts) {
    const n = pts.length;
    return pts.map((p, i) => {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      return [(a[0] + p[0] * 2 + b[0]) / 4, (a[1] + p[1] * 2 + b[1]) / 4];
    });
  }

  // pinking shears: push every other point out/in along the outline's normal
  function zigzag(pts, step) {
    const n = pts.length;
    return pts.map((p, i) => {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      const k = (i % 2 ? 1 : -1) * step * .45;
      return [p[0] + nx / l * k, p[1] + ny / l * k];
    });
  }

  function addOwnPiece(p) {
    // the fresh piece lifts a little off its hole so you can see the cut
    p.x = p.hx + Math.max(14, p.r * .3);
    p.y = p.hy + Math.max(18, p.r * .22);
    p.d = (Math.random() - .5) * .35;
    p.home = false; p.user = true;
    pieces.push(p);
    buildCardLayer();
    dirty = true;
  }

  function finishScissors() {
    let pts = cutting.pts;
    cutting = null;
    dirty = true;
    if (pts.length < 6) return;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    if (Math.max(...xs) - Math.min(...xs) < 16 || Math.max(...ys) - Math.min(...ys) < 16) return;
    pts = smooth(smooth(resample(pts, 5)));
    if (st.pinking) pts = zigzag(resample(pts, Math.max(9, card.w / 90)), Math.max(9, card.w / 90));
    let cx = 0, cy = 0;
    for (const q of pts) { cx += q[0]; cy += q[1]; }
    cx /= pts.length; cy /= pts.length;
    const poly = pts.map(q => [q[0] - cx, q[1] - cy]);
    const r = Math.max(...poly.map(q => Math.hypot(q[0], q[1])));
    addOwnPiece({ shape: 'poly', poly, r, hx: cx, hy: cy, rot0: 0 });
  }

  function finishPunch() {
    const q = punching;
    punching = null;
    dirty = true;
    addOwnPiece({ shape: q.shape, r: q.r, hx: q.x, hy: q.y, rot0: q.rot });
  }

  function snapshot(skip) {
    const under = App.makeCanvas(CW, CH);
    render(under.getContext('2d'), skip);
    return under;
  }

  function drawScissorsPreview(x) {
    const pts = cutting.pts;
    x.save();
    x.lineWidth = 3; x.lineJoin = 'round';
    x.beginPath();
    pts.forEach((q, i) => x[i ? 'lineTo' : 'moveTo'](q[0], q[1]));
    x.strokeStyle = '#fff'; x.setLineDash([]); x.stroke();
    x.strokeStyle = '#2a2533'; x.setLineDash([10, 8]); x.stroke();
    // a faint closing line shows where the cut will join up
    const a = pts[pts.length - 1], b = pts[0];
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]);
    x.globalAlpha = .4; x.stroke();
    x.globalAlpha = 1;
    x.font = '44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#2a2533';
    x.fillText('✂', a[0] + 18, a[1] - 18);
    x.restore();
  }

  function drawPunchPreview(x) {
    const q = punching;
    x.save();
    tracePiece(x, q, q.x, q.y, q.rot);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fill();
    x.lineWidth = 3;
    x.strokeStyle = '#fff'; x.stroke();
    x.strokeStyle = '#ff5c8a'; x.setLineDash([8, 6]); x.stroke();
    x.restore();
  }

  const HINTS = {
    move: 'A last-century cut-and-paste print: shapes are punched out of a faded film photo and float on the paper. Drag the pieces around — drop one near its hole and it snaps back in. Try the film looks, deckled edges and ransom-note captions.',
    scissors: 'Scissors: draw around anything on the picture (a face, the ice cream…) and let go to cut it out. Then drag your piece wherever you like.',
    punch: 'Hole punch: click on the picture to punch a shape — drag outward while holding to make it bigger.',
  };

  const tool = {
    id: 'punch', name: 'Paper Punch', short: 'Paper Punch', icon: '✂',
    hint: HINTS.move,
    cursor: 'grab',
    layers: () => exportLayers(),

    build(box) {
      const ui = App.ui;
      ui.seg(box, 'Your hands', [['move', '✋ Move pieces'], ['scissors', '✂ Scissors'], ['punch', '◉ Punch']], st.cutTool, v => {
        st.cutTool = v;
        document.getElementById('toolHint').textContent = HINTS[v];
        App.canvas.style.cursor = v === 'move' ? 'grab' : 'crosshair';
        if (v !== 'move' && st.mode !== 'punch') { st.mode = 'punch'; styleSeg.set('punch'); layout(); }
      });
      ui.toggle(box, 'Pinking shears (zigzag edge)', st.pinking, v => { st.pinking = v; });
      ui.buttons(box, [
        ['↶ Undo my last cut', () => {
          for (let i = pieces.length - 1; i >= 0; i--) if (pieces[i].user) { pieces.splice(i, 1); break; }
          buildCardLayer(); dirty = true;
        }],
        ['▭ Blank card', () => {
          st.blank = true; pieces = [];
          if (st.mode !== 'punch') { st.mode = 'punch'; styleSeg.set('punch'); }
          layout();
          App.toast('Fresh, uncut picture — grab the scissors ✂');
        }],
      ]);
      ui.heading(box, 'Automatic punches');
      styleSeg = ui.seg(box, 'Style', [['punch', 'Hole punch'], ['confetti', 'Confetti mosaic']], st.mode, v => { st.mode = v; layout(); });
      ui.select(box, 'Punch shape', [['mixed', '✧ Mixed bag'], ...['circle', 'triangle', 'heart', 'star', 'sparkle', 'square', 'flower', 'moon'].map(n => [n, Shapes.labels[n]])],
        st.shape, v => { st.shape = v; if (!st.blank) layout(); });
      ui.slider(box, 'Piece size', { min: 0, max: 100, value: st.size }, v => { st.size = v; if (!st.blank) layout(); });
      ui.slider(box, 'How many punches', { min: 3, max: 40, value: st.count }, v => { st.count = v; st.blank = false; layout(); });
      ui.slider(box, 'Confetti scatter', { min: 0, max: 100, value: st.scatter }, v => { st.scatter = v; if (st.mode === 'confetti') layout(); });
      ui.seg(box, 'Arrange', [['above', 'Pieces float above'], ['beside', 'Pieces beside']], st.arrange, v => { st.arrange = v; deco = null; cardOff = { x: 0, y: 0 }; layout(); });
      ui.heading(box, 'The print');
      ui.select(box, 'Film look', [['cold', "Cold blue '89"], ['warm', "Warm '77 + light leak"], ['sepia', 'Sepia'], ['mono', 'B&W film'], ['xerox', 'Xerox photocopy'], ['halftone', 'Newsprint halftone'], ['none', 'Original colours']],
        st.film, v => { st.film = v; makeCardImg(); buildCardLayer(); dirty = true; });
      ui.seg(box, 'Photo edge', [['white', 'White border'], ['deckled', 'Deckled'], ['none', 'No border']], st.photoEdge, v => { st.photoEdge = v; layout(); });
      ui.toggle(box, 'Orange date imprint', st.dateOn, v => { st.dateOn = v; makeCardImg(); buildCardLayer(); dirty = true; });
      ui.text(box, 'Date', st.date, v => { st.date = v; makeCardImg(); buildCardLayer(); dirty = true; });
      ui.heading(box, 'Paper & bits');
      ui.select(box, 'Background', [['plain', 'Matte art paper'], ['newspaper', 'Old newspaper'], ['aged', 'Yellowed paper'], ['notebook', 'Notebook page'], ['grid', 'Grid paper'], ['kraft', 'Kraft paper'], ['mat', 'Cutting mat'], ['solid', 'Solid colour']],
        st.bg, v => { st.bg = v; dirty = true; });
      ui.color(box, 'Solid colour', st.bgColor, v => { st.bgColor = v; if (st.bg === 'solid') dirty = true; });
      ui.seg(box, 'Tape', [['masking', 'Masking'], ['washi', 'Washi'], ['none', 'None']], st.tape, v => { st.tape = v; dirty = true; });
      ui.buttons(box, [['+ Add a strip of tape', () => {
        if (st.mode !== 'punch') return;
        if (st.tape === 'none') { st.tape = 'masking'; }
        const cols = ['#ffb3c9', '#b9e3ff', '#c9f2d4', '#ffe7a3'];
        ensureDeco().tapes.push({ kind: st.tape, ox: card.w * Math.random(), oy: card.h * Math.random(), rot: (Math.random() - .5) * 1.4, w: 150 + Math.random() * 80, col: cols[deco.tapes.length % 4] });
        dirty = true;
      }]]);
      ui.note(box, 'Drag the photo itself to move it around the page. The tape strips and the caption label are stickers too — drag them anywhere, scroll while dragging to rotate.');
      ui.toggle(box, 'White paper edge on pieces', st.edge, v => { st.edge = v; dirty = true; });
      ui.toggle(box, 'Film grain & dust', st.grain, v => { st.grain = v; dirty = true; });
      ui.select(box, 'Caption style', [['typewriter', 'Typewriter strip'], ['label', 'Label-maker tape'], ['ransom', 'Ransom-note letters'], ['hand', 'Handwritten']], st.capStyle, v => { st.capStyle = v; dirty = true; });
      ui.text(box, 'Caption', st.caption, v => { st.caption = v; dirty = true; });
      ui.buttons(box, [
        ['✂ New random cut', () => { st.seed++; st.blank = false; layout(); }],
        ['↺ Put all back', () => { pieces.forEach(p => { p.x = p.hx; p.y = p.hy; p.d = 0; p.home = true; }); buildCardLayer(); dirty = true; }],
      ]);
    },

    onImage() { App.resize(CW, CH); pieces = []; deco = null; cardOff = { x: 0, y: 0 }; layout(); },
    activate() {
      bgCache = null;
      tool.hint = HINTS[st.cutTool];
      tool.cursor = st.cutTool === 'move' ? 'grab' : 'crosshair';
    },

    down(pt) {
      if (st.cutTool === 'move') {
        const d = hitDeco(pt);
        if (d) {
          const it = d.item;
          decoDrag = { d, sx: pt.x, sy: pt.y, a: d.kind === 'cap' ? it.dx : it.ox, b: d.kind === 'cap' ? it.dy : it.oy };
          if (d.kind === 'tape') { deco.tapes.splice(deco.tapes.indexOf(it), 1); deco.tapes.push(it); }
          App.canvas.style.cursor = 'grabbing';
          return;
        }
      }
      const i = hit(pt);
      // in cutting modes you can still grab a loose piece, but not one sitting in its hole
      const grab = i >= 0 && (st.cutTool === 'move' || !pieces[i].home);
      if (!grab && st.cutTool === 'scissors' && st.mode === 'punch' && inCard(pt)) {
        cutting = { pts: [clampCard(pt)], under: snapshot() };
        return;
      }
      if (!grab && st.cutTool === 'punch' && st.mode === 'punch' && inCard(pt)) {
        const shape = st.shape === 'mixed' ? mixedPool[Math.floor(Math.random() * mixedPool.length)] : st.shape;
        punching = { x: pt.x, y: pt.y, r: punchSize(), shape, rot: (Math.random() - .5) * .8, under: snapshot() };
        dirty = true;
        return;
      }
      if (!grab) {
        // grabbed the print (paper or a hole), not a piece: move the whole photo
        if (st.cutTool === 'move' && st.mode === 'punch' && onPrint(pt)) {
          cardDrag = { sx: pt.x, sy: pt.y, x0: card.x, y0: card.y, off0: { ...cardOff },
            holes: pieces.map(q => [q.hx, q.hy, q.home]) };
          App.canvas.style.cursor = 'grabbing';
        }
        return;
      }
      const p = pieces.splice(i, 1)[0];
      pieces.push(p);                 // bring to front
      if (p.home) { p.home = false; buildCardLayer(); }
      drag = { p, dx: pt.x - p.x, dy: pt.y - p.y, under: snapshot(p) };
      App.canvas.style.cursor = 'grabbing';
    },
    move(pt) {
      if (cardDrag) {
        const dx = pt.x - cardDrag.sx, dy = pt.y - cardDrag.sy;
        card.x = cardDrag.x0 + dx; card.y = cardDrag.y0 + dy;
        cardOff = { x: cardDrag.off0.x + dx, y: cardDrag.off0.y + dy };
        // holes travel with the print, and so do pieces still sitting in them
        pieces.forEach((q, k) => {
          const [hx, hy, home] = cardDrag.holes[k];
          q.hx = hx + dx; q.hy = hy + dy;
          if (home) { q.x = q.hx; q.y = q.hy; }
        });
        buildCardLayer();
        dirty = true;
        return;
      }
      if (decoDrag) {
        const it = decoDrag.d.item, dx = pt.x - decoDrag.sx, dy = pt.y - decoDrag.sy;
        if (decoDrag.d.kind === 'cap') { it.dx = decoDrag.a + dx; it.dy = decoDrag.b + dy; }
        else { it.ox = decoDrag.a + dx; it.oy = decoDrag.b + dy; }
        dirty = true;
        return;
      }
      if (cutting) {
        const q = clampCard(pt), last = cutting.pts[cutting.pts.length - 1];
        if (Math.hypot(q[0] - last[0], q[1] - last[1]) > 3) { cutting.pts.push(q); dirty = true; }
        return;
      }
      if (punching) {
        punching.r = Math.max(punchSize() * .4, Math.hypot(pt.x - punching.x, pt.y - punching.y));
        dirty = true;
        return;
      }
      if (!drag) {
        if (st.cutTool === 'move') App.canvas.style.cursor = hitDeco(pt) || hit(pt) >= 0 || (st.mode === 'punch' && onPrint(pt)) ? 'grab' : 'default';
        return;
      }
      drag.p.x = pt.x - drag.dx;
      drag.p.y = pt.y - drag.dy;
      dirty = true;
    },
    up() {
      if (decoDrag || cardDrag) { decoDrag = cardDrag = null; App.canvas.style.cursor = 'grab'; return; }
      if (cutting) { finishScissors(); return; }
      if (punching) { finishPunch(); return; }
      if (!drag) return;
      const p = drag.p;
      if (Math.hypot(p.x - p.hx, p.y - p.hy) < Math.max(12, p.r * .3)) {
        p.x = p.hx; p.y = p.hy; p.d = 0; p.home = true;
        buildCardLayer();
      }
      drag = null;
      dirty = true;
      App.canvas.style.cursor = st.cutTool === 'move' ? 'grab' : 'crosshair';
    },
    wheel(pt, e) {
      if (decoDrag) { decoDrag.d.item.rot += e.deltaY * .002; dirty = true; return; }
      if (!drag) return false;
      drag.p.d += e.deltaY * .003;
      dirty = true;
    },

    frame() {
      if (!dirty) return;
      dirty = false;
      const x = App.ctx;
      if (cutting) { x.drawImage(cutting.under, 0, 0); drawScissorsPreview(x); }
      else if (punching) { x.drawImage(punching.under, 0, 0); drawPunchPreview(x); }
      else if (drag) {
        x.drawImage(drag.under, 0, 0);
        drawPiece(x, drag.p, true);
      } else render(x);
    },
  };

  App.register(tool);
})();
