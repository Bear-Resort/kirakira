// Pure-logic tests for js/share/core.js (no browser needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const KK = require('../js/share/core.js');
const QR = require('../js/share/qr.js');

const BASE = 'https://kirakira-atelier.github.io/play.html';
const longest = (n, ch) => Array.from({ length: n }, () => ch).join('');

// ---------- text encoding ----------
test('encodeText/decodeText round-trip for many kinds of text', () => {
  const samples = ['a', 'hello world', '生日快乐 小王！', '雾里的悄悄话✦', '😀👍🏽 family 👨‍👩‍👧', 'line1\nline2',
    'quotes "\' <script>alert(1)</script> & = # ? %', 'ünïcödé', '¡¿', longest(30, '龘'), ' x'];
  for (const s of samples) assert.equal(KK.decodeText(KK.encodeText(s)), s, JSON.stringify(s));
});

test('encodeText picks the shorter encoding (UTF-16 for Chinese, UTF-8 for Latin)', () => {
  assert.equal(KK.encodeText('生日快乐今晚火锅我请')[0], 'w');
  assert.equal(KK.encodeText('happy birthday')[0], 'u');
  const zh = longest(30, '雾');
  assert.ok(KK.encodeText(zh).length < 'u'.length + Math.ceil(30 * 3 * 4 / 3), 'Chinese is compressed');
});

test('encoded text only uses URL-safe characters', () => {
  for (const s of ['?&=#/+', '生日快乐', '😀', 'a b']) assert.match(KK.encodeText(s), /^[uw][A-Za-z0-9_-]*$/);
});

test('decodeText rejects garbage instead of throwing', () => {
  for (const bad of ['', 'x', 'zAAAA', 'u***', 'u%%%', 'uA', 'w' + 'QQ', 'u_-_-_', 'w2D8', null, undefined, 42]) {
    assert.doesNotThrow(() => KK.decodeText(bad));
  }
  assert.equal(KK.decodeText('u//8'), null, 'invalid UTF-8 is rejected');       // 0xFF 0xFF
  assert.equal(KK.decodeText('wANg'), null, 'lone surrogate is rejected');      // 0xD800
  assert.equal(KK.decodeText('wAA'), null, 'odd byte count is rejected');
});

// ---------- validation ----------
test('validate: empty, too long, too many lines, name too long', () => {
  assert.deepEqual(KK.validate('   \n ', '').errors.map(e => e.key), ['err_empty']);
  assert.equal(KK.validate(longest(30, '字'), '').ok, true);
  const tooLong = KK.validate(longest(33, '字'), '');
  assert.equal(tooLong.errors[0].key, 'err_long');
  assert.equal(tooLong.errors[0].vars.n, 3);
  assert.equal(KK.validate('a\nb\nc\nd', '').ok, true);
  assert.equal(KK.validate('a\nb\nc\nd\ne', '').errors[0].key, 'err_lines');
  assert.equal(KK.validate('hi', longest(13, '名')).errors[0].key, 'err_from_long');
});

test('validate counts emoji and combined characters as one each', () => {
  const v = KK.validate('👨‍👩‍👧👍🏽🇨🇳', '');
  assert.equal(v.length, 3);
});

test('cleanText strips control/bidi characters and tidies whitespace', () => {
  assert.equal(KK.cleanText('  hi‮ there \r\n\r\n\n  you  '), 'hi there\nyou');
  assert.equal(KK.cleanText('a\u0000b​c'), 'abc');
  assert.equal(KK.cleanText(null), '');
});

// ---------- links ----------
test('buildPlayUrl -> parsePlayParams round-trip', () => {
  const data = { message: '生日快乐！\n今晚火锅我请 ✦', from: 'Mochi', theme: 'night' };
  const url = KK.buildPlayUrl(BASE + '?old=1#junk', data);
  assert.ok(url.startsWith(BASE + '#v=1&t=night&m='), url);
  const u = new URL(url);
  const p = KK.parsePlayParams(u.hash, u.search);
  assert.deepEqual(p, { ok: true, demo: false, theme: 'night', message: data.message, from: 'Mochi' });
});

test('parsePlayParams: survives WeChat-style query params and reading from ?query', () => {
  const url = KK.buildPlayUrl(BASE, { message: 'hi', from: '', theme: 'mint' });
  const hash = new URL(url).hash;
  const p1 = KK.parsePlayParams(hash, '?from=singlemessage&isappinstalled=0');
  assert.equal(p1.message, 'hi');
  const p2 = KK.parsePlayParams('', '?' + hash.slice(1));
  assert.equal(p2.message, 'hi');
});

test('parsePlayParams: demo when empty, error when broken, theme falls back', () => {
  assert.equal(KK.parsePlayParams('', '').demo, true);
  assert.deepEqual(KK.parsePlayParams('#v=1&m=u***', ''), { ok: false, reason: 'decode' });
  assert.deepEqual(KK.parsePlayParams('#v=1', ''), { ok: false, reason: 'decode' });
  const tooLong = '#v=1&m=' + KK.encodeText(longest(40, 'a'));
  assert.deepEqual(KK.parsePlayParams(tooLong, ''), { ok: false, reason: 'invalid' });
  const weird = KK.parsePlayParams('#v=1&t=../../evil&m=' + KK.encodeText('ok'), '');
  assert.equal(weird.theme, 'cream');
});

test('buildPlayUrl refuses invalid notes', () => {
  assert.throws(() => KK.buildPlayUrl(BASE, { message: '', theme: 'cream' }));
  assert.throws(() => KK.buildPlayUrl(BASE, { message: longest(31, '字'), theme: 'cream' }));
});

test('worst-case link still fits a scannable QR (version ≤ 10 at level M)', () => {
  // Longest allowed note + name, in the costliest characters for each encoding.
  const worst = [
    { message: longest(30, '龘'), from: longest(12, '龘') },
    { message: longest(24, '😀'), from: '' }, // 24 is the most emoji the room limit allows
    { message: longest(30, 'é'), from: longest(12, 'é') },
    { message: 'a\nb\nc\n' + longest(27, '字'), from: longest(12, 'W') },
  ];
  const base = 'https://kirakira-atelier.github.io/play.html'; // a realistic production base
  assert.equal(KK.validate(longest(25, '😀'), '').ok, false, '25 emoji are over the limit');
  for (const d of worst) {
    assert.ok(KK.validate(d.message, d.from).ok, 'worst case is a valid note');
    const url = KK.buildPlayUrl(base, Object.assign({ theme: 'sunset' }, d));
    const q = QR.encode(url, { ecl: 'M', maxVersion: 12 });
    assert.ok(q.version <= 10, `v${q.version} for ${url.length} chars`);
  }
});

test('emoji-heavy notes hit the room limit with a friendly error', () => {
  const v = KK.validate(longest(30, '😀'), longest(12, '😀'));
  assert.equal(v.ok, false);
  assert.equal(v.errors[0].key, 'err_room');
  assert.equal(KK.validate(longest(30, '龘'), longest(12, '龘')).ok, true, 'max-length Chinese still fits');
});

test('isLocalHost', () => {
  const L = (protocol, hostname) => ({ protocol, hostname });
  for (const h of ['localhost', '127.0.0.1', '192.168.1.4', '10.0.0.2', '172.20.1.1', 'mochi.local']) assert.ok(KK.isLocalHost(L('http:', h)), h);
  assert.ok(KK.isLocalHost(L('file:', '')));
  for (const h of ['kirakira-atelier.github.io', '172.32.0.1', 'example.com']) assert.ok(!KK.isLocalHost(L('https:', h)), h);
});

// ---------- wrapping ----------
// Fake font: CJK/full-width = 1em, everything else = 0.5em.
const fake = size => s => KK.graphemes(s).reduce((w, g) => w + (/[　-鿿＀-￯]/.test(g) ? 1 : 0.5) * size, 0);

test('wrapText never exceeds width (except hanging punctuation) and keeps all text', () => {
  const texts = ['生日快乐！今晚火锅我请，不许迟到。', 'Happy birthday to my favourite person in the whole world',
    'mixed 中文 and English words together 好不好', 'supercalifragilisticexpialidocious', '一\n二三\n四五六'];
  for (const text of texts) {
    for (const width of [120, 200, 333, 600]) {
      const lines = KK.wrapText(text, width, fake(40));
      for (const l of lines) {
        const body = l.replace(/[，。！？、；：）」』】》…,.!?;:)]+$/u, '');
        assert.ok(fake(40)(body) <= width + 0.001, `"${l}" too wide for ${width}`);
      }
      assert.equal(lines.join('').replace(/\s/g, ''), text.replace(/[\s\n]/g, ''), 'no text lost');
    }
  }
});

test('wrapText: no line starts with closing punctuation, explicit newlines are kept', () => {
  const lines = KK.wrapText('一二三四！五六七八。九十', 160, fake(40)); // 4 CJK per line
  for (const l of lines.slice(1)) assert.doesNotMatch(l, /^[，。！？、]/u);
  assert.deepEqual(KK.wrapText('第一行\n第二行', 1000, fake(40)), ['第一行', '第二行']);
});

test('wrapText prefers breaking after punctuation instead of splitting words', () => {
  // 6 CJK per line: naive wrapping gives 生日快乐！今 / 晚火锅我请， / 不许迟到
  const lines = KK.wrapText('生日快乐！今晚火锅我请，不许迟到', 240, fake(40));
  assert.deepEqual(lines, ['生日快乐！', '今晚火锅我请，', '不许迟到']);
});

test('wrapText does not pull punctuation across a user line break', () => {
  assert.deepEqual(KK.wrapText('你好\n！', 1000, fake(40)), ['你好', '！']);
});

test('wrapText keeps English words whole when they fit', () => {
  const lines = KK.wrapText('hello there world', 140, fake(20)); // 14 chars per line
  assert.deepEqual(lines, ['hello there', 'world']);
});

test('fitText shrinks until the note fits the card box', () => {
  const short = KK.fitText('你好', 760, 640, fake, { max: 120, min: 44 });
  assert.equal(short.size, 120);
  const full = KK.fitText(longest(30, '字'), 760, 640, fake, { max: 120, min: 44, lineHeight: 1.32, maxLines: 6 });
  assert.ok(full.lines.length * full.size * 1.32 <= 640);
  assert.ok(full.size >= 44 && full.size < 120);
  for (const l of full.lines) assert.ok(fake(full.size)(l) <= 760);
});

// ---------- coverage ----------
test('Coverage: marks, never exceeds 100%, sweeps reach the reveal threshold', () => {
  const c = new KK.Coverage(1000, 1250, 50);
  assert.equal(c.fraction, 0);
  c.mark(0, 0, 0, 0, 10);
  const once = c.count;
  c.mark(0, 0, 0, 0, 10);
  assert.equal(c.count, once, 'idempotent');
  for (let y = 0; y <= 1250; y += 60) c.mark(0, y, 1000, y, 70);
  assert.ok(c.fraction > 0.99 && c.fraction <= 1);
  c.reset();
  assert.equal(c.fraction, 0);
  // ~6 finger-width horizontal swipes should be enough to finish
  for (let i = 0; i < 6; i++) c.mark(0, 120 + i * 190, 1000, 120 + i * 190, 70 * 0.85 * 1.2);
  assert.ok(c.fraction >= KK.REVEAL_AT, `6 swipes -> ${c.fraction.toFixed(2)}`);
  c.reset();
  c.mark(500, 600, 520, 610, 70);
  assert.ok(c.fraction < 0.05, 'a tap is not a reveal');
});

test('revealProgress: wiping just the note finishes; wiping only margins needs more', () => {
  const c = new KK.Coverage(1000, 1250, 50);
  // a typical 3-line note at 120px (line height 158): what renderCard reports as textRect
  const B = { x: 140, y: 372, w: 720, h: 475 };
  // one swipe per line, the way people read it
  for (const y of [B.y + 79, B.y + 237, B.y + 395]) c.mark(B.x - 40, y, B.x + B.w + 40, y, 70 * 0.8);
  assert.ok(c.fraction < KK.REVEAL_AT, 'whole card is not yet 55% clear');
  assert.equal(KK.revealProgress(c, B), 100, `text ${c.fractionIn(B).toFixed(2)}`);
  c.reset();
  // one line read is not enough
  c.mark(B.x - 40, B.y + 79, B.x + B.w + 40, B.y + 79, 56);
  assert.ok(KK.revealProgress(c, B) < 100);
  c.reset();
  // only the top and bottom margins: real progress, but not done
  c.mark(0, 100, 1000, 100, 56); c.mark(0, 1150, 1000, 1150, 56);
  const p = KK.revealProgress(c, B);
  assert.ok(p > 0 && p < 100, `margins only -> ${p}`);
  c.reset();
  assert.equal(KK.revealProgress(c, B), 0);
});

test('revealProgress never decreases as more is wiped', () => {
  const c = new KK.Coverage(1000, 1250, 50);
  let last = 0;
  const rnd = KK.rng(3);
  for (let i = 0; i < 200; i++) {
    c.mark(rnd() * 1000, rnd() * 1250, rnd() * 1000, rnd() * 1250, 56);
    const p = KK.revealProgress(c);
    assert.ok(p >= last && p <= 100);
    last = p;
  }
  assert.equal(last, 100);
});

test('Coverage clamps strokes that go off the card', () => {
  const c = new KK.Coverage(100, 100, 10);
  assert.doesNotThrow(() => c.mark(-500, -500, 900, 900, 30));
  assert.ok(c.fraction <= 1);
});

// ---------- strings, themes, misc ----------
test('every string exists in both languages and keeps the same {placeholders}', () => {
  const zh = KK.STRINGS.zh, en = KK.STRINGS.en;
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(zh)) assert.equal(ph(zh[k]), ph(en[k]), k);
});

test('t() fills placeholders and falls back safely', () => {
  assert.equal(KK.t('zh', 'progress', { p: 42 }), '已擦开 42%');
  assert.equal(KK.t('en', 'progress', { p: 42 }), '42% clear');
  assert.equal(KK.t('fr', 'close'), 'Close');
  assert.equal(KK.t('en', 'no_such_key'), 'no_such_key');
  assert.equal(KK.t('en', 'done_count', {}), '{n} people have wiped this so far');
});

test('pickLang', () => {
  assert.equal(KK.pickLang('zh-CN'), 'zh');
  assert.equal(KK.pickLang('zh-Hant-TW'), 'zh');
  assert.equal(KK.pickLang('en-US'), 'en');
  assert.equal(KK.pickLang('ja'), 'en');
  assert.equal(KK.pickLang('en-US', 'zh'), 'zh');
  assert.equal(KK.pickLang(undefined, 'bogus'), 'en');
});

test('theme text colours pass WCAG AA (4.5:1) on their backgrounds', () => {
  for (const th of Object.values(KK.THEMES)) {
    assert.ok(KK.contrast(th.ink, th.bg) >= 4.5, `${th.id} ink/bg ${KK.contrast(th.ink, th.bg).toFixed(2)}`);
    assert.ok(KK.contrast(th.ink, th.bg2) >= 4.5, `${th.id} ink/bg2`);
    assert.ok(KK.contrast(th.soft, th.bg) >= 4.5, `${th.id} soft/bg ${KK.contrast(th.soft, th.bg).toFixed(2)}`);
  }
});

test('unknown theme ids fall back to cream', () => {
  assert.equal(KK.theme('nope').id, 'cream');
  assert.equal(KK.theme(undefined).id, 'cream');
  assert.equal(KK.theme('__proto__').id, 'cream');
});

test('rng is deterministic and in [0, 1)', () => {
  const a = KK.rng(7), b = KK.rng(7);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});
