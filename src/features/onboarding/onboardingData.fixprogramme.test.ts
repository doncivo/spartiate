import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUuidGenerator } from '../../domain/id';
import { emptyDraft, type OnboardingDraft } from '../../domain/onboarding';
import type { DeviceId, LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { loadTrainingContent, type TrainingContent } from '../training/content';
import { finishOnboarding, loadStart } from './onboardingData';

/** FIX-PROGRAMME (lot 0.28.0), C-117 : « Revoir mes réglages » n'écrase pas la durée de cycle choisie depuis l'onboarding (D-315). */
const DEVICE = '60000000-0000-4000-8000-0000000004f3' as DeviceId;
const TODAY = '2026-11-16' as LocalDate;
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
  acceptProposal: false,
  mesoWeeks: 4,
};

describe('C-117 revue de l’onboarding et durée du cycle', () => {
  let db: TestDb;
  let content: TrainingContent;
  const deps = () => ({ data: db.data, ids, today: TODAY, timeZone: 'Europe/Paris', year: 2026 });
  const later = () => ({ ...deps(), today: '2026-11-18' as LocalDate });
  beforeEach(async () => {
    db = await openBaseDb(DEVICE, '2026-11-16T09:00:00.000Z');
    content = await loadTrainingContent();
  });
  afterEach(async () => {
    await db.close();
  });

  for (const chosen of [6, 7, 'unlimited'] as const) {
    it(`onboarding à 4 semaines, durée passée ensuite à ${String(chosen)}, revue terminée sans toucher la durée : réglage inchangé`, async () => {
      await finishOnboarding(deps(), FULL, content);
      await db.data.repos.settings.set('training.cycleWeeks', chosen);
      const start = await loadStart(db.data);
      await finishOnboarding(later(), { ...start.draft, heightCm: 181 }, content, { baseline: start.baseline });
      expect(await db.data.repos.settings.get('training.cycleWeeks')).toBe(chosen);
    });
  }

  it('la revue part du réglage courant quand il vaut 4, 5 ou 6', async () => {
    await finishOnboarding(deps(), FULL, content);
    await db.data.repos.settings.set('training.cycleWeeks', 6);
    expect((await loadStart(db.data)).draft.mesoWeeks).toBe(6);
  });

  it('durée changée dans la revue : écrite', async () => {
    await finishOnboarding(deps(), FULL, content);
    await db.data.repos.settings.set('training.cycleWeeks', 6);
    const start = await loadStart(db.data);
    await finishOnboarding(later(), { ...start.draft, mesoWeeks: 5 }, content, { baseline: start.baseline });
    expect(await db.data.repos.settings.get('training.cycleWeeks')).toBe(5);
  });

  it('premier passage (sans point de départ) : la durée de l’onboarding est écrite, comme avant', async () => {
    await finishOnboarding(deps(), FULL, content);
    expect(await db.data.repos.settings.get('training.cycleWeeks')).toBe(4);
  });
});
