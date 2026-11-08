import { normalizeBarcode, type NormalizedBarcode } from '../../../domain/nutrition/barcode';
import type { BarcodeScannerLoader } from '../../../platform/barcode';

/**
 * Formats alimentaires demandés au plugin barcode-scanner (valeurs de son enum `Format`) : EAN-13, EAN-8, UPC-E. UPC-A n'est pas
 * pris en charge par iOS : il est lu comme un EAN-13 commençant par 0 (accepté tel quel).
 */
export const SCAN_FORMATS = ['EAN_13', 'EAN_8', 'UPC_E'] as const;

export type ScanOutcome =
  | { readonly kind: 'scanned'; readonly barcode: NormalizedBarcode }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'camera-denied' }
  | { readonly kind: 'failed' };

export interface BarcodeScan {
  /** Permission, puis scan en fenêtre transparente ; ne rend jamais le texte lu (seul un code normalisé sort). */
  run(): Promise<ScanOutcome>;
  /** Annule le scan en cours (bouton « Annuler », masquage de la page) ; sans effet sinon. */
  cancel(): Promise<void>;
}

export function createBarcodeScan(load: BarcodeScannerLoader): BarcodeScan {
  let current: { cancelled: boolean; scanner: Awaited<ReturnType<BarcodeScannerLoader>> | null } | null = null;
  return {
    run: async () => {
      if (current) return { kind: 'failed' };
      const mine: { cancelled: boolean; scanner: Awaited<ReturnType<BarcodeScannerLoader>> | null } = { cancelled: false, scanner: null };
      current = mine;
      try {
        let scanner;
        try {
          scanner = await load();
          mine.scanner = scanner;
          let permission = await scanner.checkPermissions();
          if (permission !== 'granted') permission = await scanner.requestPermissions();
          if (permission !== 'granted') return { kind: 'camera-denied' };
        } catch {
          return mine.cancelled ? { kind: 'cancelled' } : { kind: 'failed' };
        }
        if (mine.cancelled) return { kind: 'cancelled' };
        let content: string;
        try {
          content = (await scanner.scan({ windowed: true, formats: [...SCAN_FORMATS] })).content;
        } catch {
          return mine.cancelled ? { kind: 'cancelled' } : { kind: 'failed' };
        }
        if (mine.cancelled) return { kind: 'cancelled' };
        const barcode = normalizeBarcode(content);
        return barcode === null ? { kind: 'unreadable' } : { kind: 'scanned', barcode };
      } finally {
        current = null;
      }
    },
    cancel: async () => {
      const mine = current;
      if (!mine) return;
      mine.cancelled = true;
      await mine.scanner?.cancel().catch(() => undefined);
    },
  };
}
