import { describe, expect, it } from 'vitest';
import { BODY_BOUNDS, BODY_FILE_NAMES, BODY_METRIC_OF, parseBodyFile } from './bodyShortcutFiles';

/**
 * I6-04 : fichiers Renpho / Apple Santé déposés par Raccourcis (poids, composition, mensurations, nutrition du jour). Fixtures synthétiques.
 * Fuseau Europe/Paris, aujourd'hui = 2026-11-08.
 */
const TODAY = '2026-11-08';
const TZ = 'Europe/Paris';
const parse = (name: (typeof BODY_FILE_NAMES)[number], text: string) => parseBodyFile(name, text, TODAY, TZ);

describe('liste fermée des dix fichiers (liste blanche)', () => {
  it('dix noms exacts, un type par nom', () => {
    expect([...BODY_FILE_NAMES]).toEqual(['poids.csv', 'masse-grasse.csv', 'masse-maigre.csv', 'tour-taille.csv', 'taille.csv', 'energie.csv', 'proteines.csv', 'glucides.csv', 'lipides.csv', 'fibres.csv']);
    expect(BODY_FILE_NAMES.map((n) => BODY_METRIC_OF[n])).toEqual(['weight', 'body_fat', 'lean_mass', 'waist', 'height', 'energy', 'protein', 'carb', 'fat', 'fiber']);
  });
  it('bornes de plausibilité nommées', () => {
    expect(BODY_BOUNDS.weightKg).toEqual([20, 500]);
    expect(BODY_BOUNDS.bodyFatPct).toEqual([3, 60]);
    expect(BODY_BOUNDS.heightCm).toEqual([100, 250]);
    expect(BODY_BOUNDS.waistCm).toEqual([40, 200]);
    expect(BODY_BOUNDS.energyKcalDay[1]).toBe(10_000);
  });
});

describe('poids.csv', () => {
  it('décimale à virgule, unité en colonne ou collée, une valeur par jour local (la plus récente)', () => {
    const r = parse('poids.csv', '2026-11-08T06:50:12+01:00;81,4;kg\n2026-11-08T21:00:00+01:00;81.9 kg\n2026-11-07T07:00:00Z;180;lb\n');
    expect(r.days).toEqual([
      { day: '2026-11-07', value: 81.65, measuredAt: '2026-11-07T07:00:00.000Z' },
      { day: '2026-11-08', value: 81.9, measuredAt: '2026-11-08T20:00:00.000Z' },
    ]);
    expect(r.rejectedTotal).toBe(0);
  });
  it('en-tête facultatif, BOM, CRLF, lignes vides tolérés', () => {
    const r = parse('poids.csv', '﻿Date;Valeur;Unité\r\n\r\n2026-11-08T06:50:12+01:00;81,4;kg\r\n');
    expect(r.days).toHaveLength(1);
    expect(r.rejectedTotal).toBe(0);
  });
  it('refus comptés par raison, jamais devinés : sans fuseau, futur, vide, illisible, unité inconnue, hors bornes, colonnes', () => {
    const r = parse(
      'poids.csv',
      [
        '2026-11-08T06:50:12;81,4;kg',
        '2026-11-09T06:50:12+01:00;81,4;kg',
        '2026-11-07T06:50:12+01:00;;kg',
        '2026-11-07T06:51:12+01:00;abc;kg',
        '2026-11-07T06:52:12+01:00;81;stone',
        '2026-11-07T06:53:12+01:00;19;kg',
        '2026-11-07T06:54:12+01:00;501;kg',
        'seul',
        '2026-11-07T06:55:12+01:00;80;kg;extra',
        'pas une date;80;kg',
      ].join('\n'),
    );
    expect(r.days).toEqual([]);
    expect(r.rejected).toMatchObject({ no_timezone: 1, future: 1, bad_value: 2, bad_unit: 1, out_of_range: 2, bad_column_count: 2, bad_date: 1 });
    expect(r.rejectedTotal).toBe(10);
  });
  it('doublon exact compté, fichier vide : ni jour ni refus', () => {
    const r = parse('poids.csv', '2026-11-08T06:50:12+01:00;81,4;kg\n2026-11-08T06:50:12+01:00;81,4;kg\n');
    expect(r.days).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(parse('poids.csv', '')).toMatchObject({ days: [], rejectedTotal: 0, duplicates: 0 });
  });
  it('le jour est le jour local de l’appareil', () => {
    expect(parse('poids.csv', '2026-11-07T23:30:00Z;80;kg').days[0]?.day).toBe('2026-11-08');
  });
});

describe('composition et mensurations', () => {
  it('masse grasse : pourcentage avec « % », ou fraction de Santé sans unité (0,185 = 18,5 %)', () => {
    expect(parse('masse-grasse.csv', '2026-11-08T06:50:00+01:00;18,5;%\n2026-11-07T06:50:00+01:00;0,185\n').days.map((d) => d.value)).toEqual([18.5, 18.5]);
    const r = parse('masse-grasse.csv', '2026-11-08T06:50:00+01:00;2;%\n2026-11-07T06:50:00+01:00;70 %\n');
    expect(r.days).toEqual([]);
    expect(r.rejected.out_of_range).toBe(2);
  });
  it('masse maigre : kg ou lb, bornes', () => {
    expect(parse('masse-maigre.csv', '2026-11-08T06:50:00+01:00;64,3;kg\n2026-11-07T06:50:00+01:00;150;lb\n').days.map((d) => d.value)).toEqual([68, 64.3]);
    expect(parse('masse-maigre.csv', '2026-11-08T06:50:00+01:00;5;kg').rejected.out_of_range).toBe(1);
  });
  it('tour de taille et taille : cm par défaut, m et po convertis, bornes', () => {
    expect(parse('tour-taille.csv', '2026-11-08T06:50:00+01:00;0,82;m\n2026-11-07T06:50:00+01:00;32;in\n2026-11-06T06:50:00+01:00;83,5;cm\n').days.map((d) => d.value)).toEqual([83.5, 81.3, 82]);
    expect(parse('taille.csv', '2026-11-08T06:50:00+01:00;1,78;m\n').days[0]?.value).toBe(178);
    expect(parse('taille.csv', '2026-11-08T06:50:00+01:00;1,2;cm\n2026-11-07T06:50:00+01:00;3;m\n').rejected.out_of_range).toBe(2);
    expect(parse('tour-taille.csv', '2026-11-08T06:50:00+01:00;30;cm').rejected.out_of_range).toBe(1);
  });
});

describe('nutrition du jour : sommes par jour local', () => {
  it('énergie : kcal, cal ou kJ, sommés par jour ; zéro ou au-dessus de 10 000 : jour refusé et compté', () => {
    const r = parse(
      'energie.csv',
      [
        '2026-11-08T08:00:00+01:00;500;kcal',
        '2026-11-08T13:00:00+01:00;700,5;kcal',
        '2026-11-07T13:00:00+01:00;4184;kJ',
        '2026-11-06T13:00:00+01:00;600;cal',
        '2026-11-05T13:00:00+01:00;6000;kcal',
        '2026-11-05T19:00:00+01:00;5000;kcal',
        '2026-11-04T13:00:00+01:00;0;kcal',
      ].join('\n'),
    );
    expect(r.days.map((d) => [d.day, d.value])).toEqual([
      ['2026-11-06', 600],
      ['2026-11-07', 1000],
      ['2026-11-08', 1201],
    ]);
    expect(r.rejected.out_of_range).toBe(2);
  });
  it('protéines, glucides, lipides, fibres : grammes (mg convertis), une décimale, bornes par jour', () => {
    expect(parse('proteines.csv', '2026-11-08T08:00:00+01:00;30,25;g\n2026-11-08T13:00:00+01:00;40000;mg\n').days[0]?.value).toBe(70.3);
    expect(parse('glucides.csv', '2026-11-08T08:00:00+01:00;250;g\n').days[0]?.value).toBe(250);
    expect(parse('lipides.csv', '2026-11-08T08:00:00+01:00;0;g\n').days[0]?.value).toBe(0);
    expect(parse('fibres.csv', '2026-11-08T08:00:00+01:00;25;g\n').days[0]?.value).toBe(25);
    expect(parse('fibres.csv', '2026-11-08T08:00:00+01:00;301;g\n').rejected.out_of_range).toBe(1);
    expect(parse('proteines.csv', '2026-11-08T08:00:00+01:00;30;oz\n').rejected.bad_unit).toBe(1);
  });
  it('plus de 10 000 lignes : lu jusqu’à la limite et signalé', () => {
    const lines = Array.from({ length: 10_050 }, (_, i) => `2026-11-08T08:00:${String(i % 60).padStart(2, '0')}+01:00;${(i % 7) + 1};g`).join('\n');
    expect(parse('proteines.csv', lines).truncated).toBe(true);
  });
});
