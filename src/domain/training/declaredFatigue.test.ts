import { describe, expect, it } from 'vitest';
import { input, session, target } from '../../../tests/fixtures/training/progression';
import { REASON_ORDER } from './config';
import { holdForDeclaredFatigue, parseDeclaredFatigue, DECLARED_FATIGUE_LEVELS } from './declaredFatigue';
import { explainPrescription } from './explain';
import { prescribe } from './prescribe';

/**
 * SESS-01d (§ 13.2 « Fatigue déclarée : Frais / Normal / Fatigué au démarrage » ; règle proposée en décision) : déclaration facultative ; seul
 * « Fatigué » agit, et seulement pour empêcher une HAUSSE de charge ce jour-là (la charge de référence, arrondie au matériel, est gardée) ;
 * jamais une baisse imposée, jamais un blocage. Dit par une raison et une phrase.
 */

const increase = () => prescribe(input({ history: [session(3, 60, [10, 10, 10])], target: target(8, 10) }));

describe('déclaration', () => {
  it('trois niveaux ; valeur du réglage lue pour CETTE séance seulement, illisible : aucune', () => {
    expect(DECLARED_FATIGUE_LEVELS).toEqual(['fresh', 'normal', 'tired']);
    expect(parseDeclaredFatigue({ v: 1, workoutId: 'w1', level: 'tired' }, 'w1')).toBe('tired');
    expect(parseDeclaredFatigue({ v: 1, workoutId: 'w0', level: 'tired' }, 'w1')).toBeNull();
    expect(parseDeclaredFatigue({ v: 1, workoutId: 'w1', level: 'épuisé' }, 'w1')).toBeNull();
    expect(parseDeclaredFatigue(null, 'w1')).toBeNull();
    expect(parseDeclaredFatigue({ v: 2, workoutId: 'w1', level: 'fresh' }, 'w1')).toBeNull();
  });
  it('raison « declared-fatigue » en dernier dans l’ordre des raisons', () => {
    expect(REASON_ORDER.at(-1)).toBe('declared-fatigue');
  });
});

describe('holdForDeclaredFatigue', () => {
  it('précondition : 60 kg × 10 × 3 en haut de plage → 62,5 kg proposés', () => {
    expect(increase()).toMatchObject({ status: 'prescribed', headline: 'increase', loadKg: 62.5, deltaKg: 2.5 });
  });

  it('« Fatigué » : charge gardée à 60 kg (écart 0), séries à 60 kg, raison ajoutée, phrase dédiée', () => {
    const held = holdForDeclaredFatigue(increase(), 'tired', { assisted: false, loads: [57.5, 60, 62.5] });
    expect(held).toMatchObject({ loadKg: 60, deltaKg: 0 });
    expect(held.sets.every((s) => s.loadKg === 60)).toBe(true);
    expect(held.reasons.at(-1)).toBe('declared-fatigue');
    expect(explainPrescription(held)).toEqual({ key: 'declaredFatigue', params: { load: 60 } });
  });

  it('référence hors de la grille actuelle : cran inférieur (jamais une charge impossible)', () => {
    expect(holdForDeclaredFatigue(increase(), 'tired', { assisted: false, loads: [58, 61, 64] }).loadKg).toBe(58);
  });

  it('« Frais », « Normal », aucune déclaration : inchangé ; pas de hausse prévue (échelle, maintien, baisse) : inchangé', () => {
    const p = increase();
    for (const level of ['fresh', 'normal', null] as const) expect(holdForDeclaredFatigue(p, level, { assisted: false, loads: null })).toBe(p);
    const ladder = prescribe(input({ history: [session(3, 60, [9, 8, 8])], target: target(8, 10) }));
    expect(ladder.loadKg).toBe(60);
    expect(holdForDeclaredFatigue(ladder, 'tired', { assisted: false, loads: null })).toBe(ladder);
    const none = prescribe(input());
    expect(holdForDeclaredFatigue(none, 'tired', { assisted: false, loads: null })).toBe(none);
  });

  it('exercice assisté : une assistance plus faible (plus dur) est gardée à la référence', () => {
    const p = { ...increase(), loadKg: 25, deltaKg: -5, reference: { loadKg: 30, reps: [10, 10, 10], e1rmKg: 40 }, sets: [{ reps: 10, loadKg: 25 }] };
    expect(holdForDeclaredFatigue(p, 'tired', { assisted: true, loads: null })).toMatchObject({ loadKg: 30, deltaKg: 0, sets: [{ reps: 10, loadKg: 30 }] });
    const easier = { ...p, loadKg: 35, deltaKg: 5 };
    expect(holdForDeclaredFatigue(easier, 'tired', { assisted: true, loads: null })).toBe(easier);
  });
});
