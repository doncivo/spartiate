// Catalogue Ciqual embarqué (I4-02) : lecture des fichiers XML officiels de l'Anses, validation, génération déterministe de
// content/food/ciqual.json. Node, aucune dépendance. Aucune valeur nutritionnelle n'est écrite à la main : tout vient des fichiers
// publiés, vérifiés par somme MD5 (cf. docs/licences.md). Fichiers téléchargés = données non fiables : lus comme du texte, jamais exécutés.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Édition retenue : Table Ciqual 2025 (DOI 10.57745/RDMHWY, Recherche Data Gouv), Licence Ouverte Etalab 2.0. */
export const CIQUAL_VERSION = '2025-11-03';
export const CIQUAL_SOURCE = {
  name: 'Table de composition nutritionnelle des aliments Ciqual 2025',
  publisher: 'Anses',
  version: CIQUAL_VERSION,
  doi: '10.57745/RDMHWY',
  licence: 'Licence Ouverte Etalab 2.0',
  url: 'https://doi.org/10.57745/RDMHWY',
  attribution: 'Source : Anses, Table de composition nutritionnelle des aliments Ciqual 2025 (Licence Ouverte Etalab 2.0).',
};

/** Fichiers XML (français) et sommes MD5 publiées par l'entrepôt avec le jeu de données. */
export const CIQUAL_FILES = {
  alim: { name: 'alim_2025_11_03.xml', md5: '8e1171d63cee4b6010cfce25dd29243d' },
  alimGrp: { name: 'alim_grp_2025_11_03.xml', md5: 'c31aeea90349c3aab86f98ef5f4f10da' },
  compo: { name: 'compo_2025_11_03.xml', md5: '2da725585946434df320d8041631998b' },
  consts: { name: 'const_2025_11_03.xml', md5: 'd8f2f25fdacb887bc993a6eeaf80f203' },
};

/** Constituants retenus (codes Ciqual) et libellé attendu : si la table change un code, le générateur s'arrête. */
export const CIQUAL_NUTRIENTS = { kcal: 328, proteinG: 25003, fatG: 40000, carbG: 31000, fiberG: 34100 };
const NUTRIENT_LABELS = {
  kcal: 'Energie, Règlement UE N° 1169/2011 (kcal/100 g)',
  proteinG: 'Protéines, N x 6.25 (g/100 g)',
  fatG: 'Lipides (g/100 g)',
  carbG: 'Glucides (g/100 g)',
  fiberG: 'Fibres alimentaires (g/100 g)',
};
const KEYS = Object.keys(CIQUAL_NUTRIENTS);

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

export function decodeXmlText(text) {
  return text.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m]).trim();
}

/**
 * Teneur d'un constituant : « 59,7 » (valeur), « - » ou vide (absente), « traces », « < 0,5 » (borne). Rien d'autre n'est admis.
 * @returns {{kind:'value',value:number}|{kind:'missing'}|{kind:'traces'}|{kind:'below',bound:number}|{kind:'invalid'}}
 */
export function parseDecimal(text) {
  const s = decodeXmlText(text).replace(/\s+/g, ' ');
  if (s === '' || s === '-') return { kind: 'missing' };
  if (s === 'traces') return { kind: 'traces' };
  const number = (x) => (/^\d+(,\d+)?$/.test(x) ? Number(x.replace(',', '.')) : null);
  const below = /^< ?(\S+)$/.exec(s);
  if (below) {
    const bound = number(below[1]);
    return bound === null ? { kind: 'invalid' } : { kind: 'below', bound };
  }
  const value = number(s);
  return value === null ? { kind: 'invalid' } : { kind: 'value', value };
}

/** Blocs `<TAG>…</TAG>` d'un fichier de la table, en objets { balise: texte | null } (`missing` ou balise vide : null). */
export function parseTable(xml, tag) {
  const rows = [];
  const block = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  for (const match of xml.matchAll(block)) {
    const row = {};
    const field = /<([a-zA-Z_0-9]+)(\s[^>]*)?(?:\/>|>([\s\S]*?)<\/\1>)/g;
    for (const f of match[1].matchAll(field)) {
      const text = f[3] === undefined ? null : decodeXmlText(f[3]);
      row[f[1]] = text === null || text === '' ? null : text;
    }
    rows.push(row);
  }
  return rows;
}

/** Code de groupe des « aliments moyens » de la table, absent de la table des groupes. */
const UNCLASSIFIED_GROUP = '00';
const emptyCounts = () => Object.fromEntries(KEYS.map((k) => [k, 0]));

/**
 * Construit le catalogue à partir des quatre fichiers (texte XML). Déterministe : aliments triés par code numérique.
 * @returns {{data: object, stats: {foods:number, groups:number, missing:object, traces:object, below:object}}}
 */
export function buildCiqual({ alim, alimGrp, compo, consts }) {
  const byCode = new Map();
  for (const row of parseTable(consts, 'CONST')) byCode.set(row.const_code, row.const_nom_fr);
  for (const key of KEYS) {
    const code = String(CIQUAL_NUTRIENTS[key]);
    if (byCode.get(code) !== NUTRIENT_LABELS[key]) throw new Error(`constituant ${code} : libellé inattendu (${byCode.get(code) ?? 'absent'}), attendu « ${NUTRIENT_LABELS[key]} »`);
  }
  const codeToKey = new Map(KEYS.map((k) => [String(CIQUAL_NUTRIENTS[k]), k]));

  const groups = new Map();
  for (const row of parseTable(alimGrp, 'ALIM_GRP')) {
    if (!row.alim_grp_code || !row.alim_grp_nom_fr) throw new Error('groupe sans code ou sans nom');
    const known = groups.get(row.alim_grp_code);
    if (known !== undefined && known !== row.alim_grp_nom_fr) throw new Error(`groupe ${row.alim_grp_code} : deux noms`);
    groups.set(row.alim_grp_code, row.alim_grp_nom_fr);
  }

  const foods = new Map();
  for (const row of parseTable(alim, 'ALIM')) {
    const code = row.alim_code;
    if (!code || !/^\d+$/.test(code)) throw new Error(`code d'aliment invalide : ${String(code)}`);
    if (foods.has(code)) throw new Error(`code d'aliment dupliqué : ${code}`);
    if (!row.alim_nom_fr) throw new Error(`aliment ${code} sans nom`);
    // Code 00 : « aliment moyen », absent de la table des groupes ; aucun nom de groupe n'est inventé (group = null).
    const unclassified = row.alim_grp_code === UNCLASSIFIED_GROUP;
    if (!row.alim_grp_code || (!unclassified && !groups.has(row.alim_grp_code))) throw new Error(`aliment ${code} : groupe inconnu (${String(row.alim_grp_code)})`);
    foods.set(code, { code, nameFr: row.alim_nom_fr.replace(/\s+/g, ' '), group: unclassified ? null : row.alim_grp_code, kcal: null, proteinG: null, fatG: null, carbG: null, fiberG: null });
  }

  const stats = { foods: foods.size, groups: groups.size, missing: emptyCounts(), traces: emptyCounts(), below: emptyCounts() };
  const seen = new Set();
  for (const row of parseTable(compo, 'COMPO')) {
    const key = codeToKey.get(row.const_code ?? '');
    if (key === undefined) continue;
    const food = foods.get(row.alim_code ?? '');
    if (!food) throw new Error(`composition d'un aliment inconnu : ${String(row.alim_code)}`);
    const id = `${food.code}/${key}`;
    if (seen.has(id)) throw new Error(`composition dupliquée : ${id}`);
    seen.add(id);
    const parsed = parseDecimal(row.teneur ?? '');
    if (parsed.kind === 'invalid') throw new Error(`teneur illisible pour l'aliment ${food.code}, constituant ${key} : « ${String(row.teneur)} »`);
    if (parsed.kind === 'value') food[key] = parsed.value;
    else if (parsed.kind === 'missing') stats.missing[key] += 1;
    else if (parsed.kind === 'traces') stats.traces[key] += 1;
    else stats.below[key] += 1;
  }
  // Constituant jamais décrit pour l'aliment : inconnu aussi (compté « absent »).
  for (const food of foods.values()) for (const key of KEYS) if (!seen.has(`${food.code}/${key}`)) stats.missing[key] += 1;

  const list = [...foods.values()].sort((a, b) => Number(a.code) - Number(b.code));
  const groupList = [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([code, nameFr]) => ({ code, nameFr }));
  return { data: { schemaVersion: 1, source: { ...CIQUAL_SOURCE }, groups: groupList, foods: list }, stats };
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const LIMITS = { kcal: 900, proteinG: 100, fatG: 100, carbG: 100, fiberG: 100 };

/** Validation du contenu (équivalent d'un schéma) : liste d'erreurs, vide si valide. */
export function validateCiqual(data) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where} : ${msg}`);
  if (!isObj(data)) return ['ciqual.json : objet attendu'];
  if (data.schemaVersion !== 1) err('schemaVersion', 'doit valoir 1');
  const source = data.source;
  if (!isObj(source)) err('source', 'objet attendu');
  else for (const k of ['name', 'publisher', 'version', 'doi', 'licence', 'url', 'attribution']) if (!isStr(source[k])) err(`source.${k}`, 'texte non vide attendu');
  const groupCodes = new Set();
  if (!Array.isArray(data.groups)) err('groups', 'tableau attendu');
  else
    data.groups.forEach((g, i) => {
      if (!isObj(g) || !isStr(g.code) || !isStr(g.nameFr)) return err(`groups[${i}]`, 'code et nameFr attendus');
      if (groupCodes.has(g.code)) err(`groups[${i}]`, `code dupliqué : ${g.code}`);
      groupCodes.add(g.code);
    });
  const codes = new Set();
  if (!Array.isArray(data.foods)) err('foods', 'tableau attendu');
  else
    data.foods.forEach((f, i) => {
      const w = `foods[${i}]`;
      if (!isObj(f)) return err(w, 'objet attendu');
      if (typeof f.code !== 'string' || !/^\d+$/.test(f.code)) err(w, 'code numérique attendu');
      else if (codes.has(f.code)) err(w, `code dupliqué : ${f.code}`);
      else codes.add(f.code);
      if (!isStr(f.nameFr)) err(w, 'nameFr attendu');
      if (f.group !== null && (!isStr(f.group) || !groupCodes.has(f.group))) err(w, `groupe inconnu : ${String(f.group)}`);
      for (const k of KEYS) {
        if (!(k in f)) err(w, `clé manquante : ${k}`);
        else if (f[k] !== null && !(typeof f[k] === 'number' && Number.isFinite(f[k]) && f[k] >= 0)) err(w, `${k} : nombre positif ou null attendu`);
        else if (f[k] !== null && f[k] > LIMITS[k]) err(w, `${k} : ${f[k]} dépasse ${LIMITS[k]} pour 100 g`);
      }
      const macros = [f.proteinG, f.fatG, f.carbG];
      if (macros.every((m) => typeof m === 'number') && macros[0] + macros[1] + macros[2] > 100.5) err(w, 'protéines + lipides + glucides dépassent 100 g pour 100 g');
    });
  return errors;
}

/** Vérifie les sommes MD5 des fichiers bruts d'un dossier ; liste d'erreurs. */
export function checkRawFiles(dir) {
  const errors = [];
  for (const [id, file] of Object.entries(CIQUAL_FILES)) {
    const path = join(dir, file.name);
    if (!existsSync(path)) {
      errors.push(`${file.name} (${id}) : fichier absent de ${dir}`);
      continue;
    }
    const md5 = createHash('md5').update(readFileSync(path)).digest('hex');
    if (md5 !== file.md5) errors.push(`${file.name} : somme md5 ${md5} différente de la somme publiée ${file.md5}`);
  }
  return errors;
}

/** Retire l'éventuelle marque d'ordre des octets (U+FEFF) en tête d'un fichier XML. */
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/** Lit les fichiers bruts d'un dossier déjà vérifié et construit le catalogue. */
export function buildFromDir(dir) {
  const errors = checkRawFiles(dir);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const read = (name) => stripBom(readFileSync(join(dir, name), 'utf8'));
  return buildCiqual({ alim: read(CIQUAL_FILES.alim.name), alimGrp: read(CIQUAL_FILES.alimGrp.name), compo: read(CIQUAL_FILES.compo.name), consts: read(CIQUAL_FILES.consts.name) });
}
