// Darkroom — turns uploaded photos into generative art on a <canvas>.
// Everything runs in the browser; photos never leave the computer.

const MAX_SIDE = 1100; // longest side of the output, in pixels

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const photos = [];  // { img, url }
let activeIndex = 0;
let mode = "flow";
let seed = Math.random() * 1000;
let renderToken = 0; // bumped on each render so old animations stop

const BLURBS = {
  flow: "Thousands of brush strokes follow the edges in your photo, coarse to fine — like a painter working in fast-forward.",
  sort: "Pixels inside a brightness band are sorted into streaks. A classic glitch-art technique.",
  halftone: "Rebuilds the image from dots, the way magazines and comics were printed.",
  weave: "Cuts every uploaded photo into strips and weaves them together. Best with 2–4 photos.",
};

// ---------- Uploading ----------

const dropzone = document.getElementById("dropzone");
const studio = document.getElementById("studio");

document.getElementById("file-input").addEventListener("change", (e) => addFiles(e.target.files));
document.getElementById("file-input-more").addEventListener("change", (e) => addFiles(e.target.files));

// Drag-and-drop works anywhere on the page
["dragenter", "dragover"].forEach((type) =>
  window.addEventListener(type, (e) => { e.preventDefault(); dropzone.classList.add("over"); })
);
["dragleave", "drop"].forEach((type) =>
  window.addEventListener(type, (e) => { e.preventDefault(); dropzone.classList.remove("over"); })
);
window.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith("image/") || f.name.match(/\.(heic|heif)$/i));
  if (!files.length) return;

  const loads = files.map((file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      alert(`Couldn't open "${file.name}". Your browser may not support this format (HEIC photos from iPhones often need converting to JPG first).`);
      resolve(null);
    };
    img.src = url;
  }));

  Promise.all(loads).then((loaded) => {
    const good = loaded.filter(Boolean);
    if (!good.length) return;
    const firstNew = photos.length;
    photos.push(...good);
    activeIndex = firstNew;
    dropzone.hidden = true;
    studio.hidden = false;
    renderThumbs();
    render();
  });
}

function renderThumbs() {
  const box = document.getElementById("thumbs");
  box.innerHTML = "";
  photos.forEach((p, i) => {
    const b = document.createElement("button");
    b.className = "thumb" + (i === activeIndex ? " active" : "");
    b.title = "Use this photo";
    b.innerHTML = `<img src="${p.url}" alt="">`;
    b.addEventListener("click", () => { activeIndex = i; renderThumbs(); render(); });
    box.appendChild(b);
  });
}

// ---------- Controls ----------

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    mode = tab.dataset.mode;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".controls").forEach((c) => (c.hidden = c.dataset.for !== mode));
    render();
  });
});

let debounce;
document.querySelectorAll(".controls input, .controls select").forEach((el) => {
  el.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 150);
  });
});

document.getElementById("rerender").addEventListener("click", () => {
  seed = Math.random() * 1000;
  render();
});

document.getElementById("download").addEventListener("click", (e) => {
  e.preventDefault();
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `darkroom-${mode}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

const val = (id) => document.getElementById(id).value;
const num = (id) => Number(val(id));

// ---------- Helpers ----------

// Small seeded random generator so "Re-roll" gives a new but repeatable look
function makeRandom(s) {
  let t = Math.floor(s * 9973) >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Size of the output canvas for a given image
function fitSize(img) {
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  return [Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale)];
}

// Draw an image into a fresh offscreen canvas of size w×h, cropping to fill ("cover")
function coverCanvas(img, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  c.getContext("2d").drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

function sourcePixels(img, w, h) {
  return coverCanvas(img, w, h).getContext("2d").getImageData(0, 0, w, h);
}

// ---------- Render dispatch ----------

function render() {
  if (!photos.length) return;
  renderToken++;
  document.getElementById("mode-blurb").textContent = BLURBS[mode];

  const img = photos[activeIndex].img;
  const [w, h] = fitSize(img);
  canvas.width = w;
  canvas.height = h;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  if (mode === "flow") flowPaint(img, w, h);
  else if (mode === "sort") pixelSort(img, w, h);
  else if (mode === "halftone") halftone(img, w, h);
  else if (mode === "weave") weave(w, h);
}

// ---------- Flow Paint ----------
// Brush strokes travel along the edges of the photo (perpendicular to the
// brightness gradient), colored by the pixel where each stroke starts.

function flowPaint(img, w, h) {
  const token = renderToken;
  const rand = makeRandom(seed);
  const src = sourcePixels(img, w, h).data;
  const maxSize = num("flow-size") * 2.5;
  const length = num("flow-length");

  // Brightness map, lightly blurred so the flow field is smooth
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
  }
  const blurred = boxBlur(lum, w, h, 3);

  const angleAt = (x, y) => {
    const xi = Math.min(w - 3, Math.max(2, x | 0));
    const yi = Math.min(h - 3, Math.max(2, y | 0));
    const gx = blurred[yi * w + xi + 2] - blurred[yi * w + xi - 2];
    const gy = blurred[(yi + 2) * w + xi] - blurred[(yi - 2) * w + xi];
    // In flat areas fall back to a gentle swirling pattern
    const swirl = Math.sin(x * 0.006 + seed) * 2 + Math.cos(y * 0.008 - seed) * 2;
    if (Math.abs(gx) + Math.abs(gy) < 2) return swirl;
    return Math.atan2(gy, gx) + Math.PI / 2;
  };

  ctx.fillStyle = val("flow-paper");
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = "round";

  const totalFrames = 220;
  const strokesPerFrame = Math.round((w * h) / 1800);
  let frame = 0;

  function step() {
    if (token !== renderToken) return; // a newer render started
    const progress = frame / totalFrames;
    // Start with big loose strokes, finish with fine detail
    const size = Math.max(1, maxSize * (1 - progress * 0.8));
    const len = length * (1 - progress * 0.5);

    for (let s = 0; s < strokesPerFrame; s++) {
      let x = rand() * w;
      let y = rand() * h;
      const p = ((y | 0) * w + (x | 0)) * 4;
      const jitter = () => (rand() - 0.5) * 24;
      const r = src[p] + jitter(), g = src[p + 1] + jitter(), b = src[p + 2] + jitter();

      ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.55 + rand() * 0.4})`;
      ctx.lineWidth = size * (0.6 + rand() * 0.8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = Math.max(2, (len * (0.5 + rand())) | 0);
      for (let k = 0; k < steps; k++) {
        const a = angleAt(x, y);
        x += Math.cos(a) * 1.6;
        y += Math.sin(a) * 1.6;
        if (x < 0 || y < 0 || x >= w || y >= h) break;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    frame++;
    if (frame < totalFrames) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Separable box blur, repeated passes approximate a Gaussian
function boxBlur(input, w, h, radius) {
  let a = Float32Array.from(input);
  let b = new Float32Array(w * h);
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

// ---------- Pixel Sort ----------
// Along each row (or column), find runs of pixels whose brightness is inside
// [low, high] and sort each run by brightness.

function pixelSort(img, w, h) {
  const imageData = sourcePixels(img, w, h);
  const px = new Uint32Array(imageData.data.buffer);
  let lo = num("sort-lo"), hi = num("sort-hi");
  if (lo > hi) [lo, hi] = [hi, lo];
  const vertical = val("sort-dir") === "v";
  const reverse = document.getElementById("sort-reverse").checked;

  const bright = (p) => 0.299 * (p & 255) + 0.587 * ((p >> 8) & 255) + 0.114 * ((p >> 16) & 255);
  const lines = vertical ? w : h;
  const lineLen = vertical ? h : w;
  const index = (line, i) => (vertical ? i * w + line : line * w + i);

  for (let line = 0; line < lines; line++) {
    let i = 0;
    while (i < lineLen) {
      // skip pixels outside the band
      while (i < lineLen && !inBand(bright(px[index(line, i)]))) i++;
      const start = i;
      while (i < lineLen && inBand(bright(px[index(line, i)]))) i++;
      if (i - start > 1) {
        const run = [];
        for (let k = start; k < i; k++) run.push(px[index(line, k)]);
        run.sort((a, b) => (reverse ? bright(b) - bright(a) : bright(a) - bright(b)));
        for (let k = start; k < i; k++) px[index(line, k)] = run[k - start];
      }
    }
  }
  function inBand(v) { return v >= lo && v <= hi; }

  ctx.putImageData(imageData, 0, 0);
}

// ---------- Halftone ----------

function halftone(img, w, h) {
  const src = sourcePixels(img, w, h).data;
  const cell = num("ht-cell");
  const style = val("ht-style");
  const rand = makeRandom(seed);

  const sample = (x, y) => {
    const p = ((y | 0) * w + (x | 0)) * 4;
    return [src[p], src[p + 1], src[p + 2]];
  };

  // Draws one rotated grid of dots. inkAt(r,g,b) returns 0..1 dot coverage.
  function screen(angleDeg, color, inkAt, scale = 1) {
    const a = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const cx = w / 2, cy = h / 2;
    const reach = Math.ceil(Math.hypot(w, h) / 2 / cell) + 1;
    ctx.fillStyle = color;
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const gx = i * cell, gy = j * cell;
        const x = cx + gx * cos - gy * sin;
        const y = cy + gx * sin + gy * cos;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const ink = inkAt(...sample(x, y));
        // radius from area so coverage matches ink amount
        const r = cell * 0.6 * Math.sqrt(ink) * scale;
        if (r < 0.3) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (style === "cmy") {
    ctx.fillStyle = "#fbf8f1";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "multiply";
    screen(15, "rgb(0,170,235)", (r) => 1 - r / 255);
    screen(75, "rgb(235,0,140)", (r, g) => 1 - g / 255);
    screen(0, "rgb(255,230,0)", (r, g, b) => 1 - b / 255);
    screen(45, "rgb(30,25,30)", (r, g, b) => Math.max(0, 0.45 - Math.max(r, g, b) / 255) * 2, 0.8);
    ctx.globalCompositeOperation = "source-over";
  } else if (style === "mono") {
    ctx.fillStyle = "#efe9dc";
    ctx.fillRect(0, 0, w, h);
    screen(45, "#1b1a1d", (r, g, b) => 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255);
  } else {
    // Pop art: a random bold color pair, posterized into big dots
    const pairs = [
      ["#ff4f9a", "#1b1f6b"], ["#ffd23f", "#e4002b"], ["#2ec4b6", "#20114d"],
      ["#ff8c42", "#2b2d42"], ["#c3f73a", "#5b2a86"],
    ];
    const [bg, ink] = pairs[Math.floor(rand() * pairs.length)];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    screen(45, ink, (r, g, b) => {
      const l = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return Math.round(l * 4) / 4; // posterize into 5 levels
    }, 1.1);
  }
}

// ---------- Weave ----------
// Every photo is cut into strips; strips alternate between photos and are
// nudged up/down in a wave. "Basket" checkerboards vertical and horizontal strips.

function weave(w, h) {
  const width = num("weave-width");
  const wave = num("weave-wave");
  const dir = val("weave-dir");

  // Put the active photo first so it leads the pattern
  const order = [photos[activeIndex], ...photos.filter((_, i) => i !== activeIndex)];
  const layers = order.map((p) => coverCanvas(p.img, w, h));

  const vertical = stripLayer(layers, w, h, width, wave, true, 0);
  if (dir === "v") {
    ctx.drawImage(vertical, 0, 0);
  } else if (dir === "h") {
    ctx.drawImage(stripLayer(layers, w, h, width, wave, false, 0), 0, 0);
  } else {
    // Basket: start from horizontal strips (offset by one photo), then paint
    // vertical strips on a checkerboard so they look over-and-under.
    const horizontal = stripLayer(layers, w, h, width, wave, false, 1);
    ctx.drawImage(horizontal, 0, 0);
    ctx.save();
    ctx.beginPath();
    for (let x = 0, i = 0; x < w; x += width, i++) {
      for (let y = 0, j = 0; y < h; y += width, j++) {
        if ((i + j) % 2 === 0) ctx.rect(x, y, width, width);
      }
    }
    ctx.clip();
    ctx.drawImage(vertical, 0, 0);
    ctx.restore();
  }

  // Soft shadows along the strip edges give a paper-weave texture
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  if (dir !== "h") for (let x = width; x < w; x += width) ctx.fillRect(x - 1, 0, 1.5, h);
  if (dir !== "v") for (let y = width; y < h; y += width) ctx.fillRect(0, y - 1, w, 1.5);
}

function stripLayer(layers, w, h, width, wave, vertical, shift) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  const span = vertical ? w : h;
  const full = vertical ? h : w;

  for (let pos = 0, k = 0; pos < span; pos += width, k++) {
    const layer = layers[(k + shift) % layers.length];
    // With only one photo, waves alone create the effect; with more, strips also alternate
    const offset = Math.sin(k * 0.45 + seed) * wave;
    // Draw the strip twice so the wrap-around fills the gap left by the offset
    for (const extra of [0, offset > 0 ? -full : full]) {
      const o = offset + extra;
      if (vertical) g.drawImage(layer, pos, 0, width, h, pos, o, width, h);
      else g.drawImage(layer, 0, pos, w, width, o, pos, w, width);
    }
  }
  return c;
}
