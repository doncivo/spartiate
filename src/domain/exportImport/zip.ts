/**
 * Archive zip minimale (SPA-005, D-57) : fichiers stockés sans compression, noms UTF-8, CRC-32 vérifié. Pur, sans dépendance : le
 * contenu exporté est petit (profil, pesées) et la lecture n'accepte que ce que `buildZip` produit (ni compression, ni chiffrement,
 * ni zip64, ni archive multi-disques). Les archives sont déterministes (date DOS fixe) : les mêmes entrées donnent les mêmes octets.
 */

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

export type ZipErrorCode = 'not-zip' | 'corrupt' | 'checksum' | 'unsupported' | 'invalid-name' | 'duplicate' | 'too-large';

export class ZipError extends Error {
  override readonly name = 'ZipError';
  readonly code: ZipErrorCode;
  constructor(code: ZipErrorCode) {
    super(`archive zip : ${code}`);
    this.code = code;
  }
}

export interface ZipLimits {
  /** Nombre maximal de fichiers (défaut 16). */
  readonly maxEntries?: number;
  /** Total maximal des octets annoncés (défaut 8 Mio). */
  readonly maxBytes?: number;
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const END_SIG = 0x06054b50;
const UTF8_FLAG = 0x0800;
/** 1980-01-01 00:00:00 : date DOS fixe, pour des archives reproductibles. */
const DOS_DATE = 0x0021;
const DOS_TIME = 0;

const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = (TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL_SIG, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, UTF8_FLAG, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    const head = new Uint8Array(46 + name.length);
    const cv = new DataView(head.buffer);
    cv.setUint32(0, CENTRAL_SIG, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    head.set(name, 46);
    parts.push(local, entry.data);
    central.push(head);
    offset += local.length + entry.data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, END_SIG, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const safeName = (name: string): boolean =>
  name.length > 0 && !name.startsWith('/') && !name.includes('\\') && !name.includes(':') && !name.includes('\0') && name.split('/').every((s) => s !== '..' && s !== '.' && s !== '');

export function readZip(bytes: Uint8Array, limits: ZipLimits = {}): ZipEntry[] {
  const maxEntries = limits.maxEntries ?? 16;
  const maxBytes = limits.maxBytes ?? 8 * 1024 * 1024;
  if (bytes.length < 22) throw new ZipError('not-zip');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (view.getUint32(i, true) === END_SIG) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError('not-zip');
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 || view.getUint16(end + 8, true) !== count) throw new ZipError('unsupported');
  if (count > maxEntries) throw new ZipError('too-large');
  if (centralOffset + centralSize > end) throw new ZipError('corrupt');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const seen = new Set<string>();
  const entries: ZipEntry[] = [];
  let total = 0;
  let at = centralOffset;
  for (let n = 0; n < count; n += 1) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL_SIG) throw new ZipError('corrupt');
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const csize = view.getUint32(at + 20, true);
    const usize = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    if ((flags & 1) !== 0 || (flags & 8) !== 0 || method !== 0) throw new ZipError('unsupported');
    if (csize !== usize) throw new ZipError('corrupt');
    total += usize;
    if (total > maxBytes) throw new ZipError('too-large');
    if (at + 46 + nameLen > end) throw new ZipError('corrupt');
    let name: string;
    try {
      name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    } catch {
      throw new ZipError('invalid-name');
    }
    if (!safeName(name)) throw new ZipError('invalid-name');
    if (seen.has(name)) throw new ZipError('duplicate');
    seen.add(name);
    if (localOffset + 30 > centralOffset || view.getUint32(localOffset, true) !== LOCAL_SIG) throw new ZipError('corrupt');
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (start + usize > centralOffset) throw new ZipError('corrupt');
    const data = bytes.slice(start, start + usize);
    if (crc32(data) !== crc) throw new ZipError('checksum');
    entries.push({ name, data });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
