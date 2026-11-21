import { hlcDevice } from '../domain/sync/parse';
import { tablesToRepublish } from '../domain/sync/schemaRepublish';
import type { DeviceId } from '../domain/types';
import type { SyncDeps } from './deps';

/**
 * SYNC-01 (D-275, D-290 ; ADR 0018 accepté), chargé à la demande par `engine.ts` (hors du bundle de départ) : appareils de schémas différents.
 *
 * - **Détection** (`olderParked`) : une création reçue d'un appareil resté au schéma précédent n'a pas les colonnes ajoutées depuis ; elle est
 *   gardée telle quelle dans `sync_parked` (`missing-row`, sv de l'écrivain noté par `apply.ts`), jamais appliquée à moitié. Tant que
 *   l'écrivain publie encore un `sv` inférieur, elle est comptée ici : avertissement `older-device` (« Un appareil utilise une version plus
 *   ancienne. Mets-le à jour. »), sans reprise depuis l'instantané (elle ne la compléterait pas). L'écrivain mis à jour, une ligne encore de
 *   côté redevient une ligne manquante ordinaire (`received-unapplied`, reprise) : jamais muette.
 * - **Reprise** (`republishAfterUpgrade`) : une fois par migration additive (`SCHEMA_REPUBLISH`), chaque ligne des tables concernées est
 *   remise entière dans la file (`'+'`, chaque champ avec sa propre horloge) : l'appareil à jour la reçoit complète. Marque `sync_meta`
 *   posée dans la même transaction que la file : un arrêt brutal rejoue l'ensemble, sans effet de plus (fusion idempotente).
 */

/** Clé `sync_meta` : plus haut schéma dont la republication est faite (absente : jamais, base passée en 19 avec la 0.24.0 comprise). */
export const SCHEMA_REPUBLISHED_META = 'schemaRepublished';

const PAGE = 500;

/** Entrée de file « ligne entière » (`ROW_REPUBLISH_FIELD` de `publisher.ts`, égalité testée) : écrite ici sans importer le publieur (bloc à la demande sans dépendance de plus vers le départ). */
export const WHOLE_ROW_FIELD = '+';

/** Opérations `missing-row` reçues d'un `sv` inférieur dont l'écrivain publie encore un `sv` inférieur au schéma local. */
export async function olderParked(deps: SyncDeps): Promise<number> {
  const sync = deps.data.repos.sync;
  // Revue 1 (M1) : seul un écrivain connu et actif peut encore être mis à jour. Oublié ou absent de l'état local (opération reportée d'un
  // appareil jamais lu ici), sa ligne de côté est une ligne manquante ordinaire (`received-unapplied`, reprise), jamais « mets-le à jour ».
  const published = new Map((await sync.getStates()).filter((row) => row.status !== 'forgotten').map((row) => [row.deviceId, row.schemaVersion]));
  let count = 0;
  for (let after = 0; ; ) {
    const page = await sync.parked(['missing-row'], after, PAGE);
    for (const p of page) {
      const op = JSON.parse(p.op) as { sv?: unknown; w?: unknown };
      // SYNC-0281a (ADR 0018, M2 corrigé) : écrivain noté à la mise de côté (appareil lu) ; partie gardée de 0.25.0 à 0.28.0 sans `w` :
      // déduit du plus grand hlc, comme avant.
      const device = typeof op.w === 'string' ? (op.w as DeviceId) : hlcDevice(p.hlc);
      if (!published.has(device)) continue;
      const writer = published.get(device) ?? null;
      if (typeof op.sv === 'number' && op.sv < deps.sv && (writer === null || writer < deps.sv)) count += 1;
    }
    if (page.length < PAGE) return count;
    after = (page.at(-1) as { id: number }).id;
  }
}

/** Republication unique des tables gagnées par une migration additive depuis la dernière faite ; journalisée (tables et nombre, jamais de contenu). */
export async function republishAfterUpgrade(deps: SyncDeps): Promise<void> {
  const raw = await deps.data.repos.sync.getMeta(SCHEMA_REPUBLISHED_META);
  const done = raw === null ? 0 : Number(raw) || 0;
  if (done >= deps.sv) return;
  const tables = tablesToRepublish(done, deps.sv).flatMap((name) => deps.catalogue.table(name) ?? []);
  // Catalogue sans aucune de ces tables (banc de test) : rien à republier, aucune écriture (lecture seule à chaque cycle).
  if (tables.length === 0) return;
  let rows = 0;
  await deps.data.transaction(async (repos) => {
    for (const t of tables) {
      for (let after: string | null = null; ; ) {
        const page = await repos.sync.exportRows(t, after, PAGE);
        if (page.length > 0) await repos.sync.addOutbox(page.map((row) => ({ table: t.name, rowId: row.id, field: WHOLE_ROW_FIELD })));
        rows += page.length;
        if (page.length < PAGE) break;
        after = (page.at(-1) as { id: string }).id;
      }
    }
    await repos.sync.setMeta(SCHEMA_REPUBLISHED_META, String(deps.sv));
  });
  deps.logger.log('schema-republished', { tables: tables.map((t) => t.name).join(','), rows });
}
