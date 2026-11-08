import { describe, expect, it } from 'vitest';
import { BENCH, CURL, CURL_EZ, FITNESS_PARK_ANTONY, LEG_PRESS, STACK_GYM, input, session } from '../../../tests/fixtures/training/progression';
import { ENGINE_VERSION } from './config';
import { explainPrescription, explanationNotes } from './explain';
import { gridToVerify } from './loadGrid';
import { prescribe } from './prescribe';
import type { ExerciseSession, ProgressionEquipment } from './types';

/**
 * I2-04 (points 2 et 3) : la phrase de la proposition dit (1) qu'une séance partielle (moins de 50 % des séries faites) a été ignorée,
 * (2) que la grille de charges repose sur du matériel marqué « à vérifier » dans le profil (barre EZ, barre hexagonale, machine, poulie,
 * haltères). Information seulement : la proposition est identique, rien n'est bloqué. Disques « à vérifier » (nombre par masse) : non signalés,
 * ils ne changent pas le pas de la grille.
 */

/** Toutes les valeurs « à vérifier » du profil embarqué Fitness Park Antony (toEmbeddedProfile), plus les haltères pour le test. */
const withVerify = (base: ProgressionEquipment, toVerify: readonly string[]): ProgressionEquipment => ({ inventory: { ...base.inventory, toVerify }, increments: base.increments });
const ANTONY_REAL = withVerify(FITNESS_PARK_ANTONY, ['barbell:Petite barre droite', 'barbell:Barre EZ', 'barbell:Barre hexagonale', 'barbell:Barre guidée Smith', 'plates', 'kettlebells', 'cables', 'machines']);
const partial = (days: number, load: number): ExerciseSession =>
  session(days, load, [], { sets: [0, 1, 2].map((position) => ({ position, setKind: 'work', done: position === 0, reps: 4, loadKg: load, rir: null })) });

describe('gridToVerify', () => {
  it('barre EZ « à vérifier » : oui ; barre olympique (vérifiée) : non, même si les disques sont à vérifier', () => {
    expect(gridToVerify(CURL_EZ.equipment, ANTONY_REAL)).toBe(true);
    expect(gridToVerify(BENCH.equipment, ANTONY_REAL)).toBe(false);
    expect(gridToVerify(CURL_EZ.equipment, FITNESS_PARK_ANTONY)).toBe(false);
  });

  it('machine déclarée et profil « machines à vérifier » : oui ; haltères « à vérifier » : oui ; sans grille : non', () => {
    expect(gridToVerify(LEG_PRESS.equipment, withVerify(STACK_GYM, ['machines']))).toBe(true);
    expect(gridToVerify(LEG_PRESS.equipment, STACK_GYM)).toBe(false);
    expect(gridToVerify(CURL.equipment, withVerify(FITNESS_PARK_ANTONY, ['dumbbells']))).toBe(true);
    expect(gridToVerify(LEG_PRESS.equipment, ANTONY_REAL)).toBe(false);
    expect(gridToVerify(CURL_EZ.equipment, null)).toBe(false);
  });
});

describe('explanationNotes', () => {
  it('séance partielle ignorée : dite, avec ou sans autre séance de référence', () => {
    const withRef = prescribe(input({ history: [session(6, 60, [10, 10, 10]), partial(3, 60)] }));
    expect(explanationNotes(withRef)).toEqual([{ key: 'notePartialIgnored', params: {} }]);
    const alone = prescribe(input({ history: [partial(3, 60)] }));
    expect(explainPrescription(alone).key).toBe('toEnter');
    expect(explanationNotes(alone)).toEqual([{ key: 'notePartialIgnored', params: {} }]);
  });

  it('séance complète : aucune note', () => {
    expect(explanationNotes(prescribe(input({ history: [session(3, 60, [10, 10, 10])] })))).toEqual([]);
  });

  it('barre EZ « à vérifier » : raison `grid-to-verify`, note dite, proposition identique (rien de bloqué)', () => {
    const history = [session(3, 28.5, [12, 12, 12])];
    const flagged = prescribe(input({ exercise: CURL_EZ, history, equipment: ANTONY_REAL }));
    const plain = prescribe(input({ exercise: CURL_EZ, history, equipment: FITNESS_PARK_ANTONY }));
    expect(flagged.reasons).toContain('grid-to-verify');
    expect(plain.reasons).not.toContain('grid-to-verify');
    expect(explanationNotes(flagged)).toEqual([{ key: 'noteGridToVerify', params: {} }]);
    expect(flagged.sets).toEqual(plain.sets);
    expect(flagged.status).toBe('prescribed');
  });

  it('les deux notes ensemble, dans l’ordre : séance ignorée, puis matériel à vérifier', () => {
    const p = prescribe(input({ exercise: CURL_EZ, history: [session(6, 28.5, [10, 10, 10]), partial(3, 28.5)], equipment: ANTONY_REAL }));
    expect(explanationNotes(p).map((n) => n.key)).toEqual(['notePartialIgnored', 'noteGridToVerify']);
  });

  it('décision d’Ali reprise telle quelle : aucune note (la phrase dit déjà sa valeur)', () => {
    const p = prescribe(input({ exercise: CURL_EZ, history: [partial(3, 28.5)], equipment: ANTONY_REAL, lastDecision: { decidedAt: '2026-11-06T10:00:00.000Z' as never, accepted: false, loadKg: 30, reps: [8, 8, 8] } }));
    expect(p.headline).toBe('decision');
    expect(explanationNotes(p)).toEqual([]);
  });

  it('nouvelle raison : version du moteur 3', () => {
    expect(ENGINE_VERSION).toBe(3);
    expect(prescribe(input()).engineVersion).toBe(3);
  });
});
