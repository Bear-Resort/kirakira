/* Procedurally drawn demo pictures: a chibi girl holding an ice cream.
   Demo.make(true)  -> daytime, eyes open      (Picture A)
   Demo.make(false) -> night time, eyes closed (Picture B, the "difference" twin) */
(function () {
  'use strict';
  const W = 1200, H = 900;

  function sky(x, day) {
    const g = x.createLinearGradient(0, 0, 0, H);
    if (day) { g.addColorStop(0, '#9fd8ff'); g.addColorStop(.55, '#ffd6e8'); g.addColorStop(1, '#ffe9c7'); }
    else { g.addColorStop(0, '#141238'); g.addColorStop(.6, '#3d2a6e'); g.addColorStop(1, '#8a4f8f'); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    const rnd = App.rng(day ? 3 : 4);
    if (day) {
      x.fillStyle = '#fff6c9';
      x.beginPath(); x.arc(980, 170, 90, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.85)';
      for (const [cx, cy, s] of [[200, 160, 1], [520, 110, .7], [860, 330, .8], [140, 420, .6]]) {
        for (const [dx, dy, r] of [[0, 0, 60], [55, 10, 48], [-55, 14, 44], [20, -30, 46]]) {
          x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); x.fill();
        }
      }
    } else {
      for (let i = 0; i < 160; i++) {
        x.fillStyle = `rgba(255,255,240,${.4 + rnd() * .6})`;
        x.beginPath(); x.arc(rnd() * W, rnd() * H * .75, rnd() * 2.2 + .4, 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = '#fff4c2';
      Shapes.trace(x, 'moon', 980, 170, 80, -.3); x.fill();
    }
    // floating sparkles
    for (let i = 0; i < 14; i++) {
      x.fillStyle = day ? 'rgba(255,255,255,.9)' : 'rgba(255,230,140,.95)';
      Shapes.trace(x, 'sparkle', rnd() * W, rnd() * H * .8, 10 + rnd() * 18, 0); x.fill();
    }
    // rolling hills
    x.fillStyle = day ? '#b9e8c4' : '#2c2457';
    x.beginPath(); x.moveTo(0, 760);
    x.quadraticCurveTo(300, 650, 620, 740); x.quadraticCurveTo(900, 820, 1200, 700);
    x.lineTo(1200, 900); x.lineTo(0, 900); x.fill();
  }

  function girl(x, open) {
    const ink = '#3a2a4f';
    x.lineJoin = 'round'; x.lineCap = 'round';

    // back hair
    x.fillStyle = '#5b3f8c';
    x.beginPath();
    x.moveTo(380, 360);
    x.bezierCurveTo(330, 620, 360, 830, 420, 900);
    x.lineTo(780, 900);
    x.bezierCurveTo(840, 830, 870, 620, 820, 360);
    x.closePath(); x.fill();

    // body + sailor collar
    x.fillStyle = '#ffffff';
    x.beginPath(); x.moveTo(430, 900); x.quadraticCurveTo(440, 700, 600, 690);
    x.quadraticCurveTo(760, 700, 770, 900); x.closePath(); x.fill();
    x.strokeStyle = ink; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#3d5aa8';
    x.beginPath(); x.moveTo(500, 712); x.lineTo(600, 800); x.lineTo(700, 712);
    x.lineTo(740, 760); x.lineTo(600, 860); x.lineTo(460, 760); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#ff5c8a';
    x.beginPath(); x.moveTo(600, 800); x.lineTo(560, 860); x.lineTo(600, 845); x.lineTo(640, 860); x.closePath(); x.fill(); x.stroke();

    // neck + face
    x.fillStyle = '#ffe1d1';
    x.fillRect(570, 640, 60, 70);
    x.beginPath();
    x.moveTo(420, 420);
    x.bezierCurveTo(420, 600, 520, 690, 600, 690);
    x.bezierCurveTo(680, 690, 780, 600, 780, 420);
    x.bezierCurveTo(780, 260, 420, 260, 420, 420);
    x.fill(); x.strokeStyle = ink; x.lineWidth = 5; x.stroke();

    // blush
    x.fillStyle = 'rgba(255,120,150,.45)';
    for (const cx of [480, 720]) { x.beginPath(); x.ellipse(cx, 560, 38, 20, 0, 0, Math.PI * 2); x.fill(); }
    x.strokeStyle = 'rgba(230,80,110,.7)'; x.lineWidth = 3;
    for (const cx of [480, 720]) for (let i = -1; i <= 1; i++) {
      x.beginPath(); x.moveTo(cx + i * 14 - 5, 568); x.lineTo(cx + i * 14 + 5, 552); x.stroke();
    }

    // eyes
    for (const cx of [510, 690]) {
      if (open) {
        x.fillStyle = '#fff';
        x.beginPath(); x.ellipse(cx, 500, 52, 62, 0, 0, Math.PI * 2); x.fill();
        const g = x.createLinearGradient(0, 445, 0, 560);
        g.addColorStop(0, '#3b1f78'); g.addColorStop(.55, '#8b5cff'); g.addColorStop(1, '#ff8fc8');
        x.fillStyle = g;
        x.beginPath(); x.ellipse(cx, 508, 40, 54, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#24113f';
        x.beginPath(); x.ellipse(cx, 505, 18, 26, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#fff';
        x.beginPath(); x.ellipse(cx - 14, 478, 14, 18, -.4, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(cx + 16, 535, 7, 0, Math.PI * 2); x.fill();
        x.strokeStyle = ink; x.lineWidth = 11;
        x.beginPath(); x.ellipse(cx, 500, 54, 62, 0, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
        x.lineWidth = 6;
        x.beginPath(); x.moveTo(cx + (cx < 600 ? -48 : 48), 470); x.lineTo(cx + (cx < 600 ? -66 : 66), 452); x.stroke();
      } else {
        x.strokeStyle = ink; x.lineWidth = 9;
        x.beginPath(); x.arc(cx, 492, 46, Math.PI * .15, Math.PI * .85); x.stroke();
        x.lineWidth = 5;
        for (const t of [.25, .5, .75]) {
          const a = Math.PI * (.15 + .7 * t);
          x.beginPath(); x.moveTo(cx + Math.cos(a) * 46, 492 + Math.sin(a) * 46);
          x.lineTo(cx + Math.cos(a) * 60, 492 + Math.sin(a) * 60); x.stroke();
        }
      }
    }
    // mouth
    x.strokeStyle = ink; x.lineWidth = 5;
    x.beginPath();
    if (open) { x.moveTo(580, 610); x.quadraticCurveTo(600, 630, 620, 610); }
    else { x.moveTo(578, 612); x.quadraticCurveTo(589, 624, 600, 612); x.quadraticCurveTo(611, 624, 622, 612); }
    x.stroke();

    // bangs
    x.fillStyle = '#6c4ba3';
    x.beginPath();
    x.moveTo(400, 470);
    x.bezierCurveTo(380, 260, 820, 260, 800, 470);
    const tips = [[770, 455], [735, 380], [700, 440], [650, 360], [610, 430], [560, 360], [520, 440], [480, 380], [430, 460]];
    let px = 800;
    for (const [tx, ty] of tips) {
      x.quadraticCurveTo((px + tx) / 2, ty - 70, tx, ty);
      px = tx;
    }
    x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = 5; x.stroke();
    // hair shine
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 10;
    x.beginPath(); x.arc(600, 420, 150, Math.PI * 1.2, Math.PI * 1.45); x.stroke();
    // ahoge
    x.strokeStyle = '#6c4ba3'; x.lineWidth = 12;
    x.beginPath(); x.moveTo(600, 300); x.bezierCurveTo(590, 230, 660, 220, 650, 260); x.stroke();
    // hair clip star
    x.fillStyle = '#ffd35c'; x.strokeStyle = ink; x.lineWidth = 4;
    Shapes.trace(x, 'star', 735, 360, 30, .2); x.fill(); x.stroke();
  }

  function iceCream(x) {
    const ink = '#3a2a4f';
    x.strokeStyle = ink; x.lineWidth = 5;
    // cone
    x.fillStyle = '#e8a75b';
    x.beginPath(); x.moveTo(880, 640); x.lineTo(1000, 640); x.lineTo(940, 830); x.closePath(); x.fill(); x.stroke();
    x.save(); x.clip();
    x.strokeStyle = 'rgba(150,90,40,.7)'; x.lineWidth = 3;
    for (let i = -6; i < 8; i++) {
      x.beginPath(); x.moveTo(860 + i * 22, 620); x.lineTo(960 + i * 22, 840); x.stroke();
      x.beginPath(); x.moveTo(1020 - i * 22, 620); x.lineTo(920 - i * 22, 840); x.stroke();
    }
    x.restore();
    // scoops
    x.fillStyle = '#9ef0cf';
    x.beginPath(); x.arc(940, 600, 70, Math.PI * .95, Math.PI * 2.05); x.quadraticCurveTo(940, 660, 870, 640); x.fill(); x.stroke();
    x.fillStyle = '#ffb3cf';
    x.beginPath(); x.arc(940, 520, 58, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.globalAlpha = .7;
    x.beginPath(); x.ellipse(915, 500, 16, 10, -.6, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
    // sprinkles + cherry
    const cols = ['#ff5c8a', '#ffd35c', '#8b7bff', '#4fcfa8'];
    const r = App.rng(9);
    x.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      x.strokeStyle = cols[i % 4];
      const a = r() * Math.PI * 2, d = r() * 40;
      const sx = 940 + Math.cos(a) * d, sy = 525 + Math.sin(a) * d * .8;
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + 8, sy + 5); x.stroke();
    }
    x.fillStyle = '#e8304e'; x.strokeStyle = ink;
    x.beginPath(); x.arc(945, 458, 18, 0, Math.PI * 2); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(948, 440); x.quadraticCurveTo(955, 415, 975, 410); x.stroke();
    // hand
    x.fillStyle = '#ffe1d1'; x.lineWidth = 5;
    x.beginPath(); x.ellipse(935, 705, 46, 34, -.2, 0, Math.PI * 2); x.fill(); x.stroke();
    x.strokeStyle = '#ffffff'; x.lineWidth = 46;
    x.beginPath(); x.moveTo(760, 860); x.quadraticCurveTo(860, 800, 905, 730); x.stroke();
    x.strokeStyle = ink; x.lineWidth = 5;
    x.beginPath(); x.moveTo(752, 836); x.quadraticCurveTo(845, 780, 885, 718); x.stroke();
  }

  window.Demo = {
    make(day) {
      const c = App.makeCanvas(W, H);
      const x = c.getContext('2d');
      sky(x, day);
      girl(x, day);
      iceCream(x);
      return c;
    },
  };
})();
