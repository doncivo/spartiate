import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildSleepNights,
  parseShortcutHrv,
  parseShortcutRestingHr,
  parseShortcutSleep,
  parseShortcutSteps,
} from './shortcutFiles';

/** Fichiers écrits par les raccourcis « Spartiate — HRV / FC repos / sommeil / pas » (D-69, I5-01) : `date;valeur[;unité]`. */
const TODAY = '2026-11-08';
const TZ = 'Europe/Paris';
const fixture = (name: string): string => readFileSync(new URL(`../../../tests/fixtures/recovery/${name}`, import.meta.url), 'utf8');

describe('parseShortcutHrv', () => {
  it('lit le fichier de référence : virgule décimale, doublon exact écarté, rejets comptés PAR RAISON sans valeur', () => {
    const r = parseShortcutHrv(fixture('hrv.csv'), TODAY, TZ);
    expect(r.samples).toEqual([
      { measuredAt: '2026-11-08T02:12:00.000Z', day: '2026-11-08', value: 48.5 },
      { measuredAt: '2026-11-08T03:00:00.000Z', day: '2026-11-08', value: 52 },
    ]);
    expect(r.duplicates).toBe(1);
    expect(r.rejected).toEqual({
      bad_column_count: 1,
      bad_date: 1,
      no_timezone: 1,
      future: 1,
      bad_value: 1,
      out_of_range: 1,
      bad_unit: 1,
      unknown_stage: 0,
      end_before_start: 0,
    });
    expect(r.rejectedTotal).toBe(7);
    expect(JSON.stringify(r)).not.toContain('abc');
  });

  it('accepte BOM UTF-8, fins de ligne CRLF et tabulation ; fichier vide = aucun échantillon, aucun rejet', () => {
    const r = parseShortcutHrv('﻿date;valeur\r\n2026-11-08T03:12:00Z\t40\r\n', TODAY, TZ);
    expect(r.samples).toHaveLength(1);
    expect(r.rejectedTotal).toBe(0);
    const empty = parseShortcutHrv('', TODAY, TZ);
    expect(empty.samples).toEqual([]);
    expect(empty.rejectedTotal).toBe(0);
    expect(parseShortcutHrv('﻿\r\n', TODAY, TZ).samples).toEqual([]);
  });

  it('le jour est le jour LOCAL de l’appareil, pas celui du décalage écrit (REV-01 constat 9)', () => {
    const r = parseShortcutHrv('2026-11-08T00:30:00+09:00;40', '2026-11-09', TZ);
    expect(r.samples[0]?.day).toBe('2026-11-07');
  });

  it('tronque à MAX_LINES et le dit', () => {
    const text = Array.from({ length: 10_050 }, (_, i) => `2026-11-07T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z;${40 + (i % 5)}`).join('\n');
    expect(parseShortcutHrv(text, TODAY, TZ).truncated).toBe(true);
  });
});

describe('parseShortcutRestingHr', () => {
  it('lit des bpm, refuse l’aberrant, garde la valeur la plus récente du jour', () => {
    const r = parseShortcutRestingHr('2026-11-08T07:00:00+01:00;54\n2026-11-08T12:00:00+01:00;56,0;bpm\n2026-11-08T13:00:00+01:00;5\n2026-11-08T14:00:00+01:00;ms;x', TODAY, TZ);
    expect(r.samples.map((s) => s.value)).toEqual([54, 56]);
    expect(r.rejected.out_of_range).toBe(1);
    expect(r.rejected.bad_value).toBe(1);
    expect(r.latestByDay).toEqual([{ day: '2026-11-08', value: 56 }]);
  });
});

describe('parseShortcutSteps', () => {
  it('somme les échantillons de pas par jour local ; un total journalier est le cas particulier d’une ligne par jour', () => {
    const r = parseShortcutSteps('2026-11-07T08:00:00+01:00;1200\n2026-11-07T18:00:00+01:00;3 400\n2026-11-07T19:00:00+01:00;2500,0\n2026-11-08T08:00:00+01:00;900', TODAY, TZ);
    expect(r.days).toEqual([
      { day: '2026-11-07', steps: 3700 },
      { day: '2026-11-08', steps: 900 },
    ]);
    expect(r.rejected.bad_value).toBe(1);
  });

  it('refuse un pas négatif ou démesuré ; une ligne sans fuseau', () => {
    const r = parseShortcutSteps('2026-11-07T08:00:00+01:00;-5\n2026-11-07T09:00:00+01:00;900000\n2026-11-07T10:00:00;100', TODAY, TZ);
    expect(r.days).toEqual([]);
    expect(r.rejected.out_of_range + r.rejected.bad_value).toBe(2);
    expect(r.rejected.no_timezone).toBe(1);
  });
});

describe('parseShortcutSleep', () => {
  it('lit les libellés réels de Raccourcis (français)', () => {
    const r = parseShortcutSleep(fixture('sommeil.csv'), TODAY, TZ);
    expect(r.rejectedTotal).toBe(0);
    expect(r.segments.map((s) => s.stage)).toEqual(['in_bed', 'core', 'deep', 'awake', 'rem', 'asleep']);
    expect(r.segments[0]).toEqual({ start: '2026-11-07T22:10:00.000Z', end: '2026-11-08T05:55:00.000Z', stage: 'in_bed' });
  });

  it.each([
    ['Au lit', 'in_bed'], ['au  LIT', 'in_bed'], ['In Bed', 'in_bed'], ['InBed', 'in_bed'],
    ['Endormi', 'asleep'], ['asleep', 'asleep'], ['Éveillé', 'awake'], ['eveille', 'awake'], ['AWAKE', 'awake'],
    ['Paradoxal', 'rem'], ['REM', 'rem'], ['Profond', 'deep'], ['deep', 'deep'], ['Principal', 'core'], ['Core', 'core'],
  ])('libellé « %s » → %s (casse et accents tolérés)', (label, stage) => {
    const r = parseShortcutSleep(`2026-11-08T01:00:00+01:00;2026-11-08T02:00:00+01:00;${label}`, TODAY, TZ);
    expect(r.segments.map((s) => s.stage)).toEqual([stage]);
  });

  it('un stade inconnu est rejeté et compté, jamais deviné ; fin avant début ; sans fuseau', () => {
    const r = parseShortcutSleep(
      [
        '2026-11-08T01:00:00+01:00;2026-11-08T02:00:00+01:00;Sieste',
        '2026-11-08T01:00:00+01:00;2026-11-08T02:00:00+01:00;',
        '2026-11-08T03:00:00+01:00;2026-11-08T02:00:00+01:00;Profond',
        '2026-11-08T01:00:00;2026-11-08T02:00:00;Profond',
        '2026-11-08T01:00:00+01:00;2026-11-08T02:00:00+01:00;Profond',
        '2026-11-08T01:00:00+01:00;2026-11-08T02:00:00+01:00;Profond',
      ].join('\r\n'),
      TODAY,
      TZ,
    );
    expect(r.segments).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.rejected.unknown_stage).toBe(2);
    expect(r.rejected.end_before_start).toBe(1);
    expect(r.rejected.no_timezone).toBe(1);
    expect(JSON.stringify(r)).not.toContain('Sieste');
  });

  it('refuse un segment dans le futur local et un segment de plus de 24 h', () => {
    const r = parseShortcutSleep('2026-11-09T01:00:00+01:00;2026-11-09T02:00:00+01:00;Profond\n2026-11-06T01:00:00Z;2026-11-08T01:00:00Z;Profond', TODAY, TZ);
    expect(r.rejected.future).toBe(1);
    expect(r.rejected.out_of_range).toBe(1);
  });

  it('fichier vide ou BOM seul : aucun segment', () => {
    expect(parseShortcutSleep('', TODAY, TZ).segments).toEqual([]);
    expect(parseShortcutSleep('﻿', TODAY, TZ).segments).toEqual([]);
  });
});

describe('buildSleepNights', () => {
  it('regroupe les segments en nuit : jour = jour local du RÉVEIL, durée endormie = union (pas de double compte)', () => {
    const { segments } = parseShortcutSleep(fixture('sommeil.csv'), TODAY, TZ);
    const { nights, ignoredGroups } = buildSleepNights(segments, TZ);
    expect(ignoredGroups).toBe(0);
    expect(nights).toEqual([
      {
        day: '2026-11-08',
        bedAt: '2026-11-07T22:20:00.000Z',
        wakeAt: '2026-11-08T05:55:00.000Z',
        asleepMinutes: 450 - 10 - 0,
        inBedMinutes: 465,
      },
    ]);
  });

  it('une sieste du même jour est ignorée et comptée ; la nuit principale gagne', () => {
    const { segments } = parseShortcutSleep(
      '2026-11-07T23:00:00+01:00;2026-11-08T06:00:00+01:00;Endormi\n2026-11-08T14:00:00+01:00;2026-11-08T14:30:00+01:00;Endormi',
      TODAY,
      TZ,
    );
    const { nights, ignoredGroups } = buildSleepNights(segments, TZ);
    expect(nights).toHaveLength(1);
    expect(nights[0]?.asleepMinutes).toBe(420);
    expect(ignoredGroups).toBe(1);
  });

  it('sans aucun segment endormi (« Au lit » seul) la durée de sommeil reste null, jamais 0', () => {
    const { segments } = parseShortcutSleep('2026-11-07T23:00:00+01:00;2026-11-08T06:00:00+01:00;Au lit', TODAY, TZ);
    const { nights } = buildSleepNights(segments, TZ);
    expect(nights[0]?.asleepMinutes).toBeNull();
    expect(nights[0]?.inBedMinutes).toBe(420);
  });

  it('changement d’heure (nuit du 24 au 25 octobre 2026, Paris, 3 h → 2 h) : durée réelle 8 h, jour du réveil', () => {
    const { segments } = parseShortcutSleep('2026-10-24T23:00:00+02:00;2026-10-25T06:00:00+01:00;Endormi', '2026-11-08', TZ);
    const { nights } = buildSleepNights(segments, TZ);
    expect(nights[0]).toMatchObject({ day: '2026-10-25', asleepMinutes: 480 });
  });

  it('historique vide : aucune nuit', () => {
    expect(buildSleepNights([], TZ)).toEqual({ nights: [], ignoredGroups: 0 });
  });
});

describe('valeurs à nombreuses décimales (I5-04 point 3)', () => {
  const hrv = (value: string, unit = ';ms'): string => `2026-11-08T03:12:00Z;${value}${unit}\n`;
  const values = (text: string): number[] => parseShortcutHrv(text, TODAY, TZ).samples.map((s) => s.value);

  it('HRV : jusqu’à 15 décimales, point ou virgule, arrondi au dixième', () => {
    expect(values(hrv('33,7171717171717'))).toEqual([33.7]);
    expect(values(hrv('33.7171717171717'))).toEqual([33.7]);
    expect(values(hrv('48,56'))).toEqual([48.6]);
    expect(values(hrv('41.123456789012345'))).toEqual([41.1]);
    expect(values(hrv('52'))).toEqual([52]);
  });

  it('HRV : 16 décimales ou plus restent refusées (bad_value)', () => {
    const r = parseShortcutHrv(hrv('33,1234567890123456'), TODAY, TZ);
    expect(r.samples).toEqual([]);
    expect(r.rejected.bad_value).toBe(1);
  });

  it('FC au repos : arrondie au dixième, pas à l’entier', () => {
    expect(parseShortcutRestingHr('2026-11-08T07:00:00Z;54,2828282828283;bpm\n', TODAY, TZ).samples.map((s) => s.value)).toEqual([54.3]);
    expect(parseShortcutRestingHr('2026-11-08T07:00:00Z;54.25 bpm\n', TODAY, TZ).samples.map((s) => s.value)).toEqual([54.3]);
    expect(parseShortcutRestingHr('2026-11-08T07:00:00Z;54.2828282828283\n', TODAY, TZ).latestByDay).toEqual([{ day: '2026-11-08', value: 54.3 }]);
  });

  it('la plage est contrôlée sur la valeur arrondie ; deux mesures égales après arrondi sont un doublon', () => {
    expect(parseShortcutHrv(hrv('4,96'), TODAY, TZ).rejected.out_of_range).toBe(0);
    const twice = parseShortcutHrv(hrv('33,71') + hrv('33,69'), TODAY, TZ);
    expect(twice.samples).toHaveLength(1);
    expect(twice.duplicates).toBe(1);
  });

  it('pas : les décimales sont tolérées, le total reste entier', () => {
    const r = parseShortcutSteps('2026-11-07T10:00:00+01:00;4000,4444444444444;pas\n2026-11-07T15:00:00+01:00;3000.5555555555;pas\n', TODAY, TZ);
    expect(r.days).toEqual([{ day: '2026-11-07', steps: 7001 }]);
  });
});
