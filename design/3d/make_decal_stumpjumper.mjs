// Builds design/3d/decal-stumpjumper.png from the owner-supplied two-colour sticker artwork
// (yellow letters + blue shadow on a white border): letters -> red, shadow -> near-black, rest transparent.
// node design/3d/make_decal_stumpjumper.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const IN = resolve(here, 'sources/stumpjumper-script-sticker.png');
const OUT = resolve(here, 'decal-stumpjumper.png');
const LETTER = [205, 25, 40];   // bright red, as on owners' photos of 1990 frames
const SHADOW = [30, 30, 34];    // near-black drop shadow

const buf = readFileSync(IN);
let pos = 8, W = 0, H = 0, ct = 0; const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); ct = data[9]; }
  if (type === 'IDAT') idat.push(data);
  pos += 12 + len;
}
const bpp = ct === 6 ? 4 : 3, stride = W * bpp, raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(H * stride);
for (let y = 0; y < H; y++) {
  const ft = raw[y * (stride + 1)];
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
    let v = raw[y * (stride + 1) + 1 + x];
    if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
    else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    px[y * stride + x] = v & 255;
  }
}
const clamp = (v) => Math.max(0, Math.min(1, v));
const out = Buffer.alloc(W * H * 4);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let i = 0; i < W * H; i++) {
  const r = px[i * bpp], g = px[i * bpp + 1], b = px[i * bpp + 2], a0 = bpp === 4 ? px[i * bpp + 3] / 255 : 1;
  const yellow = clamp((Math.min(r, g) - b - 50) / 90) * a0;   // yellow letters
  const blue = clamp((b - r - 40) / 80) * a0;                 // blue shadow
  const al = Math.max(yellow, blue);
  const t = yellow + blue > 0 ? yellow / (yellow + blue) : 1;
  const col = LETTER.map((c, k) => Math.round(c * t + SHADOW[k] * (1 - t)));
  out.set([...col, Math.round(al * 255)], i * 4);
  if (al > 0.1) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
}
const pad = 4;
x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
const OW = x1 - x0 + 1, OH = y1 - y0 + 1, rows = Buffer.alloc(OH * (OW * 4 + 1));
for (let y = 0; y < OH; y++) out.copy(rows, y * (OW * 4 + 1) + 1, ((y + y0) * W + x0) * 4, ((y + y0) * W + x1 + 1) * 4);
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (bf) => { let c = 0xffffffff; for (const v of bf) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(OUT, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
console.log('ok', `${OW}x${OH}`, OUT);
