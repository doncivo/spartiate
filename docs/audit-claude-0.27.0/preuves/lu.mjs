// AUDIT-CLAUDE-0.27.0 : consigne des fichiers lus dans lectures.tsv, sans doublon.
// Usage : node docs/audit-claude-0.27.0/preuves/lu.mjs <partie> "<lecteur>" <fichier ou dossier>... [--note "texte"]
// Un dossier ajoute tous ses fichiers suivis au tag v0.27.0 (hors tests).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const F = 'docs/audit-claude-0.27.0/preuves/lectures.tsv';
const args = process.argv.slice(2);
const noteAt = args.indexOf('--note');
const note = noteAt >= 0 ? args[noteAt + 1] : '';
const [partie, par, ...targets] = noteAt >= 0 ? args.slice(0, noteAt) : args;
const tracked = execSync('git ls-tree -r --name-only v0.27.0', { encoding: 'utf8' }).split('\n').filter(Boolean);
const isTest = (f) => /\.(test|spec)\.(ts|tsx|mjs|js)$/.test(f) || /\/__tests__\//.test(f);
const files = targets.flatMap((t) => (tracked.includes(t) ? [t] : tracked.filter((f) => f.startsWith(t.replace(/\/?$/, '/')) && !isTest(f))));
const missing = targets.filter((t) => !tracked.includes(t) && !tracked.some((f) => f.startsWith(t.replace(/\/?$/, '/'))));
if (missing.length) { console.error('absents du tag :', missing.join(', ')); process.exit(1); }
const text = readFileSync(F, 'utf8');
const have = new Set(text.split('\n').map((l) => l.split('\t')[0]));
const add = files.filter((f) => !have.has(f)).map((f) => [f, partie, new Date().toISOString().slice(0, 10), par, note].join('\t'));
writeFileSync(F, text.replace(/\n?$/, '\n') + add.join('\n') + (add.length ? '\n' : ''));
console.log(`${add.length} ajoutés, ${files.length - add.length} déjà présents`);
