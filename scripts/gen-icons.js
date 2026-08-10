// Generates Concord PWA icons (192 & 512) as PNGs using pure Node (zlib + CRC).
// Navy rounded-square background with a gold bar chart motif (drawn manually).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Draw the icon into an RGBA buffer ----
function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
const NAVY = hex('#1a1a2e');
const NAVY2 = hex('#16213e');
const GOLD = hex('#c9a84c');
const GOLD_LIGHT = hex('#e0c97e');
const GOLD_DARK = hex('#a8872f');

function draw(size) {
  const img = Buffer.alloc(size * size * 4);
  const r = size * 0.18;              // corner radius
  const inset = size * 0.02;
  const S = size * 0.01;

  function setPx(x, y, c) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = c[3];
  }

  // vertical gradient background inside rounded rect
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const bg = [
      Math.round(NAVY[0] + (NAVY2[0] - NAVY[0]) * t),
      Math.round(NAVY[1] + (NAVY2[1] - NAVY[1]) * t),
      Math.round(NAVY[2] + (NAVY2[2] - NAVY[2]) * t),
      255,
    ];
    for (let x = 0; x < size; x++) {
      // rounded rect test
      const dx = Math.max(Math.abs(x - size / 2) - (size / 2 - r), 0);
      const dy = Math.max(Math.abs(y - size / 2) - (size / 2 - r), 0);
      if (dx * dx + dy * dy <= r * r || (dx === 0 && dy === 0)) {
        setPx(x, y, bg);
      }
    }
  }

  // inner card (lighter inset panel)
  const cardX = size * 0.13, cardY = size * 0.22, cardW = size * 0.74, cardH = size * 0.56;
  for (let y = Math.floor(cardY); y < cardY + cardH; y++) {
    for (let x = Math.floor(cardX); x < cardX + cardW; x++) {
      // card border 2px gold
      const onBorder =
        x < cardX + 3 * S || x >= cardX + cardW - 3 * S ||
        y < cardY + 3 * S || y >= cardY + cardH - 3 * S;
      if (onBorder) setPx(x, y, GOLD);
      else setPx(x, y, [0, 0, 0, 0]); // transparent interior
    }
  }

  // three gold bars + cap line
  const baseY = size * 0.72;
  const bars = [
    { x: size * 0.34, w: size * 0.10, h: size * 0.19, c: GOLD_LIGHT },
    { x: size * 0.45, w: size * 0.10, h: size * 0.26, c: GOLD },
    { x: size * 0.56, w: size * 0.10, h: size * 0.13, c: GOLD_DARK },
  ];
  for (const b of bars) {
    for (let y = Math.floor(baseY - b.h); y < baseY; y++) {
      for (let x = Math.floor(b.x); x < b.x + b.w; x++) setPx(x, y, b.c);
    }
  }
  // cap line above bars
  const capY = Math.floor(size * 0.66);
  for (let x = Math.floor(size * 0.30); x < size * 0.70; x++) setPx(x, capY, GOLD);

  return img;
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size, size, draw(size));
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png (${png.length} bytes)`);
}
