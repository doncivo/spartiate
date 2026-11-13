import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { RecoveryDaySummary } from '../../domain/recovery';
import type { RoutineInput } from '../../domain/training';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { NutritionRemainingCard } from '../nutrition/NutritionRemainingCard';
import { quickAddDraft, saveManualTarget } from '../nutrition/useCases';
import { RecoveryToday } from '../recovery/RecoveryToday';
import { TodaySessionCard } from '../training/session/TodaySessionCard';
import { AppContainerProvider } from './AppContainerContext';
import { createAppContainer } from './container';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { BodyProgress, RecoveryProgress } from './lazyScreens';
import { SectionNotice } from './SectionNotice';

/**
 * ERGO-01 (Aujourdhui-apres.dc.html, Recuperation-apres.dc.html) : un chiffre héros par bloc (`.ct-hero__num`, unité à part), moins de cartes
 * (nutrition à plat, Pas dans la carte Récupération), un tap gagné vers l'import Santé quand le résumé est périmé, message vrai sous Progrès.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000ea' as DeviceId;
const TODAY = '2026-11-10' as LocalDate;
let db: TestDb;
const fr = (n: number): string => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
const norm = (s: string | null | undefined): string => (s ?? '').replace(/[\u202f\u00a0]/g, ' ');
const mount = (node: ReactNode,os: 'ios' | 'other' = 'ios') =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, platform: { runtime: 'web', os } })}>
      {node}
    </AppContainerProvider>,
  );
const hero = async (): Promise<HTMLElement> => {
  const num = await screen.findByText((_, el) => el?.classList.contains('ct-hero__num') ?? false);
  return num;
};

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-10T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ERGO-01 : Nutrition sur Aujourd’hui', () => {
  it('chiffre héros des calories restantes, unité à part, bloc à plat (moins de cartes)', async () => {
    await saveManualTarget(db.data, { weekStart: '2026-11-08' as LocalDate, target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: '08:00' as LocalTime, name: 'Petit-déjeuner', kcal: 500, proteinG: 30, fatG: 10, carbG: 60 }));
    mount(<NutritionRemainingCard />);
    const num = await hero();
    expect(norm(num.textContent)).toBe(fr(1900));
    expect(num.parentElement).toHaveClass('ct-hero');
    expect(num.nextElementSibling).toHaveClass('ct-hero__unit');
    expect(num.nextElementSibling).toHaveTextContent('kcal restantes');
    expect(num.closest('section')).toHaveClass('ct-today__card--flat');
  });
});

describe('ERGO-01 : Séance sur Aujourd’hui', () => {
  it('séance ouverte : chiffre héros des séries faites sur prévues', async () => {
    const routine: RoutineInput = {
      id: '3c2b1a00-0000-4000-8000-0000000000a1',
      name: 'Haut / Bas',
      mode: 'programme',
      days: [
        {
          id: '3c2b1a00-0000-4000-8000-0000000000a2',
          name: 'Haut A',
          dayOrder: 1,
          exercises: [{ id: '3c2b1a00-0000-4000-8000-0000000000a3', exerciseId: 'bench-press-barbell', exerciseName: 'Développé couché', sets: 3, repMin: 6, repMax: 10, rir: 2, restSec: 150, position: 0 }],
        },
      ],
    };
    await (await db.data.repos.trainingRoutines()).create(routine);
    await db.data.transaction(async (repos) => (await repos.workouts()).start({ source: 'routine', routineId: routine.id, dayId: '3c2b1a00-0000-4000-8000-0000000000a2' }));
    mount(<TodaySessionCard />);
    const num = await hero();
    expect(norm(num.textContent)).toBe('0 / 3');
    expect(num.nextElementSibling).toHaveTextContent('séries');
  });
});

const summary = (patch: Partial<RecoveryDaySummary> = {}): RecoveryDaySummary => ({
  day: TODAY,
  level: 'A',
  recovery: 72,
  abstainReason: null,
  quality: 'good',
  exertion: 3.46,
  exertionPrevDay: 0,
  sleepMinutes: 432,
  sleepNeedMinutes: 450,
  sleepScore: 96,
  bedtimeSigmaMinutes: 20,
  targetZone: { from: 6, to: 8 },
  hrvMs: 60,
  restingHr: 50,
  learningNights: 14,
  contributors: [],
  explanationKeys: [],
  computedAt: '2026-11-10T07:00:00.000Z',
  ...patch,
});
const save = async (s: RecoveryDaySummary): Promise<void> => {
  await (await db.data.repos.recovery()).saveDay({ summary: s, muscles: [] });
};

describe('ERGO-01 : Récupération sur Aujourd’hui', () => {
  it('cadran Recovery en héros, Pas dans la même carte (une carte de moins)', async () => {
    await save(summary());
    mount(<RecoveryToday />);
    const recovery = await screen.findByRole('region', { name: 'Recovery' });
    expect(recovery).toHaveClass('ct-recovery__cell--hero');
    const card = screen.getByRole('heading', { level: 2, name: 'Récupération' }).closest('section');
    expect(card).not.toBeNull();
    expect(card).toContainElement(screen.getByRole('heading', { name: 'Pas' }));
  });

  it('résumé périmé sur l’iPhone : « Ouvrir Apple Santé » directement depuis la carte (un tap gagné)', async () => {
    await save(summary({ day: '2026-11-07' as LocalDate, computedAt: '2026-11-07T07:00:00.000Z' }));
    mount(<RecoveryToday />);
    const open = await screen.findByRole('button', { name: 'Ouvrir Apple Santé' });
    act(() => fireEvent.click(open));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'more', screen: 'health' });
  });

  it('résumé du jour : pas de bouton d’import (rien à rattraper)', async () => {
    await save(summary());
    mount(<RecoveryToday />);
    await screen.findByRole('region', { name: 'Recovery' });
    expect(screen.queryByRole('button', { name: 'Ouvrir Apple Santé' })).toBeNull();
  });
});

describe('ERGO-01 : message vrai sous Progrès', () => {
  it('Progrès montre Récupération et Corps : plus de « arrive avec une prochaine version »', async () => {
    await Promise.all([RecoveryProgress.preload(), BodyProgress.preload()]);
    act(() => useNavigationStore.getState().navigate({ tab: 'progress' }));
    mount(<SectionNotice tab="progress" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Progrès' })).toBeInTheDocument();
    expect(screen.queryByText(/arrive avec une prochaine version/)).toBeNull();
    expect(screen.queryByText(/Rien n’est affiché ni enregistré/)).toBeNull();
  });
});
