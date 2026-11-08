/**
 * Code-barres lu ou saisi (I4-05, PRD § 15.3) : EAN-13, EAN-8, UPC-A, UPC-E, clé de contrôle vérifiée. Module pur.
 * Le code de recherche Open Food Facts est canonique : UPC-A et UPC-E (développé en UPC-A) deviennent un code sur 13 chiffres
 * (zéro en tête), comme dans la base ; l'iPhone lit d'ailleurs un UPC-A comme un EAN-13 commençant par 0.
 */

import { isValidBarcode } from './food';

export type BarcodeKind = 'ean13' | 'ean8' | 'upca' | 'upce' | 'gtin14';

export interface NormalizedBarcode {
  readonly code: string;
  readonly kind: BarcodeKind;
}

/** UPC-E (système 0 ou 1 + 6 chiffres + clé) -> UPC-A sur 12 chiffres ; `null` si la forme est impossible. */
function expandUpcE(upce: string): string | null {
  if (!/^[01][0-9]{7}$/.test(upce)) return null;
  const system = upce[0] ?? '0';
  const d = upce.slice(1, 7);
  const check = upce[7] ?? '0';
  const last = d[5] ?? '0';
  let body: string;
  if ('012'.includes(last)) body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  else if (last === '3') body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  else if (last === '4') body = `${d.slice(0, 4)}00000${d[4] ?? ''}`;
  else body = `${d.slice(0, 5)}0000${last}`;
  return `${system}${body}${check}`;
}

/** Code propre ou `null` (longueur, caractères, clé de contrôle). Un code à 8 chiffres valide en EAN-8 est un EAN-8 ; sinon UPC-E. */
export function normalizeBarcode(input: string): NormalizedBarcode | null {
  const text = input.trim();
  if (!/^[0-9]+$/.test(text)) return null;
  if (text.length === 13 && isValidBarcode(text)) return { code: text, kind: 'ean13' };
  if (text.length === 14 && isValidBarcode(text)) return { code: text, kind: 'gtin14' };
  if (text.length === 12 && isValidBarcode(text)) return { code: `0${text}`, kind: 'upca' };
  if (text.length === 8) {
    if (isValidBarcode(text)) return { code: text, kind: 'ean8' };
    const upca = expandUpcE(text);
    if (upca !== null && isValidBarcode(upca)) return { code: `0${upca}`, kind: 'upce' };
  }
  return null;
}
