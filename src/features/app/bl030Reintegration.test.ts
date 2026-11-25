import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '../../db/driver';
import { reintegrateAfterMigration } from './bootstrap';

/**
 * BL-030 (audit Codex 0.26.0 ; SHELL-0294f, D-628) : réintégration des champs inconnus en échec au démarrage (`reintegrateAfterMigration`).
 * Panne simple (la lecture de `sync_unknown` échoue, l'écriture marche) : l'échec est gardé dans `sync_meta` (lu par l'écran de synchro,
 * survit au redémarrage) et le démarrage continue. Double panne (l'écriture de l'échec échoue aussi) : le démarrage continue, l'échec n'est
 * gardé nulle part, seul le journal le note — défaut établi, figé ici et laissé au registre (BL-030, « fait en partie ») : un état en
 * mémoire lu par la synchro le rendrait visible pour la session, au prix d'octets du départ à compenser. Pilote simulé, données synthétiques.
 */
function fakeDriver(writeFails: boolean) {
  const writes: { sql: string; params: readonly unknown[] }[] = [];
  const driver = {
    kind: 'memory',
    select: async (sql: string) => {
      if (sql.includes('COUNT(*)')) return [{ n: 3 }];
      throw Object.assign(new Error('lecture impossible'), { name: 'DbError' });
    },
    execute: async (sql: string, params: readonly unknown[] = []) => {
      if (writeFails) throw new Error('disque plein');
      writes.push({ sql, params });
      return { rowsAffected: 1 };
    },
    transaction: async () => {
      throw new Error('transaction refusée');
    },
    close: async () => undefined,
  } as unknown as SqlDriver;
  return { driver, writes };
}

describe('BL-030 : réintégration en échec au démarrage', () => {
  it('panne simple : échec gardé dans sync_meta (nom d’erreur et compte seulement), démarrage poursuivi', async () => {
    const f = fakeDriver(false);
    await expect(reintegrateAfterMigration(f.driver)).resolves.toBeNull();
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0]?.params[0]).toBe('reintegrationFailure');
    expect(JSON.parse(String(f.writes[0]?.params[1]))).toMatchObject({ fields: 3, tables: [], errors: ['DbError'] });
  });

  it('double panne : démarrage poursuivi, aucun état gardé (défaut établi, reste au registre)', async () => {
    const f = fakeDriver(true);
    await expect(reintegrateAfterMigration(f.driver)).resolves.toBeNull();
    expect(f.writes).toEqual([]);
  });
});
