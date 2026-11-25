import { TUNABLE_BOUNDS, type TunableKey } from '../../domain/training/config';
import { decodeJson } from './jsonText';

/** DATA-0293 (§ 11, D-510) : surcharges de constantes par exercice, stockées en JSON dans `progression_profile.config_overrides` (écrit à la main, ADR 0008). */
export type ConfigOverrides = Readonly<Partial<Record<TunableKey, number>>>;

/** Longueur maximale du texte stocké (colonne bornée à 512 par la migration 0023). */
export const CONFIG_OVERRIDES_MAX = 512;

const KEYS = Object.keys(TUNABLE_BOUNDS) as TunableKey[];

/** Valeur d'une clé dans ses bornes (entière si la borne l'exige), sinon `undefined`. */
function inBounds(key: TunableKey, value: unknown): number | undefined {
  const bounds = TUNABLE_BOUNDS[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds.min || value > bounds.max) return undefined;
  if (bounds.integer === true && !Number.isInteger(value)) return undefined;
  return value;
}

/** Lecture tolérante : clés connues dans leurs bornes seulement ; texte illisible, absent ou d'une autre forme : objet vide. */
export function parseConfigOverrides(text: string | null): ConfigOverrides {
  const raw = decodeJson(text);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<TunableKey, number>> = {};
  for (const key of KEYS) {
    const value = inBounds(key, (raw as Record<string, unknown>)[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Écriture stricte : `null` si une clé est inconnue ou une valeur hors bornes ; `''` n'existe pas (objet vide : l'appelant écrit NULL). */
export function serializeConfigOverrides(overrides: ConfigOverrides): string | null | 'invalid' {
  const entries = Object.entries(overrides);
  const out: Partial<Record<TunableKey, number>> = {};
  for (const [key, value] of entries) {
    if (!(KEYS as string[]).includes(key)) return 'invalid';
    const ok = inBounds(key as TunableKey, value);
    if (ok === undefined) return 'invalid';
    out[key as TunableKey] = ok;
  }
  if (Object.keys(out).length === 0) return null;
  const text = JSON.stringify(out);
  return text.length > CONFIG_OVERRIDES_MAX ? 'invalid' : text;
}
