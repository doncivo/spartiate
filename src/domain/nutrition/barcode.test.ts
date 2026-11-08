import { describe, expect, it } from 'vitest';
import { normalizeBarcode } from './barcode';

/** I4-05 : code-barres lu ou saisi -> code de recherche Open Food Facts (EAN-13, EAN-8, UPC-A, UPC-E ; clé de contrôle vérifiée). Valeurs synthétiques ou publiques. */
describe('normalizeBarcode', () => {
  it('EAN-13 valide : inchangé', () => {
    expect(normalizeBarcode('4006381333931')).toEqual({ code: '4006381333931', kind: 'ean13' });
  });
  it('EAN-8 valide : inchangé', () => {
    expect(normalizeBarcode('96385074')).toEqual({ code: '96385074', kind: 'ean8' });
  });
  it('UPC-A (12 chiffres) : code OFF sur 13 chiffres (zéro en tête)', () => {
    expect(normalizeBarcode('036000291452')).toEqual({ code: '0036000291452', kind: 'upca' });
  });
  it('UPC-E (8 chiffres) : développé en UPC-A pour vérifier la clé, puis code sur 13 chiffres', () => {
    expect(normalizeBarcode('04252614')).toEqual({ code: '0042100005264', kind: 'upce' });
  });
  it('UPC-E : chaque règle d’expansion (dernier chiffre du corps 0-2, 3, 4, 5-9)', () => {
    const check = (upca11: string): string => {
      let s = 0;
      [...upca11].forEach((v, i) => (s += Number(v) * (i % 2 === 0 ? 3 : 1)));
      return String((10 - (s % 10)) % 10);
    };
    const cases: Array<[string, string]> = [
      ['123450', '0' + '12' + '0' + '0000' + '345'],
      ['123451', '0' + '12' + '1' + '0000' + '345'],
      ['123453', '0' + '123' + '00000' + '45'],
      ['123454', '0' + '1234' + '00000' + '5'],
      ['123458', '0' + '12345' + '0000' + '8'],
      ['123459', '0' + '12345' + '0000' + '9'],
    ];
    for (const [middle, upcA11] of cases) {
      const upce = `0${middle}${check(upcA11)}`;
      expect(normalizeBarcode(upce), upce).toEqual({ code: `0${upcA11}${check(upcA11)}`, kind: 'upce' });
    }
  });
  it('un code à 8 chiffres valide en EAN-8 reste un EAN-8 même s’il commence par 0', () => {
    expect(normalizeBarcode('00000000')).toEqual({ code: '00000000', kind: 'ean8' });
  });
  it('espaces autour ignorés ; mauvaise clé, longueur, lettres, système UPC-E autre que 0/1 : null', () => {
    expect(normalizeBarcode(' 4006381333931 ')?.code).toBe('4006381333931');
    for (const bad of ['4006381333932', '123', '', 'abcdefgh', '4006381 333931', '04252615', '24252615', '40063813339311']) expect(normalizeBarcode(bad), bad).toBeNull();
  });
});
