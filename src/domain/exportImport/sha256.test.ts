import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

/** Vecteurs de référence FIPS 180-4 (annexe SHA-256), comparés à `crypto.subtle` quand il est disponible. */
const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const VECTORS: ReadonlyArray<{ readonly name: string; readonly data: Uint8Array; readonly hex: string }> = [
  { name: 'chaîne vide', data: encode(''), hex: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { name: '« abc » (24 bits)', data: encode('abc'), hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  {
    name: 'message de 448 bits',
    data: encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    hex: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  },
  { name: 'un million de « a »', data: new Uint8Array(1_000_000).fill(0x61), hex: 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0' },
];

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

describe('sha256Hex : vecteurs FIPS 180-4', () => {
  for (const vector of VECTORS) {
    it(`${vector.name}`, () => {
      expect(sha256Hex(vector.data)).toBe(vector.hex);
    });
  }

  it('longueurs autour d’un bloc de 64 octets (55, 56, 63, 64, 65) : identique à crypto.subtle', async () => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return;
    for (const length of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
      const data = Uint8Array.from({ length }, (_, i) => (i * 31 + 7) & 0xff);
      expect(sha256Hex(data), `${String(length)} octets`).toBe(hex(await subtle.digest('SHA-256', data)));
    }
  });

  it('les vecteurs de référence sont aussi ceux de crypto.subtle', async () => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return;
    for (const vector of VECTORS) expect(hex(await subtle.digest('SHA-256', vector.data)), vector.name).toBe(vector.hex);
  });
});
