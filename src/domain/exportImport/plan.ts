/**
 * Plan d'import (SPA-005, D-57) : compare l'état local à l'archive validée et décrit, sans rien écrire, ce que l'import ajouterait,
 * modifierait ou supprimerait. L'aperçu affiche ce plan ; l'écriture (transaction, horloges, file d'envoi) l'applique tel quel.
 *
 * - « fusionner » : identités D-55 (`profile|singleton`, `weight|date|source`) ; ce qui est absent de l'archive reste ; une valeur NULL
 *   du profil de l'archive n'efface jamais une valeur locale ;
 * - « remplacer » : l'archive devient l'état ; toute ligne locale absente est supprimée logiquement (jamais de tombstone).
 */

import type { ExportData, ExportProfile, ExportWeight } from './archive';

export type ImportMode = 'merge' | 'replace';
export type ImportTable = 'profile' | 'body_weight' | 'settings';

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
}

export interface ImportPlan {
  readonly mode: ImportMode;
  readonly ops: readonly ImportOp[];
  readonly counts: ImportCounts;
  readonly writes: ImportWrites;
}

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

  const count = (kind: ImportOp['kind']): number => ops.filter((o) => o.kind === kind).length;
  return {
    mode,
    ops,
    counts: { add: count('add'), modify: count('modify'), delete: count('delete'), unchanged },
    writes: { profile: profileWrite, deleteProfile, weights: weightWrites, deleteWeightIds, settings: settingsWrite },
  };
}
