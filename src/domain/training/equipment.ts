import type { CustomExerciseSource, ExerciseCatalog } from './exerciseCatalog';
import { resolveExercise } from './exerciseResolution';
import { EQUIPMENT_PROFILE_KINDS, type EquipmentIncrements, type EquipmentInventory, type EquipmentProfileInput, type RoutineExerciseSpec, type StackRange } from './types';

/**
 * Profils de matériel (§ 14.3, critère 4 d'I1-01) : matériel utilisable, compatibilité d'un exercice, validation d'un profil.
 * Le profil ACTIF est une préférence locale de l'appareil (réglage), pas une donnée de ce module.
 */

export interface EquipmentIssue {
  readonly code: 'name-empty' | 'kind' | 'forced-forbidden' | 'dumbbells' | 'cables' | 'machines' | 'kettlebells' | 'barbells' | 'plates' | 'ids' | 'increment';
}

/** Identifiant de matériel : kebab-case minuscule (catalogue fermé `equipment.json`). */
export const EQUIPMENT_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 80;

export function emptyInventory(): EquipmentInventory {
  return { available: [], forced: [], forbidden: [], bodyweight: false, barbells: [], platesPerSideKg: [], dumbbells: null, kettlebellsKg: [], machines: [], cables: [] };
}

/**
 * Identifiants de matériel utilisables avec ce profil : disponibles, forcés, machines déclarées et `bodyweight` si le poids du corps est
 * autorisé, moins les identifiants interdits (l'interdit l'emporte sur le forcé).
 */
export function usableEquipment(profile: { readonly inventory: EquipmentInventory }): ReadonlySet<string> {
  const inv = profile.inventory;
  const usable = new Set<string>([...inv.available, ...inv.forced, ...inv.machines.map((m) => m.equipmentId)]);
  if (inv.bodyweight) usable.add('bodyweight');
  for (const id of inv.forbidden) usable.delete(id);
  return usable;
}

/** Matériel d'un exercice, avec ses groupes d'alternatives éventuels (exercice embarqué, content/README.md). */
export interface ExerciseEquipmentNeeds {
  readonly equipment: readonly string[];
  readonly equipmentGroups?: readonly (readonly string[])[];
}

/**
 * Un exercice est compatible si tout son matériel est utilisable (aucun matériel : toujours compatible). Avec des groupes d'alternatives
 * (exercice embarqué), il suffit d'un matériel utilisable par groupe ; le matériel facultatif, hors de tout groupe, n'est pas exigé.
 */
export function isExerciseCompatible(exercise: ExerciseEquipmentNeeds, profile: { readonly inventory: EquipmentInventory } | null): boolean {
  if (profile === null) return true;
  const usable = usableEquipment(profile);
  if (exercise.equipmentGroups !== undefined) return exercise.equipmentGroups.every((group) => group.some((id) => usable.has(id)));
  return exercise.equipment.every((id) => usable.has(id));
}

/** Exercices proposables avec ce profil, dans l'ordre reçu ; sans profil (`null`), aucun filtre. */
export function filterCompatibleExercises<T extends ExerciseEquipmentNeeds>(exercises: readonly T[], profile: { readonly inventory: EquipmentInventory } | null): T[] {
  return profile === null ? [...exercises] : exercises.filter((e) => isExerciseCompatible(e, profile));
}

/** Lignes de routine dont l'exercice, résolu, exige du matériel absent du profil. Une référence inconnue n'est jamais signalée. */
export function incompatibleRoutineLines<T extends Pick<RoutineExerciseSpec, 'exerciseId' | 'exerciseName'>>(
  lines: readonly T[],
  profile: { readonly inventory: EquipmentInventory } | null,
  catalog: ExerciseCatalog,
  customs: CustomExerciseSource,
): T[] {
  if (profile === null) return [];
  return lines.filter((line) => {
    const resolved = resolveExercise({ id: line.exerciseId, frozenName: line.exerciseName }, catalog, customs);
    return resolved.exercise !== null && !isExerciseCompatible(resolved.exercise, profile);
  });
}

const positive = (n: number): boolean => Number.isFinite(n) && n > 0;
const range = (r: StackRange): boolean => positive(r.minKg) && positive(r.maxKg) && positive(r.stepKg) && r.minKg <= r.maxKg;
const ids = (list: readonly string[]): boolean => list.every((id) => EQUIPMENT_ID_RE.test(id));

export function validateEquipmentProfile(input: Pick<EquipmentProfileInput, 'name' | 'kind' | 'inventory' | 'increments'>): EquipmentIssue[] {
  const issues: EquipmentIssue[] = [];
  const add = (code: EquipmentIssue['code']): void => void issues.push({ code });
  if (input.name.trim() === '' || input.name.length > MAX_NAME) add('name-empty');
  if (!(EQUIPMENT_PROFILE_KINDS as readonly string[]).includes(input.kind)) add('kind');
  const inv = input.inventory;
  if (!ids(inv.available) || !ids(inv.forced) || !ids(inv.forbidden)) add('ids');
  if (inv.forced.some((id) => inv.forbidden.includes(id))) add('forced-forbidden');
  if (inv.dumbbells !== null && !range(inv.dumbbells)) add('dumbbells');
  if (inv.cables.some((c) => !range(c))) add('cables');
  if (inv.machines.some((m) => !EQUIPMENT_ID_RE.test(m.equipmentId) || !range({ minKg: m.stackMinKg, maxKg: m.stackMaxKg, stepKg: m.stepKg }))) add('machines');
  if (inv.kettlebellsKg.some((k) => !positive(k))) add('kettlebells');
  if (inv.barbells.some((b) => b.type.trim() === '' || !positive(b.weightKg))) add('barbells');
  if (inv.platesPerSideKg.some((p) => !positive(p.weightKg) || !Number.isInteger(p.count) || p.count < 1)) add('plates');
  const increments: EquipmentIncrements = input.increments;
  if (Object.values(increments).some((v) => !positive(v))) add('increment');
  return issues;
}
