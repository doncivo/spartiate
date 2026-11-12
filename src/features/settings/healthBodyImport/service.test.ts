import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualClock } from '../../../domain/clock';
import { renphoDayDraft } from '../../../domain/nutrition/renphoDay';
import { asEntityId, type DeviceId, type LocalDate, type LocalTime } from '../../../domain/types';
import { openBaseDb, type TestDb } from '../../../db/repositories/sql/testSetup';
import { BODY_FILE_NAMES, type BodyFileName } from '../../../domain/health/bodyShortcutFiles';
import { ShortcutFolderError, type ShortcutFileRead, type ShortcutFilesReader } from '../../../platform/shortcutFiles';
import { createHealthBodyImportService, BODY_IMPORT_LOG_EVENTS, type BodyImportDeps, type BodyImportLogEvent } from './service';

/** I6-04 : import des fichiers Renpho (poids, composition, mensurations, nutrition du jour) lus dans le dossier sante. Fixtures synthétiques. */
const DEVICE = asEntityId<DeviceId>('60000000-0000-4000-8000-0000000000a4');
const NOW = '2026-11-08T10:00:00.000Z';
const TZ = 'Europe/Paris';
const D8 = '2026-11-08' as LocalDate;
const D7 = '2026-11-07' as LocalDate;

const files = (texts: Partial<Record<BodyFileName, string>>): ShortcutFileRead[] =>
  BODY_FILE_NAMES.map((name) => {
    const text = texts[name];
    return (text === undefined ? { name, state: 'absent' } : { name, state: 'ok', text }) as unknown as ShortcutFileRead;
  });
const reader = (reads: () => Promise<readonly ShortcutFileRead[] | null>, over: Partial<ShortcutFilesReader> = {}) => ({ kind: 'folder' as const, automatic: true, read: vi.fn(reads), ...over }) as ShortcutFilesReader & { read: ReturnType<typeof vi.fn> };

describe('import Renpho via Santé et Raccourcis (I6-04)', () => {
  let db: TestDb;
  let logs: { event: BodyImportLogEvent; counts: Record<string, number> }[];
  let stored: unknown = null;

  beforeEach(async () => {
    db = await openBaseDb(DEVICE);
    logs = [];
    stored = null;
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.close();
  });

  const build = (r: ShortcutFilesReader, over: Partial<BodyImportDeps> = {}) =>
    createHealthBodyImportService({
      reader: r,
      transaction: (work) => db.data.transaction(async (repos) => work({ weights: await repos.bodyWeights(), measurements: await repos.measurements(), meals: await repos.mealEntries() })),
      clock: createManualClock(NOW),
      timeZone: TZ,
      log: (event, counts) => logs.push({ event, counts }),
      state: { get: async () => stored, set: async (value) => void (stored = value) },
      ...over,
    });
  const run = async (texts: Partial<Record<BodyFileName, string>>, over: Partial<BodyImportDeps> = {}) => build(reader(async () => files(texts)), over).run('manual');
  const meals = async () => (await db.data.repos.mealEntries()).listBetween('2026-11-01' as LocalDate, '2026-11-30' as LocalDate);

  it('poids : une pesée Santé par jour, la saisie manuelle du jour n’est jamais remplacée, réimport sans doublon', async () => {
    const weights = await db.data.repos.bodyWeights();
    await weights.saveManual({ date: D8, kg: 80, timezone: TZ }, D8);
    const text = '2026-11-08T06:50:12+01:00;81,4;kg\n2026-11-07T07:00:00+01:00;82;kg\n';
    const first = await run({ 'poids.csv': text });
    expect(first.status).toBe('done');
    expect(first.files.find((f) => f.name === 'poids.csv')).toMatchObject({ state: 'imported', added: 2, updated: 0, unchanged: 0, rejectedTotal: 0 });
    const second = await run({ 'poids.csv': text });
    expect(second.files.find((f) => f.name === 'poids.csv')).toMatchObject({ added: 0, updated: 0, unchanged: 2 });
    const rows = await weights.listRecent(10);
    expect(rows.map((r) => [r.date, r.kg, r.source])).toEqual([[D8, 81.4, 'health'], [D8, 80, 'manual'], [D7, 82, 'health']]);
  });

  it('masse grasse, masse maigre, tour de taille, taille : mesures `health_*` ; la zone manuelle « waist » est intacte ; une valeur corrigée met à jour la même ligne', async () => {
    const measures = await db.data.repos.measurements();
    await measures.save(D8, 'waist', 90);
    const texts = {
      'masse-grasse.csv': '2026-11-08T06:50:00+01:00;18,5;%\n',
      'masse-maigre.csv': '2026-11-08T06:50:00+01:00;64,3;kg\n',
      'tour-taille.csv': '2026-11-08T06:50:00+01:00;82;cm\n',
      'taille.csv': '2026-11-08T06:50:00+01:00;1,78;m\n',
    } as const;
    const first = await run(texts);
    expect(first.files.filter((f) => f.state === 'imported').map((f) => [f.name, f.added])).toEqual([['masse-grasse.csv', 1], ['masse-maigre.csv', 1], ['tour-taille.csv', 1], ['taille.csv', 1]]);
    expect((await measures.list('waist'))[0]?.value).toBe(90);
    expect((await measures.list('health_waist_cm'))[0]?.value).toBe(82);
    expect((await measures.list('health_height_cm'))[0]?.value).toBe(178);
    const again = await run({ ...texts, 'masse-grasse.csv': '2026-11-08T06:50:00+01:00;18,9;%\n' });
    expect(again.files.find((f) => f.name === 'masse-grasse.csv')).toMatchObject({ added: 0, updated: 1, unchanged: 0 });
    expect(again.files.find((f) => f.name === 'masse-maigre.csv')).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect((await measures.list('health_body_fat_pct')).map((m) => m.value)).toEqual([18.9]);
  });

  it('une mesure supprimée par Ali ne revient pas au réimport', async () => {
    const measures = await db.data.repos.measurements();
    const text = { 'masse-grasse.csv': '2026-11-08T06:50:00+01:00;18,5;%\n' };
    await run(text);
    await measures.remove(D8, 'health_body_fat_pct');
    const again = await run(text);
    expect(again.files.find((f) => f.name === 'masse-grasse.csv')).toMatchObject({ added: 0, updated: 0, skippedDeleted: 1 });
    expect(await measures.list('health_body_fat_pct')).toEqual([]);
  });

  const NUTRITION = {
    'energie.csv': '2026-11-08T08:00:00+01:00;800;kcal\n2026-11-08T13:00:00+01:00;1500;kcal\n',
    'proteines.csv': '2026-11-08T08:00:00+01:00;150;g\n',
    'glucides.csv': '2026-11-08T08:00:00+01:00;260;g\n',
    'lipides.csv': '2026-11-08T08:00:00+01:00;70;g\n',
    'fibres.csv': '2026-11-08T08:00:00+01:00;28;g\n',
  } as const;

  it('nutrition, journal vide : une entrée unique « Renpho — total du jour » avec les totaux ; fibres en mesure ; réimport : la même entrée, jamais de doublon', async () => {
    const first = await run(NUTRITION);
    expect(first.nutrition).toMatchObject({ created: 1, updated: 0, unchanged: 0, superseded: 0 });
    const [entry, ...rest] = await meals();
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({ date: D8, foodName: 'Renpho — total du jour', method: 'quickadd', source: 'manual', kcal: 2300, proteinG: 150, carbG: 260, fatG: 70 });
    expect((await (await db.data.repos.measurements()).list('health_fiber_g'))[0]?.value).toBe(28);
    const same = await run(NUTRITION);
    expect(same.nutrition).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    const changed = await run({ ...NUTRITION, 'energie.csv': '2026-11-08T08:00:00+01:00;800;kcal\n2026-11-08T13:00:00+01:00;1700;kcal\n' });
    expect(changed.nutrition).toMatchObject({ created: 0, updated: 1 });
    const all = await meals();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: entry?.id, kcal: 2500 });
  });

  it('nutrition, repas saisis par Ali ce jour-là : le journal fait foi, l’import n’écrit rien pour ce jour', async () => {
    const mealsRepo = await db.data.repos.mealEntries();
    await mealsRepo.create({ date: D8, time: '12:00' as LocalTime, foodId: null, foodName: 'Déjeuner', source: 'manual', grams: null, kcal: 700, proteinG: 40, fatG: 20, carbG: 80, method: 'quickadd', confidence: null });
    const result = await run(NUTRITION);
    expect(result.nutrition).toMatchObject({ created: 0, skippedJournal: 1 });
    expect((await meals()).map((e) => e.foodName)).toEqual(['Déjeuner']);
    expect(await (await db.data.repos.measurements()).list('health_fiber_g')).toEqual([]);
  });

  it('un repas saisi après l’import remplace l’entrée Renpho ; l’import suivant ne la recrée pas', async () => {
    await run(NUTRITION);
    const mealsRepo = await db.data.repos.mealEntries();
    await mealsRepo.create({ date: D8, time: '12:00' as LocalTime, foodId: null, foodName: 'Déjeuner', source: 'manual', grams: null, kcal: 700, proteinG: null, fatG: null, carbG: null, method: 'quickadd', confidence: null });
    expect((await meals()).map((e) => e.foodName)).toEqual(['Déjeuner']);
    const again = await run(NUTRITION);
    expect(again.nutrition).toMatchObject({ created: 0, skippedJournal: 1 });
    expect((await meals()).map((e) => e.foodName)).toEqual(['Déjeuner']);
  });

  it('rattrapage : entrée Renpho et repas coexistant (deux appareils) : l’import supprime l’entrée Renpho et les fibres', async () => {
    const mealsRepo = await db.data.repos.mealEntries();
    await mealsRepo.create({ date: D8, time: '12:00' as LocalTime, foodId: null, foodName: 'Déjeuner', source: 'manual', grams: null, kcal: 700, proteinG: null, fatG: null, carbG: null, method: 'quickadd', confidence: null });
    await mealsRepo.create(renphoDayDraft(D8, { kcal: 2300, proteinG: 150, fatG: 70, carbG: 260, fiberG: 28 }));
    await (await db.data.repos.measurements()).save(D8, 'health_fiber_g', 28);
    const result = await run(NUTRITION);
    expect(result.nutrition).toMatchObject({ superseded: 1 });
    expect((await meals()).map((e) => e.foodName)).toEqual(['Déjeuner']);
    expect(await (await db.data.repos.measurements()).list('health_fiber_g')).toEqual([]);
  });

  it('l’entrée Renpho supprimée par Ali ne revient pas ; macros sans énergie : rien d’écrit et compté', async () => {
    await run(NUTRITION);
    const mealsRepo = await db.data.repos.mealEntries();
    const [entry] = await meals();
    await mealsRepo.softDelete(entry?.id ?? '');
    expect((await run(NUTRITION)).nutrition).toMatchObject({ created: 0, skippedDeleted: 1 });
    const noEnergy = await run({ 'proteines.csv': NUTRITION['proteines.csv'] });
    expect(noEnergy.nutrition).toMatchObject({ created: 0, skippedNoEnergy: 1 });
  });

  it('valeurs hors bornes : rejetées, comptées, rien d’écrit', async () => {
    const result = await run({ 'poids.csv': '2026-11-08T06:50:12+01:00;19;kg\n', 'energie.csv': '2026-11-08T08:00:00+01:00;20000;kcal\n' });
    expect(result.files.find((f) => f.name === 'poids.csv')).toMatchObject({ added: 0, rejectedTotal: 1, rejected: { out_of_range: 1 } });
    expect(result.files.find((f) => f.name === 'energie.csv')).toMatchObject({ rejectedTotal: 1 });
    expect(await (await db.data.repos.bodyWeights()).listRecent(5)).toEqual([]);
    expect(await meals()).toEqual([]);
  });

  it('fichiers absents ou illisibles : états par fichier, rien d’écrit, jamais une erreur', async () => {
    const reads = files({}).map((r, i) => (i === 0 ? ({ name: r.name, state: 'unreadable' } as ShortcutFileRead) : r));
    const result = await build(reader(async () => reads)).run('manual');
    expect(result.status).toBe('done');
    expect(result.files[0]?.state).toBe('unreadable');
    expect(result.files.slice(1).every((f) => f.state === 'absent')).toBe(true);
    expect(await meals()).toEqual([]);
  });

  it('PC : « unsupported » sans lecture ; sélecteur annulé : « cancelled » ; dossier non lié : « folder-unavailable » ; à l’ouverture sans lecteur automatique : « needs-pick »', async () => {
    const pc = reader(async () => files({}), { kind: 'unsupported', automatic: false });
    expect((await build(pc).run('manual')).status).toBe('unsupported');
    expect(pc.read).not.toHaveBeenCalled();
    expect((await build(reader(async () => null, { automatic: false })).run('manual')).status).toBe('cancelled');
    expect((await build(reader(async () => { throw new ShortcutFolderError('not-configured'); })).run('manual')).status).toBe('folder-unavailable');
    expect((await build(reader(async () => files({}), { automatic: false })).run('open')).status).toBe('needs-pick');
  });

  it('à l’ouverture : au plus une lecture toutes les 30 minutes (en mémoire et d’après le dernier import gardé)', async () => {
    const r = reader(async () => files({}));
    const service = build(r);
    expect((await service.run('open')).status).toBe('done');
    expect((await service.run('open')).status).toBe('throttled');
    expect(r.read).toHaveBeenCalledTimes(1);
    const fresh = reader(async () => files({}));
    expect((await build(fresh).run('open')).status).toBe('throttled');
    expect(fresh.read).not.toHaveBeenCalled();
  });

  it('un échec d’écriture : « failed » pour le fichier, tout est annulé, les autres fichiers ne sont pas écrits à moitié', async () => {
    const failing = build(reader(async () => files({ 'poids.csv': '2026-11-08T06:50:12+01:00;81,4;kg\n', 'masse-grasse.csv': '2026-11-08T06:50:00+01:00;18,5;%\n' })), {
      transaction: async () => {
        throw new Error('boom');
      },
    });
    const result = await failing.run('manual');
    expect(result.status).toBe('failed');
    expect(await (await db.data.repos.bodyWeights()).listRecent(5)).toEqual([]);
  });

  it('journal technique : événements fixes et comptes entiers seulement, aucune valeur corporelle ; aucun appel réseau', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await run({ 'poids.csv': '2026-11-08T06:50:12+01:00;81,4;kg\n', ...NUTRITION });
    expect(logs.length).toBeGreaterThan(0);
    for (const { event, counts } of logs) {
      expect((BODY_IMPORT_LOG_EVENTS as readonly string[]).includes(event)).toBe(true);
      for (const value of Object.values(counts)) expect(Number.isInteger(value)).toBe(true);
    }
    expect(JSON.stringify(logs)).not.toMatch(/81|2300|18\.5/);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('le dernier import est gardé (comptes seulement, jamais une valeur) pour l’écran', async () => {
    await run({ 'poids.csv': '2026-11-08T06:50:12+01:00;81,4;kg\n' });
    expect(JSON.stringify(stored)).toContain('poids.csv');
    expect(JSON.stringify(stored)).not.toContain('81');
  });
});
