import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createUuidGenerator } from '../../../domain/id';
import { allExercises } from '../../../domain/training';
import { generateSession } from '../../../domain/training/generateSession';
import type { IsoDateTime } from '../../../domain/types';
import { loadTrainingContent, programToRoutine } from '../content';
import { buildGenerationInput, defaultGenerationSettings, defaultSplitFor } from './generationInput';

/**
 * I3-01 (interface) : entrée du générateur construite depuis le contenu embarqué réel. Les quatre programmes de départ (§ 12.5), avec leur
 * profil compatible, sont proposés tels quels en Guidé (Maison pour le programme maison) : aucun exercice omis, aucun hors split.
 */

const NOW = '2026-11-09T07:00:00.000Z' as IsoDateTime;
const splitOf = (id: string): string => (JSON.parse(readFileSync(`content/programs/${id}.json`, 'utf8')) as { split: string }).split;

describe('entrée de génération depuis le contenu embarqué', () => {
  it('split par défaut d’après le nombre de jours : ≤ 3 Full Body, 4 Haut / Bas, 5–6 PPL, 7 Custom', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(defaultSplitFor)).toEqual(['full-body', 'full-body', 'full-body', 'upper-lower', 'ppl', 'ppl', 'custom']);
  });

  it('réglages par défaut prudents : Guidé, Constante, droites, sans budget, sans douleur ni priorité', () => {
    expect(defaultGenerationSettings(4)).toEqual({ mode: 'guide', split: 'upper-lower', customGroups: [], variety: 'consistent', style: 'straight', priorities: [], painfulPatterns: [], budgetMin: null });
  });

  it('les quatre programmes de départ : split déduit = split du programme ; chaque jour proposé sans omission ni alerte hors split', async () => {
    const content = await loadTrainingContent();
    const ids = createUuidGenerator();
    const exercises = allExercises(content.catalog, []);
    for (const program of content.programs) {
      const routine = programToRoutine(program, content.catalog, ids);
      expect(defaultSplitFor(routine.days.length), program.id).toBe(splitOf(program.id));
      const profile = content.profiles.find((p) => p.id === program.compatibleProfileIds[0]);
      if (!profile) throw new Error(program.id);
      const settings = { ...defaultGenerationSettings(routine.days.length), mode: profile.kind === 'maison' ? ('maison' as const) : ('guide' as const) };
      routine.days.forEach((day, index) => {
        const session = generateSession(buildGenerationInput({ exercises, active: profile, content }, { days: routine.days, startedAt: NOW }, index, settings, NOW));
        expect(session.status, `${program.id} ${day.name}`).toBe('ready');
        expect(session.omitted, `${program.id} ${day.name}`).toEqual([]);
        expect(session.warnings, `${program.id} ${day.name}`).not.toContain('off-split-in-routine');
        expect(new Set(session.exercises.map((e) => e.exerciseId)), `${program.id} ${day.name}`).toEqual(new Set(day.exercises.map((e) => e.exerciseId)));
      });
    }
  });

  it('Custom : seuls les groupes cochés pour ce jour comptent ; aucun groupe : refus « custom-day-groups »', async () => {
    const content = await loadTrainingContent();
    const ids = createUuidGenerator();
    const exercises = allExercises(content.catalog, []);
    const program = content.programs.find((p) => p.id === 'haut-bas-4j');
    const profile = content.profiles[0];
    if (!program || !profile) throw new Error('contenu');
    const routine = programToRoutine(program, content.catalog, ids);
    const base = { ...defaultGenerationSettings(4), split: 'custom' as const };
    const source = { days: routine.days, startedAt: NOW };
    expect(generateSession(buildGenerationInput({ exercises, active: profile, content }, source, 1, base, NOW)).issues).toEqual(['custom-day-groups']);
    const legs = generateSession(buildGenerationInput({ exercises, active: profile, content }, source, 1, { ...base, customGroups: ['quadriceps', 'hamstrings'] }, NOW));
    expect(legs.status).toBe('ready');
    expect(legs.groups).toEqual(['quadriceps', 'hamstrings']);
  });
});
