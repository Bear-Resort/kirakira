/* KIRA·KIRA atelier — shared core.
   Every tool registers itself with App.register(). The core owns the
   uploaded pictures, the global filter pipeline, the stage canvas and the
   pointer / animation plumbing, and hands tools ready-to-use canvases. */
(function () {
  'use strict';

  const MAX_SIDE = 1600;          // uploads are scaled down to this so effects stay fast

  const App = window.App = {
    tools: [],
    current: null,
    rawA: null, rawB: null,       // downscaled originals (canvases)
    A: null, B: null,             // filtered versions every tool reads from
    canvas: null, ctx: null,
    pointer: { x: 0, y: 0, inside: false, down: false },
  };

  /* ---------------- small helpers ---------------- */

  App.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  App.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  App.lerp = (a, b, t) => a + (b - a) * t;

  // Seeded random so "new cut" layouts are repeatable while you tweak settings.
  App.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Cheap, Safari-safe blur: shrink then grow with smoothing.
  App.blurred = function (src, factor) {
    const w = src.width, h = src.height;
    let cur = src;
    let f = 1;
    while (f < factor) {
      f = Math.min(factor, f * 2);
      const c = App.makeCanvas(w / f, h / f);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(cur, 0, 0, c.width, c.height);
      cur = c;
    }
    const out = App.makeCanvas(w, h);
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(cur, 0, 0, w, h);
    return out;
  };

  // Draw `src` so it covers a w×h box (center crop), like CSS object-fit: cover.
  App.coverInto = function (src, w, h) {
    const c = App.makeCanvas(w, h);
    const s = Math.max(w / src.width, h / src.height);
    const dw = src.width * s, dh = src.height * s;
    c.getContext('2d').drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return c;
  };

  // Without a Picture B, tools that need a pair invent one: an inked "manga page" version.
  App.mangaVersion = function (src) {
    const c = App.makeCanvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      let l = .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2];
      l = l > 170 ? 250 : l > 95 ? 150 : 30;
      d[i] = l * .95; d[i + 1] = l * .93; d[i + 2] = l;
    }
    x.putImageData(id, 0, 0);
    return c;
  };

  // Load a library <script> once (used for the 3D engine, only when a tool needs it).
  const scriptPromises = {};
  App.loadScript = function (url) {
    if (!scriptPromises[url]) {
      scriptPromises[url] = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = url;
        el.onload = resolve;
        el.onerror = () => { delete scriptPromises[url]; reject(new Error('could not load ' + url)); };
        document.head.append(el);
      });
    }
    return scriptPromises[url];
  };

  // A real flashlight beam, as white with alpha: a hot core, the faint ring a
  // reflector makes, uneven blotches from a cheap lens, and a long soft fade — no edge.
  let beamTex = null;
  App.beamTexture = function () {
    if (beamTex) return beamTex;
    const S = 512, c = App.makeCanvas(S, S), x = c.getContext('2d');
    const id = x.createImageData(S, S), r = App.rng(9);
    const blobs = Array.from({ length: 36 }, () => ({ x: r() * S, y: r() * S, r: 20 + r() * 90, a: (r() - .5) * .45 }));
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const dx = (i - S / 2) / (S / 2), dy = (j - S / 2) / (S / 2), d = Math.hypot(dx, dy);
      if (d >= 1) continue;
      const hot = Math.exp(-Math.pow(d / .2, 2)) * .55;
      const body = Math.pow(1 - d * d, 2.2) * .62;
      const ring = Math.exp(-Math.pow((d - .6) / .05, 2)) * .16;
      let n = .035 * Math.sin(d * 70);
      for (const b of blobs) { const q = (i - b.x) ** 2 + (j - b.y) ** 2; if (q < b.r * b.r * 4) n += b.a * Math.exp(-q / (b.r * b.r)); }
      const v = App.clamp((hot + body + ring) * (1 + n), 0, 1);
      const k = (j * S + i) * 4;
      id.data[k] = id.data[k + 1] = id.data[k + 2] = 255; id.data[k + 3] = v * 255;
    }
    x.putImageData(id, 0, 0);
    return (beamTex = c);
  };

  // moving film grain for spooky scenes: one noise tile, drawn at a random offset
  let grainTile = null;
  App.grainTile = function () {
    if (grainTile) return grainTile;
    const S = 256, c = App.makeCanvas(S, S), x = c.getContext('2d'), id = x.createImageData(S, S), r = App.rng(5);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - .5) * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0);
    return (grainTile = c);
  };
  App.drawGrain = function (x, w, h, amount) {
    const g = App.grainTile();
    x.save();
    x.globalCompositeOperation = 'overlay'; x.globalAlpha = amount;
    x.fillStyle = x.createPattern(g, 'repeat');
    x.translate(-Math.random() * 256, -Math.random() * 256);
    x.fillRect(0, 0, w + 256, h + 256);
    x.restore();
  };

  App.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /* ---------------- UI builders (used by tool settings) ---------------- */

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  App.ui = {
    slider(parent, label, opt, onInput) {
      const wrap = el('div', 'ctrl');
      const lab = el('label', 'ctrl-label');
      const out = el('output');
      lab.append(el('span', null, label), out);
      const inp = el('input');
      inp.type = 'range';
      inp.min = opt.min; inp.max = opt.max; inp.step = opt.step || 1; inp.value = opt.value;
      const fmt = opt.format || (v => v);
      out.textContent = fmt(+inp.value);
      inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
      wrap.append(lab, inp);
      parent.append(wrap);
      inp.set = v => { inp.value = v; out.textContent = fmt(+v); };
      return inp;
    },
    select(parent, label, options, value, onChange) {
      const wrap = el('div', 'ctrl');
      wrap.append(el('div', 'ctrl-label', `<span>${label}</span>`));
      const s = el('select');
      for (const [v, t] of options) {
        const o = el('option', null, t); o.value = v; s.append(o);
      }
      s.value = value;
      s.addEventListener('change', () => onChange(s.value));
      wrap.append(s);
      parent.append(wrap);
      return s;
    },
    seg(parent, label, options, value, onChange) {
      const wrap = el('div', 'ctrl');
      if (label) wrap.append(el('div', 'ctrl-label', `<span>${label}</span>`));
      const row = el('div', 'seg');
      const btns = [];
      for (const [v, t] of options) {
        const b = el('button', v === value ? 'on' : '', t);
        b.type = 'button';
        b.addEventListener('click', () => { api.set(v); onChange(v); });
        b.dataset.v = v;
        btns.push(b); row.append(b);
      }
      const api = { set(v) { btns.forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); } };
      wrap.append(row);
      parent.append(wrap);
      return api;
    },
    toggle(parent, label, value, onChange) {
      const lab = el('label', 'toggle');
      const c = el('input'); c.type = 'checkbox'; c.checked = value;
      c.addEventListener('change', () => onChange(c.checked));
      lab.append(c, el('span', null, label));
      parent.append(lab);
      return c;
    },
    color(parent, label, value, onChange) {
      const wrap = el('div', 'ctrl');
      wrap.append(el('div', 'ctrl-label', `<span>${label}</span>`));
      const c = el('input'); c.type = 'color'; c.value = value;
      c.addEventListener('input', () => onChange(c.value));
      wrap.append(c);
      parent.append(wrap);
      return c;
    },
    text(parent, label, value, onInput) {
      const wrap = el('div', 'ctrl');
      wrap.append(el('div', 'ctrl-label', `<span>${label}</span>`));
      const t = el('input'); t.type = 'text'; t.value = value;
      t.addEventListener('input', () => onInput(t.value));
      wrap.append(t);
      parent.append(wrap);
      return t;
    },
    buttons(parent, list) {
      const row = el('div', 'btn-row');
      for (const [text, fn] of list) {
        const b = el('button', 'btn', text); b.type = 'button';
        b.addEventListener('click', fn);
        row.append(b);
      }
      parent.append(row);
      return row;
    },
    note(parent, html) { const n = el('p', 'note', html); parent.append(n); return n; },
    heading(parent, text) { parent.append(el('div', 'ctrl-heading', text)); },
  };

  /* ---------------- toast & busy ---------------- */

  let toastTimer = 0;
  App.toast = function (msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 3200);
  };

  App.busy = function (msg) {
    const b = document.getElementById('busy');
    if (msg) { document.getElementById('busyText').textContent = msg; b.hidden = false; }
    else b.hidden = true;
  };

  /* ---------------- global filters ---------------- */

  const F0 = { brightness: 0, contrast: 0, saturation: 0, hue: 0, warmth: 0, fade: 0, grain: 0, vignette: 0 };
  App.filters = Object.assign({ split: null }, F0);

  // split = [shadowRGB, highlightRGB, amount] — the "colour grading" used by presets
  const PRESETS = [
    ['Original', {}],
    ['Pastel Dream', { brightness: 8, contrast: -14, saturation: -8, fade: 32, warmth: 4, split: [[150, 120, 255], [255, 170, 200], .22] }],
    ['Film ’98', { contrast: 10, saturation: -16, warmth: 16, fade: 20, grain: 28, vignette: 32 }],
    ['Cyber Night', { contrast: 22, saturation: 26, hue: -8, warmth: -26, vignette: 38, split: [[0, 200, 220], [255, 60, 200], .26] }],
    ['Mint Soda', { brightness: 6, hue: 8, warmth: -14, fade: 16, split: [[80, 220, 180], [255, 210, 170], .2] }],
    ['Sunset Lomo', { contrast: 26, saturation: 30, warmth: 26, vignette: 62 }],
    ['Sepia Memory', { saturation: -82, warmth: 46, fade: 26, grain: 22, vignette: 42 }],
    ['Manga Ink', { saturation: -100, contrast: 48, grain: 10 }],
  ];

  function hueMatrix(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [
      .213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928,
      .213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283,
      .213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072,
    ];
  }

  App.applyFilters = function (src) {
    const f = App.filters;
    const w = src.width, h = src.height;
    const out = App.makeCanvas(w, h);
    const o = out.getContext('2d');
    o.drawImage(src, 0, 0);
    const isPlain = Object.keys(F0).every(k => f[k] === 0) && !f.split;
    if (isPlain) return out;

    const img = o.getImageData(0, 0, w, h);
    const d = img.data;
    const bri = f.brightness * 1.2;
    const cc = f.contrast * 2.2;
    const cf = (259 * (cc + 255)) / (255 * (259 - cc));
    const sat = 1 + f.saturation / 100;
    const hm = f.hue ? hueMatrix(f.hue) : null;
    const wr = f.warmth * .55, wb = f.warmth * .6;
    const fd = f.fade / 100 * .28;
    const gr = f.grain * 1.1;
    const vg = f.vignette / 100;
    const sp = f.split;
    const cx = w / 2, cy = h / 2, maxd = cx * cx + cy * cy;
    const rand = App.rng(7);

    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        r += bri; g += bri; b += bri;
        r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128;
        if (hm) {
          const nr = hm[0] * r + hm[1] * g + hm[2] * b;
          const ng = hm[3] * r + hm[4] * g + hm[5] * b;
          const nb = hm[6] * r + hm[7] * g + hm[8] * b;
          r = nr; g = ng; b = nb;
        }
        const l = .299 * r + .587 * g + .114 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
        r += wr; g += f.warmth * .08; b -= wb;
        if (sp) {
          const t = App.clamp(l / 255, 0, 1), k = sp[2];
          const sr = sp[0][0] * (1 - t) + sp[1][0] * t;
          const sg = sp[0][1] * (1 - t) + sp[1][1] * t;
          const sb = sp[0][2] * (1 - t) + sp[1][2] * t;
          // soft-light-ish mix toward the tone colour
          r += (sr - 128) * k; g += (sg - 128) * k; b += (sb - 128) * k;
        }
        if (fd) { r = r * (1 - fd) + 255 * fd * .55; g = g * (1 - fd) + 255 * fd * .5; b = b * (1 - fd) + 255 * fd * .6; }
        if (vg) {
          const dx = x - cx, dy = y - cy;
          const m = 1 - vg * Math.pow((dx * dx + dy * dy) / maxd, 1.4) * 1.1;
          r *= m; g *= m; b *= m;
        }
        if (gr) { const n = (rand() - .5) * gr; r += n; g += n; b += n; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b;   // Uint8Clamped clamps for us
      }
    }
    o.putImageData(img, 0, 0);
    return out;
  };

  function buildFilterUI() {
    const pres = document.getElementById('presets');
    const box = document.getElementById('filterSliders');
    const chips = [];
    const sliders = {};
    PRESETS.forEach(([name, vals], idx) => {
      const c = el('button', 'chip' + (idx === 0 ? ' on' : ''), name);
      c.type = 'button';
      c.addEventListener('click', () => {
        Object.assign(App.filters, F0, { split: null }, vals);
        for (const k in sliders) sliders[k].set(App.filters[k]);
        chips.forEach(x => x.classList.toggle('on', x === c));
        refilter();
      });
      chips.push(c); pres.append(c);
    });
    const defs = [
      ['brightness', 'Brightness', -100, 100], ['contrast', 'Contrast', -100, 100],
      ['saturation', 'Saturation', -100, 100], ['hue', 'Hue shift', -180, 180],
      ['warmth', 'Warmth', -100, 100], ['fade', 'Fade / matte', 0, 100],
      ['grain', 'Film grain', 0, 100], ['vignette', 'Vignette', 0, 100],
    ];
    for (const [k, label, min, max] of defs) {
      sliders[k] = App.ui.slider(box, label, { min, max, value: 0 }, v => {
        App.filters[k] = v;
        chips.forEach(x => x.classList.remove('on'));
        refilter();
      });
    }
  }

  let refilterTimer = 0;
  function refilter() {
    clearTimeout(refilterTimer);
    refilterTimer = setTimeout(() => {
      if (App.rawA) App.A = App.applyFilters(App.rawA);
      if (App.rawB) App.B = App.applyFilters(App.rawB);
      notifyImage();
    }, 90);
  }

  /* ---------------- loading pictures ---------------- */

  function toWorkingCanvas(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.min(1, MAX_SIDE / Math.max(iw, ih));
    const c = App.makeCanvas(iw * s, ih * s);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function setThumb(which, canvas) {
    const t = document.getElementById(which === 'A' ? 'thumbA' : 'thumbB');
    const small = App.makeCanvas(120, 120 * canvas.height / canvas.width);
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
    t.style.backgroundImage = `url(${small.toDataURL('image/jpeg', .8)})`;
    t.textContent = ' ';
  }

  App.setPicture = function (which, canvas) {
    if (which === 'A') { App.rawA = canvas; App.A = App.applyFilters(canvas); }
    else { App.rawB = canvas; App.B = App.applyFilters(canvas); }
    setThumb(which, canvas);
    notifyImage();
  };

  App.loadFile = function (file, which) {
    if (!file || !/^image\//.test(file.type)) { App.toast('That file is not an image — try a PNG or JPG.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); App.setPicture(which, toWorkingCanvas(img)); };
    img.onerror = () => { URL.revokeObjectURL(url); App.toast('Could not read that picture (HEIC photos may need converting to JPG first).'); };
    img.src = url;
  };

  function notifyImage() {
    document.getElementById('dropB').classList.toggle('needed', !!(App.current && App.current.wantsB && !App.rawB));
    if (App.current && App.A) App.current.onImage();
  }

  function wireUploads() {
    for (const which of ['A', 'B']) {
      const input = document.getElementById('file' + which);
      const drop = document.getElementById('drop' + which);
      input.addEventListener('change', () => { App.loadFile(input.files[0], which); input.value = ''; });
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => {
        e.preventDefault(); drop.classList.remove('over');
        App.loadFile(e.dataTransfer.files[0], which);
      });
    }
    const stage = document.getElementById('stage');
    const veil = document.getElementById('dropveil');
    stage.addEventListener('dragover', e => { e.preventDefault(); veil.hidden = false; });
    stage.addEventListener('dragleave', e => { if (!stage.contains(e.relatedTarget)) veil.hidden = true; });
    stage.addEventListener('drop', e => {
      e.preventDefault(); veil.hidden = true;
      App.loadFile(e.dataTransfer.files[0], 'A');
    });
    window.addEventListener('paste', e => {
      const item = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith('image/'));
      if (item) App.loadFile(item.getAsFile(), 'A');
    });
    document.getElementById('demoBtn').addEventListener('click', () => {
      App.setPicture('A', Demo.make(true));
      App.setPicture('B', Demo.make(false));
      App.toast('Demo loaded: Picture B is the same girl with her eyes closed at night.');
    });
  }

  /* ---------------- AI subject finder (shared by Subject Swap & Holo Sticker) ----------------
     MediaPipe's "Magic Touch" interactive segmenter: you give it one point and it
     returns a mask of the object under that point. Loaded lazily from a CDN. */

  // Served from our own site (vendor/) so the AI cutout also works in mainland China.
  // Absolute URLs: dynamic import() would otherwise resolve against js/, not the page.
  App.asset = path => new URL(path, document.baseURI).href;
  const MP = App.asset('vendor/mediapipe-tasks-vision-0.10.14');
  const MODEL = App.asset('vendor/models/magic_touch.tflite');
  let segPromise = null;

  App.loadSegmenter = function () {
    if (!segPromise) {
      segPromise = (async () => {
        const vision = await import(MP + '/vision_bundle.mjs');
        const files = await vision.FilesetResolver.forVisionTasks(MP + '/wasm');
        return vision.InteractiveSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      })();
      segPromise.catch(() => { segPromise = null; });
    }
    return segPromise;
  };

  // Returns a canvas (same size as `src`) whose alpha is the object under (x, y).
  App.segmentAt = async function (src, x, y) {
    const seg = await App.loadSegmenter();
    return new Promise((resolve, reject) => {
      try {
        seg.segment(src, { keypoint: { x: x / src.width, y: y / src.height } }, res => {
          const m = res.confidenceMasks && res.confidenceMasks[0];
          if (!m) { reject(new Error('no mask')); return; }
          const mw = m.width, mh = m.height;
          const conf = m.getAsFloat32Array();
          // Which side of the mask is "the thing you clicked"? Check the clicked pixel.
          const ci = Math.min(mh - 1, Math.floor(y / src.height * mh)) * mw + Math.min(mw - 1, Math.floor(x / src.width * mw));
          const flip = conf[ci] < .5;
          const small = App.makeCanvas(mw, mh);
          const sx = small.getContext('2d');
          const id = sx.createImageData(mw, mh);
          for (let i = 0; i < conf.length; i++) {
            let c = flip ? 1 - conf[i] : conf[i];
            c = App.clamp((c - .35) / .3, 0, 1);
            id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255;
            id.data[i * 4 + 3] = c * 255;
          }
          sx.putImageData(id, 0, 0);
          const out = App.makeCanvas(src.width, src.height);
          const ox = out.getContext('2d');
          ox.imageSmoothingQuality = 'high';
          ox.drawImage(small, 0, 0, out.width, out.height);
          resolve(out);
        });
      } catch (err) { reject(err); }
    });
  };

  // White silhouette of a mask, optionally grown outward by `grow` px (for sticker borders).
  App.silhouette = function (mask, grow, color) {
    const w = mask.width, h = mask.height;
    const base = App.makeCanvas(w, h);
    const b = base.getContext('2d');
    b.drawImage(mask, 0, 0);
    b.globalCompositeOperation = 'source-in';
    b.fillStyle = color || '#fff';
    b.fillRect(0, 0, w, h);
    if (!grow) return base;
    const out = App.makeCanvas(w, h);
    const o = out.getContext('2d');
    const steps = Math.max(12, Math.ceil(grow * 1.2));
    for (let i = 0; i < steps; i++) {
      const a = i / steps * Math.PI * 2;
      o.drawImage(base, Math.cos(a) * grow, Math.sin(a) * grow);
    }
    o.drawImage(base, 0, 0);
    // a little extra solidity so the edge isn't wobbly
    const rings = [grow * .5];
    for (const r of rings) for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2; o.drawImage(base, Math.cos(a) * r, Math.sin(a) * r);
    }
    return out;
  };

  // Shared brush for painting masks by hand.
  App.paintMask = function (mask, x0, y0, x1, y1, r, erase) {
    const m = mask.getContext('2d');
    m.save();
    m.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    m.strokeStyle = m.fillStyle = '#fff';
    m.lineCap = 'round';
    m.lineWidth = r * 2;
    m.beginPath(); m.moveTo(x0, y0); m.lineTo(x1, y1); m.stroke();
    m.restore();
  };

  /* ---------------- tools, stage & loop ---------------- */

  App.register = function (tool) { App.tools.push(tool); };

  App.resize = function (w, h) {
    if (App.canvas.width !== Math.round(w) || App.canvas.height !== Math.round(h)) {
      App.canvas.width = Math.round(w);
      App.canvas.height = Math.round(h);
    }
  };

  function selectTool(tool) {
    if (App.current === tool) return;
    if (App.current && App.current.deactivate) App.current.deactivate();
    App.current = tool;
    App.touched = false;
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.id === tool.id));
    document.getElementById('toolTitle').textContent = tool.icon + ' ' + tool.name;
    document.getElementById('toolHint').textContent = tool.hint;
    const box = document.getElementById('toolControls');
    box.innerHTML = '';
    tool.build(box);
    document.getElementById('stage').classList.toggle('dark', !!tool.darkStage);
    App.canvas.style.cursor = tool.cursor || 'crosshair';
    try { localStorage.setItem('kirakira-tool', tool.id); } catch (e) { /* storage may be blocked */ }
    if (tool.activate) tool.activate();
    notifyImage();
  }

  function canvasPoint(e) {
    const r = App.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * App.canvas.width / r.width,
      y: (e.clientY - r.top) * App.canvas.height / r.height,
    };
  }

  function wireCanvas() {
    const c = App.canvas;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      if (!App.A) return;
      App.touched = true;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* old WebViews / synthetic events */ }
      const p = canvasPoint(e);
      Object.assign(App.pointer, p, { down: true, inside: true });
      if (App.current.down) App.current.down(p, e);
    });
    c.addEventListener('pointermove', e => {
      if (!App.A) return;
      const p = canvasPoint(e);
      Object.assign(App.pointer, p, { inside: true });
      if (App.current.move) App.current.move(p, e);
    });
    const end = e => {
      if (!App.A || !App.pointer.down) return;
      App.pointer.down = false;
      if (App.current.up) App.current.up(canvasPoint(e), e);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => {
      App.pointer.inside = false;
      if (App.A && App.current.leave) App.current.leave();
    });
    c.addEventListener('wheel', e => {
      if (!App.A || !App.current.wheel) return;
      if (App.current.wheel(canvasPoint(e), e) !== false) e.preventDefault();
    }, { passive: false });
  }

  function drawEmpty() {
    App.resize(1000, 640);
    const x = App.ctx;
    x.fillStyle = '#fbf5ea'; x.fillRect(0, 0, 1000, 640);
    x.strokeStyle = '#2a2533'; x.setLineDash([10, 10]); x.lineWidth = 3;
    x.beginPath(); App.roundRect(x, 40, 40, 920, 560, 26); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#ff5c8a';
    Shapes.trace(x, 'sparkle', 500, 250, 60, performance.now() / 1400); x.fill();
    x.fillStyle = '#2a2533'; x.textAlign = 'center';
    x.font = '900 34px "Zen Maru Gothic", sans-serif';
    x.fillText('Drop a picture here', 500, 380);
    x.font = '500 22px "Zen Maru Gothic", sans-serif';
    x.fillStyle = '#6b6377';
    x.fillText('…or upload one on the left, or try the demo pictures', 500, 420);
  }

  function loop(t) {
    if (!App.A) drawEmpty();
    else if (App.current && App.current.frame) App.current.frame(t);
    requestAnimationFrame(loop);
  }

  function wireExport() {
    document.getElementById('exportBtn').addEventListener('click', () => {
      if (!App.A) { App.toast('Add a picture first ✦'); return; }
      const c = (App.current.exportCanvas && App.current.exportCanvas()) || App.canvas;
      c.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kirakira-${App.current.id}.png`;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, 'image/png');
    });
  }

  App.start = function () {
    App.canvas = document.getElementById('canvas');
    App.ctx = App.canvas.getContext('2d');
    const tabs = document.getElementById('tabs');
    for (const [group, label] of [['play', 'photo play'], ['merch', 'OC merch']]) {
      const row = el('div', 'tab-group');
      row.append(el('span', 'tab-group-label', label));
      for (const tool of App.tools.filter(t => (t.group || 'play') === group)) {
        const b = el('button', 'tab', `<span class="tab-icon">${tool.icon}</span>${tool.short || tool.name}`);
        b.type = 'button';
        b.dataset.id = tool.id;
        b.setAttribute('role', 'tab');
        b.addEventListener('click', () => selectTool(tool));
        row.append(b);
      }
      tabs.append(row);
    }
    buildFilterUI();
    wireUploads();
    wireCanvas();
    wireExport();
    let saved = null;
    try { saved = localStorage.getItem('kirakira-tool'); } catch (e) { /* ignore */ }
    App.setPicture('A', Demo.make(true));
    App.setPicture('B', Demo.make(false));
    selectTool(App.tools.find(t => t.id === saved) || App.tools[0]);
    requestAnimationFrame(loop);
    // fonts are drawn into canvases, so redraw once they arrive (they may come late, or never in mainland China)
    if (document.fonts) {
      document.fonts.ready.then(() => notifyImage());
      // …but a late font must never wipe out what someone is in the middle of doing
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (!App.touched) notifyImage(); });
    }
  };
})();
