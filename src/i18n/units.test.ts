import { describe, expect, it } from 'vitest';
import { NONE, SEP, formatMinutes, formatLocaleNumber, lowerCase, upperFirst } from './units';

/** SHELL-0295 (C-076) : mêmes chaînes qu'avant le passage par src/i18n (format français, heures en 24 h). */
describe('units : formatage commun', () => {
  it('durées en minutes : « 45 min », « 7 h 12 », « 8 h 00 »', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(432)).toBe('7 h 12');
    expect(formatMinutes(480)).toBe('8 h 00');
    expect(formatMinutes(59.6)).toBe('1 h 00');
  });

  it('nombres : séparateur de milliers et virgule françaises', () => {
    expect(formatLocaleNumber(12345)).toBe((12345).toLocaleString('fr-FR'));
    expect(formatLocaleNumber(3.14159, { maximumFractionDigits: 1 })).toBe('3,1');
  });

  it('séparateurs et casse', () => {
    expect(SEP).toBe(' · ');
    expect(NONE).toBe('—');
    expect(upperFirst('mercredi')).toBe('Mercredi');
    expect(lowerCase('Prise de masse')).toBe('prise de masse');
  });
});
