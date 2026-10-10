// Checks for the phone app's translations and wiring (no browser needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('js/mobile/zh.js'), sandbox);
const ZH = sandbox.window.KK_ZH;

const toolFiles = fs.readdirSync(path.join(root, 'js')).filter(f => /^tool-.*\.js$/.test(f));
const toolIds = toolFiles.map(f => read('js/' + f).match(/id: '([a-z]+)'/)[1]);

test('every effect has a Chinese name and both how-to lines', () => {
  assert.equal(toolIds.length, 13);
  for (const id of toolIds) {
    const t = ZH.tools[id];
    assert.ok(t, `missing tools.${id}`);
    for (const k of ['name', 'howto', 'howtoEn']) assert.ok(t[k] && t[k].trim(), `${id}.${k}`);
    assert.ok([...t.name].length <= 6, `${id} name "${t.name}" is too long for a chip`);
  }
  for (const id of Object.keys(ZH.tools)) assert.ok(toolIds.includes(id), `tools.${id} has no effect`);
});

test('no empty or untranslated values', () => {
  for (const [en, zh] of Object.entries(ZH.t)) {
    assert.ok(typeof zh === 'string' && zh.trim(), `empty translation for "${en}"`);
    if (/[A-Za-z]{4}/.test(en) && !/PICO-8|Sweetie|Game Boy|LOMO|CCD|CGA|CRT|LED|UV|AI|VHS|Win98|3D|PNG|JPG|HEIC|OC/.test(zh)) {
      assert.ok(/[一-鿿]/.test(zh), `"${en}" → "${zh}" has no Chinese`);
    }
  }
});

test('emoji/symbol prefixes survive translation (they are the button icons)', () => {
  for (const [en, zh] of Object.entries(ZH.t)) {
    const lead = [...en][0];
    if (/\p{Extended_Pictographic}|[✂✋◉▭↶↺⌫▦✕🖌🪣✦✧★♥●■◆☾▲✿↻↩⟲◇〰↔📷📸🖼🎨💨🔦⚠▤]/u.test(lead)) {
      assert.equal([...zh][0], lead, `"${en}" lost its icon → "${zh}"`);
    }
  }
});

test('app.html keeps every element the effects engine looks up', () => {
  const html = read('app.html');
  const ids = new Set();
  for (const f of ['js/app.js', 'js/export.js', ...toolFiles.map(f => 'js/' + f)]) {
    for (const m of read(f).matchAll(/getElementById\('([A-Za-z]+)'\)/g)) ids.add(m[1]);
  }
  ids.delete('artboard'); // only inside exported HTML files
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `app.html is missing #${id}`);
});

test('app.html loads every effect script', () => {
  const html = read('app.html');
  for (const f of toolFiles) assert.match(html, new RegExp(`src="js/${f.replace(".", "\\.")}(\\?v=\\d+)?"`), `app.html does not load ${f}`);
});

test('no CDN or Google model URLs left in the engine', () => {
  for (const f of ['js/app.js', ...toolFiles.map(f => 'js/' + f)]) {
    const s = read(f);
    assert.doesNotMatch(s, /cdn\.jsdelivr\.net|storage\.googleapis\.com|unpkg\.com/, f);
  }
  for (const p of ['vendor/three-0.149.0/three.min.js', 'vendor/mediapipe-tasks-vision-0.10.14/vision_bundle.mjs',
    'vendor/mediapipe-tasks-vision-0.10.14/wasm/vision_wasm_internal.wasm', 'vendor/models/magic_touch.tflite']) {
    assert.ok(fs.existsSync(path.join(root, p)), `missing ${p}`);
  }
});
