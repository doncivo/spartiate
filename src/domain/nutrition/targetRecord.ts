/**
 * Enregistrement d'une cible nutritionnelle (PRD § 15.2, § 20.2 ; D-74 points 5 et 7 ; I4-02). Module pur. Une ligne par DÉCISION, jamais
 * modifiée : la modification d'Ali est une nouvelle ligne (`source` manual), une proposition refusée est conservée (`accepted` faux) pour la
 * trace. La cible en vigueur est la dernière ligne acceptée dont la semaine a commencé.
 */

import {
  isLocalDate,
  type Hlc,
  type IsoDateTime,
  type LocalDate,
} from "../types";
import { NUTRITION_CONFIG } from "./config";
import type { RestPlan } from "./restDay";
import type { Target } from "./types";

export const TARGET_SOURCES = ["auto", "manual"] as const;
export type TargetSource = (typeof TARGET_SOURCES)[number];

/** Plafond de plausibilité d'une cible, en kcal. */
export const TARGET_KCAL_MAX = 10_000;

export interface TargetRecordDraft {
  /** Début de la semaine d'application (date civile locale). */
  readonly weekStart: LocalDate;
  readonly target: Target;
  /** `auto` : proposition du moteur (acceptée telle quelle ou refusée) ; `manual` : valeurs choisies par Ali. */
  readonly source: TargetSource;
  readonly accepted: boolean;
  /** Version du moteur qui a produit la proposition (traçabilité) ; `null` pour une cible manuelle. */
  readonly engineVersion: number | null;
  /** Ali a confirmé explicitement une cible sous 1 200 kcal (§ 15.2) : condition d'écriture, non stockée. */
  readonly lowFloorConfirmed: boolean;
  /** PROG-01 (D-271) : cible des jours de repos ; absente ou nulle : une seule cible (comportement d'avant). */
  readonly restPlan?: RestPlan | null;
}

export type TargetRecordIssue =
  | "week-invalid"
  | "source-invalid"
  | "engine-version-invalid"
  | "value-invalid"
  | "kcal-below-minimum"
  | "confirmation-required";

export function validateTargetRecord(
  draft: TargetRecordDraft,
): TargetRecordIssue[] {
  const issues: TargetRecordIssue[] = [];
  if (!isLocalDate(draft.weekStart)) issues.push("week-invalid");
  if (!(TARGET_SOURCES as readonly string[]).includes(draft.source))
    issues.push("source-invalid");
  if (
    draft.engineVersion !== null &&
    (!Number.isInteger(draft.engineVersion) || draft.engineVersion < 1)
  )
    issues.push("engine-version-invalid");
  const { kcal, proteinG, fatG, carbG } = draft.target;
  const grams = [proteinG, fatG, carbG];
  const rest = draft.restPlan ?? null;
  const restInvalid =
    rest !== null &&
    (!Number.isFinite(rest.rest.kcal) ||
      rest.rest.kcal <= 0 ||
      rest.rest.kcal > TARGET_KCAL_MAX ||
      !Number.isFinite(rest.rest.carbG) ||
      rest.rest.carbG < 0 ||
      rest.trainingDays.length === 0);
  if (
    restInvalid ||
    !Number.isFinite(kcal) ||
    kcal <= 0 ||
    kcal > TARGET_KCAL_MAX ||
    grams.some((g) => !Number.isFinite(g) || g < 0)
  ) {
    issues.push("value-invalid");
    return issues;
  }
  // Plancher (D-74 point 7) : seulement pour une cible adoptée ; la trace d'une proposition refusée est conservée telle quelle.
  if (draft.accepted) {
    // PROG-01 (revue du 14/11) : le plancher vaut aussi pour la cible des jours de repos.
    const lowest = rest === null ? kcal : Math.min(kcal, rest.rest.kcal);
    if (lowest < NUTRITION_CONFIG.confirmedFloorKcal)
      issues.push("kcal-below-minimum");
    else if (lowest < NUTRITION_CONFIG.floorKcal && !draft.lowFloorConfirmed)
      issues.push("confirmation-required");
  }
  return issues;
}

export interface TargetRecord {
  readonly id: string;
  readonly weekStart: LocalDate;
  readonly target: Target;
  readonly source: TargetSource;
  readonly accepted: boolean;
  /** PROG-01 : cible des jours de repos (`null` : une seule cible). */
  readonly restPlan?: RestPlan | null;
  readonly createdAt: IsoDateTime;
  /** Ordre causal de la décision (colonne `hlc`, lecture seule) : horloge d'appareil non fiable, HLC si. */
  readonly hlc: Hlc;
}

const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

/**
 * FIX-0271 (D-314) : date (locale, fuseau de l'appareil) à laquelle la décision a été prise, lue dans la partie physique de son HLC (jamais
 * `created_at` : horloge d'appareil non fiable entre appareils ; une ligne importée porte le HLC de l'import). HLC illisible : `null`.
 */
export function targetDecidedOn(
  record: Pick<TargetRecord, "hlc">,
): LocalDate | null {
  const ms = /^(\d{15})-/.exec(record.hlc)?.[1];
  if (ms === undefined) return null;
  const d = new Date(Number(ms));
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate;
}

/** FIX-0271 (D-314) : prise d'effet d'une décision = le plus tardif de sa semaine et de sa date de décision. */
export function targetInForceSince(
  record: Pick<TargetRecord, "weekStart" | "hlc">,
): LocalDate {
  const decided = targetDecidedOn(record);
  return decided !== null && decided > record.weekStart
    ? decided
    : record.weekStart;
}

/**
 * Cible en vigueur à `date` (D-82 amendée par D-314) : parmi les lignes ACCEPTÉES dont la semaine a commencé le `date` ou avant, la prise
 * d'effet la plus TARDIVE gagne (`targetInForceSince` : max(semaine, date de décision)), puis la dernière décision par HLC, puis l'UUID.
 * Une cible prévue pour une date future n'est donc jamais battue par une décision prise avant sa date (check-in d'une semaine passée,
 * décision reçue de l'autre appareil) ; une décision prise à sa date ou après, quelle que soit sa semaine, passe devant (dernière décision
 * d'Ali), et à prise d'effet égale le HLC tranche comme avant : un check-in du lundi accepté le mercredi passe devant la cible du mardi.
 */
export function effectiveTarget<
  T extends Pick<TargetRecord, "id" | "weekStart" | "accepted" | "hlc">,
>(records: readonly T[], date: LocalDate): T | null {
  let best: T | null = null;
  let bestSince = "";
  for (const r of records) {
    if (!r.accepted || r.weekStart > date) continue;
    const since = targetInForceSince(r);
    if (
      best === null ||
      since > bestSince ||
      (since === bestSince &&
        (r.hlc > best.hlc || (r.hlc === best.hlc && r.id > best.id)))
    ) {
      best = r;
      bestSince = since;
    }
  }
  return best;
}

/**
 * FIX-0271 (U-12) : cible de repos à reprendre dans une décision de check-in. Le check-in lit la cible de la semaine analysée (jusqu'à
 * `weekEnd`) ; une décision plus récente, en vigueur aujourd'hui (la cible de repos enregistrée le matin du check-in), porte le plan actuel.
 */
export function checkInRestPlan<
  T extends Pick<
    TargetRecord,
    "id" | "weekStart" | "accepted" | "hlc" | "restPlan"
  >,
>(
  records: readonly T[],
  weekEnd: LocalDate,
  today: LocalDate,
): RestPlan | null {
  const now = effectiveTarget(records, today);
  const analysed = effectiveTarget(records, weekEnd);
  return (now ?? analysed)?.restPlan ?? null;
}

/**
 * FIX-0244 (D-291) : Stratégie › historique. Une recopie (même semaine, mêmes valeurs, même source, même acceptation, même version du moteur
 * que la décision précédente de cette semaine ; seul le plan de repos peut différer) ne porte aucune valeur nouvelle : elle est fusionnée avec
 * la précédente, la plus récente restant affichée (c'est elle qui porte le plan en vigueur). Une autre décision de la même semaine entre deux
 * identiques empêche la fusion. L'ordre d'entrée est conservé ; les enregistrements eux-mêmes ne sont jamais modifiés.
 */
export function collapseRecopies<
  T extends Pick<
    TargetRecord,
    "id" | "weekStart" | "target" | "source" | "accepted" | "hlc"
  > & { readonly engineVersion?: number | null },
>(records: readonly T[]): readonly T[] {
  const key = (r: T): string =>
    JSON.stringify([
      r.weekStart,
      r.target.kcal,
      r.target.proteinG,
      r.target.fatG,
      r.target.carbG,
      r.source,
      r.accepted,
      r.engineVersion ?? null,
    ]);
  const byWeek = new Map<string, T[]>();
  for (const r of records)
    byWeek.set(r.weekStart, [...(byWeek.get(r.weekStart) ?? []), r]);
  const dropped = new Set<string>();
  for (const week of byWeek.values()) {
    const ordered = [...week].sort((a, b) =>
      a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : a.id < b.id ? -1 : 1,
    );
    for (let i = 0; i < ordered.length - 1; i++) {
      const [now, next] = [ordered[i], ordered[i + 1]];
      if (now !== undefined && next !== undefined && key(now) === key(next))
        dropped.add(now.id);
    }
  }
  return records.filter((r) => !dropped.has(r.id));
}

/**
 * ERGO-03 (D-295) : cibles À VENIR après `today`, dans l'ordre des dates : pour chaque date postérieure portant une décision acceptée, la
 * cible qui y sera en vigueur (`effectiveTarget`) quand c'est bien une décision de cette date (une décision plus récente d'une semaine
 * antérieure la masque : elle n'est pas à venir). Même relevé que FIX-0244 (D-291).
 */
export function upcomingTargets<
  T extends Pick<TargetRecord, "id" | "weekStart" | "accepted" | "hlc">,
>(records: readonly T[], today: LocalDate): readonly T[] {
  const dates = [
    ...new Set(
      records
        .filter((r) => r.accepted && r.weekStart > today)
        .map((r) => r.weekStart),
    ),
  ].sort();
  const out: T[] = [];
  for (const date of dates) {
    const winner = effectiveTarget(records, date);
    if (winner !== null && winner.weekStart === date) out.push(winner);
  }
  return out;
}
