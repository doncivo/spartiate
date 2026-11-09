/**
 * Plan d'import (SPA-005, D-57) : compare l'état local à l'archive validée et décrit, sans rien écrire, ce que l'import ajouterait,
 * modifierait ou supprimerait. L'aperçu affiche ce plan ; l'écriture (transaction, horloges, file d'envoi) l'applique tel quel.
 *
 * - « fusionner » : identités D-55 (`profile|singleton`, `weight|date|source`) ; ce qui est absent de l'archive reste ; une valeur NULL
 *   du profil de l'archive n'efface jamais une valeur locale ;
 * - « remplacer » : l'archive devient l'état ; toute ligne locale absente est supprimée logiquement (jamais de tombstone).
 */

import { TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, trainingColumns, trainingRows, type ExportData, type ExportProfile, type ExportWeight, type TrainingRow, type TrainingTable } from './archive';

export type ImportMode = 'merge' | 'replace';
export type ImportTable = 'profile' | 'body_weight' | 'settings' | TrainingTable;

export interface ImportOp {
  readonly kind: 'add' | 'modify' | 'delete';
  readonly table: ImportTable;
  readonly id: string;
}

export interface ImportCounts {
  readonly add: number;
  readonly modify: number;
  readonly delete: number;
  readonly unchanged: number;
}

/** Écritures à faire : uniquement ce qui change (une fusion répétée donne un plan vide). */
export interface ImportWrites {
  readonly profile: ExportProfile | null;
  readonly deleteProfile: boolean;
  readonly weights: readonly ExportWeight[];
  readonly deleteWeightIds: readonly string[];
  readonly settings: ExportData['settings'];
  /** Lignes d'entraînement à créer ou remplacer, dans l'ordre du catalogue (parents d'abord). */
  readonly training: readonly { readonly table: TrainingTable; readonly row: TrainingRow }[];
  /** Lignes d'entraînement locales absentes de l'archive (« remplacer »), enfants d'abord. */
  readonly deleteTraining: readonly { readonly table: TrainingTable; readonly id: string }[];
}

export interface ImportPlan {
  readonly mode: ImportMode;
  readonly ops: readonly ImportOp[];
  readonly counts: ImportCounts;
  readonly writes: ImportWrites;
}

/** Première version de schéma dont l'exporteur écrit l'entraînement (0.2.3 écrivait le schéma 4 sans toujours la clé ; 0.3.0 = schéma 5). */
const TRAINING_ALWAYS_SINCE_SV = 5;

const PROFILE_FIELDS = ['sex', 'birthYear', 'heightCm', 'goal', 'experience', 'units'] as const;
const WEIGHT_FIELDS = ['date', 'kg', 'source', 'timezone', 'healthUuid', 'measuredAt'] as const;

const sameProfile = (a: ExportProfile, b: ExportProfile): boolean => PROFILE_FIELDS.every((f) => a[f] === b[f]);
const sameWeight = (a: ExportWeight, b: ExportWeight): boolean => WEIGHT_FIELDS.every((f) => a[f] === b[f]);

function mergeProfile(local: ExportProfile, incoming: ExportProfile): ExportProfile {
  return {
    id: local.id,
    sex: incoming.sex ?? local.sex,
    birthYear: incoming.birthYear ?? local.birthYear,
    heightCm: incoming.heightCm ?? local.heightCm,
    goal: incoming.goal ?? local.goal,
    experience: incoming.experience ?? local.experience,
    units: incoming.units ?? local.units,
  };
}

export function planImport(local: ExportData, incoming: ExportData, mode: ImportMode): ImportPlan {
  const ops: ImportOp[] = [];
  let unchanged = 0;

  // profil
  let profileWrite: ExportProfile | null = null;
  let deleteProfile = false;
  if (incoming.profile) {
    const target = local.profile ? (mode === 'merge' ? mergeProfile(local.profile, incoming.profile) : incoming.profile) : incoming.profile;
    if (!local.profile) {
      profileWrite = target;
      ops.push({ kind: 'add', table: 'profile', id: target.id });
    } else if (sameProfile(local.profile, target)) unchanged += 1;
    else {
      profileWrite = target;
      ops.push({ kind: 'modify', table: 'profile', id: target.id });
    }
  } else if (mode === 'replace' && local.profile) {
    deleteProfile = true;
    ops.push({ kind: 'delete', table: 'profile', id: local.profile.id });
  }

  // pesées
  const localWeights = new Map(local.weights.map((x) => [x.id, x] as const));
  const incomingIds = new Set(incoming.weights.map((x) => x.id));
  const weightWrites: ExportWeight[] = [];
  for (const x of [...incoming.weights].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const existing = localWeights.get(x.id);
    if (!existing) {
      weightWrites.push(x);
      ops.push({ kind: 'add', table: 'body_weight', id: x.id });
    } else if (sameWeight(existing, x)) unchanged += 1;
    else {
      weightWrites.push(x);
      ops.push({ kind: 'modify', table: 'body_weight', id: x.id });
    }
  }
  const deleteWeightIds: string[] = [];
  if (mode === 'replace') {
    for (const x of [...local.weights].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (incomingIds.has(x.id)) continue;
      deleteWeightIds.push(x.id);
      ops.push({ kind: 'delete', table: 'body_weight', id: x.id });
    }
  }

  // réglages (liste blanche : seules les clés présentes dans l'archive sont appliquées)
  const settingsWrite: { 'ui.theme'?: NonNullable<ExportData['settings']['ui.theme']> } = {};
  const theme = incoming.settings['ui.theme'];
  if (theme !== undefined) {
    const current = local.settings['ui.theme'];
    if (current === theme) unchanged += 1;
    else {
      settingsWrite['ui.theme'] = theme;
      ops.push({ kind: current === undefined ? 'add' : 'modify', table: 'settings', id: 'ui.theme' });
    }
  }

  // entraînement (0.2.3) : identité = identifiant de ligne ; « fusionner » ajoute ou remplace, « remplacer » supprime aussi l'absent.
  // Une archive sans entraînement (antérieure à la 0.2.3) ne supprime jamais rien côté entraînement, même en « remplacer ».
  const trainingWrites: { table: TrainingTable; row: TrainingRow }[] = [];
  const deleteTraining: { table: TrainingTable; id: string }[] = [];
  // REV-01 constat 2 : une archive écrite à partir du schéma 5 (après l'export de l'entraînement, 0.2.3) sans clé `training` dit que ces
  // tables sont vides ; seule une archive plus ancienne (schéma ≤ 4) ou sans version lue ne dit rien.
  const hasTraining = incoming.training !== undefined || (incoming.archiveSv !== undefined && incoming.archiveSv >= TRAINING_ALWAYS_SINCE_SV);
  for (const table of TRAINING_EXPORT_TABLES) {
    const columns = trainingColumns(table);
    const localRows = new Map(trainingRows(local, table).map((r) => [r.id, r] as const));
    for (const row of [...trainingRows(incoming, table)].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const existing = localRows.get(row.id);
      if (existing && columns.every((col) => (existing.values[col] ?? null) === (row.values[col] ?? null))) unchanged += 1;
      else {
        trainingWrites.push({ table, row });
        ops.push({ kind: existing ? 'modify' : 'add', table, id: row.id });
      }
    }
  }
  if (mode === 'replace' && hasTraining) {
    for (const table of [...TRAINING_EXPORT_TABLES].reverse()) {
      // Archive d'un schéma antérieur à la table : l'absence de ses clés n'est pas une donnée (I4-07), rien n'est supprimé.
      if (incoming.archiveSv !== undefined && incoming.archiveSv < (TABLE_SINCE_SV[table] ?? 0)) continue;
      const incomingIds = new Set(trainingRows(incoming, table).map((r) => r.id));
      for (const row of [...trainingRows(local, table)].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (incomingIds.has(row.id)) continue;
        deleteTraining.push({ table, id: row.id });
        ops.push({ kind: 'delete', table, id: row.id });
      }
    }
  }

  const count = (kind: ImportOp['kind']): number => ops.filter((o) => o.kind === kind).length;
  return {
    mode,
    ops,
    counts: { add: count('add'), modify: count('modify'), delete: count('delete'), unchanged },
    writes: { profile: profileWrite, deleteProfile, weights: weightWrites, deleteWeightIds, settings: settingsWrite, training: trainingWrites, deleteTraining },
  };
}
