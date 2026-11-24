/**
 * SEANCE-0292 (C-066, D-499) : lecture d'une liste de poids saisie dans un profil de matériel (disques par côté, kettlebells). Les poids sont
 * séparés par des points-virgules ; la virgule est la décimale française. Une décimale qui n'est pas un multiple de 0,25 kg (« 12,16 »,
 * « 20,1 ») n'existe pas dans une salle : c'est presque sûrement deux poids séparés par une virgule ; la liste est refusée avec un motif qui le
 * dit, jamais devinée.
 */

export type WeightListIssue = 'invalid' | 'separator';

export type WeightListResult = { readonly ok: true; readonly values: readonly number[] } | { readonly ok: false; readonly issue: WeightListIssue; readonly item: string };

/** Pas des poids réels (kg) : 0,25 (micro-disques, 1,25, 2,5…). */
export const WEIGHT_QUARTER_KG = 0.25;

const NUMBER_RE = /^\d+([.,]\d+)?$/;

/** Un poids lu, ou le motif de son refus. */
export function parseWeightItem(item: string): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly issue: WeightListIssue } {
  const text = item.trim();
  if (!NUMBER_RE.test(text)) return { ok: false, issue: text.includes(',') ? 'separator' : 'invalid' };
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return { ok: false, issue: 'invalid' };
  const quarters = value / WEIGHT_QUARTER_KG;
  if (Math.abs(quarters - Math.round(quarters)) > 1e-9) return { ok: false, issue: text.includes(',') ? 'separator' : 'invalid' };
  return { ok: true, value };
}

/** Liste « 20 ; 10 ; 1,25 » ; vide : liste vide. */
export function parseWeightList(text: string): WeightListResult {
  const values: number[] = [];
  for (const raw of text.split(';')) {
    const item = raw.trim();
    if (item === '') continue;
    const read = parseWeightItem(item);
    if (!read.ok) return { ok: false, issue: read.issue, item };
    values.push(read.value);
  }
  return { ok: true, values };
}
