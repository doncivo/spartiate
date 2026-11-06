import { describe, expect, it } from 'vitest';
import type { SyncValue } from '../../domain/sync/format';
import { SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import { conflictHeading, conflictTitle, conflictValueText, fieldLabel } from './conflictText';

describe('UI-FIX-02 : champ modifié nommé en langage utilisateur', () => {
  it.each([['date', 'date prévue'], ['time', 'heure prévue'], ['status', 'état de la tâche']])('%s possède un libellé explicite', (name, label) => {
    expect(fieldLabel({ name: 'task' }, { name })).toBe(label);
  });
});

/** 0.1.4 (3) : le journal des conflits parle français, sans clé technique ni anglais, pour chaque table du catalogue publié. */
describe('libellés des conflits du catalogue publié (0.1.4 point 3)', () => {
  const need = <T,>(value: T | undefined): T => {
    if (value === undefined) throw new Error('absent du catalogue');
    return value;
  };
  const profile = need(SYNC_CATALOGUE.table('profile'));
  const weight = need(SYNC_CATALOGUE.table('body_weight'));
  const col = (table: typeof profile, name: string) => need(SYNC_CATALOGUE.column(table.name, name));
  const live = { itemState: 'live' as const };
  const side = (value: SyncValue) => ({ value, ref: null });

  it('profil : « Profil : expérience », titre « Profil »', () => {
    const names = { title: conflictTitle({ ...live, title: null, table: profile }), field: fieldLabel(profile, { name: 'experience' }) };
    expect(names.title).toBe('Profil');
    expect(conflictHeading({ ...live, title: null, table: profile }, names)).toBe('Profil : expérience');
    expect(conflictHeading({ ...live, title: null, table: profile }, { ...names, field: fieldLabel(profile, { name: 'birth_year' }) })).toBe('Profil : année de naissance');
  });

  it('pesée : « Pesée du 5 nov. » pour le poids, champ ajouté pour les autres colonnes', () => {
    const view = { ...live, title: '2026-11-05', table: weight };
    const names = { title: conflictTitle(view), field: fieldLabel(weight, { name: 'kg' }) };
    expect(conflictHeading(view, names)).toBe('Pesée du 5 nov.');
    expect(conflictHeading(view, { ...names, field: 'origine' })).toBe('Pesée du 5 nov. : origine');
    expect(conflictHeading({ itemState: 'missing', title: null, table: weight }, { title: 'Élément supprimé', field: 'poids' })).toBe('Pesée supprimée');
  });

  it('valeurs traduites avec les libellés de l’écran Profil et poids', () => {
    expect(conflictValueText(profile, col(profile, 'experience'), side('intermediate'), 0)).toBe('Intermédiaire');
    expect(conflictValueText(profile, col(profile, 'experience'), side('beginner'), 0)).toBe('Débutant');
    expect(conflictValueText(profile, col(profile, 'sex'), side('female'), 0)).toBe('Femme');
    expect(conflictValueText(profile, col(profile, 'sex'), side('male'), 0)).toBe('Homme');
    expect(conflictValueText(profile, col(profile, 'goal'), side('loss'), 0)).toBe('Perte de poids');
    expect(conflictValueText(profile, col(profile, 'goal'), side('gain'), 0)).toBe('Prise de masse');
    expect(conflictValueText(profile, col(profile, 'goal'), side('maintain'), 0)).toBe('Maintien');
    expect(conflictValueText(profile, col(profile, 'units'), side('metric'), 0)).toBe('Métrique');
  });

  it('nombres au format français avec unité : « 106,25 kg », « 186 cm », année sans séparateur', () => {
    expect(conflictValueText(weight, col(weight, 'kg'), side(106.25), 0)).toBe('106,25 kg');
    expect(conflictValueText(weight, col(weight, 'kg'), side(83), 0)).toBe('83 kg');
    expect(conflictValueText(profile, col(profile, 'height_cm'), side(186), 0)).toBe('186 cm');
    expect(conflictValueText(profile, col(profile, 'birth_year'), side(1990), 0)).toBe('1990');
    expect(conflictValueText(weight, col(weight, 'source'), side('health'), 0)).toBe('Apple Santé');
    expect(conflictValueText(weight, col(weight, 'source'), side('manual'), 0)).toBe('Saisie à la main');
  });

  it('aucune valeur de la table ne laisse une clé technique ou anglaise', () => {
    const raw = /intermediate|beginner|advanced|male|female|maintain|metric|manual|\bhealth\b|^body_weight|^profile/i;
    for (const [table, column, value] of [
      [profile, 'sex', 'male'], [profile, 'goal', 'gain'], [profile, 'experience', 'advanced'], [profile, 'units', 'metric'],
      [weight, 'source', 'manual'], [weight, 'source', 'health'],
    ] as const) expect(conflictValueText(table, col(table, column), side(value), 0)).not.toMatch(raw);
  });
});
