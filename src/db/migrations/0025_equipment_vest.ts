import type { Migration } from '../migrator';

/**
 * EQUIP-0302 (BL-175, D-674, D-383) : schéma 25, additif. Poids du gilet lesté au profil de matériel.
 *
 * - `equipment_profile.vest_kg` : poids du gilet, en kg (même unité que les autres poids du profil) ; nul : non renseigné (le gilet n'est alors
 *   proposé comme lest par aucun calcul). Bornes de la base : ]0, 60] ; l'éditeur et le domaine exigent 0,5 à 60 kg au dixième. Aucune valeur par
 *   défaut SQL (garde FIX-A009b, ADR 0011 avenant 39, D-785).
 *
 * Colonne PUBLIÉE. Une ligne créée part en ligne entière (`_ai` de la 0002, colonnes lues depuis le catalogue) ; une écriture sur une ligne
 * existante est capturée par un déclencheur PROPRE (`AFTER UPDATE OF`, modèle de la 0020) : le corps publié du `_au` de la 0002 ne change pas.
 * Un appareil resté au schéma 24 garde ce champ dans `sync_unknown` (ADR 0011 § 7.2) ; ses propres profils, sans ce champ, sont republiés
 * entiers après sa migration (`SCHEMA_REPUBLISH[25]`).
 */
const fieldCapture = (table: string, column: string): string[] => {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  const clock = (field: string): string => `(SELECT hlc FROM sync_field_clock WHERE ${row} AND field = '${field}')`;
  return [
    `INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
       SELECT '${table}', NEW.id, '${column}', NEW.hlc,
         CASE WHEN EXISTS (SELECT 1 FROM sync_outbox WHERE ${row} AND field IN ('${column}', '*'))
           THEN (SELECT base_hlc FROM sync_field_clock WHERE ${row} AND field = '${column}')
           ELSE COALESCE(${clock(column)}, ${clock('*')}, OLD.hlc) END
       WHERE OLD.${column} IS NOT NEW.${column}
       ON CONFLICT (table_name, row_id, field) DO UPDATE SET hlc = excluded.hlc, base_hlc = excluded.base_hlc;`,
    `DELETE FROM sync_outbox WHERE ${row} AND field = '${column}' AND OLD.${column} IS NOT NEW.${column};`,
    `INSERT INTO sync_outbox (table_name, row_id, field) SELECT '${table}', NEW.id, '${column}' WHERE OLD.${column} IS NOT NEW.${column};`,
  ];
};

const ownTrigger = (name: string, table: string, columns: readonly string[]): string => {
  const row = `table_name = '${table}' AND row_id = NEW.id`;
  return `CREATE TRIGGER ${name} AFTER UPDATE OF ${columns.join(', ')} ON ${table}
     WHEN NOT EXISTS (SELECT 1 FROM sync_guard) BEGIN
       INSERT INTO sync_field_clock (table_name, row_id, field, hlc, base_hlc)
         SELECT '${table}', NEW.id, '*', OLD.hlc, NULL
         WHERE OLD.hlc IS NOT NEW.hlc AND NOT EXISTS (SELECT 1 FROM sync_field_clock WHERE ${row} AND field = '*');
       ${columns.flatMap((column) => fieldCapture(table, column)).join('\n')}
     END`;
};

export const migration0025EquipmentVest: Migration = {
  version: 25,
  name: 'equipment_vest',
  statements: [
    'ALTER TABLE equipment_profile ADD COLUMN vest_kg REAL CHECK (vest_kg IS NULL OR (vest_kg > 0 AND vest_kg <= 60))',
    ownTrigger('sync_equipment_profile_vest_au', 'equipment_profile', ['vest_kg']),
  ],
};
