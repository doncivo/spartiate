import { describe, expect, it } from 'vitest';
import { BELT_GYM, BODYWEIGHT_ONLY, DIPS, PUSH_UP, SALLE_COMPLETE, bwSession, input, target } from '../../../tests/fixtures/training/progression';
import { isVestKg, VEST_KG_MAX, VEST_KG_MIN, validateEquipmentProfile } from './equipment';
import { ballastLoads, prescribe, WEIGHTED_VEST_ID } from './prescribe';
import type { ProgressionEquipment } from './types';

/**
 * EQUIP-0302 (BL-175, D-674, D-383) : le poids du gilet lesté renseigné au profil devient un lest utilisable des exercices au poids du corps, au
 * même titre que la grille des haltères et les sommes de la ceinture (plus petit cran parmi les lests utilisables) ; gilet sans poids : aucun lest
 * proposé par le gilet (comportement d'avant). Aucune autre formule ne change. Données SYNTHÉTIQUES.
 */
const BW = target(8, 12);
const withVest = (base: ProgressionEquipment, vestKg: number | null, where: 'available' | 'forced' = 'available'): ProgressionEquipment => ({
  ...base,
  vestKg,
  inventory: { ...base.inventory, [where]: [...base.inventory[where], WEIGHTED_VEST_ID] },
});
const VEST_ONLY = withVest(BODYWEIGHT_ONLY, 10);
const top = (equipment: ProgressionEquipment | null, lest: number | null = null, exercise: typeof PUSH_UP | typeof DIPS = PUSH_UP) =>
  prescribe(input({ exercise, equipment, target: BW, history: [bwSession(3, lest, [12, 12, 12])] }));

describe('EQUIP-0302 : grille de lest avec le gilet', () => {
  it('identifiant du catalogue du matériel : weighted-vest', () => {
    expect(WEIGHTED_VEST_ID).toBe('weighted-vest');
  });

  it('gilet coché avec un poids : ce poids est un lest ; sans poids, ou gilet absent ou interdit : aucun lest par le gilet', () => {
    expect(ballastLoads(VEST_ONLY)).toEqual([10]);
    expect(ballastLoads(withVest(BODYWEIGHT_ONLY, 10, 'forced'))).toEqual([10]);
    expect(ballastLoads(withVest(BODYWEIGHT_ONLY, null))).toEqual([]);
    expect(ballastLoads({ ...BODYWEIGHT_ONLY, vestKg: 10 })).toEqual([]);
    expect(ballastLoads({ ...VEST_ONLY, inventory: { ...VEST_ONLY.inventory, forbidden: [WEIGHTED_VEST_ID] } })).toEqual([]);
    expect(ballastLoads(BODYWEIGHT_ONLY)).toEqual([]);
  });

  it('combiné aux haltères et à la ceinture : réunion des lests, sans doublon, croissante ; le gilet n’est jamais additionné à un autre lest', () => {
    const dumbbells = ballastLoads(SALLE_COMPLETE);
    expect(ballastLoads(withVest(SALLE_COMPLETE, 10))).toEqual(dumbbells.includes(10) ? dumbbells : [...dumbbells, 10].sort((a, b) => a - b));
    const odd = ballastLoads(withVest(SALLE_COMPLETE, 7.3));
    expect(odd).toContain(7.3);
    expect(odd.filter((kg) => kg === 7.3)).toHaveLength(1);
    const belt = ballastLoads(withVest(BELT_GYM, 40));
    expect(belt[0]).toBe(1.25);
    expect(Math.max(...belt)).toBe(40);
    expect(belt).not.toContain(41.25);
  });
});

describe('EQUIP-0302 : moteur poids du corps (D-383) avec le gilet', () => {
  it('haut de plage partout, gilet de 10 kg seul : lest de 10 kg et retour au bas de la plage', () => {
    const p = top(VEST_ONLY);
    expect(p.headline).toBe('ballast-add');
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'ballast-added']);
    expect(p.sets).toEqual([8, 8, 8].map((reps) => ({ reps, loadKg: 10 })));
    expect(p.deltaKg).toBe(10);
  });

  it('gilet déjà porté (10 kg) au haut de plage, aucun lest plus lourd : une répétition de plus, lest gardé', () => {
    const p = top(VEST_ONLY, 10);
    expect(p.headline).toBe('extra-rep');
    expect(p.reasons).toContain('equipment-max');
    expect(p.loadKg).toBe(10);
    expect(p.sets.map((s) => s.reps)).toEqual([13, 12, 12]);
  });

  it('gilet sans poids : comportement d’avant (aucun lest, une répétition de plus)', () => {
    const before = top(BODYWEIGHT_ONLY);
    const p = top(withVest(BODYWEIGHT_ONLY, null));
    expect(p.headline).toBe('extra-rep');
    expect(p.reasons).toEqual(['history-reference', 'top-reached', 'ballast-unavailable']);
    expect(p).toEqual(before);
  });

  it('gilet et haltères : le plus petit cran l’emporte (haltère de 2 kg) ; gilet de 1 kg plus léger : le gilet', () => {
    expect(top(withVest(SALLE_COMPLETE, 10)).loadKg).toBe(2);
    expect(top(withVest(SALLE_COMPLETE, 1)).loadKg).toBe(1);
  });

  it('gilet et ceinture (dips) : plus petit disque (1,25 kg) ; au lest de 35 kg (max de la ceinture), le gilet de 40 kg est le cran suivant', () => {
    expect(top(withVest(BELT_GYM, 40), null, DIPS).loadKg).toBe(1.25);
    const next = top(withVest(BELT_GYM, 40), 35, DIPS);
    expect(next.headline).toBe('ballast-add');
    expect(next.loadKg).toBe(40);
  });

  it('profil sans gilet : prescription identique à celle d’avant le ticket (aucun autre changement de formule)', () => {
    expect(top({ ...SALLE_COMPLETE, vestKg: null })).toEqual(top(SALLE_COMPLETE));
    expect(top({ ...BELT_GYM, vestKg: null }, 4, DIPS)).toEqual(top(BELT_GYM, 4, DIPS));
  });
});

describe('EQUIP-0302 : validation du poids du gilet', () => {
  const base = { name: 'Maison', kind: 'maison' as const, inventory: BODYWEIGHT_ONLY.inventory, increments: {} };
  it(`bornes ${String(VEST_KG_MIN)} à ${String(VEST_KG_MAX)} kg, au dixième ; nul ou absent : non renseigné, valide`, () => {
    expect([VEST_KG_MIN, VEST_KG_MAX]).toEqual([0.5, 60]);
    for (const ok of [0.5, 5, 7.5, 12.3, 60]) expect(isVestKg(ok), String(ok)).toBe(true);
    for (const bad of [0, 0.4, -1, 60.1, 7.55, Number.NaN, Number.POSITIVE_INFINITY]) expect(isVestKg(bad), String(bad)).toBe(false);
    expect(validateEquipmentProfile(base)).toEqual([]);
    expect(validateEquipmentProfile({ ...base, vestKg: null })).toEqual([]);
    expect(validateEquipmentProfile({ ...base, vestKg: 7.5 })).toEqual([]);
    expect(validateEquipmentProfile({ ...base, vestKg: 61 })).toEqual([{ code: 'vest' }]);
  });
});

describe('EQUIP-0302, contre-relecture code : borne propre du nom des barres', () => {
  it('nom de barre : borne BARBELL_NAME_MAX (64) distincte de EQUIPMENT_LIST_MAX ; au-delà : refusé (code barbells)', async () => {
    const { BARBELL_NAME_MAX } = await import('./equipment');
    expect(BARBELL_NAME_MAX).toBe(64);
    const base = { name: 'Salle', kind: 'salle' as const, inventory: { ...BODYWEIGHT_ONLY.inventory, barbells: [{ type: 'x'.repeat(BARBELL_NAME_MAX + 1), weightKg: 20 }] }, increments: {} };
    expect(validateEquipmentProfile(base)).toEqual([{ code: 'barbells' }]);
    // Texte du refus : src/i18n/equipmentVest.equip0302.test.ts (un test du domaine n'importe pas i18n, ADR 0001, BL-145).
  });
});
