/* ✦ "A note in the fog" — shared core for make.html (poster maker) and play.html.
   Pure helpers (link encoding, text wrapping, wipe coverage, themes, strings) work in
   Node for tests; the render* functions need a browser canvas.
   No network: everything here is drawn locally so the pages work behind the GFW. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // `room` caps the encoded note+name so the QR stays ≤ version 10 (easy to scan) even with emoji.
  const LIMITS = { message: 30, from: 12, lines: 4, room: 130 };
  const CARD = { w: 1000, h: 1250 };
  const POSTER = { w: 1080, h: 1440 };
  const REVEAL_AT = 0.55;       // whole card this clear -> done
  const REVEAL_TEXT_AT = 0.6;   // …or the note's actual text this clear (people stop once they can read it)
  const TEXT_BOX = { x: 120, y: 290, w: 760, h: 640 };

  const FONT_UI = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", system-ui, sans-serif';
  const FONT_BRAND = '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", ' + FONT_UI;

  // ---------- themes (ink/bg pairs are contrast-checked in tests) ----------
  const THEMES = {
    cream: {
      id: 'cream', name: { zh: '奶油', en: 'Cream' },
      bg: '#fff4e6', bg2: '#ffe1ec', ink: '#2a2533', soft: '#5e566b', accent: '#e83e74', accent2: '#7a69f0',
      fog: [236, 238, 244], fogAlpha: 0.72, poster: '#fbf5ea',
    },
    night: {
      id: 'night', name: { zh: '夜空', en: 'Night' },
      bg: '#1f2147', bg2: '#2e2f66', ink: '#fdf6e3', soft: '#cfcbef', accent: '#ffd35c', accent2: '#a99cff',
      fog: [150, 160, 196], fogAlpha: 0.8, poster: '#17183a',
    },
    mint: {
      id: 'mint', name: { zh: '薄荷', en: 'Mint' },
      bg: '#e6f8f1', bg2: '#c9efe1', ink: '#173b33', soft: '#3f6158', accent: '#e0603a', accent2: '#2f9e7f',
      fog: [226, 240, 236], fogAlpha: 0.74, poster: '#f1fbf7',
    },
    sunset: {
      id: 'sunset', name: { zh: '落日', en: 'Sunset' },
      bg: '#ffe6d6', bg2: '#ffcdb8', ink: '#4a1e2c', soft: '#74404f', accent: '#d9366c', accent2: '#c77700',
      fog: [246, 232, 226], fogAlpha: 0.74, poster: '#fff3ea',
    },
  };
  const THEME_IDS = Object.keys(THEMES);
  const theme = id => (Object.prototype.hasOwnProperty.call(THEMES, id) ? THEMES[id] : THEMES.cream);

  // ---------- strings ----------
  const STRINGS = {
    zh: {
      brand_sub: '雾里的悄悄话',
      play_title_from: '{from} 给你留了一句话',
      play_title_anon: '有人给你留了一句话',
      play_title_demo: '这里藏着一句话',
      play_hint: '用手指擦开雾气看看',
      play_hint_mouse: '按住鼠标，擦开雾气',
      progress: '已擦开 {p}%',
      progress_more: '再擦擦…',
      progress_close: '快看到了！',
      just_show: '直接看',
      done_title: '看到了 ✦',
      done_time: '用时 {s} 秒',
      done_count: '已经有 {n} 人擦开过',
      make_own: '做一张我的',
      play_again: '再玩一次',
      save_pic: '保存图片',
      save_hint_wechat: '长按图片，选「保存图片」',
      save_hint_other: '长按或右键保存，也可以点下面的按钮',
      download: '下载图片',
      close: '关闭',
      bad_link_title: '这个链接好像不完整',
      bad_link_body: '可能复制的时候少了一截。可以请朋友重新发一次，或者自己做一张。',
      see_example: '看看示例',
      demo_message: '把想说的话藏在雾里 ✦',
      lang_toggle: 'EN',
      lang_toggle_label: 'Switch to English',
      card_label: '给你的悄悄话',
      card_from: '— {from}',
      // maker
      make_title: '雾里的悄悄话',
      make_lead: '写一句话，生成一张海报。朋友长按识别二维码，要用手指擦开雾气才能看到。',
      field_message: '悄悄话',
      field_message_ph: '生日快乐！今晚火锅我请 ✦',
      field_from: '署名（可不填）',
      field_from_ph: 'Tina',
      field_theme: '颜色',
      counter: '{n}/{max}',
      err_empty: '先写一句悄悄话',
      err_long: '最多 {max} 个字，再删掉 {n} 个',
      err_lines: '最多 {max} 行',
      err_from_long: '署名最多 {max} 个字',
      err_room: '表情符号占的位置比较多，再删掉几个',
      create: '生成海报',
      creating: '正在生成…',
      try_first: '先自己试试',
      result_title: '海报做好了 ✦',
      result_hint_wechat: '长按海报，选「保存图片」或「发送给朋友」',
      result_hint_other: '保存海报，发到朋友圈或者直接发给朋友',
      download_poster: '下载海报',
      copy_link: '复制链接',
      copied: '链接已复制',
      copy_failed: '复制失败，可以长按下面的链接手动复制',
      open_link: '打开链接',
      local_banner: '本地预览：二维码现在指向这台电脑，网站上线后朋友才能扫开。',
      preview_label: '海报预览',
      back_atelier: '回到工作室',
      poster_headline: '有一句话藏在雾里',
      poster_cta1: '长按识别二维码',
      poster_cta2: '亲手擦开雾气',
      poster_from: '来自 {from}',
      poster_tease: '划开看看',
    },
    en: {
      brand_sub: 'a note in the fog',
      play_title_from: '{from} left you a note',
      play_title_anon: 'Someone left you a note',
      play_title_demo: 'A note is hiding here',
      play_hint: 'Wipe the fog with your finger',
      play_hint_mouse: 'Hold and drag to wipe the fog',
      progress: '{p}% clear',
      progress_more: 'Keep wiping…',
      progress_close: 'Almost there!',
      just_show: 'Just show me',
      done_title: 'You found it ✦',
      done_time: 'Wiped in {s} s',
      done_count: '{n} people have wiped this so far',
      make_own: 'Make my own',
      play_again: 'Play again',
      save_pic: 'Save picture',
      save_hint_wechat: 'Long-press the picture, then choose “Save Image”',
      save_hint_other: 'Long-press or right-click to save, or use the button below',
      download: 'Download picture',
      close: 'Close',
      bad_link_title: 'This link looks incomplete',
      bad_link_body: 'Part of it may have been cut off when it was copied. Ask your friend to send it again, or make your own.',
      see_example: 'See an example',
      demo_message: 'Hide what you want to say in the fog ✦',
      lang_toggle: '中',
      lang_toggle_label: '切换到中文',
      card_label: 'a note for you',
      card_from: '— {from}',
      make_title: 'A note in the fog',
      make_lead: 'Write a line and get a poster. Friends long-press the QR code and have to wipe the fog away to read it.',
      field_message: 'Your note',
      field_message_ph: 'Happy birthday! Hotpot is on me tonight ✦',
      field_from: 'From (optional)',
      field_from_ph: 'Tina',
      field_theme: 'Color',
      counter: '{n}/{max}',
      err_empty: 'Write a note first',
      err_long: 'Up to {max} characters — remove {n} more',
      err_lines: 'Up to {max} lines',
      err_from_long: 'Name can be up to {max} characters',
      err_room: 'Emoji take up more room — remove a few',
      create: 'Create poster',
      creating: 'Creating…',
      try_first: 'Try it first',
      result_title: 'Your poster is ready ✦',
      result_hint_wechat: 'Long-press the poster, then choose “Save Image” or “Send to Chat”',
      result_hint_other: 'Save the poster and post it to Moments or send it to a friend',
      download_poster: 'Download poster',
      copy_link: 'Copy link',
      copied: 'Link copied',
      copy_failed: 'Couldn’t copy. Long-press the link below to copy it.',
      open_link: 'Open link',
      local_banner: 'Local preview: the QR code points to this computer until the site is online.',
      preview_label: 'Poster preview',
      back_atelier: 'Back to the atelier',
      poster_headline: 'A note is hiding in the fog',
      poster_cta1: 'Long-press the QR code',
      poster_cta2: 'and wipe the fog away',
      poster_from: 'from {from}',
      poster_tease: 'wipe me',
    },
  };

  function pickLang(navLang, stored) {
    if (stored === 'zh' || stored === 'en') return stored;
    return /^zh\b/i.test(navLang || '') ? 'zh' : 'en';
  }
  function t(lang, key, vars) {
    const table = STRINGS[lang] || STRINGS.en;
    let s = key in table ? table[key] : (STRINGS.en[key] != null ? STRINGS.en[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return s;
  }

  // ---------- text helpers ----------
  function graphemes(s) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), x => x.segment);
    }
    return Array.from(s);
  }
  /** Normalise user text: no control chars, unix newlines, trimmed lines, no runs of blank lines. */
  function cleanText(s, maxLines) {
    let out = String(s == null ? '' : s)
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, ' ')
      // control + bidi-override chars; keep U+200C/U+200D (joiners hold emoji like 👨‍👩‍👧 together)
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F​‎‏‪-‮⁦-⁩]/g, '')
      .split('\n').map(l => l.replace(/\s+$/u, '').replace(/^\s+/u, '')).join('\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
    if (maxLines) {
      const lines = out.split('\n');
      if (lines.length > maxLines) out = lines.slice(0, maxLines - 1).concat(lines.slice(maxLines - 1).join(' ')).join('\n');
    }
    return out;
  }
  /** Count what the user sees as characters (newlines don't count). */
  const visibleLength = s => graphemes(String(s).replace(/\n/g, '')).length;

  function validate(message, from) {
    const errors = [];
    const m = cleanText(message);
    const f = cleanText(from).replace(/\n/g, ' ');
    const ml = visibleLength(m);
    if (!ml) errors.push({ field: 'message', key: 'err_empty' });
    else if (ml > LIMITS.message) errors.push({ field: 'message', key: 'err_long', vars: { max: LIMITS.message, n: ml - LIMITS.message } });
    if (m.split('\n').length > LIMITS.lines) errors.push({ field: 'message', key: 'err_lines', vars: { max: LIMITS.lines } });
    if (visibleLength(f) > LIMITS.from) errors.push({ field: 'from', key: 'err_from_long', vars: { max: LIMITS.from } });
    if (!errors.length && encodeText(m).length + (f ? encodeText(f).length : 0) > LIMITS.room) {
      errors.push({ field: 'message', key: 'err_room' });
    }
    return { ok: !errors.length, errors, message: m, from: f, length: ml };
  }

  // ---------- link encoding ----------
  // Text travels base64url-encoded in the URL *fragment*, so it is never sent to any server.
  // 'u' = UTF-8, 'w' = UTF-16LE (a third shorter for Chinese); whichever is shorter wins.
  function bytesToB64url(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(s) {
    if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
    const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    let bin;
    try { bin = atob(pad); } catch (e) { return null; }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function encodeText(s) {
    const u8 = new TextEncoder().encode(s);
    const u16 = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); u16[i * 2] = c & 255; u16[i * 2 + 1] = c >> 8; }
    const a = 'u' + bytesToB64url(u8), b = 'w' + bytesToB64url(u16);
    return b.length < a.length ? b : a;
  }
  function decodeText(s) {
    if (typeof s !== 'string' || s.length < 1) return null;
    const bytes = b64urlToBytes(s.slice(1));
    if (!bytes) return null;
    try {
      if (s[0] === 'u') return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (s[0] === 'w') {
        if (bytes.length % 2) return null;
        let out = '';
        for (let i = 0; i < bytes.length; i += 2) out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
        if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)) return null; // broken surrogates
        return out;
      }
    } catch (e) { return null; }
    return null;
  }

  function buildPlayUrl(base, data) {
    const v = validate(data.message, data.from);
    if (!v.ok) throw new Error('invalid: ' + v.errors.map(e => e.key).join(','));
    const parts = ['v=1', 't=' + theme(data.theme).id, 'm=' + encodeText(v.message)];
    if (v.from) parts.push('f=' + encodeText(v.from));
    return String(base).replace(/[#?].*$/, '') + '#' + parts.join('&');
  }

  /** Read a play link. Looks at the #fragment first, then ?query (some apps move things around). */
  function parsePlayParams(hash, search) {
    const read = s => new URLSearchParams(String(s || '').replace(/^[#?]/, ''));
    let p = read(hash);
    if (!p.has('m') && !p.has('v')) p = read(search);
    if (!p.has('m') && !p.has('v')) return { ok: true, demo: true, theme: 'cream', message: '', from: '' };
    const message = decodeText(p.get('m') || '');
    const from = p.has('f') ? decodeText(p.get('f')) : '';
    if (message == null || from == null) return { ok: false, reason: 'decode' };
    const v = validate(message, from);
    if (!v.ok) return { ok: false, reason: 'invalid' };
    return { ok: true, demo: false, theme: theme(p.get('t')).id, message: v.message, from: v.from };
  }

  function isLocalHost(loc) {
    if (!loc) return true;
    if (loc.protocol === 'file:') return true;
    const h = loc.hostname || '';
    return h === 'localhost' || h === '0.0.0.0' || h === '[::1]' || /^127\./.test(h) ||
      /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /\.local$/.test(h);
  }

  // ---------- line wrapping (CJK-aware, with simple 禁则 rules) ----------
  const NO_START = /^[，。！？、；：）」』】》〉”’…·,.!?;:)\]}%~～ー]/u;
  const NO_END = /[（「『【《〈“‘(\[{]$/u;
  const WORDISH = /^[\p{Script=Latin}\p{N}'’\-_@#&]+$/u;
  const BREAK_AFTER = /^[，。！？、；：,.!?;:]$/u;

  function tokenize(line) {
    const out = [];
    for (const g of graphemes(line)) {
      const last = out[out.length - 1];
      if (WORDISH.test(g) && last && WORDISH.test(last)) out[out.length - 1] += g;
      else if (/^\s$/u.test(g) && last && /^\s+$/u.test(last)) out[out.length - 1] += g;
      else out.push(g);
    }
    return out;
  }

  /** Wrap text into lines no wider than maxW (except hanging punctuation). measure(str) -> width. */
  function wrapText(text, maxW, measure) {
    const lines = [], paraStart = [];
    for (const para of String(text).split('\n')) {
      paraStart.push(lines.length);
      let cur = '';
      for (const tok of tokenize(para)) {
        if (/^\s+$/u.test(tok) && !cur) continue;
        const trial = cur + tok;
        if (measure(trial.replace(/\s+$/u, '')) <= maxW) { cur = trial; continue; }
        if (cur) {
          // Prefer to break right after punctuation in the back half of the line ("生日快乐！/今晚…").
          const gs = graphemes(cur);
          let cut = -1;
          for (let i = gs.length - 1; i >= Math.ceil(gs.length * 0.5); i--) {
            if (BREAK_AFTER.test(gs[i - 1])) { cut = i; break; }
          }
          if (cut > 0 && cut < gs.length) {
            lines.push(gs.slice(0, cut).join('').replace(/\s+$/u, ''));
            cur = gs.slice(cut).join('').replace(/^\s+/u, '');
            if (measure((cur + tok).replace(/\s+$/u, '')) <= maxW) { cur += tok; continue; }
          }
          lines.push(cur.replace(/\s+$/u, '')); cur = '';
        }
        if (/^\s+$/u.test(tok)) continue;
        if (measure(tok) <= maxW) { cur = tok; continue; }
        for (const g of graphemes(tok)) { // a single word wider than the line: break it
          if (cur && measure(cur + g) > maxW) { lines.push(cur); cur = ''; }
          cur += g;
        }
      }
      lines.push(cur.replace(/\s+$/u, ''));
    }
    for (let i = 1; i < lines.length; i++) {
      if (paraStart.includes(i)) continue; // never move punctuation across a line break the user typed
      while (lines[i] && NO_START.test(lines[i]) && lines[i - 1]) {
        const g = graphemes(lines[i])[0];
        lines[i - 1] += g; lines[i] = lines[i].slice(g.length);
      }
      while (lines[i - 1] && NO_END.test(lines[i - 1]) && graphemes(lines[i - 1]).length > 1) {
        const gs = graphemes(lines[i - 1]); const g = gs.pop();
        lines[i - 1] = gs.join(''); lines[i] = g + lines[i];
      }
    }
    return lines.filter(Boolean);
  }

  /** Largest font size (step 2) whose wrapped lines fit the box. measureAt(size)(str) -> width. */
  function fitText(text, boxW, boxH, measureAt, o) {
    const opt = Object.assign({ max: 120, min: 40, lineHeight: 1.35, maxLines: 6 }, o || {});
    for (let size = opt.max; size >= opt.min; size -= 2) {
      const lines = wrapText(text, boxW, measureAt(size));
      if (lines.length <= opt.maxLines && lines.length * size * opt.lineHeight <= boxH) return { size, lines };
    }
    return { size: opt.min, lines: wrapText(text, boxW, measureAt(opt.min)) };
  }

  // ---------- wipe coverage (drives the progress meter) ----------
  class Coverage {
    constructor(w, h, cell) {
      this.w = w; this.h = h; this.cell = cell;
      this.cols = Math.ceil(w / cell); this.rows = Math.ceil(h / cell);
      this.grid = new Uint8Array(this.cols * this.rows); this.count = 0;
    }
    /** Mark cells whose centre lies within `reach` of the segment (x0,y0)-(x1,y1). */
    mark(x0, y0, x1, y1, reach) {
      const c = this.cell;
      const minC = Math.max(0, Math.floor((Math.min(x0, x1) - reach) / c)), maxC = Math.min(this.cols - 1, Math.floor((Math.max(x0, x1) + reach) / c));
      const minR = Math.max(0, Math.floor((Math.min(y0, y1) - reach) / c)), maxR = Math.min(this.rows - 1, Math.floor((Math.max(y0, y1) + reach) / c));
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
      let added = 0;
      for (let r = minR; r <= maxR; r++) for (let q = minC; q <= maxC; q++) {
        const i = r * this.cols + q;
        if (this.grid[i]) continue;
        const cx = (q + 0.5) * c, cy = (r + 0.5) * c;
        const tt = len2 ? Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / len2)) : 0;
        const ex = x0 + tt * dx - cx, ey = y0 + tt * dy - cy;
        if (ex * ex + ey * ey <= reach * reach) { this.grid[i] = 1; added++; }
      }
      this.count += added;
      return added;
    }
    get fraction() { return this.count / this.grid.length; }
    /** Share of cells whose centre lies inside the rect that are wiped. */
    fractionIn(rect) {
      let total = 0, hit = 0;
      for (let r = 0; r < this.rows; r++) for (let q = 0; q < this.cols; q++) {
        const cx = (q + 0.5) * this.cell, cy = (r + 0.5) * this.cell;
        if (cx < rect.x || cy < rect.y || cx > rect.x + rect.w || cy > rect.y + rect.h) continue;
        total++; hit += this.grid[r * this.cols + q];
      }
      return total ? hit / total : 0;
    }
    reset() { this.grid.fill(0); this.count = 0; }
  }

  // ---------- small utilities ----------
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function luminance(hex) {
    const v = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // ======================= browser rendering =======================
  function rgba(hex, a) {
    const v = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16));
    return `rgba(${v[0]},${v[1]},${v[2]},${a})`;
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  const measurer = ctx => (weight, family) => size => s => { ctx.font = `${weight} ${size}px ${family}`; return ctx.measureText(s).width; };

  function star4(x, cx, cy, r) {
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.28 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
  }
  function heartPath(x, cx, cy, s) {
    x.beginPath();
    x.moveTo(cx, cy + s * 0.35);
    x.bezierCurveTo(cx - s * 1.1, cy - s * 0.35, cx - s * 0.45, cy - s * 1.05, cx, cy - s * 0.45);
    x.bezierCurveTo(cx + s * 0.45, cy - s * 1.05, cx + s * 1.1, cy - s * 0.35, cx, cy + s * 0.35);
    x.closePath();
  }

  /** Progress toward the reveal, 0–100: whichever of the two goals is closer.
      textRect = where the note's text really sits (renderCard reports it), in card units. */
  function revealProgress(cov, textRect) {
    const p = Math.max(cov.fraction / REVEAL_AT, cov.fractionIn(textRect || TEXT_BOX) / REVEAL_TEXT_AT);
    return Math.min(100, Math.floor(p * 100));
  }

  /** Draw the hidden card at CARD size × scale. */
  function renderCard(data, scale) {
    const th = theme(data.theme), W = CARD.w, H = CARD.h;
    const c = makeCanvas(W * scale, H * scale), x = c.getContext('2d');
    x.scale(scale, scale);
    const rand = rng(hashString((data.message || '') + '|' + (data.from || '') + '|' + th.id));

    x.fillStyle = th.bg; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) { // soft colour blobs
      const bx = rand() * W, by = rand() * H, br = (0.25 + rand() * 0.3) * W;
      const g = x.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, rgba(th.bg2, 1)); g.addColorStop(1, rgba(th.bg2, 0));
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    // warm glow top-left: the poster teaser wipes a heart here, so it must pop through the fog
    const glow = x.createRadialGradient(200, 180, 10, 200, 180, 190);
    glow.addColorStop(0, rgba(th.accent, 0.55)); glow.addColorStop(1, rgba(th.accent, 0));
    x.fillStyle = glow; x.fillRect(0, 0, W, H);
    x.fillStyle = th.ink; x.globalAlpha = 0.07; // dot paper, like the main site
    for (let yy = 30; yy < H; yy += 36) for (let xx = 30; xx < W; xx += 36) { x.beginPath(); x.arc(xx, yy, 2.2, 0, 6.283); x.fill(); }
    x.globalAlpha = 1;

    // frame
    x.strokeStyle = th.ink; x.lineWidth = 3; x.setLineDash([2, 12]); x.lineCap = 'round';
    x.strokeRect(48, 48, W - 96, H - 96); x.setLineDash([]);

    // doodles in the margins, never over the text box
    const slots = [[140, 150], [860, 150], [110, 640], [890, 620], [150, 1110], [850, 1110], [500, 110], [300, 1150], [700, 1150], [880, 380], [120, 880]];
    slots.forEach(([sx, sy], i) => {
      if (rand() < 0.25) return;
      const px = sx + (rand() - 0.5) * 40, py = sy + (rand() - 0.5) * 30, kind = (i + Math.floor(rand() * 3)) % 3;
      x.fillStyle = [th.accent, th.accent2, th.ink][Math.floor(rand() * 3)];
      if (kind === 0) { star4(x, px, py, 22 + rand() * 18); x.fill(); }
      else if (kind === 1) { heartPath(x, px, py, 18 + rand() * 10); x.fill(); }
      else { x.beginPath(); x.arc(px, py, 7 + rand() * 6, 0, 6.283); x.fill(); }
    });

    const lang = data.lang || 'zh';
    x.fillStyle = th.soft; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `600 34px ${FONT_UI}`;
    x.fillText(t(lang, 'card_label') + '  ✦', W / 2, 220);

    const msg = data.message || t(lang, 'demo_message');
    const box = TEXT_BOX;
    const m = measurer(x);
    const fit = fitText(msg, box.w, box.h, m(800, FONT_UI), { max: 120, min: 44, lineHeight: 1.32, maxLines: 6 });
    x.fillStyle = th.ink; x.font = `800 ${fit.size}px ${FONT_UI}`;
    const lh = fit.size * 1.32, top = box.y + (box.h - fit.lines.length * lh) / 2 + lh / 2;
    fit.lines.forEach((l, i) => x.fillText(l, W / 2, top + i * lh));
    const textW = Math.min(box.w, Math.max(...fit.lines.map(l => x.measureText(l).width)));
    c.textRect = { x: W / 2 - textW / 2, y: top - lh / 2, w: textW, h: fit.lines.length * lh };

    // squiggle + signature
    x.strokeStyle = th.accent; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath();
    for (let i = 0; i <= 40; i++) { const px = 380 + i * 6, py = 975 + Math.sin(i / 2.2) * 8; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
    if (data.from) {
      x.fillStyle = th.ink; x.font = `700 46px ${FONT_UI}`;
      x.fillText(t(lang, 'card_from', { from: data.from }), W / 2, 1050);
    }
    x.fillStyle = th.soft; x.font = `700 26px ${FONT_BRAND}`;
    x.fillText('KIRA·KIRA atelier', W / 2, H - 90);
    return c;
  }

  /** Fog the card: heavy blur (downscale/upscale works everywhere, unlike ctx.filter on iOS) + tinted condensation. */
  function renderFog(card, data) {
    const th = theme(data.theme), w = card.width, h = card.height;
    const fog = makeCanvas(w, h), x = fog.getContext('2d');
    const tiny = makeCanvas(Math.max(8, w / 28), Math.max(10, h / 28));
    const tx = tiny.getContext('2d');
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.drawImage(card, 0, 0, tiny.width, tiny.height);
    const mid = makeCanvas(w / 6, h / 6), mx = mid.getContext('2d');
    mx.imageSmoothingQuality = 'high'; mx.drawImage(tiny, 0, 0, mid.width, mid.height);
    x.imageSmoothingQuality = 'high'; x.drawImage(mid, 0, 0, w, h);

    const [r, g, b] = th.fog;
    x.fillStyle = `rgba(${r},${g},${b},${th.fogAlpha})`; x.fillRect(0, 0, w, h);
    const rand = rng(hashString('fog' + th.id + (data.message || '')));
    const k = w / CARD.w;
    for (let i = 0; i < 18; i++) {
      const cx = rand() * w, cy = rand() * h, rr = (0.12 + rand() * 0.25) * w;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, `rgba(${r},${g},${b},${0.18 * rand()})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }
    const n = Math.round((w * h) / (900 * k * k) / 1.2);
    for (let i = 0; i < n; i++) {
      const dx = rand() * w, dy = rand() * h, dr = (0.8 + Math.pow(rand(), 3) * 5) * k;
      x.fillStyle = 'rgba(255,255,255,.32)'; x.beginPath(); x.arc(dx, dy, dr, 0, 6.283); x.fill();
      if (dr > 2.4 * k) {
        x.fillStyle = 'rgba(30,40,70,.12)'; x.beginPath(); x.arc(dx + dr * 0.2, dy + dr * 0.35, dr * 0.8, 0, Math.PI); x.fill();
        x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.arc(dx - dr * 0.3, dy - dr * 0.35, dr * 0.3, 0, 6.283); x.fill();
      }
    }
    return fog;
  }

  /** Soft round brush used for wiping (white = erase). */
  function makeBrush(radiusPx) {
    const r = Math.max(2, Math.round(radiusPx)), c = makeCanvas(r * 2, r * 2), x = c.getContext('2d');
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.62, 'rgba(0,0,0,.96)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  /** Erase a smooth stroke from the fog canvas. Coordinates in canvas pixels. */
  function wipeStroke(fogCtx, brush, x0, y0, x1, y1) {
    const r = brush.width / 2, dist = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(dist / (r * 0.18)));
    fogCtx.save(); fogCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps;
      fogCtx.drawImage(brush, x0 + (x1 - x0) * tt - r, y0 + (y1 - y0) * tt - r);
    }
    fogCtx.restore();
  }

  /** Fogged card with a little finger-drawn heart wiped in it — the teaser on the poster. */
  function renderTeaser(data, scale) {
    const card = renderCard(data, scale), fog = renderFog(card, data);
    const fx = fog.getContext('2d'), brush = makeBrush(24 * scale);
    let prev = null;
    for (let i = 0; i <= 64; i++) { // heart curve, top-left corner, away from the message
      const a = (i / 64) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      const p = [(200 + hx * 5.2) * scale, (175 + hy * 5.2) * scale];
      if (prev) wipeStroke(fx, brush, prev[0], prev[1], p[0], p[1]);
      prev = p;
    }
    const out = makeCanvas(card.width, card.height), ox = out.getContext('2d');
    ox.drawImage(card, 0, 0); ox.drawImage(fog, 0, 0);
    return out;
  }

  function roundRect(x, X, Y, w, h, r) {
    x.beginPath();
    x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }

  /** The shareable poster: always bilingual (zh first) since it travels through WeChat. */
  function renderPoster(data, url, QR) {
    const th = theme(data.theme), W = POSTER.w, H = POSTER.h;
    const dark = th.id === 'night';
    const c = makeCanvas(W, H), x = c.getContext('2d');
    const ink = dark ? '#fdf6e3' : '#2a2533', soft = dark ? '#cfcbef' : '#5e566b';
    x.fillStyle = th.poster; x.fillRect(0, 0, W, H);
    x.fillStyle = ink; x.globalAlpha = dark ? 0.12 : 0.1;
    for (let yy = 20; yy < H; yy += 30) for (let xx = 20; xx < W; xx += 30) { x.beginPath(); x.arc(xx, yy, 1.8, 0, 6.283); x.fill(); }
    x.globalAlpha = 1;

    x.textBaseline = 'middle';
    x.fillStyle = ink; x.textAlign = 'left'; x.font = `800 38px ${FONT_BRAND}`;
    x.fillText('✦ KIRA·KIRA', 70, 78);
    x.textAlign = 'right'; x.fillStyle = soft; x.font = `600 28px ${FONT_UI}`;
    x.fillText('雾里的悄悄话 · a note in the fog', W - 70, 80);

    x.textAlign = 'center'; x.fillStyle = ink; x.font = `800 72px ${FONT_UI}`;
    x.fillText(t('zh', 'poster_headline'), W / 2, 178);
    x.fillStyle = soft; x.font = `600 32px ${FONT_UI}`;
    x.fillText(t('en', 'poster_headline'), W / 2, 238);

    // teaser card as a taped-on sticker
    const cw = 600, ch = cw * CARD.h / CARD.w, cx = (W - cw) / 2, cy = 290;
    const teaser = renderTeaser(Object.assign({}, data, { lang: 'zh' }), cw / CARD.w * 1.25);
    x.save();
    x.translate(W / 2, cy + ch / 2); x.rotate(-0.025); x.translate(-W / 2, -(cy + ch / 2));
    x.fillStyle = ink; roundRect(x, cx + 12, cy + 12, cw, ch, 26); x.fill();
    x.save(); roundRect(x, cx, cy, cw, ch, 26); x.clip(); x.drawImage(teaser, cx, cy, cw, ch); x.restore();
    x.strokeStyle = ink; x.lineWidth = 5; roundRect(x, cx, cy, cw, ch, 26); x.stroke();
    x.fillStyle = dark ? 'rgba(169,156,255,.75)' : 'rgba(255,211,92,.85)';
    x.translate(W / 2, cy); x.rotate(0.06); x.fillRect(-90, -24, 180, 48); // washi tape
    x.restore();
    // "wipe me" tag next to the heart
    x.save(); x.translate(cx + 300, cy + 112); x.rotate(-0.06);
    x.fillStyle = th.accent; roundRect(x, -84, -30, 168, 60, 30); x.fill();
    x.fillStyle = '#fff'; x.font = `800 30px ${FONT_UI}`; x.textAlign = 'center';
    x.fillText('✦ ' + t('zh', 'poster_tease'), 0, 2);
    x.restore();

    // bottom: QR + call to action
    const qy = 1090, qs = 300, qx = 86;
    x.fillStyle = '#ffffff'; roundRect(x, qx - 14, qy - 14, qs + 28, qs + 28, 24); x.fill();
    x.strokeStyle = ink; x.lineWidth = 4; roundRect(x, qx - 14, qy - 14, qs + 28, qs + 28, 24); x.stroke();
    // Medium EC with big modules scans better off a compressed WeChat image than high EC with tiny ones.
    const qr = QR.encode(url, { ecl: 'M', maxVersion: 12 });
    const placed = QR.draw(x, qr, qx, qy, qs, { quiet: 3, dark: '#111', light: '#fff' });

    const tx = qx + qs + 64;
    x.textAlign = 'left'; x.fillStyle = ink; x.font = `800 50px ${FONT_UI}`;
    x.fillText(t('zh', 'poster_cta1'), tx, qy + 50);
    x.fillText(t('zh', 'poster_cta2'), tx, qy + 120);
    x.fillStyle = soft; x.font = `600 28px ${FONT_UI}`;
    x.fillText(t('en', 'poster_cta1'), tx, qy + 180);
    x.fillText(t('en', 'poster_cta2'), tx, qy + 218);
    if (data.from) {
      x.fillStyle = th.accent; x.font = `800 34px ${FONT_UI}`;
      x.fillText(t('zh', 'poster_from', { from: data.from }), tx, qy + 272);
    }
    return { canvas: c, qr, qrBox: placed };
  }

  return {
    LIMITS, CARD, POSTER, REVEAL_AT, REVEAL_TEXT_AT, TEXT_BOX, revealProgress, THEMES, THEME_IDS, STRINGS, FONT_UI, FONT_BRAND,
    theme, pickLang, t, graphemes, cleanText, visibleLength, validate,
    encodeText, decodeText, buildPlayUrl, parsePlayParams, isLocalHost,
    wrapText, fitText, Coverage, hashString, rng, contrast,
    makeCanvas, renderCard, renderFog, renderTeaser, renderPoster, makeBrush, wipeStroke,
  };
});
