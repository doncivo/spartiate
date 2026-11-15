/**
 * SYNC-01 (D-275, D-290 ; ADR 0018 proposé) : republication des lignes entières après une migration additive sur une table déjà publiée.
 *
 * Un appareil resté au schéma précédent publie ses créations sans les colonnes ajoutées par la migration suivante ; l'appareil à jour ne
 * peut pas les insérer incomplètes (aucune règle ne complète une colonne absente d'un `sv` plus ancien : ADR 0011 §3.1, §7.2) et les garde
 * de côté (`sync_parked`, `missing-row`, avertissement `older-device`). Une fois l'ancien appareil mis à jour, la migration a posé chez lui la
 * valeur par défaut (nulle) des colonnes nouvelles ; il republie alors, une seule fois, chaque ligne de ces tables **entière** (entrée de
 * file `'+'`, mécanisme et format existants, chaque champ avec sa propre horloge) : l'appareil à jour la reçoit complète et l'applique par
 * la règle ordinaire. Rien ne change dans le format des journaux ni dans la fusion.
 *
 * `SCHEMA_REPUBLISH[n]` : tables publiées avant la migration `n` auxquelles `n` ajoute des colonnes publiées. Toute nouvelle migration de
 * ce genre ajoute ici sa ligne (garde : `schemaRepublish.test.ts`). Module pur, chargé à la demande avec `src/sync/olderWriter.ts`.
 */
export const SCHEMA_REPUBLISH: Readonly<Record<number, readonly string[]>> = {
  19: ['mesocycle', 'nutrition_target'],
};

/**
 * Migrations additives plus anciennes, volontairement hors de la republication (D-290, révisable par Ali) : colonnes de séries et de lignes de
 * routine (volume d'historique), schémas sortis bien avant la 0.24.0, appareils mis à jour ensemble depuis. Une ligne restée de côté pour
 * elles reste visible (`received-unapplied` ou `older-device`), jamais perdue en silence.
 */
export const SCHEMA_REPUBLISH_EXEMPT: Readonly<Record<number, readonly string[]>> = {
  6: ['workout_set'],
  13: ['workout_set'],
  14: ['routine_exercise'],
};

/** Tables à republier par un appareil au schéma `sv` dont la dernière republication faite couvre `done` (0 : jamais). Ordre stable, sans doublon. */
export function tablesToRepublish(done: number, sv: number): string[] {
  const tables = new Set<string>();
  for (const [version, names] of Object.entries(SCHEMA_REPUBLISH)) if (Number(version) > done && Number(version) <= sv) for (const name of names) tables.add(name);
  return [...tables];
}
