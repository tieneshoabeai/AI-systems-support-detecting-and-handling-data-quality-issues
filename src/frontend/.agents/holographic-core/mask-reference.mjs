// Internal evidence utility: preserve source RGB; apply manually authored ROI only.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = '/var/folders/nn/24dlps6s57d4_9pm73p0q8_40000gn/T/codex-clipboard-04192a78-026c-4d70-a506-88528997fec3.png';
const input = fs.readFileSync(source);
const chunks = [];
let header;
for (let offset = 8; offset < input.length;) {
  const length = input.readUInt32BE(offset);
  const type = input.toString('ascii', offset + 4, offset + 8);
  const data = input.subarray(offset + 8, offset + 8 + length);
  if (type === 'IHDR') header = Buffer.from(data);
  if (type === 'IDAT') chunks.push(data);
  offset += length + 12;
}
if (!header || header[8] !== 8 || header[9] !== 6 || header[12] !== 0) {
  throw new Error('Expected non-interlaced 8-bit RGBA PNG');
}
const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
const stride = width * 4;
const raw = zlib.inflateSync(Buffer.concat(chunks));
if (raw.length !== height * (stride + 1)) throw new Error('Unexpected scanline length');
const pixels = Buffer.alloc(width * height * 4);
function paeth(a, b, c) {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}
for (let y = 0; y < height; y++) {
  const row = y * (stride + 1), filter = raw[row];
  if (filter > 4) throw new Error('Invalid PNG filter');
  for (let x = 0; x < stride; x++) {
    const i = y * stride + x;
    const a = x >= 4 ? pixels[i - 4] : 0;
    const b = y ? pixels[i - stride] : 0;
    const c = y && x >= 4 ? pixels[i - stride - 4] : 0;
    const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
    pixels[i] = (raw[row + 1 + x] + predictor) & 255;
  }
}
const polygon = [[18,205],[18,180],[95,137],[98,96],[137,87],[137,65],[202,44],[202,20],[236,10],[270,24],[271,68],[310,79],[315,51],[347,64],[348,121],[389,147],[410,174],[418,221],[433,250],[430,292],[370,315],[290,337],[153,332],[85,304],[64,270],[64,219]];
const excludedLabel = [169,198,304,249];
function inside(x, y) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result && !(x >= excludedLabel[0] && x < excludedLabel[2] && y >= excludedLabel[1] && y < excludedLabel[3]);
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([length, tag, data, crc]);
}
function save(name, rgba) {
  const scanlines = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) rgba.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  fs.writeFileSync(path.join(dir, name), Buffer.concat([input.subarray(0, 8), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]));
}
const masked = Buffer.from(pixels), mask = Buffer.alloc(pixels.length);
let retainedPixels = 0;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4, keep = inside(x + 0.5, y + 0.5);
  if (keep) retainedPixels++;
  masked[i + 3] = keep ? pixels[i + 3] : 0;
  mask[i] = mask[i + 1] = mask[i + 2] = keep ? 255 : 0;
  mask[i + 3] = 255;
  for (let channel = 0; channel < 3; channel++) if (masked[i + channel] !== pixels[i + channel]) throw new Error('Source RGB changed');
}
save('reference-masked.png', masked);
save('reference-roi-mask.png', mask);
const preview = Buffer.from(masked);
for (let i = 0; i < preview.length; i += 4) {
  if (!preview[i + 3]) preview[i] = preview[i + 1] = preview[i + 2] = 0;
  preview[i + 3] = 255;
}
save('reference-masked-preview.png', preview);
fs.copyFileSync(source, path.join(dir, 'reference-original.png'));
const provenance = {
  method: 'manual-polygon-roi-with-label-exclusion', source, width, height,
  polygon, excludedLabel, retainedPixels,
  retainedFraction: retainedPixels / (width * height),
  rgbPreserved: true, generatedContent: false,
  limitation: 'Coarse analysis ROI, not exact object silhouette; background visible through hologram is retained; occluded pixels are not reconstructed.'
};
fs.writeFileSync(path.join(dir, 'mask-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify(provenance));
