// SPA-001a, ADR 0017 « Séparation Spartiate / CircleTasks » : une clé, un QR, un fichier ou une ligne chiffrée de CircleTasks est
// rejeté par Spartiate (et inversement). Fixture figée : tests/fixtures/sync/circletasks-foreign.json (clé de test, format CircleTasks).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AAD_VERSION, PAIRING_QR_PREFIX, RECOVERY_KEY_PREFIX, SYNC_ERROR_CODES, parseFileHeader } from '../../src/domain/sync/format';
import { HKDF_INFO_KID, HKDF_INFO_RECORDS, HKDF_SALT, fromHex, keyFromRecovery, kidOf, openRecord, parseQrText, qrTextOf, sealRecord, type RecordPlace } from '../sim/syncCodec';

interface Foreign {
  key: string;
  kid: string;
  recoveryKey: string;
  qr: { text: string };
  headers: { header: Record<string, unknown>; line: string }[];
  rustSealed: { json: string; line: string; place: RecordPlace; sm: number; sv: number }[];
}
const foreign = JSON.parse(readFileSync(new URL('../fixtures/sync/circletasks-foreign.json', import.meta.url), 'utf8')) as Foreign;
const key = fromHex(foreign.key);

describe('constantes de Spartiate (ADR 0017)', () => {
  it('préfixes, balise d’AAD, sel et infos HKDF propres à Spartiate', () => {
    expect(PAIRING_QR_PREFIX).toBe('SPPAIR1.');
    expect(RECOVERY_KEY_PREFIX).toBe('SP1-');
    expect(AAD_VERSION).toBe('sp/1');
    expect(HKDF_SALT).toBe('spartiate');
    expect(HKDF_INFO_RECORDS).toBe('sp/1 records');
    expect(HKDF_INFO_KID).toBe('sp/1 kid');
  });
  it('le dossier refusé a son code d’erreur : foreign-folder', () => {
    expect(SYNC_ERROR_CODES).toContain('foreign-folder');
    expect(SYNC_ERROR_CODES).toHaveLength(39);
  });
});

describe('rejet de ce qui vient de CircleTasks', () => {
  it('un QR CTPAIR1 est refusé', () => {
    expect(foreign.qr.text.startsWith('CTPAIR1.')).toBe(true);
    expect(parseQrText(foreign.qr.text)).toBeNull();
  });
  it('une clé de secours CT1- est refusée', async () => {
    expect(foreign.recoveryKey.startsWith('CT1-')).toBe(true);
    expect(await keyFromRecovery(foreign.recoveryKey)).toBeNull();
  });
  it('les en-têtes ct-j, ct-s et ct-state sont refusés', () => {
    expect(foreign.headers.length).toBeGreaterThan(0);
    for (const { line } of foreign.headers) expect(parseFileHeader(line), line).toBeNull();
  });
  it('une ligne chiffrée de CircleTasks, avec la bonne clé et la bonne place, ne se déchiffre pas', async () => {
    expect(foreign.rustSealed.length).toBeGreaterThan(0);
    for (const r of foreign.rustSealed) expect(await openRecord(key, r.place, r.line)).toBeNull();
  });
  it('la même clé donne un kid différent : les dossiers ne se reconnaissent pas', async () => {
    expect(await kidOf(key)).not.toBe(foreign.kid);
  });
});

describe('aller-retour Spartiate', () => {
  it('un QR et une ligne scellés par Spartiate se relisent', async () => {
    const parsed = parseQrText(qrTextOf({ key, deviceId: '3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60' as never, epoch: null, expiresAt: 1790000000000 }));
    expect(parsed?.expiresAt).toBe(1790000000000);
    const place = foreign.rustSealed[0]?.place;
    if (!place) throw new Error('fixture sans ligne');
    const line = await sealRecord({ key, place, sm: 1, sv: 14, json: '{"k":"ops","sv":14,"ops":[]}' });
    expect(await openRecord(key, place, line)).toEqual({ sm: 1, sv: 14, json: '{"k":"ops","sv":14,"ops":[]}' });
  });
});
