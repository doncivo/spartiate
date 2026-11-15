import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ERGO-02b critère 6 : aucune clé de catalogue sans appelant. Une clé est vivante si elle apparaît dans le code de l'app (src/**, hors
 * tests et hors catalogues fr.*.ts) entre guillemets (`tX('clé')`, table de correspondance, chemin pointé `'sync.status.clé'`, paire
 * de `tPlural`) ou en propriété (`fr.clé`, `texts.window.clé`).
 *
 * Limite assumée : le garde cherche des jetons, pas des appels typés. Un nom très courant (`count`, `unknown`) qui figure ailleurs entre
 * guillemets passe pour vivant ; le typage (`MessageKey`, `keyof typeof …Fr`) rattrape ensuite tout appel à une clé retirée. Les
 * clés construites (`` `prefixe_${x}` ``) sont déclarées dans WHITELIST, une ligne par famille, avec la raison.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const i18n = fileURLToPath(new URL('.', import.meta.url));

/** Catalogues hérités retirés par SPA-001b : voir RETIRED de plural.test.ts (même liste). */
const RETIRED = new Set(['fr.importCsv.ts', 'fr.scan.ts', 'fr.events.ts', 'fr.capture.ts', 'fr.notifications.ts', 'fr.syncField.ts', 'fr.syncCarryReport.ts', 'fr.ts']);

/** « fichier:clé » exacte, ou « fichier:préfixe* » pour une famille construite à l'exécution. Une entrée sans clé correspondante échoue. */
const WHITELIST: readonly string[] = [
  'fr.backup.ts:recoveryFailed', // message natif de desktop.rs ; recoveryMessage.test.ts garde le texte identique des deux côtés
  'fr.bodyProgress.ts:health_*', // BodyProgress.tsx : tBodyProgress(`health_${m.kind}`), un libellé par grandeur importée
  'fr.health.ts:recReason_*', // HealthBodyImportSection / RecoveryImportSection : tHealth(`recReason_${reason}`), une par ShortcutRejectReason
  'fr.health.ts:bodyType_*', // HealthBodyImportSection : tHealth(`bodyType_${BODY_METRIC_OF[name]}`)
  'fr.recovery.ts:abstain_*', // RecoveryToday : tRecovery(`abstain_${recovery.reason}`), un par abstain_reason (§ 16.5)
  'fr.recovery.ts:quality_*', // RecoveryToday : tRecovery(`quality_${s.quality}`), un par qualité
  'fr.recovery.ts:explain_*', // RecoveryToday : tRecovery(`explain_${k}`), un par code d'explication du score
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = `${dir}${name}`;
    return statSync(path).isDirectory() ? walk(`${path}/`) : [path];
  });

const isTest = (path: string): boolean => /\.(test|qa\.test|spec)\.tsx?$/.test(path) || /\/(__tests__|testing)\//.test(path);

const sources = walk(root)
  .map((path) => path.split('\\').join('/'))
  .filter((path) => /\.tsx?$/.test(path) && !isTest(path) && !/\/i18n\/fr\.\w+\.ts$/.test(path))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

/** Jetons d'appel : chaînes entre guillemets (et dernier segment d'un chemin pointé) et propriétés. */
const used = new Set<string>();
for (const m of sources.matchAll(/['"`]([\w.]+)['"`]/g)) {
  const text = m[1] ?? '';
  used.add(text);
  used.add(text.split('.').pop() ?? text);
}
for (const m of sources.matchAll(/\.(\w+)/g)) used.add(m[1] ?? '');

const ENTRY = /^\s*['"]?(\w+)['"]?:\s*['"`(]/;
const catalogues = readdirSync(i18n).filter((f) => /^fr\..*\.ts$/.test(f) && !f.endsWith('.test.ts') && !RETIRED.has(f));

const deadKeys = (file: string): string[] => {
  const keys = readFileSync(`${i18n}${file}`, 'utf8')
    .split('\n')
    .flatMap((line) => {
      const m = ENTRY.exec(line);
      return m ? [m[1] ?? ''] : [];
    });
  return [...new Set(keys)].filter((key) => !used.has(key) && !WHITELIST.some((w) => matches(w, file, key)));
};

const matches = (entry: string, file: string, key: string): boolean => {
  const [f, k = ''] = entry.split(':');
  if (f !== file) return false;
  return k.endsWith('*') ? key.startsWith(k.slice(0, -1)) : key === k;
};

describe('clés de catalogue sans appelant', () => {
  it('les catalogues vivants sont trouvés', () => {
    expect(catalogues.length).toBeGreaterThan(30);
  });

  for (const file of catalogues) {
    it(`${file} : aucune clé morte`, () => {
      expect(deadKeys(file)).toEqual([]);
    });
  }

  it('chaque ligne de la liste blanche désigne au moins une clé existante', () => {
    const stale = WHITELIST.filter((entry) => {
      const file = entry.split(':')[0] ?? '';
      const keys = readFileSync(`${i18n}${file}`, 'utf8')
        .split('\n')
        .flatMap((line) => {
          const m = ENTRY.exec(line);
          return m ? [m[1] ?? ''] : [];
        });
      return !keys.some((key) => matches(entry, file, key));
    });
    expect(stale).toEqual([]);
  });
});
