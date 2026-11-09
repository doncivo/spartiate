import { describe, expect, it } from 'vitest';
import { TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, type ExportData, type TrainingTable } from './archive';
import { planImport } from './plan';

/**
 * I4-07 : `TABLE_SINCE_SV` fige qu'un « remplacer » d'une archive plus ancienne que la table ne supprime JAMAIS ses lignes locales (progressions
 * et décisions : schéma 6, cycles : 7, nutrition : 8, recettes et journée déclarée : 9). Une archive qui connaît la table, elle, la vide.
 */
const row = (id: string) => ({ id, values: {} });
const local = (): ExportData => ({
  profile: null,
  weights: [],
  settings: {},
  training: Object.fromEntries(TRAINING_EXPORT_TABLES.map((t) => [t, [row(`local-${t}`)]])) as NonNullable<ExportData['training']>,
});
const archive = (sv: number): ExportData => ({ profile: null, weights: [], settings: {}, training: { exercise: [row('local-exercise')] }, archiveSv: sv });
const deleted = (sv: number): TrainingTable[] => planImport(local(), archive(sv), 'replace').writes.deleteTraining.map((d) => d.table);

describe('« remplacer » d’une archive ancienne : les tables plus récentes que l’archive sont épargnées', () => {
  it.each([4, 5, 6, 7, 8, 9])('archive de schéma %i : seules les tables connues à cette version sont vidées', (sv) => {
    const dropped = new Set(deleted(sv));
    for (const table of TRAINING_EXPORT_TABLES) {
      if (table === 'exercise') continue; // présente dans l'archive, identique
      const since = TABLE_SINCE_SV[table] ?? 0;
      expect(dropped.has(table), `${table} (depuis ${since}) dans une archive ${sv}`).toBe(since <= sv);
    }
  });
  it('archives v4 à v7 : progressions, cycles, fiches, journal, cibles, recettes locaux épargnés tant que l’archive ne pouvait pas les connaître', () => {
    for (const sv of [4, 5]) for (const t of ['progression_profile', 'recommendation_decision', 'mesocycle', 'food', 'meal_entry', 'recipe'] as const) expect(deleted(sv)).not.toContain(t);
    for (const t of ['mesocycle', 'food', 'food_portion', 'meal_entry', 'nutrition_target', 'recipe', 'day_completeness'] as const) expect(deleted(6)).not.toContain(t);
    for (const t of ['food', 'food_portion', 'meal_entry', 'nutrition_target', 'recipe', 'recipe_ingredient', 'day_completeness'] as const) expect(deleted(7)).not.toContain(t);
  });
  it('sans version connue (données lues de la base) : tout est comparé', () => {
    const { archiveSv: _version, ...plain } = archive(9);
    expect(planImport(local(), plain, 'replace').writes.deleteTraining.length).toBe(TRAINING_EXPORT_TABLES.length - 1);
  });
});
