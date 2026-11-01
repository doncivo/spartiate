// SPA-001a, critères 1 à 4 : identité technique et de marque de Spartiate (D-30, D-32, D-41, D-47, D-51).
// La convention de qualification des mentions (protection des données CircleTasks, négation, historique) vit dans lib/mentions.mjs.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script .mjs sans déclaration de types
import { activeMentions, classifyLine } from './lib/mentions.mjs';

const root = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lecture de JSON de configuration, forme libre
type Json = Record<string, any>;
const json = (path: string): Json => JSON.parse(read(path)) as Json;
/** Fichiers suivis qui contiennent « circletasks » (insensible à la casse) : préfiltre git, lire les 2 800 fichiers suivis serait trop lent. */
const tracked = (): string[] => {
  const result = spawnSync('git', ['grep', '-l', '-i', '-z', '-I', 'circletasks'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 && result.status !== 1) throw new Error(`git grep a échoué : ${result.stderr}`);
  return result.stdout.split('\0').filter(Boolean);
};

const OLD_ID = 'fr.circletasks.planner';
const OLD_DB = 'circletasks.db';

describe('configuration Tauri', () => {
  const conf = json('src-tauri/tauri.conf.json');
  it('porte l’identité Spartiate', () => {
    expect(conf.productName).toBe('Spartiate');
    expect(conf.identifier).toBe('fr.spartiate.app');
    expect(conf.version).toBe('0.1.0');
    expect(conf.app.windows[0].title).toBe('Spartiate');
  });
  it('rend withGlobalTauri explicitement faux (D-47 7)', () => {
    expect(conf.app.withGlobalTauri).toBe(false);
  });
  it('ne configure aucun updater (D-30) : ni bloc, ni clé, ni endpoint', () => {
    expect(conf.plugins?.updater).toBeUndefined();
    expect(JSON.stringify(conf)).not.toMatch(/pubkey|latest\.json|releases/i);
  });
  it('la configuration de smoke dérive de l’identifiant', () => {
    const smoke = json('src-tauri/tauri.smoke.conf.json');
    expect(smoke.identifier).toBe('fr.spartiate.app.smoke');
    expect(JSON.stringify(smoke).toLowerCase()).not.toContain('circletasks');
  });
});

describe('paquet et crate', () => {
  it('package.json : spartiate 0.1.0', () => {
    const pkg = json('package.json');
    expect(pkg.name).toBe('spartiate');
    expect(pkg.version).toBe('0.1.0');
    const lock = json('package-lock.json');
    expect(lock.name).toBe('spartiate');
    expect(lock.version).toBe('0.1.0');
    expect(lock.packages[''].name).toBe('spartiate');
    expect(lock.packages[''].version).toBe('0.1.0');
  });
  it('Cargo.toml : package, lib et version', () => {
    const cargo = read('src-tauri/Cargo.toml');
    expect(cargo).toMatch(/^name = "spartiate"$/m);
    expect(cargo).toMatch(/^version = "0\.1\.0"$/m);
    expect(cargo).toMatch(/^name = "spartiate_lib"$/m);
    expect(read('src-tauri/Cargo.lock')).toMatch(/\[\[package\]\]\r?\nname = "spartiate"\r?\nversion = "0\.1\.0"/);
    expect(read('src-tauri/src/main.rs')).toContain('spartiate_lib');
  });
});

describe('base de données : trois constantes alignées (D-32)', () => {
  const sql = /sqlite:([A-Za-z0-9_.-]+\.db)/.exec(read('src/platform/tauri/sqlDriver.ts'))?.[1];
  const guard = /ALLOWED_URL[^"]*"sqlite:([A-Za-z0-9_.-]+\.db)"/.exec(read('src-tauri/vendor/tauri-plugin-sql/src/guard.rs'))?.[1];
  const backup = /DB_FILE[^"]*"([A-Za-z0-9_.-]+\.db)"/.exec(read('src-tauri/src/backup.rs'))?.[1];
  it('valent spartiate.db toutes les trois', () => {
    expect([sql, guard, backup]).toEqual(['spartiate.db', 'spartiate.db', 'spartiate.db']);
  });
  it('le nom de base est unique entre les trois', () => {
    expect(new Set([sql, guard, backup]).size).toBe(1);
  });
  it('la version de schéma reste 19 en 001a (passe à 1 en 001b)', () => {
    expect(read('src-tauri/src/backup.rs')).toMatch(/APP_SCHEMA_VERSION[^=]*=\s*19\b/);
  });
});

describe('plist, source SideStore, NSIS, workflows', () => {
  it('plist-contract.json et source.template.json nomment Spartiate', () => {
    expect(read('scripts/ios/plist-contract.json').toLowerCase()).not.toContain('circletasks');
    const source = JSON.stringify(json('scripts/ios/source.template.json'));
    expect(source).toContain('fr.spartiate.source');
    expect(source).toContain('fr.spartiate.app');
    expect(source).toContain('spartiate-releases');
    expect(source.toLowerCase()).not.toContain('circletasks');
  });
  it('hooks.nsh : aucune identité CircleTasks', () => {
    expect(read('src-tauri/windows/hooks.nsh').toLowerCase()).not.toContain('circletasks');
  });
  it('les workflows publient vers doncivo/spartiate-releases', () => {
    for (const wf of ['build-windows.yml', 'build-ios.yml']) {
      const text = read(`.github/workflows/${wf}`);
      expect(text).toContain('spartiate-releases');
      expect(text).not.toContain('circletasks-releases');
    }
  });
});

describe('qualification des mentions (convention déterministe)', () => {
  it('une ligne de protection des données CircleTasks est admise', () => {
    expect(classifyLine('- Données réelles : `%APPDATA%\\fr.circletasks.planner` toujours interdites.', OLD_ID)).toBe('protection');
    expect(classifyLine('- Ne lis jamais le dossier iCloud `iCloud Drive/CircleTasks`.', 'CircleTasks')).toBe('protection');
  });
  it('la même identité prescrite comme identité active est refusée', () => {
    expect(classifyLine('- Identifiant de l’app : `fr.circletasks.planner`.', OLD_ID)).toBe('active');
    expect(classifyLine('"identifier": "fr.circletasks.planner",', OLD_ID)).toBe('active');
    expect(classifyLine('La base est `circletasks.db`.', OLD_DB)).toBe('active');
  });
  it('une négation ou une citation historique est admise, avec ou sans marqueur explicite', () => {
    expect(classifyLine('- pas de `MobileShell` ni de `DesktopShell` (D-47)', 'MobileShell')).toBe('negative');
    expect(classifyLine('- Ancien identifiant `fr.circletasks.planner`, remplacé en 001a.', OLD_ID)).toBe('negative');
    expect(classifyLine('- Cas particulier `circletasks.db` <!-- ancien-ok: preuve de migration -->', OLD_DB)).toBe('explicit');
  });
  it('le sel HKDF du protocole de synchro reste « circletasks » (D-26) : admis pour la marque seulement', () => {
    expect(classifyLine('pub const HKDF_SALT: &[u8] = b"circletasks";', 'circletasks')).toBe('protocol');
    expect(classifyLine('pub const DB: &str = "circletasks.db"; // HKDF', OLD_DB)).toBe('active');
  });
  it('une phrase de provenance (fork, repris de) est admise pour la marque, jamais pour l’identifiant technique', () => {
    expect(classifyLine('Spartiate est un fork de CircleTasks (ADR 0001).', 'CircleTasks')).toBe('provenance');
    expect(classifyLine('// Protocole repris de CircleTasks (ADR 0011).', 'CircleTasks')).toBe('provenance');
    expect(classifyLine('Le fork de CircleTasks utilise `fr.circletasks.planner`.', OLD_ID)).toBe('active');
  });
  it('refuse les prescriptions actives que la revue a fait passer à tort (I2)', () => {
    expect(classifyLine('Toujours écrire dans `%APPDATA%\fr.circletasks.planner`.', OLD_ID)).toBe('active');
    expect(classifyLine('Identifiant actif : `fr.circletasks.planner` (jamais un autre).', OLD_ID)).toBe('active');
    expect(classifyLine('Voir l’exemple : la base est `circletasks.db`.', OLD_DB)).toBe('active');
  });
  it('un marqueur explicite sans motif est refusé', () => {
    expect(classifyLine('- `circletasks.db` <!-- ancien-ok: -->', OLD_DB)).toBe('active');
  });
  it('activeMentions ne renvoie que les mentions actives, avec leur numéro de ligne', () => {
    const text = ['intro', 'Identifiant : `fr.circletasks.planner`', 'jamais `%APPDATA%\\fr.circletasks.planner`'].join('\n');
    expect(activeMentions(text, [OLD_ID])).toEqual([{ lineNo: 2, term: OLD_ID, line: 'Identifiant : `fr.circletasks.planner`' }]);
  });
});

/** Fichiers dont la fonction est de nommer l’ancienne identité : exemptions locales et motivées (jamais un dossier entier). */
const TOOLING = new Set([
  'scripts/release/identity.test.ts',
  'scripts/release/agents.test.ts',
  'scripts/release/docs-paths.test.ts',
  'scripts/release/prd-split.test.ts',
  'scripts/release/rename.mjs',
  'scripts/release/rename.test.ts',
  'scripts/release/lib/mentions.mjs',
  'scripts/release/lib/agentsCheck.mjs',
]);
const DOC_EXEMPT = [/^docs\/PRD\.md$/, /^docs\/prd\//, /^docs\/SPA-[^/]+\.md$/, /^docs\/relecture-[^/]+$/, /^docs\/decisions\.md$/, /^docs\/adr\//, /^docs\/archive\//, /^docs\/licences\.md$/];
/** Documents CircleTasks que SPA-001b archive dans docs/archive/circletasks/ (D-40, lot (i)) : exemption transitoire, retirée avec l’archivage. */
const ARCHIVE_001B = [
  /^docs\/stories\//,
  /^docs\/audits?(-1\.0)?(\.md|\/)/,
  /^docs\/(backlog|dettes|reprise-codex|reprise-historique-2026-10)\.md$/,
  /^docs\/essais-iphone(-a9)?\.md$/,
  /^docs\/maquettes-refonte\//,
];
const BINARY = /\.(png|ico|icns|jpg|woff2?|wasm|traineddata|gz|zip|svg)$/i;

const lines = (file: string): string[] | null => {
  try {
    return read(file).split('\n');
  } catch {
    return null;
  }
};

describe('critère 1 : identité technique', () => {
  it('ni fr.circletasks.planner ni circletasks.db actifs dans les fichiers suivis hors exemptions D-41', () => {
    const found: string[] = [];
    for (const file of tracked()) {
      if (TOOLING.has(file) || [...DOC_EXEMPT, ...ARCHIVE_001B].some((re) => re.test(file)) || BINARY.test(file)) continue;
      const text = lines(file);
      if (!text) continue;
      for (const hit of activeMentions(text.join('\n'), [OLD_ID, OLD_DB]) as { lineNo: number; term: string }[]) found.push(`${file}:${hit.lineNo} ${hit.term}`);
    }
    expect(found).toEqual([]);
  });
});

describe('critère 2 : identité de marque hors docs/', () => {
  it('« CircleTasks » n’apparaît qu’en provenance, protection de données ou négation', () => {
    const found: string[] = [];
    for (const file of tracked()) {
      if (file.startsWith('docs/') || TOOLING.has(file) || BINARY.test(file)) continue;
      const text = lines(file);
      if (!text) continue;
      text.forEach((line, index) => {
        const term = /circletasks/i.exec(line)?.[0];
        if (!term) return;
        const provenance = file === 'README.md' && /fork|provenance|issu|dérive|repris/i.test(line);
        if (!provenance && classifyLine(line, term) === 'active') found.push(`${file}:${index + 1}`);
      });
    }
    expect(found).toEqual([]);
  });
});

describe('critère 4 : updater non configuré', () => {
  it('aucune référence à circletasks-releases dans le code ni la configuration', () => {
    const found = tracked().filter((file) => !file.startsWith('docs/') && !TOOLING.has(file) && /\.(ts|tsx|rs|json|toml|yml|yaml|mjs|html|nsh|plist|ps1)$/.test(file) && read(file).includes('circletasks-releases'));
    expect(found).toEqual([]);
  });
});
