/* eslint-disable -- outil de nettoyage ponctuel (CLEAN-01), hors du code de l'app */
// CLEAN-01 : supprime les modules de catalogue src/i18n/fr.*.ts qu'aucun fichier n'importe plus (jusqu'au point fixe).
import { readFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d, a = []) => {
  for (const n of readdirSync(d)) {
    const f = join(d, n);
    if (statSync(f).isDirectory()) walk(f, a);
    else a.push(f);
  }
  return a;
};
for (let i = 0; i < 6; i++) {
  const files = walk('src').filter((f) => /\.tsx?$/.test(f));
  const cats = files.filter((f) => /src[\\/]i18n[\\/]fr\.\w+\.ts$/.test(f));
  let n = 0;
  for (const c of cats) {
    const base = c.split(/[\\/]/).pop().replace(/\.ts$/, '').replace('.', '\\.');
    const re = new RegExp(`['"][^'"]*/${base}['"]`);
    const used = files.some((f) => f !== c && existsSync(f) && re.test(readFileSync(f, 'utf8')));
    if (!used) {
      console.log('orphelin supprimé', c);
      unlinkSync(c);
      n++;
    }
  }
  if (!n) break;
}
