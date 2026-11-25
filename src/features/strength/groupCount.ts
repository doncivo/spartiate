import { getLocale } from '../../i18n';

/** Clé du catalogue `strength` pour « {n} groupe(s) » : le pluriel suit la langue (français : 0 et 1 au singulier, C-084). */
export function groupCountKey(n: number): 'groupOne' | 'groupMany' {
  return new Intl.PluralRules(getLocale()).select(n) === 'one' ? 'groupOne' : 'groupMany';
}
