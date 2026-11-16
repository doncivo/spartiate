// MEDIA-02 (D-302) : réduction d'un PNG d'exercice par Node seul (zlib), déterministe, gris 8 bits, hauteur plafonnée.
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePngGray, reducePng } from './png-reduce.mjs';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, data, Buffer.alloc(4)]); // CRC non relu par le décodeur
}

/** PNG RVB synthétique : fond blanc, trait noir vertical au milieu ; filtres variés ligne par ligne (0 à 2). */
function rgbPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows: Buffer[] = [];
  let prev = Buffer.alloc(width * 3);
  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(width * 3, 255);
    for (let c = 0; c < 3; c++) line[Math.floor(width / 2) * 3 + c] = 0;
    const f = y % 3;
    const out = Buffer.alloc(width * 3 + 1);
    out[0] = f;
    for (let i = 0; i < width * 3; i++) out[i + 1] = (line[i]! - (f === 1 ? (i >= 3 ? line[i - 3]! : 0) : f === 2 ? prev[i]! : 0)) & 0xff;
    rows.push(out);
    prev = line;
  }
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

describe('png-reduce (MEDIA-02)', () => {
  it('décode un PNG RVB filtré en gris : fond blanc, trait noir', () => {
    const img = decodePngGray(rgbPng(9, 6));
    expect([img.width, img.height]).toEqual([9, 6]);
    expect(img.gray[0]).toBe(255);
    expect(img.gray[4]).toBe(0);
    expect(img.gray[5 * 9 + 4]).toBe(0);
  });

  it('réduit à la hauteur demandée en gardant les proportions, sortie PNG gris 8 bits relisible et déterministe', () => {
    const src = rgbPng(40, 80);
    const out = reducePng(src, 20);
    expect(out.subarray(0, 8).equals(SIG)).toBe(true);
    expect(out[25]).toBe(0); // type de couleur : niveaux de gris
    expect(out[24]).toBe(8);
    const back = decodePngGray(out);
    expect([back.width, back.height]).toEqual([10, 20]);
    expect(reducePng(src, 20).equals(out)).toBe(true);
  });

  it('ne grandit pas une image déjà plus petite que le plafond', () => {
    const back = decodePngGray(reducePng(rgbPng(12, 10), 640));
    expect([back.width, back.height]).toEqual([12, 10]);
  });

  it('refuse un fichier qui n’est pas un PNG ou un PNG entrelacé', () => {
    expect(() => decodePngGray(Buffer.from('GIF89a'))).toThrow(/pas un PNG/);
    const png = rgbPng(4, 4);
    png[8 + 8 + 12] = 1; // octet d'entrelacement de IHDR
    expect(() => decodePngGray(png)).toThrow(/non pris en charge/);
  });
});
