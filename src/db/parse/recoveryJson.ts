import type { Contributor, RecoveryExplanationKey } from '../../domain/recovery';
import { decodeJson } from './jsonText';

/**
 * Validation à la main des JSON de `recovery_day` (ADR 0008) : contributeurs et clés d'explication. Valeur typée ou `null` (texte illisible,
 * mauvais type ; une clé d'explication inconnue, écrite par un iPhone plus récent, est ignorée). Jamais d'exception, jamais de valeur devinée.
 */

const MAX_LIST = 32;
const CONTRIBUTOR_KEYS: readonly Contributor['key'][] = ['hrv', 'resting_hr', 'sleep'];
/** Doit rester égale à `RecoveryExplanationKey` (le `satisfies` refuse une clé inconnue du domaine ; le test de la base compare les deux). */
export const EXPLANATION_KEYS = [
  'exertion_cardio_not_counted',
  'exertion_cardio_srpe',
  'sleep_short',
  'sleep_debt',
  'baseline_outliers_excluded',
  'level_b_absolute_thresholds',
] as const satisfies readonly RecoveryExplanationKey[];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseContributors(text: string | null): Contributor[] | null {
  const value = decodeJson(text);
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const out: Contributor[] = [];
  for (const item of value as unknown[]) {
    if (!isRecord(item)) return null;
    const { key, value: v, weight, unusual } = item;
    if (typeof key !== 'string' || !CONTRIBUTOR_KEYS.includes(key as Contributor['key'])) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    if (weight !== null && (typeof weight !== 'number' || !Number.isFinite(weight))) return null;
    // FIX-0172 (D-134) : décision « inhabituel » publiée ; un autre type (appareil plus récent) est ignoré, jamais deviné ni refusé.
    out.push({ key: key as Contributor['key'], value: v, weight, ...(typeof unusual === 'boolean' ? { unusual } : {}) });
  }
  return out;
}

export function parseExplanationKeys(text: string | null): RecoveryExplanationKey[] | null {
  const value = decodeJson(text);
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const out: RecoveryExplanationKey[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string') return null;
    if (!(EXPLANATION_KEYS as readonly string[]).includes(item)) continue;
    if (!out.includes(item as RecoveryExplanationKey)) out.push(item as RecoveryExplanationKey);
  }
  return out;
}

export const encodeContributors = (items: readonly Contributor[]): string =>
  JSON.stringify(items.map(({ key, value, weight, unusual }) => ({ key, value, weight, ...(typeof unusual === 'boolean' ? { unusual } : {}) })));
export const encodeExplanationKeys = (keys: readonly RecoveryExplanationKey[]): string => JSON.stringify(keys);
