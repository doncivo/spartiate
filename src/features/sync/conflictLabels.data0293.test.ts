import { describe, expect, it } from 'vitest';
import { SYNC_CATALOGUE } from '../../domain/sync/syncTables';
import { fr } from '../../i18n/fr';
import { fieldLabel } from './conflictText';

/**
 * DATA-0293 (bundle de départ) : les libellés des champs du journal des conflits (`sync.field`) ne servent qu'à l'écran des conflits : hors du
 * catalogue principal (donc hors du JavaScript de départ), lus par `fieldLabel` depuis leur propre module. Comportement inchangé.
 */
describe('libellés des champs du journal des conflits hors du catalogue de départ', () => {
  it('le catalogue principal ne porte plus `sync.field`', () => {
    expect(Object.keys(fr.sync)).not.toContain('field');
  });

  it('fieldLabel rend le libellé de chaque colonne visible du catalogue de production', () => {
    for (const t of SYNC_CATALOGUE.tables) for (const c of t.columns) if (c.conflictVisible) expect(fieldLabel(t, c).startsWith('sync.field.'), `${t.name}.${c.name}`).toBe(false);
    const workoutSet = SYNC_CATALOGUE.table('workout_set');
    const weekday = SYNC_CATALOGUE.table('routine_day')?.columns.find((c) => c.name === 'weekday');
    expect(workoutSet).toBeDefined();
    expect(fieldLabel({ name: 'routine_day' }, { name: weekday?.name ?? 'weekday' })).toBe('jour de la semaine');
  });
});
