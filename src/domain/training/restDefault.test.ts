import { describe, expect, it } from 'vitest';
import { REST_FALLBACK_SEC, parseRestSetting, restSecondsFor } from './restDefault';

// I1-02 : durée du repos lancé à la validation d'une série (aucune valeur de progression).

describe('restSecondsFor', () => {
  it('la durée de la routine ou de la séance copiée passe en premier', () => {
    expect(restSecondsFor({ setKind: 'work', targetRestSec: 150 }, 60, 120)).toBe(150);
  });
  it('sinon le réglage de l’appareil, puis le repos de l’exercice, puis le repli', () => {
    expect(restSecondsFor({ setKind: 'work', targetRestSec: null }, 60, 120)).toBe(60);
    expect(restSecondsFor({ setKind: 'work', targetRestSec: null }, null, 120)).toBe(120);
    expect(restSecondsFor({ setKind: 'work', targetRestSec: null }, null, null)).toBe(REST_FALLBACK_SEC);
  });
  it('échauffement : jamais de repos ; routine à 0 s : pas de repos', () => {
    expect(restSecondsFor({ setKind: 'warmup', targetRestSec: 150 }, 60, 120)).toBeNull();
    expect(restSecondsFor({ setKind: 'work', targetRestSec: 0 }, 60, 120)).toBeNull();
  });
  it('valeurs hors bornes ignorées', () => {
    expect(restSecondsFor({ setKind: 'work', targetRestSec: null }, 0, 99_999)).toBe(REST_FALLBACK_SEC);
    expect(restSecondsFor({ setKind: 'timed', targetRestSec: null }, 5000, 45)).toBe(45);
  });
});

describe('parseRestSetting', () => {
  it('une durée valide, sinon null', () => {
    expect(parseRestSetting(120)).toBe(120);
    expect(parseRestSetting(null)).toBeNull();
    expect(parseRestSetting('120')).toBeNull();
    expect(parseRestSetting(0)).toBeNull();
    expect(parseRestSetting(1.5)).toBeNull();
  });
});
