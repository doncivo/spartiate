// Contrôle des fiches .claude/agents/*.md (D-48, P-01). YAML lu par le paquet `yaml` (dépendance de développement déclarée).
import { parse } from 'yaml';
import { activeMentions } from './mentions.mjs';

/** Préfixes des six rubriques, dans l'ordre obligatoire. */
export const AGENT_SECTIONS = ['Quand intervenir', 'Fichiers', 'Décisions qui appartiennent à d’autres rôles', 'Règles et invariants', 'Tests et preuves', 'Terminé quand'];

/** Références obsolètes (D-48, critère 8 bis) : refusées comme usage actif, admises citées, niées ou protégées (mentions.mjs). */
export const OBSOLETE_TERMS = ['test:contrast', '900 px', 'MobileShell', 'DesktopShell', 'src/ui/tokens.css', 'app_meta', 'app_pref', 'sync-guardian', 'ios-plugin', 'circletasks-kit', 'fr.circletasks.planner'];

const REQUIRED_FIELDS = ['name', 'description', 'tools', 'model'];

/** @param {string} text */
function splitFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  return match ? { yaml: match[1] ?? '', body: match[2] ?? '' } : null;
}

/** @param {string} text @param {string} label */
function obsoleteProblems(text, label) {
  return activeMentions(text, OBSOLETE_TERMS).map((hit) => `${label}:${hit.lineNo} usage actif obsolète « ${hit.term} »`);
}

/**
 * @param {string} fileName ex. « architect.md »
 * @param {string} text
 * @returns {string[]} problèmes (vide = valide)
 */
export function checkAgentFile(fileName, text) {
  const problems = [];
  const parts = splitFrontmatter(text);
  if (!parts) return [`${fileName}: frontmatter absent`];
  /** @type {unknown} */
  let parsed;
  try {
    parsed = parse(parts.yaml);
  } catch {
    return [`${fileName}: YAML invalide dans le frontmatter`];
  }
  const meta = parsed && typeof parsed === 'object' ? /** @type {Record<string, unknown>} */ (parsed) : null;
  if (!meta) return [`${fileName}: frontmatter YAML vide ou invalide`];
  for (const field of REQUIRED_FIELDS) {
    const value = meta[field];
    if (typeof value !== 'string' || value.trim() === '') problems.push(`${fileName}: champ « ${field} » absent ou vide`);
  }
  if (meta['name'] !== fileName.replace(/\.md$/, '')) problems.push(`${fileName}: name « ${String(meta['name'])} » différent du nom de fichier`);

  const headings = [...parts.body.matchAll(/^## (.+?)\s*$/gm)].map((m) => (m[1] ?? '').replace(/[’‘]/g, "'"));
  let last = -1;
  for (const section of AGENT_SECTIONS) {
    const at = headings.findIndex((h) => h.startsWith(section.replace(/[’‘]/g, "'")));
    if (at < 0) problems.push(`${fileName}: rubrique « ${section} » manquante`);
    else if (at < last) problems.push(`${fileName}: rubrique « ${section} » hors ordre`);
    else last = at;
  }
  problems.push(...obsoleteProblems(text, fileName));
  return problems;
}

/**
 * @param {[string, string][]} entries paires [nom de fichier, contenu], README exclu
 * @param {{ expected: number }} options
 */
export function checkAgentsDirectory(entries, { expected }) {
  const problems = [];
  if (entries.length !== expected) problems.push(`${entries.length} fiches au lieu de ${expected}`);
  const seen = new Map();
  for (const [file, text] of entries) {
    problems.push(...checkAgentFile(file, text));
    const name = /^name:\s*(\S+)/m.exec(text)?.[1];
    if (name) {
      if (seen.has(name)) problems.push(`${file}: nom en doublon avec ${seen.get(name)} (le nom doit être unique)`);
      else seen.set(name, file);
    }
  }
  return problems;
}

/** Le README n'a ni frontmatter ni décompte de fiche : seuls les usages actifs obsolètes sont contrôlés. @param {string} text */
export function checkReadme(text) {
  return obsoleteProblems(text, 'README.md');
}
