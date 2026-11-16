import { describe, expect, it } from 'vitest';
import { session, set, daysAgo } from '../../../tests/fixtures/training/progression';
import { classFor, percentileOf, strengthScore, tierOf, type StrengthExercise, type StrengthInput, type StrengthStandards } from './strengthScore';
import type { ExerciseSession } from './types';

/**
 * STR-01 (PRD § 17.1, D-310 à D-312) : vecteurs calculés à la main sur des normes SYNTHÉTIQUES (les vraies sont dans
 * content/strength/standards.json, contrôlées par validate-content). Centiles publiés : 10, 25, 50, 75, 90, 95, 99.
 */

const P = [10, 25, 50, 75, 90, 95, 99];
const LIGHT = { upToKg: 80, sampleSize: 1000, kg: [50, 60, 80, 100, 120, 130, 150] };
const HEAVY = { upToKg: null, sampleSize: 500, kg: [60, 70, 90, 110, 130, 140, 160] };
const WOMEN = { upToKg: null, sampleSize: 300, kg: [20, 30, 40, 50, 60, 70, 80] };

const STANDARDS: StrengthStandards = {
  percentiles: P,
  lifts: [
    { key: 'bench', sourceLift: 'bench_press', groups: ['chest'], totalLoad: false, male: [LIGHT, HEAVY], female: [WOMEN] },
    { key: 'incline-bench', sourceLift: 'incline_bench_press', groups: ['chest'], totalLoad: false, male: [{ ...LIGHT, kg: [40, 50, 60, 70, 80, 90, 100] }, HEAVY], female: [WOMEN] },
    { key: 'pull-up', sourceLift: 'pullup', groups: ['back'], totalLoad: true, male: [LIGHT, HEAVY], female: [WOMEN] },
    { key: 'chin-up', sourceLift: 'chinup', groups: ['back', 'biceps'], totalLoad: true, male: [LIGHT, HEAVY], female: [WOMEN] },
  ],
};

const ex = (id: string, key: string, history: readonly ExerciseSession[] = []): StrengthExercise => ({ id, nameFr: `Nom ${id}`, key, history });
const input = (over: Partial<StrengthInput>): StrengthInput => ({ sex: 'male', bodyweightKg: 80, standards: STANDARDS, exercises: [], ...over });
const group = (result: ReturnType<typeof strengthScore>, id: string) => {
  const g = result.groups.find((x) => x.group === id);
  if (g === undefined) throw new Error(`groupe ${id} absent`);
  return g;
};

describe('rang centile interpolé entre les centiles publiés', () => {
  it('90 kg entre p50 (80) et p75 (100) : 50 + 25 × 10 / 20 = 62,5 → 63', () => {
    expect(percentileOf(90, LIGHT.kg, P)).toEqual({ score: 63, bound: null });
  });
  it('valeur publiée exacte : son centile (80 → 50 ; 50 → 10 ; 150 → 99)', () => {
    expect(percentileOf(80, LIGHT.kg, P)).toEqual({ score: 50, bound: null });
    expect(percentileOf(50, LIGHT.kg, P)).toEqual({ score: 10, bound: null });
    expect(percentileOf(150, LIGHT.kg, P)).toEqual({ score: 99, bound: null });
  });
  it('sous le 10e centile : borne « < 10 », jamais extrapolé ; au-dessus du 99e : « > 99 »', () => {
    expect(percentileOf(45, LIGHT.kg, P)).toEqual({ score: 10, bound: 'below' });
    expect(percentileOf(151, LIGHT.kg, P)).toEqual({ score: 99, bound: 'above' });
  });
  it('deux centiles publiés égaux : le plus haut des deux', () => {
    expect(percentileOf(60, [50, 60, 60, 70, 80, 90, 100], P)).toEqual({ score: 50, bound: null });
  });
});

describe('catégorie de poids', () => {
  it('« jusqu’à 80 kg » inclus ; au-delà : la catégorie ouverte ; sous la première : la première', () => {
    expect(classFor(80, [LIGHT, HEAVY])).toBe(LIGHT);
    expect(classFor(80.1, [LIGHT, HEAVY])).toBe(HEAVY);
    expect(classFor(40, [LIGHT, HEAVY])).toBe(LIGHT);
  });
});

describe('paliers de la maquette PC-Progres (Fer < 25, Bronze 25–49, Argent 50–74, Or ≥ 75)', () => {
  it('24 fer, 25 bronze, 49 bronze, 50 argent, 74 argent, 75 or', () => {
    expect([24, 25, 49, 50, 74, 75].map(tierOf)).toEqual(['iron', 'bronze', 'bronze', 'silver', 'silver', 'gold']);
  });
});

describe('strengthScore', () => {
  const bench75x6 = [session(10, 75, [6])]; // Epley 75 × 1,2 = 90 kg

  it('homme de 80 kg, 1RM 90 kg au développé couché : Pectoraux 63, Argent ; le 1RM et le mouvement retenus sont dits', () => {
    const r = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', bench75x6)] }));
    const chest = group(r, 'chest');
    expect(chest).toMatchObject({ kind: 'value', score: 63, bound: null, tier: 'silver', lift: { key: 'bench', exerciseId: 'bench-press-barbell' } });
    expect(chest.kind === 'value' ? chest.lift.oneRmKg : null).toBeCloseTo(90, 6);
    expect(r.weightClass).toEqual({ upToKg: 80, aboveKg: null });
  });

  it('ajusté au poids : à 80,1 kg, la catégorie ouverte place 90 kg au 50e centile', () => {
    const r = strengthScore(input({ bodyweightKg: 80.1, exercises: [ex('bench-press-barbell', 'bench', bench75x6)] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 50 });
    expect(r.weightClass).toEqual({ upToKg: null, aboveKg: 80 });
  });

  it('ajusté au sexe : la table des femmes place 90 kg au-delà du 99e centile (« > 99 », Or)', () => {
    const r = strengthScore(input({ sex: 'female', exercises: [ex('bench-press-barbell', 'bench', bench75x6)] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 99, bound: 'above', tier: 'gold' });
  });

  it('inchangé en décharge : une séance de décharge plus lourde n’entre pas dans le 1RM', () => {
    const withDeload = [...bench75x6, session(2, 100, [6], { deload: true })];
    const before = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', bench75x6)] }));
    const during = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', withDeload)] }));
    expect(during).toEqual(before);
  });

  it('tractions : charge totale = poids de corps + lest (80 kg × 6 → 96 kg : 70 ; lest 10 kg × 6 → 108 kg : 81)', () => {
    const bare = strengthScore(input({ exercises: [ex('pull-up', 'pull-up', [{ workoutId: 'w1', endedAt: daysAgo(3), difficulty: null, sets: [set(null, 6)] }])] }));
    expect(group(bare, 'back')).toMatchObject({ kind: 'value', score: 70 });
    const weighted = strengthScore(input({ exercises: [ex('pull-up-weighted', 'pull-up', [session(3, 10, [6])])] }));
    expect(group(weighted, 'back')).toMatchObject({ kind: 'value', score: 81 });
  });

  it('meilleur mouvement du groupe : incliné 72 kg (table plus basse, 75 + 15 × 2 / 10 = 78) l’emporte sur le couché 90 kg (63)', () => {
    const r = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', bench75x6), ex('incline-press-barbell', 'incline-bench', [session(5, 60, [6])])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 78, lift: { key: 'incline-bench' } });
  });

  it('même clé sur deux exercices : le meilleur 1RM compte', () => {
    const r = strengthScore(input({ exercises: [ex('pull-up', 'pull-up', [{ workoutId: 'w1', endedAt: daysAgo(3), difficulty: null, sets: [set(null, 6)] }]), ex('pull-up-weighted', 'pull-up', [session(3, 10, [6])])] }));
    expect(group(r, 'back')).toMatchObject({ kind: 'value', score: 81, lift: { exerciseId: 'pull-up-weighted' } });
  });

  it('un mouvement à deux groupes (traction supination) chiffre les deux', () => {
    const r = strengthScore(input({ exercises: [ex('chin-up', 'chin-up', [{ workoutId: 'w1', endedAt: daysAgo(3), difficulty: null, sets: [set(null, 6)] }])] }));
    expect(group(r, 'back')).toMatchObject({ kind: 'value', score: 70 });
    expect(group(r, 'biceps')).toMatchObject({ kind: 'value', score: 70 });
  });

  it('8 groupes, dans l’ordre ; groupe sans séance : « — » avec les mouvements de référence, jamais 0', () => {
    const r = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', bench75x6), ex('pull-up', 'pull-up')] }));
    expect(r.groups.map((g) => g.group)).toEqual(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes']);
    expect(group(r, 'back')).toEqual({ group: 'back', kind: 'none', reason: 'noSession', references: ['Nom pull-up'] });
    expect(group(r, 'shoulders')).toEqual({ group: 'shoulders', kind: 'none', reason: 'noStandard', references: [] });
    for (const g of r.groups) if (g.kind === 'value') expect(g.score).toBeGreaterThan(0);
  });

  it('score global : moyenne arrondie des groupes chiffrés, avec leur nombre ; aucun groupe chiffré : null', () => {
    const r = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', bench75x6), ex('chin-up', 'chin-up', [{ workoutId: 'w1', endedAt: daysAgo(3), difficulty: null, sets: [set(null, 6)] }])] }));
    // Pectoraux 63, Dos 70, Biceps 70 : 203 / 3 = 67,67 → 68.
    expect(r.global).toEqual({ score: 68, tier: 'silver', counted: 3 });
    expect(strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench')] })).global).toBeNull();
  });

  it('sexe absent du profil : chaque groupe « — » (raison noSex), aucun global ni catégorie', () => {
    const r = strengthScore(input({ sex: null, exercises: [ex('bench-press-barbell', 'bench', bench75x6)] }));
    expect(r.groups.every((g) => g.kind === 'none' && g.reason === 'noSex')).toBe(true);
    expect(r.global).toBeNull();
    expect(r.weightClass).toBeNull();
  });

  it('aucune pesée : chaque groupe « — » (raison noBodyweight)', () => {
    const r = strengthScore(input({ bodyweightKg: null, exercises: [ex('bench-press-barbell', 'bench', bench75x6)] }));
    expect(r.groups.every((g) => g.kind === 'none' && g.reason === 'noBodyweight')).toBe(true);
    expect(r.global).toBeNull();
  });

  it('clé inconnue des normes : ignorée (aucun score inventé)', () => {
    const r = strengthScore(input({ exercises: [ex('x', 'inconnue', bench75x6)] }));
    expect(r.groups.every((g) => g.kind === 'none')).toBe(true);
  });

  it('séance partielle ou séries non faites : pas de 1RM, groupe « — »', () => {
    const r = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', [session(4, 75, [6], { sets: [set(75, 6, { done: false })] })])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'none', reason: 'noSession' });
  });

  // Passe qa-test : cas limites ajoutés.
  it('qa : poids de corps nul, négatif ou non fini : « — » (noBodyweight), jamais un score', () => {
    for (const bw of [0, -5, Number.NaN]) {
      const r = strengthScore(input({ bodyweightKg: bw, exercises: [ex('bench-press-barbell', 'bench', bench75x6)] }));
      expect(r.groups.every((g) => g.kind === 'none' && g.reason === 'noBodyweight'), String(bw)).toBe(true);
    }
  });

  it('qa : une catégorie de femmes sans borne propre (catégorie ouverte seule) sert à tout poids', () => {
    const r = strengthScore(input({ sex: 'female', bodyweightKg: 45, exercises: [ex('bench-press-barbell', 'bench', [session(10, 25, [6])])] }));
    // 25 × 1,2 = 30 kg = p25 de la table des femmes : 25.
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 25, tier: 'bronze' });
    expect(r.weightClass).toEqual({ upToKg: null, aboveKg: null });
  });

  it('qa : la séance la plus récente compte d’abord (moyenne 1 / 0,6 / 0,3 du moteur), pas le meilleur 1RM historique', () => {
    // 90 kg (il y a 2 j) puis 72 kg (il y a 20 j) : (90 + 0,6 × 72) / 1,6 = 83,25 → entre p50 80 et p75 100 : 50 + 25 × 3,25 / 20 = 54,06 → 54.
    const r = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', [session(20, 60, [6]), session(2, 75, [6])])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 54 });
  });

  it('qa : « < 10 » compte 10 dans le global, et le dit par sa borne', () => {
    const r = strengthScore(input({ exercises: [ex('bench-press-barbell', 'bench', [session(3, 30, [5])])] }));
    expect(group(r, 'chest')).toMatchObject({ kind: 'value', score: 10, bound: 'below', tier: 'iron' });
    expect(r.global).toEqual({ score: 10, tier: 'iron', counted: 1 });
  });
});
