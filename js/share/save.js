/* ✦ "Save to Photos" for every page (poster maker, play page, phone app).
   Picks the method that actually lands the picture in the photo album:
     · iOS / Android browsers → the system share sheet ("Save Image" / "保存到相册")
     · WeChat                 → a full-screen JPEG to long-press. Android WeChat often refuses to save
                                big PNG data-URLs or images nested deep in the page, so the picture is a
                                JPEG under ~450 KB and a direct child of <body>.
     · desktop                → a normal download
   KKSave.prepare(canvas, name) → Promise<item>; KKSave.save(item, lang) must run inside the tap. */
(function () {
  'use strict';
  const ua = navigator.userAgent || '';
  const wechat = /MicroMessenger/i.test(ua);
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const T = {
    zh: { hint: '长按图片，选「保存图片」', close: '关闭', saved: '已保存 ✦', failed: '没能打开保存，长按图片保存吧', save: '保存到相册', download: '下载图片' },
    en: { hint: 'Long-press the picture, then choose “Save Image”', close: 'Close', saved: 'Saved ✦', failed: 'Couldn’t open saving — long-press the picture instead', save: 'Save to Photos', download: 'Download' },
  };
  const tt = (lang, k) => (T[lang] || T.en)[k];

  function canShareFile(file) {
    try { return !wechat && !!(file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })); } catch (e) { return false; }
  }

  function toBlob(canvas, type, q) {
    return new Promise((res, rej) => {
      if (canvas.toBlob) canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), type, q);
      else fetch(canvas.toDataURL(type, q)).then(r => r.blob()).then(res, rej);
    });
  }
  const blobToDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

  /** Encode once, ahead of the tap (share sheets need the file ready inside the gesture). */
  async function prepare(canvas, name) {
    let blob, type = 'image/png';
    if (wechat) {
      // JPEG, shrinking quality then size until it is small enough for Android WeChat to save
      let c = canvas;
      type = 'image/jpeg'; name = name.replace(/\.png$/i, '.jpg');
      for (const q of [0.92, 0.85, 0.78]) { blob = await toBlob(c, type, q); if (blob.size < 450e3) break; }
      if (blob.size >= 450e3) {
        const s = Math.sqrt(420e3 / blob.size);
        const small = document.createElement('canvas');
        small.width = Math.round(canvas.width * s); small.height = Math.round(canvas.height * s);
        const x = small.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(canvas, 0, 0, small.width, small.height);
        blob = await toBlob(small, type, 0.85);
      }
    } else {
      blob = await toBlob(canvas, type);
    }
    const file = typeof File === 'function' ? new File([blob], name, { type }) : null;
    const url = await blobToDataUrl(blob);
    const mode = wechat ? 'wechat' : canShareFile(file) ? 'share' : 'download';
    return { blob, file, url, name, mode };
  }

  let viewer = null;
  function closeViewer() {
    if (!viewer) return;
    viewer.forEach(el => el.remove());
    viewer = null;
    document.documentElement.style.overflow = '';
  }
  /** WeChat: the image as a direct child of <body>, covering the screen — the most reliable long-press target. */
  function openViewer(url, lang) {
    closeViewer();
    const bg = document.createElement('div');
    bg.setAttribute('style', 'position:fixed;inset:0;z-index:9998;background:rgba(15,12,20,.92)');
    const img = document.createElement('img');
    img.src = url; img.alt = '';
    img.setAttribute('style', 'position:fixed;z-index:9999;left:50%;top:46%;transform:translate(-50%,-50%);max-width:92vw;max-height:76vh;border-radius:10px;-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto');
    const hint = document.createElement('p');
    hint.textContent = '☝ ' + tt(lang, 'hint');
    hint.setAttribute('style', 'position:fixed;z-index:9999;left:0;right:0;bottom:calc(84px + env(safe-area-inset-bottom));margin:0;text-align:center;color:#fff;font:800 17px/1.4 -apple-system,"PingFang SC",sans-serif');
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = tt(lang, 'close');
    close.setAttribute('style', 'position:fixed;z-index:9999;left:50%;transform:translateX(-50%);bottom:calc(24px + env(safe-area-inset-bottom));min-width:120px;min-height:46px;border:2px solid #fff;border-radius:999px;background:transparent;color:#fff;font:800 16px -apple-system,"PingFang SC",sans-serif');
    close.addEventListener('click', closeViewer);
    bg.addEventListener('click', closeViewer);
    viewer = [bg, img, hint, close];
    viewer.forEach(el => document.body.appendChild(el));
    document.documentElement.style.overflow = 'hidden';
  }

  function download(item) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(item.blob); a.download = item.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /** Run inside the tap. Resolves 'shared' | 'viewer' | 'downloaded' | 'cancelled' | 'failed'. */
  async function save(item, lang) {
    if (item.mode === 'wechat') { openViewer(item.url, lang); return 'viewer'; }
    if (item.mode === 'share') {
      try { await navigator.share({ files: [item.file] }); return 'shared'; }
      catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        openViewer(item.url, lang); return 'failed';
      }
    }
    if (mobile) { openViewer(item.url, lang); return 'viewer'; } // old phone browsers: downloads go to Files, not Photos
    download(item); return 'downloaded';
  }

  const label = (item, lang) => tt(lang, item && item.mode === 'download' && !mobile ? 'download' : 'save');

  window.KKSave = { prepare, save, label, openViewer, closeViewer, env: { wechat, mobile }, t: tt };
})();
