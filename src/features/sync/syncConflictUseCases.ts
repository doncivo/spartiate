import type { Repositories, StoredConflict } from '../../db/repositories';
import { nowIso } from '../../domain/clock';
import { conflictTarget, decideRestore, parentTableOf, type ConflictRowState, type RestoreDecision, type RestoreRefusal } from '../../domain/sync/conflictRestore';
import type { SyncValue } from '../../domain/sync/format';
import { hlcIso } from '../../domain/sync/parse';
import type { SyncColumn, SyncTable } from '../../domain/sync/syncTables';
import type { DeviceId, Hlc, IsoDateTime } from '../../domain/types';
import { defaultSyncLogger, type SyncLogger } from '../../sync';
import type { AppContainer } from '../app/container';
import type { UndoableCommand, UndoOutcome } from '../app/undo';

export { conflictTarget, type RestoreRefusal } from '../../domain/sync/conflictRestore';

/**
 * Journal des conflits et restauration de la valeur écartée (Y-04 ; ADR 0011, sections 4.2, 4.3 et 5.4 ; decisions.md, Y-04 D1 à D3).
 * Les règles (cible du catalogue, refus, valeur déjà en place, conflit de suppression) sont dans `src/domain/sync/conflictRestore.ts` ;
 * ce module lit la base, applique la décision et pose l'annulation.
 *
 * - Liste : récents d'abord, 50 conflits **visibles** par page, 12 derniers mois ; seuls les champs `conflictVisible` du catalogue ;
 *   une ligne illisible est isolée et comptée (signalée à l'écran) ; titre lu au moment de l'affichage ; refus certain (ligne ou parent
 *   disparu, valeur invalide) recalculé à chaque lecture, affiché en permanence tant que l'état reste bloqué (exigence d'Ali).
 * - « Restaurer » (un clic) : **une seule transaction** : nouvelle écriture locale par le `WriteStamper` (les déclencheurs posent la
 *   base = horloge courante du champ et l'entrée de `sync_outbox`), échéances des rappels recalculées si la date ou l'heure change,
 *   `restored = 1`, `resolved_at`. État d'une tâche : par terminer / rouvrir (date de fin, occurrence suivante d'une série). Conflit
 *   « supprimé / modifié » : l'élément est restauré (tâche : cas d'usage de la corbeille T-08, rappels compris). Annulable 5 s
 *   (`syncRestore`) ; refusée (`'stale'`) si le champ a changé depuis.
 * - Sûreté (critère 9) : table et colonne cherchées dans le catalogue (jamais le texte de la ligne de journal dans une requête), colonnes
 *   `conflictVisible` seulement, valeur validée par `isValidValue` ; le journal technique ne reçoit que table, champ et issue.
 */

export const CONFLICTS_PAGE_SIZE = 50;
/** Conflits listés : 12 derniers mois (la purge est celle de Y-02). */
const LIST_WINDOW_MS = 365 * 86_400_000;

export type RestoreResult =
  | { readonly status: 'restored' }
  | { readonly status: 'already' }
  | { readonly status: 'refused'; readonly reason: RestoreRefusal }
  /** Erreur inattendue (base) : rien n'est écrit (transaction annulée). */
  | { readonly status: 'failed' };

export interface ConflictSideView {
  readonly value: SyncValue;
  readonly device: DeviceId;
  readonly hlc: Hlc;
  /** Instant de la valeur, tiré de son hlc. */
  readonly at: IsoDateTime;
  /** Titre de l'élément désigné par une valeur d'identifiant (projet, objectif…), s'il existe encore. */
  readonly ref: string | null;
}

export interface ConflictView {
  readonly id: number;
  readonly table: SyncTable;
  readonly column: SyncColumn;
  readonly rowId: string;
  /** Titre de l'élément (ou de son parent pour un jour de routine, la cible d'un rappel) ; null : pas de titre propre. */
  readonly title: string | null;
  readonly itemState: ConflictRowState;
  readonly kept: ConflictSideView;
  readonly discarded: ConflictSideView;
  readonly detectedAt: IsoDateTime;
  /** Date de la restauration (D2) ; null : pas encore restaurée. */
  readonly restoredAt: IsoDateTime | null;
  readonly restored: boolean;
  /** Refus certain d'une restauration, montré en permanence sur la ligne (null : restaurable). */
  readonly blocked: RestoreRefusal | null;
}

export interface ConflictPage {
  readonly items: readonly ConflictView[];
  readonly hasMore: boolean;
  /** Lignes du journal illisibles (contenu altéré) parmi celles parcourues : signalées, jamais affichées. */
  readonly unreadable: number;
}

export type SyncConflictDeps = Pick<AppContainer, 'clock' | 'ids' | 'data' | 'undo'> & { readonly logger?: SyncLogger };

export interface SyncConflictUseCases {
  /** `pages` pages de 50 conflits ; rejette si la lecture échoue (l'écran l'affiche). */
  list(pages: number): Promise<ConflictPage>;
  /** Restaure la valeur écartée ; ne rejette jamais (échec : `failed`). */
  restore(conflictId: number): Promise<RestoreResult>;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Avis de changement (restauration, annulation) : l'écran relit le journal, où qu'ait eu lieu l'action (bandeau « Annuler », Ctrl+Z).
// ---------------------------------------------------------------------------------------------------------------------------------

/** Changement du journal : restauration tentée, ou annulation d'une restauration (le message de succès de la ligne n'a plus lieu d'être). */
export interface ConflictChange {
  readonly conflictId: number;
  readonly kind: 'restore' | 'undone';
}

const listeners = new WeakMap<object, Set<(change: ConflictChange) => void>>();

/** Écoute les changements du journal de ce conteneur (restauration, annulation). */
export function subscribeConflictChanges(owner: object, listener: (change: ConflictChange) => void): () => void {
  const set = listeners.get(owner) ?? new Set<(change: ConflictChange) => void>();
  set.add(listener);
  listeners.set(owner, set);
  return () => set.delete(listener);
}

function notifyConflictChanges(owner: object, change: ConflictChange): void {
  for (const listener of listeners.get(owner) ?? []) listener(change);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Lecture et application d'une décision
// ---------------------------------------------------------------------------------------------------------------------------------

/** Décision du domaine, avec ce qu'il faut pour l'appliquer et l'annuler. */
interface Plan {
  readonly decision: RestoreDecision;
  readonly previous: SyncValue;
  readonly previousHlc: Hlc | null;
}

/** Ce que ferait « Restaurer » maintenant (lecture seule : sert aussi au refus affiché en permanence). */
async function planRestore(repos: Repositories, table: SyncTable, column: SyncColumn, conflict: StoredConflict): Promise<Plan> {
  const current = await repos.syncConflicts.fieldState(table, column, conflict.rowId);
  const parentTable = parentTableOf(table, column);
  const parent = parentTable && typeof conflict.discardedValue === 'string' ? await repos.syncConflicts.rowState(parentTable, conflict.discardedValue) : null;
  return { decision: decideRestore({ column, discarded: conflict.discardedValue, row: current.row, current: current.value, parent }), previous: current.value, previousHlc: current.hlc };
}

/** Met un élément dans l'état voulu (supprimé ou présent) par une écriture de champ ; renvoie l'horloge du champ `deleted_at` après. */
async function setElementDeleted(repos: Repositories, table: SyncTable, column: SyncColumn, rowId: string, deleted: { readonly at: SyncValue } | null): Promise<Hlc | null> {
  await repos.syncConflicts.writeField(table, column, rowId, deleted ? deleted.at : null);
  return (await repos.syncConflicts.fieldState(table, column, rowId)).hlc;
}

/** Ce qu'une écriture de champ a produit, pour l'annuler. */
interface Written {
  readonly after: Hlc | null;
}

/** Écrit une valeur dans un champ par une écriture tamponnée (générique : aucune règle de table, pont minimal de SPA-001b-front). */
async function writeValue(repos: Repositories, table: SyncTable, column: SyncColumn, rowId: string, value: SyncValue): Promise<Written> {
  await repos.syncConflicts.writeField(table, column, rowId, value);
  return { after: (await repos.syncConflicts.fieldState(table, column, rowId)).hlc };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Cas d'usage
// ---------------------------------------------------------------------------------------------------------------------------------

export function createSyncConflictUseCases(deps: SyncConflictDeps): SyncConflictUseCases {
  const logger = deps.logger ?? defaultSyncLogger;
  /** Journal technique : table et champ du catalogue, issue ; jamais une valeur ni un nom reçu (section 2.3). */
  const log = (target: { table: SyncTable; column: SyncColumn } | null, outcome: string): void =>
    logger.log('conflict-restore', { table: target?.table.name ?? 'unknown', field: target?.column.name ?? 'unknown', outcome });

  const undoCommand = (conflict: StoredConflict, table: SyncTable, column: SyncColumn, plan: Plan, written: Written): UndoableCommand => ({
    kind: 'syncRestore',
    count: 1,
    async undo(): Promise<UndoOutcome> {
      const result = await deps.data.transaction(async (repos): Promise<UndoOutcome> => {
        const current = await repos.syncConflicts.fieldState(table, column, conflict.rowId);
        // Champ modifié depuis la restauration (autre action, synchro) : rien n'est écrasé.
        if (current.hlc === null || current.hlc !== written.after) return 'stale';
        if (plan.decision.kind === 'element') {
          await setElementDeleted(repos, table, column, conflict.rowId, plan.decision.deleted ? null : { at: plan.previous });
        } else {
          await writeValue(repos, table, column, conflict.rowId, plan.previous);
        }
        await repos.syncConflicts.markRestored(conflict.id, null);
        return 'undone';
      });
      if (result === 'undone') {
        log({ table, column }, 'undone');
        notifyConflictChanges(deps.data, { conflictId: conflict.id, kind: 'undone' });
      }
      return result;
    },
  });

  /** Conflits visibles du journal, jusqu'à `wanted` (page complétée après le filtre des champs visibles). */
  const visibleConflicts = async (since: IsoDateTime, wanted: number): Promise<{ shown: { conflict: StoredConflict; table: SyncTable; column: SyncColumn }[]; unreadable: number }> => {
    let fetch = wanted;
    for (;;) {
      const rows = await deps.data.repos.syncConflicts.listLog(since, fetch);
      const shown: { conflict: StoredConflict; table: SyncTable; column: SyncColumn }[] = [];
      let unreadable = 0;
      for (const row of rows) {
        if (!row.conflict) {
          unreadable += 1;
          continue;
        }
        const target = conflictTarget(row.conflict);
        if (target && shown.length < wanted) shown.push({ conflict: row.conflict, ...target });
      }
      if (shown.length >= wanted || rows.length < fetch) return { shown, unreadable };
      fetch *= 2;
    }
  };

  return {
    async list(pages) {
      const since = new Date(deps.clock.nowMs() - LIST_WINDOW_MS).toISOString() as IsoDateTime;
      const limit = Math.max(1, pages) * CONFLICTS_PAGE_SIZE;
      const { shown: found, unreadable } = await visibleConflicts(since, limit + 1);
      const hasMore = found.length > limit;
      const shown = found.slice(0, limit);
      const repos = deps.data.repos;
      const items = shown.map((s) => ({ table: s.table, rowId: s.conflict.rowId }));
      // Valeurs d'identifiant (projet, objectif…) : titre de l'élément désigné.
      const refs = shown.flatMap((s) => {
        const parent = parentTableOf(s.table, s.column);
        if (!parent) return [];
        return [s.conflict.keptValue, s.conflict.discardedValue].filter((v): v is string => typeof v === 'string').map((rowId) => ({ table: parent, rowId }));
      });
      const described = await repos.syncConflicts.describe([...items, ...refs]);
      const views: ConflictView[] = [];
      for (const { conflict, table, column } of shown) {
        const info = described.get(`${table.name}|${conflict.rowId}`) ?? { state: 'missing' as const, title: null };
        const parent = parentTableOf(table, column);
        const side = (value: SyncValue, device: string, hlc: Hlc): ConflictSideView => ({
          value,
          device: device as DeviceId,
          hlc,
          at: hlcIso(hlc),
          ref: parent && typeof value === 'string' ? (described.get(`${parent.name}|${value}`)?.title ?? null) : null,
        });
        let blocked: RestoreRefusal | null = null;
        if (!conflict.restored) {
          const plan = await planRestore(repos, table, column, conflict);
          blocked = plan.decision.kind === 'refused' ? plan.decision.reason : null;
        }
        views.push({
          id: conflict.id,
          table,
          column,
          rowId: conflict.rowId,
          title: info.title,
          itemState: info.state,
          kept: side(conflict.keptValue, conflict.keptDevice, conflict.keptHlc),
          discarded: side(conflict.discardedValue, conflict.discardedDevice, conflict.discardedHlc),
          detectedAt: conflict.detectedAt,
          restoredAt: conflict.restored ? conflict.resolvedAt : null,
          restored: conflict.restored,
          blocked,
        });
      }
      return { items: views, hasMore, unreadable };
    },

    async restore(conflictId) {
      let target: { table: SyncTable; column: SyncColumn } | null = null;
      try {
        const result = await deps.data.transaction(async (repos): Promise<{ result: RestoreResult; command: UndoableCommand | null }> => {
          const conflict = await repos.syncConflicts.getConflict(conflictId);
          if (!conflict) return { result: { status: 'refused', reason: 'row-gone' }, command: null };
          if (conflict === 'unreadable') return { result: { status: 'refused', reason: 'invalid' }, command: null };
          target = conflictTarget(conflict);
          if (!target) return { result: { status: 'refused', reason: 'invalid' }, command: null };
          const { table, column } = target;
          if (conflict.restored) return { result: { status: 'already' }, command: null };
          const plan = await planRestore(repos, table, column, conflict);
          const now = nowIso(deps.clock);
          switch (plan.decision.kind) {
            case 'refused':
              return { result: { status: 'refused', reason: plan.decision.reason }, command: null };
            case 'already':
              // L'autre appareil a déjà restauré (ou la valeur est revenue) : aucune écriture, conflit résolu (critère 10).
              await repos.syncConflicts.markRestored(conflict.id, now);
              return { result: { status: 'already' }, command: null };
            case 'write': {
              const written = await writeValue(repos, table, column, conflict.rowId, conflict.discardedValue);
              await repos.syncConflicts.markRestored(conflict.id, now);
              return { result: { status: 'restored' }, command: undoCommand(conflict, table, column, plan, written) };
            }
            case 'element': {
              const deleted = plan.decision.deleted ? { at: conflict.discardedValue } : null;
              const after = await setElementDeleted(repos, table, column, conflict.rowId, deleted);
              await repos.syncConflicts.markRestored(conflict.id, now);
              return { result: { status: 'restored' }, command: undoCommand(conflict, table, column, plan, { after }) };
            }
          }
        });
        if (result.command) deps.undo.push(result.command);
        log(target, result.result.status === 'refused' ? result.result.reason : result.result.status);
        notifyConflictChanges(deps.data, { conflictId, kind: 'restore' });
        return result.result;
      } catch (error) {
        log(target, 'failed');
        logger.log('conflict-restore-error', { name: error instanceof Error ? error.name : 'unknown' });
        return { status: 'failed' };
      }
    },
  };
}
