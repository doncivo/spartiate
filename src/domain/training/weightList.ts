/**
 * SEANCE-0292 (C-066, D-499) : lecture d'une liste de poids saisie dans un profil de matériel (disques par côté, kettlebells). Les poids sont
 * séparés par des points-virgules ; la virgule est la décimale française. Une décimale qui n'est pas un multiple de 0,25 kg (« 12,16 »,
 * « 20,1 ») n'existe pas dans une salle : c'est presque sûrement deux poids séparés par une virgule ; la liste est refusée avec un motif qui le
 * dit, jamais devinée.
 */

export type WeightListIssue = 'invalid' | 'separator' | 'duplicate';

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
    if (values.includes(read.value)) return { ok: false, issue: 'duplicate', item };
    values.push(read.value);
  }
  return { ok: true, values };
}

/** SEANCE-0292 (C-081, D-500) : nombre de disques d'un poids par côté, au plus (au-delà : saisie fautive). */
export const MAX_PLATES_PER_WEIGHT = 20;

export type PlateListResult =
  | { readonly ok: true; readonly plates: readonly { readonly weightKg: number; readonly count: number }[] }
  | { readonly ok: false; readonly issue: WeightListIssue; readonly item: string };

const COUNT_RE = /^(.+?)\s*[×xX*]\s*(\d+)$/;

/**
 * SEANCE-0292 (C-081, D-500) : disques par côté, « 20 × 4 ; 10 » (quatre disques de 20 kg par côté, un de 10) ; « x » ou « * » valent « × » ;
 * sans nombre : un disque. Nombre de 1 à 20 ; poids en double refusé.
 */
export function parsePlateList(text: string): PlateListResult {
  const plates: { weightKg: number; count: number }[] = [];
  for (const raw of text.split(';')) {
    const item = raw.trim();
    if (item === '') continue;
    const m = COUNT_RE.exec(item);
    const read = parseWeightItem(m ? (m[1] ?? '') : item);
    if (!read.ok) return { ok: false, issue: read.issue, item };
    const count = m ? Number(m[2]) : 1;
    if (!Number.isInteger(count) || count < 1 || count > MAX_PLATES_PER_WEIGHT) return { ok: false, issue: 'invalid', item };
    if (plates.some((p) => p.weightKg === read.value)) return { ok: false, issue: 'duplicate', item };
    plates.push({ weightKg: read.value, count });
  }
  return { ok: true, plates };
}
