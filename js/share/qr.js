/* Tiny QR code encoder (byte mode, versions 1–40), no dependencies.
   Follows ISO/IEC 18004 — structure after Project Nayuki's reference encoder (MIT).
   QR.encode(text, { ecl: 'M', minVersion: 1, maxVersion: 40, boostEcl: true })
     -> { version, size, ecl, mask, modules: Array<Uint8Array> }  (modules[y][x] = 1 is dark)
   Works in browsers (window.QR) and Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ECL = { L: 0, M: 1, Q: 2, H: 3 };
  const ECL_FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H
  const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];
  const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];

  function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver, e) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver];
  }
  function countBits(ver) { return ver <= 9 ? 8 : 16; }
  /** Largest byte payload that fits a version + level. */
  function byteCapacity(ver, ecl) {
    const e = ECL[ecl];
    return Math.floor((dataCodewords(ver, e) * 8 - 4 - countBits(ver)) / 8);
  }

  // ---- Reed–Solomon over GF(2^8), polynomial 0x11D ----
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    const res = new Array(degree).fill(0);
    res[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < degree) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return res;
  }
  function rsRemainder(data, div) {
    const res = div.map(() => 0);
    for (const b of data) {
      const f = b ^ res.shift();
      res.push(0);
      div.forEach((c, i) => { res[i] ^= gfMul(c, f); });
    }
    return res;
  }

  function utf8(text) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    return Array.from(unescape(encodeURIComponent(text)), c => c.charCodeAt(0));
  }

  function encode(text, opts) {
    const o = Object.assign({ ecl: 'M', minVersion: 1, maxVersion: 40, boostEcl: true }, opts || {});
    if (!(o.ecl in ECL)) throw new Error('Unknown error-correction level ' + o.ecl);
    const bytes = typeof text === 'string' ? utf8(text) : Array.from(text);
    let e = ECL[o.ecl];

    let ver = 0;
    for (let v = o.minVersion; v <= o.maxVersion; v++) {
      if (4 + countBits(v) + bytes.length * 8 <= dataCodewords(v, e) * 8) { ver = v; break; }
    }
    if (!ver) throw new RangeError('Data too long for a QR code (' + bytes.length + ' bytes)');
    if (o.boostEcl) {
      for (let ne = e + 1; ne <= 3; ne++) {
        if (4 + countBits(ver) + bytes.length * 8 <= dataCodewords(ver, ne) * 8) e = ne;
      }
    }

    // ---- bit stream ----
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0x4, 4);
    push(bytes.length, countBits(ver));
    for (const b of bytes) push(b, 8);
    const capBits = dataCodewords(ver, e) * 8;
    push(0, Math.min(4, capBits - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }

    // ---- error correction + interleave ----
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][ver];
    const eccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
    const rawCw = Math.floor(rawDataModules(ver) / 8);
    const numShort = numBlocks - rawCw % numBlocks;
    const shortLen = Math.floor(rawCw / numBlocks);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const codewords = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((blk, j) => {
        if (i !== shortLen - eccLen || j >= numShort) codewords.push(blk[i]);
      });
    }

    // ---- matrix ----
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Uint8Array(size));
    const fn = Array.from({ length: size }, () => new Uint8Array(size));
    const setFn = (x, y, dark) => { mod[y][x] = dark ? 1 : 0; fn[y][x] = 1; };

    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    const align = alignmentPositions(ver, size);
    const na = align.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        setFn(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const vb = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = (vb >>> i) & 1, a = size - 11 + i % 3, b = Math.floor(i / 3);
        setFn(a, b, bit); setFn(b, a, bit);
      }
    }

    function drawFormat(mask) {
      const d = (ECL_FORMAT_BITS[e] << 3) | mask;
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const fb = ((d << 10) | rem) ^ 0x5412;
      const g = i => (fb >>> i) & 1;
      for (let i = 0; i <= 5; i++) setFn(8, i, g(i));
      setFn(8, 7, g(6)); setFn(8, 8, g(7)); setFn(7, 8, g(8));
      for (let i = 9; i < 15; i++) setFn(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, g(i));
      for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, g(i));
      setFn(8, size - 8, 1);
    }

    // zig-zag codeword placement
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < codewords.length * 8) {
          mod[y][x] = (codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1;
          bi++;
        }
      }
    }

    const maskFn = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
      (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
    ];
    const applyMask = m => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] ^= 1;
      }
    };

    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const s = penalty(mod, size);
      if (s < bestScore) { bestScore = s; best = m; }
      applyMask(m); // XOR again to undo
    }
    applyMask(best); drawFormat(best);

    return { version: ver, size, ecl: Object.keys(ECL)[e], mask: best, modules: mod };
  }

  function alignmentPositions(ver, size) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
    const res = [6];
    for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function penalty(m, size) {
    let score = 0;
    const line = get => {
      let run = 1, prev = get(0);
      const hist = [];
      for (let i = 1; i < size; i++) {
        const c = get(i);
        if (c === prev) run++;
        else { if (run >= 5) score += 3 + run - 5; hist.push(run); run = 1; prev = c; }
      }
      if (run >= 5) score += 3 + run - 5;
      // finder-like 1:1:3:1:1 with light margin
      for (let i = 0; i + 6 < size; i++) {
        if (get(i) && !get(i + 1) && get(i + 2) && get(i + 3) && get(i + 4) && !get(i + 5) && get(i + 6)) {
          const lightBefore = i >= 4 && !get(i - 1) && !get(i - 2) && !get(i - 3) && !get(i - 4);
          const lightAfter = i + 10 < size && !get(i + 7) && !get(i + 8) && !get(i + 9) && !get(i + 10);
          if (lightBefore || lightAfter) score += 40;
        }
      }
    };
    for (let y = 0; y < size; y++) line(x => m[y][x]);
    for (let x = 0; x < size; x++) line(y => m[y][x]);
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      dark += m[y][x];
      if (x + 1 < size && y + 1 < size) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
      }
    }
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }

  /** Draw onto a 2D canvas context. Modules snap to whole pixels so scanners see crisp edges. */
  function draw(ctx, qr, x, y, px, opts) {
    const o = Object.assign({ quiet: 4, dark: '#000', light: '#fff' }, opts || {});
    const n = qr.size + o.quiet * 2;
    const cell = Math.max(1, Math.floor(px / n));
    const full = cell * n;
    const ox = Math.round(x + (px - full) / 2), oy = Math.round(y + (px - full) / 2);
    ctx.fillStyle = o.light;
    ctx.fillRect(ox, oy, full, full);
    ctx.fillStyle = o.dark;
    for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) ctx.fillRect(ox + (c + o.quiet) * cell, oy + (r + o.quiet) * cell, cell, cell);
    }
    return { x: ox, y: oy, size: full, cell };
  }

  return { encode, draw, byteCapacity, utf8 };
});
