import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { StrengthScore } from './StrengthScore';

/**
 * STR-01 (PRD § 17.1, D-310 à D-313) : Progrès › Strength Score sur les normes embarquées (content/strength/standards.json) et le catalogue
 * (`strengthStandardKey`). Fixtures synthétiques : homme de 80 kg, développé couché 75 kg × 6 (Epley 90 kg). Catégorie ≤ 83 kg des hommes :
 * p25 79,3 kg, p50 92,6 kg → 25 + 25 × 10,7 / 13,3 = 45,1 → 45, Bronze.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d1' as DeviceId;
const NOW = '2026-11-16T18:00:00.000Z';
const HLC = '0000000000000-0000-60000000-0000-4000-8000-0000000000d1';
let db: TestDb;

const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os: 'other' } })}>
      <StrengthScore />
    </AppContainerProvider>,
  );

async function closedBench(id: string, endedAt: string, loadKg: number, reps: number): Promise<void> {
  await db.driver.execute(`INSERT INTO workout (id, name, started_at, ended_at, source, created_at, updated_at, device_id, hlc) VALUES (?, 'Séance', ?, ?, 'empty', ?, ?, ?, ?)`, [id, endedAt, endedAt, endedAt, endedAt, DEVICE, HLC]);
  await db.driver.execute(
    `INSERT INTO workout_set (id, workout_id, exercise_id, exercise_name, position, set_kind, reps, load_kg, done, created_at, updated_at, device_id, hlc)
     VALUES (?, ?, 'bench-press-barbell', 'Développé couché à la barre', 0, 'work', ?, ?, 1, ?, ?, ?, ?)`,
    [`${id.slice(0, -2)}99`, id, reps, loadKg, endedAt, endedAt, DEVICE, HLC],
  );
}

const profile = async (sex: 'male' | 'female') => (await db.data.repos.profile()).save({ sex }, 2026);
const weigh = async (kg: number) => (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-15' as LocalDate, kg, timezone: 'Europe/Paris' }, '2026-11-16' as LocalDate);
const row = (name: string) => screen.getByRole('listitem', { name });

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Strength Score', () => {
  it('sexe absent du profil : la carte le dit, les 8 groupes en « — », aucun score global', async () => {
    await weigh(80);
    mount();
    expect(await screen.findByText('Sexe non renseigné dans le profil : les normes dépendent du sexe.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Strength Score' })).toBeInTheDocument();
    for (const name of ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Quadriceps', 'Ischios', 'Fessiers']) expect(within(row(name)).getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/global/)).toBeNull();
  });

  it('aucune pesée : la carte le dit', async () => {
    await profile('male');
    mount();
    expect(await screen.findByText('Aucune pesée : les normes dépendent du poids de corps.')).toBeInTheDocument();
  });

  it('homme de 80 kg, développé couché 75 × 6 : Pectoraux 45, global 45 Bronze sur 1 groupe ; poids, sexe et catégorie dits', async () => {
    await profile('male');
    await weigh(80);
    await closedBench('70000000-0000-4000-8000-000000000001', '2026-11-10T18:00:00.000Z', 75, 6);
    mount();
    expect(await screen.findByText('45', { selector: '.ct-strength__global-value' })).toBeInTheDocument();
    expect(screen.getByText('global · Bronze · 1 groupe sur 8')).toBeInTheDocument();
    expect(screen.getByText('80 kg · homme · catégorie ≤ 83 kg')).toBeInTheDocument();
    expect(within(row('Pectoraux')).getByText('45')).toBeInTheDocument();
    expect(within(row('Pectoraux')).getByText('Développé couché à la barre · 1RM estimé 90 kg')).toBeInTheDocument();
    // Groupe sans séance : « — » et la raison, avec les mouvements de référence ; jamais 0.
    expect(within(row('Dos')).getByText('—')).toBeInTheDocument();
    expect(within(row('Dos')).getByText('Aucune séance de : Rowing à la barre, Traction lestée, Traction pronation, Traction supination.')).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('femme de même poids : la table des femmes change le score', async () => {
    await profile('female');
    await weigh(80);
    await closedBench('70000000-0000-4000-8000-000000000001', '2026-11-10T18:00:00.000Z', 75, 6);
    mount();
    // Catégorie ≤ 84 kg des femmes : p95 84,4 kg, p99 103,2 kg → 95 + 4 × 5,6 / 18,8 = 96,2 → 96, Or.
    expect(await screen.findByText('96', { selector: '.ct-strength__global-value' })).toBeInTheDocument();
    expect(screen.getByText('global · Or · 1 groupe sur 8')).toBeInTheDocument();
    expect(screen.getByText('80 kg · femme · catégorie ≤ 84 kg')).toBeInTheDocument();
  });

  it('source des normes visible (attribution exigée par la licence) ; paliers et décharge expliqués', async () => {
    await profile('male');
    await weigh(80);
    mount();
    expect(await screen.findByText(/Normes : FitnessVolt Strength Standards/)).toBeInTheDocument();
    expect(screen.getByText(/fitnessvolt\.com\/strength-standards/)).toBeInTheDocument();
    expect(screen.getByText(/Fer < 25 · Bronze 25–49 · Argent 50–74 · Or ≥ 75/)).toBeInTheDocument();
    expect(screen.getByText(/Inchangé en décharge/)).toBeInTheDocument();
  });
});
