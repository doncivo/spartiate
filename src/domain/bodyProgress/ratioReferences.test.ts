import { describe, expect, it } from 'vitest';
import { ratioReference } from './ratioReferences';

/** PROG-0301b (BL-181, Q-41, D-745) : repères des 4 ratios validés par Ali le 26/11. Valeurs inventées. */
describe('taille / hauteur : bandes NICE, « non valable si IMC ≥ 35 »', () => {
  it('bandes : < 0,40 sous la bande saine ; 0,40–0,49 saine ; 0,50–0,59 risque augmenté ; ≥ 0,60 élevé ; mention toujours portée', () => {
    expect(ratioReference('waist_height', 0.39, 'male')).toEqual({ kind: 'band', band: 'below-healthy', caveat: 'bmi-35' });
    expect(ratioReference('waist_height', 0.4, 'male')).toEqual({ kind: 'band', band: 'healthy', caveat: 'bmi-35' });
    expect(ratioReference('waist_height', 0.49, 'female')).toEqual({ kind: 'band', band: 'healthy', caveat: 'bmi-35' });
    expect(ratioReference('waist_height', 0.5, null)).toEqual({ kind: 'band', band: 'increased', caveat: 'bmi-35' });
    expect(ratioReference('waist_height', 0.59, 'male')).toEqual({ kind: 'band', band: 'increased', caveat: 'bmi-35' });
    expect(ratioReference('waist_height', 0.6, 'male')).toEqual({ kind: 'band', band: 'high', caveat: 'bmi-35' });
  });
});

describe('taille / hanches : < 0,90 homme, < 0,85 femme, « populations européennes »', () => {
  it('homme', () => {
    expect(ratioReference('waist_hips', 0.89, 'male')).toEqual({ kind: 'threshold', below: true, limit: 0.9, caveat: 'european' });
    expect(ratioReference('waist_hips', 0.9, 'male')).toEqual({ kind: 'threshold', below: false, limit: 0.9, caveat: 'european' });
  });
  it('femme', () => {
    expect(ratioReference('waist_hips', 0.84, 'female')).toEqual({ kind: 'threshold', below: true, limit: 0.85, caveat: 'european' });
    expect(ratioReference('waist_hips', 0.85, 'female')).toEqual({ kind: 'threshold', below: false, limit: 0.85, caveat: 'european' });
  });
  it('sexe non renseigné : aucun repère, jamais un seuil deviné', () => {
    expect(ratioReference('waist_hips', 0.8, null)).toEqual({ kind: 'none', reason: 'no-sex' });
  });
});

describe('épaules / taille : aucun repère, la valeur et son évolution seulement', () => {
  it('quel que soit le sexe', () => {
    expect(ratioReference('shoulders_waist', 1.5, 'male')).toEqual({ kind: 'none', reason: 'no-reference' });
    expect(ratioReference('shoulders_waist', 1.5, 'female')).toEqual({ kind: 'none', reason: 'no-reference' });
  });
});

describe('poitrine / taille : environ 1,30 à 1,35 chez l’homme, « esthétique, sans valeur santé »', () => {
  it('homme : sous, dans ou au-dessus de la plage', () => {
    expect(ratioReference('chest_waist', 1.29, 'male')).toEqual({ kind: 'range', position: 'below', min: 1.3, max: 1.35, caveat: 'aesthetic' });
    expect(ratioReference('chest_waist', 1.3, 'male')).toEqual({ kind: 'range', position: 'within', min: 1.3, max: 1.35, caveat: 'aesthetic' });
    expect(ratioReference('chest_waist', 1.35, 'male')).toEqual({ kind: 'range', position: 'within', min: 1.3, max: 1.35, caveat: 'aesthetic' });
    expect(ratioReference('chest_waist', 1.36, 'male')).toEqual({ kind: 'range', position: 'above', min: 1.3, max: 1.35, caveat: 'aesthetic' });
  });
  it('femme ou sexe non renseigné : aucun repère (le repère n’est donné que chez l’homme)', () => {
    expect(ratioReference('chest_waist', 1.3, 'female')).toEqual({ kind: 'none', reason: 'no-reference' });
    expect(ratioReference('chest_waist', 1.3, null)).toEqual({ kind: 'none', reason: 'no-sex' });
  });
});

describe('valeur non finie ou non positive : aucun repère', () => {
  it('jamais une bande sur une valeur fausse', () => {
    expect(ratioReference('waist_height', Number.NaN, 'male')).toEqual({ kind: 'none', reason: 'invalid' });
    expect(ratioReference('waist_hips', 0, 'male')).toEqual({ kind: 'none', reason: 'invalid' });
  });
});
