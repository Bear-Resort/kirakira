/* ◉ Button Badge — a real 3D tin button badge (吧唧) of your OC, rendered with
   Three.js (WebGL). The model is built from real 58 mm pin-back button
   proportions: a domed face, the printed paper rolled over a curved edge, a
   pressed metal back with a safety pin. Studio lighting with reflections makes
   the glossy film, matte, holographic thin-film and glitter finishes behave
   like the real thing. Drag to turn it, double-click to flip it over. */
(function () {
  'use strict';
  const CW = 1400, CH = 1050;
  const THREE_URL = 'vendor/three-0.149.0/three.min.js'; // self-hosted: CDNs are unreliable in mainland China

  const st = { shape: 'circle', size: 58, zoom: 100, panX: 0, panY: 0, finish: 'gloss', back: 'silver', bg: 'pastel', text: 'OC GOODS' };

  // badge proportions, in units of the face radius
  const R = 1, EDGE = .075, DOME = .055;

  let T = null;                 // the THREE namespace once loaded
  let three = null;             // {renderer, scene, camera, group, ...}
  let loading = false, failed = false;
  const rot = { x: .18, y: -.3, vx: 0, vy: 0, restX: .18, restY: -.3 };
  let press = null, lastT = 0;

  /* ---------- setup ---------- */
  async function ensureThree() {
    if (three || loading || failed) return;
    loading = true;
    try {
      await App.loadScript(THREE_URL);
      T = window.THREE;
      initScene();
    } catch (err) {
      console.error(err);
      failed = true;
      App.toast('The 3D engine could not load — it needs internet the first time.', 6000);
    }
    loading = false;
  }

  function initScene() {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(CW, CH, false);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.LinearToneMapping;   // keeps pastel print colours true
    renderer.toneMappingExposure = .92;
    renderer.setClearColor(0x000000, 0);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(28, CW / CH, .1, 100);
    camera.position.set(0, 0, 6.2);

    // A little photo studio, baked into reflections: soft boxes, a rim strip, a dim room.
    const pmrem = new T.PMREMGenerator(renderer);
    const studio = new T.Scene();
    studio.add(new T.Mesh(new T.SphereGeometry(20, 32, 16), new T.MeshBasicMaterial({ color: 0x17151b, side: T.BackSide })));
    const panel = (w, h, x, y, z, k, tint) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(tint || 0xffffff).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
    };
    panel(5, 3.5, -6, 6, 7, 3.2);             // key soft box, upper left
    panel(3, 12, 9, 0, 3, 3.2, 0xdfe8ff);     // tall rim strip, right
    panel(10, 3, 0, -8, 4, .9, 0xffe6f0);     // warm bounce from below
    panel(4, 4, 0, 4, -9, 1.5);               // behind (lights the back)
    scene.environment = pmrem.fromScene(studio, .03).texture;

    const key = new T.DirectionalLight(0xffffff, .9); key.position.set(-3, 4, 5); scene.add(key);
    scene.add(new T.AmbientLight(0xffffff, .15));

    const group = new T.Group();
    group.rotation.order = 'YXZ';
    scene.add(group);
    three = { renderer, scene, camera, group, meshes: [], textures: [] };
    rebuild();
  }

  /* ---------- textures ---------- */
  function canvasTex(c, srgb) {
    const t = new T.CanvasTexture(c);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = three.renderer.capabilities.getMaxAnisotropy();
    three.textures.push(t);
    return t;
  }

  // the printed paper: the framed art in the middle, bleeding past the face to wrap the edge
  function printCanvas(faceFrac) {
    const S = 2048, c = App.makeCanvas(S, S), x = c.getContext('2d');
    const A = App.A, face = S * faceFrac;
    x.drawImage(App.blurred(App.coverInto(A, 256, 256), 4), 0, 0, S, S);   // soft bleed colour
    const s = Math.max(face / A.width, face / A.height) * st.zoom / 100;
    const dw = A.width * s, dh = A.height * s;
    x.imageSmoothingQuality = 'high';
    x.drawImage(A, S / 2 - dw / 2 + st.panX / 100 * dw / 2, S / 2 - dh / 2 + st.panY / 100 * dh / 2, dw, dh);
    return c;
  }

  function backCanvas() {
    const S = 1024, c = App.makeCanvas(S, S), b = c.getContext('2d');
    const M = { silver: ['#f4f6f8', '#b9c0c8'], gold: ['#fff1c4', '#d8ad4c'], black: ['#4a4a52', '#26262c'] }[st.back];
    const g = b.createRadialGradient(S * .45, S * .4, S * .05, S / 2, S / 2, S * .6);
    g.addColorStop(0, M[0]); g.addColorStop(1, M[1]);
    b.fillStyle = g; b.fillRect(0, 0, S, S);
    b.strokeStyle = 'rgba(255,255,255,.18)'; b.lineWidth = 1;
    for (let r = 4; r < S * .7; r += 4) { b.beginPath(); b.arc(S / 2, S / 2, r, 0, Math.PI * 2); b.stroke(); }   // spun-metal rings
    b.strokeStyle = 'rgba(0,0,0,.25)'; b.lineWidth = 6;
    b.beginPath(); b.arc(S / 2, S / 2, S * .42, 0, Math.PI * 2); b.stroke();
    // stamped text — drawn mirrored because we read it from behind
    b.save(); b.translate(S, 0); b.scale(-1, 1);
    b.fillStyle = 'rgba(0,0,0,.35)'; b.font = `${S * .05}px "DotGothic16", monospace`; b.textAlign = 'center';
    b.fillText('✦ ' + st.text + ' ✦', S / 2, S * .76);
    b.restore();
    return c;
  }

  function flakesCanvas() {
    // random tiny facets as a normal map = glitter that flashes as it turns
    const S = 1024, c = App.makeCanvas(S, S), x = c.getContext('2d'), r = App.rng(12);
    for (let j = 0; j < S; j += 4) for (let i = 0; i < S; i += 4) {
      x.fillStyle = `rgb(${128 + (r() - .5) * 200 | 0},${128 + (r() - .5) * 200 | 0},255)`;
      x.fillRect(i, j, 4, 4);
    }
    return c;
  }

  function laserCanvas() {
    // thin-film thickness pattern: fine diagonal lines and little stars
    const S = 1024, c = App.makeCanvas(S, S), x = c.getContext('2d'), r = App.rng(4);
    x.fillStyle = '#777'; x.fillRect(0, 0, S, S);
    for (let i = -S; i < S * 2; i += 10) { x.strokeStyle = r() < .5 ? '#bbb' : '#444'; x.lineWidth = 4; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); }
    x.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) { Shapes.trace(x, 'sparkle', r() * S, r() * S, 10 + r() * 22, 0); x.fill(); }
    return c;
  }

  /* ---------- geometry ---------- */
  // Round badge: a lathe-style mesh built from the real cross-section, with UVs
  // that follow the paper as it wraps round the edge.
  function roundFront() {
    const prof = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48; prof.push([R * t, EDGE + DOME * (1 - t * t)]); }
    for (let i = 1; i <= 40; i++) {
      const a = Math.PI / 2 - i / 40 * (Math.PI * 1.35);    // over the edge and tucked under
      prof.push([R + EDGE * Math.cos(a), EDGE * Math.sin(a)]);
    }
    const s = [0];
    for (let i = 1; i < prof.length; i++) s.push(s[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const total = s[s.length - 1], faceLen = s[48];
    const M = 160, pos = [], nor = [], uv = [], idx = [];
    for (let j = 0; j <= M; j++) {
      const th = j / M * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      for (let i = 0; i < prof.length; i++) {
        const [r, z] = prof[i];
        const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)];
        let nr = -(b[1] - a[1]), nz = b[0] - a[0];
        const l = Math.hypot(nr, nz) || 1; nr /= l; nz /= l;
        pos.push(r * c, r * sn, z);
        nor.push(nr * c, nr * sn, nz);
        const k = s[i] / total * .5;
        uv.push(.5 + k * c, .5 + k * sn);
      }
    }
    const P = prof.length;
    for (let j = 0; j < M; j++) for (let i = 0; i < P - 1; i++) {
      const a = j * P + i, b = (j + 1) * P + i;
      idx.push(a, a + 1, b, b, a + 1, b + 1);   // counter-clockwise seen from the front
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return { geo: g, faceFrac: faceLen / total };
  }

  function roundBack() {
    // the pressed metal back sitting inside the rolled lip
    const pts = [new T.Vector2(0, -EDGE * .82), new T.Vector2(R * .96, -EDGE * .82), new T.Vector2(R + EDGE * .25, -EDGE * .55), new T.Vector2(R + EDGE * .55, -EDGE * .2)];
    const g = new T.LatheGeometry(pts, 160);
    g.rotateX(Math.PI / 2);                       // lathe axis Y → badge axis Z
    // planar UVs for the back texture
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, .5 + p.getX(i) / (R * 2.2), .5 + p.getY(i) / (R * 2.2));
    return g;
  }

  // Heart / square / star: an extruded outline with a rounded bevel edge.
  function shapeOutline() {
    const sh = new T.Shape();
    const rec = {
      moveTo: (x, y) => sh.moveTo(x, -y), lineTo: (x, y) => sh.lineTo(x, -y),
      bezierCurveTo: (a, b, c, d, e, f) => sh.bezierCurveTo(a, -b, c, -d, e, -f),
      quadraticCurveTo: (a, b, c, d) => sh.quadraticCurveTo(a, -b, c, -d),
      closePath: () => {},
    };
    if (st.shape === 'square') {
      const s = R * .9, r = R * .2;
      sh.moveTo(-s + r, -s); sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r); sh.lineTo(s, s - r);
      sh.quadraticCurveTo(s, s, s - r, s); sh.lineTo(-s + r, s); sh.quadraticCurveTo(-s, s, -s, s - r); sh.lineTo(-s, -s + r);
      sh.quadraticCurveTo(-s, -s, -s + r, -s);
    } else Shapes[st.shape](rec, R * (st.shape === 'heart' ? 1 : 1.05));
    return sh;
  }

  function shapedBadge() {
    const depth = EDGE * .6;
    const g = new T.ExtrudeGeometry(shapeOutline(), { depth, bevelEnabled: true, bevelThickness: EDGE * .7, bevelSize: EDGE * .7, bevelSegments: 10, curveSegments: 90 });
    g.translate(0, 0, -depth / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    const span = R * 2.3;
    for (let i = 0; i < p.count; i++) uv.setXY(i, .5 + p.getX(i) / span, .5 + p.getY(i) / span);
    // split the caps into back (metal) and front (print)
    const caps = g.groups[0], sides = g.groups[1];
    g.clearGroups();
    g.addGroup(caps.start, caps.count / 2, 2);
    g.addGroup(caps.start + caps.count / 2, caps.count / 2, 0);
    g.addGroup(sides.start, sides.count, 1);
    return { geo: g, faceFrac: R * 2 / span };
  }

  function pin(mat) {
    const g = new T.Group(), z = -EDGE * .82 - .05;
    const bar = new T.Mesh(new T.CylinderGeometry(.02, .02, 1.25, 16), mat); bar.rotation.z = Math.PI / 2; bar.position.set(0, -.05, z); g.add(bar);
    const needle = new T.Mesh(new T.CylinderGeometry(.012, .006, 1.18, 12), mat); needle.rotation.z = Math.PI / 2 + .03; needle.position.set(.02, .07, z - .02); g.add(needle);
    const coil = new T.Mesh(new T.TorusGeometry(.05, .016, 10, 24), mat); coil.rotation.y = Math.PI / 2; coil.position.set(-.64, .01, z); g.add(coil);
    const clasp = new T.Mesh(new T.BoxGeometry(.13, .2, .07), mat); clasp.position.set(.64, .02, z); g.add(clasp);
    for (const x of [-.45, .45]) { const foot = new T.Mesh(new T.BoxGeometry(.08, .05, .05), mat); foot.position.set(x, -.05, z + .03); g.add(foot); }
    return g;
  }

  function rebuild() {
    if (!three || !App.A) return;
    const g3 = three.group;
    for (const m of three.meshes) { g3.remove(m); m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    for (const t of three.textures) t.dispose();
    three.meshes = []; three.textures = [];

    const round = st.shape === 'circle';
    const front = round ? roundFront() : shapedBadge();
    const print = new T.MeshPhysicalMaterial({ map: canvasTex(printCanvas(front.faceFrac), true), roughness: .5, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: .5 });
    if (st.finish === 'matte') { print.clearcoat = 0; print.roughness = .9; }
    if (st.finish === 'holo') {
      print.iridescence = 1; print.iridescenceIOR = 1.7; print.iridescenceThicknessRange = [150, 900];
      print.iridescenceThicknessMap = canvasTex(laserCanvas(), false);
      print.roughness = .35; print.metalness = .12;
    }
    if (st.finish === 'glitter') {
      print.normalMap = canvasTex(flakesCanvas(), false); print.normalScale = new T.Vector2(.9, .9);
      print.metalness = .35; print.roughness = .3;
    }
    const metal = new T.MeshStandardMaterial({ map: canvasTex(backCanvas(), true), metalness: 1, roughness: .32 });
    const steel = new T.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: .22 });

    if (round) three.meshes.push(new T.Mesh(front.geo, print), new T.Mesh(roundBack(), metal));
    else three.meshes.push(new T.Mesh(front.geo, [print, print, metal]));
    three.meshes.push(pin(steel));
    for (const m of three.meshes) g3.add(m);
  }

  /* ---------- drawing ---------- */
  function background(x) {
    const g = x.createLinearGradient(0, 0, CW, CH);
    if (st.bg === 'night') { g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#40306b'); }
    else if (st.bg === 'denim') { g.addColorStop(0, '#3d5a85'); g.addColorStop(1, '#2a3f60'); }
    else { g.addColorStop(0, '#fff0f5'); g.addColorStop(1, '#e4ddff'); }
    x.fillStyle = g; x.fillRect(0, 0, CW, CH);
    if (st.bg === 'denim') {
      x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 2;
      for (let i = -CH; i < CW; i += 7) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + CH, CH); x.stroke(); }
      x.strokeStyle = 'rgba(232,180,90,.75)'; x.setLineDash([16, 10]); x.lineWidth = 4;
      x.strokeRect(60, 60, CW - 120, CH - 120); x.setLineDash([]);
    } else {
      const r = App.rng(6);
      x.fillStyle = st.bg === 'night' ? 'rgba(255,240,180,.7)' : 'rgba(255,255,255,.9)';
      for (let i = 0; i < 24; i++) { Shapes.trace(x, 'sparkle', r() * CW, r() * CH, 6 + r() * 14, 0); x.fill(); }
    }
  }

  function draw(x) {
    background(x);
    const scale = st.size / 58;
    // soft contact shadow, squashed as it turns
    const pxPerUnit = CH / 2 / (6.2 * Math.tan(14 * Math.PI / 180));
    const rr = R * scale * pxPerUnit;
    x.save();
    x.fillStyle = 'rgba(40,20,60,.28)';
    x.shadowColor = 'rgba(40,20,60,.5)'; x.shadowBlur = 50;
    x.beginPath();
    x.ellipse(CW / 2 + 40 - Math.sin(rot.y) * 30, CH / 2 + 60 + Math.sin(rot.x) * 30, rr * Math.max(.25, Math.abs(Math.cos(rot.y))), rr * Math.max(.25, Math.abs(Math.cos(rot.x))), 0, 0, Math.PI * 2);
    x.fill();
    x.restore();

    const g3 = three.group;
    g3.scale.setScalar(scale);
    g3.rotation.y = rot.y;
    g3.rotation.x = -rot.x;
    three.renderer.render(three.scene, three.camera);
    x.drawImage(three.renderer.domElement, 0, 0);

    x.font = '18px "DotGothic16", monospace'; x.textAlign = 'center';
    x.fillStyle = st.bg === 'pastel' ? 'rgba(42,37,51,.55)' : 'rgba(255,255,255,.6)';
    x.fillText('drag to turn it · double-click to flip it over', CW / 2, CH - 24);
    x.textAlign = 'start';
  }

  function flip() { rot.restY += Math.PI; }

  const tool = {
    id: 'badge', name: 'Button Badge', short: 'Badge', icon: '◉', group: 'merch',
    hint: 'Your OC on a real 3D tin button badge (吧唧): domed glossy film, the print rolled over the edge, a metal back with a pin, lit like a photo studio. Drag to turn it, double-click to see the back.',
    cursor: 'grab',

    build(box) {
      const U = App.ui;
      U.buttons(box, [['↻ Flip over', flip], ['⟲ Face front', () => { rot.restY = Math.round(rot.restY / (Math.PI * 2)) * Math.PI * 2 - .3; rot.restX = .18; }]]);
      U.seg(box, 'Shape', [['circle', '● Round'], ['heart', '♥ Heart'], ['square', '■ Square'], ['star', '★ Star']], st.shape, v => { st.shape = v; rebuild(); });
      U.slider(box, 'Size', { min: 25, max: 75, value: st.size, format: v => v + 'mm' }, v => { st.size = v; });
      U.heading(box, 'Frame your OC');
      U.slider(box, 'Zoom', { min: 100, max: 400, value: st.zoom, format: v => v + '%' }, v => { st.zoom = v; rebuild(); });
      U.slider(box, 'Move left / right', { min: -100, max: 100, value: st.panX }, v => { st.panX = v; rebuild(); });
      U.slider(box, 'Move up / down', { min: -100, max: 100, value: st.panY }, v => { st.panY = v; rebuild(); });
      U.heading(box, 'Finish');
      U.seg(box, null, [['gloss', 'Glossy film'], ['matte', 'Matte'], ['holo', 'Laser holo'], ['glitter', 'Glitter']], st.finish, v => { st.finish = v; rebuild(); });
      U.seg(box, 'Metal back', [['silver', 'Silver'], ['gold', 'Gold'], ['black', 'Black']], st.back, v => { st.back = v; rebuild(); });
      U.text(box, 'Text stamped on the back', st.text, v => { st.text = v; rebuild(); });
      U.seg(box, 'Background', [['pastel', 'Pastel'], ['denim', 'Denim bag'], ['night', 'Night']], st.bg, v => { st.bg = v; });
      U.note(box, 'Real 3D (Three.js). The 3D engine downloads the first time you open this tab, so it needs internet once.');
    },

    activate() { ensureThree(); },
    onImage() { App.resize(CW, CH); rebuild(); },

    down(p, e) {
      if (e.detail === 2) { flip(); return; }
      press = { x: p.x, y: p.y, rx: rot.x, ry: rot.y };
    },
    move(p) {
      if (!press || !App.pointer.down) return;
      rot.y = press.ry + (p.x - press.x) * .006;
      rot.x = App.clamp(press.rx - (p.y - press.y) * .006, -1.3, 1.3);
    },
    up() {
      if (!press) return;
      press = null;
      // let go: it settles facing whichever side you turned it to
      rot.restY = Math.round((rot.y + .3) / Math.PI) * Math.PI - .3;
    },

    frame(t) {
      const x = App.ctx;
      x.setTransform(1, 0, 0, 1, 0, 0);
      const dt = Math.min(50, t - (lastT || t)) / 16.7;
      lastT = t;
      App.canvas.style.cursor = press ? 'grabbing' : 'grab';
      if (!three) {
        background(x);
        x.font = '700 30px "Zen Maru Gothic", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#2a2533';
        x.fillText(failed ? 'The 3D engine could not load (offline?)' : 'Loading the 3D badge…', CW / 2, CH / 2);
        x.textAlign = 'start';
        if (!loading && !failed) ensureThree();
        return;
      }
      if (!press) {
        // springy settle + a gentle idle wobble
        const wy = rot.restY + Math.sin(t / 1400) * .08, wx = rot.restX + Math.cos(t / 1700) * .05;
        rot.vy += (wy - rot.y) * .03 * dt; rot.vx += (wx - rot.x) * .03 * dt;
        rot.vy *= Math.pow(.86, dt); rot.vx *= Math.pow(.86, dt);
        rot.y += rot.vy * dt; rot.x += rot.vx * dt;
      }
      draw(x);
    },
  };

  App.register(tool);
})();
