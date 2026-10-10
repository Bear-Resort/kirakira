// QR encoder tests. Structure checks run anywhere; the decode round-trip uses
// Apple's CoreImage QR detector (macOS + swift), and is skipped elsewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { qrPng } from './tools/png.mjs';

const require = createRequire(import.meta.url);
const QR = require('../js/share/qr.js');
const here = path.dirname(new URL(import.meta.url).pathname);

// Byte-mode capacities from the QR spec tables (ISO/IEC 18004, table 7).
const KNOWN_CAPACITY = {
  L: { 1: 17, 2: 32, 5: 106, 10: 271, 20: 858, 40: 2953 },
  M: { 1: 14, 2: 26, 5: 84, 7: 122, 9: 180, 10: 213, 11: 251, 12: 287, 15: 412, 20: 666, 40: 2331 },
  Q: { 1: 11, 5: 60, 10: 151, 20: 482, 40: 1663 },
  H: { 1: 7, 5: 44, 10: 119, 20: 382, 40: 1273 },
};

test('byte capacity matches the spec tables', () => {
  for (const [ecl, rows] of Object.entries(KNOWN_CAPACITY)) {
    for (const [ver, cap] of Object.entries(rows)) {
      assert.equal(QR.byteCapacity(+ver, ecl), cap, `v${ver}-${ecl}`);
    }
  }
});

test('picks the smallest version that fits, at the boundary', () => {
  assert.equal(QR.encode('a'.repeat(14), { ecl: 'M', boostEcl: false }).version, 1);
  assert.equal(QR.encode('a'.repeat(15), { ecl: 'M', boostEcl: false }).version, 2);
  assert.equal(QR.encode('a'.repeat(213), { ecl: 'M', boostEcl: false }).version, 10);
  assert.equal(QR.encode('a'.repeat(214), { ecl: 'M', boostEcl: false }).version, 11);
});

test('boosts error correction when it fits in the same version', () => {
  const q = QR.encode('hi', { ecl: 'L' });
  assert.equal(q.version, 1);
  assert.equal(q.ecl, 'H');
});

test('rejects data that is too long', () => {
  assert.throws(() => QR.encode('x'.repeat(3000), { ecl: 'L' }), RangeError);
  assert.throws(() => QR.encode('x'.repeat(300), { ecl: 'M', maxVersion: 10 }), RangeError);
});

test('matrix structure: size, finder patterns, timing, dark module', () => {
  for (const len of [1, 30, 120, 400]) {
    const q = QR.encode('k'.repeat(len));
    const m = q.modules, n = q.size;
    assert.equal(n, q.version * 4 + 17);
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let d = -3; d <= 3; d++) {
        assert.equal(m[cy - 3][cx + d], 1, 'finder outer ring');
        assert.equal(m[cy + d][cx], Math.abs(d) === 2 ? 0 : 1, 'finder cross-section');
      }
    }
    for (let i = 8; i < n - 8; i++) {
      assert.equal(m[6][i], i % 2 === 0 ? 1 : 0, 'horizontal timing');
      assert.equal(m[i][6], i % 2 === 0 ? 1 : 0, 'vertical timing');
    }
    assert.equal(m[n - 8][8], 1, 'dark module');
  }
});

test('deterministic output', () => {
  const a = QR.encode('https://example.com/play.html#m=abc');
  const b = QR.encode('https://example.com/play.html#m=abc');
  assert.deepEqual(a.modules.map(r => Array.from(r)), b.modules.map(r => Array.from(r)));
});

function hasSwift() {
  if (process.platform !== 'darwin') return false;
  try { execFileSync('swift', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

test('every generated code scans back to the exact text (CoreImage)', { skip: !hasSwift() && 'needs macOS swift' }, () => {
  const rnd = (seed => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)(42);
  const pool = Array.from('abcXYZ019-_.~:/?#&=%生日快乐小王你好世界雾里的悄悄话✦★♡😀');
  const cases = [
    'https://kirakira-atelier.github.io/play.html#v=1&t=cream&m=w5JifSWLkV5QZQ',
    'http://192.168.1.20:8765/play.html#v=1&m=u5Lif',
    '生日快乐 小王！雾里有一句话 ✦',
    'A',
  ];
  for (const len of [13, 14, 15, 60, 100, 180, 213, 214, 250, 287, 330, 420, 600, 900]) {
    let s = '';
    while (QR.utf8(s).length < len) s += pool[Math.floor(rnd() * pool.length)];
    cases.push(s);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-qr-'));
  const files = cases.map((text, i) => {
    const q = QR.encode(text, { ecl: i % 2 ? 'M' : 'Q' });
    const f = path.join(dir, `c${i}-v${q.version}-${q.ecl}-m${q.mask}.png`);
    fs.writeFileSync(f, qrPng(q, 6));
    return f;
  });
  const out = execFileSync('swift', [path.join(here, 'tools/decode-qr.swift'), ...files], { encoding: 'utf8' });
  const got = Object.fromEntries(out.trim().split('\n').map(l => l.split('\t')));
  files.forEach((f, i) => {
    const raw = got[f];
    assert.ok(raw && raw !== 'NONE' && raw !== 'LOADFAIL', `could not decode ${path.basename(f)}`);
    assert.equal(Buffer.from(raw, 'base64').toString('utf8'), cases[i], path.basename(f));
  });
  fs.rmSync(dir, { recursive: true, force: true });
});
