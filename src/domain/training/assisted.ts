/**
 * FIX-ASSIST (lot 0.28.0 ; audit C-001, C-002, C-011) : exercice assisté, la charge saisie est l'assistance (une charge négative). Module pur.
 * Un exercice est assisté quand son matériel comprend la machine de tractions assistées (même règle que `prescriptionInputOf`).
 */

export const ASSISTED_EQUIPMENT_ID = 'assisted-pull-up-machine';

export const isAssistedEquipment = (equipment: readonly string[] | undefined): boolean => equipment?.includes(ASSISTED_EQUIPMENT_ID) === true;

/**
 * Exercices assistés du catalogue embarqué (`content/exercises/exercises.json`, identifiants stables) ; un test le garde aligné sur le catalogue.
 * Les exercices personnalisés assistés sont ajoutés par l'appelant (table `exercise`).
 */
export const CATALOG_ASSISTED_IDS: ReadonlySet<string> = new Set(['pull-up-assisted']);
