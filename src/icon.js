'use strict';

const zlib = require('zlib');

/* ---------- минимальный PNG-энкодер (RGBA, 8 бит) ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- отрисовка иконки ---------- */

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function inPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const BOLT = [
  [0.545, 0.20],
  [0.315, 0.545],
  [0.475, 0.545],
  [0.435, 0.80],
  [0.675, 0.445],
  [0.505, 0.445],
];

/**
 * Иконка: стеклянный шар с градиентом и молнией.
 * Возвращает PNG-буфер size×size.
 */
function makeIconPng(size = 256) {
  const SS = 4;
  const S = size * SS;
  const acc = new Float64Array(size * size * 4);
  const c1 = [126, 231, 255];
  const c2 = [122, 129, 255];
  const c3 = [255, 122, 219];

  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const u = (x + 0.5) / S;
      const v = (y + 0.5) / S;
      const dx = u - 0.5;
      const dy = v - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const outer = 0.485;
      if (dist > outer) continue;

      const gradT = Math.max(0, Math.min(1, (u + v) / 2));
      let col = gradT < 0.5 ? mix(c1, c2, gradT * 2) : mix(c2, c3, (gradT - 0.5) * 2);
      // верхний блик
      const gloss = Math.max(0, 1 - Math.hypot(u - 0.34, v - 0.24) / 0.42);
      col = mix(col, [255, 255, 255], gloss * 0.55);
      // затемнение к краю
      const edge = Math.max(0, (dist - 0.30) / 0.19);
      col = mix(col, [22, 16, 48], edge * 0.28);

      let alpha = 1;
      if (dist > 0.45) alpha = Math.max(0, (outer - dist) / 0.035); // мягкий край
      if (dist > 0.395 && dist < 0.435) {
        col = mix(col, [255, 255, 255], 0.75); // светящееся кольцо
      }
      if (inPolygon(u, v, BOLT)) col = [255, 255, 255];

      const ix = (x / SS) | 0;
      const iy = (y / SS) | 0;
      const o = (iy * size + ix) * 4;
      acc[o] += col[0] * alpha;
      acc[o + 1] += col[1] * alpha;
      acc[o + 2] += col[2] * alpha;
      acc[o + 3] += 255 * alpha;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  const norm = SS * SS;
  for (let i = 0; i < acc.length; i += 4) {
    const a = acc[i + 3] / norm;
    if (a <= 0) continue;
    const unpremul = a > 0 ? (255 / a) * (1 / norm) : 0;
    out[i] = Math.min(255, Math.round((acc[i] / norm) * unpremul));
    out[i + 1] = Math.min(255, Math.round((acc[i + 1] / norm) * unpremul));
    out[i + 2] = Math.min(255, Math.round((acc[i + 2] / norm) * unpremul));
    out[i + 3] = Math.round(a);
  }
  return encodePng(size, size, out);
}

module.exports = { makeIconPng };
