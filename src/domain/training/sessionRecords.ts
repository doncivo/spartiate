import type { PersonalRecord } from './closure';

/**
 * SEANCE-0292b (§ 17.1 a, C-191, D-540) : records établis par une série que l'on vient de valider, signalés en séance. Les records sont ceux
 * du résumé (`personalRecords` : charge la plus lourde, meilleure série en kg soulevés, contre les séances closes antérieures) ; seuls ceux
 * dont la série est `setId` sont dits. Module pur.
 */
export function recordsOfSet(records: readonly PersonalRecord[], setId: string): PersonalRecord[] {
  return records.filter((r) => r.setId === setId);
}
