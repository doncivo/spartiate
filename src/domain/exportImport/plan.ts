/**
 * Plan d'import (SPA-005, D-57) : compare l'état local à l'archive validée et décrit, sans rien écrire, ce que l'import ajouterait,
 * modifierait ou supprimerait. L'aperçu affiche ce plan ; l'écriture (transaction, horloges, file d'envoi) l'applique tel quel.
 *
 * - « fusionner » : identités D-55 (`profile|singleton`, `weight|date|source`) ; ce qui est absent de l'archive reste ; une valeur NULL
 *   du profil de l'archive n'efface jamais une valeur locale ;
 * - « remplacer » : l'archive devient l'état ; toute ligne locale absente est supprimée logiquement (jamais de tombstone).
 * - I5-01 : tables en lecture seule sur cet appareil (`local.readOnlyTables`, résumés de récupération sur le PC) : jamais écrites ni
 *   supprimées, dans aucun mode ; leurs lignes de l'archive sont comptées dans `skippedReadOnly` (elles reviennent de l'iPhone par la synchro).
 */

import { TABLE_SINCE_SV, TRAINING_EXPORT_TABLES, trainingColumns, trainingRows, trainingTable, type ExportData, type ExportProfile, type ExportWeight, type TrainingRow, type TrainingTable } from './archive';

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
  /** Lignes de l'archive écartées parce que leur table est en lecture seule sur cet appareil (I5-01) ; 0 ailleurs. */
  readonly skippedReadOnly: number;
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

interface OpenWorkoutRules {
  /** Séances de l'archive à ne pas écrire : mises de côté (D-85) ou déjà closes localement (jamais rouvertes), avec leurs séries. */
  readonly skip: ReadonlySet<string>;
  /** Séances ouvertes de l'archive importées closes, à leur dernier instant connu (D-85). */
  readonly closeAt: ReadonlyMap<string, string>;
  /** Séances locales dont ni la séance ni les séries ne sont jamais supprimées : les ouvertes, et les closes que l'archive ne connaît qu'ouvertes. */
  readonly keepLocal: ReadonlySet<string>;
}

const isOpen = (r: TrainingRow): boolean => r.values['ended_at'] === null;

/**
 * Règles des séances ouvertes à l'import (REV-01 constat 1, D-85). Une seule séance ouverte à la fois : si une séance ouverte existe
 * déjà ici, elle reste (aucune n'est jamais supprimée ni écrasée) et chaque autre séance ouverte de l'archive est importée CLOSE à son
 * dernier instant connu (dernière série validée, sinon début) ; sans série validée elle est mise de côté (rien à garder). Une séance close
 * ici n'est jamais rouverte par une archive plus ancienne.
 */
function openWorkoutRules(local: ExportData, incoming: ExportData): OpenWorkoutRules {
  const skip = new Set<string>();
  const closeAt = new Map<string, string>();
  const keepLocal = new Set<string>();
  const localWorkouts = new Map(trainingRows(local, 'workout').map((r) => [r.id, r] as const));
  const localOpenIds = new Set([...localWorkouts.values()].filter(isOpen).map((r) => r.id));
  for (const id of localOpenIds) keepLocal.add(id);
  const candidates: TrainingRow[] = [];
  for (const r of trainingRows(incoming, 'workout')) {
    // Une séance ouverte ici n'est jamais écrasée par l'archive (ouverte ou close dans l'archive) : ni elle ni ses séries ne sont écrites.
    if (localOpenIds.has(r.id)) {
      skip.add(r.id);
      continue;
    }
    if (!isOpen(r)) continue;
    const here = localWorkouts.get(r.id);
    if (here && !isOpen(here)) {
      skip.add(r.id);
      keepLocal.add(r.id);
    } else candidates.push(r);
  }
  const keepOpen = new Set<string>();
  if (localOpenIds.size > 0) for (const r of candidates) if (localOpenIds.has(r.id)) keepOpen.add(r.id);
  if (localOpenIds.size === 0) {
    const latest = [...candidates].sort((a, b) => (String(a.values['started_at']) < String(b.values['started_at']) ? 1 : -1))[0];
    if (latest) keepOpen.add(latest.id);
  }
  for (const r of candidates) {
    if (keepOpen.has(r.id)) continue;
    const started = String(r.values['started_at']);
    let last: string | null = null;
    for (const s of trainingRows(incoming, 'workout_set')) {
      if (s.values['workout_id'] !== r.id || s.values['done'] !== 1 || typeof s.values['done_at'] !== 'string') continue;
      if (last === null || s.values['done_at'] > last) last = s.values['done_at'];
    }
    if (last === null) skip.add(r.id);
    else closeAt.set(r.id, last < started ? started : last);
  }
  return { skip, closeAt, keepLocal };
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
  // REV-01 constat 1 (D-57, D-27, D-85) : séances ouvertes.
  const open = openWorkoutRules(local, incoming);
  const childOfWorkout = (table: TrainingTable): string | null => trainingTable(table).parents.find((p) => p.table === 'workout')?.column ?? null;
  const skipRow = (table: TrainingTable, row: TrainingRow): boolean => {
    if (table === 'workout') return open.skip.has(row.id);
    const column = childOfWorkout(table);
    return column !== null && open.skip.has(String(row.values[column]));
  };
  const hasTraining = incoming.training !== undefined || (incoming.archiveSv !== undefined && incoming.archiveSv >= TRAINING_ALWAYS_SINCE_SV);
  const readOnly = new Set<TrainingTable>(local.readOnlyTables ?? []);
  let skippedReadOnly = 0;
  for (const table of TRAINING_EXPORT_TABLES) {
    if (readOnly.has(table)) {
      skippedReadOnly += trainingRows(incoming, table).length;
      continue;
    }
    const columns = trainingColumns(table);
    const localRows = new Map(trainingRows(local, table).map((r) => [r.id, r] as const));
    // REV-01 constat 3 : les décisions de cible s'écrivent dans l'ordre où elles ont été prises (l'HLC réattribué suit cet ordre) ; une
    // décision ACCEPTÉE plus ancienne que la dernière décision locale n'est pas réintroduite (elle prendrait le pas par son HLC neuf).
    const decidedAt = (r: TrainingRow): string => (typeof r.values['decided_at'] === 'string' ? r.values['decided_at'] : '');
    const incomingIdsOfTable = new Set(trainingRows(incoming, table).map((r) => r.id));
    // En remplacement, seules les décisions locales qui restent (présentes dans l'archive) comptent : les autres vont être supprimées.
    const newestLocalDecision = table === 'nutrition_target' ? [...localRows.values()].filter((r) => mode === 'merge' || incomingIdsOfTable.has(r.id)).map(decidedAt).sort().pop() ?? '' : '';
    const ordered = [...trainingRows(incoming, table)].sort((a, b) => (table === 'nutrition_target' && decidedAt(a) !== decidedAt(b) ? (decidedAt(a) < decidedAt(b) ? -1 : 1) : a.id < b.id ? -1 : 1));
    for (const incomingRow of ordered) {
      if (skipRow(table, incomingRow)) continue;
      if (table === 'nutrition_target' && !localRows.has(incomingRow.id) && incomingRow.values['accepted'] === 1 && decidedAt(incomingRow) !== '' && decidedAt(incomingRow) < newestLocalDecision) continue;
      const closed = table === 'workout' && open.closeAt.has(incomingRow.id) ? { ...incomingRow, values: { ...incomingRow.values, ended_at: open.closeAt.get(incomingRow.id) ?? null } } : incomingRow;
      const existing = localRows.get(closed.id);
      // FIX-0171 (constat 1, D-120) : une colonne absente de l'archive (schéma plus ancien) garde la valeur locale, dans les deux modes ; une valeur
      // nulle présente dans l'archive reste un effacement explicite. Ligne nouvelle : la colonne absente reste nulle.
      const row = existing && closed.absent && closed.absent.length > 0 ? { id: closed.id, values: { ...closed.values, ...Object.fromEntries(closed.absent.map((col) => [col, existing.values[col] ?? null])) } } : closed;
      if (existing && columns.every((col) => (existing.values[col] ?? null) === (row.values[col] ?? null))) unchanged += 1;
      else {
        trainingWrites.push({ table, row });
        ops.push({ kind: existing ? 'modify' : 'add', table, id: row.id });
      }
    }
  }
  if (mode === 'replace' && hasTraining) {
    for (const table of [...TRAINING_EXPORT_TABLES].reverse()) {
      if (readOnly.has(table)) continue;
      // Archive d'un schéma antérieur à la table : l'absence de ses clés n'est pas une donnée (I4-07), rien n'est supprimé.
      if (incoming.archiveSv !== undefined && incoming.archiveSv < (TABLE_SINCE_SV[table] ?? 0)) continue;
      const incomingIds = new Set(trainingRows(incoming, table).map((r) => r.id));
      for (const row of [...trainingRows(local, table)].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (incomingIds.has(row.id)) continue;
        // Jamais de suppression d'une séance ouverte locale ni de ses séries, ni d'une séance close que l'archive ne connaît qu'ouverte.
        if (table === 'workout' && (row.values['ended_at'] === null || open.keepLocal.has(row.id))) continue;
        const column = childOfWorkout(table);
        if (column !== null && open.keepLocal.has(String(row.values[column]))) continue;
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
    skippedReadOnly,
  };
}
