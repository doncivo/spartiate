import { USER_DATA_DOMAINS, type BasePresence, type UserDataDomain } from '../../../domain/onboarding/draft';
import type { SqlExecutor, SqlRow } from '../../driver';
import type { UserDataRepository } from '../userDataRepository';

/** Tables de chaque domaine ; `live` : la table a une suppression logique (`deleted_at`), une ligne supprimée ne compte pas. */
const TABLES: Readonly<Record<UserDataDomain, readonly { readonly table: string; readonly live: boolean }[]>> = {
  profile: [{ table: 'profile', live: true }],
  routines: [{ table: 'routine', live: true }],
  weights: [{ table: 'body_weight', live: true }],
  workouts: [{ table: 'workout', live: true }],
  meals: [{ table: 'meal_entry', live: true }],
  recoveryDays: [
    { table: 'recovery_day', live: true },
    { table: 'muscle_recovery', live: true },
  ],
  recoverySamples: [{ table: 'recovery_sample', live: false }],
  recoveryFactors: [{ table: 'recovery_factor', live: true }],
  measurements: [{ table: 'measurement', live: true }],
  photos: [{ table: 'progress_photo', live: true }],
};

const exists = ({ table, live }: { readonly table: string; readonly live: boolean }): string => `EXISTS (SELECT 1 FROM ${table}${live ? ' WHERE deleted_at IS NULL' : ''} LIMIT 1)`;

/** Une seule requête : un `EXISTS (… LIMIT 1)` par table, combinés par domaine. */
const PRESENCE_SQL = `SELECT ${USER_DATA_DOMAINS.map((domain) => `(${TABLES[domain].map(exists).join(' OR ')}) AS ${domain}`).join(', ')}`;

export function createUserDataRepository(db: SqlExecutor): UserDataRepository {
  return {
    async presence() {
      const row = (await db.select<SqlRow>(PRESENCE_SQL))[0] ?? {};
      return Object.fromEntries(USER_DATA_DOMAINS.map((domain) => [domain, Number(row[domain] ?? 0) === 1])) as BasePresence;
    },
  };
}
