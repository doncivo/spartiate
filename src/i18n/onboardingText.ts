import { onboardingFr } from './fr.onboarding';

/** Textes de l'onboarding, à part du catalogue principal ; importé seulement par des modules chargés à la demande. */
export type OnboardingTextKey = keyof typeof onboardingFr;

export function tOnboarding(key: OnboardingTextKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = onboardingFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}

/** Nombre affiché à la française : espace fine insécable entre milliers, virgule décimale (2760 → « 2 760 »). */
export const formatInt = (n: number): string => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
export const formatDecimal = (n: number): string => String(n).replace('.', ',');
