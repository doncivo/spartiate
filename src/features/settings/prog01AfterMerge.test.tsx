import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildExportArchive } from '../../domain/exportImport/archive';
import { sha256Hex } from '../../domain/exportImport/sha256';
import { buildZip, readZip } from '../../domain/exportImport/zip';
import { createHlcClock } from '../../domain/hlc';
import { createUuidGenerator } from '../../domain/id';
import { emptyDraft, type OnboardingDraft } from '../../domain/onboarding';
import { parseDraft } from '../../domain/onboarding/draft';
import { SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import type { RoutineInput } from '../../domain/training/types';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createMemoryFiles } from '../../platform/files';
import { resetAllData } from '../../sync/dataReset';
import { createMemorySyncLogger } from '../../sync/log';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { finishOnboarding } from '../onboarding/onboardingData';
import { loadTrainingContent } from '../training/content';
import { ExportImportScreen } from './ExportImportScreen';

/**
 * PROG-01 (0.24.0), vérification après fusion sur une base de test vide : « Repartir de zéro » → onboarding (mésocycle de 4 semaines, semaine de
 * reprise désactivée) → import « Remplacer » d'une archive sv 18 (0.23.0) par l'écran Plus › Export et import. Données SYNTHÉTIQUES.
 */
const A = '60000000-0000-4000-8000-0000000000d1' as DeviceId;
const B = '60000000-0000-4000-8000-0000000000d2' as DeviceId;
const u = (n: number): string => `7c3d2e1f-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ROUTINE: RoutineInput = {
  id: u(1),
  name: 'Programme sv18',
  mode: 'programme',
  days: [1, 2, 3, 4, 5].map((n) => ({
    id: u(100 + n),
    name: `Jour ${n}`,
    dayOrder: n,
    exercises: [{ id: u(200 + n), exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 4, repMin: 6, repMax: 10, rir: null, restSec: 120, position: 0 }],
  })),
};
const DRAFT: OnboardingDraft = {
  ...emptyDraft(),
  step: 'result',
  sex: 'male',
  birthYear: 1990,
  heightCm: 180,
  weightKg: 80,
  activity: 'moderate',
  goal: 'muscle',
  weeklyRatePct: 0.25,
  experience: 'intermediate',
  sessionsPerWeek: 5,
  durationMin: 60,
  equipmentProfileId: 'fitness-park-antony',
  mesoWeeks: 4,
  rampUp: false,
};
const opened: TestDb[] = [];
afterEach(async () => {
  cleanup();
  await Promise.all(opened.splice(0).map((d) => d.close()));
});

/** Archive 0.23.0 (sv 18, sans les colonnes de la 0019), datée de `date`. */
async function archiveSv18(date: string): Promise<Uint8Array> {
  const db = await openBaseDb(A, '2026-11-13T08:00:00.000Z');
  opened.push(db);
  await db.data.transaction(async (repos) => (await repos.trainingRoutines()).create(ROUTINE));
  await (await db.data.repos.nutritionTargets()).record({ weekStart: '2026-11-09' as LocalDate, target: { kcal: 2500, proteinG: 150, fatG: 70, carbG: 317 }, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false });
  await (await db.data.repos.profile()).save({ birthYear: 1990, heightCm: 180, sex: 'male' }, 2026);
  const built = await buildExportArchive(await (await db.data.repos.exportImport()).readExportData(), { date, sv: 18 });
  const json = JSON.parse(new TextDecoder().decode(readZip(built.bytes).find((e) => e.name === 'data.json')?.data)) as { training: Record<string, Record<string, unknown>[]> };
  for (const row of json.training['mesocycle'] ?? []) for (const k of ['next_weeks', 'ramp_up']) Reflect.deleteProperty(row, k);
  for (const row of json.training['nutrition_target'] ?? []) for (const k of ['rest_kcal', 'rest_carb_g', 'training_days']) Reflect.deleteProperty(row, k);
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  return buildZip([
    { name: 'data.json', data: bytes },
    { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ app: 'spartiate', sv: 18, date, sha256: sha256Hex(bytes) })) },
  ]);
}

/** Base de test B : une donnée, « Repartir de zéro » le 14/11 à 08:00, puis l'onboarding du jour J. */
async function resetThenOnboard(): Promise<TestDb> {
  const db = await openBaseDb(B, '2026-11-14T08:00:00.000Z');
  opened.push(db);
  await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-13' as LocalDate, kg: 81, timezone: 'Europe/Paris' }, '2026-11-14' as LocalDate);
  expect((await resetAllData(db.data, SYNC_CATALOGUE, createMemorySyncLogger())).kind).toBe('done');
  expect(await db.driver.select('SELECT 1 FROM body_weight WHERE deleted_at IS NULL')).toEqual([]);
  db.clock.advance(60_000);
  await finishOnboarding({ data: db.data, ids: createUuidGenerator(), today: '2026-11-14' as LocalDate, timeZone: 'Europe/Paris', year: 2026 }, DRAFT, await loadTrainingContent());
  expect(parseDraft(await db.data.repos.settings.get('onboarding.answers'))).toMatchObject({ mesoWeeks: 4, rampUp: false });
  db.clock.advance(2 * 3_600_000);
  return db;
}

async function importReplace(db: TestDb, bytes: Uint8Array): Promise<void> {
  const files = createMemoryFiles();
  files.setPickBytes({ name: 'spartiate-export.zip', bytes });
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: B }), data: db.data, files })}>
      <ExportImportScreen />
    </AppContainerProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Choisir une archive…' }));
}

describe('PROG-01 : Repartir de zéro → onboarding → import Remplacer sv 18', () => {
  it('archive faite APRÈS la remise à zéro : Remplacer importe routine, cible (sans cible de repos) et profil', async () => {
    const db = await resetThenOnboard();
    await importReplace(db, await archiveSv18('2026-11-14T09:00:00.000Z'));
    const preview = await screen.findByRole('region', { name: 'Aperçu de l’import' });
    fireEvent.click(within(preview).getByRole('radio', { name: 'Remplacer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer l’import' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Import terminé');
    expect(await db.driver.select('SELECT name FROM routine WHERE deleted_at IS NULL')).toEqual([{ name: 'Programme sv18' }]);
    expect(await db.driver.select('SELECT kcal, rest_kcal, training_days FROM nutrition_target WHERE deleted_at IS NULL')).toEqual([{ kcal: 2500, rest_kcal: null, training_days: null }]);
    expect(await db.driver.select('SELECT birth_year, height_cm FROM profile')).toEqual([{ birth_year: 1990, height_cm: 180 }]);
    // Réponses de l'onboarding (réglage local, préremplissage du premier cycle) : gardées par l'import.
    expect(parseDraft(await db.data.repos.settings.get('onboarding.answers'))).toMatchObject({ mesoWeeks: 4, rampUp: false });
  });

  it('archive faite AVANT la remise à zéro (export 0.23.0 de la veille) : refusée avant l’aperçu (D-187), rien n’est écrit', async () => {
    const db = await resetThenOnboard();
    await importReplace(db, await archiveSv18('2026-11-13T10:00:00.000Z'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Archive refusée : elle date d’avant « Repartir de zéro ».');
    expect(await db.driver.select("SELECT 1 FROM routine WHERE name = 'Programme sv18'")).toEqual([]);
  });
});
