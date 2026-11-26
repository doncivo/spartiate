import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { PC_MEDIA_QUERY } from '../../ui';
import { AppContainerProvider } from './AppContainerContext';
import { createAppContainer } from './container';
import { INITIAL_NAVIGATION, useNavigationStore } from './navigation';
import { SectionNotice } from './SectionNotice';

/**
 * PROG-0301a (BL-177, D-700) : règle absolue d'Ali, « aucun bloc, aucune donnée et aucune fonction existante de Progrès ne disparaît ».
 * Liste figée et fermée : une entrée par ligne P-nn de la table de `docs/PROGRES-0301.md` (mêmes ID, même onglet, même sous-onglet de Corps).
 * Chaque entrée porte des repères vérifiables à l'écran (rôle et nom, ou texte du catalogue) ; le test monte Progrès, ouvre chaque onglet et
 * chaque sous-onglet de Corps et retrouve chaque repère dans le `tabpanel` voulu, sur le gabarit iPhone et sur le gabarit PC. Les éléments d'une
 * seule plateforme (P-13, P-14 iPhone ; P-15, P-30 PC) sont absents de l'autre, comme avant les onglets. Valeurs inventées uniquement.
 */

type TabLabel = 'Récup' | 'Séances' | 'Bilan' | 'Force' | 'Corps' | 'Activité';
type BodyLabel = 'Mesures' | 'Santé' | 'VISBODY' | 'Photos';
type Platform = 'both' | 'phone' | 'pc';
type Check =
  | { readonly role: 'region' | 'heading' | 'button' | 'img' | 'list' | 'checkbox' | 'radio' | 'textbox'; readonly name: string | RegExp; readonly count?: number }
  | { readonly text: string | RegExp }
  | { readonly label: string }
  | { readonly selector: string }
  /** P-28 : coche deux photos, puis attend « Côte à côte » et « Fermer la comparaison ». */
  | { readonly compare: true }
  /** Repère porté par un autre test (états, raccourci) : le fichier existe et nomme l'élément. */
  | { readonly elsewhere: string; readonly needle: string };

interface Entry {
  readonly id: string;
  readonly tab: TabLabel | 'chaque onglet' | 'Progrès';
  readonly body?: BodyLabel;
  readonly platform: Platform;
  readonly checks: readonly Check[];
}

const INVENTORY: readonly Entry[] = [
  { id: 'P-01', tab: 'Récup', platform: 'both', checks: [{ role: 'region', name: 'Tendances sur 30 jours' }, { text: 'Aucune mesure sur les 30 derniers jours.' }] },
  { id: 'P-02', tab: 'Récup', platform: 'both', checks: [{ role: 'region', name: 'Récupération : ce qui change ta Recovery' }, { text: /^Aucun jour renseigné/ }] },
  { id: 'P-03', tab: 'Séances', platform: 'both', checks: [{ role: 'region', name: 'Constance' }, { role: 'heading', name: /^Calendrier de / }] },
  { id: 'P-04', tab: 'Séances', platform: 'both', checks: [{ role: 'region', name: 'Adhérence' }, { text: /^Aucun programme suivi : l’adhérence/ }] },
  { id: 'P-05', tab: 'Séances', platform: 'both', checks: [{ role: 'heading', name: 'Prescriptions respectées' }] },
  { id: 'P-06', tab: 'Séances', platform: 'both', checks: [{ role: 'region', name: 'Volume par muscle' }, { text: /^Plage cible de séries difficiles/ }] },
  { id: 'P-07', tab: 'Séances', platform: 'both', checks: [{ role: 'region', name: 'Volume par muscle' }, { elsewhere: 'src/features/app/SectionNoticeProgress.inventory.test.tsx', needle: 'Les indicateurs d’entraînement n’ont pas pu être lus.' }] },
  { id: 'P-08', tab: 'Bilan', platform: 'both', checks: [{ role: 'region', name: 'Bilan de la semaine' }, { role: 'heading', name: /^Semaine du / }] },
  { id: 'P-09', tab: 'Bilan', platform: 'both', checks: [{ role: 'heading', name: 'Recommandations' }] },
  { id: 'P-10', tab: 'Bilan', platform: 'both', checks: [{ role: 'heading', name: 'Semaines précédentes' }, { role: 'button', name: /^Semaine du /, count: 6 }] },
  { id: 'P-11', tab: 'Bilan', platform: 'both', checks: [{ role: 'button', name: 'Exporter' }] },
  { id: 'P-12', tab: 'Force', platform: 'both', checks: [{ role: 'region', name: 'Strength Score' }, { text: 'Sexe non renseigné dans le profil : les normes dépendent du sexe.' }] },
  { id: 'P-13', tab: 'Corps', body: 'Mesures', platform: 'phone', checks: [{ role: 'img', name: 'Silhouette, zone Tour de taille sélectionnée' }] },
  { id: 'P-14', tab: 'Corps', body: 'Mesures', platform: 'phone', checks: [{ role: 'radio', name: 'Mollet droit' }, { text: 'Mollet D' }] },
  { id: 'P-15', tab: 'Corps', body: 'Mesures', platform: 'pc', checks: [{ role: 'heading', name: 'Zones · dernière · 4 sem.' }] },
  { id: 'P-16', tab: 'Corps', body: 'Mesures', platform: 'both', checks: [{ role: 'region', name: 'Mensurations' }, { text: '84' }, { text: /^-1,5 cm en 4 semaines$/ }, { text: /^dernière mesure le / }] },
  { id: 'P-17', tab: 'Corps', body: 'Mesures', platform: 'both', checks: [{ role: 'img', name: /^Tour de taille : de / }] },
  { id: 'P-18', tab: 'Corps', body: 'Mesures', platform: 'both', checks: [{ label: 'Date' }, { role: 'textbox', name: 'Mesure (cm)' }, { role: 'button', name: 'Enregistrer' }] },
  { id: 'P-19', tab: 'Corps', body: 'Mesures', platform: 'both', checks: [{ role: 'list', name: 'Relevés' }, { role: 'button', name: /^Supprimer la mesure du /, count: 2 }] },
  { id: 'P-20', tab: 'Corps', body: 'Santé', platform: 'both', checks: [{ role: 'region', name: 'Importé de Santé (Renpho)' }, { text: 'Masse grasse' }, { text: /^Valeurs lues dans Santé/ }] },
  { id: 'P-21', tab: 'Corps', body: 'VISBODY', platform: 'both', checks: [{ role: 'region', name: 'Bilans VISBODY' }, { text: 'Aucun bilan pour l’instant.' }] },
  { id: 'P-22', tab: 'Corps', body: 'VISBODY', platform: 'both', checks: [{ label: 'Date du bilan' }, { label: 'Masse grasse (%)' }, { role: 'button', name: 'Enregistrer le bilan' }] },
  { id: 'P-23', tab: 'Corps', body: 'VISBODY', platform: 'both', checks: [{ text: 'Mesures segmentaires (si présentes)' }, { label: 'Masse maigre, tronc (kg)' }] },
  { id: 'P-24', tab: 'Corps', body: 'Photos', platform: 'both', checks: [{ role: 'region', name: 'Photos de progression' }, { text: /^Les photos restent sur cet appareil/ }] },
  { id: 'P-25', tab: 'Corps', body: 'Photos', platform: 'both', checks: [{ role: 'button', name: 'Ajouter une photo' }] },
  { id: 'P-26', tab: 'Corps', body: 'Photos', platform: 'both', checks: [{ role: 'checkbox', name: /^Comparer la photo du /, count: 2 }] },
  { id: 'P-27', tab: 'Corps', body: 'Photos', platform: 'both', checks: [{ role: 'button', name: /^Supprimer la photo du /, count: 2 }] },
  { id: 'P-28', tab: 'Corps', body: 'Photos', platform: 'both', checks: [{ compare: true }] },
  { id: 'P-29', tab: 'Corps', body: 'Mesures', platform: 'both', checks: [{ role: 'region', name: 'Mensurations' }, { elsewhere: 'src/features/app/SectionNoticeProgress.inventory.test.tsx', needle: 'Lecture impossible. Réessaie.' }] },
  { id: 'P-30', tab: 'Corps', body: 'Mesures', platform: 'pc', checks: [{ selector: '.ct-bodyprogress--pc' }] },
  { id: 'P-31', tab: 'Activité', platform: 'both', checks: [{ role: 'region', name: 'Cardio' }, { text: 'Aucune séance de cardio sur les quatre dernières semaines.' }] },
  { id: 'P-32', tab: 'Activité', platform: 'both', checks: [{ role: 'region', name: 'Objectifs' }, { label: 'Pas par jour' }, { role: 'button', name: 'Enregistrer les objectifs' }] },
  { id: 'P-33', tab: 'Activité', platform: 'both', checks: [{ role: 'region', name: 'Pas par semaine' }] },
  { id: 'P-34', tab: 'Activité', platform: 'both', checks: [{ role: 'region', name: 'Cardio en zone 2' }, { text: 'Repère d’entraînement, pas un avis médical.' }] },
  { id: 'P-35', tab: 'Activité', platform: 'both', checks: [{ role: 'region', name: 'Notes du matin (30 jours)' }, { text: 'Fatigue : aucune note sur 30 jours' }] },
  { id: 'P-36', tab: 'Activité', platform: 'both', checks: [{ role: 'region', name: 'Suivis' }, { elsewhere: 'src/features/app/SectionNoticeProgress.inventory.test.tsx', needle: 'Lecture impossible des suivis.' }] },
  { id: 'P-37', tab: 'chaque onglet', platform: 'both', checks: [{ elsewhere: 'src/features/app/SectionNoticeProgress.failure.test.tsx', needle: 'P-37' }] },
  { id: 'P-38', tab: 'Progrès', platform: 'pc', checks: [{ elsewhere: 'src/features/app/navigation.progress.test.ts', needle: 'P-38' }] },
];

const TABS: readonly TabLabel[] = ['Récup', 'Séances', 'Bilan', 'Force', 'Corps', 'Activité'];
const BODY: readonly BodyLabel[] = ['Mesures', 'Santé', 'VISBODY', 'Photos'];
const DEVICE = '60000000-0000-4000-8000-0000000003a1' as DeviceId;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

/** Lignes P-nn de la table de correspondance de la fiche : ID, onglet, sous-onglet. */
function docRows(): ReadonlyArray<{ readonly id: string; readonly tab: string; readonly sub: string }> {
  const doc = readFileSync('docs/PROGRES-0301.md', 'utf8');
  return doc
    .split('\n')
    .filter((line) => /^\| P-\d\d \|/.test(line))
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim());
      return { id: cells[1] ?? '', tab: cells[4] ?? '', sub: cells[5] ?? '' };
    });
}

describe('PROG-0301a : liste figée P-01 à P-38 (fermée sur docs/PROGRES-0301.md)', () => {
  it('mêmes ID que la table, dans l’ordre ; même onglet ; même sous-onglet de Corps', () => {
    const rows = docRows();
    expect(rows.map((r) => r.id)).toEqual(INVENTORY.map((e) => e.id));
    expect(rows).toHaveLength(38);
    for (const entry of INVENTORY) {
      const row = rows.find((r) => r.id === entry.id);
      expect(row?.tab, entry.id).toBe(entry.tab);
      if (entry.body && entry.id !== 'P-29') expect(row?.sub.startsWith(entry.body), entry.id).toBe(true);
    }
  });

  it('chaque entrée a au moins un repère ; les repères portés ailleurs existent et nomment l’élément', () => {
    for (const entry of INVENTORY) {
      expect(entry.checks.length, entry.id).toBeGreaterThan(0);
      for (const check of entry.checks) {
        if (!('elsewhere' in check)) continue;
        expect(existsSync(check.elsewhere), `${entry.id} : ${check.elsewhere}`).toBe(true);
        expect(readFileSync(check.elsewhere, 'utf8'), entry.id).toContain(check.needle);
      }
    }
  });
});

const usePc = (pc: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: pc && query === PC_MEDIA_QUERY, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
};

/** Import à froid de l'hôte et des blocs avant les attentes (comme les autres tests de Progrès) : aucun délai allongé. */
async function warmBlocks(): Promise<void> {
  await Promise.all([
    import('./SectionNoticeProgress'),
    import('../recovery/RecoveryProgress'),
    import('../progress/TrainingProgress'),
    import('../progress/WeeklyReview'),
    import('../strength/StrengthScore'),
    import('../../../content/strength/standards.json'),
    import('../../../content/exercises/exercises.json'),
    import('../bodyProgress/BodyProgress'),
    import('../cardio/CardioProgress'),
    import('../tracking/TrackingProgress'),
  ]);
}

function mount(db: TestDb, data: TestDb['data'] = db.data) {
  const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data });
  return render(
    <AppContainerProvider container={container}>
      <SectionNotice tab="progress" />
    </AppContainerProvider>,
  );
}

async function openTab(tab: TabLabel, body?: BodyLabel): Promise<HTMLElement> {
  fireEvent.click(within(await screen.findByRole('tablist', { name: 'Progrès' })).getByRole('tab', { name: tab }));
  const panel = await screen.findByRole('tabpanel', { name: tab });
  if (!body) return panel;
  fireEvent.click(within(await within(panel).findByRole('tablist', { name: 'Corps' })).getByRole('tab', { name: body }));
  return within(panel).findByRole('tabpanel', { name: body });
}

async function expectCheck(panel: HTMLElement, check: Check, id: string): Promise<void> {
  const inside = within(panel);
  if ('elsewhere' in check) return;
  if ('role' in check) {
    const found = await inside.findAllByRole(check.role, { name: check.name });
    expect(found.length, `${id} : ${check.role} ${String(check.name)}`).toBe(check.count ?? found.length);
    expect(found.length, id).toBeGreaterThan(0);
    return;
  }
  if ('text' in check) {
    expect((await inside.findAllByText(check.text)).length, id).toBeGreaterThan(0);
    return;
  }
  if ('label' in check) {
    expect(await inside.findByLabelText(check.label), id).toBeInTheDocument();
    return;
  }
  if ('selector' in check) {
    expect(panel.querySelector(check.selector), id).not.toBeNull();
    return;
  }
  const boxes = await inside.findAllByRole('checkbox', { name: /^Comparer la photo du / });
  for (const box of boxes.slice(0, 2)) fireEvent.click(box);
  expect(await inside.findByRole('region', { name: 'Côte à côte' }), id).toBeInTheDocument();
  expect(inside.getByRole('button', { name: 'Fermer la comparaison' }), id).toBeInTheDocument();
}

/** Repère absent de la plateforme qui ne l'avait pas (P-13, P-14, P-15, P-30). */
function expectAbsent(panel: HTMLElement, check: Check, id: string): void {
  const inside = within(panel);
  if ('role' in check) expect(inside.queryAllByRole(check.role, { name: check.name }), id).toEqual([]);
  else if ('text' in check) expect(inside.queryAllByText(check.text), id).toEqual([]);
  else if ('selector' in check) expect(panel.querySelector(check.selector), id).toBeNull();
}

describe.each([
  ['iPhone', false],
  ['PC', true],
] as const)('PROG-0301a : rien ne disparaît de Progrès (%s)', (_name, pc) => {
  let db: TestDb;
  beforeAll(warmBlocks);
  beforeEach(async () => {
    usePc(pc);
    useNavigationStore.setState(INITIAL_NAVIGATION);
    db = await openBaseDb(DEVICE, '2026-11-04T08:00:00.000Z');
    // Valeurs inventées : deux tours de taille, une valeur importée de Santé, deux photos factices.
    const measures = await db.data.repos.measurements();
    await measures.save('2026-10-07' as LocalDate, 'waist', 85.5);
    await measures.save('2026-11-04' as LocalDate, 'waist', 84);
    await measures.save('2026-11-02' as LocalDate, 'health_body_fat_pct', 18.5);
    const photos = await db.data.repos.progressPhotos();
    await photos.add('2026-10-10' as LocalDate, JPEG);
    await photos.add('2026-11-03' as LocalDate, JPEG);
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await db.close();
  });

  it('6 onglets dans l’ordre, 4 sous-onglets de Corps ; chaque élément P-nn dans son tabpanel', async () => {
    mount(db);
    const list = await screen.findByRole('tablist', { name: 'Progrès' });
    expect(within(list).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([...TABS]);
    for (const tab of TABS) {
      for (const body of tab === 'Corps' ? BODY : [undefined]) {
        const panel = await openTab(tab, body);
        if (tab === 'Corps') expect(within(screen.getByRole('tablist', { name: 'Corps' })).getAllByRole('tab').map((t) => t.textContent)).toEqual([...BODY]);
        for (const entry of INVENTORY.filter((e) => e.tab === tab && e.body === body)) {
          const here = entry.platform === 'both' || (entry.platform === 'pc') === pc;
          for (const check of entry.checks) {
            if (here) await expectCheck(panel, check, entry.id);
            else expectAbsent(panel, check, entry.id);
          }
        }
      }
    }
  });

  it('P-07, P-29, P-36 : une lecture impossible est dite dans l’onglet, avec « Réessayer »', async () => {
    // Dépôts qui échouent tous : chaque bloc montre son propre état d'échec (jamais un chargement sans fin, jamais un panneau vide).
    const failing: unknown = new Proxy(() => undefined, { get: () => failing, apply: () => Promise.reject(new Error('lecture impossible (test)')) });
    mount(db, { ...db.data, repos: failing as TestDb['data']['repos'] });
    const sessions = await openTab('Séances');
    expect(await within(sessions).findByText('Les indicateurs d’entraînement n’ont pas pu être lus.')).toBeInTheDocument();
    expect(within(sessions).getAllByRole('button', { name: 'Réessayer' }).length).toBeGreaterThan(0);
    for (const body of ['Mesures', 'Santé', 'Photos'] as const) {
      const panel = await openTab('Corps', body);
      expect(await within(panel).findByText('Lecture impossible. Réessaie.')).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    }
    const activity = await openTab('Activité');
    expect(await within(activity).findByText('Lecture impossible des suivis.')).toBeInTheDocument();
  });
});
