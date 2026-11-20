// AUDIT-CLAUDE-0.27.0, partie 7 : contrôles déterministes sur les écrans (D-50), avant toute lecture.
// Usage (racine du worktree) : node docs/audit-claude-0.27.0/preuves/partie7-motifs.mjs > docs/audit-claude-0.27.0/preuves/resultats/partie7-motifs.json
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('git ls-tree -r --name-only v0.27.0 -- src/features src/ui src/main.tsx', { encoding: 'utf8' })
  .split('\n').filter((f) => f && !/\.(test|spec)\./.test(f));
const tsx = files.filter((f) => f.endsWith('.tsx'));
const css = files.filter((f) => f.endsWith('.css'));
const out = { textesEnDur: [], couleursEnDur: [], boutonsSansNom: [], animationsSansReduction: [], ciblesPetites: [], suppressionsSansConfirmation: [], ecouteursSansRetrait: [], minuteursSansRetrait: [] };
const lines = (f) => readFileSync(f, 'utf8').split('\n');

for (const f of tsx) {
  const L = lines(f);
  const text = L.join('\n');
  L.forEach((l, i) => {
    // Texte français entre balises JSX, hors expressions : >Mot avec lettre accentuée ou espace<
    const m = l.match(/>\s*([A-Za-zÀ-ÿ][^<>{}]*[A-Za-zÀ-ÿ.!?…])\s*</);
    if (m && /[a-zà-ÿ]{3,}/.test(m[1]) && !/^\s*(true|false|null)\s*$/.test(m[1])) out.textesEnDur.push(`${f}:${i + 1}: ${m[1].trim().slice(0, 60)}`);
    // Attributs visibles en dur
    const a = l.match(/\b(aria-label|title|placeholder|alt)="([^"]*[a-zà-ÿ]{3,}[^"]*)"/);
    if (a) out.textesEnDur.push(`${f}:${i + 1}: ${a[1]}="${a[2].slice(0, 50)}"`);
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l) && !/^\s*(\/\/|\*)/.test(l)) out.couleursEnDur.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`);
  });
  // <button ...> sans aria-label ni texte : balise ouvrante puis contenu limité à une icône
  const re = /<button\b([^>]*)>\s*(<(Icon|TabIcon|svg)\b[^>]*\/>|<svg[\s\S]*?<\/svg>)\s*<\/button>/g;
  let b;
  while ((b = re.exec(text))) {
    if (!/aria-label|aria-labelledby|title=/.test(b[1])) out.boutonsSansNom.push(`${f}:${text.slice(0, b.index).split('\n').length}`);
  }
  if (/addEventListener\(/.test(text) && !/removeEventListener\(/.test(text)) out.ecouteursSansRetrait.push(f);
  if (/setInterval\(/.test(text) && !/clearInterval\(/.test(text)) out.minuteursSansRetrait.push(f);
  // Appels de suppression sans ConfirmDialog ni confirm dans le même fichier
  if (/\b(remove|delete|softDelete|purge|reset|clear)[A-Z]?\w*\(/.test(text) && !/ConfirmDialog|ChoiceDialog|confirm(ation)?\b|useConfirm|undo/i.test(text)) out.suppressionsSansConfirmation.push(f);
}
for (const f of css) {
  const L = lines(f);
  const text = L.join('\n');
  if (!f.endsWith('tokens.css')) L.forEach((l, i) => { if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l) && !/var\(/.test(l.split(':')[0])) out.couleursEnDur.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`); });
  if (/(animation|transition)\s*:/.test(text) && !/prefers-reduced-motion/.test(text)) out.animationsSansReduction.push(f);
  L.forEach((l, i) => { const m = l.match(/\b(min-)?(height|width)\s*:\s*(\d+(?:\.\d+)?)px/); if (m && Number(m[3]) > 0 && Number(m[3]) < 44 && /button|btn|toggle|chip|icon|tab|switch/i.test(text.slice(0, text.indexOf(l)).split('{').slice(-2).join('{'))) out.ciblesPetites.push(`${f}:${i + 1}: ${l.trim()}`); });
}
const globalReduced = css.filter((f) => /prefers-reduced-motion/.test(readFileSync(f, 'utf8')));
console.log(JSON.stringify({ fichiers: { tsx: tsx.length, css: css.length }, reductionGlobale: globalReduced, comptes: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), ...out }, null, 1));
