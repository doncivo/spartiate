import { describe, expect, it } from 'vitest';
import { migrationChecksum } from '../migrator';
import { migrationPlan } from './manifest';
import { migrations } from './index';

/**
 * DATA-0292 : le départ de l'app n'embarque que le MANIFESTE (version, nom, somme de contrôle) ; les instructions SQL (`migrations`) sont chargées
 * à la demande. Le manifeste doit rester égal aux migrations : une migration modifiée ou ajoutée sans régénérer le manifeste échoue ici.
 * Régénération : `UPDATE_MIGRATION_MANIFEST=1 npx vitest run --coverage.enabled=false src/db/migrations/manifest.test.ts`.
 */
describe('manifeste des migrations', () => {
  it('une entrée par migration, même version, même nom, même somme de contrôle', () => {
    expect(migrationPlan.entries).toEqual(migrations.map((m) => ({ version: m.version, name: m.name, checksum: migrationChecksum(m) })));
  });

  it('load() rend le registre complet', async () => {
    expect(await migrationPlan.load()).toBe(migrations);
  });
});
