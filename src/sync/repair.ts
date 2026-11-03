import type { SyncDeps } from './deps';

/**
 * Réparations après un lot appliqué (ADR 0011, section 8) : celles du catalogue injecté (`rules.repairs`). Le catalogue de production (I0)
 * n'en a aucune ; l'ancien schéma (`routine.paused` recalculé, une seule session Focus ouverte) vit dans le banc de test.
 */
export async function runRepairs(deps: SyncDeps, touched: ReadonlyMap<string, ReadonlySet<string>>): Promise<void> {
  await deps.catalogue.rules.repairs?.(deps, touched);
}
