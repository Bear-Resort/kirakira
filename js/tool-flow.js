/* 〰 Flow Paint — the picture is repainted live by thousands of brush strokes
   that travel along its edges (perpendicular to the brightness gradient), each
   coloured by the pixel where it starts. Big loose strokes first, fine detail
   last, like a painter in fast-forward. Drag on the canvas to paint more strokes
   wherever you want detail. (Brought over from the first version, Darkroom.) */
(function () {
  'use strict';

  const st = { size: 9, length: 22, paper: 'cream', style: 'oil', colour: 'original', speed: 5 };
  const PAPERS = { cream: '#f3ead8', white: '#fbfbf8', black: '#141317', kraft: '#c7a77c', blue: '#1d2a4a' };

  let w = 0, h = 0, src = null, field = null, paint = null, px = null;
  let seed = 1, frameNo = 0, rand = null, last = null;
  const TOTAL = 220;

  // separable box blur, two passes ≈ Gaussian
  function boxBlur(input, radius) {
    let a = Float32Array.from(input), b = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        let sum = 0, count = 0;
        for (let x = -radius; x < w + radius; x++) {
          if (x + radius < w) { sum += a[y * w + x + radius]; count++; }
          if (x - radius - 1 >= 0) { sum -= a[y * w + x - radius - 1]; count--; }
          if (x >= 0 && x < w) b[y * w + x] = sum / count;
        }
      }
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let y = -radius; y < h + radius; y++) {
          if (y + radius < h) { sum += b[(y + radius) * w + x]; count++; }
          if (y - radius - 1 >= 0) { sum -= b[(y - radius - 1) * w + x]; count--; }
          if (y >= 0 && y < h) a[y * w + x] = sum / count;
        }
      }
    }
    return a;
  }

  function angleAt(x, y) {
    const xi = Math.min(w - 3, Math.max(2, x | 0)), yi = Math.min(h - 3, Math.max(2, y | 0));
    const gx = field[yi * w + xi + 2] - field[yi * w + xi - 2];
    const gy = field[(yi + 2) * w + xi] - field[(yi - 2) * w + xi];
    // flat areas swirl gently instead
    if (Math.abs(gx) + Math.abs(gy) < 2) return Math.sin(x * .006 + seed) * 2 + Math.cos(y * .008 - seed) * 2;
    return Math.atan2(gy, gx) + Math.PI / 2;
  }

  function colourAt(x, y) {
    const p = ((y | 0) * w + (x | 0)) * 4, j = () => (rand() - .5) * 24;
    let r = src[p] + j(), g = src[p + 1] + j(), b = src[p + 2] + j();
    if (st.colour !== 'original') {
      const l = .299 * r + .587 * g + .114 * b;
      const k = st.colour === 'vivid' ? 1.55 : 1.15;
      r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k;
      if (st.colour === 'pastel') { r = r * .7 + 255 * .3; g = g * .7 + 255 * .3; b = b * .72 + 255 * .28; }
    }
    return [App.clamp(r, 0, 255) | 0, App.clamp(g, 0, 255) | 0, App.clamp(b, 0, 255) | 0];
  }

  // one stroke that follows the flow from (x, y)
  function stroke(x, y, size, len) {
    const [r, g, b] = colourAt(x, y);
    const a = .55 + rand() * .4;
    const pts = [[x, y]];
    const steps = Math.max(2, (len * (.5 + rand())) | 0);
    for (let k = 0; k < steps; k++) {
      const ang = angleAt(x, y);
      x += Math.cos(ang) * 1.6; y += Math.sin(ang) * 1.6;
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      pts.push([x, y]);
    }
    const line = (lw, alpha, ox, oy) => {
      px.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      px.lineWidth = lw;
      px.beginPath();
      pts.forEach(([qx, qy], i) => px[i ? 'lineTo' : 'moveTo'](qx + ox, qy + oy));
      px.stroke();
    };
    if (st.style === 'ink') {
      line(Math.max(.8, size * .25), Math.min(1, a + .2), 0, 0);
    } else if (st.style === 'crayon') {
      // dry, broken bristles: a few thin parallel lines
      const n = 3 + (size / 3 | 0);
      for (let i = 0; i < n; i++) line(Math.max(.7, size * .18), a * .55, (rand() - .5) * size, (rand() - .5) * size);
    } else {
      const lw = size * (.6 + rand() * .8);
      line(lw, a, 0, 0);
      // a lighter streak along one side, like paint catching the light
      line(Math.max(.6, lw * .25), .18, -lw * .2, -lw * .2);
    }
  }

  function restart() {
    if (!App.A) return;
    rand = App.rng(seed * 104729);
    frameNo = 0;
    px.globalCompositeOperation = 'source-over';
    px.fillStyle = PAPERS[st.paper]; px.fillRect(0, 0, w, h);
    px.lineCap = 'round'; px.lineJoin = 'round';
  }

  const tool = {
    id: 'flow', name: 'Flow Paint', short: 'Flow Paint', icon: '〰',
    hint: 'Your picture repainted live by thousands of brush strokes that flow along its shapes — big loose strokes first, fine detail last. Drag on the canvas to paint extra strokes wherever you want more detail.',
    cursor: 'crosshair',

    build(box) {
      const U = App.ui;
      U.buttons(box, [['🎨 Repaint', () => { seed++; restart(); }]]);
      U.seg(box, 'Brush', [['oil', 'Oil'], ['ink', 'Ink lines'], ['crayon', 'Crayon']], st.style, v => { st.style = v; restart(); });
      U.slider(box, 'Brush size', { min: 2, max: 24, value: st.size }, v => { st.size = v; restart(); });
      U.slider(box, 'Stroke length', { min: 4, max: 60, value: st.length }, v => { st.length = v; restart(); });
      U.seg(box, 'Colour', [['original', 'Original'], ['pastel', 'Pastel'], ['vivid', 'Vivid']], st.colour, v => { st.colour = v; restart(); });
      U.seg(box, 'Paper', [['cream', 'Cream'], ['white', 'White'], ['kraft', 'Kraft'], ['black', 'Black'], ['blue', 'Night blue']], st.paper, v => { st.paper = v; restart(); });
      U.slider(box, 'Painting speed', { min: 1, max: 10, value: st.speed }, v => { st.speed = v; });
    },

    onImage() {
      // keep it reasonably sized so the painting stays quick
      const s = Math.min(1, 1300 / Math.max(App.A.width, App.A.height));
      w = Math.round(App.A.width * s); h = Math.round(App.A.height * s);
      App.resize(w, h);
      const c = App.makeCanvas(w, h);
      c.getContext('2d').drawImage(App.A, 0, 0, w, h);
      src = c.getContext('2d').getImageData(0, 0, w, h).data;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) lum[i] = .299 * src[i * 4] + .587 * src[i * 4 + 1] + .114 * src[i * 4 + 2];
      field = boxBlur(lum, 3);
      paint = App.makeCanvas(w, h); px = paint.getContext('2d');
      restart();
    },

    down(p) { last = p; },
    move(p) {
      if (!App.pointer.down || !last || !px) return;
      // paint fine strokes around the pointer
      const r = Math.max(14, st.size * 4);
      for (let i = 0; i < 14; i++) {
        const a = rand() * Math.PI * 2, d = rand() * r;
        stroke(App.clamp(p.x + Math.cos(a) * d, 0, w - 1), App.clamp(p.y + Math.sin(a) * d, 0, h - 1), Math.max(1, st.size * .45), st.length * .7);
      }
      last = p;
    },
    up() { last = null; },

    frame() {
      if (!paint) return;
      if (frameNo < TOTAL) {
        // several painting steps per frame, depending on the speed slider
        const steps = Math.max(1, Math.round(st.speed / 3));
        for (let n = 0; n < steps && frameNo < TOTAL; n++, frameNo++) {
          const progress = frameNo / TOTAL;
          const size = Math.max(1, st.size * 2.5 * (1 - progress * .8));
          const len = st.length * (1 - progress * .5);
          const count = Math.round(w * h / 1800 * (st.speed >= 3 ? 1 : st.speed / 3));
          for (let s = 0; s < count; s++) stroke(rand() * w, rand() * h, size, len);
        }
      }
      App.ctx.drawImage(paint, 0, 0);
    },
  };

  App.register(tool);
})();
