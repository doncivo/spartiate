import type { ProgressionConfig } from './config';
import { analyzeHistory, current1rmFromSessions, isEligibleSet, totalLoad, type BodyLoad } from './estimate1rm';
import type { SetKind } from './session';
import type { ExerciseSession } from './types';

/**
 * FIX-ABERR (C-005 ; PRD § 11.5 « aberrantes signalées avant enregistrement ») : contrôle d'une série de travail saisie, AVANT son écriture.
 * Module pur, chargé avec la séance active (jamais dans le départ).
 *
 * - Référence : le 1RM courant du moteur (`analyzeHistory`, séries aberrantes non confirmées écartées) ramené aux répétitions saisies (Epley
 *   inverse) ; à défaut (aucune séance valide : partielles ou décharges seulement), la plus grande charge de travail validée de l'historique.
 * - Signalée : charge (totale pour un exercice au poids du corps de poids connu) > `outlierRatio` × référence ; seuil inclus non signalé.
 * - Rien sans historique (bornes absolues de `validateSetBounds` seules), sans charge ou répétitions, hors série de travail, ni pour une charge
 *   déjà validée dans la séance (une question par charge).
 * - Assisté : la charge saisie est l'assistance ; poids de corps connu, une assistance anormalement BASSE (charge totale trop haute) est
 *   signalée ; inconnu, aucun contrôle relatif (une assistance haute allège l'exercice, une basse ne se chiffre pas sans le poids du corps).
 */

export interface EntryOutlier {
  /** Charge saisie (lest ou assistance pour un exercice au poids du corps). */
  readonly loadKg: number;
  /** Charge habituelle pour ces répétitions, dans la même unité que la saisie, arrondie au demi-kilo. */
  readonly usualKg: number;
  /** Charge (totale) saisie en % de la référence, arrondi à l'entier. */
  readonly percent: number;
}

export interface EntryOutlierOptions {
  readonly config: ProgressionConfig;
  readonly bodyweightKg?: number | null;
  readonly bodyweightFraction?: number | null;
  readonly assisted?: boolean;
  /** Charge la plus « lourde » déjà validée pour cet exercice dans la séance en cours (la plus basse pour un assisté) ; null : aucune. */
  readonly doneInSessionKg?: number | null;
}

const EPS = 1e-9;
const halfKg = (kg: number): number => Math.round(kg * 2) / 2;

export function entryOutlier(entry: { readonly loadKg: number | null; readonly reps: number | null }, kind: SetKind, history: readonly ExerciseSession[], options: EntryOutlierOptions): EntryOutlier | null {
  const { loadKg, reps } = entry;
  const { config } = options;
  if (kind !== 'work' || loadKg === null || reps === null || !Number.isFinite(loadKg) || !Number.isInteger(reps) || reps < 1) return null;
  const assisted = options.assisted === true;
  const done = options.doneInSessionKg ?? null;
  if (done !== null && (assisted ? loadKg >= done : loadKg <= done)) return null;
  const fraction = options.bodyweightFraction ?? null;
  const bodyKg = options.bodyweightKg ?? null;
  const body: BodyLoad | null = fraction !== null && fraction > 0 && bodyKg !== null && bodyKg > 0 ? { baseKg: bodyKg * fraction, sign: assisted ? -1 : 1 } : null;
  if (assisted && body === null) return null;
  if (body === null && !(loadKg > 0)) return null;
  const total = totalLoad(loadKg, body);
  if (!(total > 0) || history.length === 0) return null;
  const current = current1rmFromSessions(analyzeHistory(history, config, body).estimates, config);
  let usual: number;
  if (current !== null) usual = current / (1 + reps / 30);
  else {
    const loads = history.flatMap((s) => s.sets.filter((x) => isEligibleSet(x, body)).map((x) => totalLoad(x.loadKg ?? 0, body)));
    if (loads.length === 0) return null;
    usual = Math.max(...loads);
  }
  if (!(usual > 0) || total <= config.outlierRatio * usual + EPS) return null;
  const usualKg = body === null ? usual : Math.max(0, (usual - body.baseKg) / body.sign);
  return { loadKg, usualKg: halfKg(usualKg), percent: Math.round((total / usual) * 100) };
}
