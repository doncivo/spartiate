#!/usr/bin/env node
/* global process, console */
// STR-01 (D-310, D-311) : construit content/strength/standards.json depuis les réponses brutes de l'API publique FitnessVolt Strength Standards
// (population « gym », données Symmetric Strength déclarées, `format=table`, `unit=kg`), téléchargées une fois par l'agent dans un dossier
// temporaire : un fichier `gym_<lift>_<sex>.json` par mouvement et par sexe
// (https://fitnessvolt.com/wp-json/fvss/v1/standards/<lift>?sex=<sex>&source=gym&format=table&unit=kg).
// Aucun nombre n'est inventé : chaque valeur est celle de la source, ramenée à 0,1 kg (la source publie des décimales à 0,1 kg écrites en
// flottants binaires ; le script refuse toute valeur qui s'en écarte de plus de 1e-6). La ligne « all » (tous poids confondus) n'est pas reprise.
// Usage : node scripts/content/build-strength-standards.mjs <dossier brut> [fichier de sortie]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PERCENTILES = [10, 25, 50, 75, 90, 95, 99];

/** Les 8 groupes (D-311, maquette PC-Progres) et les muscles du catalogue qui les désignent quand ils sont PRINCIPAUX dans un exercice. */
export const GROUPS = [
  { id: 'chest', muscles: ['chest'] },
  { id: 'back', muscles: ['lats', 'middle-traps'] },
  { id: 'shoulders', muscles: ['front-delts', 'middle-delts', 'deltoids', 'shoulders'] },
  { id: 'biceps', muscles: ['biceps'] },
  { id: 'triceps', muscles: ['triceps'] },
  { id: 'quads', muscles: ['quads'] },
  { id: 'hamstrings', muscles: ['hamstrings'] },
  { id: 'glutes', muscles: ['glutes'] },
];

/** Mouvements de référence (clé du catalogue → mouvement de la source), groupes déduits des muscles principaux des exercices qui portent la clé. */
export const LIFTS = [
  { key: 'bench', sourceLift: 'bench_press', groups: ['chest'], totalLoad: false },
  { key: 'incline-bench', sourceLift: 'incline_bench_press', groups: ['chest'], totalLoad: false },
  { key: 'barbell-row', sourceLift: 'pendlay_row', groups: ['back'], totalLoad: false },
  { key: 'pull-up', sourceLift: 'pullup', groups: ['back'], totalLoad: true },
  { key: 'chin-up', sourceLift: 'chinup', groups: ['back', 'biceps'], totalLoad: true },
  { key: 'overhead-press', sourceLift: 'overhead_press', groups: ['shoulders'], totalLoad: false },
  { key: 'dip', sourceLift: 'dip', groups: ['triceps'], totalLoad: true },
  { key: 'back-squat', sourceLift: 'back_squat', groups: ['quads'], totalLoad: false },
  { key: 'front-squat', sourceLift: 'front_squat', groups: ['quads'], totalLoad: false },
  { key: 'deadlift', sourceLift: 'deadlift', groups: ['hamstrings', 'glutes'], totalLoad: false },
  { key: 'sumo-deadlift', sourceLift: 'sumo_deadlift', groups: ['glutes'], totalLoad: false },
];

const tenth = (value, where) => {
  const rounded = Math.round(value * 10) / 10;
  if (!(Number.isFinite(value) && Math.abs(rounded - value) < 1e-6)) throw new Error(`${where} : valeur ${String(value)} hors du pas de 0,1 kg`);
  return rounded;
};

/** Catégories d'un sexe : « 83kg » → jusqu'à 83 kg inclus ; « 120+kg » → au-delà de la précédente (null). */
export function classesOf(raw, where) {
  if (raw.success !== true || raw.unit !== 'kg' || raw.format !== 'table' || raw.source !== 'self_reported_gym') throw new Error(`${where} : réponse inattendue`);
  const classes = raw.weight_classes
    .filter((w) => w.weight_class !== 'all')
    .map((w) => {
      const m = /^(\d+)(\+?)kg$/.exec(w.weight_class);
      if (!m) throw new Error(`${where} : catégorie illisible ${String(w.weight_class)}`);
      const kg = PERCENTILES.map((p) => tenth(w.percentiles[`p${String(p)}`], `${where} ${w.weight_class} p${String(p)}`));
      for (let i = 1; i < kg.length; i++) if (!(kg[i] >= kg[i - 1])) throw new Error(`${where} ${w.weight_class} : centiles non croissants`);
      return { upToKg: m[2] === '+' ? null : Number(m[1]), sampleSize: w.sample_size, kg };
    });
  const open = classes.filter((c) => c.upToKg === null);
  if (open.length !== 1 || classes.at(-1).upToKg !== null) throw new Error(`${where} : une seule catégorie ouverte, en dernier`);
  for (let i = 1; i < classes.length - 1; i++) if (!(classes[i].upToKg > classes[i - 1].upToKg)) throw new Error(`${where} : catégories non croissantes`);
  return classes;
}

export function buildStandards(rawDir) {
  const read = (lift, sex) => JSON.parse(readFileSync(join(rawDir, `gym_${lift}_${sex}.json`), 'utf8'));
  const first = read(LIFTS[0].sourceLift, 'male');
  return {
    schemaVersion: 1,
    source: {
      name: 'FitnessVolt Strength Standards',
      dataset: first.source_label,
      population: first.source,
      url: 'https://fitnessvolt.com/strength-standards/',
      api: 'https://fitnessvolt.com/wp-json/fvss/v1/standards/{lift}?sex={sex}&source=gym&format=table&unit=kg',
      license: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) ; lien d’attribution visible exigé',
      attribution: first.attribution.text,
      dataVersion: first.data_version,
      consultedOn: '2026-11-16',
      unit: 'kg',
    },
    percentiles: PERCENTILES,
    groups: GROUPS,
    lifts: LIFTS.map((l) => ({ ...l, male: classesOf(read(l.sourceLift, 'male'), `${l.sourceLift} male`), female: classesOf(read(l.sourceLift, 'female'), `${l.sourceLift} female`) })),
  };
}

function main() {
  const rawDir = process.argv[2];
  if (!rawDir) throw new Error('usage : node scripts/content/build-strength-standards.mjs <dossier brut> [sortie]');
  const out = process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'strength', 'standards.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(buildStandards(resolve(rawDir)), null, 2)}\n`);
  console.log(`build-strength-standards : ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
