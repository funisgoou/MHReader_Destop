// 生成 1024x1024 PNG 图标：绿色圆角方块 + 白色"文本行"图案
const zlib = require("zlib");
const fs = require("fs");

const SIZE = 1024;
const data = Buffer.alloc(SIZE * SIZE * 4);

// 颜色
const BG = [66, 185, 131]; // #42b983
const FG = [255, 255, 255];
const RADIUS = 220;

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r);
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    let px = null;
    if (inRoundedRect(x, y, 32, 32, SIZE - 32, SIZE - 32, RADIUS)) px = BG;
    // 三条白色文本行
    const lines = [
      [240, 300, 784, 356],
      [240, 462, 660, 518],
      [240, 624, 540, 680],
    ];
    for (const [x0, y0, x1, y1] of lines) {
      if (inRoundedRect(x, y, x0, y0, x1, y1, 28)) px = FG;
    }
    // 左侧竖条（书脊）
    if (inRoundedRect(x, y, 160, 240, 196, 700, 18)) px = FG;
    if (px) {
      data[i] = px[0];
      data[i + 1] = px[1];
      data[i + 2] = px[2];
      data[i + 3] = 255;
    } else {
      data[i + 3] = 0;
    }
  }
}

// PNG 编码
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, payload) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  data.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

fs.writeFileSync("src-tauri/icons/icon.png", png);
console.log("icon.png written:", png.length, "bytes");
