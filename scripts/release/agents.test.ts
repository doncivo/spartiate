// SPA-001a, critère 8 bis (D-48, D-54 / P-01) : contrôle des 24 fiches .claude/agents/*.md, usage par usage.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error script .mjs sans déclaration de types
import { AGENT_SECTIONS, OBSOLETE_TERMS, checkAgentFile, checkAgentsDirectory, checkReadme } from './lib/agentsCheck.mjs';

const root = resolve(__dirname, '..', '..');
const dir = resolve(root, '.claude', 'agents');

const GOOD = (extra = ''): string =>
  [
    '---',
    'name: demo',
    'description: "Fiche de démonstration."',
    'tools: Read, Grep',
    'model: sonnet',
    '---',
    'Tu es un rôle de démonstration.',
    '',
    '## Quand intervenir',
    '- toujours' + extra,
    '## Fichiers',
    '- src/x',
    '## Décisions qui appartiennent à d’autres rôles',
    '- aucune',
    '## Règles et invariants',
    '- aucune',
    '## Tests et preuves à fournir',
    '- aucun',
    '## Terminé quand / Arbitrage requis quand',
    '- fini',
    '',
  ].join('\n');

describe('fixtures acceptées', () => {
  it('une fiche complète est valide', () => {
    expect(checkAgentFile('demo.md', GOOD())).toEqual([]);
  });
  it('protection des données CircleTasks : fr.circletasks.planner autorisé', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- Données réelles : `%APPDATA%\\fr.circletasks.planner` toujours interdites.'))).toEqual([]);
  });
  it('exemple interdit explicite (négation) : MobileShell cité comme contre-exemple', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- pas de `MobileShell` ni de `DesktopShell` (D-47)'))).toEqual([]);
  });
  it('dimensions de capture : 900 px admis avec marqueur local motivé', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- capture de 900 px de hauteur pour la vue Plus <!-- ancien-ok: dimension de capture, pas la rupture -->'))).toEqual([]);
  });
  it('chemin relatif rattaché à un plugin : ios/Package.swift n’est pas un ancien chemin', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- `src-tauri/plugins/files/ios/Package.swift` et `ios/Sources/FilesPlugin.swift`'))).toEqual([]);
  });
});

describe('fixtures rejetées', () => {
  it('ancien chemin prescrit', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- Modifie `src/ui/tokens.css`.')).join('\n')).toContain('src/ui/tokens.css');
  });
  it('mauvaise identité active', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- Identifiant de l’app : `fr.circletasks.planner`.')).join('\n')).toContain('fr.circletasks.planner');
  });
  it('rupture à 900 px prescrite', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- Bascule PC à partir de 900 px.')).join('\n')).toContain('900 px');
  });
  it('marqueur explicite sans motif', () => {
    expect(checkAgentFile('demo.md', GOOD('\n- Coquille `MobileShell` <!-- ancien-ok: -->')).join('\n')).toContain('MobileShell');
  });
  it('frontmatter : nom différent du fichier, champ vide, YAML invalide, absent', () => {
    expect(checkAgentFile('autre.md', GOOD()).join('\n')).toContain('name');
    expect(checkAgentFile('demo.md', GOOD().replace('model: sonnet', 'model: ')).join('\n')).toContain('model');
    expect(checkAgentFile('demo.md', GOOD().replace('tools: Read, Grep', 'tools: [Read')).join('\n')).toMatch(/YAML|frontmatter/);
    expect(checkAgentFile('demo.md', 'sans frontmatter').join('\n')).toMatch(/frontmatter/);
  });
  it('rubrique manquante ou dans le désordre', () => {
    expect(checkAgentFile('demo.md', GOOD().replace('## Fichiers', '## Autre')).join('\n')).toContain('Fichiers');
    const swapped = GOOD().replace('## Fichiers', '## TMP').replace('## Quand intervenir', '## Fichiers').replace('## TMP', '## Quand intervenir');
    expect(checkAgentFile('demo.md', swapped).join('\n')).toMatch(/ordre/);
  });
  it('les six rubriques sont exigées dans l’ordre déclaré', () => {
    expect(AGENT_SECTIONS).toEqual(['Quand intervenir', 'Fichiers', 'Décisions qui appartiennent à d’autres rôles', 'Règles et invariants', 'Tests et preuves', 'Terminé quand']);
  });
  it('doublon de nom dans le répertoire', () => {
    const files = [
      ['a.md', GOOD().replace('name: demo', 'name: a')],
      ['b.md', GOOD().replace('name: demo', 'name: a')],
    ];
    expect(checkAgentsDirectory(files, { expected: 2 }).join('\n')).toMatch(/unique|doublon/);
  });
  it('mauvais décompte', () => {
    expect(checkAgentsDirectory([['a.md', GOOD().replace('name: demo', 'name: a')]], { expected: 24 }).join('\n')).toContain('24');
  });
  it('un README ne se contrôle pas comme une fiche mais ses usages actifs sont refusés', () => {
    expect(checkReadme('# Agents\n\n- Modifie `src/ui/tokens.css`.\n').join('\n')).toContain('src/ui/tokens.css');
    expect(checkReadme('# Agents\n\nPas de frontmatter ici, c’est normal.\n')).toEqual([]);
  });
});

describe('liste des références obsolètes', () => {
  it('couvre exactement les chaînes de D-48 / critère 8 bis', () => {
    expect([...OBSOLETE_TERMS].sort()).toEqual(
      ['test:contrast', '900 px', 'MobileShell', 'DesktopShell', 'src/ui/tokens.css', 'app_meta', 'app_pref', 'sync-guardian', 'ios-plugin', 'circletasks-kit', 'fr.circletasks.planner'].sort(),
    );
  });
});

describe('dépôt réel', () => {
  const entries = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => [f, readFileSync(resolve(dir, f), 'utf8')]);
  it('exactement 24 fiches valides, README exclu', () => {
    expect(entries).toHaveLength(24);
    expect(checkAgentsDirectory(entries, { expected: 24 })).toEqual([]);
  });
  it('le README est contrôlé à part, sans frontmatter ni décompte de fiche', () => {
    expect(checkReadme(readFileSync(resolve(dir, 'README.md'), 'utf8'))).toEqual([]);
  });
});
