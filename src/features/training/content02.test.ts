import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isExerciseCompatible, usableEquipment } from '../../domain/training';
import { loadTrainingContent } from './content';
import { normalizeSearch } from './trainingState';

/**
 * CONTENT-02 (0.9.2, D-83) : extension du catalogue d'exercices. Le catalogue garde les 150 exercices d'origine (identifiants stables : des
 * séances y sont liées) et en ajoute ; la recherche (nom français, alias, sans accent) et le filtre « Compatibles avec mon matériel » restent cohérents.
 */
const NEW_IDS = [
  'triceps-pushdown-supinated', 'triceps-pushdown-one-arm', 'triceps-kickback-cable', 'skull-crusher-dumbbell', 'overhead-triceps-extension-ez-bar',
  'overhead-triceps-extension-dumbbell-one-arm', 'dip-machine', 'curl-ez-bar', 'concentration-curl', 'spider-curl', 'curl-behind-body-cable', 'zottman-curl',
  'hammer-curl-preacher', 'bench-press-decline-barbell', 'bench-press-decline-dumbbell', 'bench-press-smith', 'incline-press-smith', 'fly-flat-dumbbell',
  'fly-incline-dumbbell', 'decline-chest-press-machine', 'row-barbell-supinated', 'lat-pulldown-one-arm', 'lat-pulldown-machine', 'seated-row-wide-grip',
  'pull-up-weighted', 'rack-pull', 'overhead-press-smith', 'overhead-press-seated-barbell', 'external-rotation-cable', 'y-raise-cable',
  'lateral-raise-dumbbell-one-arm', 'belt-squat', 'leg-extension-one-leg', 'lunge-smith', 'stiff-leg-deadlift', 'reverse-hyperextension',
  'hip-adduction-machine', 'hip-adduction-cable', 'copenhagen-plank', 'calf-raise-smith', 'crunch', 'decline-crunch', 'lying-leg-raise',
  'hanging-knee-raise', 'cable-woodchopper', 'russian-twist',
];
const ORIGINAL = JSON.parse(readFileSync('src/features/training/content02.originals.json', 'utf8')) as { ids: string[]; names: Record<string, string> };

const search = (list: readonly { nameFr: string; aliasesEn: readonly string[] }[], query: string) => {
  const q = normalizeSearch(query);
  return list.filter((e) => normalizeSearch(e.nameFr).includes(q) || e.aliasesEn.some((a) => normalizeSearch(a).includes(q)));
};

describe('CONTENT-02 : catalogue étendu', () => {
  it('au moins 150 exercices, tous les exercices d’origine présents avec leur identifiant et leur nom', async () => {
    const { catalog } = await loadTrainingContent();
    expect(catalog.list().length).toBeGreaterThanOrEqual(150 + NEW_IDS.length);
    for (const id of ORIGINAL.ids) expect(catalog.get(id)?.nameFr, id).toBe(ORIGINAL.names[id]);
  });

  it('chaque nouvel exercice de la liste d’Ali existe, sans doublon de nom', async () => {
    const { catalog } = await loadTrainingContent();
    for (const id of NEW_IDS) expect(catalog.has(id), id).toBe(true);
    const names = catalog.list().map((e) => normalizeSearch(e.nameFr));
    expect(new Set(names).size).toBe(names.length);
  });

  it('recherche : « supination », « triceps » et « ecarte » (sans accent) trouvent les bons exercices', async () => {
    const { catalog } = await loadTrainingContent();
    const list = catalog.list();
    expect(search(list, 'supination').map((e) => e.id)).toContain('triceps-pushdown-supinated');
    expect(search(list, 'triceps').map((e) => e.id)).toContain('triceps-pushdown-supinated');
    expect(search(list, 'ecarte').map((e) => e.id)).toEqual(expect.arrayContaining(['fly-flat-dumbbell', 'fly-incline-dumbbell', 'cable-fly']));
  });

  it('doublons devenus alias : T-bar et barre au front à la barre EZ retrouvent l’exercice existant', async () => {
    const { catalog } = await loadTrainingContent();
    expect(search(catalog.list(), 't-bar row').map((e) => e.id)).toContain('row-t-bar');
    expect(search(catalog.list(), 'ez bar skull crusher').map((e) => e.id)).toContain('skull-crusher');
  });

  it('compatibilité avec le profil Fitness Park Antony : un matériel absent du profil exclut l’exercice, sans modifier le profil', async () => {
    const content = await loadTrainingContent();
    const antony = content.profiles.find((p) => p.id === 'fitness-park-antony');
    if (antony === undefined) throw new Error('profil Antony absent');
    const available = usableEquipment(antony);
    const compatible = (id: string) => isExerciseCompatible(content.catalog.get(id) as never, antony);
    for (const id of ['triceps-pushdown-supinated', 'curl-ez-bar', 'bench-press-smith', 'rack-pull', 'crunch', 'pull-up-weighted']) expect(compatible(id), id).toBe(true);
    for (const id of ['bench-press-decline-barbell', 'dip-machine', 'belt-squat', 'hip-adduction-machine', 'lat-pulldown-machine']) expect(compatible(id), id).toBe(false);
    expect(available.has('decline-bench')).toBe(false);
  });
});
