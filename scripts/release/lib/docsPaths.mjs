// Test des chemins cités dans les documents (D-50, P-01). Un chemin littéral entre accents graves, sous une racine connue,
// existe dans le dépôt ou figure dans docs/a-creer.md (chemin · ticket · propriétaire). Globs, paramètres <nom> et alternatives a|b
// ne sont pas des fichiers à créer. Une mention niée ou historique garde sa place (mentions.mjs), les décisions ne sont pas réécrites.
import { classifyLine } from './mentions.mjs';

const ROOTS = ['src/', 'src-tauri/', 'scripts/', 'tests/', 'content/', '.github/', '.claude/'];

/**
 * @param {string} line
 * @returns {{ path: string; kind: 'literal' | 'glob' | 'param' | 'alternative' }[]}
 */
export function extractPathMentions(line) {
  const found = [];
  for (const match of line.matchAll(/`([^`\s]+)`/g)) {
    let token = match[1] ?? '';
    if (!ROOTS.some((root) => token.startsWith(root))) continue;
    token = token.replace(/#.*$/, '').replace(/:\d+(?:-\d+)?$/, '').replace(/[.,;:)]+$/, '');
    /** @type {'literal' | 'glob' | 'param' | 'alternative'} */
    let kind = 'literal';
    if (token.includes('<')) kind = 'param';
    else if (token.includes('|')) kind = 'alternative';
    else if (/[*{?…]/.test(token)) kind = 'glob';
    found.push({ path: token, kind });
  }
  return found;
}

/**
 * @param {string} text contenu de docs/a-creer.md
 * @returns {{ rows: { path: string; ticket: string; owner: string }[]; problems: string[] }}
 */
export function parseRegistry(text) {
  const rows = [];
  const problems = [];
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.length < 3 || /^-+$/.test(cells[0] ?? '') || /^chemin$/i.test(cells[0] ?? '')) continue;
    const path = /^`([^`]+)`$/.exec(cells[0] ?? '')?.[1];
    if (!path) {
      problems.push(`registre : chemin sans accents graves « ${cells[0]} »`);
      continue;
    }
    const ticket = cells[1] ?? '';
    const owner = cells[2] ?? '';
    if (!ticket) problems.push(`registre : ${path} sans ticket`);
    if (!owner) problems.push(`registre : ${path} sans propriétaire`);
    rows.push({ path, ticket, owner });
  }
  return { rows, problems };
}

/** @param {string} path @param {{ path: string }[]} registry */
const registered = (path, registry) =>
  registry.some((row) => (row.path.endsWith('/') ? path === row.path.slice(0, -1) || path.startsWith(row.path) : path === row.path));

/** Racine d'un plugin local : contexte déclaré des chemins relatifs « ios/… » (D-33). */
const PLUGIN_ROOT = /^src-tauri\/plugins\/[^/]+/;

/**
 * Mentions d'une ligne, chemins relatifs « ios/… » résolus dans le dernier plugin déclaré avant eux sur la même ligne
 * (`src-tauri/plugins/<nom>/`) ; sans contexte déclaré, un chemin relatif est ignoré (jamais interprété à la racine du dépôt).
 * @param {string} line
 * @returns {{ path: string; kind: 'literal' | 'glob' | 'param' | 'alternative' }[]}
 */
export function resolvedMentions(line) {
  const found = [];
  let context = null;
  for (const match of line.matchAll(/`([^`\s]+)`/g)) {
    const token = match[1] ?? '';
    if (token.startsWith('ios/')) {
      if (!context) continue;
      found.push(...extractPathMentions('`' + context + token + '`'));
      continue;
    }
    for (const mention of extractPathMentions('`' + token + '`')) {
      found.push(mention);
      const root = PLUGIN_ROOT.exec(mention.path)?.[0];
      if (root) context = root + '/';
    }
  }
  return found;
}

/**
 * @param {{ files: [string, string][]; exists: (path: string) => boolean; registry: { path: string }[] }} input
 * @returns {string[]} problèmes « fichier:ligne … »
 */
export function checkDocsPaths({ files, exists, registry }) {
  const problems = [];
  for (const [name, text] of files) {
    text.split('\n').forEach((line, index) => {
      for (const { path, kind } of resolvedMentions(line)) {
        if (kind !== 'literal' || exists(path) || registered(path, registry)) continue;
        if (classifyLine(line, path) !== 'active') continue;
        problems.push(`${name}:${index + 1} chemin introuvable et absent de docs/a-creer.md : ${path}`);
      }
    });
  }
  return problems;
}
