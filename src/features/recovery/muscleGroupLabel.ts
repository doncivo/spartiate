import { recoveryFr } from '../../i18n/fr.recovery';

/**
 * Libellé français d'un groupe musculaire de `muscle_recovery.muscle_group` (BL-142). Les lignes écrites depuis cette version portent un
 * identifiant neutre (`legs`) ; les lignes plus anciennes portent déjà le libellé (« Jambes ») : un groupe sans libellé connu est rendu tel quel.
 */
export function muscleGroupLabel(group: string): string {
  const labels = recoveryFr as unknown as Readonly<Record<string, string>>;
  return labels[`muscleGroup_${group}`] ?? group;
}
