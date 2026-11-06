import type { ExerciseInstructions, ExerciseMedia, MuscleWeight } from '../../domain/training';

/**
 * Validation à la main des JSON persistés d'un exercice (ADR 0008, PRD § 20.3). Chaque fonction reçoit une valeur déjà décodée et rend
 * la valeur typée et normalisée, ou `null` : jamais d'exception. Appliquées à l'écriture (refus) et à la lecture (repli).
 */

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_LIST = 32;
const MAX_TEXT = 4_000;
const MAX_ALIAS = 120;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseMuscles(value: unknown): MuscleWeight[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LIST) return null;
  const seen = new Set<string>();
  const out: MuscleWeight[] = [];
  for (const item of value as unknown[]) {
    if (!isRecord(item)) return null;
    const { id, weight } = item;
    if (typeof id !== 'string' || !ID_RE.test(id) || seen.has(id)) return null;
    if (typeof weight !== 'number' || !(weight > 0 && weight <= 1)) return null;
    seen.add(id);
    out.push({ id, weight });
  }
  return out;
}

export function parseEquipmentIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const out: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string' || !ID_RE.test(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export function parseAliases(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const out: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string' || item.length > MAX_ALIAS) return null;
    out.push(item);
  }
  return out;
}

export function parseInstructions(value: unknown): ExerciseInstructions | null {
  if (!isRecord(value)) return null;
  const { setup, execution, mistakes } = value;
  if (typeof setup !== 'string' || typeof execution !== 'string' || setup.length > MAX_TEXT || execution.length > MAX_TEXT) return null;
  if (!Array.isArray(mistakes) || mistakes.length > MAX_LIST) return null;
  const list: string[] = [];
  for (const m of mistakes as unknown[]) {
    if (typeof m !== 'string' || m.length > MAX_TEXT) return null;
    list.push(m);
  }
  return { setup, execution, mistakes: list };
}

/** `null` est une valeur valide (pas de média) : à distinguer d'un refus par l'appelant (`value === null`). */
export function parseMedia(value: unknown): ExerciseMedia | null {
  if (!isRecord(value)) return null;
  const { images, video, license, source } = value;
  if (!Array.isArray(images) || images.length > MAX_LIST || !(images as unknown[]).every((i) => typeof i === 'string' && i.length <= 256)) return null;
  if (video !== null && (typeof video !== 'string' || video.length > 256)) return null;
  if (typeof license !== 'string' || typeof source !== 'string' || license.length > 256 || source.length > 256) return null;
  return { images: images as string[], video, license, source };
}
