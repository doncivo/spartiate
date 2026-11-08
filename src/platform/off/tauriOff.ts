import { barcodeInput, OffError, parseOffError, parseOffResponse, queryInput, type OffClient, type OffResponse } from './parse';

/** Commandes Rust (src-tauri, client Open Food Facts) : seul fichier qui les nomme. */
export const OFF_PRODUCT_COMMAND = 'off_product';
export const OFF_SEARCH_COMMAND = 'off_search';

export type OffInvoker = (command: string, args: Record<string, string>) => Promise<unknown>;

/**
 * Client réel (PC et iPhone) : l'appel HTTPS est fait par Rust. Seul un code-barres ou un texte propre part vers Rust (jamais d'autre
 * donnée) ; une entrée invalide est refusée ici, sans appel. Réponse et erreur validées à la main.
 */
export function createTauriOff(invoke?: OffInvoker): OffClient {
  const call: OffInvoker =
    invoke ??
    (async (command, args) => {
      const core = await import('@tauri-apps/api/core');
      return core.invoke(command, args);
    });

  async function run(command: string, args: Record<string, string>): Promise<OffResponse> {
    let raw: unknown;
    try {
      raw = await call(command, args);
    } catch (error) {
      throw parseOffError(error);
    }
    return parseOffResponse(raw);
  }

  return {
    product: async (barcode) => {
      const code = barcodeInput(barcode);
      if (code === null) throw new OffError('invalid-input');
      return run(OFF_PRODUCT_COMMAND, { barcode: code });
    },
    search: async (query) => {
      const clean = queryInput(query);
      if (clean === null) throw new OffError('invalid-input');
      return run(OFF_SEARCH_COMMAND, { query: clean });
    },
  };
}
