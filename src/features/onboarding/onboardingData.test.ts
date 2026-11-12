import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUuidGenerator } from '../../domain/id';
import { STARTER_PROGRAM_DAYS, emptyDraft, type OnboardingDraft } from '../../domain/onboarding';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { loadTrainingContent, programToRoutine, type TrainingContent } from '../training/content';
import { finishOnboarding, loadDraft, loadStart, markCompleted, previewChanges, readBaseCounts, readPrefill, saveDraft } from './onboardingData';

const DEVICE = '60000000-0000-4000-8000-0000000000c7' as DeviceId;
const TODAY = '2026-11-12' as LocalDate;
const ids = createUuidGenerator();

const FULL: OnboardingDraft = {
  ...emptyDraft(),
  step: 'result',
  sex: 'male',
  birthYear: 1996,
  heightCm: 180,
  weightKg: 80,
  activity: 'moderate',
  goal: 'muscle',
  weeklyRatePct: 0.25,
  experience: 'intermediate',
  sessionsPerWeek: 3,
  durationMin: 60,
  equipmentProfileId: 'fitness-park-antony',
  priorities: ['chest'],
};

describe('onboarding : données (I3-07)', () => {
  let db: TestDb;
  let content: TrainingContent;
  const deps = () => ({ data: db.data, ids, today: TODAY, timeZone: 'Europe/Paris', year: 2026 });

  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-12T09:00:00.000Z');
    content = await loadTrainingContent();
  });
  afterEach(async () => {
    await db.close();
  });

  it('les programmes de départ embarqués ont le nombre de jours que le domaine annonce', () => {
    for (const program of content.programs) expect(program.days.length, program.id).toBe(STARTER_PROGRAM_DAYS[program.id as keyof typeof STARTER_PROGRAM_DAYS]);
  });

  describe('base vide et brouillon', () => {
    it('base neuve : tout est à zéro ; un profil, une routine ou une pesée la rend non vide', async () => {
      expect(await readBaseCounts(db.data)).toEqual({ profile: false, routines: 0, weights: 0, workouts: 0, meals: 0 });
      await (await db.data.repos.profile()).save({ sex: 'male' }, 2026);
      expect((await readBaseCounts(db.data)).profile).toBe(true);
      await (await db.data.repos.bodyWeights()).saveManual({ date: TODAY, kg: 80, timezone: 'Europe/Paris' }, TODAY);
      expect((await readBaseCounts(db.data)).weights).toBe(1);
      const first = content.programs[0];
      if (!first) throw new Error('programme absent');
      await (await db.data.repos.trainingRoutines()).create(programToRoutine(first, content.catalog, ids));
      expect((await readBaseCounts(db.data)).routines).toBe(1);
    });

    it('le brouillon survit à une fermeture : enregistré, relu à l’identique ; absent ou illisible : brouillon vide', async () => {
      expect(await loadDraft(db.data)).toEqual(emptyDraft());
      await saveDraft(db.data, FULL);
      expect(await loadDraft(db.data)).toEqual(FULL);
      await db.data.repos.settings.set('onboarding.draft', { v: 9, nope: true });
      expect(await loadDraft(db.data)).toEqual(emptyDraft());
    });

    it('terminé : réglage local posé une fois', async () => {
      expect(await db.data.repos.settings.get('onboarding.completed')).toBe(false);
      await markCompleted(db.data);
      expect(await db.data.repos.settings.get('onboarding.completed')).toBe(true);
    });

    it('préremplissage : profil, dernière pesée et activité déjà enregistrés (Revoir mes réglages) ; rien d’inventé sur une base vide', async () => {
      expect(await readPrefill(db.data)).toEqual({});
      await (await db.data.repos.profile()).save({ sex: 'female', birthYear: 1990, heightCm: 168, goal: 'loss', experience: 'beginner' }, 2026);
      await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-10' as LocalDate, kg: 61.2, timezone: 'Europe/Paris' }, TODAY);
      expect(await readPrefill(db.data)).toMatchObject({ sex: 'female', birthYear: 1990, heightCm: 168, weightKg: 61.2, experience: 'beginner' });
    });
  });

  describe('fin de l’onboarding', () => {
    it('écrit le profil, la pesée du jour, les préférences de nutrition, le matériel actif et UNE routine nouvelle', async () => {
      const result = await finishOnboarding(deps(), FULL, content);
      expect(result.routineCreated).toBe(true);
      expect(await db.driver.select('SELECT sex, birth_year, height_cm, goal, experience FROM profile')).toEqual([{ sex: 'male', birth_year: 1996, height_cm: 180, goal: 'gain', experience: 'intermediate' }]);
      expect(await db.driver.select('SELECT date, kg, source FROM body_weight')).toEqual([{ date: TODAY, kg: 80, source: 'manual' }]);
      expect(await db.data.repos.settings.get('nutrition.prefs')).toMatchObject({ activity: 'moderate', goal: { kind: 'gain', weeklyRateKg: 0.2 } });
      expect(await db.data.repos.settings.get('training.activeEquipmentProfile')).toBe('fitness-park-antony');
      expect(await db.data.repos.settings.get('onboarding.completed')).toBe(true);
      const routines = await (await db.data.repos.trainingRoutines()).list();
      expect(routines.map((r) => r.name)).toEqual(['Full Body 3 j']);
      expect(result.routineId).toBe(routines[0]?.id);
    });

    it('objectif de perte : cible de perte au rythme choisi ; recomposition, force, maintien : maintien du poids', async () => {
      await finishOnboarding(deps(), { ...FULL, goal: 'fat-loss', weeklyRatePct: -0.5, acceptProposal: false }, content);
      expect(await db.data.repos.settings.get('nutrition.prefs')).toMatchObject({ goal: { kind: 'loss', weeklyRateKg: 0.4 } });
      expect(await db.driver.select('SELECT goal FROM profile')).toEqual([{ goal: 'loss' }]);
      await finishOnboarding(deps(), { ...FULL, goal: 'recomposition', weeklyRatePct: null, acceptProposal: false }, content);
      expect(await db.data.repos.settings.get('nutrition.prefs')).toMatchObject({ goal: { kind: 'maintain' } });
      expect(await db.driver.select('SELECT goal FROM profile')).toEqual([{ goal: 'maintain' }]);
    });

    it('PROPOSE sans REMPLACER : les routines existantes restent intactes, la proposée s’ajoute', async () => {
      const routines = await db.data.repos.trainingRoutines();
      const [pushPull, fullBody] = [content.programs[2], content.programs[0]];
      if (!pushPull || !fullBody) throw new Error('programmes absents');
      const mine = programToRoutine(pushPull, content.catalog, ids);
      await routines.create({ ...mine, name: 'Ma routine' });
      const before = await routines.get(mine.id);
      const result = await finishOnboarding(deps(), FULL, content);
      expect(result.routineCreated).toBe(true);
      expect((await routines.list()).map((r) => r.name).sort()).toEqual(['Full Body 3 j', 'Ma routine']);
      expect(await routines.get(mine.id)).toEqual(before);
      expect(fullBody.name).toBe('Full Body 3 j');
    });

    it('revoir ses réglages : une routine du même nom n’est pas dupliquée ni remplacée', async () => {
      const first = await finishOnboarding(deps(), FULL, content);
      const routines = await db.data.repos.trainingRoutines();
      const before = await routines.get(first.routineId ?? '');
      const second = await finishOnboarding(deps(), FULL, content);
      expect(second.routineCreated).toBe(false);
      expect(second.routineId).toBe(first.routineId);
      expect(await routines.list()).toHaveLength(1);
      expect(await routines.get(first.routineId ?? '')).toEqual(before);
    });

    it('revoir sans toucher au poids : aucune pesée créée ni ressuscitée ; FIX-0171 : brouillon effacé, réponses de l’assistant terminé gardées à part', async () => {
      const weights = await db.data.repos.bodyWeights();
      await weights.saveManual({ date: '2026-11-10' as LocalDate, kg: 80, timezone: 'Europe/Paris' }, TODAY);
      await finishOnboarding(deps(), { ...FULL, acceptProposal: false }, content);
      expect(await db.driver.select('SELECT date FROM body_weight')).toEqual([{ date: '2026-11-10' }]);
      expect(await db.data.repos.settings.get('onboarding.draft')).toBeNull();
      // Seules les réponses sans autre place sont gardées : profil, poids, activité et matériel se relisent dans leurs tables à la revue.
      expect(await db.data.repos.settings.get('onboarding.answers')).toMatchObject({ step: 'you', heightCm: null, weightKg: null, sessionsPerWeek: 3, weeklyRatePct: 0.25 });
    });

    it('proposition refusée ou écran Split passé : aucune routine', async () => {
      await finishOnboarding(deps(), { ...FULL, acceptProposal: false }, content);
      expect(await (await db.data.repos.trainingRoutines()).list()).toEqual([]);
      await finishOnboarding(deps(), { ...FULL, skipped: ['split'] }, content);
      expect(await (await db.data.repos.trainingRoutines()).list()).toEqual([]);
    });

    it('tout passé : aucune ligne de profil, aucune pesée, aucune routine (jamais une ligne vide), l’onboarding est terminé', async () => {
      const result = await finishOnboarding(deps(), { ...emptyDraft(), skipped: ['you', 'goal', 'experience', 'availability', 'equipment', 'priorities', 'split'] }, content);
      expect(result.routineCreated).toBe(false);
      expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
      expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
      expect(await db.data.repos.settings.get('nutrition.prefs')).toBeNull();
      expect(await db.data.repos.settings.get('training.activeEquipmentProfile')).toBeNull();
      expect(await db.data.repos.settings.get('onboarding.completed')).toBe(true);
    });

    describe('FIX-0171 (constat 6) : revoir ses réglages après un assistant terminé', () => {
      const changeProfileAndWeight = async (): Promise<void> => {
        await (await db.data.repos.profile()).save({ heightCm: 181 }, 2026);
        db.clock.advance(86_400_000);
        await (await db.data.repos.bodyWeights()).saveManual({ date: '2026-11-13' as LocalDate, kg: 75, timezone: 'Europe/Paris' }, '2026-11-13' as LocalDate);
      };
      const snapshot = async () => ({
        profile: await db.driver.select('SELECT height_cm, updated_at, hlc FROM profile'),
        weights: await db.driver.select('SELECT id, kg, updated_at FROM body_weight ORDER BY id'),
        prefs: await db.data.repos.settings.get('nutrition.prefs'),
        equipment: await db.data.repos.settings.get('training.activeEquipmentProfile'),
        routines: (await (await db.data.repos.trainingRoutines()).list()).length,
        answers: await db.data.repos.settings.get('onboarding.answers'),
      });
      const later = () => ({ ...deps(), today: '2026-11-14' as LocalDate });

      it('terminer, modifier profil et poids, rouvrir et terminer sans rien changer : zéro écriture, zéro pesée', async () => {
        await finishOnboarding(deps(), FULL, content);
        await changeProfileAndWeight();
        const start = await loadStart(db.data);
        expect(start.draft).toMatchObject({ step: 'you', heightCm: 181, weightKg: 75 });
        expect(start.persist).toBe(false);
        await db.driver.execute('DELETE FROM sync_outbox');
        const before = await snapshot();
        expect(await previewChanges(db.data, start.draft, start.baseline)).toEqual([]);
        await finishOnboarding(later(), start.draft, content, { baseline: start.baseline });
        expect(await snapshot()).toEqual(before);
        expect(await db.driver.select('SELECT 1 FROM sync_outbox')).toEqual([]);
      });

      it('ancien brouillon d’un assistant terminé (avant la 0.17.1) : jamais prioritaire sur le profil et la dernière pesée', async () => {
        await finishOnboarding(deps(), FULL, content);
        await changeProfileAndWeight();
        await db.data.repos.settings.set('onboarding.answers', null);
        await db.data.repos.settings.set('onboarding.draft', { ...FULL, step: 'you' });
        const start = await loadStart(db.data);
        expect(start.draft).toMatchObject({ heightCm: 181, weightKg: 75, sessionsPerWeek: 3 });
        await db.driver.execute('DELETE FROM sync_outbox');
        const weightsBefore = await db.driver.select('SELECT id FROM body_weight');
        await finishOnboarding(later(), start.draft, content, { baseline: start.baseline });
        expect(await db.driver.select('SELECT id FROM body_weight')).toEqual(weightsBefore);
        expect(await db.driver.select('SELECT height_cm FROM profile')).toEqual([{ height_cm: 181 }]);
        expect(await db.driver.select('SELECT 1 FROM sync_outbox')).toEqual([]);
      });

      it('remplacement refusé : rien n’est écrit pour ce champ ; accepté : seul ce champ est écrit', async () => {
        await finishOnboarding(deps(), FULL, content);
        await changeProfileAndWeight();
        const start = await loadStart(db.data);
        const edited = { ...start.draft, heightCm: 185 };
        expect(await previewChanges(db.data, edited, start.baseline)).toEqual([{ field: 'heightCm', before: 181, after: 185, replaces: true }]);
        await db.driver.execute('DELETE FROM sync_outbox');
        await finishOnboarding(later(), edited, content, { baseline: start.baseline, refused: ['heightCm'] });
        expect(await db.driver.select('SELECT height_cm FROM profile')).toEqual([{ height_cm: 181 }]);
        expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'profile'")).toEqual([]);
        await finishOnboarding(later(), edited, content, { baseline: start.baseline });
        expect(await db.driver.select('SELECT height_cm FROM profile')).toEqual([{ height_cm: 185 }]);
        expect(await db.driver.select("SELECT row_id, field FROM sync_outbox WHERE table_name = 'profile'")).toEqual([{ row_id: 'profile|singleton', field: 'height_cm' }]);
      });

      it('vrai brouillon inachevé (assistant jamais terminé) : repris à son écran, enregistré à chaque changement', async () => {
        await saveDraft(db.data, { ...FULL, step: 'goal' });
        const start = await loadStart(db.data);
        expect(start.draft).toMatchObject({ step: 'goal', heightCm: 180 });
        expect(start.persist).toBe(true);
        expect(start.baseline).toBeNull();
      });
    });

    it('une valeur invalide fait tout échouer : rien n’est écrit, l’onboarding n’est pas terminé', async () => {
      await expect(finishOnboarding(deps(), { ...FULL, birthYear: 1900 }, content)).rejects.toThrow();
      expect(await db.driver.select('SELECT 1 FROM profile')).toEqual([]);
      expect(await db.driver.select('SELECT 1 FROM body_weight')).toEqual([]);
      expect(await (await db.data.repos.trainingRoutines()).list()).toEqual([]);
      expect(await db.data.repos.settings.get('onboarding.completed')).toBe(false);
    });
  });
});
