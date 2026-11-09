import { logFailure } from '../../../platform/desktop/log';
import { openShortcutFiles, type ShortcutFilesReader } from '../../../platform/shortcutFiles';
import { detectTimeZone } from '../../../platform/timeZone';
import type { RecoverySet, RecoveryWorkout } from '../../../domain/recovery';
import { resolveExercise } from '../../../domain/training';
import type { AppContainer } from '../../app/container';
import { createShortcutImportService, type ImportLog, type ShortcutImportService } from './service';

export * from './service';

/** Journal de l'import : événement fixe en code, comptes en message (`clé=entier`), jamais une valeur corporelle. */
export const importLog: ImportLog = (event, counts) =>
  logFailure('recovery-import', { code: event, message: Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ') || 'ok' });

/** Séances closes récentes du conteneur, en types minimaux du moteur (muscles résolus par le catalogue embarqué puis les exercices personnalisés). */
export async function loadRecoveryWorkouts(container: AppContainer, sinceIso: string): Promise<readonly RecoveryWorkout[]> {
  const repos = container.data.repos;
  const [workouts, exercises, content] = await Promise.all([
    repos.workouts(),
    repos.exercises(),
    import('../../training/content').then((m) => m.loadTrainingContent()),
  ]);
  const customs = await exercises.list();
  const closed = (await workouts.listClosed(60)).filter((w) => w.endedAt !== null && w.endedAt >= sinceIso);
  const result: RecoveryWorkout[] = [];
  for (const workout of closed) {
    const full = await workouts.getClosed(workout.id);
    if (full === null || full.endedAt === null) continue;
    const sets: RecoverySet[] = full.sets.map((s) => {
      const resolved = resolveExercise({ id: s.exerciseId, frozenName: s.exerciseName }, content.catalog, customs);
      return {
        kg: s.loadKg,
        reps: s.reps,
        difficulty: s.difficulty ?? null,
        isWarmup: s.setKind === 'warmup',
        completed: s.done,
        muscles: resolved.exercise === null ? [] : resolved.exercise.muscles.map((m) => ({ id: m.id, weight: m.weight })),
      };
    });
    result.push({ endedAt: full.endedAt, sets });
  }
  return result;
}

const services = new WeakMap<AppContainer, ShortcutImportService>();

/** Service d'import du conteneur (un seul par conteneur : « un import à la fois » vaut pour l'écran comme pour l'ouverture). */
export function shortcutImportFor(container: AppContainer, reader?: ShortcutFilesReader): ShortcutImportService {
  const existing = services.get(container);
  if (existing !== undefined && reader === undefined) return existing;
  const service = createShortcutImportService({
    reader: reader ?? openShortcutFiles(container.platform.runtime, container.platform.os),
    samples: () => container.data.repos.recoverySamples(),
    recovery: () => container.data.repos.recovery(),
    workouts: (since) => loadRecoveryWorkouts(container, since),
    clock: container.clock,
    timeZone: detectTimeZone() ?? 'Europe/Paris',
    log: importLog,
  });
  services.set(container, service);
  return service;
}

/**
 * Déclenchement à l'ouverture (une fois par ouverture, après le premier rendu, en tâche différée). Lit seulement si le lecteur est automatique
 * (dossier Spartiate-sante, H-26) ; le lecteur à sélecteur a besoin d'un geste : rien ne s'ouvre seul. Ne rejette jamais.
 */
export function startRecoveryImportOnOpen(container: AppContainer): { readonly dispose: () => void } {
  let cancelled = false;
  const timer = window.setTimeout(() => {
    if (cancelled) return;
    void shortcutImportFor(container).run('open').catch((error: unknown) => logFailure('recovery-import', error));
  }, 3000);
  return {
    dispose: () => {
      cancelled = true;
      window.clearTimeout(timer);
    },
  };
}
