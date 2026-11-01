// Convention déterministe de qualification des mentions d'une ancienne identité ou d'un ancien chemin (P-01, D-41, D-48, D-50).
// Une mention est jugée ligne par ligne ; l'exception est attachée à la mention, jamais à un fichier entier.
//
//   'explicit'    : la ligne porte `<!-- ancien-ok: motif -->` avec un motif d'au moins 3 caractères (motif vide = refus).
//   'protection'  : la ligne protège les données CircleTasks (chemin de données + mot d'interdiction : « toujours », « jamais »…).
//   'protocol'    : la ligne porte une constante du protocole de synchro (sel HKDF « circletasks », D-26) : figée, jamais renommée.
//   'provenance'  : la ligne dit d'où vient Spartiate (« fork de », « repris de »…) ; admise pour le nom de marque seulement.
//   'negative'    : la ligne cite le terme pour le proscrire ou le dater (« pas de », « ancien », « alors que », « remplacé »…).
//   'active'      : tout le reste, c'est-à-dire une prescription ou un usage réel : refusé.

const COMMENT = /<!--[\s\S]*?-->/g;
const EXPLICIT = /<!--\s*ancien-ok:\s*(\S[^>]{2,}?)\s*-->/;

const DATA_PATH = /%APPDATA%|%LOCALAPPDATA%|iCloud Drive[\\/]|Drive[\\/]CircleTasks|iCloud `?CircleTasks/i;
const PROHIBITION = /\b(toujours|jamais|interdit\w*|intouchables?|prot[ée]g\w*|aucune lecture|ne lis|ne touche|ne modifie|hors de)\b/i;

/** Verbes qui prescrivent un usage : « toujours écrire dans … » n'est pas une protection. */
const PRESCRIPTIVE = /((?:toujours|obligatoirement) écri(?:re|s|vez) dans|identifiant actif)/i;
const PROVENANCE = /\b(fork|forké|issu(?:e|es|s)?|repris(?:e|es)?|hérit\w*|dérivé\w*|copie|copié\w*|provenance|origine|ex-)\b/i;

const NEGATIVE = new RegExp(
  [
    'pas de',
    'ni de',
    'ni `',
    'jamais',
    'alors que',
    'au lieu de',
    'contre-exemple',
    'exemple (?:négatif|interdit)',
    'proscri',
    'obsol[eè]t',
    'ancien',
    'abandonn',
    'remplac',
    'historique',
    'contredi',
    'supprim',
    'retir[ée]',
    'ne s.applique pas',
  ].join('|'),
  'i',
);

/** @param {string} term */
const isBrandTerm = (term) => /^circletasks$/i.test(term);

/**
 * Qualifie la mention de `term` dans `line`.
 * @param {string} line
 * @param {string} term
 * @returns {'explicit' | 'protection' | 'protocol' | 'provenance' | 'negative' | 'active'}
 */
export function classifyLine(line, term) {
  if (EXPLICIT.test(line)) return 'explicit';
  const bare = line.replace(COMMENT, '');
  if (DATA_PATH.test(bare) && PROHIBITION.test(bare) && !PRESCRIPTIVE.test(bare)) return 'protection';
  if (isBrandTerm(term) && /HKDF/.test(bare)) return 'protocol';
  if (isBrandTerm(term) && PROVENANCE.test(bare)) return 'provenance';
  // La négation doit PRÉCÉDER le terme de près : « jamais un autre » après l'identifiant ne le nie pas.
  const at = bare.indexOf(term);
  if (NEGATIVE.test(at < 0 ? bare : bare.slice(Math.max(0, at - 90), at))) return 'negative';
  return 'active';
}

/**
 * Mentions actives (refusées) des termes dans un texte.
 * @param {string} text
 * @param {string[]} terms
 * @returns {{ lineNo: number; term: string; line: string }[]}
 */
export function activeMentions(text, terms) {
  const found = [];
  text.split('\n').forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    for (const term of terms) {
      if (line.includes(term) && classifyLine(line, term) === 'active') found.push({ lineNo: index + 1, term, line });
    }
  });
  return found;
}
