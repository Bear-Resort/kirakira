# KIRA·KIRA atelier ✦

Photo play for anime & art lovers — upload a picture and turn it into ASCII art, acrylic stands, stickers, lenticular cards, CCD-camera looks and more. Everything runs in your browser; your pictures never leave your device.

Also try the **Darkroom**: flow paint, pixel sort, halftone and weave.

## 📱 Phone app · 手机版 (`app.html`)

All 13 effects in a dead-simple phone layout: pick a photo → swipe through effects → save.
Chinese and English, one-line "how to play" for every effect, settings tucked into 调整 / 更多设置,
two-finger pinch to resize, and saving that works in WeChat (long-press), iPhone and Android (share sheet).
Phones opening the atelier are sent here automatically (`index.html?desktop` keeps the full version).
Add it to the home screen to use it like an app.

## ✦ 雾里的悄悄话 · A note in the fog

Write a short note → get a poster for WeChat Moments or a chat. Friends long-press the QR code (长按识别二维码) and have to wipe the fog off with a finger to read it.

- `make.html` — poster maker · `play.html` — the wipe-to-reveal page
- The note travels inside the link's `#fragment`, so it's never sent to any server.
- No web fonts or CDNs on these pages, so they load in mainland China.

## Publishing

Before each push run `sh scripts/bump-version.sh` — it stamps asset URLs with `?v=…` so phones never mix a new page with old cached code.

## Tests

```bash
node --test tests/*.test.mjs
```

Unit tests cover link encoding, validation, CJK line wrapping, wipe progress, themes (WCAG AA contrast) and the QR encoder — every generated QR code is scanned back with Apple's CoreImage reader on macOS.

Open `tests/browser.html` on any phone (including inside WeChat) to run the in-browser self-test: rendering, poster QR pixels, and the full play flow.
