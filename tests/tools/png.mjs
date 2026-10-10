// Minimal grayscale PNG writer for tests (no dependencies).
import zlib from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** pixels: Uint8Array w*h of gray values */
export function grayPng(w, h, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = pixels[y * w + x];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
/** Render a QR result to PNG bytes, `cell` px per module, 4-module quiet zone. */
export function qrPng(qr, cell = 6) {
  const n = (qr.size + 8) * cell;
  const px = new Uint8Array(n * n).fill(255);
  for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
    if (!qr.modules[r][c]) continue;
    for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) {
      px[((r + 4) * cell + dy) * n + (c + 4) * cell + dx] = 0;
    }
  }
  return grayPng(n, n, px);
}
