/* In-browser self-test. Open tests/browser.html on any device — including inside WeChat —
   to check the real browser engine: rendering, the poster's QR pixels, and the full play flow. */
(function () {
  'use strict';
  const KK = window.KK, QR = window.QR;
  const list = document.getElementById('list');
  const results = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const root = new URL('../', location.href).href;

  document.getElementById('env').textContent = [
    navigator.userAgent,
    /MicroMessenger/i.test(navigator.userAgent) ? 'WeChat ✓' : 'not WeChat',
    'PointerEvent ' + (window.PointerEvent ? '✓' : '✗'),
    'Intl.Segmenter ' + (window.Intl && Intl.Segmenter ? '✓' : '✗ (fallback)'),
    'dpr ' + (window.devicePixelRatio || 1),
  ].join(' · ');

  function report(name, ok, detail) {
    results.push(ok);
    const li = document.createElement('li');
    li.className = ok ? 'ok' : 'bad';
    li.textContent = (ok ? '✓ ' : '✗ ') + name + (detail ? ' — ' + detail : '');
    list.append(li);
  }
  async function check(name, fn) {
    try {
      const r = await Promise.race([fn(), sleep(15000).then(() => { throw new Error('timed out'); })]);
      report(name, r !== false, typeof r === 'string' ? r : '');
    } catch (e) { report(name, false, e && e.message ? e.message : String(e)); }
  }
  const assert = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };

  function lumStats(canvas, rect, scale) {
    const x = canvas.getContext('2d');
    const d = x.getImageData(Math.round(rect.x * scale), Math.round(rect.y * scale), Math.round(rect.w * scale), Math.round(rect.h * scale)).data;
    let n = 0, sum = 0, sq = 0;
    for (let i = 0; i < d.length; i += 16) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += l; sq += l * l; n++; }
    const mean = sum / n;
    return { mean, sd: Math.sqrt(sq / n - mean * mean) };
  }

  function frame(path) {
    return new Promise((resolve, reject) => {
      const f = document.createElement('iframe');
      f.src = root + path;
      f.onload = () => setTimeout(() => resolve(f), 350);
      f.onerror = reject;
      document.body.append(f);
    });
  }
  function swipe(win, y, id) {
    const fog = win.document.getElementById('fog'), r = fog.getBoundingClientRect();
    const P = (type, fx) => new win.PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + fx * r.width, clientY: r.top + y * r.height, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
    fog.dispatchEvent(P('pointerdown', 0.06));
    for (let i = 1; i <= 30; i++) fog.dispatchEvent(P('pointermove', 0.06 + 0.88 * i / 30));
    fog.dispatchEvent(P('pointerup', 0.94));
    win.__kkPlay.flush();
    return win.__kkPlay.progress();
  }

  const NOTE = { message: '生日快乐！今晚火锅我请，不许迟到 ✦', from: 'Tina', theme: 'cream' };

  // The maker saves drafts; keep the person's own draft safe while we test.
  let savedDraft = null;
  try { savedDraft = localStorage.getItem('kk-draft'); } catch (e) { /* no storage */ }
  const restoreDraft = () => { try { savedDraft == null ? localStorage.removeItem('kk-draft') : localStorage.setItem('kk-draft', savedDraft); } catch (e) { /* ignore */ } };

  (async function run() {
    await check('canvas text renders CJK (system font present)', () => {
      const c = KK.makeCanvas(200, 60), x = c.getContext('2d');
      x.font = `800 40px ${KK.FONT_UI}`;
      const w = x.measureText('雾里的悄悄话').width;
      return w > 150 ? `width ${Math.round(w)}px` : false;
    });

    let card;
    await check('card renders at the expected size with text bounds', () => {
      card = KK.renderCard(Object.assign({ lang: 'zh' }, NOTE), 0.6);
      assert(card.width === 600 && card.height === 750, `size ${card.width}x${card.height}`);
      const t = card.textRect;
      assert(t && t.w > 100 && t.h > 100 && t.x >= 100 && t.y >= 250 && t.y + t.h <= 960, 'textRect ' + JSON.stringify(t));
      return `text ${Math.round(t.w)}x${Math.round(t.h)}`;
    });

    await check('fog hides the note (contrast in text area drops a lot)', () => {
      const fog = KK.renderFog(card, NOTE);
      const merged = KK.makeCanvas(card.width, card.height), m = merged.getContext('2d');
      m.drawImage(card, 0, 0); m.drawImage(fog, 0, 0);
      const a = lumStats(card, card.textRect, 0.6), b = lumStats(merged, card.textRect, 0.6);
      assert(b.sd < a.sd * 0.3, `sd card ${a.sd.toFixed(1)} vs fogged ${b.sd.toFixed(1)}`);
      return `contrast ${a.sd.toFixed(0)} → ${b.sd.toFixed(0)}`;
    });

    await check('wiping really erases fog pixels', () => {
      const fog = KK.renderFog(card, NOTE), x = fog.getContext('2d');
      const alphaAt = () => x.getImageData(300, 375, 1, 1).data[3];
      const before = alphaAt();
      KK.wipeStroke(x, KK.makeBrush(40), 250, 375, 350, 375);
      const after = alphaAt();
      assert(before > 200 && after < 20, `alpha ${before} → ${after}`);
      return `alpha ${before} → ${after}`;
    });

    for (const th of KK.THEME_IDS) {
      await check(`poster (${th}): QR pixels exactly match the play link`, () => {
        const url = KK.buildPlayUrl(root + 'play.html', Object.assign({}, NOTE, { theme: th }));
        const { canvas, qr, qrBox } = KK.renderPoster(Object.assign({}, NOTE, { theme: th }), url, QR);
        assert(canvas.width === 1080 && canvas.height === 1440, 'poster size');
        const expect = QR.encode(url, { ecl: 'M', maxVersion: 12 });
        assert(expect.version === qr.version && expect.mask === qr.mask, 'same code');
        const x = canvas.getContext('2d'), quiet = 3;
        const img = x.getImageData(qrBox.x, qrBox.y, qrBox.size, qrBox.size).data;
        let wrong = 0;
        for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
          const px = Math.floor((c + quiet + 0.5) * qrBox.cell), py = Math.floor((r + quiet + 0.5) * qrBox.cell);
          const i = (py * qrBox.size + px) * 4;
          const dark = (img[i] + img[i + 1] + img[i + 2]) / 3 < 128;
          if (dark !== !!expect.modules[r][c]) wrong++;
        }
        assert(qrBox.cell >= 4, `module ${qrBox.cell}px is too small to scan reliably`);
        assert(wrong === 0, `${wrong} wrong modules`);
        return `v${qr.version}-${qr.ecl}, ${qrBox.cell}px modules, ${url.length} chars`;
      });
    }

    await check('play: three swipes over the text reveal the note', async () => {
      const url = KK.buildPlayUrl(root + 'play.html', NOTE);
      const f = await frame(url.slice(root.length));
      const w = f.contentWindow, d = f.contentDocument;
      assert(!d.getElementById('main').hidden, 'play page shown');
      assert(w.__kkPlay.data.message === NOTE.message, 'note decoded');
      const steps = [0.32, 0.46, 0.6].map((y, i) => swipe(w, y, i + 1));
      await sleep(800);
      assert(w.__kkPlay.state.done, 'not done after ' + steps.join('→'));
      assert(!d.getElementById('done').hidden, 'sheet visible');
      assert(d.getElementById('stage').getAttribute('aria-label').includes(NOTE.message), 'screen-reader label has the note');
      d.getElementById('save').click();
      await sleep(200);
      assert(d.getElementById('saveImg').naturalWidth === 1000, 'save image rendered');
      d.getElementById('saveClose').click();
      d.getElementById('again').click();
      await sleep(50);
      assert(!w.__kkPlay.state.done && w.__kkPlay.progress() === 0, 'play again resets');
      const ext = w.performance.getEntriesByType('resource').map(e => e.name).filter(n => !n.startsWith(location.origin) && !n.includes('goatcounter') && !n.includes('gc.zgo.at'));
      assert(!ext.length, 'external requests: ' + ext.join(', '));
      f.remove();
      return 'progress ' + steps.join('% → ') + '%';
    });

    await check('play: a single swipe is not a reveal', async () => {
      const f = await frame(KK.buildPlayUrl(root + 'play.html', NOTE).slice(root.length));
      const p = swipe(f.contentWindow, 0.46, 1);
      await sleep(100);
      const done = f.contentWindow.__kkPlay.state.done;
      f.remove();
      assert(!done && p > 0 && p < 100, `progress ${p}, done ${done}`);
      return `progress ${p}%`;
    });

    await check('play: broken link shows the friendly error, not a crash', async () => {
      const f = await frame('play.html#v=1&m=u***');
      const d = f.contentDocument;
      const ok = d.getElementById('main').hidden && !d.getElementById('bad').hidden;
      f.remove();
      return ok;
    });

    await check('play: injected HTML is shown as text only', async () => {
      const f = await frame('play.html#v=1&m=' + KK.encodeText('<img src=x onerror=alert(1)>') + '&f=' + KK.encodeText('<b>x</b>'));
      const d = f.contentDocument;
      const injected = d.querySelectorAll('img[src="x"], b').length;
      const title = d.getElementById('title').textContent;
      f.remove();
      assert(!injected, 'element injected');
      return title.startsWith('<b>x</b>') ? 'escaped' : false;
    });

    await check('play: works with WeChat’s ?from=singlemessage added', async () => {
      const f = await frame('play.html?from=singlemessage&isappinstalled=0#v=1&t=mint&m=' + KK.encodeText('你好'));
      const data = f.contentWindow.__kkPlay.data;
      f.remove();
      return data.ok && data.message === '你好' && data.theme === 'mint';
    });

    await check('maker: valid note produces a poster and the right link', async () => {
      const f = await frame('make.html');
      const w = f.contentWindow, d = f.contentDocument;
      const set = (id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
      set('msg', NOTE.message); set('from', NOTE.from);
      d.querySelector('input[name=theme][value=cream]').click();
      d.getElementById('create').click();
      await sleep(1200);
      const open = !d.getElementById('result').hidden;
      const link = d.getElementById('linkField').value;
      const img = d.getElementById('posterImg');
      const u = new URL(link);
      const parsed = KK.parsePlayParams(u.hash, u.search);
      f.remove();
      assert(open, 'result dialog opened');
      assert(img.naturalWidth === 1080, 'poster image ' + img.naturalWidth);
      assert(parsed.message === NOTE.message && parsed.from === NOTE.from, 'link round-trips');
      return 'ok';
    });

    await check('maker: empty note is blocked with an inline error', async () => {
      const f = await frame('make.html');
      const d = f.contentDocument, w = f.contentWindow;
      const el = d.getElementById('msg'); el.value = ''; el.dispatchEvent(new w.Event('input', { bubbles: true }));
      d.getElementById('create').click();
      await sleep(100);
      const r = d.getElementById('result').hidden && !d.getElementById('msgErr').hidden && d.getElementById('msg').getAttribute('aria-invalid') === 'true';
      f.remove();
      return r;
    });

    restoreDraft();
    const pass = results.filter(Boolean).length;
    const sum = document.getElementById('sum');
    sum.textContent = `${pass}/${results.length} passed · 通过 ${pass}/${results.length}`;
    sum.className = pass === results.length ? 'ok' : 'bad';
    window.__selfTest = { pass, total: results.length };
  })();
})();
