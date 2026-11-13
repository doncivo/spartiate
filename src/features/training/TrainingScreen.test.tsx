import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHlcClock } from '../../domain/hlc';
import type { IdGenerator } from '../../domain/id';
import type { DeviceId, Id } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { AppContainerProvider } from '../app/AppContainerContext';
import { createAppContainer } from '../app/container';
import { INITIAL_NAVIGATION, useNavigationStore, type Route } from '../app/navigation';
import { TrainingScreen } from './TrainingScreen';

/**
 * I1-01 (interface), tests DOM : bibliothèque filtrée par le matériel actif, recherche, exercices personnalisés, programmes de départ, édition
 * d'une routine, profil de matériel actif. Base SQLite réelle (wasm), contenu embarqué réel (content/).
 */

const DEVICE = '60000000-0000-4000-8000-0000000000c1' as DeviceId;

describe('Entraînement : bibliothèque, matériel et routines', () => {
  let db: TestDb;
  const open = (screenId: 'routines' | 'library' | 'equipment' = 'routines', ids?: IdGenerator) => {
    act(() => useNavigationStore.getState().navigate({ tab: 'training', screen: screenId } as Route));
    const container = createAppContainer({ clock: db.clock, hlc: createHlcClock({ clock: db.clock, deviceId: DEVICE }), data: db.data, ...(ids ? { ids } : {}) });
    return render(
      <AppContainerProvider container={container}>
        <TrainingScreen />
      </AppContainerProvider>,
    );
  };
  const count = async (sql: string): Promise<number> => ((await db.driver.select<{ n: number }>(sql))[0]?.n ?? 0);

  beforeEach(async () => {
    useNavigationStore.setState(INITIAL_NAVIGATION);
    db = await openBaseDb(DEVICE, '2026-11-06T08:00:00.000Z');
  });
  afterEach(async () => {
    cleanup();
    await db.close();
  });

  it('accueil : sections Routines, Bibliothèque, Matériel et Journal (I1-03)', async () => {
    open();
    const nav = await screen.findByRole('radiogroup', { name: 'Sections de l’entraînement' });
    expect(within(nav).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Routines', 'Bibliothèque', 'Matériel', 'Journal', 'Cycle']);
    fireEvent.click(within(nav).getByRole('radio', { name: 'Bibliothèque' }));
    expect(useNavigationStore.getState().route).toEqual({ tab: 'training', screen: 'library' });
  });

  describe('bibliothèque', () => {
    // I6-07 : sous Vitest, le premier import du bloc à la demande `ExerciseMedia` transforme un module par image (87 adresses `?url`), soit
    // plus d'une seconde quand le poste est chargé ; dans le build, c'est un seul petit bloc. Le module est donc chargé une fois avant les
    // tests : `React.lazy` le résout depuis le cache, la fiche reste jugée sur son rendu, sans délai allongé (docs/journal.md, I6-07).
    beforeAll(async () => {
      await import('./media/ExerciseMedia');
    });

    it('filtrée par défaut par le profil actif (Salle complète, FIX-0173) ; la bascule montre tout', async () => {
      open('library');
      const toggle = await screen.findByRole('switch', { name: 'Compatibles avec mon matériel' });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      fireEvent.change(screen.getByLabelText('Groupe musculaire'), { target: { value: 'hamstrings' } });
      expect(screen.queryByRole('button', { name: /Curl nordique$/ })).toBeNull();
      expect(screen.getByRole('button', { name: /^Leg curl couché/ })).toBeInTheDocument();
      expect(screen.getByText('13 exercices')).toBeInTheDocument();
      fireEvent.click(toggle);
      expect(screen.getByRole('button', { name: 'Curl nordique' })).toBeInTheDocument();
      expect(screen.getByText('15 exercices')).toBeInTheDocument();
    });

    it('recherche par nom français sans accents et par alias anglais', async () => {
      open('library');
      const search = await screen.findByLabelText('Rechercher un exercice');
      fireEvent.change(search, { target: { value: 'developpe couche' } });
      expect(screen.getByRole('button', { name: /^Développé couché à la barre/ })).toBeInTheDocument();
      fireEvent.change(search, { target: { value: 'bench press barbell' } });
      expect(screen.getByRole('button', { name: 'Développé couché à la barre' })).toBeInTheDocument();
      fireEvent.change(search, { target: { value: 'zzzz' } });
      expect(screen.getByText('Aucun exercice ne correspond.')).toBeInTheDocument();
    });

    it('fiche : muscles, matériel, consignes, plage, repos, alternatives ; illustration sous licence avec attribution (I6-07)', async () => {
      const { container } = open('library');
      fireEvent.change(await screen.findByLabelText('Rechercher un exercice'), { target: { value: 'développé couché à la barre' } });
      fireEvent.click(screen.getByRole('button', { name: /^Développé couché à la barre/ }));
      expect(await screen.findByRole('heading', { name: 'Développé couché à la barre' })).toBeInTheDocument();
      expect(screen.getByText('6 à 10 répétitions')).toBeInTheDocument();
      expect(screen.getByText('2 min 30 s de repos')).toBeInTheDocument();
      expect(screen.getByText(/Pectoraux/)).toBeInTheDocument();
      expect(screen.getByText(/Barre droite/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Erreurs fréquentes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Développé couché aux haltères' })).toBeInTheDocument();
      expect(await screen.findByRole('img', { name: 'Illustration : Développé couché à la barre' })).toBeInTheDocument();
      expect(screen.getByText(/^Illustration : Everkinetic/)).toBeInTheDocument();
      expect(container.querySelectorAll('img')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Retour à la bibliothèque' }));
      expect(await screen.findByLabelText('Rechercher un exercice')).toBeInTheDocument();
    });

    it('exercice personnalisé : créé (UUID, is_custom = 1), visible, modifié puis supprimé', async () => {
      open('library');
      fireEvent.click(await screen.findByRole('button', { name: 'Nouvel exercice' }));
      fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Tirage à la sangle' } });
      fireEvent.change(screen.getByLabelText('Muscle principal'), { target: { value: 'lats' } });
      fireEvent.change(screen.getByLabelText('Mouvement'), { target: { value: 'pull-horizontal' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’exercice' }));
      await waitFor(async () => expect(await count('SELECT COUNT(*) AS n FROM exercise WHERE is_custom = 1 AND deleted_at IS NULL')).toBe(1));
      const [row] = await db.driver.select<{ id: string; name_fr: string }>('SELECT id, name_fr FROM exercise');
      expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(row?.name_fr).toBe('Tirage à la sangle');
      expect(await screen.findByRole('heading', { name: 'Tirage à la sangle' })).toBeInTheDocument();
      expect(screen.getByText('Personnalisé')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
      fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Tirage sangle' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’exercice' }));
      await waitFor(async () => expect((await db.driver.select<{ name_fr: string }>('SELECT name_fr FROM exercise'))[0]?.name_fr).toBe('Tirage sangle'));
      fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
      await waitFor(async () => expect(await count('SELECT COUNT(*) AS n FROM exercise WHERE deleted_at IS NOT NULL')).toBe(1));
    });

    it('collision d’identifiant refusée : message, aucune ligne écrasée', async () => {
      const fixed = '7f3a1c2e-0000-4000-8000-0000000000ff' as Id;
      open('library', { next: () => fixed });
      for (const name of ['Premier', 'Second']) {
        fireEvent.click(await screen.findByRole('button', { name: 'Nouvel exercice' }));
        fireEvent.change(screen.getByLabelText('Nom'), { target: { value: name } });
        fireEvent.click(screen.getByRole('button', { name: 'Enregistrer l’exercice' }));
        if (name === 'Premier') {
          await screen.findByRole('heading', { name: 'Premier' });
          fireEvent.click(screen.getByRole('button', { name: 'Retour à la bibliothèque' }));
        }
      }
      expect(await screen.findByRole('alert')).toHaveTextContent('Cet identifiant existe déjà');
      expect(await db.driver.select('SELECT name_fr FROM exercise')).toEqual([{ name_fr: 'Premier' }]);
    });
  });

  describe('routines', () => {
    it('ajouter un programme de départ crée une routine SQL complète avec noms figés', async () => {
      open('routines');
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un programme de départ' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter « Full Body 3 j »' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Routine « Full Body 3 j » ajoutée');
      expect(await db.driver.select('SELECT name, mode FROM routine')).toEqual([{ name: 'Full Body 3 j', mode: 'programme' }]);
      expect(await count('SELECT COUNT(*) AS n FROM routine_day')).toBe(3);
      expect(await db.driver.select("SELECT exercise_name FROM routine_exercise WHERE exercise_id = 'leg-press' LIMIT 1")).toEqual([{ exercise_name: 'Presse à cuisses' }]);
      expect(await screen.findByRole('heading', { name: 'Modifier la routine' })).toBeInTheDocument();
    });

    it('éditer une routine : séries, réordonner, retirer, ajouter un exercice filtré par le matériel, enregistrer', async () => {
      open('routines');
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un programme de départ' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter « Full Body 3 j »' }));
      const [day] = await screen.findAllByRole('group', { name: 'Full Body A' });
      if (!day) throw new Error('jour absent');
      const first = within(day).getByRole('group', { name: 'Presse à cuisses' });
      fireEvent.change(within(first).getByLabelText('Séries'), { target: { value: '4' } });
      fireEvent.change(within(first).getByLabelText('RIR (facultatif)'), { target: { value: '2' } });
      fireEvent.click(within(first).getByRole('button', { name: 'Descendre' }));
      fireEvent.click(within(within(day).getByRole('group', { name: 'Planche' })).getByRole('button', { name: 'Retirer' }));
      fireEvent.click(within(day).getByRole('button', { name: 'Ajouter un exercice' }));
      const picker = await screen.findByRole('region', { name: 'Ajouter un exercice à « Full Body A »' });
      fireEvent.change(within(picker).getByLabelText('Rechercher un exercice'), { target: { value: 'curl' } });
      expect(within(picker).queryByRole('button', { name: 'Curl nordique' })).toBeNull();
      fireEvent.click(within(picker).getByRole('button', { name: /^Curl marteau$/ }));
      expect(within(day).getByRole('group', { name: 'Curl marteau' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Routine enregistrée');
      expect(screen.queryByLabelText('Nom de la routine')).toBeNull();
      expect(screen.getByRole('button', { name: 'Nouvelle routine' })).toBeInTheDocument();
      const lines = await db.driver.select<{ exercise_id: string; sets: number; rir: number | null; position: number }>(
        "SELECT e.exercise_id, e.sets, e.rir, e.position FROM routine_exercise e JOIN routine_day d ON d.id = e.routine_day_id WHERE d.name = 'Full Body A' AND d.day_order = 1 AND e.deleted_at IS NULL ORDER BY e.position",
      );
      expect(lines.map((l) => l.exercise_id)).toEqual(['bench-press-dumbbell', 'leg-press', 'seated-row-cable', 'romanian-deadlift-dumbbell', 'overhead-press-dumbbell', 'hammer-curl']);
      expect(lines[1]).toMatchObject({ sets: 4, rir: 2 });
    });

    it('nouvelle routine vide, saisie invalide refusée sans écrire, suppression', async () => {
      open('routines');
      fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle routine' }));
      const name = await screen.findByLabelText('Nom de la routine');
      expect(await count('SELECT COUNT(*) AS n FROM routine')).toBe(1);
      fireEvent.change(name, { target: { value: ' ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Donne un nom à la routine');
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer la routine' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
      await waitFor(async () => expect(await count('SELECT COUNT(*) AS n FROM routine WHERE deleted_at IS NULL')).toBe(0));
    });

    it('avertit sans bloquer quand un exercice n’est pas compatible avec le profil actif', async () => {
      await db.data.repos.settings.set('training.activeEquipmentProfile', 'poids-de-corps');
      open('routines');
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un programme de départ' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter « Full Body 3 j »' }));
      const [day] = await screen.findAllByRole('group', { name: 'Full Body A' });
      if (!day) throw new Error('jour absent');
      expect(within(within(day).getByRole('group', { name: 'Presse à cuisses' })).getByText('Matériel absent du profil actif')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));
      expect(await screen.findByRole('status')).toHaveTextContent('Routine enregistrée');
      expect(screen.queryByLabelText('Nom de la routine')).toBeNull();
      expect(screen.getByRole('button', { name: 'Nouvelle routine' })).toBeInTheDocument();
    });
  });

  describe('matériel', () => {
    it('profil actif par défaut : Salle complète (FIX-0173) ; en activer un autre écrit le réglage local', async () => {
      open('equipment');
      expect(await screen.findByRole('heading', { name: 'Salle complète' })).toBeInTheDocument();
      expect(screen.getByText('Actif sur cet appareil')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Poids de corps/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Activer sur cet appareil' }));
      await waitFor(async () => expect(await db.data.repos.settings.get('training.activeEquipmentProfile')).toBe('poids-de-corps'));
    });

    it('dupliquer un profil embarqué puis le modifier ; les valeurs à vérifier sont signalées', async () => {
      open('equipment');
      expect((await screen.findAllByText('à vérifier en salle')).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Dupliquer pour modifier' }));
      expect(await screen.findByRole('heading', { name: 'Salle complète (copie)' })).toBeInTheDocument();
      expect(await count('SELECT COUNT(*) AS n FROM equipment_profile')).toBe(1);
      fireEvent.click(screen.getByRole('button', { name: 'Modifier le profil' }));
      fireEvent.change(screen.getByLabelText('Nom du profil'), { target: { value: 'Ma salle' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
      expect(await screen.findByRole('heading', { name: 'Ma salle' })).toBeInTheDocument();
      expect(await db.driver.select('SELECT name FROM equipment_profile')).toEqual([{ name: 'Ma salle' }]);
      expect((await screen.findAllByText('à vérifier en salle')).length).toBeGreaterThan(0);
    });
  });
});
