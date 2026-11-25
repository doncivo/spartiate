#!/usr/bin/env node
/* global console, process */
// BL-149 (audit du projet du 24/11, N-12 ; D-490) : relevé par thème des choix prudents de l'agent, produit par script (D-51).
// `node scripts/release/prudent-review.mjs --write` réécrit la section balisée de docs/decisions-a-prendre.md ;
// `node scripts/release/prudent-review.mjs` (sans option) échoue si la section n'est plus à jour.
// Le thème, le poids et la nature (« à trancher » / « à confirmer seulement ») viennent de mots-clés : un tri mécanique, pas un
// jugement décision par décision (D-618). scripts/release/prudentReview.test.ts échoue si une D- « choix prudent » manque du relevé.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const START = '<!-- revue-choix-prudents:debut (généré par scripts/release/prudent-review.mjs --write ; ne pas éditer à la main) -->';
export const END = '<!-- revue-choix-prudents:fin -->';

export const THEMES = [
  ['séance et moteur', /\b(moteur|séances?|séries?|charges?|progression|mésocycle|routines?|programmes?|exercices?|ENGINE_VERSION|décharge|répétitions?|e?1RM|échauffement|repos|Strength|records?|matériel|prescri\w*|lest|déroulé)\b/gi],
  ['nutrition', /\b(nutrition|repas|aliments?|kcal|macros?|Ciqual|Open Food Facts|recettes?|pesées?|TDEE|compléments?|code-barres|protéines|assiette|Renpho|calories)\b/gi],
  ['récupération', /\b(récupération|recovery|HRV|sommeil|FC|Exertion|Santé|HealthKit|cardio|pas|Raccourcis|baseline|coucher)\b/gi],
  ['synchro et données', /\b(synchro\w*|sync\w*|époques?|journaux chiffrés|migrations?|schéma|publiée?s?|sauvegardes?|exports?|imports?|restauration|hlc|tombstones?|SQLite|base|tables?|colonnes?|appairage|iCloud|effacement)\b/gi],
  ['écrans', /\b(écrans?|libellés?|textes?|boutons?|affich\w*|onglets?|maquettes?|i18n|Aujourd'hui|Plus|Progrès|barre|palette|icônes?|couleurs?|tokens?|bandeaux?|fenêtres?|clavier|accessibilité)\b/gi],
  ['CI et outillage', /\b(CI|workflows?|tests\.yml|builds?|tags?|publications?|bundle|tests?|scripts?|lint|Playwright|cargo|npm|dépendances?|IPA|SideStore|release|runners?|garde|fiches?|registre|budget)\b/gi],
];

const SIGNALS = [
  ['moteur', /\b(moteur|ENGINE_VERSION|prescri\w*|progression|décharge|charges?)\b/i, 2],
  ['synchro', /\b(synchro\w*|publiée?s?|époques?|sync-icloud|journaux chiffrés)\b/i, 3],
  ['schéma', /\b(migrations?|schéma|colonnes? additives?|tables? neuves?)\b/i, 3],
  ['données', /\b(perte|effac\w*|supprim\w*|écras\w*)\b/i, 2],
  ['chiffre', /(\d+ ?%|\bseuils?\b|\bplafonds?\b|\bkcal\b|\bkg\b)/i, 1],
  ['écran', /\b(écrans?|affich\w*|libellés?|boutons?|bandeaux?|notifications?)\b/i, 1],
];
const VISIBLE = new Set(['moteur', 'chiffre', 'écran', 'données']);

const ALI_SOURCE = /^(Ali|Toi|Décision d'Ali|\*\*Ali)/i;
const isAli = (r) => ALI_SOURCE.test(r.source) || (!r.source && /^\*\*[^*]*\b(décisions? d'Ali|Ali, \d)/i.test(r.body));

function mentioned(body) {
  // « D-314 à D-317 » compte pour D-314, D-315, D-316 et D-317.
  const ids = new Set();
  for (const [, a, b] of body.matchAll(/\bD-(\d+) à D-(\d+)\b/g)) for (let n = Number(a); n <= Number(b) && n - Number(a) < 40; n += 1) ids.add(`D-${n}`);
  for (const [, id] of body.matchAll(/\b(D-\d+)\b/g)) ids.add(id);
  return ids;
}

function cellsOf(line) {
  // Cellules séparées par « | » hors accents graves (un chemin `a|b` reste dans sa cellule).
  const cells = [];
  let cur = '';
  let tick = false;
  for (const ch of line.trim().replace(/^\|/, '')) {
    if (ch === '`') tick = !tick;
    if (ch === '|' && !tick) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) cells.push(cur.trim());
  return cells;
}

function rows(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\| (D-\d+) \|/);
    if (!m) continue;
    const cells = cellsOf(line);
    const body = cells[1] ?? '';
    const source = cells.length >= 3 ? cells[cells.length - 1] : '';
    out.push({ id: m[1], body, source });
  }
  return out;
}

function isPrudent(r) {
  const { body, source } = r;
  if (/validée par Ali/i.test(source)) return false;
  if (isAli(r)) return false;
  if (/claude|choix prudents?/i.test(source)) return true;
  return /(?<!non )révisables? par Ali/i.test(body) && !/non révisable/i.test(body);
}

function clean(s) {
  return s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

export function summaryOf(body) {
  const bold = body.match(/^\*\*(.+?)\*\*/);
  let s = clean(bold ? bold[1] : body.split(/(?<=\.)\s/)[0])
    .replace(/ ?\((choix|décisions?) prudente?s?[^()]*\)/gi, '')
    .replace(/[,;] (choix|décisions?) prudente?s?( de l'agent)?,? (révisables? par Ali|à confirmer ou réviser par Ali)/gi, '')
    .replace(/\s+([.,;])/g, '$1')
    .trim();
  if (s.length > 150) s = s.slice(0, 150).replace(/\s+\S*$/, '') + ' …';
  return s;
}

function count(re, text) {
  return (text.match(re) ?? []).length;
}

export function extractPrudent(text) {
  const all = rows(text);
  const validatedBy = {};
  for (const r of all) {
    if (!isAli(r) || !/valid/i.test(r.body)) continue;
    for (const id of mentioned(r.body)) if (id !== r.id) (validatedBy[id] ??= []).push(r.id);
  }
  return all.filter(isPrudent).map((r) => {
    const title = (r.body.match(/^\*\*(.+?)\*\*/) ?? ['', ''])[1];
    let theme = THEMES[0][0];
    let best = -1;
    for (const [name, re] of THEMES) {
      const score = 3 * count(re, title) + count(re, r.body);
      if (score > best) {
        best = score;
        theme = name;
      }
    }
    const signals = SIGNALS.filter(([, re]) => re.test(r.body));
    const decide = /à trancher/i.test(r.source) || /à trancher par Ali/i.test(r.body);
    const weight = signals.reduce((n, [, , w]) => n + w, 0) + Math.min(3, Math.floor(r.body.length / 800)) + (decide ? 4 : 0);
    const citedByAli = [...new Set(validatedBy[r.id] ?? [])];
    const visible = signals.some(([name]) => VISIBLE.has(name));
    const kind = citedByAli.length === 0 && (decide || visible || weight >= 4) ? 'à trancher' : 'à confirmer seulement';
    return { id: r.id, summary: summaryOf(r.body), theme, weight, kind, effects: signals.map(([name]) => name), citedByAli, decide };
  });
}

function num(id) {
  return Number(id.slice(2));
}

function line(d) {
  let what;
  if (d.citedByAli.length) what = `à confirmer seulement : citée par ${d.citedByAli.join(', ')} d'Ali (déjà validée ?)`;
  else if (d.kind === 'à confirmer seulement') what = 'à confirmer seulement (aucun effet visible repéré)';
  else what = `A garder · B réviser${d.decide ? ' (déjà marquée « à trancher »)' : ''} ; effet : ${d.effects.join(', ') || 'durée, texte long'}`;
  return `| ${d.weight} | ${d.id} | ${d.summary} | ${what} |`;
}

const HEAD = ['| Poids | D- | Résumé | Ce qu\'Ali tranche |', '|---|---|---|---|'];

export function renderReview(items) {
  const sorted = [...items].sort((a, b) => b.weight - a.weight || num(a.id) - num(b.id));
  const out = [START, '', '## Revue par thème des choix prudents (D-490, BL-149)', ''];
  out.push(
    `${items.length} décisions retenues : colonne source « Claude » ou « choix prudent », ou texte « révisable par Ali », hors décisions validées par Ali dans leur colonne source.`,
    'Thème, poids et nature sont calculés par mots-clés (scripts/release/prudent-review.mjs) : un tri mécanique, à corriger par Ali s\'il se trompe (D-618).',
    'Poids : synchro 3, schéma 3, moteur 2, données effacées 2, chiffre 1, écran 1, longueur jusqu\'à 3, « à trancher » 4. Les plus lourdes en tête de chaque thème.',
    'Réponse attendue : « D-n : A » (garder) ou « D-n : B, … » (réviser, avec ce qui change). Aucun comportement ne change tant qu\'Ali n\'a pas répondu ; une réponse devient une D- nouvelle.',
    '',
    '### Les quinze plus lourdes à trancher, tous thèmes',
    '',
    ...HEAD,
    ...sorted.filter((d) => d.kind === 'à trancher').slice(0, 15).map(line),
    '',
  );
  for (const [theme] of THEMES) {
    const inTheme = sorted.filter((d) => d.theme === theme);
    if (!inTheme.length) continue;
    const decide = inTheme.filter((d) => d.kind === 'à trancher');
    const keep = inTheme.filter((d) => d.kind !== 'à trancher');
    out.push(`### ${theme} (${inTheme.length} : ${decide.length} à trancher, ${keep.length} à confirmer seulement)`, '');
    if (decide.length) out.push(...HEAD, ...decide.map(line), '');
    if (keep.length) out.push('Gardées sans question (à confirmer seulement) :', '', ...HEAD, ...keep.map(line), '');
  }
  out.push(END, '');
  return out.join('\n');
}

export function idsInReview(text) {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  const ids = new Set();
  if (a < 0 || b < a) return ids;
  for (const m of text.slice(a, b).matchAll(/^\| \d+ \| (D-\d+) \|/gm)) ids.add(m[1]);
  return ids;
}

export function applyReview(doc, section) {
  const a = doc.indexOf(START);
  const b = doc.indexOf(END);
  if (a >= 0 && b > a) return doc.slice(0, a) + section + doc.slice(b + END.length).replace(/^\n+/, '');
  return doc.replace(/\n*$/, '\n\n') + section;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = 'docs/decisions-a-prendre.md';
  const section = renderReview(extractPrudent(readFileSync('docs/decisions.md', 'utf8')));
  const doc = readFileSync(target, 'utf8');
  const next = applyReview(doc, section);
  if (process.argv.includes('--write')) {
    writeFileSync(target, next);
    console.log(`${target} : ${idsInReview(next).size} décisions relevées`);
  } else if (next !== doc) {
    console.error(`${target} n'est plus à jour : node scripts/release/prudent-review.mjs --write`);
    process.exit(1);
  } else console.log(`${target} à jour (${idsInReview(doc).size} décisions)`);
}
