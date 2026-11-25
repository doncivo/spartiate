/** Nombre de chargements retenus par la mesure de démarrage (impair : la médiane est une mesure réelle). SHELL-0294e, D-614. */
export const START_RUNS = 5;

/** Médiane d'une série de mesures en millisecondes (série non vide, ordre quelconque). */
export function medianMs(values: readonly number[]): number {
  if (values.length === 0) throw new Error('aucune mesure');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const high = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? high : ((sorted[middle - 1] ?? 0) + high) / 2;
}
