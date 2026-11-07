import {
  createExerciseCatalog,
  emptyInventory,
  type EmbeddedExercise,
  type EquipmentIncrements,
  type EquipmentInventory,
  type EquipmentProfileInput,
  type EquipmentProfileKind,
  type ExerciseCatalog,
  type ExerciseKind,
  type ExerciseMetric,
  type ExercisePattern,
  type RoutineInput,
  type StackRange,
} from '../../domain/training';
import type { IdGenerator } from '../../domain/id';

/**
 * Contenu embarqué de l'entraînement (content/, I1-01) : 150 exercices, muscles, matériel, profils de matériel et programmes de départ. Chargé
 * par `import()` dynamique (jamais dans le JavaScript de départ, BUNDLE-01), une seule fois (promesse mise en cache), puis converti vers les
 * types du domaine. Le contenu est en lecture seule : un profil embarqué se duplique pour être modifié (`duplicateEmbeddedProfile`).
 */

export interface MuscleEntry {
  readonly id: string;
  readonly nameFr: string;
  readonly group: string;
}
export interface EquipmentEntry {
  readonly id: string;
  readonly nameFr: string;
  readonly family: string;
}

/** Profil embarqué : valeurs du domaine (filtrage, duplication) et détails d'affichage du JSON. */
export interface EmbeddedProfile {
  readonly origin: 'embedded';
  readonly id: string;
  readonly name: string;
  readonly kind: EquipmentProfileKind;
  readonly inventory: EquipmentInventory;
  readonly increments: EquipmentIncrements;
  /** Plage générale des machines à charge guidée (affichage), `null` si inconnue. */
  readonly machinesRange: StackRange | null;
}

export interface ProgramLine {
  readonly position: number;
  readonly exerciseId: string;
  readonly sets: number;
  readonly repMin: number | null;
  readonly repMax: number | null;
  readonly durationSec: number | null;
  readonly restSec: number;
  readonly rir: number | null;
}
export interface ProgramDay {
  readonly dayOrder: number;
  readonly name: string;
  readonly exercises: readonly ProgramLine[];
}
export interface StarterProgram {
  readonly id: string;
  readonly name: string;
  readonly audienceFr: string;
  readonly compatibleProfileIds: readonly string[];
  readonly days: readonly ProgramDay[];
}

export interface TrainingContent {
  readonly catalog: ExerciseCatalog;
  readonly muscles: readonly MuscleEntry[];
  readonly equipment: readonly EquipmentEntry[];
  readonly profiles: readonly EmbeddedProfile[];
  readonly defaultProfileId: string;
  readonly programs: readonly StarterProgram[];
  /** Groupe d'affichage (`chest`, `back`…) déduit d'un muscle, pour classer un exercice personnalisé. */
  readonly groupOfMuscle: ReadonlyMap<string, string>;
  /** Groupes d'affichage, dans l'ordre du catalogue. */
  readonly groups: readonly string[];
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Formes JSON (content/README.md)
// -----------------------------------------------------------------------------------------------------------------------------------

interface JsonExercise {
  readonly id: string;
  readonly nameFr: string;
  readonly group: string;
  readonly aliasesEn: readonly string[];
  readonly muscles: readonly { readonly id: string; readonly weight: number }[];
  readonly equipment: readonly string[];
  readonly equipmentGroups: readonly (readonly string[])[];
  readonly pattern: string;
  readonly kind: string;
  readonly metric: string;
  readonly bodyweightFraction: number | null;
  readonly defaultRepRange: readonly number[] | null;
  readonly defaultDurationSec: number | null;
  readonly defaultDistanceM: number | null;
  readonly defaultRestSec: number;
  readonly alternatives: readonly string[];
  readonly instructions: { readonly setup: string; readonly execution: string; readonly mistakes: readonly string[] };
  readonly media: { readonly images: readonly string[]; readonly video: string | null; readonly license: string | null; readonly source: string | null } | null;
  readonly strengthStandardKey: string | null;
  readonly schemaVersion: number;
}

interface JsonRange {
  readonly minKg: number | null;
  readonly maxKg: number | null;
  readonly stepKg: number | null;
  readonly toVerify?: boolean;
  readonly perMachineToVerify?: boolean;
  readonly extraPairsKg?: readonly number[];
}
interface JsonProfile {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly equipment: readonly string[];
  readonly inventory: {
    readonly barbells: readonly { readonly equipmentId: string; readonly label: string; readonly weightKg: number | null; readonly toVerify: boolean }[];
    readonly platesPerSideKg: readonly number[] | null;
    readonly dumbbells: JsonRange | null;
    readonly kettlebells: JsonRange | null;
    readonly machines: { readonly stackMinKg: number | null; readonly stackMaxKg: number | null; readonly stepKg: number | null; readonly perMachineToVerify?: boolean } | null;
    readonly cables: { readonly stackMinKg: number | null; readonly stackMaxKg: number | null; readonly stepKg: number | null; readonly perMachineToVerify?: boolean } | null;
    readonly bodyweight: boolean;
  };
  readonly increments: Readonly<Record<string, number | null>>;
  readonly forced: readonly string[];
  readonly forbidden: readonly string[];
}

const positive = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

function toRange(min: number | null, max: number | null, step: number | null): StackRange | null {
  return positive(min) && positive(max) && positive(step) && min <= max ? { minKg: min, maxKg: max, stepKg: step } : null;
}

export function toEmbeddedExercise(json: JsonExercise): EmbeddedExercise {
  // Exercice chronométré : plage en secondes ; exercice de distance : en mètres (aucune valeur inventée au-delà du JSON).
  const duration = json.defaultDurationSec ?? json.defaultDistanceM ?? 1;
  const [min, max] = json.defaultRepRange ?? [duration, duration];
  const media = json.media && (json.media.images.length > 0 || json.media.video !== null) && json.media.license !== null && json.media.source !== null ? { images: json.media.images, video: json.media.video, license: json.media.license, source: json.media.source } : null;
  return {
    origin: 'embedded',
    id: json.id,
    nameFr: json.nameFr,
    aliasesEn: json.aliasesEn,
    muscles: json.muscles.map((m) => ({ id: m.id, weight: m.weight })),
    equipment: json.equipment,
    equipmentGroups: json.equipmentGroups,
    alternatives: json.alternatives,
    group: json.group,
    pattern: json.pattern as ExercisePattern,
    kind: json.kind as ExerciseKind,
    metric: json.metric as ExerciseMetric,
    bodyweightFraction: json.bodyweightFraction,
    defaultRepRange: [min ?? duration, max ?? min ?? duration],
    defaultRestSec: json.defaultRestSec,
    instructions: json.instructions,
    media,
    strengthStandardKey: json.strengthStandardKey,
    schemaVersion: json.schemaVersion,
  };
}

/**
 * Profil embarqué vers le domaine. Ce que le JSON ne précise pas n'est pas inventé : le nombre de disques par masse est inconnu (1 par défaut,
 * marqué « plates » à vérifier), une plage de kettlebells sans pas ne donne que ses bornes, les machines sans plage par machine ne sont pas
 * déclarées une à une ; chaque valeur marquée `toVerify` dans le JSON l'est aussi dans `inventory.toVerify`.
 */
export function toEmbeddedProfile(json: JsonProfile): EmbeddedProfile {
  const inv = json.inventory;
  const toVerify: string[] = [];
  const barbells = inv.barbells.flatMap((b) => {
    if (b.toVerify || b.weightKg === null) toVerify.push(`barbell:${b.label}`);
    return positive(b.weightKg) ? [{ type: b.label, weightKg: b.weightKg, equipmentId: b.equipmentId }] : [];
  });
  const plates = (inv.platesPerSideKg ?? []).filter(positive).map((weightKg) => ({ weightKg, count: 1 }));
  if (plates.length > 0) toVerify.push('plates');
  const dumbbellRange = inv.dumbbells ? toRange(inv.dumbbells.minKg, inv.dumbbells.maxKg, inv.dumbbells.stepKg) : null;
  // Paires en plus de la plage (9 kg à Antony), ignorées avant la relecture de la PR #60 (M1).
  const extraPairs = (inv.dumbbells?.extraPairsKg ?? []).filter(positive);
  const dumbbells = dumbbellRange && extraPairs.length > 0 ? { ...dumbbellRange, extraKg: extraPairs } : dumbbellRange;
  if (inv.dumbbells?.toVerify === true) toVerify.push('dumbbells');
  let kettlebellsKg: number[] = [];
  if (inv.kettlebells) {
    const { minKg, maxKg, stepKg } = inv.kettlebells;
    if (positive(minKg) && positive(maxKg) && positive(stepKg)) for (let kg = minKg; kg <= maxKg && kettlebellsKg.length < 64; kg += stepKg) kettlebellsKg.push(kg);
    else kettlebellsKg = [minKg, maxKg].filter(positive);
    if (inv.kettlebells.toVerify === true || !positive(stepKg)) toVerify.push('kettlebells');
  }
  const cablesRange = inv.cables ? toRange(inv.cables.stackMinKg, inv.cables.stackMaxKg, inv.cables.stepKg) : null;
  if (inv.cables && (inv.cables.perMachineToVerify === true || cablesRange === null)) toVerify.push('cables');
  const machinesRange = inv.machines ? toRange(inv.machines.stackMinKg, inv.machines.stackMaxKg, inv.machines.stepKg) : null;
  if (inv.machines && (inv.machines.perMachineToVerify === true || machinesRange === null)) toVerify.push('machines');
  const increments: Record<string, number> = {};
  for (const [key, value] of Object.entries(json.increments)) if (positive(value)) increments[key] = value;
  return {
    origin: 'embedded',
    id: json.id,
    name: json.name,
    kind: json.kind as EquipmentProfileKind,
    inventory: {
      ...emptyInventory(),
      available: json.equipment,
      forced: json.forced,
      forbidden: json.forbidden,
      bodyweight: inv.bodyweight,
      barbells,
      platesPerSideKg: plates,
      dumbbells,
      kettlebellsKg,
      cables: cablesRange ? [cablesRange] : [],
      ...(toVerify.length > 0 ? { toVerify } : {}),
    },
    increments,
    machinesRange,
  };
}

/** Copie modifiable d'un profil embarqué (ligne `equipment_profile`) : nouvel UUID, nom suffixé, mêmes valeurs à vérifier. */
export function duplicateEmbeddedProfile(profile: EmbeddedProfile, ids: IdGenerator, name: string): EquipmentProfileInput {
  return { id: ids.next(), name, kind: profile.kind, inventory: profile.inventory, increments: profile.increments };
}

/**
 * Programme de départ vers une routine (§ 12.5) : identifiants neufs, nom d'exercice figé (D-71), plage en secondes pour un exercice chronométré
 * (`durationSec`, PRD § 14.1). Le programme chargé devient une routine ordinaire, modifiable.
 */
export function programToRoutine(program: StarterProgram, catalog: ExerciseCatalog, ids: IdGenerator): RoutineInput {
  return {
    id: ids.next(),
    name: program.name,
    mode: 'programme',
    days: program.days.map((day) => ({
      id: ids.next(),
      name: day.name,
      dayOrder: day.dayOrder,
      exercises: day.exercises.map((line) => {
        const min = line.repMin ?? line.durationSec ?? 1;
        return {
          id: ids.next(),
          exerciseId: line.exerciseId,
          exerciseName: catalog.get(line.exerciseId)?.nameFr ?? line.exerciseId,
          sets: line.sets,
          repMin: min,
          repMax: line.repMax ?? line.durationSec ?? min,
          rir: line.rir,
          restSec: line.restSec,
          position: line.position,
        };
      }),
    })),
  };
}

/** Programmes dans l'ordre d'affichage : Full Body, Haut / Bas, PPL, Maison haltères. */
async function load(): Promise<TrainingContent> {
  const [exercises, muscles, equipment, profiles, ...programs] = await Promise.all([
    import('../../../content/exercises/exercises.json'),
    import('../../../content/exercises/muscles.json'),
    import('../../../content/exercises/equipment.json'),
    import('../../../content/equipment-profiles/profiles.json'),
    import('../../../content/programs/full-body-3j.json'),
    import('../../../content/programs/haut-bas-4j.json'),
    import('../../../content/programs/ppl-6j.json'),
    import('../../../content/programs/maison-halteres-3j.json'),
  ]);
  const list = (exercises.default as unknown as { exercises: readonly JsonExercise[] }).exercises.map(toEmbeddedExercise);
  const catalog = createExerciseCatalog(list);
  const groups: string[] = [];
  const votes = new Map<string, Map<string, number>>();
  for (const exercise of list) {
    const group = exercise.group ?? '';
    if (!groups.includes(group)) groups.push(group);
    const first = exercise.muscles[0];
    if (!first) continue;
    const tally = votes.get(first.id) ?? new Map<string, number>();
    tally.set(group, (tally.get(group) ?? 0) + 1);
    votes.set(first.id, tally);
  }
  const groupOfMuscle = new Map<string, string>();
  for (const [muscle, tally] of votes) {
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1] || groups.indexOf(a[0]) - groups.indexOf(b[0]))[0];
    if (best) groupOfMuscle.set(muscle, best[0]);
  }
  const profileFile = profiles.default as unknown as { defaultProfileId: string; profiles: readonly JsonProfile[] };
  return {
    catalog,
    muscles: (muscles.default as unknown as { muscles: readonly MuscleEntry[] }).muscles,
    equipment: (equipment.default as unknown as { equipment: readonly EquipmentEntry[] }).equipment,
    profiles: profileFile.profiles.map(toEmbeddedProfile),
    defaultProfileId: profileFile.defaultProfileId,
    programs: programs.map((module) => module.default as unknown as StarterProgram),
    groupOfMuscle,
    groups,
  };
}

let cached: Promise<TrainingContent> | null = null;

/** Contenu embarqué, chargé à la première demande puis gardé en mémoire ; un échec de chargement n'est pas mis en cache. */
export function loadTrainingContent(): Promise<TrainingContent> {
  if (!cached) {
    cached = load();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
