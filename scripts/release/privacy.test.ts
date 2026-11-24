// DOC-PRIV (lot 0.28.0, C-165, C-110, C-181, C-182, D-318) : le dépôt est public. Aucun fichier suivi ne publie une valeur réelle d'Ali
// (sommeil, HRV, FC, poids, mensurations, cibles et calories, dates de séance, contenu d'archive), et aucun texte ni guide ne conseille
// de supprimer ou de réinstaller l'app sideloadée (perte de données). Ce test ne contient AUCUNE valeur réelle : il refuse des FORMES
// (« valeur réelle d'Ali », « ta moyenne habituelle (…) », « constat … : 7 h 12 », cible chiffrée attribuée à un constat d'Ali). La liste exacte des
// valeurs retirées est gardée hors dépôt (HIST-01) ; un chiffre synthétique reste permis tant qu'il n'est pas attribué à Ali.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
const TEXT = /\.(md|ts|tsx|mjs|cjs|js|json|ya?ml|txt|csv|html|css|rs|swift|toml|plist)$/;
/** Hors champ : documents de l'ancien projet (lecture seule, D-40), contenu embarqué (données publiques), fichiers générés. */
const OUT = [/^docs\/archive\//, /^content\//, /(^|\/)package-lock\.json$/, /Cargo\.lock$/, /^src-tauri\/vendor\//, /^src-tauri\/gen\//];
const SELF = 'scripts/release/privacy.test.ts';
const files = tracked.filter((f) => f !== SELF && TEXT.test(f) && !OUT.some((re) => re.test(f)));
const cache = new Map<string, string>();
/** Lecture mémorisée : le dépôt entier est parcouru par plusieurs gardes (DATA-0292). */
const read = (f: string): string => {
  let text = cache.get(f);
  if (text === undefined) {
    text = readFileSync(resolve(root, f), 'utf8');
    cache.set(f, text);
  }
  return text;
};

type Hit = { file: string; line: number; text: string };
function scan(paths: readonly string[], patterns: readonly RegExp[], allow: (line: string) => boolean = () => false): Hit[] {
  const hits: Hit[] = [];
  for (const file of paths) {
    read(file).split(/\r?\n/).forEach((text, i) => {
      if (patterns.some((re) => re.test(text)) && !allow(text)) hits.push({ file, line: i + 1, text: text.slice(0, 160) });
    });
  }
  return hits;
}

/** Formes qui attribuent une valeur corporelle ou une cible à Ali. */
export const PERSONAL_VALUE_FORMS: readonly RegExp[] = [
  /valeurs? réelles? d['’]Ali/i,
  /\b(nuits|pesées?|mesures?|mensurations|sommeil|moyennes?|HRV|FC repos)\s+(réel(le)?s?\s+)?d['’]Ali\b/i,
  /\b(ta|ton|tes)\s+(moyenne|poids|sommeil|nuits?|HRV|FC|cible|besoin|masse|tour de taille)\b[^.\n|]{0,40}\d/i,
  /moyenne (Apple )?Santé[^.\n|]{0,24}\d/i,
  /constat[^.\n|]{0,60}:\s*\d{1,2} h \d{2}\b/i,
  /constat d['’]Ali[^|\n]{0,160}\b\d[\d  ]{2,}\s?kcal\b/i,
  /cible (importée|du jour)[^|\n.]{0,40}\b\d[\d  ]{2,}\s?kcal\b/i,
];

describe('aucune valeur réelle d’Ali dans les fichiers suivis (C-165, D-318)', () => {
  it('les formes sont reconnues (témoins synthétiques)', () => {
    const probe = (s: string): boolean => PERSONAL_VALUE_FORMS.some((re) => re.test(s));
    expect(probe('avec des nuits proches de ta moyenne habituelle (6 h 01)')).toBe(true);
    expect(probe('valeur réelle d’Ali : 1')).toBe(true);
    expect(probe('sommeil cohérent avec Santé (constat du 01/01 : 5 h 55)')).toBe(true);
    expect(probe('constat d’Ali du 01/01 (cible importée à 1 999 kcal)')).toBe(true);
    expect(probe('fixture synthétique : 7 nuits de 7 h 30')).toBe(false);
    expect(probe('Données SYNTHÉTIQUES (aucune donnée d’Ali).')).toBe(false);
  });
  it('aucun fichier suivi ne porte ces formes', () => {
    // Une règle qui interdit la forme (« aucune valeur réelle d’Ali ») n’est pas une valeur.
    expect(scan(files, PERSONAL_VALUE_FORMS, (line) => /\b(aucune? (donnée|valeur)s?|refuse[rz]?|retir(e|é|ée|és|ées|er|ez)?|interdite?s?)\b/i.test(line))).toEqual([]);
  });
});

/** Textes vus par Ali (catalogues, hors tests) et guides : jamais « réinstalle », « supprime l'app » ni suppression manuelle des données. */
const USER_TEXTS = files.filter(
  (f) => (/^src\/i18n\//.test(f) && !/\.test\.tsx?$/.test(f)) || /^docs\/(install-[^/]+|guide-[^/]+|RESET-01)\.md$/.test(f) || f === 'README.md',
);
const DANGER: readonly RegExp[] = [
  /\b(ré|dés)install(e|es|ez|er|ation)\b/i,
  /supprime[rsz]?\s+(une|l['’]|cette|ton|ta)\s*(autre\s+)?app/i,
  /supprim\w*\s+(à la main|les dossiers)/i,
  /efface[rsz]?\s+(le|les)\s+dossiers?/i,
  /Remove-Item/i,
];
/** Négations explicites qui protègent les données (« ne supprime jamais l'app », « ne la supprime pas »), ou SideStore lui-même. */
const SAFE =
  /\bjamais\b|\bne\s+(la\s+|le\s+|l['’])?(supprime|désinstalle|réinstalle)|aucune app|SideStore lui-même|Réinstalle-le avec iloader|\bne désinstalle pas\b|\bne pas\b|\bon désinstalle\b|n['’]existe plus/i;
const isComment = (line: string): boolean => /^\s*(\/\/|\*|\/\*)/.test(line);

describe('aucun conseil de supprimer ou de réinstaller l’app (C-110, C-181)', () => {
  it('catalogues et guides', () => {
    // La négation doit être dans la même proposition que le verbe dangereux (« Ne supprime jamais l'app », pas « jamais » ailleurs).
    const clauses = (line: string): string[] => line.split(/[.;!?|]|\s—\s|\s:\s/);
    const dangerous = (line: string): boolean => !isComment(line) && clauses(line).some((c) => DANGER.some((re) => re.test(c)) && !SAFE.test(c));
    expect(scan(USER_TEXTS, [/./], (line) => !dangerous(line))).toEqual([]);
  });
  it('les guides d’installation n’ont plus de vestige de l’ancien projet (C-182)', () => {
    const guides = ['docs/install-iphone.md', 'docs/install-pc.md'];
    const inherited = [/\btâches\b/i, /\bagendas?\b/i, /jours fériés/i, /CT_GOOGLE/, /Réglages\s*[›>]\s*(«\s*)?(À propos|Synchronisation|Journaux|Rechercher)/];
    expect(scan(guides, inherited)).toEqual([]);
  });
});

// DATA-0292 (BL-138, D-489) : le nom d'un lieu réel (salle de sport d'Ali) ne figure dans AUCUN fichier suivi, contenu embarqué (content/), CHANGELOG et
// fiches compris, hors docs/archive (lecture seule, D-40). La garde ne contient pas le nom : elle compare l'empreinte SHA-256 de chaque MOT des
// fichiers (découpage aux non-lettres et aux majuscules internes : `FOO_NOM`, `forNom`, `d'Nom`, `nom-complet` sont des mots « nom ») et des chemins.
const PLACE_SHA256 = '2438ec1b751d071979589d45f4f5d9d9697ade8f1fb474ae21898d16f52110d4';
const PLACE_LENGTH = 6;
/** Fichiers hors périmètre de la passe DATA-0292 (journal des décisions, propriété d'Ali) : nettoyage demandé à l'orchestrateur, puis liste vidée. */
const PLACE_PENDING_CLEANUP: readonly string[] = ['docs/decisions.md'];
const ALL_TEXT = /\.(md|ts|tsx|mjs|cjs|js|json|ya?ml|txt|csv|html|css|rs|swift|toml|plist|svg|sql)$/;
const placeFiles = tracked.filter((f) => f !== SELF && !/(^|\/)(package-lock\.json|Cargo\.lock)$/.test(f) && !/^docs\/archive\//.test(f) && !PLACE_PENDING_CLEANUP.includes(f));
const hashed = new Map<string, boolean>();
function isPlaceWord(word: string): boolean {
  let known = hashed.get(word);
  if (known === undefined) {
    known = createHash('sha256').update(word).digest('hex') === PLACE_SHA256;
    hashed.set(word, known);
  }
  return known;
}
export function mentionsPlace(text: string): boolean {
  // Mots : minuscules précédées d'une majuscule facultative, ou suite de majuscules (« fooNom » donne « foo », « Nom » ; « NOMReal » donne « NOM », « Real »).
  for (const match of text.matchAll(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g)) {
    const word = match[0];
    if (word.length === PLACE_LENGTH && isPlaceWord(word.toLowerCase())) return true;
  }
  return false;
}

describe('aucun nom de lieu réel dans les fichiers suivis (D-489)', () => {
  it('la garde reconnaît le nom sous ses formes (témoins construits, jamais écrits)', () => {
    const word = String.fromCharCode(97, 110, 116, 111, 110, 121);
    const cap = word.charAt(0).toUpperCase() + word.slice(1);
    expect(mentionsPlace(`fitness-park-${word}`)).toBe(true);
    expect(mentionsPlace(`FITNESS_PARK_${word.toUpperCase()}`)).toBe(true);
    expect(mentionsPlace(`for${cap}`)).toBe(true);
    expect(mentionsPlace(`${word.toUpperCase()}Real`)).toBe(true);
    expect(mentionsPlace(`une salle à ${cap}.`)).toBe(true);
    expect(mentionsPlace('fitness-park-salle-complete, Salle complète, ant tony')).toBe(false);
  });
  it('aucun fichier suivi (contenu, CHANGELOG, fiches, tests, chemins) ne le porte', () => {
    const textual = placeFiles.filter((f) => ALL_TEXT.test(f));
    expect(placeFiles.filter((f) => mentionsPlace(f))).toEqual([]);
    expect(textual.filter((f) => mentionsPlace(read(f)))).toEqual([]);
  });
  it('la liste d’exceptions ne garde que des fichiers qui existent encore', () => {
    for (const f of PLACE_PENDING_CLEANUP) expect(tracked, f).toContain(f);
  });
});
