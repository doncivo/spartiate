// FIX-ABERR (lot 0.28.0, C-005) : contrôle de saisie d'une charge aberrante, AVANT l'enregistrement (§ 11.5). Données synthétiques (D-292).
import { describe, expect, it } from 'vitest';
import { session, set } from '../../../tests/fixtures/training/progression';
import { DEFAULT_PROGRESSION_CONFIG as CFG } from './config';
import { entryOutlier } from './outlierEntry';
import type { ExerciseSession } from './types';

const three = (load: number, reps = 8): ExerciseSession[] => [session(14, load, [reps, reps, reps]), session(11, load, [reps, reps, reps]), session(8, load, [reps, reps, reps])];
const work = (loadKg: number | null, reps: number | null = 8) => ({ loadKg, reps });

describe('entryOutlier : référence = 1RM courant ramené aux répétitions saisies', () => {
  it('200 kg × 8 après trois séances à 100 kg × 8 : signalé, 200 % de 100 kg', () => {
    expect(entryOutlier(work(200), 'work', three(100), { config: CFG })).toEqual({ loadKg: 200, usualKg: 100, percent: 200 });
  });
  it('1 000 kg × 8 : signalé', () => {
    expect(entryOutlier(work(1000), 'work', three(100), { config: CFG })?.percent).toBe(1000);
  });
  it('102 kg × 8 et 150 kg × 8 (seuil inclus) : rien', () => {
    expect(entryOutlier(work(102), 'work', three(100), { config: CFG })).toBeNull();
    expect(entryOutlier(work(150), 'work', three(100), { config: CFG })).toBeNull();
  });
  it('charge rapportée aux répétitions : 150 kg × 1 après 100 kg × 8 reste sous le seuil', () => {
    expect(entryOutlier(work(150, 1), 'work', three(100), { config: CFG })).toBeNull();
  });
  it('sans historique, charge vide, répétitions vides, série hors travail : rien (bornes absolues seules)', () => {
    expect(entryOutlier(work(500), 'work', [], { config: CFG })).toBeNull();
    expect(entryOutlier(work(null), 'work', three(100), { config: CFG })).toBeNull();
    expect(entryOutlier(work(200, null), 'work', three(100), { config: CFG })).toBeNull();
    for (const kind of ['warmup', 'drop', 'partial', 'timed'] as const) expect(entryOutlier(work(200), kind, three(100), { config: CFG }), kind).toBeNull();
  });
  it('déjà validée dans la séance à cette charge ou plus : rien (une seule question par charge)', () => {
    expect(entryOutlier(work(200), 'work', three(100), { config: CFG, doneInSessionKg: 200 })).toBeNull();
    expect(entryOutlier(work(210), 'work', three(100), { config: CFG, doneInSessionKg: 200 })).not.toBeNull();
  });
  it('historique sans séance valide (partielles seulement) : plus grande charge de travail validée', () => {
    const partial = { ...session(5, 100, []), sets: [set(100, 8, { position: 0 }), set(100, null, { position: 1, done: false }), set(100, null, { position: 2, done: false })] };
    expect(entryOutlier(work(200), 'work', [partial], { config: CFG })).toEqual({ loadKg: 200, usualKg: 100, percent: 200 });
    expect(entryOutlier(work(140), 'work', [partial], { config: CFG })).toBeNull();
  });
  it('haltères : charge par haltère contre charge par haltère', () => {
    expect(entryOutlier(work(40, 10), 'work', three(20, 10), { config: CFG })).toEqual({ loadKg: 40, usualKg: 20, percent: 200 });
    expect(entryOutlier(work(22, 10), 'work', three(20, 10), { config: CFG })).toBeNull();
  });
  it('lesté, poids de corps connu : comparaison sur la charge totale ; inconnu : sur le lest', () => {
    const body = { bodyweightKg: 80, bodyweightFraction: 1 };
    expect(entryOutlier(work(20), 'work', three(10), { config: CFG, ...body })).toBeNull();
    expect(entryOutlier(work(100), 'work', three(10), { config: CFG, ...body })).toEqual({ loadKg: 100, usualKg: 10, percent: 200 });
    expect(entryOutlier(work(20), 'work', three(10), { config: CFG, bodyweightFraction: 1 })?.usualKg).toBe(10);
  });
  it('assisté, poids de corps connu : assistance anormalement BASSE signalée (charge totale > 150 %)', () => {
    const body = { bodyweightKg: 80, bodyweightFraction: 1, assisted: true };
    expect(entryOutlier(work(3), 'work', three(30), { config: CFG, ...body })).toEqual({ loadKg: 3, usualKg: 30, percent: 154 });
    expect(entryOutlier(work(300), 'work', three(30), { config: CFG, ...body })).toBeNull();
  });
  it('assisté, poids de corps inconnu : aucun contrôle relatif (une assistance n’est pas une charge)', () => {
    expect(entryOutlier(work(3), 'work', three(30), { config: CFG, assisted: true })).toBeNull();
    expect(entryOutlier(work(300), 'work', three(30), { config: CFG, assisted: true })).toBeNull();
  });
});
