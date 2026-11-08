import { describe, expect, it } from 'vitest';
import { createFakeScanner } from '../../../platform/barcode/testing';
import { resolveBarcodeScanner, setBarcodeScanner } from '../../../platform/barcode';
import { createBarcodeScan, SCAN_FORMATS } from './scanBarcode';

/**
 * I4-05 : scan du code-barres (plugin officiel derrière une façade) : permission, formats alimentaires, annulation propre, refus de la
 * caméra, code illisible. Faux scanner : aucune caméra.
 */
describe('createBarcodeScan', () => {
  it('formats : EAN-13, EAN-8, UPC-E (UPC-A est lu comme un EAN-13 par iOS) ; fenêtre transparente', async () => {
    expect(SCAN_FORMATS).toEqual(['EAN_13', 'EAN_8', 'UPC_E']);
    const fake = createFakeScanner({ content: '4006381333931' });
    await createBarcodeScan(async () => fake.scanner).run();
    expect(fake.scans).toEqual([{ windowed: true, formats: ['EAN_13', 'EAN_8', 'UPC_E'] }]);
  });

  it('permission accordée : code lu, normalisé', async () => {
    const fake = createFakeScanner({ content: ' 036000291452 ' });
    expect(await createBarcodeScan(async () => fake.scanner).run()).toEqual({ kind: 'scanned', barcode: { code: '0036000291452', kind: 'upca' } });
    expect(fake.requested).toBe(0);
  });

  it('permission à demander puis accordée : demandée une fois, scan lancé', async () => {
    const fake = createFakeScanner({ permission: 'prompt', grantOnRequest: true, content: '4006381333931' });
    expect((await createBarcodeScan(async () => fake.scanner).run()).kind).toBe('scanned');
    expect(fake.requested).toBe(1);
  });

  it('caméra refusée (avant ou après la demande) : camera-denied, aucun scan lancé', async () => {
    for (const fake of [createFakeScanner({ permission: 'denied' }), createFakeScanner({ permission: 'prompt', grantOnRequest: false })]) {
      expect(await createBarcodeScan(async () => fake.scanner).run()).toEqual({ kind: 'camera-denied' });
      expect(fake.scans).toEqual([]);
    }
  });

  it('contenu qui n’est pas un code alimentaire valide : unreadable (le texte lu n’est pas rendu)', async () => {
    const fake = createFakeScanner({ content: 'https://exemple.invalid/?x=1' });
    expect(await createBarcodeScan(async () => fake.scanner).run()).toEqual({ kind: 'unreadable' });
  });

  it('annulation pendant le scan : cancelled, scanner annulé', async () => {
    const fake = createFakeScanner({ hold: true });
    const scan = createBarcodeScan(async () => fake.scanner);
    const pending = scan.run();
    await fake.waitScanning();
    await scan.cancel();
    expect(await pending).toEqual({ kind: 'cancelled' });
    expect(fake.cancelled).toBe(1);
  });

  it('échec du plugin (chargement ou scan) : failed, jamais silencieux', async () => {
    expect(await createBarcodeScan(async () => Promise.reject(new Error('x'))).run()).toEqual({ kind: 'failed' });
    const fake = createFakeScanner({ scanFails: true });
    expect(await createBarcodeScan(async () => fake.scanner).run()).toEqual({ kind: 'failed' });
  });

  it('un seul scan à la fois : le second appel est refusé', async () => {
    const fake = createFakeScanner({ hold: true });
    const scan = createBarcodeScan(async () => fake.scanner);
    const first = scan.run();
    await fake.waitScanning();
    expect(await scan.run()).toEqual({ kind: 'failed' });
    await scan.cancel();
    await first;
  });
});

describe('resolveBarcodeScanner', () => {
  it('PC et navigateur : aucun scanner (pas de bouton) ; iPhone installé : un chargeur ; injecté : prioritaire', () => {
    expect(resolveBarcodeScanner('tauri', 'windows')).toBeNull();
    expect(resolveBarcodeScanner('web', 'other')).toBeNull();
    expect(resolveBarcodeScanner('web', 'ios')).toBeNull();
    expect(resolveBarcodeScanner('tauri', 'ios')).not.toBeNull();
    const fake = createFakeScanner({});
    const injected = async () => fake.scanner;
    setBarcodeScanner(injected);
    expect(resolveBarcodeScanner('web', 'other')).toBe(injected);
    setBarcodeScanner(null);
  });
});
