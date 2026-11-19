// FIX-0272 (A-003 de l'audit 0.26.0) : tableau des dépendances npm LIVRÉES (`dependencies` de package.json) dans docs/licences.md,
// version et licence lues dans package-lock.json. Mécanique (D-51) : `node scripts/release/licences-npm.mjs` réécrit le bloc balisé ;
// la garde `scripts/release/licences.test.ts` refuse un bloc qui ne correspond plus aux fichiers.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BEGIN = '<!-- licences-npm:début (généré par scripts/release/licences-npm.mjs) -->';
export const END = '<!-- licences-npm:fin -->';

export function npmLicenceTable(root) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const rows = Object.keys(pkg.dependencies ?? {})
    .sort()
    .map((name) => {
      const entry = lock.packages?.[`node_modules/${name}`];
      if (!entry?.version || !entry.license) throw new Error(`licence ou version absente du verrou : ${name}`);
      return `| \`${name}\` | ${entry.version} | ${entry.license} |`;
    });
  return ['| Paquet | Version | Licence |', '|---|---|---|', ...rows].join('\n');
}

export function block(root) {
  return `${BEGIN}\n${npmLicenceTable(root)}\n${END}`;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const path = resolve(root, 'docs/licences.md');
  const doc = readFileSync(path, 'utf8');
  const start = doc.indexOf(BEGIN);
  const end = doc.indexOf(END);
  const next = start >= 0 && end > start ? doc.slice(0, start) + block(root) + doc.slice(end + END.length) : `${doc.trimEnd()}\n\n# Licences — dépendances npm livrées (FIX-0272, A-003)\n\nToutes les dépendances de \`dependencies\` (package.json), version et licence du verrou (package-lock.json). Les outils de développement (\`devDependencies\`) ne sont pas livrés.\n\n${block(root)}\n`;
  writeFileSync(path, next);
}
