import { describe, expect, it } from 'vitest';
import { buildZip, readZip, ZipError, type ZipEntry } from './zip';

const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const first: ZipEntry = { name: 'data.json', data: text('{"a":1}') };
const entries: ZipEntry[] = [first, { name: 'manifest.json', data: text('{"app":"spartiate"}') }, { name: 'weight.csv', data: text('date;kg\n') }];
const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ZipError) return e.code;
    throw e;
  }
  return null;
};

describe('zip (stocké, sans compression)', () => {
  it('aller-retour : mêmes noms et mêmes octets', () => {
    const back = readZip(buildZip(entries));
    expect(back.map((e) => e.name)).toEqual(['data.json', 'manifest.json', 'weight.csv']);
    expect(new TextDecoder().decode(back[0]?.data)).toBe('{"a":1}');
  });

  it('déterministe : deux constructions donnent les mêmes octets', () => {
    expect(buildZip(entries)).toEqual(buildZip(entries));
  });

  it('refuse ce qui n’est pas une archive', () => {
    expect(codeOf(() => readZip(text('pas un zip')))).toBe('not-zip');
    expect(codeOf(() => readZip(new Uint8Array(0)))).toBe('not-zip');
  });

  it('refuse une archive tronquée', () => {
    const zip = buildZip(entries);
    expect(codeOf(() => readZip(zip.slice(0, zip.length - 10)))).not.toBeNull();
    expect(codeOf(() => readZip(zip.slice(0, 40)))).not.toBeNull();
  });

  it('refuse un octet de données altéré (CRC-32)', () => {
    const bad = buildZip([first]).slice();
    const at = bad.indexOf(0x7b); // « { » de data.json
    bad[at + 1] = (bad[at + 1] ?? 0) ^ 0xff;
    expect(codeOf(() => readZip(bad))).toBe('checksum');
  });

  it('refuse les noms dangereux', () => {
    for (const name of ['../x', '/abs', 'a\\b', 'C:x', '']) {
      expect(codeOf(() => readZip(buildZip([{ name, data: text('x') }])))).toBe('invalid-name');
    }
  });

  it('refuse un nom en double', () => {
    expect(codeOf(() => readZip(buildZip([first, first])))).toBe('duplicate');
  });

  it('refuse la compression (méthode ≠ 0) et le chiffrement', () => {
    const zip = buildZip([first]);
    const central = zip.length - 22 - 46 - 'data.json'.length;
    const compressed = zip.slice();
    new DataView(compressed.buffer).setUint16(central + 10, 8, true);
    expect(codeOf(() => readZip(compressed))).toBe('unsupported');
    const encrypted = zip.slice();
    new DataView(encrypted.buffer).setUint16(central + 8, 1, true);
    expect(codeOf(() => readZip(encrypted))).toBe('unsupported');
  });

  it('applique les plafonds de fichiers et d’octets', () => {
    expect(codeOf(() => readZip(buildZip(entries), { maxEntries: 2 }))).toBe('too-large');
    expect(codeOf(() => readZip(buildZip(entries), { maxBytes: 5 }))).toBe('too-large');
  });
});
