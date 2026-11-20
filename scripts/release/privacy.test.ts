// DOC-PRIV (lot 0.28.0, C-165, C-110, C-181, C-182, D-318) : le dépôt est public. Aucun fichier suivi ne publie une valeur réelle d'Ali
// (sommeil, HRV, FC, poids, mensurations, cibles et calories, dates de séance, contenu d'archive), et aucun texte ni guide ne conseille
// de supprimer ou de réinstaller l'app sideloadée (perte de données). Ce test ne contient AUCUNE valeur réelle : il refuse des FORMES
// (« valeur réelle d'Ali », « ta moyenne Santé (…) », « constat … : 7 h 12 », cible chiffrée attribuée à un constat d'Ali). La liste exacte des
// valeurs retirées est gardée hors dépôt (HIST-01) ; un chiffre synthétique reste permis tant qu'il n'est pas attribué à Ali.
import { execFileSync } from 'node:child_process';
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
const read = (f: string): string => readFileSync(resolve(root, f), 'utf8');

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
    expect(probe('avec des nuits proches de ta moyenne Santé (6 h 01)')).toBe(true);
    expect(probe('valeur réelle d’Ali : 1')).toBe(true);
    expect(probe('sommeil cohérent avec Santé (constat du 01/01 : 5 h 55)')).toBe(true);
    expect(probe('constat d’Ali du 01/01 (cible importée à 1 999 kcal)')).toBe(true);
    expect(probe('fixture synthétique : 7 nuits de 7 h 30')).toBe(false);
    expect(probe('Données SYNTHÉTIQUES (aucune donnée d’Ali).')).toBe(false);
  });
  it('aucun fichier suivi ne porte ces formes', () => {
    // Une règle qui interdit la forme (« aucune valeur réelle d’Ali ») n’est pas une valeur.
    expect(scan(files, PERSONAL_VALUE_FORMS, (line) => /\b(aucune? (donnée|valeur)s?|refuse[rz]?|retire[rz]?|interdite?s?)\b/i.test(line))).toEqual([]);
  });
});

/** Textes vus par Ali (catalogues, hors tests) et guides : jamais « réinstalle », « supprime l'app » ni suppression manuelle des données. */
const USER_TEXTS = files.filter(
  (f) => (/^src\/i18n\//.test(f) && !/\.test\.tsx?$/.test(f)) || /^docs\/(install-[^/]+|guide-[^/]+|RESET-01)\.md$/.test(f) || f === 'README.md',
);
const DANGER: readonly RegExp[] = [/\b(ré|dés)install(e|es|ez|er)\b/i, /supprime[rsz]?\s+(une|l['’]|cette|ton|ta)\s*(autre\s+)?app/i, /Remove-Item/i];
/** Négations explicites qui protègent les données (« ne supprime jamais l'app », « ne la supprime pas »), ou SideStore lui-même. */
const SAFE =
  /\bjamais\b|\bne\s+(la\s+|le\s+|l['’])?(supprime|désinstalle|réinstalle)|aucune app|SideStore lui-même|Réinstalle-le avec iloader|\bne désinstalle pas\b|\bne pas\b|\bon désinstalle\b/i;
const isComment = (line: string): boolean => /^\s*(\/\/|\*|\/\*)/.test(line);

describe('aucun conseil de supprimer ou de réinstaller l’app (C-110, C-181)', () => {
  it('catalogues et guides', () => {
    expect(scan(USER_TEXTS, DANGER, (line) => SAFE.test(line) || isComment(line))).toEqual([]);
  });
  it('les guides d’installation ne parlent plus de CircleTasks (C-182)', () => {
    const guides = ['docs/install-iphone.md', 'docs/install-pc.md'];
    const inherited = [/\btâches\b/i, /\bagendas?\b/i, /jours fériés/i, /CT_GOOGLE/, /Réglages\s*[›>]\s*(«\s*)?(À propos|Synchronisation|Journaux|Rechercher)/];
    expect(scan(guides, inherited)).toEqual([]);
  });
});
