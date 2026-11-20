import {
  DbError,
  toDbError,
  type ExecuteResult,
  type SqlDriver,
  type SqlDriverKind,
  type SqlExecutor,
  type SqlParams,
  type SqlRow,
} from './driver';
import { describeError } from './errorText';

/**
 * Connexion brute fournie par une implémentation (plugin Tauri SQL, SQLite Wasm…).
 * Elle n'a pas à gérer l'ordre des appels ni les transactions.
 */
export interface RawConnection {
  execute(sql: string, params: SqlParams): Promise<ExecuteResult>;
  select(sql: string, params: SqlParams): Promise<SqlRow[]>;
  close(): Promise<void>;
}

/** Délai d'attente par défaut d'un appel mis en file pendant une transaction. */
export const DEFAULT_TRANSACTION_WAIT_TIMEOUT_MS = 10_000;

export interface SerializedDriverOptions {
  /**
   * Durée maximale (ms) pendant laquelle un appel émis alors qu'une transaction
   * s'exécute peut attendre son tour. Au-delà : DbError 'transaction-wait-timeout'.
   */
  readonly transactionWaitTimeoutMs?: number;
}

/**
 * Enveloppe commune à tous les drivers :
 * - sérialise les appels (une seule requête à la fois) : indispensable avec le plugin
 *   Tauri SQL, dont le pool sqlx ne garantit pas qu'un BEGIN et le COMMIT suivant
 *   passent par la même connexion si des requêtes s'intercalent (ADR 0002) ;
 * - implémente `transaction` par BEGIN IMMEDIATE / COMMIT / ROLLBACK ;
 * - les appels émis pendant une transaction (lectures de l'UI, autres stores) attendent
 *   leur tour ; s'ils attendent plus de `transactionWaitTimeoutMs`, ils sont rejetés.
 *   Cas typique : appel réentrant au driver depuis la transaction, qui sinon
 *   bloquerait la file pour toujours ;
 * - refuse l'usage d'un handle `tx` après la fin de sa transaction ;
 * - normalise les erreurs en `DbError`.
 */
export function createSerializedDriver(
  kind: SqlDriverKind,
  raw: RawConnection,
  options: SerializedDriverOptions = {},
): SqlDriver {
  const waitTimeoutMs = options.transactionWaitTimeoutMs ?? DEFAULT_TRANSACTION_WAIT_TIMEOUT_MS;
  let queue: Promise<unknown> = Promise.resolve();
  let closed = false;
  /** Vrai pendant l'exécution d'une transaction. */
  let inTransaction = false;
  /**
   * A-008 : échec fermé. Posé quand l'annulation d'une transaction ne peut pas être établie (ROLLBACK rejeté autrement que par « no transaction
   * is active »), ou quand la garde de synchro d'une transaction perdue ne peut pas être retirée : SQLite peut garder la transaction ouverte,
   * toute écriture suivante serait acquittée puis perdue. Plus aucune instruction n'est émise, sauf la fermeture.
   */
  let poisoned: DbError | null = null;
  const poisonListeners: Array<(error: DbError) => void> = [];
  const poison = (error: DbError): void => {
    if (poisoned) return;
    poisoned = error;
    for (const listener of poisonListeners) {
      try {
        listener(error);
      } catch {
        // Un abonné défaillant ne rouvre pas la file.
      }
    }
  };

  const enqueue = <T>(task: () => Promise<T>, allowPoisoned = false): Promise<T> => {
    if (closed) return Promise.reject(new DbError('closed', 'Base fermée'));
    if (poisoned && !allowPoisoned) return Promise.reject(poisoned);
    return new Promise<T>((resolve, reject) => {
      let started = false;
      let abandoned = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const run = async (): Promise<void> => {
        if (abandoned) return;
        started = true;
        if (timer !== undefined) clearTimeout(timer);
        // Appel déjà en file quand la connexion a été empoisonnée : refusé, jamais exécuté.
        if (poisoned && !allowPoisoned) {
          reject(poisoned);
          return;
        }
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      };
      queue = queue.then(run, run);

      if (inTransaction) {
        timer = setTimeout(() => {
          if (started) return;
          abandoned = true;
          reject(
            new DbError(
              'transaction-wait-timeout',
              `Appel en attente depuis plus de ${String(waitTimeoutMs)} ms derrière une transaction. ` +
                'Cause probable : appel réentrant au driver (ou transaction imbriquée) depuis la ' +
                'fonction de transaction ; utiliser le paramètre tx. Sinon, transaction trop longue.',
            ),
          );
        }, waitTimeoutMs);
      }
    });
  };

  const rawExecute = async (sql: string, params: SqlParams = []): Promise<ExecuteResult> => {
    try {
      return await raw.execute(sql, params);
    } catch (error) {
      throw toDbError(error, sql);
    }
  };

  const rawSelect = async <T extends SqlRow>(sql: string, params: SqlParams = []): Promise<T[]> => {
    try {
      return (await raw.select(sql, params)) as T[];
    } catch (error) {
      throw toDbError(error, sql);
    }
  };

  return {
    kind,
    execute: (sql, params) => enqueue(() => rawExecute(sql, params)),
    select: <T extends SqlRow = SqlRow>(sql: string, params?: SqlParams) =>
      enqueue(() => rawSelect<T>(sql, params)),
    transaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
      enqueue(async () => {
        let active = true;
        const guard = (): void => {
          if (!active) throw new DbError('closed', 'Transaction terminée');
        };
        const tx: SqlExecutor = {
          execute: async (sql, params) => {
            guard();
            return rawExecute(sql, params);
          },
          select: async <R extends SqlRow = SqlRow>(sql: string, params?: SqlParams) => {
            guard();
            return rawSelect<R>(sql, params);
          },
        };
        await rawExecute('BEGIN IMMEDIATE');
        inTransaction = true;
        let lost = false;
        try {
          const result = await fn(tx);
          try {
            await rawExecute('COMMIT');
          } catch (error) {
            // Connexion remplacée en cours de transaction (ping en échec côté sqlx) : les écritures ont été validées une à une sur la
            // nouvelle connexion, le COMMIT n'a plus de transaction. Échec visible de la transaction, jamais rattrapé en silence.
            if (/no transaction is active/i.test(error instanceof Error ? error.message : String(error))) {
              lost = true;
              throw new DbError('transaction-lost', 'Transaction perdue : connexion remplacée avant le COMMIT', { cause: error });
            }
            throw error;
          }
          return result;
        } catch (error) {
          // Un ROLLBACK qui ne trouve plus de transaction dit la même chose qu'un COMMIT perdu : la connexion a été remplacée.
          // Tout autre rejet : l'annulation n'est pas établie, la transaction peut rester ouverte (A-008) : échec fermé.
          let rollbackLost = false;
          let rollbackFailure: unknown;
          let rollbackFailed = false;
          try {
            await rawExecute('ROLLBACK');
          } catch (rollbackError) {
            if (/no transaction is active/i.test(describeError(rollbackError))) rollbackLost = true;
            else {
              rollbackFailed = true;
              rollbackFailure = rollbackError;
            }
          }
          if (rollbackFailed) {
            poison(
              new DbError(
                'connection-poisoned',
                `Connexion invalidée : ROLLBACK impossible, la transaction peut rester ouverte. Erreur d'origine : ${describeError(error)}. Cause du ROLLBACK : ${describeError(rollbackFailure)}`,
                { cause: rollbackFailure },
              ),
            );
          } else if (lost || rollbackLost) {
            // TRI-22 : chaque instruction a été validée seule, y compris la pose de `sync_guard` ; elle est retirée AVANT de rendre la file,
            // sinon les écritures des autres appelants passeraient sans entrer dans `sync_outbox`. Échec du retrait : échec fermé (A-008),
            // l'erreur d'origine reste rendue à l'appelant.
            try {
              await rawExecute('DELETE FROM sync_guard');
            } catch (guardError) {
              poison(
                new DbError(
                  'connection-poisoned',
                  `Connexion invalidée : transaction perdue et garde de synchro non retirée. Erreur d'origine : ${describeError(error)}. Cause du retrait : ${describeError(guardError)}`,
                  { cause: guardError },
                ),
              );
            }
          }
          throw error;
        } finally {
          active = false;
          inTransaction = false;
        }
      }),
    onPoisoned: (listener) => {
      poisonListeners.push(listener);
      if (poisoned) listener(poisoned);
    },
    close: () => {
      const done = enqueue(() => raw.close(), true);
      closed = true;
      return done;
    },
  };
}
