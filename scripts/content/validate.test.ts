// Tests du validateur de contenu (I1-01). Chaque règle a un cas rouge sur un jeu minimal synthétique ;
// le contenu réel est vérifié par les derniers blocs (comptages, programmes, profils, médias sous licence vérifiée).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALLOWED_MEDIA_LICENSES, MEDIA_MAX_BYTES, MEDIA_SOURCES, MEDIA_TOTAL_MAX_BYTES, PERIODIZATION, isExerciseCompatible, validateContent, validateContentDir } from './validate-content.mjs';

const ROOT = resolve(__dirname, '..', '..');
const CONTENT = resolve(ROOT, 'content');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function exercise(id: string, over: Json = {}): Json {
  return {
    id,
    nameFr: `Exercice ${id}`,
    group: 'chest',
    aliasesEn: [id.replace(/-/g, ' ')],
    muscles: [
      { id: 'chest', weight: 1, role: 'primary' },
      { id: 'triceps', weight: 0.5, role: 'secondary' },
    ],
    equipment: ['barbell', 'flat-bench'],
    equipmentGroups: [['barbell'], ['flat-bench']],
    pattern: 'push-horizontal',
    kind: 'compound',
    metric: 'load-reps',
    unilateral: false,
    bodyweightFraction: null,
    defaultRepRange: [6, 10],
    defaultDurationSec: null,
    defaultDistanceM: null,
    defaultRestSec: 150,
    alternatives: ['ex-b', 'ex-a'],
    instructions: { setup: 'Installe-toi.', execution: 'Pousse.', mistakes: ['Un.', 'Deux.', 'Trois.'] },
    media: { images: [], video: null, license: null, source: null },
    strengthStandardKey: null,
    schemaVersion: 1,
    ...over,
  };
}

function bundle(): Json {
  const a = exercise('ex-a', { alternatives: ['ex-b', 'ex-c'] });
  const b = exercise('ex-b', { alternatives: ['ex-a', 'ex-c'] });
  const c = exercise('ex-c', {
    metric: 'time',
    pattern: 'core',
    kind: 'isolation',
    equipment: ['bodyweight'],
    equipmentGroups: [['bodyweight']],
    defaultRepRange: null,
    defaultDurationSec: 30,
    alternatives: ['ex-a', 'ex-b'],
    muscles: [{ id: 'chest', weight: 1, role: 'primary' }],
  });
  return {
    muscles: { schemaVersion: 1, muscles: [{ id: 'chest', nameFr: 'Pectoraux', group: 'Torse' }, { id: 'triceps', nameFr: 'Triceps', group: 'Bras' }] },
    equipment: {
      schemaVersion: 1,
      equipment: [
        { id: 'barbell', nameFr: 'Barre', family: 'barre' },
        { id: 'flat-bench', nameFr: 'Banc plat', family: 'banc' },
        { id: 'bodyweight', nameFr: 'Poids du corps', family: 'poids du corps' },
      ],
    },
    exercises: { schemaVersion: 1, exercises: [a, b, c] },
    profiles: {
      schemaVersion: 1,
      defaultProfileId: 'salle',
      profiles: [{ id: 'salle', name: 'Salle', kind: 'salle', isPreset: true, equipment: ['barbell', 'flat-bench', 'bodyweight'], inventory: {}, increments: { barbell: 2.5 }, forced: [], forbidden: [], schemaVersion: 1 }],
    },
    programs: [
      {
        file: 'p.json',
        data: {
          schemaVersion: 1,
          id: 'prog',
          name: 'Programme',
          mode: 'Programme',
          split: 'full-body',
          audienceFr: 'Test',
          compatibleProfileIds: ['salle'],
          mesocycleWeeks: 5,
          periodization: PERIODIZATION.map((p) => ({ ...p, note: 'n' })),
          days: [
            {
              dayOrder: 1,
              name: 'Jour',
              weekday: 1,
              exercises: [
                { position: 1, exerciseId: 'ex-a', sets: 3, repMin: 6, repMax: 10, durationSec: null, distanceM: null, restSec: 150, rir: null },
                { position: 2, exerciseId: 'ex-c', sets: 3, repMin: null, repMax: null, durationSec: 45, distanceM: null, restSec: 60, rir: null },
              ],
            },
          ],
        },
      },
    ],
  };
}

const OPTS = { expectedExercises: null, expectedPrograms: null } as const;
const run = (b: Json, opts: Json = OPTS) => validateContent(b as never, opts as never).errors;

describe('validateContent : jeu minimal', () => {
  it('accepte un jeu valide', () => {
    expect(run(bundle())).toEqual([]);
  });

  it('refuse un identifiant d’exercice dupliqué', () => {
    const b = bundle();
    b['exercises'].exercises.push(clone(b['exercises'].exercises[0]));
    expect(run(b).join('\n')).toMatch(/identifiant dupliqué : ex-a/);
  });

  it('refuse un identifiant qui n’est pas en kebab-case', () => {
    const b = bundle();
    b['exercises'].exercises[0].id = 'Ex_A';
    expect(run(b).join('\n')).toMatch(/id \(kebab-case\)/);
  });

  it('refuse un identifiant de muscle ou de matériel dupliqué', () => {
    const b = bundle();
    b['muscles'].muscles.push({ id: 'chest', nameFr: 'x', group: 'x' });
    b['equipment'].equipment.push({ id: 'barbell', nameFr: 'x', family: 'x' });
    const out = run(b).join('\n');
    expect(out).toMatch(/muscles.json.*dupliqué : chest/);
    expect(out).toMatch(/equipment.json.*dupliqué : barbell/);
  });

  it('refuse un champ manquant', () => {
    const b = bundle();
    delete b['exercises'].exercises[0].nameFr;
    delete b['exercises'].exercises[0].instructions.setup;
    const out = run(b).join('\n');
    expect(out).toMatch(/champ manquant : nameFr/);
    expect(out).toMatch(/instructions.setup vide/);
  });

  it('refuse des instructions vides ou un nombre d’erreurs courantes différent de 3', () => {
    const b = bundle();
    b['exercises'].exercises[0].instructions.mistakes = ['a', 'b'];
    b['exercises'].exercises[1].instructions.execution = '  ';
    const out = run(b).join('\n');
    expect(out).toMatch(/mistakes : exactement 3/);
    expect(out).toMatch(/instructions.execution vide/);
  });

  it('refuse une valeur hors liste (pattern, kind, metric, groupe)', () => {
    const b = bundle();
    Object.assign(b['exercises'].exercises[0], { pattern: 'push', kind: 'x', metric: 'reps', group: 'cou' });
    const out = run(b).join('\n');
    expect(out).toMatch(/pattern hors liste/);
    expect(out).toMatch(/kind hors liste/);
    expect(out).toMatch(/metric hors liste/);
    expect(out).toMatch(/group hors liste/);
  });

  it('refuse un muscle ou un matériel inconnu', () => {
    const b = bundle();
    b['exercises'].exercises[0].muscles.push({ id: 'cou', weight: 0.3, role: 'secondary' });
    b['exercises'].exercises[0].equipment.push('machine-fantome');
    const out = run(b).join('\n');
    expect(out).toMatch(/muscle inconnu : cou/);
    expect(out).toMatch(/matériel inconnu : machine-fantome/);
  });

  it('refuse un groupe d’alternatives de matériel hors de equipment', () => {
    const b = bundle();
    b['exercises'].exercises[0].equipmentGroups = [['barbell'], ['bodyweight']];
    expect(run(b).join('\n')).toMatch(/equipmentGroups : bodyweight absent/);
  });

  it('refuse une somme des poids des muscles principaux < 1', () => {
    const b = bundle();
    b['exercises'].exercises[0].muscles[0].weight = 0.8;
    expect(run(b).join('\n')).toMatch(/somme des poids des muscles principaux < 1/);
  });

  it('refuse une plage de répétitions incohérente ou une durée manquante', () => {
    const b = bundle();
    b['exercises'].exercises[0].defaultRepRange = [10, 6];
    b['exercises'].exercises[2].defaultDurationSec = null;
    const out = run(b).join('\n');
    expect(out).toMatch(/defaultRepRange/);
    expect(out).toMatch(/defaultDurationSec : entier > 0/);
  });

  it('refuse une alternative inconnue ou identique', () => {
    const b = bundle();
    b['exercises'].exercises[0].alternatives = ['ex-a', 'ex-zzz'];
    const out = run(b).join('\n');
    expect(out).toMatch(/alternative identique/);
    expect(out).toMatch(/alternative inconnue : ex-zzz/);
  });

  it('refuse un média sans licence ni source (H-9)', () => {
    const b = bundle();
    b['exercises'].exercises[0].media = { images: ['ex-a-1.jpg'], video: null, license: null, source: null };
    expect(run(b, { ...OPTS, mediaDir: null }).join('\n')).toMatch(/média sans licence ou sans source/);
  });

  it('accepte un média avec licence et source, puis refuse un fichier absent', () => {
    const b = bundle();
    b['exercises'].exercises[0].media = { images: ['ex-a-1.jpg'], video: null, license: 'CC-BY-SA-4.0', source: 'everkinetic:dist/png/0001-tension.png' };
    expect(run(b, { ...OPTS, mediaDir: null })).toEqual([]);
    expect(run(b, { ...OPTS, mediaDir: resolve(ROOT, 'tests', 'fixtures', 'content', 'absent') }).join('\n')).toMatch(/fichier média introuvable/);
  });

  it('refuse une licence sans média', () => {
    const b = bundle();
    b['exercises'].exercises[0].media.license = 'CC0';
    expect(run(b).join('\n')).toMatch(/licence ou source renseignée sans média/);
  });

  it('refuse un programme qui référence un exercice absent', () => {
    const b = bundle();
    b['programs'][0].data.days[0].exercises[0].exerciseId = 'ex-zzz';
    expect(run(b).join('\n')).toMatch(/exercice inconnu : ex-zzz/);
  });

  it('refuse un programme dont la périodisation s’écarte de D-20', () => {
    const b = bundle();
    b['programs'][0].data.periodization[3].workingSets = 5;
    expect(run(b).join('\n')).toMatch(/periodization semaine 4 non conforme/);
  });

  it('refuse un programme incompatible avec le matériel du profil', () => {
    const b = bundle();
    b['profiles'].profiles[0].equipment = ['bodyweight'];
    expect(run(b).join('\n')).toMatch(/ex-a incompatible avec le profil salle/);
  });

  it('refuse un programme qui référence un profil inconnu ou un volume mal formé', () => {
    const b = bundle();
    b['programs'][0].data.compatibleProfileIds = ['ailleurs'];
    b['programs'][0].data.days[0].exercises[0].repMax = 3;
    b['programs'][0].data.days[0].exercises[1].durationSec = null;
    const out = run(b).join('\n');
    expect(out).toMatch(/profil de matériel inconnu : ailleurs/);
    expect(out).toMatch(/repMin \/ repMax/);
    expect(out).toMatch(/exercice au temps/);
  });

  it('refuse un profil de matériel avec un matériel hors liste ou un profil par défaut inconnu', () => {
    const b = bundle();
    b['profiles'].profiles[0].equipment.push('fantome');
    b['profiles'].defaultProfileId = 'autre';
    const out = run(b).join('\n');
    expect(out).toMatch(/matériel inconnu dans equipment : fantome/);
    expect(out).toMatch(/profil par défaut inconnu/);
  });

  it('applique les comptages attendus par défaut (150 exercices, 4 programmes)', () => {
    const out = run(bundle(), {}).join('\n');
    expect(out).toMatch(/au moins 150 exercices attendus, 3 trouvés/);
    expect(out).toMatch(/4 programmes attendus, 1 trouvés/);
  });

  it('isExerciseCompatible respecte les alternatives « ou »', () => {
    const ex = { equipmentGroups: [['barbell', 'dumbbell'], ['bench']] };
    expect(isExerciseCompatible(ex, new Set(['dumbbell', 'bench']))).toBe(true);
    expect(isExerciseCompatible(ex, new Set(['dumbbell']))).toBe(false);
  });
});

// --- Médias (I6-07, D-231 à D-233) : une règle, un cas rouge ---
describe('validateContent : médias d’exercice (I6-07)', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const dirs: string[] = [];
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  /** Jeu minimal avec un média sur ex-a, son dossier et son registre de provenance cohérents. */
  function withMedia(file = 'ex-a.png', bytes: Buffer = PNG): { b: Json; dir: string; registry: Json } {
    const b = bundle();
    b['exercises'].exercises[0].media = { images: [file], video: null, license: 'CC-BY-SA-4.0', source: 'everkinetic:dist/png/0001-tension.png' };
    const dir = mkdtempSync(join(tmpdir(), 'spartiate-media-'));
    dirs.push(dir);
    writeFileSync(join(dir, file), bytes);
    const registry = { schemaVersion: 1, files: [{ file, exerciseId: 'ex-a', source: 'everkinetic', originPath: 'dist/png/0001-tension.png', bytes: bytes.length, sha256: sha(bytes) }] };
    return { b: { ...b, mediaRegistry: registry }, dir, registry };
  }
  const runMedia = (b: Json, dir: string, extra: Json = {}) => run(b, { ...OPTS, mediaDir: dir, ...extra }).join('\n');

  it('accepte un média cohérent (fichier, registre, licence de la liste blanche, source connue)', () => {
    const { b, dir } = withMedia();
    expect(runMedia(b, dir)).toBe('');
    expect(ALLOWED_MEDIA_LICENSES).toEqual(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'PDM']);
    expect(MEDIA_SOURCES['everkinetic']).toMatchObject({ license: 'CC-BY-SA-4.0', commit: '446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6' });
  });

  it('refuse une licence NC, ND ou hors liste blanche', () => {
    for (const license of ['CC-BY-NC-4.0', 'CC-BY-ND-4.0', 'tous droits réservés']) {
      const { b, dir } = withMedia();
      b['exercises'].exercises[0].media.license = license;
      expect(runMedia(b, dir)).toMatch(/licence de média non autorisée/);
    }
  });

  it('refuse une source inconnue ou une licence différente de celle de la source', () => {
    const { b, dir } = withMedia();
    b['exercises'].exercises[0].media.source = 'inconnue:x.png';
    expect(runMedia(b, dir)).toMatch(/source de média inconnue/);
    const other = withMedia();
    other.b['exercises'].exercises[0].media.license = 'CC0-1.0';
    expect(runMedia(other.b, other.dir)).toMatch(/licence différente de la source/);
  });

  it('refuse plus d’un média par exercice', () => {
    const { b, dir } = withMedia();
    b['exercises'].exercises[0].media.images = ['ex-a.png', 'ex-a-2.png'];
    expect(runMedia(b, dir)).toMatch(/un seul média par exercice/);
    const video = withMedia();
    video.b['exercises'].exercises[0].media.video = 'ex-a.mp4';
    expect(runMedia(video.b, video.dir)).toMatch(/un seul média par exercice/);
  });

  it('refuse un format non admis', () => {
    const { b, dir } = withMedia('ex-a.svg');
    expect(runMedia(b, dir)).toMatch(/format de média non admis : ex-a\.svg/);
  });

  it('refuse une adresse réseau dans le contenu média ou le registre', () => {
    const { b, dir } = withMedia();
    b['exercises'].exercises[0].media.source = 'everkinetic:https://exemple.test/x.png';
    expect(runMedia(b, dir)).toMatch(/adresse réseau interdite/);
    const reg = withMedia();
    reg.registry['files'][0].originPath = 'http://exemple.test/x.png';
    expect(runMedia(reg.b, reg.dir)).toMatch(/adresse réseau interdite/);
  });

  it('refuse un fichier au-delà de 153 600 octets', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MEDIA_MAX_BYTES)]);
    const { b, dir } = withMedia('ex-a.png', big);
    expect(runMedia(b, dir)).toMatch(/média trop lourd : ex-a\.png/);
  });

  it('refuse un total au-delà du budget du catalogue', () => {
    const { b, dir } = withMedia();
    expect(runMedia(b, dir, { mediaTotalMaxBytes: PNG.length - 1 })).toMatch(/budget total des médias dépassé/);
  });

  it('refuse un fichier absent du registre, une empreinte ou une taille qui ne correspond pas', () => {
    const { b, dir } = withMedia();
    b['mediaRegistry'] = { schemaVersion: 1, files: [] };
    expect(runMedia(b, dir)).toMatch(/absent du registre de provenance : ex-a\.png/);
    const tampered = withMedia();
    writeFileSync(join(tampered.dir, 'ex-a.png'), Buffer.concat([PNG, Buffer.from([9])]));
    expect(runMedia(tampered.b, tampered.dir)).toMatch(/empreinte ou taille différente du registre : ex-a\.png/);
  });

  it('refuse un fichier orphelin dans le dossier des médias', () => {
    const { b, dir } = withMedia();
    writeFileSync(join(dir, 'oublie.png'), PNG);
    expect(runMedia(b, dir)).toMatch(/média orphelin : oublie\.png/);
  });
});

// --- Contenu réel ---
const real = validateContentDir(CONTENT);
const load = (...p: string[]) => JSON.parse(readFileSync(resolve(CONTENT, ...p), 'utf8')) as Json;

describe('contenu embarqué réel', () => {
  it('passe la validation sans aucune erreur', () => {
    expect(real.errors).toEqual([]);
  });

  it('compte au moins 150 exercices (extension CONTENT-02, D-83) et 4 programmes', () => {
    expect(real.stats['exercises']).toBeGreaterThanOrEqual(150);
    expect(real.stats).toMatchObject({ programs: 4, profiles: 3 });
  });

  // I6-07 (D-237) : remplace « n'embarque aucun média » ; D-71 (4) reste respectée : licence vérifiée, sinon aucun média.
  it('I6-07 : tout média a une licence de la liste blanche, une source connue, une entrée au registre ; budgets tenus', () => {
    const { exercises } = load('exercises', 'exercises.json');
    const registry = load('exercises', 'media', 'sources.json');
    const map = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'content', 'media-map.json'), 'utf8')) as Json;
    const withMedia = (exercises as Json[]).filter((x) => x['media'].images.length > 0);
    expect(withMedia.length).toBe(map['entries'].length);
    expect(withMedia.length).toBe(87);
    let total = 0;
    for (const x of withMedia) {
      expect(ALLOWED_MEDIA_LICENSES, x['id']).toContain(x['media'].license);
      expect(x['media'].video).toBeNull();
      expect(x['media'].images).toEqual([`${String(x['id'])}.png`]);
      const entry = (registry['files'] as Json[]).find((f) => f['file'] === x['media'].images[0]);
      expect(entry, x['id']).toBeDefined();
      const size = statSync(resolve(CONTENT, 'exercises', 'media', String(x['media'].images[0]))).size;
      expect(size).toBeLessThanOrEqual(MEDIA_MAX_BYTES);
      total += size;
    }
    expect(total).toBeLessThanOrEqual(MEDIA_TOTAL_MAX_BYTES);
    expect(MEDIA_MAX_BYTES).toBe(153_600);
    expect(MEDIA_TOTAL_MAX_BYTES).toBe(8_388_608);
    // Les exercices écartés restent sans média (repli propre).
    for (const skipped of map['excluded'] as Json[]) expect((exercises as Json[]).find((x) => x['id'] === skipped['id'])?.['media'].images).toEqual([]);
  });

  it('conserve les 26 identifiants du programme Haut / Bas 4 j avec séries, plages et repos du PRD § 12.5', () => {
    const prog = load('programs', 'haut-bas-4j.json');
    const flat = prog.days.flatMap((d: Json) => d.exercises.map((e: Json) => [d.name, e.exerciseId, e.sets, e.repMin, e.repMax, e.durationSec, e.restSec]));
    expect(flat).toEqual([
      ['Haut A', 'bench-press-barbell', 3, 6, 10, null, 150],
      ['Haut A', 'row-barbell', 3, 6, 10, null, 150],
      ['Haut A', 'incline-press-dumbbell', 3, 8, 12, null, 120],
      ['Haut A', 'lat-pulldown', 3, 8, 12, null, 120],
      ['Haut A', 'lateral-raise-dumbbell', 3, 12, 15, null, 60],
      ['Haut A', 'curl-barbell', 2, 8, 12, null, 60],
      ['Haut A', 'triceps-pushdown-cable', 2, 8, 12, null, 60],
      ['Bas A', 'squat-barbell', 3, 5, 8, null, 180],
      ['Bas A', 'romanian-deadlift-barbell', 3, 6, 10, null, 150],
      ['Bas A', 'leg-press', 3, 8, 12, null, 120],
      ['Bas A', 'leg-curl-machine', 3, 10, 15, null, 90],
      ['Bas A', 'calf-raise-standing', 3, 10, 15, null, 60],
      ['Bas A', 'plank', 3, null, null, 45, 60],
      ['Haut B', 'overhead-press-barbell', 3, 6, 10, null, 150],
      ['Haut B', 'pull-up', 3, 6, 10, null, 150],
      ['Haut B', 'bench-press-dumbbell', 3, 8, 12, null, 120],
      ['Haut B', 'row-dumbbell-one-arm', 3, 8, 12, null, 90],
      ['Haut B', 'cable-fly', 2, 12, 15, null, 60],
      ['Haut B', 'curl-incline-dumbbell', 2, 10, 15, null, 60],
      ['Haut B', 'dips', 2, 8, 12, null, 90],
      ['Bas B', 'deadlift-barbell', 3, 4, 6, null, 180],
      ['Bas B', 'split-squat-bulgarian', 3, 8, 12, null, 120],
      ['Bas B', 'hip-thrust-barbell', 3, 8, 12, null, 120],
      ['Bas B', 'leg-extension-machine', 3, 12, 15, null, 90],
      ['Bas B', 'calf-raise-seated', 3, 12, 15, null, 60],
      ['Bas B', 'hanging-leg-raise', 3, 10, 15, null, 60],
    ]);
    expect(prog.days.map((d: Json) => [d.name, d.weekday])).toEqual([['Haut A', 1], ['Bas A', 2], ['Haut B', 4], ['Bas B', 5]]);
  });

  it('livre Full Body 3 j, PPL 6 j et Maison haltères 3 j avec le bon nombre de jours', () => {
    expect(load('programs', 'full-body-3j.json').days).toHaveLength(3);
    expect(load('programs', 'ppl-6j.json').days).toHaveLength(6);
    expect(load('programs', 'maison-halteres-3j.json').days).toHaveLength(3);
  });

  it('limite « Maison haltères » à haltères, banc, élastiques (et poids du corps)', () => {
    const profiles = load('equipment-profiles', 'profiles.json').profiles as Json[];
    const maison = profiles.find((p) => p.id === 'maison-halteres') as Json;
    const allowed = new Set(['dumbbell', 'bench', 'flat-bench', 'incline-bench', 'resistance-band', 'bodyweight', 'floor', 'wall']);
    for (const id of maison.equipment) expect(allowed.has(id)).toBe(true);
    const prog = load('programs', 'maison-halteres-3j.json');
    expect(prog.compatibleProfileIds).toEqual(['maison-halteres']);
    const lib = new Map((load('exercises', 'exercises.json').exercises as Json[]).map((x) => [x.id, x]));
    for (const d of prog.days) for (const e of d.exercises) for (const g of (lib.get(e.exerciseId) as Json).equipmentGroups as string[][]) expect(g.some((id) => allowed.has(id))).toBe(true);
  });

  it('FIX-0173 (D-142) : un seul profil de salle, générique, « Salle complète », par défaut ; identifiant technique conservé ; plus aucun profil par salle', () => {
    const p = load('equipment-profiles', 'profiles.json');
    expect(p.defaultProfileId).toBe('fitness-park-antony');
    expect(p.profiles.map((x: Json) => [x.id, x.name, x.kind, x.isPreset])).toEqual([
      ['fitness-park-antony', 'Salle complète', 'salle', false],
      ['maison-halteres', 'Maison haltères', 'maison', true],
      ['poids-de-corps', 'Poids de corps', 'voyage', true],
    ]);
    expect(p.profiles.filter((x: Json) => x.kind === 'salle')).toHaveLength(1);
    expect(JSON.stringify(p)).not.toMatch(/Fitness Park|Antony/);
    for (const name of ['full-body-3j.json', 'haut-bas-4j.json', 'ppl-6j.json']) expect(load('programs', name).compatibleProfileIds, name).toEqual(['fitness-park-antony']);
  });

  it('FIX-0173 (D-142) : tout exercice faisable avec l’ancien « Fitness Park Antony » ou l’ancien « Salle commerciale » reste faisable avec « Salle complète » ; lest et point d’ancrage gardés', () => {
    const before = JSON.parse(readFileSync(resolve(ROOT, 'tests', 'fixtures', 'training', 'salles-avant-fix-0173.json'), 'utf8')) as { profiles: { id: string; equipment: string[] }[] };
    expect(before.profiles.map((p) => p.id)).toEqual(['fitness-park-antony', 'salle-commerciale']);
    const salle = new Set(((load('equipment-profiles', 'profiles.json').profiles as Json[])[0] as Json).equipment as string[]);
    const feasible = (set: ReadonlySet<string>, e: Json): boolean => (e.equipmentGroups as string[][]).every((g) => g.some((id) => set.has(id)));
    const exercises = load('exercises', 'exercises.json').exercises as Json[];
    const lost = exercises.filter((e) => before.profiles.some((p) => feasible(new Set(p.equipment), e)) && !feasible(salle, e)).map((e) => e.id as string);
    expect(lost).toEqual([]);
    expect(salle.has('loading-belt')).toBe(true);
    expect(salle.has('anchor-point')).toBe(true);
  });

  it('FIX-0173 (D-142) : « Salle complète » a tout le matériel d’une grande salle (ancienne salle et préréglage commercial réunis), haltères 2 à 58 kg, kettlebells 4 à 20 kg', () => {
    const salle = (load('equipment-profiles', 'profiles.json').profiles as Json[])[0] as Json;
    const equipment = new Set(salle.equipment as string[]);
    const bigGym = [
      'barbell', 'ez-bar', 'trap-bar', 'smith-machine', 'rack', 'pull-up-bar', 'parallel-bars', 'weight-plate', 'dumbbell', 'kettlebell',
      'machine', 'seated-machine', 'chest-press-machine', 'incline-chest-press-machine', 'shoulder-press-machine', 'chest-supported-row-machine', 'pec-deck', 'reverse-pec-deck',
      'hack-squat-machine', 'pendulum-squat-machine', 'leg-press-machine', 'leg-extension-machine', 'leg-curl-machine', 'hip-thrust-machine', 'hip-abduction-machine',
      'low-pulley', 'high-pulley', 'cable-machine', 'cable-handle', 'rope-attachment', 'straight-bar-attachment', 'ankle-strap',
      'bench', 'flat-bench', 'incline-bench', 'preacher-bench', 'back-extension-bench', 'landmine-attachment', 'resistance-band', 'plyo-box', 'ab-wheel', 'mat', 'bodyweight',
    ];
    for (const id of bigGym) expect(equipment.has(id), id).toBe(true);
    expect(salle.inventory.dumbbells).toMatchObject({ minKg: 2, maxKg: 58, stepKg: 2, extraPairsKg: [] });
    expect(salle.inventory.kettlebells).toMatchObject({ minKg: 4, maxKg: 20 });
    // Une copie de ce profil doit rester lisible par un appareil resté à la version précédente (MAX_LIST = 64 dans src/db/parse/equipmentJson.ts).
    expect((salle.equipment as string[]).length).toBeLessThanOrEqual(64);
  });
});

describe('CLI validate-content.mjs', () => {
  it('sort avec le code 0 sur le contenu réel', () => {
    const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'content', 'validate-content.mjs'), CONTENT], { encoding: 'utf8' });
    expect(r.stdout).toMatch(/OK \((\d+) exercices, 4 programmes/);
    expect(r.status).toBe(0);
  });

  it('sort avec le code 1 et des lignes ::error:: sur un dossier sans contenu', () => {
    const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts', 'content', 'validate-content.mjs'), resolve(ROOT, 'tests', 'fixtures', 'content', 'vide')], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^::error::/m);
  });
});
