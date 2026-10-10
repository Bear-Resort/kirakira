/* Shape paths shared by the tools. Each draws a path of "radius" r centred at 0,0.
   Shapes.trace(ctx, name, x, y, r, rot) begins a new path at (x, y) with rotation;
   the path keeps its transform after the save/restore, so callers just fill/clip. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  const S = window.Shapes = {
    circle(c, r) { c.moveTo(r, 0); c.arc(0, 0, r, 0, TAU); },
    triangle(c, r) {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3;
        c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
    },
    square(c, r) { const s = r * .86; App.roundRect(c, -s, -s, s * 2, s * 2, r * .18); },
    diamond(c, r) { c.moveTo(0, -r); c.lineTo(r * .72, 0); c.lineTo(0, r); c.lineTo(-r * .72, 0); c.closePath(); },
    star(c, r) {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
        c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    },
    heart(c, r) {
      c.moveTo(0, r * .9);
      c.bezierCurveTo(-r * .2, r * .65, -r * 1.1, r * .25, -r, -r * .3);
      c.bezierCurveTo(-r * .9, -r * .95, -r * .15, -r, 0, -r * .45);
      c.bezierCurveTo(r * .15, -r, r * .9, -r * .95, r, -r * .3);
      c.bezierCurveTo(r * 1.1, r * .25, r * .2, r * .65, 0, r * .9);
      c.closePath();
    },
    // the four-pointed ✦ sparkle
    sparkle(c, r) {
      const k = r * .14;
      c.moveTo(0, -r);
      c.quadraticCurveTo(k, -k, r, 0);
      c.quadraticCurveTo(k, k, 0, r);
      c.quadraticCurveTo(-k, k, -r, 0);
      c.quadraticCurveTo(-k, -k, 0, -r);
      c.closePath();
    },
    flower(c, r) {
      for (let i = 0; i <= 120; i++) {
        const a = i / 120 * TAU, rr = r * (.72 + .28 * Math.cos(a * 5));
        c[i ? 'lineTo' : 'moveTo'](Math.cos(a - Math.PI / 2) * rr, Math.sin(a - Math.PI / 2) * rr);
      }
      c.closePath();
    },
    moon(c, r) {
      c.moveTo(Math.cos(Math.PI * .28) * r, Math.sin(Math.PI * .28) * r);
      c.arc(0, 0, r, Math.PI * .28, Math.PI * 1.72);
      c.arc(r * .42, -r * .08, r * .78, Math.PI * 1.5, Math.PI * .5, true);
      c.closePath();
    },
  };

  S.names = ['circle', 'triangle', 'star', 'heart', 'sparkle', 'square', 'diamond', 'flower', 'moon'];
  S.labels = {
    circle: '● Circle', triangle: '▲ Triangle', star: '★ Star', heart: '♥ Heart', sparkle: '✦ Sparkle',
    square: '■ Square', diamond: '◆ Diamond', flower: '✿ Flower', moon: '☾ Moon',
  };

  S.trace = function (ctx, name, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    S[name](ctx, r);
    ctx.restore();
  };
})();
