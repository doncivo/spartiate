import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '../../domain/localDate';
import { aggregateDays } from '../../domain/nutrition/dayTotals';
import { DEFAULT_NUTRITION_PREFS } from '../../domain/nutrition/prefs';
import { estimateTdee } from '../../domain/nutrition/tdee';
import type { MealEntryInput, Target } from '../../domain/nutrition/types';
import { computeTrend } from '../../domain/nutrition/weightTrend';
import type { LocalDate } from '../../domain/types';
import { DashboardView } from './dashboard/DashboardView';
import { dashboardModel } from './dashboard/model';
import { RestTargetForm } from './strategy/RestTargetForm';
import { TargetForm } from './strategy/TargetForm';
import type { NutritionSnapshot } from './useCases';

/** FIX-PLANCHER (C-086, C-087, C-088) : valeurs synthétiques. */
afterEach(cleanup);
const T = (kcal: number, carbG = 100): Target => ({ kcal, proteinG: 120, fatG: 50, carbG });
const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('C-086 : TargetForm avec une cible de repos', () => {
  it('1 300 avec un repos à −200 (1 100) : la case de confirmation est affichée et transmise', async () => {
    const onSave = vi.fn().mockResolvedValue('saved');
    render(<TargetForm title="t" initial={T(1300)} submitLabel="Enregistrer" onSave={onSave} {...({ restGapKcal: -200 } as object)} />);
    const box = screen.getByRole('checkbox', { name: /sous 1 200 kcal/i });
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kcal: 1300 }), true));
  });
  it('sans cible de repos, 1 300 : pas de case', () => {
    render(<TargetForm title="t" initial={T(1300)} submitLabel="Enregistrer" onSave={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('repos sous 800 : message « sous 800 kcal », pas « échec »', async () => {
    const onSave = vi.fn().mockResolvedValue('rejected');
    render(<TargetForm title="t" initial={T(900)} submitLabel="Enregistrer" onSave={onSave} {...({ restGapKcal: -200 } as object)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/800/));
  });
});

describe('C-087 : RestTargetForm', () => {
  it('repos à 1 100 : case réelle, onSave reçoit la confirmation', async () => {
    const onSave = vi.fn().mockResolvedValue('saved');
    render(<RestTargetForm target={T(1300)} plan={null} defaultDays={[1, 2, 4, 5, 6]} onSave={onSave as never} />);
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('checkbox', { name: /sous 1 200 kcal/i }));
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rest: expect.objectContaining({ kcal: 1100 }) }), true));
  });
  it('refus pour confirmation manquante : le message le dit', async () => {
    const onSave = vi.fn().mockResolvedValue('confirmation-required');
    render(<RestTargetForm target={T(1300)} plan={null} defaultDays={[1, 2, 4, 5, 6]} onSave={onSave as never} />);
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/1 200/));
  });
});

describe('C-088 : tableau de bord un jour de repos', () => {
  const TODAY = '2026-11-10' as LocalDate; // mardi : jour d'entraînement
  const REST_DAY = '2026-11-11' as LocalDate; // mercredi : repos (jours 1, 2, 4, 5, 6)
  const snap = (): NutritionSnapshot => {
    const entries: MealEntryInput[] = [{ date: REST_DAY, time: '12:00', kcal: 2000, proteinG: 100, fatG: 60, carbG: 200 } as MealEntryInput];
    const days = aggregateDays(addDays(REST_DAY, -59), REST_DAY, entries, {});
    const tdee = estimateTdee({ endDate: addDays(REST_DAY, -1), days, weighIns: [], profile: null, activity: null, previousSmoothed: null });
    const record = { id: 'r', weekStart: '2026-11-09' as LocalDate, target: T(2500, 300), source: 'manual', accepted: true, engineVersion: null, createdAt: '2026-11-09T08:00:00.000Z', hlc: '001794484800000-0000-0f8fad5b-d9cb-469f-a165-70867728950e', restPlan: { rest: T(2300, 250), trainingDays: [1, 2, 4, 5, 6] } } as never;
    return { today: REST_DAY, reference: addDays(REST_DAY, -1), days, weighIns: [], trend: computeTrend([]), tdee, prefs: DEFAULT_NUTRITION_PREFS, profile: null, target: record, targets: [record] } as NutritionSnapshot;
  };
  it('le modèle expose la cible du type de jour', () => {
    expect(TODAY).toBeTruthy();
    expect((dashboardModel(snap()) as unknown as { todayTarget: Target | null }).todayTarget?.kcal).toBe(2300);
  });
  it('« il reste 300 » (repos), pas 500', () => {
    render(<DashboardView snapshot={snap()} />);
    const card = screen.getByRole('region', { name: /aujourd/i });
    expect(card.textContent).toContain('300');
    expect(card.textContent).not.toContain('500');
    void type;
  });
});
