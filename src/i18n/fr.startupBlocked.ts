/**
 * Textes de l'écran « Démarrage bloqué », à part du catalogue principal (bundle de départ) : chargés seulement quand une étape du
 * démarrage dépasse 8 secondes.
 */
export const startupBlockedFr = {
  title: 'Démarrage bloqué : {step}',
  detail: 'Cette étape dure depuis {seconds} secondes. Vos données ne sont pas touchées.',
  retry: 'Réessayer',
  share: 'Partager le journal',
  shared: 'Journal partagé.',
  shareFailed: 'Le partage n’a pas pu s’ouvrir.',
  shareTitle: 'Journal technique de Spartiate',
} as const;

export type StartupBlockedKey = keyof typeof startupBlockedFr;

export function tStartupBlocked(key: StartupBlockedKey, params?: Readonly<Record<string, string | number>>): string {
  const text: string = startupBlockedFr[key];
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (params[name] === undefined ? match : String(params[name]))) : text;
}
