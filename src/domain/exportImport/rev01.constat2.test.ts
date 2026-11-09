import { describe, expect, it } from 'vitest';
import { buildExportArchive, parseExportArchive, trainingColumns, type ExportData, type TrainingRow } from './archive';
import { planImport } from './plan';

/** REV-01, constat 2 : une archive du schéma courant dont les tables sont vides n'a pas de clé `training` ; « Remplacer » doit tout de même les vider. */
const EMPTY: ExportData = { profile: null, weights: [], settings: {} };
const row = (table: 'recipe' | 'workout', id: string): TrainingRow => ({ id, values: { ...Object.fromEntries(trainingColumns(table).map((c) => [c, null])), ...(table === 'workout' ? { ended_at: '2026-11-01T10:00:00.000Z' } : {}) } });
const withLocal = (): ExportData => ({ ...EMPTY, training: { recipe: [row('recipe', 'recipe|1')], workout: [row('workout', 'w1')] } });

async function produced(sv: number): Promise<ExportData> {
  const { bytes } = await buildExportArchive(EMPTY, { date: '2026-11-09T10:00:00.000Z', sv });
  return (await parseExportArchive(bytes, { currentSv: 9, currentYear: 2026 })).data;
}

describe('REV-01 constat 2 : archive vide du schéma courant', () => {
  it('« Remplacer » avec une archive réellement produite en schéma 9, tables vides, supprime les lignes locales', async () => {
    const incoming = await produced(9);
    expect(incoming.training).toBeUndefined();
    const plan = planImport(withLocal(), incoming, 'replace');
    expect(plan.writes.deleteTraining.map((d) => `${d.table}:${d.id}`).sort()).toEqual(['recipe:recipe|1', 'workout:w1']);
  });

  it('« Fusionner » avec cette archive ne supprime rien', async () => {
    const plan = planImport(withLocal(), await produced(9), 'merge');
    expect(plan.writes.deleteTraining).toEqual([]);
  });

  it('archive ancienne (schéma 4, avant l’export de l’entraînement) : « Remplacer » ne supprime rien', async () => {
    const plan = planImport(withLocal(), await produced(4), 'replace');
    expect(plan.writes.deleteTraining).toEqual([]);
  });

  it('archive du schéma 8 : les tables du schéma 9 (recettes) ne sont pas supprimées, les autres le sont', async () => {
    const plan = planImport(withLocal(), await produced(8), 'replace');
    expect(plan.writes.deleteTraining.map((d) => d.table)).toEqual(['workout']);
  });
});
