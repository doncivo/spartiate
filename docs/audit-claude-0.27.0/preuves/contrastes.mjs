// AUDIT-CLAUDE-0.27.0 : contrastes WCAG des jetons de couleur (§ 18.6, AA : 4,5:1 texte, 3:1 composants), par bloc de thème de tokens.css.
// Usage : node docs/audit-claude-0.27.0/preuves/contrastes.mjs > docs/audit-claude-0.27.0/preuves/resultats/contrastes.json
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/theme/tokens.css', 'utf8');
const blocks = { root: [17, 187], darkMedia: [188, 251], dark: [252, 312], light: [313, 371] };
const lines = css.split('\n');
const read = ([a, b]) => Object.fromEntries(lines.slice(a - 1, b).map((l) => l.match(/^\s*--(ct-color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/)).filter(Boolean).map((m) => [m[1], m[2]]));
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const root = read(blocks.root);
const pairs = [
  // [texte, fond, seuil]
  ...['text', 'text-secondary', 'bronze', 'danger', 'warn', 'ok', 'info', 'warning-text', 'achieved-text', 'missed-text', 'nav-accent', 'event-text'].flatMap((t) => ['bg', 'surface', 'surface-raised'].map((b) => [t, b, 4.5])),
  ['accent-on', 'accent', 4.5], ['ok-on', 'ok', 4.5], ['nav-text', 'nav-bg', 4.5], ['nav-accent', 'nav-bg', 4.5], ['warning-text', 'warning-bg', 4.5], ['danger', 'danger-bg', 4.5], ['achieved-text', 'achieved-bg', 4.5], ['missed-text', 'missed-bg', 4.5],
  ['border-strong', 'surface', 3], ['switch-off', 'surface', 3], ['switch-on', 'surface', 3], ['accent', 'bg', 3],
];
const out = {};
for (const [name, range] of Object.entries(blocks)) {
  const t = { ...root, ...read(range) };
  out[name] = pairs.filter(([a, b]) => t[`ct-color-${a}`] && t[`ct-color-${b}`]).map(([a, b, min]) => {
    const r = ratio(t[`ct-color-${a}`], t[`ct-color-${b}`]);
    return { texte: a, fond: b, ratio: Math.round(r * 100) / 100, seuil: min, ok: r >= min };
  });
}
const echecs = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.filter((p) => !p.ok)]));
console.log(JSON.stringify({ echecs, tout: out }, null, 1));
