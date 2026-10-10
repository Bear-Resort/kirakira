// Cut camera templates out of sheets with a white background, and find each camera's screen.
//   node scripts/cut-cameras.mjs <sheet.png> [<sheet.png> …]
// Writes assets/cameras/cam-NN.png (background and screen transparent) and assets/cameras/cameras.json
// with each screen's four corners, so the CCD effect can map the photo into it.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from './lib/png.mjs';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'cameras');
const PAD = 6;
const UP = 2;          // the sheets are small, so templates are stored 2× larger (Lanczos + light sharpening)
const THUMB_H = 72;    // picker thumbnails

// ---------- resampling (premultiplied alpha, so edges never pick up the old white background) ----------
const lanczos = (x, a = 3) => (x === 0 ? 1 : Math.abs(x) >= a ? 0 : (a * Math.sin(Math.PI * x) * Math.sin(Math.PI * x / a)) / (Math.PI * Math.PI * x * x));
function resize(src, w, h, nw, nh) {
  const pre = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const a = src[i * 4 + 3] / 255; pre[i * 4] = src[i * 4] * a; pre[i * 4 + 1] = src[i * 4 + 1] * a; pre[i * 4 + 2] = src[i * 4 + 2] * a; pre[i * 4 + 3] = src[i * 4 + 3]; }
  const pass = (data, sw, sh, dw, horizontal) => {
    const dh = horizontal ? sh : dw.h, outW = horizontal ? dw : sw, outH = horizontal ? sh : dw.h;
    const n = horizontal ? sw : sh, nn = horizontal ? dw : dw.h, scale = n / nn, sup = Math.max(1, scale) * 3;
    const out = new Float32Array(outW * outH * 4);
    for (let o = 0; o < nn; o++) {
      const c = (o + .5) * scale - .5, lo = Math.floor(c - sup) + 1, hi = Math.floor(c + sup);
      const wts = []; let sum = 0;
      for (let k = lo; k <= hi; k++) { const wv = lanczos((k - c) / Math.max(1, scale)); wts.push(wv); sum += wv; }
      for (let line = 0; line < (horizontal ? sh : sw); line++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = lo, j = 0; k <= hi; k++, j++) {
          const kk = Math.min(n - 1, Math.max(0, k)), idx = horizontal ? (line * sw + kk) * 4 : (kk * sw + line) * 4, wv = wts[j] / sum;
          r += data[idx] * wv; g += data[idx + 1] * wv; b += data[idx + 2] * wv; a += data[idx + 3] * wv;
        }
        const oi = horizontal ? (line * outW + o) * 4 : (o * outW + line) * 4;
        out[oi] = r; out[oi + 1] = g; out[oi + 2] = b; out[oi + 3] = a;
      }
    }
    void dh;
    return out;
  };
  const hpass = pass(pre, w, h, nw, true);
  const vpass = pass(hpass, nw, h, { h: nh }, false);
  const out = new Uint8Array(nw * nh * 4);
  for (let i = 0; i < nw * nh; i++) {
    const a = Math.min(255, Math.max(0, vpass[i * 4 + 3]));
    out[i * 4 + 3] = Math.round(a);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = a > 0.5 ? Math.min(255, Math.max(0, Math.round(vpass[i * 4 + c] / (a / 255)))) : 0;
  }
  return out;
}
/** Unsharp mask on colour (alpha untouched): out = in + amount × (in − blur3×3). */
function sharpen(px, w, h, amount) {
  const out = px.slice();
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 250) continue; // leave soft edges alone (no dark rims)
    for (let c = 0; c < 3; c++) {
      let b = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) b += px[((y + dy) * w + x + dx) * 4 + c] * (dx && dy ? 1 : dx || dy ? 2 : 4);
      out[i + c] = Math.min(255, Math.max(0, Math.round(px[i + c] + amount * (px[i + c] - b / 16))));
    }
  }
  return out;
}

const whiteish = (d, i, min, spread) => {
  const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b);
  return mn >= min && mx - mn <= spread;
};

function flood(w, h, seeds, ok) {
  const m = new Uint8Array(w * h), st = seeds.slice();
  while (st.length) {
    const i = st.pop();
    if (m[i] || !ok(i)) continue;
    m[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y) st.push(i - w); if (y < h - 1) st.push(i + w);
  }
  return m;
}

function components(w, h, inside) { // 8-connected
  const lab = new Int32Array(w * h).fill(-1), comps = [];
  for (let i = 0; i < w * h; i++) {
    if (!inside(i) || lab[i] >= 0) continue;
    const c = { id: comps.length, px: [], x0: w, y0: h, x1: 0, y1: 0 }, q = [i];
    lab[i] = c.id;
    while (q.length) {
      const j = q.pop(); c.px.push(j);
      const x = j % w, y = (j / w) | 0;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (inside(k) && lab[k] < 0) { lab[k] = c.id; q.push(k); }
      }
    }
    comps.push(c);
  }
  return comps;
}

const cams = [];
for (const file of process.argv.slice(2)) {
  const { w, h, data } = decodePng(fs.readFileSync(file));
  // 1. background = near-white pixels reachable from the sheet's edge
  const seeds = [];
  for (let x = 0; x < w; x++) seeds.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) seeds.push(y * w, y * w + w - 1);
  const bg = flood(w, h, seeds, i => whiteish(data, i, 236, 18));

  // 2. cameras = big non-background blobs; slivers inside another camera's box belong to it
  let comps = components(w, h, i => !bg[i]).filter(c => c.px.length > 40);
  const big = comps.filter(c => c.px.length > 3000).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  for (const c of comps) {
    if (big.includes(c)) continue;
    const host = big.find(b => c.x0 >= b.x0 - 2 && c.x1 <= b.x1 + 2 && c.y0 >= b.y0 - 2 && c.y1 <= b.y1 + 2);
    if (host) { host.px.push(...c.px); }
  }
  // reading order: rows (by vertical centre), then left to right
  big.sort((a, b) => (Math.abs((a.y0 + a.y1) - (b.y0 + b.y1)) < 60 ? a.x0 - b.x0 : (a.y0 + a.y1) - (b.y0 + b.y1)));

  for (const c of big) {
    const x0 = Math.max(0, c.x0 - PAD), y0 = Math.max(0, c.y0 - PAD), x1 = Math.min(w - 1, c.x1 + PAD), y1 = Math.min(h - 1, c.y1 + PAD);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const crop = new Uint8Array(cw * ch * 4);
    const mine = new Uint8Array(w * h); for (const p of c.px) mine[p] = 1;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = (y0 + y) * w + (x0 + x), di = y * cw + x;
      crop.set(data.subarray(si * 4, si * 4 + 4), di * 4);
      crop[di * 4 + 3] = mine[si] ? 255 : 0;
    }
    // 3. the screen = the biggest near-white hole enclosed by the camera
    const holeOk = i => crop[i * 4 + 3] === 255 && whiteish(crop, i, 225, 26);
    const outside = new Uint8Array(cw * ch); for (let i = 0; i < cw * ch; i++) outside[i] = crop[i * 4 + 3] === 0 ? 1 : 0;
    const holes = components(cw, ch, holeOk).filter(hh => {
      // must not touch the outside (that would be a white body part on the edge)
      for (const p of hh.px) {
        const x = p % cw, y = (p / cw) | 0;
        if (x === 0 || y === 0 || x === cw - 1 || y === ch - 1) return false;
        if (outside[p - 1] || outside[p + 1] || outside[p - cw] || outside[p + cw]) return false;
      }
      return true;
    }).sort((a, b) => b.px.length - a.px.length);
    const scr = holes[0];
    if (!scr || scr.px.length < cw * ch * 0.04) { console.warn(`  ! no screen found in ${path.basename(file)} at x${c.x0} y${c.y0}`); continue; }
    const hole = new Uint8Array(cw * ch); for (const p of scr.px) hole[p] = 1;
    // grow the hole by 1px so the photo also covers the anti-aliased rim
    const grown = hole.slice();
    for (const p of scr.px) { for (const q of [p - 1, p + 1, p - cw, p + cw]) if (q >= 0 && q < cw * ch && crop[q * 4 + 3] && whiteish(crop, q, 200, 40)) grown[q] = 1; }
    // corners of the screen: extreme points along the two diagonals (works for tilted screens too)
    let tl = null, tr = null, br = null, bl = null;
    for (const p of scr.px) {
      const x = p % cw, y = (p / cw) | 0;
      if (!tl || x + y < tl[0] + tl[1]) tl = [x, y];
      if (!br || x + y > br[0] + br[1]) br = [x, y];
      if (!tr || x - y > tr[0] - tr[1]) tr = [x, y];
      if (!bl || x - y < bl[0] - bl[1]) bl = [x, y];
    }
    // 4. alpha: background and screen clear; soft 1px rim so edges don't look cut with scissors
    for (let i = 0; i < cw * ch; i++) {
      if (grown[i]) { crop[i * 4 + 3] = 0; continue; }
      if (!crop[i * 4 + 3]) continue;
      const x = i % cw, y = (i / cw) | 0;
      const nearClear = [i - 1, i + 1, i - cw, i + cw].some(q => q >= 0 && q < cw * ch && (x > 0 || q !== i - 1) && (!crop[q * 4 + 3] || grown[q]));
      if (nearClear) {
        const mn = Math.min(crop[i * 4], crop[i * 4 + 1], crop[i * 4 + 2]);
        crop[i * 4 + 3] = Math.min(255, Math.round(Math.max(0, 250 - mn) * 4)); // near-white rim pixels fade out (no halo)
      }
    }
    const id = String(cams.length + 1).padStart(2, '0');
    fs.mkdirSync(OUT, { recursive: true });
    // the exact screen shape (hole + its rim), used to clip the photo so it can never miss or overflow
    const mask = new Uint8Array(cw * ch * 4);
    for (let i = 0; i < cw * ch; i++) if (grown[i]) { mask[i * 4] = mask[i * 4 + 1] = mask[i * 4 + 2] = 255; mask[i * 4 + 3] = 255; }
    const W2 = cw * UP, H2 = ch * UP;
    const body2 = sharpen(resize(crop, cw, ch, W2, H2), W2, H2, 0.55);
    const mask2 = resize(mask, cw, ch, W2, H2);
    for (let i = 0; i < W2 * H2; i++) { mask2[i * 4] = mask2[i * 4 + 1] = mask2[i * 4 + 2] = 255; }
    const tw = Math.round(cw * THUMB_H / ch);
    const thumb = resize(crop, cw, ch, tw, THUMB_H);
    fs.writeFileSync(path.join(OUT, `cam-${id}.png`), encodePng(W2, H2, body2));
    fs.writeFileSync(path.join(OUT, `cam-${id}-screen.png`), encodePng(W2, H2, mask2));
    fs.writeFileSync(path.join(OUT, `cam-${id}-thumb.png`), encodePng(tw, THUMB_H, thumb));
    const up = ([x, y]) => [Math.round((x + .5) * UP - .5), Math.round((y + .5) * UP - .5)];
    cams.push({ id: `cam${id}`, file: `cam-${id}.png`, mask: `cam-${id}-screen.png`, thumb: `cam-${id}-thumb.png`, w: W2, h: H2, screen: [tl, tr, br, bl].map(up) });
    console.log(`  cam-${id}  ${W2}×${H2}  screen ${JSON.stringify([tl, tr, br, bl].map(up))}  (${scr.px.length}px)`);
  }
}
fs.writeFileSync(path.join(OUT, 'cameras.json'), JSON.stringify(cams, null, 1) + '\n');
console.log(`${cams.length} cameras → ${path.relative(process.cwd(), OUT)}`);
