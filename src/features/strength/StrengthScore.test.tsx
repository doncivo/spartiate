import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { StrengthScore } from './StrengthScore';

/**
 * STR-0300 (BL-174, D-675) : Progrès › Force, Strength Score maison. Fixtures synthétiques : homme de 80 kg, développé couché 75 kg × 6
 * (Epley 90 kg, force relative 90 kg à 80 kg). Seuils proposés (Q-42, non validés) du développé couché, homme : 40 / 60 / 80 / 104 / 132 kg
 * → 60 + 20 × 10 / 24 = 68,3 → 68, Intermédiaire ; femme : 24 / 36 / 48 / 62,5 / 79 kg → au-delà d'Élite, 100.
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

/** Décision tracée qui a retenu une proposition de décharge : la séance devient une séance de décharge pour le moteur (I2-02). */
async function deloadDecision(workoutId: string, endedAt: string, loadKg: number): Promise<void> {
  await db.driver.execute(
    `INSERT INTO recommendation_decision (id, exercise_id, workout_id, workout_set_id, engine_version, prescription, reasons, accepted, chosen_load_kg, chosen_reps, decided_at, created_at, updated_at, device_id, hlc)
     VALUES (?, 'bench-press-barbell', ?, NULL, 6, ?, '[]', 1, ?, '[6]', ?, ?, ?, ?, ?)`,
    [`${workoutId.slice(0, -2)}88`, workoutId, JSON.stringify({ deload: true, loadKg }), loadKg, endedAt, endedAt, endedAt, DEVICE, HLC],
  );
}

const profile = async (sex: 'male' | 'female') => (await db.data.repos.profile()).save({ sex }, 2026);
const weigh = async (kg: number, date = '2026-11-01') => (await db.data.repos.bodyWeights()).saveManual({ date: date as LocalDate, kg, timezone: 'Europe/Paris' }, '2026-11-16' as LocalDate);
const row = (name: string) => screen.getByRole('listitem', { name });
const GROUPS = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Quadriceps', 'Ischios', 'Fessiers'];

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('Progrès › Force : Strength Score maison', () => {
  it('sexe absent du profil : la carte le dit, les 8 groupes « inconnu », aucun score global', async () => {
    await weigh(80);
    mount();
    expect(await screen.findByText('Sexe non renseigné dans le profil : les seuils dépendent du sexe.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Strength Score' })).toBeInTheDocument();
    for (const name of GROUPS) expect(within(row(name)).getByText('inconnu')).toBeInTheDocument();
    expect(screen.queryByText(/global/)).toBeNull();
  });

  it('aucune pesée : pas de score, la carte le dit ; jamais 0', async () => {
    await profile('male');
    await closedBench('70000000-0000-4000-8000-000000000001', '2026-11-10T18:00:00.000Z', 75, 6);
    mount();
    expect(await screen.findByText('Aucune pesée : sans poids de corps, pas de score.')).toBeInTheDocument();
    for (const name of GROUPS) expect(within(row(name)).getByText('inconnu')).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('homme de 80 kg, développé couché 75 × 6 : global 68 Intermédiaire sur 1 groupe ; contexte, groupe et détail par mouvement', async () => {
    await profile('male');
    await weigh(80);
    await closedBench('70000000-0000-4000-8000-000000000001', '2026-11-10T18:00:00.000Z', 75, 6);
    mount();
    expect(await screen.findByText('68', { selector: '.ct-strength__global-value' })).toBeInTheDocument();
    expect(screen.getByText('global · Intermédiaire · 1 groupe sur 8')).toBeInTheDocument();
    expect(screen.getByText('80 kg · homme · catégorie : tous poids, ramenés à 80 kg')).toBeInTheDocument();
    expect(within(row('Pectoraux')).getByText('68')).toBeInTheDocument();
    expect(within(row('Pectoraux')).getByText('Intermédiaire · Développé couché à la barre')).toBeInTheDocument();
    const detail = screen.getByRole('list', { name: 'Détail par mouvement' });
    expect(within(detail).getByText('Développé couché à la barre · e1RM 90 kg · force relative 90 kg · 68 (Intermédiaire)')).toBeInTheDocument();
    // Groupe sans séance : « inconnu » et la raison, avec les mouvements de référence ; jamais 0.
    expect(within(row('Dos')).getByText('inconnu')).toBeInTheDocument();
    expect(within(row('Dos')).getByText('Aucune séance de : Rowing à la barre, Traction lestée, Traction pronation, Traction supination.')).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
    // Les paliers d'avant (Fer, Bronze, Argent, Or) ont disparu.
    for (const tier of [/\bFer\b/, /Bronze/, /Argent/, /\bOr\b/]) expect(screen.queryByText(tier)).toBeNull();
  });

  it('femme de même poids : ses seuils changent le score (100, Élite)', async () => {
    await profile('female');
    await weigh(80);
    await closedBench('70000000-0000-4000-8000-000000000001', '2026-11-10T18:00:00.000Z', 75, 6);
    mount();
    expect(await screen.findByText('100', { selector: '.ct-strength__global-value' })).toBeInTheDocument();
    expect(screen.getByText('global · Élite · 1 groupe sur 8')).toBeInTheDocument();
    expect(screen.getByText('80 kg · femme · catégorie : tous poids, ramenés à 80 kg')).toBeInTheDocument();
  });

  it('semaine de décharge : le score est figé et l’écran le dit, avec le poids d’avant la décharge', async () => {
    await profile('male');
    await weigh(80, '2026-11-01');
    await weigh(70, '2026-11-14');
    await closedBench('70000000-0000-4000-8000-000000000001', '2026-11-10T18:00:00.000Z', 75, 6);
    await closedBench('70000000-0000-4000-8000-000000000002', '2026-11-12T18:00:00.000Z', 60, 6);
    await deloadDecision('70000000-0000-4000-8000-000000000002', '2026-11-12T18:00:00.000Z', 60);
    mount();
    expect(await screen.findByText('Figé pendant la décharge, depuis le 12/11/2026.')).toBeInTheDocument();
    expect(screen.getByText('68', { selector: '.ct-strength__global-value' })).toBeInTheDocument();
    expect(screen.getByText('80 kg · homme · catégorie : tous poids, ramenés à 80 kg')).toBeInTheDocument();
  });

  it('méthode en français simple, version citée ; aucune norme tierce ni attribution', async () => {
    await profile('male');
    await weigh(80);
    mount();
    expect(await screen.findByText(/formule d’Epley/)).toBeInTheDocument();
    expect(screen.getByText(/e1RM × \(80 \/ ton poids\)\^\(2\/3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Débutant 20 · Novice 40 · Intermédiaire 60 · Avancé 80 · Élite 100/)).toBeInTheDocument();
    expect(screen.getByText(/figé/)).toBeInTheDocument();
    expect(screen.getByText('Méthode maison, version 1.')).toBeInTheDocument();
    expect(screen.queryByText(/Normes :/)).toBeNull();
    expect(screen.queryByText(/licence/i)).toBeNull();
  });
});
