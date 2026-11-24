/* global console */
// BL-134 (lot 0.29.1) : porte de `cargo audit` limitée au graphe livré.
//   node scripts/release/cargo-audit-gate.mjs <rapport cargo audit --json> <cargo tree cible 1> [<cargo tree cible 2> …]
// Bloque (code 1) si une alerte de sécurité touche une crate (nom ET version) compilée pour une cible livrée ; une alerte hors de ce
// graphe devient un avertissement visible (::warning::). Un rapport illisible ou un graphe vide bloque : jamais de passage silencieux.
// Aucune dépendance : s'exécute sans `npm ci`.
import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

/** Lignes de `cargo tree --prefix none` (« nom vX.Y.Z [(chemin)] [(*)] ») → ensemble « nom@version ». */
export function parseTree(text) {
  const set = new Set();
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z0-9_.-]+) v(\d[^\s]*)/);
    if (m) set.add(`${m[1]}@${m[2]}`);
  }
  return set;
}

/** Sépare les alertes du rapport en bloquantes (crate livrée) et avertissements (hors graphe livré). */
export function classify(report, shipped) {
  const list = report?.vulnerabilities?.list;
  if (!Array.isArray(list)) throw new Error('rapport cargo audit illisible : vulnerabilities.list absent');
  if (!(shipped instanceof Set) || shipped.size === 0) throw new Error('graphe livré vide : cargo tree a échoué ?');
  const blocking = [];
  const warnings = [];
  for (const item of list) {
    const name = item?.package?.name;
    const version = item?.package?.version;
    const id = item?.advisory?.id;
    if (!name || !version || !id) throw new Error('alerte cargo audit sans crate, version ou identifiant');
    const entry = { id, crate: `${name}@${version}`, title: item.advisory.title ?? '' };
    (shipped.has(entry.crate) ? blocking : warnings).push(entry);
  }
  return { blocking, warnings };
}

/** Revue : avertissements de cargo audit (`warnings` : non maintenue, unsound, yanked…) en lignes lisibles ; jamais bloquants. */
export function advisoryWarnings(report) {
  const groups = report?.warnings;
  if (groups === null || typeof groups !== 'object') return [];
  const lines = [];
  for (const [kind, list] of Object.entries(groups)) {
    if (!Array.isArray(list)) continue;
    for (const w of list) {
      const crate = `${w?.package?.name ?? '?'}@${w?.package?.version ?? '?'}`;
      const id = w?.advisory?.id;
      lines.push(id ? `${kind} ${id} sur ${crate} : ${w.advisory.title ?? ''}`.trimEnd() : `${kind} sur ${crate}`);
    }
  }
  return lines;
}

/** A-005 : résumé Markdown du job (alertes, avertissements par nature) : la liste courante, jamais une liste tenue à la main. */
export function summaryMarkdown(report, { blocking, warnings }, shippedCount) {
  const lines = ['### cargo audit', '', `${blocking.length} alerte(s) bloquante(s) ; ${warnings.length} hors du graphe livré ; ${shippedCount} crates livrées (Windows et iPhone).`, ''];
  const rows = [
    ...blocking.map((b) => `| bloquante | ${b.id} | ${b.crate} | ${b.title} |`),
    ...warnings.map((w) => `| hors graphe livré | ${w.id} | ${w.crate} | ${w.title} |`),
  ];
  for (const line of advisoryWarnings(report)) {
    const m = line.match(/^(\S+) (?:(RUSTSEC-\S+) )?sur (\S+?)(?: : (.*))?$/);
    rows.push(m ? `| ${m[1]} | ${m[2] ?? ''} | ${m[3]} | ${m[4] ?? ''} |` : `| avertissement | | | ${line} |`);
  }
  if (rows.length === 0) return [...lines, 'Aucune alerte ni aucun avertissement.', ''].join('\n');
  return [...lines, '| nature | avis | crate | titre |', '| --- | --- | --- | --- |', ...rows, ''].join('\n');
}

function main(argv) {
  const [reportPath, ...trees] = argv;
  if (!reportPath || trees.length === 0) throw new Error('usage : cargo-audit-gate.mjs <rapport.json> <arbre…>');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const shipped = new Set();
  for (const tree of trees) {
    const set = parseTree(readFileSync(tree, 'utf8'));
    if (set.size === 0) throw new Error(`graphe vide : ${tree}`);
    for (const crate of set) shipped.add(crate);
  }
  const { blocking, warnings } = classify(report, shipped);
  for (const line of advisoryWarnings(report)) console.log(`::warning::cargo audit, ${line}`);
  for (const w of warnings) console.log(`::warning::${w.id} sur ${w.crate} (hors du graphe livré) : ${w.title}`);
  for (const b of blocking) console.log(`::error::${b.id} sur ${b.crate} (graphe livré) : ${b.title}`);
  console.log(`cargo audit : ${blocking.length} alerte(s) bloquante(s), ${warnings.length} hors du graphe livré, ${shipped.size} crates livrées`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(report, { blocking, warnings }, shipped.size));
  return blocking.length === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.log(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
