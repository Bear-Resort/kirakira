/* ☁ Foggy Window — the picture sits behind a fogged-up car window. Drag to wipe
   the condensation away; water drips run down from the wiped edges and the fog
   slowly creeps back. */
(function () {
  'use strict';

  const st = { thickness: 72, brush: 60, hardness: 35, regrow: 30, drips: true, tint: 'frost' };
  const TINTS = {
    frost: [225, 234, 242], warm: [246, 232, 220], night: [120, 132, 160], steam: [250, 250, 252],
  };

  let w = 0, h = 0;
  let fog = null, mask = null, mctx = null, tmp = null, tctx = null;
  let brushImg = null, last = null, drips = [], frameNo = 0, breathe = 0;

  function makeBrush() {
    const r = 128;
    brushImg = App.makeCanvas(r * 2, r * 2);
    const x = brushImg.getContext('2d');
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    const hard = st.hardness / 100;
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(Math.min(.95, .2 + hard * .75), 'rgba(255,255,255,.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, r * 2, r * 2);
  }

  function buildFog() {
    const A = App.A;
    fog = App.blurred(A, 24);
    const x = fog.getContext('2d');
    const [r, g, b] = TINTS[st.tint];
    x.fillStyle = `rgba(${r},${g},${b},${.25 + st.thickness / 100 * .62})`;
    x.fillRect(0, 0, w, h);
    // uneven patches of condensation
    const rand = App.rng(5);
    for (let i = 0; i < 26; i++) {
      const cx = rand() * w, cy = rand() * h, rr = (.1 + rand() * .25) * Math.max(w, h);
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, `rgba(${r},${g},${b},${.12 * rand()})`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }
    // tiny droplets beaded on the glass
    const n = Math.round(w * h / 700);
    for (let i = 0; i < n; i++) {
      const dx = rand() * w, dy = rand() * h, dr = .6 + Math.pow(rand(), 3) * 4.5;
      x.fillStyle = 'rgba(255,255,255,.28)';
      x.beginPath(); x.arc(dx, dy, dr, 0, Math.PI * 2); x.fill();
      if (dr > 2) {
        x.fillStyle = 'rgba(40,50,70,.12)';
        x.beginPath(); x.arc(dx + dr * .2, dy + dr * .35, dr * .8, 0, Math.PI); x.fill();
        x.fillStyle = 'rgba(255,255,255,.7)';
        x.beginPath(); x.arc(dx - dr * .3, dy - dr * .35, dr * .3, 0, Math.PI * 2); x.fill();
      }
    }
  }

  function wipe(x0, y0, x1, y1) {
    const r = st.brush * Math.max(w, h) / 1000;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / (r * .2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = App.lerp(x0, x1, t), py = App.lerp(y0, y1, t);
      mctx.drawImage(brushImg, px - r, py - r, r * 2, r * 2);
    }
    if (st.drips && Math.random() < Math.min(.6, dist / (r * 6))) {
      drips.push({
        x: x1 + (Math.random() - .5) * r * 1.2,
        y: y1 + r * (.55 + Math.random() * .3),
        r: (1.5 + Math.random() * 2.5) * Math.max(w, h) / 1000,
        v: .6 + Math.random() * 1.6,
        left: (40 + Math.random() * 260) * Math.max(w, h) / 1000,
      });
    }
  }

  function stepDrips() {
    const out = [];
    for (const d of drips) {
      if (Math.random() < .82) {
        const dy = d.v * (.4 + Math.random());
        mctx.fillStyle = '#fff';
        mctx.beginPath(); mctx.arc(d.x, d.y, d.r * .75, 0, Math.PI * 2); mctx.fill();
        d.y += dy; d.left -= dy;
        d.x += (Math.random() - .5) * .5;
      }
      if (d.left > 0 && d.y < h + 10) out.push(d);
    }
    drips = out;
  }

  const tool = {
    id: 'fog', name: 'Foggy Window', short: 'Foggy Window', icon: '☁',
    hint: 'Your picture is behind a fogged-up car window. Drag across it to wipe the fog off — try writing a word with a small brush. Drips run down and the fog slowly comes back.',
    cursor: 'none',

    build(box) {
      const ui = App.ui;
      ui.slider(box, 'Wipe size', { min: 10, max: 160, value: st.brush }, v => { st.brush = v; });
      ui.slider(box, 'Wipe edge hardness', { min: 0, max: 100, value: st.hardness }, v => { st.hardness = v; makeBrush(); });
      ui.slider(box, 'Fog thickness', { min: 0, max: 100, value: st.thickness }, v => { st.thickness = v; if (App.A) buildFog(); });
      ui.slider(box, 'Fog comes back', { min: 0, max: 100, value: st.regrow, format: v => v ? v : 'never' }, v => { st.regrow = v; });
      ui.seg(box, 'Weather', [['frost', 'Frosty'], ['warm', 'Warm café'], ['night', 'Night'], ['steam', 'Steam']], st.tint, v => { st.tint = v; if (App.A) buildFog(); });
      ui.toggle(box, 'Water drips', st.drips, v => { st.drips = v; });
      ui.buttons(box, [
        ['💨 Breathe on it', () => { breathe = 40; drips = []; }],
        ['✋ Wipe it all', () => { mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, w, h); }],
      ]);
      ui.note(box, 'Small brush + hardness 80+ = finger writing. Big + soft = sleeve wipe.');
    },

    onImage() {
      w = App.A.width; h = App.A.height;
      App.resize(w, h);
      mask = App.makeCanvas(w, h); mctx = mask.getContext('2d');
      tmp = App.makeCanvas(w, h); tctx = tmp.getContext('2d');
      makeBrush();
      buildFog();
      drips = [];
    },

    down(p) { last = p; wipe(p.x, p.y, p.x, p.y); },
    move(p) { if (App.pointer.down && last) { wipe(last.x, last.y, p.x, p.y); last = p; } },
    up() { last = null; },

    frame() {
      if (!fog) return;
      frameNo++;
      // fog creeping back: a periodic gentle fade of the "wiped" mask
      if (breathe > 0) {
        breathe--;
        mctx.globalCompositeOperation = 'destination-out';
        mctx.fillStyle = 'rgba(0,0,0,.14)'; mctx.fillRect(0, 0, w, h);
        mctx.globalCompositeOperation = 'source-over';
      } else if (st.regrow > 0) {
        const every = Math.round(App.lerp(140, 3, st.regrow / 100));
        if (frameNo % every === 0) {
          mctx.globalCompositeOperation = 'destination-out';
          mctx.fillStyle = 'rgba(0,0,0,.06)'; mctx.fillRect(0, 0, w, h);
          mctx.globalCompositeOperation = 'source-over';
        }
      }
      if (drips.length) stepDrips();

      const x = App.ctx;
      x.drawImage(App.A, 0, 0);
      tctx.globalCompositeOperation = 'copy';
      tctx.drawImage(fog, 0, 0);
      tctx.globalCompositeOperation = 'destination-out';
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = 'source-over';
      x.drawImage(tmp, 0, 0);

      // drip heads — little lens-like beads
      for (const d of drips) {
        x.fillStyle = 'rgba(255,255,255,.35)';
        x.beginPath(); x.arc(d.x, d.y, d.r * 1.3, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,255,255,.9)';
        x.beginPath(); x.arc(d.x - d.r * .4, d.y - d.r * .4, d.r * .4, 0, Math.PI * 2); x.fill();
      }
      // light reflection on the glass
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.35, 'rgba(255,255,255,0)');
      g.addColorStop(.62, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,.07)'); g.addColorStop(.78, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);

      if (App.pointer.inside) {
        const r = st.brush * Math.max(w, h) / 1000;
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = Math.max(2, w / 600);
        x.setLineDash([6, 6]);
        x.beginPath(); x.arc(App.pointer.x, App.pointer.y, r, 0, Math.PI * 2); x.stroke();
        x.setLineDash([]);
      }
    },
  };

  App.register(tool);
})();
