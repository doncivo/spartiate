import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { Target } from '../../domain/nutrition';
import type { DeviceId, LocalDate, Weekday } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { NutritionScreen } from './NutritionScreen';

/**
 * ERGO-03 : Stratégie lisible. Base SQLite réelle (wasm), horloge manuelle : lundi 9 novembre 2026, midi à Paris. Valeurs synthétiques.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000e3' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const FUTURE = '2026-11-16' as LocalDate;
let db: TestDb;

const open = () => {
  act(() => useNavigationStore.getState().navigate({ tab: 'nutrition', screen: 'strategy' }));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};
const region = () => screen.findByRole('region', { name: 'Nutrition' });
const norm = (s: string | null | undefined): string => (s ?? '').replace(/[\u202f\u00a0]/g, ' ');
const isUpcoming = (_: string, el: Element | null): boolean => el?.classList.contains('ct-strategy__upcoming') === true;
const seed = async (weekStart: LocalDate, target: Target, restPlan?: { rest: Target; trainingDays: readonly Weekday[] }) =>
  (await db.data.repos.nutritionTargets()).record({ weekStart, target, source: 'manual', accepted: true, engineVersion: null, lowFloorConfirmed: false, ...(restPlan === undefined ? {} : { restPlan }) });
const CURRENT: Target = { kcal: 2600, proteinG: 150, fatG: 80, carbG: 320 };
const UPCOMING: Target = { kcal: 2350, proteinG: 180, fatG: 72, carbG: 240 };

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

describe('ERGO-03 critère 1 : cible en vigueur et cible à venir', () => {
  it('une cible acceptée au lundi 16/11 : « À partir du lundi 16/11 : [retiré] kcal · P · G · L [retirés] », la cible en vigueur reste en chiffre héros', async () => {
    await seed(TODAY, CURRENT);
    await seed(FUTURE, UPCOMING);
    open();
    const r = await region();
    const line = await within(r).findByText(isUpcoming);
    expect(norm(line.textContent)).toBe('À partir du lundi 16/11 : [retiré] kcal · P · G · L [retirés]');
    expect(norm(r.querySelector('.ct-hero')?.textContent)).toContain('2 600');
  });

  it('deux cibles futures : seule la plus proche (D-295)', async () => {
    await seed(TODAY, CURRENT);
    await seed(FUTURE, UPCOMING);
    // Revue 1 (point 4) : écrite en dernier, la cible du 23/11 est bien à venir elle aussi ; seule la plus proche est montrée.
    await seed('2026-11-23' as LocalDate, { kcal: 2300, proteinG: 190, fatG: 70, carbG: 230 });
    open();
    const r = await region();
    const lines = await within(r).findAllByText(isUpcoming);
    expect(lines).toHaveLength(1);
    expect(norm(lines[0]?.textContent)).toContain('lundi 16/11');
  });

  it('aucune cible future : pas de ligne « À partir du »', async () => {
    await seed(TODAY, CURRENT);
    open();
    const r = await region();
    await within(r).findByText(/En vigueur depuis/);
    expect(within(r).queryByText(/À partir du/)).not.toBeInTheDocument();
  });
});

describe('ERGO-03 critère 2 : cible non pré-remplie', () => {
  it('aucun champ à l’ouverture ; « Modifier ma cible » déplie le formulaire, champs vides', async () => {
    await seed(TODAY, CURRENT);
    open();
    const r = await region();
    const button = await within(r).findByRole('button', { name: 'Modifier ma cible' });
    expect(within(r).queryByLabelText('Calories (kcal)')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['Calories (kcal)', 'Protéines (g)', 'Lipides (g)', 'Glucides (g)']) expect(within(r).getByLabelText(label)).toHaveValue(null);
  });

  it('sans cible : le bouton s’appelle « Fixer ma cible »', async () => {
    open();
    const r = await region();
    expect(await within(r).findByRole('button', { name: 'Fixer ma cible' })).toBeInTheDocument();
  });
});

describe('ERGO-03 critère 3 : une cible du jour qui passerait devant une cible future demande une confirmation explicite', () => {
  const fillAndSave = async (r: HTMLElement) => {
    fireEvent.click(await within(r).findByRole('button', { name: 'Modifier ma cible' }));
    const fill = (label: string, value: string) => fireEvent.change(within(r).getByLabelText(label), { target: { value } });
    fill('Calories (kcal)', '2700');
    fill('Protéines (g)', '150');
    fill('Lipides (g)', '80');
    fill('Glucides (g)', '345');
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la cible' }));
  };

  it('Annuler : rien n’est écrit ; Enregistrer quand même : la cible du jour est écrite', async () => {
    await seed(TODAY, CURRENT);
    await seed(FUTURE, UPCOMING);
    open();
    const r = await region();
    await fillAndSave(r);
    const dialog = await screen.findByRole('alertdialog');
    expect(norm(dialog.textContent)).toContain('Elle passera devant la cible prévue à partir du lundi 16/11 ([retiré] kcal)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await (await db.data.repos.nutritionTargets()).list()).toHaveLength(2);
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la cible' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Enregistrer quand même' }));
    await waitFor(async () => expect(await (await db.data.repos.nutritionTargets()).list()).toHaveLength(3));
    expect((await (await db.data.repos.nutritionTargets()).effective(TODAY))?.target.kcal).toBe(2700);
  });

  it('sans cible future : enregistrée sans confirmation', async () => {
    await seed(TODAY, CURRENT);
    open();
    const r = await region();
    await fillAndSave(r);
    expect(await within(r).findByText('Cible enregistrée.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('ERGO-03 revue 1 (point 2) : cible future et saisie sous 1 200 kcal', () => {
  it('la confirmation D-296 est demandée une seule fois pour la même saisie, puis le plancher', async () => {
    await seed(TODAY, CURRENT);
    await seed(FUTURE, UPCOMING);
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Modifier ma cible' }));
    const fill = (label: string, value: string) => fireEvent.change(within(r).getByLabelText(label), { target: { value } });
    fill('Calories (kcal)', '1100');
    fill('Protéines (g)', '150');
    fill('Lipides (g)', '40');
    fill('Glucides (g)', '80');
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la cible' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Enregistrer quand même' }));
    fireEvent.click(await within(r).findByRole('checkbox', { name: 'Je confirme une cible sous 1 200 kcal' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la cible' }));
    await waitFor(async () => expect(await (await db.data.repos.nutritionTargets()).list()).toHaveLength(3));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('ERGO-03 critère 4 : jours de repos', () => {
  it('section titrée « Jours de repos » ; jours de repos en toutes lettres', async () => {
    await seed(TODAY, CURRENT, { rest: { kcal: 2400, proteinG: 150, fatG: 80, carbG: 270 }, trainingDays: [1, 2, 4, 5, 6] });
    open();
    const r = await region();
    const section = await within(r).findByRole('region', { name: 'Jours de repos' });
    expect(within(section).getByRole('switch', { name: 'Cible des jours de repos' })).toBeChecked();
    expect(await within(section).findByText('Repos le mercredi et le dimanche')).toBeInTheDocument();
  });
});

describe('ERGO-03 critère 5 : groupes et une ligne par réglage', () => {
  it('titres Style / Objectif / Cible / Jours de repos / Historique dans cet ordre', async () => {
    await seed(TODAY, CURRENT);
    open();
    const r = await region();
    await within(r).findByRole('heading', { name: 'Historique' });
    const titles = within(r)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent ?? '')
      .filter((t) => ['Style', 'Objectif', 'Cible', 'Jours de repos', 'Historique'].includes(t));
    expect(titles).toEqual(['Style', 'Objectif', 'Cible', 'Jours de repos', 'Historique']);
  });

  it('chaque réglage est une ligne « étiquette : valeur » qui déplie son réglage', async () => {
    open();
    const r = await region();
    const style = await within(r).findByRole('button', { name: 'Style du check-in : Collaboratif' });
    expect(within(r).getByRole('button', { name: 'Jour du check-in : lundi' })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Objectif : Maintien' })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Niveau d’activité : Non déclaré' })).toBeInTheDocument();
    expect(style).toHaveAttribute('aria-expanded', 'false');
    expect(within(r).queryByRole('radio', { name: 'Manuel' })).not.toBeInTheDocument();
    fireEvent.click(style);
    fireEvent.click(within(r).getByRole('radio', { name: 'Manuel' }));
    expect(await within(r).findByRole('button', { name: 'Style du check-in : Manuel' })).toBeInTheDocument();
  });
});

describe('ERGO-03 critère 7 : lignes ≥ 44 pt et très grand texte sans coupure', () => {
  const css = readFileSync(resolve(__dirname, 'NutritionScreen.css'), 'utf8');
  const rule = (selector: string): string => new RegExp(`\\n${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  it('ligne de réglage : hauteur minimale des cibles, retour à la ligne', () => {
    const row = rule('.ct-strategy__row');
    expect(row).toContain('min-height: var(--ct-hit-target-min)');
    expect(row).toContain('flex-wrap: wrap');
    expect(rule('.ct-strategy__value')).toContain('overflow-wrap: anywhere');
    expect(rule('.ct-strategy__upcoming')).toContain('overflow-wrap: anywhere');
  });
});

describe('ERGO-03 qa-test : cas limites', () => {
  it('objectif de perte : la ligne porte la vitesse (« Perte · 0,25 kg / semaine »)', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Objectif : Maintien' }));
    fireEvent.click(within(r).getByRole('radio', { name: 'Perte' }));
    expect(await within(r).findByRole('button', { name: 'Objectif : Perte · 0,25 kg / semaine' })).toBeInTheDocument();
  });

  it('une seule ligne ouverte à la fois', async () => {
    open();
    const r = await region();
    const style = await within(r).findByRole('button', { name: /^Style du check-in/ });
    const day = within(r).getByRole('button', { name: /^Jour du check-in/ });
    fireEvent.click(style);
    fireEvent.click(day);
    expect(style).toHaveAttribute('aria-expanded', 'false');
    expect(day).toHaveAttribute('aria-expanded', 'true');
  });

  it('sans cible : la section Jours de repos le dit, sans interrupteur', async () => {
    open();
    const r = await region();
    const section = await within(r).findByRole('region', { name: 'Jours de repos' });
    expect(within(section).getByText('Fixe d’abord ta cible : la cible des jours de repos part d’elle.')).toBeInTheDocument();
    expect(within(section).queryByRole('switch')).not.toBeInTheDocument();
  });

  it('cible future masquée par une décision plus récente (D-82) : ni ligne « À partir du », ni confirmation', async () => {
    await seed(FUTURE, UPCOMING);
    await seed(TODAY, CURRENT);
    open();
    const r = await region();
    await within(r).findByText(/En vigueur depuis/);
    expect(within(r).queryByText(/À partir du/)).not.toBeInTheDocument();
  });
});
