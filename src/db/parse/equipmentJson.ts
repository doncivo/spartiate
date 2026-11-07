import type { BarbellSpec, EquipmentIncrements, EquipmentInventory, MachineSpec, PlateSpec, StackRange } from '../../domain/training';

/**
 * Validation à la main des JSON d'un profil de matériel (ADR 0008). Valeur typée ou `null`. `parseInventory` complète les champs absents
 * (profil écrit par une version plus ancienne) et ignore les clés inconnues (version plus récente) ; un champ présent de mauvais type
 * est refusé.
 */

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_LIST = 64;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function idList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const out: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string' || !ID_RE.test(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function list<T>(value: unknown, item: (v: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const out: T[] = [];
  for (const v of value as unknown[]) {
    const parsed = item(v);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

const range = (v: unknown): StackRange | null => {
  if (!(isRecord(v) && positive(v['minKg']) && positive(v['maxKg']) && positive(v['stepKg']))) return null;
  const base = { minKg: v['minKg'], maxKg: v['maxKg'], stepKg: v['stepKg'] };
  // Charges isolées en plus de la plage (paire de 9 kg) : liste de nombres > 0, au plus 16 ; sinon ignorée (jamais un profil refusé).
  const extra = v['extraKg'];
  return Array.isArray(extra) && extra.length > 0 && extra.length <= 16 && extra.every(positive) ? { ...base, extraKg: extra as number[] } : base;
};
const barbell = (v: unknown): BarbellSpec | null => {
  if (!(isRecord(v) && typeof v['type'] === 'string' && v['type'].length <= 64 && positive(v['weightKg']))) return null;
  const equipmentId = v['equipmentId'];
  // I2-01 : matériel de la barre, facultatif (profil d'avant la 0.3.0) ; présent, il doit être un identifiant du catalogue.
  if (equipmentId === undefined) return { type: v['type'], weightKg: v['weightKg'] };
  return typeof equipmentId === 'string' && ID_RE.test(equipmentId) ? { type: v['type'], weightKg: v['weightKg'], equipmentId } : null;
};
const plate = (v: unknown): PlateSpec | null =>
  isRecord(v) && positive(v['weightKg']) && typeof v['count'] === 'number' && Number.isInteger(v['count']) && v['count'] >= 1 && v['count'] <= 100 ? { weightKg: v['weightKg'], count: v['count'] } : null;
const machine = (v: unknown): MachineSpec | null =>
  isRecord(v) && typeof v['equipmentId'] === 'string' && ID_RE.test(v['equipmentId']) && positive(v['stackMinKg']) && positive(v['stackMaxKg']) && positive(v['stepKg'])
    ? { equipmentId: v['equipmentId'], stackMinKg: v['stackMinKg'], stackMaxKg: v['stackMaxKg'], stepKg: v['stepKg'] }
    : null;

export function parseInventory(value: unknown): EquipmentInventory | null {
  if (!isRecord(value)) return null;
  const field = <T>(key: string, fallback: T, parse: (v: unknown) => T | null): T | null => (value[key] === undefined ? fallback : parse(value[key]));
  const available = field<string[]>('available', [], idList);
  const forced = field<string[]>('forced', [], idList);
  const forbidden = field<string[]>('forbidden', [], idList);
  const bodyweight = field<boolean>('bodyweight', false, (v) => (typeof v === 'boolean' ? v : null));
  const barbells = field<BarbellSpec[]>('barbells', [], (v) => list(v, barbell));
  const plates = field<PlateSpec[]>('platesPerSideKg', [], (v) => list(v, plate));
  const dumbbells = value['dumbbells'] === undefined || value['dumbbells'] === null ? null : range(value['dumbbells']);
  const kettlebells = field<number[]>('kettlebellsKg', [], (v) => list(v, (k) => (positive(k) ? k : null)));
  const machines = field<MachineSpec[]>('machines', [], (v) => list(v, machine));
  const cables = field<StackRange[]>('cables', [], (v) => list(v, range));
  // I1-01 (interface) : valeurs « à vérifier en salle » d'un profil embarqué dupliqué ; clés courtes, liste bornée.
  const toVerify = field<string[]>('toVerify', [], (v) => list(v, (k) => (typeof k === 'string' && k.length > 0 && k.length <= 80 ? k : null)));
  const dumbbellsBad = value['dumbbells'] !== undefined && value['dumbbells'] !== null && dumbbells === null;
  if (available === null || forced === null || forbidden === null || bodyweight === null || barbells === null || plates === null || dumbbellsBad || kettlebells === null || machines === null || cables === null || toVerify === null) return null;
  return { available, forced, forbidden, bodyweight, barbells, platesPerSideKg: plates, dumbbells, kettlebellsKg: kettlebells, machines, cables, ...(toVerify.length > 0 ? { toVerify } : {}) };
}

export function parseIncrements(value: unknown): EquipmentIncrements | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, v] of Object.entries(value)) {
    if (!ID_RE.test(key) || !positive(v)) return null;
    out[key] = v;
  }
  return out;
}
