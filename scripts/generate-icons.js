import fs from 'node:fs';
import zlib from 'node:zlib';

function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 2; // RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: filter byte (0) + width * 3 bytes per scanline
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // create subtle emerald gradient
      const factor = 1 - (y / height) * 0.35;
      rawData[pxOffset] = Math.min(255, Math.floor(r * factor));
      rawData[pxOffset + 1] = Math.min(255, Math.floor(g * factor));
      rawData[pxOffset + 2] = Math.min(255, Math.floor(b * factor));
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = c ^ buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// Emerald theme: r: 15, g: 118, b: 110
const p192 = createPng(192, 192, 16, 128, 100);
fs.writeFileSync('public/pwa-192x192.png', p192);

const p512 = createPng(512, 512, 16, 128, 100);
fs.writeFileSync('public/pwa-512x512.png', p512);
fs.writeFileSync('public/pwa-maskable-512x512.png', p512);

const p180 = createPng(180, 180, 16, 128, 100);
fs.writeFileSync('public/apple-touch-icon.png', p180);
fs.writeFileSync('public/favicon.ico', createPng(32, 32, 16, 128, 100));

console.log('Successfully generated PWA PNG icons!');
