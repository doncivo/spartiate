import { logFailure } from '../../platform/desktop/log';

/**
 * Étapes nommées et chronométrées du démarrage (ios-demarrage). Chaque appel natif ou asynchrone du chemin de démarrage ouvre une étape ;
 * la précédente est fermée et sa durée écrite au journal technique (nom et millisecondes seulement : aucune donnée personnelle).
 * Une étape ouverte depuis plus de `STARTUP_STEP_DEADLINE_MS` est dite bloquée : l'écran « Démarrage bloqué » la nomme.
 */
export const STARTUP_STEP_DEADLINE_MS = 8_000;

/**
 * FIX-COQUILLE (C-115) : une sauvegarde ou une migration progresse parfois lentement (iPhone après une mise à jour) : délai propre aux étapes de
 * base (db.backup, db.schema, db.migration.N, db.afterApply), et aucun rechargement proposé tant qu'elles tournent.
 */
export const DB_STEP_DEADLINE_MS = 120_000;
const DB_WORK_STEP = /^db\.(backup|schema|migration|afterApply)(\.|$)/;

/** Étape de travail sur la base (sauvegarde, migration) : la recharger en plein travail est interdit. */
export function isDatabaseWorkStep(name: string): boolean {
  return DB_WORK_STEP.test(name);
}

/** Délai au-delà duquel l'étape est dite bloquée. */
export function stepDeadlineMs(name: string): number {
  return isDatabaseWorkStep(name) ? DB_STEP_DEADLINE_MS : STARTUP_STEP_DEADLINE_MS;
}

export interface StartupStep {
  readonly name: string;
  readonly startedAt: number;
}

export interface StepRecord {
  readonly name: string;
  readonly ms: number;
}

export interface StartupTracker {
  /** Ferme l'étape en cours (durée journalisée) et ouvre `name`. */
  begin(name: string): void;
  /** Ferme l'étape en cours sans en ouvrir une autre : le démarrage est terminé. */
  done(): void;
  /** Étape en cours, ou null (rien ouvert ou démarrage terminé). */
  current(): StartupStep | null;
  /** Étape ouverte depuis plus de `deadlineMs`, ou null. */
  stalled(deadlineMs?: number): StartupStep | null;
  /** Étapes fermées, dans l'ordre. */
  history(): readonly StepRecord[];
  subscribe(listener: () => void): () => void;
  /** Remise à zéro (nouvel essai, tests). */
  reset(): void;
}

/** Nom d'étape sûr pour le journal : lettres, chiffres, point, tiret et soulignement seulement. */
export function stepCode(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'etape';
}

/** Une étape plus rapide que ceci n'est pas écrite au journal technique (elle reste dans l'historique partagé). */
export const LOGGED_STEP_MIN_MS = 500;

export function createStartupTracker(now: () => number = () => performance.now(), log: (line: string) => void = (line) => logFailure('startup', line), minLoggedMs = 0): StartupTracker {
  let open: StartupStep | null = null;
  let closed: StepRecord[] = [];
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  const close = (): void => {
    if (!open) return;
    const ms = Math.max(0, Math.round(now() - open.startedAt));
    closed.push({ name: open.name, ms });
    if (ms >= minLoggedMs) log(`step ${stepCode(open.name)} ${String(ms)} ms`);
    open = null;
  };
  return {
    begin(name) {
      close();
      open = { name, startedAt: now() };
      notify();
    },
    done() {
      close();
      notify();
    },
    current: () => open,
    stalled(deadlineMs) {
      return open && now() - open.startedAt > (deadlineMs ?? stepDeadlineMs(open.name)) ? open : null;
    },
    history: () => closed,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      open = null;
      closed = [];
      notify();
    },
  };
}

/** Suivi du démarrage de l'app. */
export const startupTracker: StartupTracker = createStartupTracker(undefined, undefined, LOGGED_STEP_MIN_MS);
