import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeasurementKind } from '../../domain/bodyProgress';
import type { BodyGoal, Sex } from '../../domain/bodyProfile';
import { createHlcClock } from '../../domain/hlc';
import { addDays } from '../../domain/localDate';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { createFakePrivacyShield } from '../../platform/privacyShield';
import { PC_MEDIA_QUERY } from '../../ui/useLayout';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore } from '../app/navigation';
import { BodyProgress } from './BodyProgress';

/**
 * CORPS-0301c (BL-179 ; D-702 à D-709, D-715, D-716, D-718, D-719, D-745) : Progrès › Corps › Mesures. « cm » insécable, silhouette et
 * pastilles reliées par la même tendance, tendance colorée et dite en texte (silhouette iPhone, liste PC), courbe avec période et tour de
 * taille de Santé en pointillé, rythme par mois et poids sous la courbe, 4 ratios avec repères (D-745), symétrie, saisie guidée des 11 zones.
 * Valeurs inventées seulement ; calculs du domaine pur (src/domain/bodyProgress), non réécrits ici.
 */
const DEVICE = '60000000-0000-4000-8000-0000000003c1' as DeviceId;
const NOW = '2026-11-12T09:00:00.000Z';
const TODAY = '2026-11-12' as LocalDate;
let db: TestDb;
const D = (m: number, d: number): LocalDate => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` as LocalDate;

beforeAll(async () => {
  await import('./BodyProgress');
  await import('../../i18n/bodyProgressText');
});

function viewport(pc: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: pc && query === PC_MEDIA_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
const mount = () =>
  render(
    <AppContainerProvider container={createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, privacyShield: createFakePrivacyShield() })}>
      <BodyProgress part="measures" pickPhoto={() => Promise.resolve(null)} />
    </AppContainerProvider>,
  );

async function save(rows: ReadonlyArray<readonly [LocalDate, string, number]>): Promise<void> {
  const repo = await db.data.repos.measurements();
  for (const [day, kind, value] of rows) await repo.save(day, kind as MeasurementKind, value);
}
async function profile(input: { readonly goal?: BodyGoal | null; readonly sex?: Sex | null; readonly heightCm?: number | null }): Promise<void> {
  await (await db.data.repos.profile()).save(input, 2026);
}
async function weighIns(from: LocalDate, count: number, start = 82): Promise<void> {
  const repo = await db.data.repos.bodyWeights();
  for (let i = 0; i < count; i += 1) await repo.saveManual({ date: addDays(from, i), kg: start - i * 0.05, timezone: 'Europe/Paris' }, TODAY);
}
/** Tour de taille en baisse sur 4 semaines, hanches en hausse : de quoi colorer deux zones et laisser les autres grises. */
const TREND_ROWS = [
  [D(10, 12), 'waist', 88.5],
  [D(11, 9), 'waist', 86.5],
  [D(10, 12), 'hips', 97],
  [D(11, 9), 'hips', 98],
] as const;

beforeEach(async () => {
  useNavigationStore.setState(INITIAL_NAVIGATION);
  db = await openBaseDb(DEVICE, NOW);
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('aucune requête réseau attendue'))));
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await db.close();
});

const css = readFileSync('src/features/bodyProgress/BodyProgress.css', 'utf8');
const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`règle absente : ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

describe('D-703 : « cm » ne se coupe plus à côté du champ', () => {
  it('l’unité est insécable et ne rétrécit pas ; le champ peut rétrécir à sa place', () => {
    expect(rule('.ct-bodyprogress__unit')).toContain('white-space: nowrap');
    expect(rule('.ct-bodyprogress__unit')).toContain('flex: 0 0 auto');
    expect(rule('.ct-bodyprogress__value .ct-bodyprogress__input')).toContain('min-width: 0');
  });
});

describe('iPhone : silhouette et pastilles reliées, colorées par la tendance (D-704, D-705, D-716)', () => {
  beforeEach(() => viewport(false));

  it('chaque point de la silhouette et la pastille de la même zone portent la même tendance ; vert, orange, gris selon l’objectif « perte »', async () => {
    await save(TREND_ROWS);
    await profile({ goal: 'loss' });
    const view = mount();
    const group = await screen.findByRole('radiogroup', { name: 'Zone' });
    const tone = (zone: string) => view.container.querySelector(`[data-zone="${zone}"]`)?.getAttribute('data-tone');
    await waitFor(() => expect(tone('waist')).toBe('favorable'));
    expect(tone('hips')).toBe('unfavorable');
    expect(tone('neck')).toBe('neutral');
    for (const radio of within(group).getAllByRole('radio')) {
      const zone = radio.getAttribute('data-zone');
      expect(zone).not.toBeNull();
      expect(radio.getAttribute('data-tone'), String(zone)).toBe(tone(zone ?? ''));
    }
  });

  it('toucher une pastille choisit la zone sur la silhouette, et l’inverse ; la tendance de la zone choisie est dite en texte', async () => {
    await save(TREND_ROWS);
    await profile({ goal: 'loss' });
    const view = mount();
    expect(await screen.findByText('Tendance : en baisse, vers l’objectif')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Hanches' }));
    expect(await screen.findByRole('img', { name: 'Silhouette, zone Hanches sélectionnée' })).toBeInTheDocument();
    expect(screen.getByText('Tendance : en hausse, à l’inverse')).toBeInTheDocument();
    fireEvent.click(view.container.querySelector('[data-zone="neck"]') as Element);
    expect(screen.getByRole('radio', { name: 'Cou' })).toBeChecked();
    expect(screen.getByText('Tendance : pas assez de mesures')).toBeInTheDocument();
  });

  it('légende sous la silhouette : trois couleurs dites en mots, et l’objectif du profil', async () => {
    await save(TREND_ROWS);
    await profile({ goal: 'loss' });
    mount();
    const legend = await screen.findByRole('list', { name: 'Légende des couleurs' });
    expect(within(legend).getByText('vers ton objectif')).toBeInTheDocument();
    expect(within(legend).getByText('à l’inverse de ton objectif')).toBeInTheDocument();
    expect(within(legend).getByText('stable ou pas assez de mesures')).toBeInTheDocument();
    expect(screen.getByText('Couleurs selon l’objectif du profil : perte.')).toBeInTheDocument();
  });

  it('objectif du profil non renseigné : toutes les zones grises, la légende le dit, le sens reste dit en texte', async () => {
    await save(TREND_ROWS);
    const view = mount();
    expect(await screen.findByText('Objectif du profil non renseigné (Plus › Profil) : toutes les zones restent en gris.')).toBeInTheDocument();
    expect(view.container.querySelector('[data-zone="waist"]')?.getAttribute('data-tone')).toBe('neutral');
    expect(screen.getByText('Tendance : en baisse')).toBeInTheDocument();
  });
});

describe('PC : la liste des zones porte la tendance (D-719)', () => {
  beforeEach(() => viewport(true));

  it('chaque ligne a une marque et un mot ; la liste et ses flèches restent ; pas de silhouette ajoutée', async () => {
    await save(TREND_ROWS);
    await profile({ goal: 'loss' });
    mount();
    expect(await screen.findByRole('heading', { name: 'Zones · dernière · 4 sem.' })).toBeInTheDocument();
    const waist = await screen.findByRole('radio', { name: 'Tour de taille' });
    await waitFor(() => expect(waist).toHaveAccessibleDescription(/en baisse, vers l’objectif/));
    expect(screen.getByRole('radio', { name: 'Hanches' })).toHaveAccessibleDescription(/en hausse, à l’inverse/);
    // Zone sans mesure : « aucune mesure » dit déjà pourquoi elle est grise (description de FIX-0241 inchangée).
    expect(screen.getByRole('radio', { name: 'Cou' })).toHaveAccessibleDescription('aucune mesure pas d’écart sur 4 semaines');
    expect(screen.getByRole('radio', { name: 'Cou' }).getAttribute('data-tone')).toBe('neutral');
    expect(waist.getAttribute('data-tone')).toBe('favorable');
    expect(screen.queryByRole('img', { name: /Silhouette/ })).toBeNull();
    expect(screen.getByRole('list', { name: 'Légende des couleurs' })).toBeInTheDocument();
  });
});

describe('courbe avec période (D-706, D-718)', () => {
  beforeEach(() => viewport(false));
  const LONG = [
    [D(5, 1), 'waist', 92],
    [D(7, 1), 'waist', 90],
    [D(10, 12), 'waist', 88.5],
    [D(11, 9), 'waist', 86.5],
  ] as const;

  it('4 sem. · 3 mois · 6 mois · Tout ; 3 mois par défaut ; la courbe suit la période choisie', async () => {
    await save(LONG);
    mount();
    const periods = await screen.findByRole('radiogroup', { name: 'Période de la courbe' });
    expect(within(periods).getAllByRole('radio').map((r) => r.textContent)).toEqual(['4 sem.', '3 mois', '6 mois', 'Tout']);
    expect(within(periods).getByRole('radio', { name: '3 mois' })).toBeChecked();
    expect(screen.getByRole('img', { name: 'Tour de taille : de 88,5 à 86,5 cm' })).toBeInTheDocument();
    fireEvent.click(within(periods).getByRole('radio', { name: 'Tout' }));
    expect(await screen.findByRole('img', { name: 'Tour de taille : de 92 à 86,5 cm' })).toBeInTheDocument();
    fireEvent.click(within(periods).getByRole('radio', { name: '6 mois' }));
    expect(await screen.findByRole('img', { name: 'Tour de taille : de 90 à 86,5 cm' })).toBeInTheDocument();
    fireEvent.click(within(periods).getByRole('radio', { name: '4 sem.' }));
    expect(await screen.findByText('Moins de deux mesures sur cette période : choisis une période plus longue.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Tour de taille : de / })).toBeNull();
  });

  it('tour de taille importé de Santé en pointillé sur la courbe du tour de taille seulement, avec sa légende', async () => {
    await save([...LONG, [D(10, 20), 'health_waist_cm', 87], [D(11, 5), 'health_waist_cm', 86]]);
    const view = mount();
    await screen.findByRole('img', { name: 'Tour de taille : de 88,5 à 86,5 cm' });
    expect(view.container.querySelector('.ct-bodyprogress__curveoverlay')).not.toBeNull();
    expect(screen.getByText('Pointillé : tour de taille importé de Santé.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Hanches' }));
    await waitFor(() => expect(view.container.querySelector('.ct-bodyprogress__curveoverlay')).toBeNull());
    expect(screen.queryByText('Pointillé : tour de taille importé de Santé.')).toBeNull();
  });

  it('sous la courbe : rythme par mois de la zone et évolution du poids sur la même période', async () => {
    await save(LONG);
    await weighIns(D(10, 20), 20);
    mount();
    expect(await screen.findByText('Rythme : −2,2 cm par mois')).toBeInTheDocument();
    expect(screen.getByText(/^Poids \(tendance des pesées\) : −\d+(,\d)? kg du 20 oct\. 2026 au 8 nov\. 2026$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '4 sem.' }));
    expect(await screen.findByText('Rythme par mois : inconnu (au moins 2 mesures sur 14 jours dans la période).')).toBeInTheDocument();
  });

  it('poids : tendance en apprentissage dite comme telle, aucune pesée dite, jamais 0', async () => {
    await save(LONG);
    const first = mount();
    expect(await screen.findByText('Poids : aucune pesée enregistrée.')).toBeInTheDocument();
    first.unmount();
    await weighIns(D(11, 1), 3);
    mount();
    expect(await screen.findByText('Poids : tendance en apprentissage (3 pesées sur 14).')).toBeInTheDocument();
  });
});

describe('ratios avec repères (D-707, D-715, D-745)', () => {
  beforeEach(() => viewport(false));
  const BODY = [
    [D(10, 12), 'waist', 88.5],
    [D(11, 9), 'waist', 86.5],
    [D(11, 9), 'hips', 98],
    [D(11, 9), 'chest', 110],
    [D(11, 9), 'shoulders', 120],
  ] as const;
  const row = (region: HTMLElement, name: string) => within(within(region).getByText(name).closest('li') as HTMLElement);

  it('les 4 ratios, valeur au centième, évolution sur la période, repère et mention de chacun (homme, hauteur du profil)', async () => {
    await save(BODY);
    await profile({ sex: 'male', heightCm: 180, goal: 'loss' });
    mount();
    const region = await screen.findByRole('region', { name: 'Ratios' });
    const wh = row(region, 'Taille / hauteur');
    expect(wh.getByText('0,48')).toBeInTheDocument();
    expect(wh.getByText('−0,01 depuis le 12 oct. 2026')).toBeInTheDocument();
    expect(wh.getByText('Repère NICE : bande saine (0,40 à 0,49)')).toBeInTheDocument();
    expect(wh.getByText('Non valable si IMC ≥ 35.')).toBeInTheDocument();
    expect(wh.getByText('hauteur du profil : 180 cm')).toBeInTheDocument();
    const whips = row(region, 'Taille / hanches');
    expect(whips.getByText('0,88')).toBeInTheDocument();
    expect(whips.getByText('Repère OMS : sous 0,90 (homme), sous le repère')).toBeInTheDocument();
    expect(whips.getByText('Repère établi sur des populations européennes.')).toBeInTheDocument();
    expect(whips.getByText('évolution sur la période : inconnue')).toBeInTheDocument();
    const cw = row(region, 'Poitrine / taille');
    expect(cw.getByText('1,27')).toBeInTheDocument();
    expect(cw.getByText('Repère esthétique : environ 1,30 à 1,35 chez l’homme, en dessous')).toBeInTheDocument();
    expect(cw.getByText('Esthétique, sans valeur santé.')).toBeInTheDocument();
    const sw = row(region, 'Épaules / taille');
    expect(sw.getByText('1,39')).toBeInTheDocument();
    expect(sw.getByText('Aucun repère : la valeur et son évolution seulement.')).toBeInTheDocument();
  });

  it('sans hauteur : « inconnu », jamais 0 ; sans sexe : le repère qui en dépend le dit', async () => {
    await save(BODY);
    mount();
    const region = await screen.findByRole('region', { name: 'Ratios' });
    expect(row(region, 'Taille / hauteur').getByText('inconnu : hauteur absente (Plus › Profil, ou Santé)')).toBeInTheDocument();
    expect(row(region, 'Taille / hanches').getByText('Repère selon le sexe : sexe du profil non renseigné (Plus › Profil).')).toBeInTheDocument();
    expect(within(region).queryByText(/^0(,0+)?$/)).toBeNull();
  });

  it('hauteur de Santé à défaut du profil, dite comme telle ; profil et Santé à plus de 2 cm : note', async () => {
    await save([...BODY, [D(11, 1), 'health_height_cm', 178]]);
    const first = mount();
    const region = await screen.findByRole('region', { name: 'Ratios' });
    expect(row(region, 'Taille / hauteur').getByText('hauteur importée de Santé : 178 cm')).toBeInTheDocument();
    first.unmount();
    await profile({ heightCm: 182 });
    mount();
    const again = await screen.findByRole('region', { name: 'Ratios' });
    expect(row(again, 'Taille / hauteur').getByText('hauteur du profil : 182 cm')).toBeInTheDocument();
    expect(row(again, 'Taille / hauteur').getByText('Hauteur du profil utilisée ; Santé indique une autre valeur.')).toBeInTheDocument();
  });

  it('mesures à plus de 7 jours d’écart : « inconnu », jamais un ratio mélangé', async () => {
    await save([
      [D(9, 1), 'hips', 98],
      [D(11, 9), 'waist', 86.5],
    ]);
    mount();
    const region = await screen.findByRole('region', { name: 'Ratios' });
    expect(row(region, 'Taille / hanches').getByText('inconnu : mesures à plus de 7 jours d’écart')).toBeInTheDocument();
    expect(row(region, 'Poitrine / taille').getByText('inconnu : mesure manquante')).toBeInTheDocument();
  });
});

describe('symétrie gauche / droite (D-708, D-718)', () => {
  beforeEach(() => viewport(true));

  it('écart en cm et en %, côté le plus grand, signalé au-delà de 2 % ; inconnu dit avec sa raison', async () => {
    await save([
      [D(11, 9), 'arm_left', 35],
      [D(11, 9), 'arm_right', 36],
      [D(11, 9), 'thigh_left', 58],
      [D(11, 9), 'thigh_right', 58.5],
      [D(11, 9), 'calf_left', 38],
    ]);
    mount();
    const region = await screen.findByRole('region', { name: 'Symétrie gauche / droite' });
    const arm = within(within(region).getByText('Bras').closest('li') as HTMLElement);
    expect(arm.getByText('écart 1 cm (2,8 %)')).toBeInTheDocument();
    expect(arm.getByText('côté droit plus grand')).toBeInTheDocument();
    expect(arm.getByText('Signalé : écart au-delà de 2 %.')).toBeInTheDocument();
    const thigh = within(within(region).getByText('Cuisses').closest('li') as HTMLElement);
    expect(thigh.getByText('écart 0,5 cm (0,9 %)')).toBeInTheDocument();
    expect(thigh.queryByText('Signalé : écart au-delà de 2 %.')).toBeNull();
    const calf = within(within(region).getByText('Mollets').closest('li') as HTMLElement);
    expect(calf.getByText('inconnu : un côté n’a pas encore de mesure')).toBeInTheDocument();
  });

  it('côtés mesurés à plus de 7 jours d’écart : « pas de mesure récente des deux côtés »', async () => {
    await save([
      [D(10, 12), 'calf_right', 38],
      [D(11, 9), 'calf_left', 38],
    ]);
    mount();
    const region = await screen.findByRole('region', { name: 'Symétrie gauche / droite' });
    expect(within(within(region).getByText('Mollets').closest('li') as HTMLElement).getByText('pas de mesure récente des deux côtés (7 jours au plus d’écart)')).toBeInTheDocument();
  });
});

describe('saisie guidée des 11 zones (D-709, D-719)', () => {
  beforeEach(() => viewport(false));
  const skip = () => fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
  const next = () => fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

  it('11 zones à la suite, conseil et dernière valeur ; Suivant enregistre à la date de la séance, Passer n’écrit rien ; résumé ; zone par zone ensuite', async () => {
    await save([[D(11, 9), 'waist', 86.5]]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Saisie guidée des 11 zones' }));
    const panel = await screen.findByRole('region', { name: 'Saisie guidée' });
    // Pendant la saisie guidée, le formulaire zone par zone laisse la place (jamais deux champs « Date »).
    expect(screen.queryByLabelText('Mesure (cm)')).toBeNull();
    fireEvent.change(within(panel).getByLabelText('Date de la séance'), { target: { value: '2026-11-10' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Commencer' }));
    expect(await within(panel).findByText('Zone 1 sur 11 : Cou')).toBeInTheDocument();
    expect(within(panel).getByText(/^Placement du mètre : /)).toBeInTheDocument();
    expect(within(panel).getByText('Aucune valeur précédente pour cette zone.')).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText('Cou, mesure (cm)'), { target: { value: '38' } });
    next();
    expect(await within(panel).findByText('Zone 2 sur 11 : Épaules')).toBeInTheDocument();
    skip();
    expect(await within(panel).findByText('Zone 3 sur 11 : Poitrine')).toBeInTheDocument();
    skip();
    expect(await within(panel).findByText('Zone 4 sur 11 : Tour de taille')).toBeInTheDocument();
    expect(within(panel).getByText('Dernière valeur : 86,5 cm le 9 nov. 2026')).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText('Tour de taille, mesure (cm)'), { target: { value: '85' } });
    next();
    expect(await within(panel).findByText('Zone 5 sur 11 : Hanches')).toBeInTheDocument();
    for (let i = 5; i <= 11; i += 1) skip();
    expect(await within(panel).findByText('Séance du 10 nov. 2026 terminée')).toBeInTheDocument();
    expect(within(panel).getByText('Enregistrées : 2 · passées : 9.')).toBeInTheDocument();
    const repo = await db.data.repos.measurements();
    expect((await repo.list('neck')).map((m) => [m.day, m.value])).toEqual([['2026-11-10', 38]]);
    expect((await repo.list('waist')).map((m) => [m.day, m.value])).toEqual([
      ['2026-11-09', 86.5],
      ['2026-11-10', 85],
    ]);
    expect(await repo.list('shoulders')).toEqual([]);
    fireEvent.click(within(panel).getByRole('button', { name: 'Terminer' }));
    expect(await screen.findByLabelText('Mesure (cm)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saisie guidée des 11 zones' })).toBeInTheDocument();
  });

  it('relecture : focus sur le titre au résumé, puis sur « Saisie guidée des 11 zones » à la fermeture ; « Arrêter » inactif pendant un enregistrement', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Saisie guidée des 11 zones' }));
    const panel = await screen.findByRole('region', { name: 'Saisie guidée' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Commencer' }));
    await within(panel).findByText('Zone 1 sur 11 : Cou');
    expect(within(panel).getByLabelText('Cou, mesure (cm)')).toHaveFocus();
    fireEvent.change(within(panel).getByLabelText('Cou, mesure (cm)'), { target: { value: '39' } });
    next();
    expect(within(panel).getByRole('button', { name: 'Arrêter la saisie guidée' })).toBeDisabled();
    await within(panel).findByText('Zone 2 sur 11 : Épaules');
    for (let i = 2; i <= 11; i += 1) skip();
    await within(panel).findByText(/^Séance du .* terminée$/);
    expect(within(panel).getByRole('heading', { name: 'Saisie guidée' })).toHaveFocus();
    fireEvent.click(within(panel).getByRole('button', { name: 'Terminer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saisie guidée des 11 zones' })).toHaveFocus());
  });

  it('mesure déjà saisie à cette date : rappelée, préremplie, puis remplacée (une seule ligne)', async () => {
    await save([[D(11, 10), 'neck', 37]]);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Saisie guidée des 11 zones' }));
    const panel = await screen.findByRole('region', { name: 'Saisie guidée' });
    fireEvent.change(within(panel).getByLabelText('Date de la séance'), { target: { value: '2026-11-10' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Commencer' }));
    expect(await within(panel).findByText('Déjà saisie à cette date : 37 cm. « Suivant » la remplace.')).toBeInTheDocument();
    const input = within(panel).getByLabelText('Cou, mesure (cm)') as HTMLInputElement;
    expect(input.value).toBe('37');
    fireEvent.change(input, { target: { value: '38,5' } });
    next();
    expect(await within(panel).findByText('Zone 2 sur 11 : Épaules')).toBeInTheDocument();
    expect((await (await db.data.repos.measurements()).list('neck')).map((m) => [m.day, m.value])).toEqual([['2026-11-10', 38.5]]);
  });

  it('valeur vide ou hors bornes : message, rien n’est écrit, la zone reste ; date future refusée ; arrêter garde ce qui est enregistré', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Saisie guidée des 11 zones' }));
    const panel = await screen.findByRole('region', { name: 'Saisie guidée' });
    fireEvent.change(within(panel).getByLabelText('Date de la séance'), { target: { value: '2026-11-20' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Commencer' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('La date ne peut pas être dans le futur.');
    fireEvent.change(within(panel).getByLabelText('Date de la séance'), { target: { value: '2026-11-12' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Commencer' }));
    await within(panel).findByText('Zone 1 sur 11 : Cou');
    next();
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Saisis une mesure en centimètres.');
    expect(within(panel).getByText('Zone 1 sur 11 : Cou')).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText('Cou, mesure (cm)'), { target: { value: '400' } });
    next();
    expect(await within(panel).findByRole('alert')).toHaveTextContent(/hors de la plage plausible/);
    fireEvent.change(within(panel).getByLabelText('Cou, mesure (cm)'), { target: { value: '39' } });
    next();
    await within(panel).findByText('Zone 2 sur 11 : Épaules');
    fireEvent.click(within(panel).getByRole('button', { name: 'Arrêter la saisie guidée' }));
    expect(await screen.findByLabelText('Mesure (cm)')).toBeInTheDocument();
    expect((await (await db.data.repos.measurements()).list('neck')).map((m) => [m.day, m.value])).toEqual([['2026-11-12', 39]]);
  });
});
