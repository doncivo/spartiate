import { normalizeBarcode } from '../../domain/nutrition/barcode';
import type { OffRawProduct } from '../../domain/nutrition/offProduct';
import type { OffClient, OffError } from './parse';

/** Faux client Open Food Facts (tests, e2e) : produits en mémoire, appels notés, échec injectable. Aucun réseau. */
export interface FakeOff {
  readonly client: OffClient;
  readonly calls: Array<{ readonly kind: 'product' | 'search'; readonly arg: string }>;
  failWith: OffError | null;
}

export function createFakeOff(options: { readonly products?: readonly OffRawProduct[] } = {}): FakeOff {
  const products = options.products ?? [];
  const fake: FakeOff = {
    calls: [],
    failWith: null,
    client: {
      product: async (barcode) => {
        fake.calls.push({ kind: 'product', arg: barcode });
        if (fake.failWith) throw fake.failWith;
        const code = normalizeBarcode(barcode)?.code ?? barcode;
        const found = products.filter((p) => p.code === code);
        return { found: found.length > 0, products: found };
      },
      search: async (query) => {
        fake.calls.push({ kind: 'search', arg: query });
        if (fake.failWith) throw fake.failWith;
        return { found: products.length > 0, products };
      },
    },
  };
  return fake;
}
