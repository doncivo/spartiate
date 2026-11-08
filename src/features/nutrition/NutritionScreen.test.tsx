import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { MealEntryDraft } from '../../domain/nutrition';
import { addDays } from '../../domain/localDate';
import type { DeviceId, LocalDate, LocalTime } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { NutritionScreen } from './NutritionScreen';
import { quickAddDraft, saveManualTarget, saveNutritionPrefs } from './useCases';

/**
 * I4-03 : onglet Nutrition (journal, recherche locale, Quick Add, dashboard, stratégie, check-in). Base SQLite réelle (wasm), horloge
 * manuelle : lundi 9 novembre 2026, midi à Paris. Sans IA, sans réseau : scan et photo ne sont pas offerts (état « plus tard »).
 */
const DEVICE = '60000000-0000-4000-8000-0000000000d2' as DeviceId;
const TODAY = '2026-11-09' as LocalDate;
const d = (offset: number): LocalDate => addDays(TODAY, offset);
let db: TestDb;

const open = (screenId?: 'journal' | 'dashboard' | 'strategy' | 'checkin') => {
  act(() => useNavigationStore.getState().navigate((screenId ? { tab: 'nutrition', screen: screenId } : { tab: 'nutrition' }) as Route));
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data });
  return render(
    <AppContainerProvider container={container}>
      <NutritionScreen />
    </AppContainerProvider>,
  );
};
const region = () => screen.findByRole('region', { name: 'Nutrition' });
/** Le texte du DOM est normalisé par Testing Library (espaces fines insécables comprises) : même normalisation côté attendu. */
const fr = (n: number): string => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, '2026-11-09T11:00:00.000Z');
});
afterEach(async () => {
  cleanup();
  await db.close();
});

async function seedQuick(date: LocalDate, time: string, kcal: number, name = 'Repas'): Promise<void> {
  await (await db.data.repos.mealEntries()).create(quickAddDraft({ date, time: time as LocalTime, name, kcal, proteinG: 20, fatG: 10, carbG: 50 }));
}

/** 28 jours complets (3 entrées sur 12 h, 2 400 kcal), une pesée tous les deux jours, profil et activité déclarés, cible en vigueur. */
async function seedHistory(): Promise<void> {
  const drafts: MealEntryDraft[] = [];
  for (let i = -28; i <= -1; i += 1) {
    for (const time of ['07:00', '13:00', '19:00']) drafts.push(quickAddDraft({ date: d(i), time: time as LocalTime, name: 'Repas', kcal: 800, proteinG: 50, fatG: 25, carbG: 100 }));
  }
  await db.data.transaction(async (repos) => {
    await (await repos.mealEntries()).createMany(drafts);
  });
  const weights = await db.data.repos.bodyWeights();
  for (let i = -28; i <= -1; i += 2) await weights.saveManual({ date: d(i), kg: 80, timezone: 'Europe/Paris' }, TODAY);
  await (await db.data.repos.profile()).save({ sex: 'male', birthYear: 1990, heightCm: 180 }, 2026);
  await saveNutritionPrefs(db.data, { activity: 'moderate', style: 'collaborative', goal: { kind: 'maintain' }, checkInWeekday: 1 });
  await saveManualTarget(db.data, { weekStart: d(-14), target: { kcal: 2400, proteinG: 170, fatG: 75, carbG: 261 }, lowFloorConfirmed: false });
}

describe('I4-03 : Journal : états de la journée, sans faux zéro (critère 1)', () => {
  it('journée sans entrée : « Rien de saisi », aucune cible, aucun chiffre à zéro, scan annoncé comme plus tard', async () => {
    open();
    const r = await region();
    expect(await within(r).findByText('Rien de saisi aujourd’hui')).toBeInTheDocument();
    expect(within(r).getByText('Une journée sans entrée n’est pas comptée comme zéro.')).toBeInTheDocument();
    expect(within(r).getByText('Aucune cible définie')).toBeInTheDocument();
    expect(within(r).getByText('Scan du code-barres : disponible plus tard.')).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: 'Scanner' })).toBeNull();
    expect(r.textContent ?? '').not.toMatch(/(^|\D)0 kcal/);
  });

  it('une entrée : journée partielle, total loggé et macros inconnues en « — », provenance visible', async () => {
    await (await db.data.repos.mealEntries()).create(quickAddDraft({ date: TODAY, time: '07:10' as LocalTime, name: 'Café crème', kcal: 90, proteinG: null, fatG: null, carbG: null }));
    open();
    const r = await region();
    expect(await within(r).findByText('Café crème')).toBeInTheDocument();
    expect(within(r).getByText('Journée partielle')).toBeInTheDocument();
    expect(within(r).getByText('Saisie manuelle')).toBeInTheDocument();
    expect(within(r).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('trois entrées sur 8 h : journée complète déduite', async () => {
    await seedQuick(TODAY, '07:00', 500);
    await seedQuick(TODAY, '12:00', 700);
    await seedQuick(TODAY, '19:00', 800);
    open();
    const r = await region();
    expect(await within(r).findByText('Journée complète (déduite)')).toBeInTheDocument();
  });

  it('avec une cible : calories restantes, dépassement dit', async () => {
    await saveManualTarget(db.data, { weekStart: d(-1), target: { kcal: 2000, proteinG: 150, fatG: 60, carbG: 200 }, lowFloorConfirmed: false });
    await seedQuick(TODAY, '08:00', 600);
    open();
    const r = await region();
    expect(await within(r).findByText(`${fr(1400)} kcal restantes`)).toBeInTheDocument();
  });

  it('navigation de jour : la veille est vide sans effacer aujourd’hui', async () => {
    await seedQuick(TODAY, '08:00', 600, 'Porridge');
    open();
    const r = await region();
    await within(r).findByText('Porridge');
    fireEvent.click(within(r).getByRole('button', { name: 'Jour précédent' }));
    expect(await within(r).findByText('Rien de saisi ce jour-là')).toBeInTheDocument();
    expect(within(r).queryByText('Porridge')).toBeNull();
    fireEvent.click(within(r).getByRole('button', { name: 'Jour suivant' }));
    expect(await within(r).findByText('Porridge')).toBeInTheDocument();
  });
});

describe('I4-03 : Recherche locale (critère 2) : récents, Perso, Ciqual ; grammes ou portions ; correction avant enregistrement', () => {
  async function seedPersonalFood(): Promise<string> {
    const foods = await db.data.repos.foods();
    const record = await foods.create({ source: 'custom', barcode: null, name: 'Skyr maison', brand: null, per100g: { kcal: 60, proteinG: 11, fatG: 0.2, carbG: 4, fiberG: null }, fetchedAt: null });
    await foods.addPortion(record.id, { label: 'pot', grams: 150 });
    return record.id;
  }

  it('fiche perso : choix de la portion, totaux recalculés, grammes corrigeables, ajout après confirmation', async () => {
    await seedPersonalFood();
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'skyr' } });
    const hit = await screen.findByRole('button', { name: /Skyr maison/ });
    expect(within(hit).getByText('Perso')).toBeInTheDocument();
    fireEvent.click(hit);
    fireEvent.click(await screen.findByRole('button', { name: 'pot · 150 g' }));
    expect(screen.getByLabelText('Quantité (g)')).toHaveValue(150);
    expect(screen.getByText('90 kcal')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantité (g)'), { target: { value: '200' } });
    expect(screen.getByText('120 kcal')).toBeInTheDocument();
    // Rien n'est enregistré avant la confirmation.
    expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Heure'), { target: { value: '08:15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au journal' }));
    await waitFor(async () => expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(1));
    const [saved] = await (await db.data.repos.mealEntries()).listByDate(TODAY);
    expect(saved).toMatchObject({ foodName: 'Skyr maison', source: 'custom', method: 'search', grams: 200, kcal: 120, time: '08:15' });
    expect(await within(await region()).findByText('Skyr maison')).toBeInTheDocument();
  });

  it('Ciqual : la provenance est affichée sur le résultat et dans le journal', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'banane' } });
    const hits = await screen.findAllByRole('button', { name: /Banane/i });
    expect(within(hits[0] as HTMLElement).getByText('Ciqual')).toBeInTheDocument();
    fireEvent.click(hits[0] as HTMLElement);
    fireEvent.change(await screen.findByLabelText('Quantité (g)'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au journal' }));
    await waitFor(async () => expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(1));
    const [saved] = await (await db.data.repos.mealEntries()).listByDate(TODAY);
    expect(saved?.source).toBe('ciqual');
    expect(saved?.foodId).toMatch(/^ciqual:/);
  });

  it('grammes invalides : le bouton d’ajout est inactif et rien n’est écrit', async () => {
    await seedPersonalFood();
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'skyr' } });
    fireEvent.click(await screen.findByRole('button', { name: /Skyr maison/ }));
    fireEvent.change(await screen.findByLabelText('Quantité (g)'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Ajouter au journal' })).toBeDisabled();
  });

  it('aucun résultat : message clair et recours Ajout rapide, rien d’inventé', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Nom de l’aliment' }), { target: { value: 'zzzqqq' } });
    expect(await screen.findByText('Aucun aliment trouvé.')).toBeInTheDocument();
  });

  it('récents : un aliment déjà mangé est proposé sans taper', async () => {
    const id = await seedPersonalFood();
    await (await db.data.repos.mealEntries()).create({ date: d(-1), time: '08:00' as LocalTime, foodId: id, foodName: 'Skyr maison', source: 'custom', grams: 150, kcal: 90, proteinG: 16.5, fatG: 0.3, carbG: 6, method: 'search', confidence: null });
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    expect(await screen.findByText('Récents')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Skyr maison/ })).toBeInTheDocument();
  });
});

describe('I4-03 : Quick Add (critère 3)', () => {
  it('macros saisies, enregistrement seulement après « Ajouter », champs vides = inconnus (null)', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Ajout rapide' }));
    fireEvent.change(await screen.findByLabelText('Calories (kcal)'), { target: { value: '450' } });
    fireEvent.change(screen.getByLabelText('Protéines (g)'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Heure'), { target: { value: '12:30' } });
    expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(async () => expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(1));
    const [saved] = await (await db.data.repos.mealEntries()).listByDate(TODAY);
    expect(saved).toMatchObject({ method: 'quickadd', source: 'manual', kcal: 450, proteinG: 30, fatG: null, carbG: null, foodName: 'Ajout rapide', time: '12:30' });
  });

  it('calories absentes : refus dit, rien n’est écrit', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Ajout rapide' }));
    await screen.findByLabelText('Calories (kcal)');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Indique les calories (un nombre).')).toBeInTheDocument();
    expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(0);
  });
});

describe('I4-03 : Correction et suppression d’une entrée', () => {
  it('corriger les grammes recalcule les totaux ; la provenance est conservée', async () => {
    const foods = await db.data.repos.foods();
    const food = await foods.create({ source: 'custom', barcode: null, name: 'Riz maison', brand: null, per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28, fiberG: null }, fetchedAt: null });
    await (await db.data.repos.mealEntries()).create({ date: TODAY, time: '12:00' as LocalTime, foodId: food.id, foodName: 'Riz maison', source: 'custom', grams: 100, kcal: 130, proteinG: 2.7, fatG: 0.3, carbG: 28, method: 'search', confidence: null });
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Corriger Riz maison' }));
    fireEvent.change(await screen.findByLabelText('Quantité (g)'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    await waitFor(async () => expect((await (await db.data.repos.mealEntries()).listByDate(TODAY))[0]?.grams).toBe(250));
    expect((await (await db.data.repos.mealEntries()).listByDate(TODAY))[0]).toMatchObject({ kcal: 325, source: 'custom' });
  });

  it('corriger un Quick Add : calories modifiables', async () => {
    await seedQuick(TODAY, '16:30', 300, 'Shake');
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Corriger Shake' }));
    fireEvent.change(await screen.findByLabelText('Calories (kcal)'), { target: { value: '350' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la correction' }));
    await waitFor(async () => expect((await (await db.data.repos.mealEntries()).listByDate(TODAY))[0]?.kcal).toBe(350));
  });

  it('supprimer demande confirmation ; annuler ne change rien, confirmer retire la ligne', async () => {
    await seedQuick(TODAY, '16:30', 300, 'Shake');
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Supprimer Shake' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Annuler' }));
    expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(1);
    fireEvent.click(within(r).getByRole('button', { name: 'Supprimer Shake' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(async () => expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(0));
    expect(await within(r).findByText('Rien de saisi aujourd’hui')).toBeInTheDocument();
  });
});

describe('I4-03 : Dashboard (critère 5)', () => {
  it('sans données : valeurs « — » avec la cause, confiance « aucune », pas de faux zéro', async () => {
    open('dashboard');
    const r = await region();
    expect(await within(r).findByRole('heading', { name: 'Balance 7 jours' })).toBeInTheDocument();
    expect(within(r).getByText('Pas assez de jours complets pour une balance.')).toBeInTheDocument();
    expect(within(r).getByText('Aucune pesée : pas de tendance.')).toBeInTheDocument();
    expect(within(r).getByText('Dépense non estimée : renseigne ton profil et ton niveau d’activité.')).toBeInTheDocument();
    expect(within(r).getByText('Confiance : aucune')).toBeInTheDocument();
    expect(r.textContent ?? '').not.toMatch(/(^|\D)0 kcal/);
  });

  it('avec 4 semaines de données : balance, tendance, dépense, confiance et couverture', async () => {
    await seedHistory();
    open('dashboard');
    const r = await region();
    expect(await within(r).findByText(/Dépense estimée/)).toBeInTheDocument();
    expect(within(r).getByText('7 jours complets sur 7 · 3 pesées')).toBeInTheDocument();
    expect(within(r).getByText(/Confiance : (faible|moyenne|élevée)/)).toBeInTheDocument();
    expect(within(r).getByRole('img', { name: 'Tendance du poids sur 28 jours' })).toBeInTheDocument();
    expect(within(r).getByRole('img', { name: 'Calories des 7 derniers jours' })).toBeInTheDocument();
    expect(within(r).getByTestId('balance-value')).toBeInTheDocument();
  });

  it('un jour non loggé ne devient pas zéro : exclu de la balance, signalé', async () => {
    await seedHistory();
    await (await db.data.repos.mealEntries()).softDelete((await (await db.data.repos.mealEntries()).listByDate(d(-2)))[0]?.id ?? '');
    open('dashboard');
    const r = await region();
    expect(await within(r).findByText('6 jours complets sur 7 · 3 pesées')).toBeInTheDocument();
  });
});

describe('I4-03 : Stratégie et cibles (critère 6, D-74)', () => {
  it('valeurs par défaut D-74 : collaboratif, maintien, lundi, activité non déclarée', async () => {
    open('strategy');
    const r = await region();
    expect(await within(r).findByRole('radio', { name: 'Collaboratif' })).toBeChecked();
    expect(within(r).getByRole('radio', { name: 'Maintien' })).toBeChecked();
    expect(within(r).getByLabelText('Jour du check-in')).toHaveValue('1');
    expect(within(r).getByRole('radio', { name: 'Non déclaré' })).toBeChecked();
    expect(within(r).getByText('Aucune cible définie')).toBeInTheDocument();
  });

  it('changer le style et l’activité est conservé', async () => {
    open('strategy');
    const r = await region();
    fireEvent.click(await within(r).findByRole('radio', { name: 'Manuel' }));
    fireEvent.click(within(r).getByRole('radio', { name: 'Modéré' }));
    await waitFor(async () => {
      const prefs = (await import('./useCases')).loadNutritionSnapshot;
      const s = await prefs(db.data, TODAY);
      expect(s.prefs).toMatchObject({ style: 'manual', activity: 'moderate' });
    });
  });

  it('cible manuelle : enregistrée et tracée (manuelle, acceptée) ; sous 1 200 kcal, confirmation explicite', async () => {
    open('strategy');
    const r = await region();
    const fill = (label: string, value: string) => fireEvent.change(within(r).getByLabelText(label), { target: { value } });
    await within(r).findByLabelText('Calories (kcal)');
    fill('Calories (kcal)', '1100');
    fill('Protéines (g)', '120');
    fill('Lipides (g)', '40');
    fill('Glucides (g)', '70');
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la cible' }));
    expect(await within(r).findByText('Sous 1 200 kcal : confirme explicitement pour l’enregistrer.')).toBeInTheDocument();
    expect(await (await db.data.repos.nutritionTargets()).list()).toHaveLength(0);
    fireEvent.click(within(r).getByRole('checkbox', { name: 'Je confirme une cible sous 1 200 kcal' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer la cible' }));
    await waitFor(async () => expect(await (await db.data.repos.nutritionTargets()).list()).toHaveLength(1));
    expect((await (await db.data.repos.nutritionTargets()).list())[0]).toMatchObject({ source: 'manual', accepted: true });
    expect(await within(r).findByText(/Manuelle/)).toBeInTheDocument();
  });
});

describe('I4-03 : Check-in hebdomadaire (critère 6)', () => {
  it('0.7.1 point 8 : aucune donnée avant la fin de la semaine analysée : « Premier check-in », pas un check-in suspendu sur une semaine vide', async () => {
    await (await db.data.repos.bodyWeights()).saveManual({ date: TODAY, kg: 104, timezone: 'Europe/Paris' }, TODAY);
    open('checkin');
    const r = await region();
    expect(await within(r).findByText('Premier check-in : lundi 16 novembre')).toBeInTheDocument();
    expect(within(r).getByText(/Il analysera la semaine du 9 novembre au 15 novembre/)).toBeInTheDocument();
    expect(within(r).getByText(/au moins 4 jours complets et 2 pesées/)).toBeInTheDocument();
    expect(within(r).getByText(/Pour l’instant : Aucun jour complet sur 7 · 1 pesée/)).toBeInTheDocument();
    expect(within(r).queryByText('Check-in suspendu')).toBeNull();
  });

  it('données insuffisantes : suspendu, aucune cible proposée, aucune action d’acceptation', async () => {
    await (await db.data.repos.bodyWeights()).saveManual({ date: d(-3), kg: 104, timezone: 'Europe/Paris' }, TODAY);
    open('checkin');
    const r = await region();
    expect(await within(r).findByText('Check-in suspendu')).toBeInTheDocument();
    expect(within(r).getByText('Aucune cible proposée.')).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: /^Accepter/ })).toBeNull();
    expect(within(r).getByText(/pas assez de données|Il faut/i)).toBeInTheDocument();
  });

  it('proposition : Accepter enregistre la cible du moteur (auto, acceptée), puis relançable', async () => {
    await seedHistory();
    open('checkin');
    const r = await region();
    const accept = await within(r).findByRole('button', { name: /^Accepter/ });
    expect(within(r).getByRole('button', { name: 'Personnaliser' })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Refuser' })).toBeInTheDocument();
    expect(within(r).getByText(/Pourquoi/)).toBeInTheDocument();
    fireEvent.click(accept);
    expect(await within(r).findByText('Cible enregistrée.')).toBeInTheDocument();
    const list = await (await db.data.repos.nutritionTargets()).list();
    expect(list[0]).toMatchObject({ source: 'auto', accepted: true, weekStart: TODAY });
    expect(list[0]?.target.kcal).toBeGreaterThan(2400);
    expect(list[0]?.target.kcal).toBeLessThanOrEqual(2550);
    expect(within(r).getByRole('button', { name: 'Relancer le check-in' })).toBeInTheDocument();
  });

  it('Refuser : la cible en vigueur est conservée, la proposition est tracée, le check-in reste relançable', async () => {
    await seedHistory();
    open('checkin');
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Refuser' }));
    expect(await within(r).findByText('Proposition refusée : ta cible actuelle est conservée.')).toBeInTheDocument();
    const repo = await db.data.repos.nutritionTargets();
    expect((await repo.effective(TODAY))?.target.kcal).toBe(2400);
    expect((await repo.list())[0]).toMatchObject({ accepted: false });
    fireEvent.click(within(r).getByRole('button', { name: 'Relancer le check-in' }));
    expect(await within(r).findByRole('button', { name: /^Accepter/ })).toBeInTheDocument();
  });

  it('Personnaliser : valeurs d’Ali conservées (manuelle), écart au moteur signalé', async () => {
    await seedHistory();
    open('checkin');
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Personnaliser' }));
    fireEvent.change(await within(r).findByLabelText('Calories (kcal)'), { target: { value: '2800' } });
    expect(await within(r).findByText(/variation de plus de 150 kcal/)).toBeInTheDocument();
    fireEvent.click(within(r).getByRole('button', { name: 'Enregistrer ma cible' }));
    expect(await within(r).findByText('Cible enregistrée.')).toBeInTheDocument();
    expect((await (await db.data.repos.nutritionTargets()).list())[0]).toMatchObject({ source: 'manual', accepted: true, target: { kcal: 2800 } });
  });

  it('style manuel : aucune proposition du moteur', async () => {
    await seedHistory();
    await saveNutritionPrefs(db.data, { activity: 'moderate', style: 'manual', goal: { kind: 'maintain' }, checkInWeekday: 1 });
    open('checkin');
    const r = await region();
    expect(await within(r).findByText('Style manuel : le moteur ne propose rien.')).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: /^Accepter/ })).toBeNull();
  });
});

describe('I4-03 : Navigation et clavier PC', () => {
  it('les quatre sections sont des boutons radio, flèches pour passer de l’une à l’autre', async () => {
    open();
    const r = await region();
    const group = await within(r).findByRole('radiogroup', { name: 'Sections de Nutrition' });
    expect(within(group).getAllByRole('radio').map((x) => x.textContent)).toEqual(['Journal', 'Dashboard', 'Stratégie', 'Check-in']);
    fireEvent.keyDown(within(group).getByRole('radio', { name: 'Journal' }), { key: 'ArrowRight' });
    expect(await within(r).findByRole('heading', { name: 'Balance 7 jours' })).toBeInTheDocument();
  });

  it('Échap ferme la recherche sans rien enregistrer', async () => {
    open();
    const r = await region();
    fireEvent.click(await within(r).findByRole('button', { name: 'Rechercher un aliment' }));
    const box = await screen.findByRole('searchbox', { name: 'Nom de l’aliment' });
    fireEvent.keyDown(box, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('searchbox', { name: 'Nom de l’aliment' })).toBeNull());
    expect(await (await db.data.repos.mealEntries()).listByDate(TODAY)).toHaveLength(0);
  });
});
