#!/usr/bin/env node
/* global process, console */
// Validation du contenu embarqué de Spartiate (I1-01) : Node, aucune dépendance.
// Usage : node scripts/content/validate-content.mjs [dossier-content]   (défaut : content/)
// Sortie : lignes `::error::` et code 1 à la moindre erreur ; aucun avertissement toléré.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Minimum, pas un compte exact : le catalogue s'étend (CONTENT-02, D-83) ; les 150 exercices d'origine ne sont jamais retirés. */
export const EXPECTED_EXERCISES = 150;
export const EXPECTED_PROGRAMS = 4;

export const PATTERNS = ['push-horizontal', 'push-vertical', 'pull-horizontal', 'pull-vertical', 'hinge', 'squat', 'lunge', 'carry', 'core', 'isolation'];
export const KINDS = ['compound', 'isolation'];
export const METRICS = ['load-reps', 'bodyweight-reps', 'time', 'distance'];
export const GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms'];
export const PROFILE_KINDS = ['salle', 'maison', 'voyage'];
export const SPLITS = ['upper-lower', 'full-body', 'ppl'];
export const ROLES = ['primary', 'secondary'];
/** Périodisation commune de 5 semaines (PRD § 12.5, D-20). */
export const PERIODIZATION = [
  { week: 1, workingSets: 2, rirMin: 3, rirMax: 3, loadFactor: null },
  { week: 2, workingSets: 3, rirMin: 2, rirMax: 2, loadFactor: null },
  { week: 3, workingSets: 3, rirMin: 1, rirMax: 1, loadFactor: null },
  { week: 4, workingSets: 4, rirMin: 0, rirMax: 1, loadFactor: null },
  { week: 5, workingSets: 2, rirMin: 5, rirMax: null, loadFactor: 0.8 },
];

/** Médias d'exercice (I6-07, D-232, révisables par Ali) : plafond par fichier et budget du catalogue, en octets. */
export const MEDIA_MAX_BYTES = 153_600;
export const MEDIA_TOTAL_MAX_BYTES = 8_388_608;
/** Licences admises pour un média (D-233) : aucune licence NC ni ND, aucune licence floue. */
export const ALLOWED_MEDIA_LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'PDM'];
export const MEDIA_EXTENSIONS = ['.png', '.jpg', '.webp'];
/** Sources vérifiées (D-231) : licence lue sur la page source, commit épinglé. Une nouvelle source entre ici, par une décision. */
export const MEDIA_SOURCES = {
  everkinetic: {
    title: 'Everkinetic',
    author: 'Everkinetic (Greg Priday et contributeurs)',
    repository: 'github.com/everkinetic/data',
    commit: '446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6',
    license: 'CC-BY-SA-4.0',
    licenseUri: 'creativecommons.org/licenses/by-sa/4.0',
    retrievedOn: '2026-11-13',
  },
};
const NETWORK = /[a-z][a-z0-9+.-]*:\/\//i;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Un exercice est compatible si chaque groupe d'alternatives contient au moins un équipement disponible. */
export function isExerciseCompatible(exercise, available) {
  return exercise.equipmentGroups.every((group) => group.some((id) => available.has(id)));
}

/**
 * Valide un ensemble de contenu déjà chargé.
 * @param {{muscles:any, equipment:any, exercises:any, programs:Array<{file:string,data:any}>, profiles:any}} c
 * @param {{expectedExercises?:number|null, expectedPrograms?:number|null, mediaDir?:string|null}} [opts]
 * @returns {{errors:string[], stats:object}}
 */
export function validateContent(c, opts = {}) {
  const expectedExercises = opts.expectedExercises === undefined ? EXPECTED_EXERCISES : opts.expectedExercises;
  const expectedPrograms = opts.expectedPrograms === undefined ? EXPECTED_PROGRAMS : opts.expectedPrograms;
  const errors = [];
  const err = (where, msg) => errors.push(`${where} : ${msg}`);

  // --- muscles.json ---
  const muscleIds = new Set();
  if (!isObj(c.muscles) || c.muscles.schemaVersion !== 1 || !Array.isArray(c.muscles.muscles)) {
    err('muscles.json', 'forme attendue { schemaVersion: 1, muscles: [] }');
  } else {
    c.muscles.muscles.forEach((m, i) => {
      const w = `muscles.json[${i}]`;
      if (!isObj(m)) return err(w, 'objet attendu');
      if (!isStr(m.id) || !KEBAB.test(m.id)) err(w, 'champ manquant ou invalide : id');
      else if (muscleIds.has(m.id)) err(w, `identifiant dupliqué : ${m.id}`);
      else muscleIds.add(m.id);
      if (!isStr(m.nameFr)) err(w, 'champ manquant : nameFr');
      if (!isStr(m.group)) err(w, 'champ manquant : group');
    });
  }

  // --- equipment.json ---
  const equipmentIds = new Set();
  if (!isObj(c.equipment) || c.equipment.schemaVersion !== 1 || !Array.isArray(c.equipment.equipment)) {
    err('equipment.json', 'forme attendue { schemaVersion: 1, equipment: [] }');
  } else {
    c.equipment.equipment.forEach((e, i) => {
      const w = `equipment.json[${i}]`;
      if (!isObj(e)) return err(w, 'objet attendu');
      if (!isStr(e.id) || !KEBAB.test(e.id)) err(w, 'champ manquant ou invalide : id');
      else if (equipmentIds.has(e.id)) err(w, `identifiant dupliqué : ${e.id}`);
      else equipmentIds.add(e.id);
      if (!isStr(e.nameFr)) err(w, 'champ manquant : nameFr');
      if (!isStr(e.family)) err(w, 'champ manquant : family');
    });
  }

  // --- exercises.json ---
  const exercisesById = new Map();
  const mediaFiles = [];
  const list = isObj(c.exercises) && c.exercises.schemaVersion === 1 && Array.isArray(c.exercises.exercises) ? c.exercises.exercises : null;
  if (!list) {
    err('exercises.json', 'forme attendue { schemaVersion: 1, exercises: [] }');
  } else {
    if (expectedExercises !== null && list.length < expectedExercises) {
      err('exercises.json', `au moins ${expectedExercises} exercices attendus, ${list.length} trouvés`);
    }
    list.forEach((x, i) => {
      const w = `exercises.json[${i}]${isObj(x) && typeof x.id === 'string' ? ` (${x.id})` : ''}`;
      if (!isObj(x)) return err(w, 'objet attendu');
      if (!isStr(x.id) || !KEBAB.test(x.id)) err(w, 'champ manquant ou invalide : id (kebab-case)');
      else if (exercisesById.has(x.id)) err(w, `identifiant dupliqué : ${x.id}`);
      else exercisesById.set(x.id, x);
      if (!isStr(x.nameFr)) err(w, 'champ manquant : nameFr');
      if (!GROUPS.includes(x.group)) err(w, `group hors liste : ${String(x.group)}`);
      if (!Array.isArray(x.aliasesEn) || !x.aliasesEn.every(isStr)) err(w, 'aliasesEn : tableau de chaînes attendu');
      if (!PATTERNS.includes(x.pattern)) err(w, `pattern hors liste : ${String(x.pattern)}`);
      if (!KINDS.includes(x.kind)) err(w, `kind hors liste : ${String(x.kind)}`);
      if (!METRICS.includes(x.metric)) err(w, `metric hors liste : ${String(x.metric)}`);
      if (typeof x.unilateral !== 'boolean') err(w, 'unilateral : booléen attendu');
      if (!(x.bodyweightFraction === null || (isNum(x.bodyweightFraction) && x.bodyweightFraction > 0 && x.bodyweightFraction <= 1))) {
        err(w, 'bodyweightFraction : nombre dans ]0, 1] ou null');
      }
      if (x.schemaVersion !== 1) err(w, 'schemaVersion doit valoir 1');
      if (!(x.strengthStandardKey === null || isStr(x.strengthStandardKey))) err(w, 'strengthStandardKey : chaîne ou null');

      // muscles
      if (!Array.isArray(x.muscles) || x.muscles.length === 0) err(w, 'muscles : tableau non vide attendu');
      else {
        const seen = new Set();
        let primarySum = 0;
        for (const m of x.muscles) {
          if (!isObj(m) || !isStr(m.id)) { err(w, 'muscle mal formé'); continue; }
          if (!muscleIds.has(m.id)) err(w, `muscle inconnu : ${m.id}`);
          if (seen.has(m.id)) err(w, `muscle dupliqué : ${m.id}`);
          seen.add(m.id);
          if (!isNum(m.weight) || m.weight <= 0 || m.weight > 1) err(w, `poids de muscle hors ]0, 1] : ${m.id}`);
          if (!ROLES.includes(m.role)) err(w, `rôle de muscle hors liste : ${m.id}`);
          if (m.role === 'primary' && isNum(m.weight)) primarySum += m.weight;
        }
        if (primarySum < 1) err(w, `somme des poids des muscles principaux < 1 (${primarySum})`);
      }

      // matériel
      if (!Array.isArray(x.equipment) || x.equipment.length === 0) err(w, 'equipment : tableau non vide attendu');
      else for (const e of x.equipment) if (!equipmentIds.has(e)) err(w, `matériel inconnu : ${String(e)}`);
      if (!Array.isArray(x.equipmentGroups) || !x.equipmentGroups.every((g) => Array.isArray(g) && g.length > 0)) {
        err(w, 'equipmentGroups : tableau de groupes non vides attendu');
      } else if (Array.isArray(x.equipment)) {
        for (const g of x.equipmentGroups) for (const e of g) if (!x.equipment.includes(e)) err(w, `equipmentGroups : ${String(e)} absent de equipment`);
      }

      // volume par défaut selon la métrique
      const range = x.defaultRepRange;
      if (x.metric === 'load-reps' || x.metric === 'bodyweight-reps') {
        if (!(Array.isArray(range) && range.length === 2 && isInt(range[0]) && isInt(range[1]) && range[0] >= 1 && range[0] <= range[1])) {
          err(w, 'defaultRepRange : [min, max] entiers avec 1 <= min <= max attendu');
        }
        if (x.defaultDurationSec !== null || x.defaultDistanceM !== null) err(w, 'defaultDurationSec et defaultDistanceM doivent être null pour une métrique en répétitions');
      } else if (x.metric === 'time') {
        if (range !== null) err(w, 'defaultRepRange doit être null pour la métrique time');
        if (!(isInt(x.defaultDurationSec) && x.defaultDurationSec > 0)) err(w, 'defaultDurationSec : entier > 0 attendu pour la métrique time');
        if (x.defaultDistanceM !== null) err(w, 'defaultDistanceM doit être null pour la métrique time');
      } else if (x.metric === 'distance') {
        if (range !== null) err(w, 'defaultRepRange doit être null pour la métrique distance');
        if (!(isInt(x.defaultDistanceM) && x.defaultDistanceM > 0)) err(w, 'defaultDistanceM : entier > 0 attendu pour la métrique distance');
        if (x.defaultDurationSec !== null) err(w, 'defaultDurationSec doit être null pour la métrique distance');
      }
      if (!(isInt(x.defaultRestSec) && x.defaultRestSec >= 0 && x.defaultRestSec <= 600)) err(w, 'defaultRestSec : entier entre 0 et 600 attendu');

      // instructions
      const ins = x.instructions;
      if (!isObj(ins)) err(w, 'instructions : objet attendu');
      else {
        if (!isStr(ins.setup)) err(w, 'instructions.setup vide ou manquant');
        if (!isStr(ins.execution)) err(w, 'instructions.execution vide ou manquant');
        if (!Array.isArray(ins.mistakes) || ins.mistakes.length !== 3 || !ins.mistakes.every(isStr)) err(w, 'instructions.mistakes : exactement 3 textes non vides attendus');
      }

      // média : licence et source obligatoires pour tout média (H-9, D-71)
      const media = x.media;
      if (!isObj(media) || !Array.isArray(media.images) || !(media.video === null || isStr(media.video))) {
        err(w, 'media : { images: [], video: null|chaîne, license, source } attendu');
      } else {
        const hasMedia = media.images.length > 0 || media.video !== null;
        if (hasMedia && (!isStr(media.license) || !isStr(media.source))) err(w, 'média sans licence ou sans source (H-9)');
        if (!hasMedia && (media.license !== null || media.source !== null)) err(w, 'licence ou source renseignée sans média');
        const files = [...media.images, ...(media.video ? [media.video] : [])];
        if (hasMedia) {
          // I6-07 (D-231 à D-233) : un média, licence de la liste blanche, source vérifiée, aucune adresse réseau.
          if (files.length > 1) err(w, 'un seul média par exercice');
          if (isStr(media.license) && !ALLOWED_MEDIA_LICENSES.includes(media.license)) err(w, `licence de média non autorisée : ${media.license}`);
          if ([media.license, media.source, ...files].some((v) => typeof v === 'string' && NETWORK.test(v))) err(w, 'adresse réseau interdite dans le média');
          const sourceId = isStr(media.source) ? media.source.split(':')[0] : '';
          const source = Object.hasOwn(MEDIA_SOURCES, sourceId) ? MEDIA_SOURCES[sourceId] : null;
          if (!source) err(w, `source de média inconnue : ${String(media.source)}`);
          else if (media.license !== source.license) err(w, `licence différente de la source ${sourceId} : ${String(media.license)}`);
          for (const f of files) {
            if (!isStr(f) || !MEDIA_EXTENSIONS.some((ext) => f.endsWith(ext)) || f.includes('/') || f.includes('\\')) err(w, `format de média non admis : ${String(f)}`);
            else mediaFiles.push({ where: w, file: f, exerciseId: x.id, source: media.source });
          }
        }
        if (hasMedia && opts.mediaDir) {
          for (const f of files) {
            if (!existsSync(join(opts.mediaDir, f))) err(w, `fichier média introuvable : ${f}`);
          }
        }
      }
    });
    if (opts.mediaDir) validateMediaFiles(mediaFiles, c.mediaRegistry, opts, err);

    // liens internes : alternatives
    for (const x of list) {
      if (!isObj(x) || !isStr(x.id)) continue;
      const w = `exercises.json (${x.id})`;
      if (!Array.isArray(x.alternatives) || x.alternatives.length !== 2 || !x.alternatives.every(isStr)) {
        err(w, 'alternatives : exactement 2 identifiants attendus');
        continue;
      }
      for (const a of x.alternatives) {
        if (a === x.id) err(w, 'alternative identique à l’exercice');
        else if (!exercisesById.has(a)) err(w, `alternative inconnue : ${a}`);
      }
    }
  }

  // --- profils de matériel ---
  const profilesById = new Map();
  const p = c.profiles;
  if (!isObj(p) || p.schemaVersion !== 1 || !Array.isArray(p.profiles) || !isStr(p.defaultProfileId)) {
    err('equipment-profiles/profiles.json', 'forme attendue { schemaVersion: 1, defaultProfileId, profiles: [] }');
  } else {
    p.profiles.forEach((pr, i) => {
      const w = `profiles.json[${i}]${isObj(pr) && typeof pr.id === 'string' ? ` (${pr.id})` : ''}`;
      if (!isObj(pr)) return err(w, 'objet attendu');
      if (!isStr(pr.id) || !KEBAB.test(pr.id)) err(w, 'champ manquant ou invalide : id');
      else if (profilesById.has(pr.id)) err(w, `identifiant dupliqué : ${pr.id}`);
      else profilesById.set(pr.id, pr);
      if (!isStr(pr.name)) err(w, 'champ manquant : name');
      if (!PROFILE_KINDS.includes(pr.kind)) err(w, `kind hors liste : ${String(pr.kind)}`);
      if (typeof pr.isPreset !== 'boolean') err(w, 'isPreset : booléen attendu');
      if (pr.schemaVersion !== 1) err(w, 'schemaVersion doit valoir 1');
      if (!isObj(pr.inventory)) err(w, 'inventory : objet attendu');
      if (!isObj(pr.increments) || !Object.values(pr.increments).every((v) => v === null || isNum(v))) err(w, 'increments : objet de nombres ou null attendu');
      for (const field of ['equipment', 'forced', 'forbidden']) {
        if (!Array.isArray(pr[field])) err(w, `${field} : tableau attendu`);
        else for (const e of pr[field]) if (!equipmentIds.has(e)) err(w, `matériel inconnu dans ${field} : ${String(e)}`);
      }
    });
    if (!profilesById.has(p.defaultProfileId)) err('equipment-profiles/profiles.json', `profil par défaut inconnu : ${p.defaultProfileId}`);
  }

  // --- programmes ---
  const programIds = new Set();
  if (expectedPrograms !== null && c.programs.length !== expectedPrograms) {
    err('programs/', `${expectedPrograms} programmes attendus, ${c.programs.length} trouvés`);
  }
  for (const { file, data: g } of c.programs) {
    const w = `programs/${file}`;
    if (!isObj(g)) { err(w, 'objet attendu'); continue; }
    if (!isStr(g.id) || !KEBAB.test(g.id)) err(w, 'champ manquant ou invalide : id');
    else if (programIds.has(g.id)) err(w, `identifiant de programme dupliqué : ${g.id}`);
    else programIds.add(g.id);
    if (g.schemaVersion !== 1) err(w, 'schemaVersion doit valoir 1');
    if (!isStr(g.name)) err(w, 'champ manquant : name');
    if (g.mode !== 'Programme') err(w, 'mode doit valoir "Programme"');
    if (!SPLITS.includes(g.split)) err(w, `split hors liste : ${String(g.split)}`);
    if (!isStr(g.audienceFr)) err(w, 'champ manquant : audienceFr');
    if (g.mesocycleWeeks !== 5) err(w, 'mesocycleWeeks doit valoir 5');

    // périodisation commune (D-20)
    const per = g.periodization;
    if (!Array.isArray(per) || per.length !== PERIODIZATION.length) err(w, 'periodization : 5 semaines attendues');
    else {
      PERIODIZATION.forEach((ref, k) => {
        const got = per[k];
        const same = isObj(got) && ['week', 'workingSets', 'rirMin', 'rirMax', 'loadFactor'].every((f) => got[f] === ref[f]) && isStr(got.note);
        if (!same) err(w, `periodization semaine ${ref.week} non conforme à D-20`);
      });
    }

    // profils compatibles
    const compat = Array.isArray(g.compatibleProfileIds) && g.compatibleProfileIds.length > 0 ? g.compatibleProfileIds : null;
    if (!compat) err(w, 'compatibleProfileIds : tableau non vide attendu');
    const profiles = (compat ?? []).map((id) => {
      const pr = profilesById.get(id);
      if (!pr) err(w, `profil de matériel inconnu : ${id}`);
      return pr;
    }).filter(Boolean);

    // jours
    if (!Array.isArray(g.days) || g.days.length === 0) { err(w, 'days : tableau non vide attendu'); continue; }
    g.days.forEach((d, di) => {
      const dw = `${w} jour ${di + 1}`;
      if (!isObj(d)) return err(dw, 'objet attendu');
      if (d.dayOrder !== di + 1) err(dw, `dayOrder attendu ${di + 1}`);
      if (!isStr(d.name)) err(dw, 'champ manquant : name');
      if (!(isInt(d.weekday) && d.weekday >= 1 && d.weekday <= 7)) err(dw, 'weekday : entier 1 à 7 attendu');
      if (!Array.isArray(d.exercises) || d.exercises.length === 0) return err(dw, 'exercises : tableau non vide attendu');
      const seenInDay = new Set();
      d.exercises.forEach((e, ei) => {
        const ew = `${dw} exercice ${ei + 1}`;
        if (!isObj(e)) return err(ew, 'objet attendu');
        if (e.position !== ei + 1) err(ew, `position attendue ${ei + 1}`);
        const ex = exercisesById.get(e.exerciseId);
        if (!ex) err(ew, `exercice inconnu : ${String(e.exerciseId)}`);
        else {
          if (seenInDay.has(e.exerciseId)) err(ew, `exercice répété dans le jour : ${e.exerciseId}`);
          seenInDay.add(e.exerciseId);
          for (const pr of profiles) {
            if (Array.isArray(ex.equipmentGroups) && Array.isArray(pr.equipment) && !isExerciseCompatible(ex, new Set(pr.equipment))) {
              err(ew, `${e.exerciseId} incompatible avec le profil ${pr.id}`);
            }
          }
        }
        if (!(isInt(e.sets) && e.sets >= 1 && e.sets <= 8)) err(ew, 'sets : entier 1 à 8 attendu');
        if (!(isInt(e.restSec) && e.restSec >= 0 && e.restSec <= 600)) err(ew, 'restSec : entier 0 à 600 attendu');
        if (e.rir !== null) err(ew, 'rir doit être null (porté par la périodisation)');
        if (ex && (ex.metric === 'time')) {
          if (!(isInt(e.durationSec) && e.durationSec > 0) || e.repMin !== null || e.repMax !== null) err(ew, 'exercice au temps : durationSec entier > 0 et repMin / repMax null attendus');
        } else if (ex && ex.metric === 'distance') {
          if (!(isInt(e.distanceM) && e.distanceM > 0) || e.repMin !== null || e.repMax !== null) err(ew, 'exercice à la distance : distanceM entier > 0 et repMin / repMax null attendus');
        } else if (ex) {
          if (!(isInt(e.repMin) && isInt(e.repMax) && e.repMin >= 1 && e.repMin <= e.repMax)) err(ew, 'repMin / repMax : entiers avec 1 <= repMin <= repMax attendus');
        }
      });
    });
  }

  return {
    errors,
    stats: {
      muscles: muscleIds.size,
      equipment: equipmentIds.size,
      exercises: exercisesById.size,
      programs: programIds.size,
      profiles: profilesById.size,
    },
  };
}

/**
 * Fichiers des médias (I6-07) : chaque fichier référencé est au registre de provenance (`media/sources.json` : exercice, source, chemin
 * d'origine, taille, SHA-256) et lui correspond octet pour octet ; plafond par fichier, budget du catalogue, aucun fichier orphelin, aucune
 * adresse réseau dans le registre.
 */
function validateMediaFiles(mediaFiles, registry, opts, err) {
  const dir = opts.mediaDir;
  const where = 'exercises/media';
  const maxTotal = opts.mediaTotalMaxBytes ?? MEDIA_TOTAL_MAX_BYTES;
  const present = existsSync(dir) ? readdirSync(dir).filter((f) => f !== 'sources.json') : [];
  if (mediaFiles.length === 0 && present.length === 0) return;
  const entries = isObj(registry) && registry.schemaVersion === 1 && Array.isArray(registry.files) ? registry.files : null;
  if (!entries) {
    err(`${where}/sources.json`, 'registre de provenance manquant ou mal formé { schemaVersion: 1, files: [] }');
    return;
  }
  if (NETWORK.test(JSON.stringify(registry))) err(`${where}/sources.json`, 'adresse réseau interdite dans le registre');
  const byFile = new Map(entries.filter(isObj).map((e) => [e.file, e]));
  const referenced = new Set();
  let total = 0;
  for (const m of mediaFiles) {
    referenced.add(m.file);
    const path = join(dir, m.file);
    if (!existsSync(path)) continue; // déjà signalé : fichier média introuvable
    const bytes = readFileSync(path);
    total += bytes.length;
    if (bytes.length > MEDIA_MAX_BYTES) err(m.where, `média trop lourd : ${m.file} (${bytes.length} octets > ${MEDIA_MAX_BYTES})`);
    const entry = byFile.get(m.file);
    if (!entry) {
      err(m.where, `absent du registre de provenance : ${m.file}`);
      continue;
    }
    if (entry.exerciseId !== m.exerciseId || `${entry.source}:${entry.originPath}` !== m.source) err(m.where, `registre incohérent (exercice ou source) : ${m.file}`);
    if (entry.bytes !== bytes.length || entry.sha256 !== createHash('sha256').update(bytes).digest('hex')) err(m.where, `empreinte ou taille différente du registre : ${m.file}`);
  }
  if (total > maxTotal) err(where, `budget total des médias dépassé : ${total} octets > ${maxTotal}`);
  for (const f of present) if (!referenced.has(f)) err(where, `média orphelin : ${f}`);
  for (const e of entries) if (isObj(e) && !referenced.has(e.file)) err(`${where}/sources.json`, `entrée sans média référencé : ${String(e.file)}`);
}

function readJson(path, errors) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${path} : lecture ou JSON invalide (${e instanceof Error ? e.message : String(e)})`);
    return null;
  }
}

/** Charge le dossier content/ et le valide. */
export function validateContentDir(dir, opts = {}) {
  const errors = [];
  const root = resolve(dir);
  const programsDir = join(root, 'programs');
  const programFiles = existsSync(programsDir) ? readdirSync(programsDir).filter((f) => f.endsWith('.json')).sort() : [];
  const content = {
    muscles: readJson(join(root, 'exercises', 'muscles.json'), errors),
    equipment: readJson(join(root, 'exercises', 'equipment.json'), errors),
    exercises: readJson(join(root, 'exercises', 'exercises.json'), errors),
    profiles: readJson(join(root, 'equipment-profiles', 'profiles.json'), errors),
    programs: programFiles.map((file) => ({ file, data: readJson(join(programsDir, file), errors) })),
    mediaRegistry: existsSync(join(root, 'exercises', 'media', 'sources.json')) ? readJson(join(root, 'exercises', 'media', 'sources.json'), errors) : null,
  };
  const result = validateContent(content, { mediaDir: join(root, 'exercises', 'media'), ...opts });
  return { errors: [...errors, ...result.errors], stats: result.stats };
}

function main() {
  const dir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
  const { errors, stats } = validateContentDir(dir);
  if (errors.length > 0) {
    for (const e of errors) console.log(`::error::${e}`);
    console.log(`validate-content : ${errors.length} erreur(s).`);
    process.exit(1);
  }
  console.log(`validate-content : OK (${stats.exercises} exercices, ${stats.programs} programmes, ${stats.muscles} muscles, ${stats.equipment} matériels, ${stats.profiles} profils).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
