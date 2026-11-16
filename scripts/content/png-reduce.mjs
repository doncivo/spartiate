/* global Buffer */
// Réduction d'un PNG d'exercice (MEDIA-02, D-302) : Node seul, aucune dépendance (zlib intégré). Script de contenu, jamais chargé par l'app.
// Décode un PNG non entrelacé 8 bits (gris, gris + alpha, RVB, RVBA), le compose sur fond blanc, le passe en niveaux de gris 8 bits,
// le réduit par moyenne de blocs si sa hauteur dépasse `maxHeight`, et le réencode (filtre choisi ligne par ligne, deflate niveau 9).
// Le dessin noir sur blanc d'Everkinetic n'a pas de couleur utile : le passage en gris ne retire rien du trait. Œuvre adaptée au sens
// de CC BY-SA 4.0 : elle reste sous CC BY-SA 4.0, avec la même attribution (docs/licences.md).
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Décode un PNG en niveaux de gris 8 bits composés sur blanc : { width, height, gray: Uint8Array }. */
export function decodePngGray(bytes) {
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error('pas un PNG');
  let off = 8;
  let ihdr = null;
  const idat = [];
  while (off < bytes.length) {
    const len = bytes.readUInt32BE(off);
    const type = bytes.toString('latin1', off + 4, off + 8);
    const data = bytes.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], ctype: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace !== 0 || !(ihdr.ctype in CHANNELS)) throw new Error('PNG non pris en charge (8 bits non entrelacé attendu)');
  const bpp = CHANNELS[ihdr.ctype];
  const { width, height } = ihdr;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : -1;
      if (pred < 0) throw new Error(`filtre PNG inconnu : ${f}`);
      cur[i] = (src[i] + pred) & 0xff;
    }
  }
  const gray = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const o = p * bpp;
    let v;
    let alpha = 255;
    if (bpp <= 2) {
      v = pixels[o];
      if (bpp === 2) alpha = pixels[o + 1];
    } else {
      v = (pixels[o] * 299 + pixels[o + 1] * 587 + pixels[o + 2] * 114) / 1000;
      if (bpp === 4) alpha = pixels[o + 3];
    }
    gray[p] = Math.round((v * alpha + 255 * (255 - alpha)) / 255);
  }
  return { width, height, gray };
}

/** Réduit par moyenne de blocs (facteur entier ou fractionnaire) jusqu'à `maxHeight` de haut ; image inchangée si elle est plus petite. */
export function downscale(img, maxHeight) {
  if (img.height <= maxHeight) return img;
  const height = maxHeight;
  const width = Math.max(1, Math.round((img.width * maxHeight) / img.height));
  const sx = img.width / width;
  const sy = img.height / height;
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) sum += img.gray[yy * img.width + xx];
      gray[y * width + x] = Math.round(sum / ((y1 - y0) * (x1 - x0)));
    }
  }
  return { width, height, gray };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Encode une image en PNG gris 8 bits ; pour chaque ligne, le filtre dont la somme des écarts absolus est la plus petite. */
export function encodePngGray({ width, height, gray }) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const cur = gray.subarray(y * width, (y + 1) * width);
    const prev = y > 0 ? gray.subarray((y - 1) * width, y * width) : new Uint8Array(width);
    let best = null;
    let bestScore = Infinity;
    for (let f = 0; f <= 4; f++) {
      const out = Buffer.alloc(width + 1);
      out[0] = f;
      let score = 0;
      for (let i = 0; i < width; i++) {
        const a = i > 0 ? cur[i - 1] : 0;
        const b = prev[i];
        const c = i > 0 ? prev[i - 1] : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (cur[i] - pred) & 0xff;
        out[i + 1] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        best = out;
      }
    }
    rows.push(best);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 0; // niveaux de gris
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Réduction complète : PNG d'origine → PNG gris 8 bits, hauteur ≤ maxHeight. Déterministe pour une même version de zlib. */
export function reducePng(bytes, maxHeight) {
  return encodePngGray(downscale(decodePngGray(bytes), maxHeight));
}
