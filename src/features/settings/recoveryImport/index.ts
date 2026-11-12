import { logFailure } from '../../../platform/desktop/log';
import { openShortcutFiles, openShortcutPicker, type ShortcutFilesReader } from '../../../platform/shortcutFiles';
import { detectTimeZone } from '../../../platform/timeZone';
import type { RecoverySet, RecoveryWorkout } from '../../../domain/recovery';
import { resolveExercise } from '../../../domain/training';
import type { AppContainer } from '../../app/container';
import { createShortcutImportService, type ImportLog, type ShortcutImportService } from './service';
import { healthBodyImportFor, type HealthBodyImportService } from '../healthBodyImport';

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
export function shortcutImportFor(container: AppContainer, reader?: ShortcutFilesReader, fallback?: ShortcutFilesReader): ShortcutImportService {
  const existing = services.get(container);
  if (existing !== undefined && reader === undefined && fallback === undefined) return existing;
  const { runtime, os } = container.platform;
  const service = createShortcutImportService({
    reader: reader ?? openShortcutFiles(runtime, os),
    fallback: fallback ?? openShortcutPicker(runtime, os),
    samples: () => container.data.repos.recoverySamples(),
    recovery: () => container.data.repos.recovery(),
    workouts: (since) => loadRecoveryWorkouts(container, since),
    clock: container.clock,
    timeZone: detectTimeZone() ?? 'Europe/Paris',
    log: importLog,
    // I5-06 : version de la règle du sommeil des résumés (réglage local) ; une version plus ancienne recalcule une fois les 30 jours.
    rules: {
      get: async () => {
        const value = await container.data.repos.settings.get('recovery.sleepRulesVersion');
        return typeof value === 'number' ? value : null;
      },
      set: (version) => container.data.repos.settings.set('recovery.sleepRulesVersion', version),
    },
    // I5-02 (point 2.3) : heure de coucher proposée et replanification des notifications, chargées à la demande (hors du départ).
    afterRecompute: (info) => import('../../notifications').then((m) => m.recoveryNotificationsFor(container).afterImport(info)),
  });
  services.set(container, service);
  return service;
}

/**
 * Déclenchements automatiques (I5-03, D-90) : à l'ouverture de l'app (après le premier rendu, tâche différée de 3 s) et à chaque retour au
 * premier plan. Chacun appelle `run('open')` ; la limite de 30 minutes est tenue par le service (« throttled »). Lit seulement si le lecteur
 * est automatique (dossier sante) ; le sélecteur a besoin d'un geste. Ne rejette jamais. I6-04 : l'import Renpho / Santé (`healthBodyImportFor`, même dossier,
 * mêmes déclenchements, sa propre limite de 30 minutes) part juste après, et son échec ne gêne pas l'import de la récupération.
 */
export function startRecoveryImportOnOpen(
  container: AppContainer,
  options: { readonly service?: Pick<ShortcutImportService, 'run'>; readonly bodyService?: Pick<HealthBodyImportService, 'run'>; readonly delayMs?: number } = {},
): { readonly dispose: () => void } {
  let cancelled = false;
  const trigger = (): void => {
    if (cancelled) return;
    const service = options.service ?? shortcutImportFor(container);
    void service.run('open').catch((error: unknown) => logFailure('recovery-import', error));
    // Un service de récupération injecté (tests) ne lance l'import Renpho que si son service est injecté aussi.
    const body = options.bodyService ?? (options.service === undefined ? healthBodyImportFor(container) : undefined);
    if (body !== undefined) void body.run('open').catch((error: unknown) => logFailure('health-body-import', error));
  };
  const timer = window.setTimeout(trigger, options.delayMs ?? 3000);
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') trigger();
  };
  document.addEventListener('visibilitychange', onVisible);
  return {
    dispose: () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}
