import { afterEach, describe, expect, it } from 'vitest';
import { MEASUREMENT_BOUNDS_CM, PHOTO_MAX_BYTES } from '../../../domain/bodyProgress/measurements';
import type { DeviceId, LocalDate } from '../../../domain/types';
import { openBaseDb, type TestDb } from './testSetup';

/**
 * I6-02 (§ 17.1, § 20.2) : `MeasurementRepository` (table `measurement`, une mesure par date et genre, identifiant naturel) et `ProgressPhotoRepository`
 * (fiche publiée `progress_photo` + fichier LOCAL `progress_photo_file`). Fixtures synthétiques ; aucune photo réelle.
 */
const DEVICE = '60000000-0000-4000-8000-0000000000fb' as DeviceId;
const D = (day: number): LocalDate => `2026-11-${String(day).padStart(2, '0')}` as LocalDate;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 0xff, 0xd9]);
let db: TestDb;
afterEach(async () => db.close());
const measures = async () => db.data.repos.measurements();
const photos = async () => db.data.repos.progressPhotos();
const outbox = (table: string) => db.driver.select<{ row_id: string; field: string }>('SELECT row_id, field FROM sync_outbox WHERE table_name = ? ORDER BY seq', [table]);

describe('MeasurementRepository', () => {
  it('save : une ligne `measurement|date|kind`, relue telle quelle, mise en file en ligne entière', async () => {
    db = await openBaseDb(DEVICE);
    const r = await (await measures()).save(D(9), 'waist', 82.5);
    expect(r).toMatchObject({ id: 'measurement|2026-11-09|waist', day: D(9), kind: 'waist', value: 82.5, deletedAt: null, deviceId: DEVICE });
    expect(await outbox('measurement')).toEqual([{ row_id: 'measurement|2026-11-09|waist', field: '*' }]);
  });

  it('resaisie du même jour et genre : une seule ligne, seul le champ modifié mis en file ; même valeur : aucune écriture', async () => {
    db = await openBaseDb(DEVICE);
    await (await measures()).save(D(9), 'waist', 82.5);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    expect((await (await measures()).save(D(9), 'waist', 82.5)).value).toBe(82.5);
    expect(await outbox('measurement')).toEqual([]);
    await (await measures()).save(D(9), 'waist', 81);
    expect(await outbox('measurement')).toEqual([{ row_id: 'measurement|2026-11-09|waist', field: 'value' }]);
    expect(await db.driver.select('SELECT COUNT(*) AS n FROM measurement')).toEqual([{ n: 1 }]);
  });

  it('list : mesures vivantes d’un genre, de la plus ancienne à la plus récente ; sans genre : toutes', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await measures();
    await repo.save(D(10), 'waist', 81);
    await repo.save(D(2), 'waist', 84);
    await repo.save(D(5), 'hips', 96);
    expect((await repo.list('waist')).map((m) => [m.day, m.value])).toEqual([[D(2), 84], [D(10), 81]]);
    expect((await repo.list()).map((m) => m.kind)).toEqual(['waist', 'hips', 'waist']);
  });

  it('remove : suppression logique (la ligne reste pour la synchro), resaisie rétablit la ligne', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await measures();
    await repo.save(D(9), 'waist', 82);
    await repo.remove(D(9), 'waist');
    expect(await repo.list('waist')).toEqual([]);
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM measurement')).toEqual([{ gone: 1 }]);
    db.clock.advance(1_000);
    await repo.save(D(9), 'waist', 80);
    expect((await repo.list('waist')).map((m) => m.value)).toEqual([80]);
    await repo.remove(D(1), 'chest');
  });

  it('valeur hors bornes, genre inconnu, date invalide : refusés (invalid), rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await measures();
    const { max, min } = MEASUREMENT_BOUNDS_CM.neck;
    for (const [day, kind, value] of [[D(9), 'neck', max + 1], [D(9), 'neck', min - 1], [D(9), 'neck', Number.NaN], [D(9), 'neck', 0], [D(9), 'weight', 80], ['2026-13-01' as LocalDate, 'neck', 40]] as const) {
      await expect(repo.save(day, kind as never, value), `${day} ${kind} ${value}`).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await db.driver.select('SELECT 1 FROM measurement')).toEqual([]);
  });
});

describe('ProgressPhotoRepository', () => {
  it('add : fiche publiée (date, nom de fichier), fichier local ; seule la fiche est mise en file', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await photos();
    const p = await repo.add(D(9), JPEG);
    expect(p).toMatchObject({ day: D(9), fileName: `${p.id}.jpg`, deletedAt: null, deviceId: DEVICE });
    expect(await repo.loadFile(p.id)).toEqual(JPEG);
    expect(await repo.localFileIds()).toEqual(new Set([p.id]));
    expect(await outbox('progress_photo')).toEqual([{ row_id: p.id, field: '*' }]);
    expect(await db.driver.select("SELECT 1 FROM sync_outbox WHERE table_name = 'progress_photo_file'")).toEqual([]);
  });

  it('list : fiches vivantes, la plus récente d’abord ; loadFile null quand le fichier n’est pas sur cet appareil', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await photos();
    const a = await repo.add(D(2), JPEG);
    const b = await repo.add(D(9), JPEG);
    expect((await repo.list()).map((p) => p.id)).toEqual([b.id, a.id]);
    await db.driver.execute('DELETE FROM progress_photo_file WHERE photo_id = ?', [a.id]);
    expect(await repo.loadFile(a.id)).toBeNull();
    expect(await repo.localFileIds()).toEqual(new Set([b.id]));
    expect(await repo.loadFile('inconnu')).toBeNull();
  });

  it('remove : fichier effacé ET fiche supprimée logiquement ; sans effet sur une fiche inconnue', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await photos();
    const p = await repo.add(D(9), JPEG);
    await db.driver.execute('DELETE FROM sync_outbox');
    db.clock.advance(1_000);
    await repo.remove(p.id);
    expect(await repo.list()).toEqual([]);
    expect(await db.driver.select('SELECT 1 FROM progress_photo_file')).toEqual([]);
    expect(await db.driver.select('SELECT deleted_at IS NOT NULL AS gone FROM progress_photo')).toEqual([{ gone: 1 }]);
    expect(await outbox('progress_photo')).toEqual([{ row_id: p.id, field: 'deleted_at' }]);
    await repo.remove('inconnu');
  });

  it('refus : fichier vide, trop gros, qui n’est pas un JPEG, date invalide (invalid), rien n’est écrit', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await photos();
    const big = new Uint8Array(PHOTO_MAX_BYTES + 1);
    big[0] = 0xff;
    big[1] = 0xd8;
    for (const [day, bytes] of [[D(9), new Uint8Array()], [D(9), big], [D(9), new Uint8Array([1, 2, 3, 4])], ['2026-02-30' as LocalDate, JPEG]] as const) {
      await expect(repo.add(day, bytes)).rejects.toMatchObject({ code: 'invalid' });
    }
    expect(await db.driver.select('SELECT 1 FROM progress_photo')).toEqual([]);
    expect(await db.driver.select('SELECT 1 FROM progress_photo_file')).toEqual([]);
  });

  it('purgeOrphanFiles : le fichier d’une fiche supprimée par l’autre appareil est effacé ; celui d’une fiche vivante est gardé', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await photos();
    const kept = await repo.add(D(9), JPEG);
    const gone = await repo.add(D(8), JPEG);
    // L'autre appareil a supprimé la fiche : la ligne reçue est supprimée logiquement, le fichier d'ici resterait sans fiche.
    await db.driver.execute('INSERT OR IGNORE INTO sync_guard (id) VALUES (1)');
    await db.driver.execute("UPDATE progress_photo SET deleted_at = '2026-11-12T09:00:00.000Z' WHERE id = ?", [gone.id]);
    await db.driver.execute('DELETE FROM sync_guard');
    await db.driver.execute("INSERT INTO progress_photo_file (photo_id, mime, data, saved_at) VALUES ('sans-fiche', 'image/jpeg', 'AAAA', '2026-11-12T09:00:00.000Z')");
    // Un fichier sans fiche du tout (ajout en cours) n'est jamais purgé : seule une fiche supprimée désigne un orphelin.
    expect(await repo.purgeOrphanFiles()).toBe(1);
    expect((await repo.localFileIds()).has('sans-fiche')).toBe(true);
    expect((await repo.localFileIds()).has(gone.id)).toBe(false);
    expect((await repo.localFileIds()).has(kept.id)).toBe(true);
    expect(await repo.purgeOrphanFiles()).toBe(0);
  });

  it('fichier de plus d’un million d’octets : aller-retour exact', async () => {
    db = await openBaseDb(DEVICE);
    const repo = await photos();
    const bytes = new Uint8Array(1_200_000).map((_, i) => (i * 31) % 256);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    const p = await repo.add(D(9), bytes);
    const back = await repo.loadFile(p.id);
    // Comparaison octet par octet : `toEqual` sur 1,2 million d'éléments est lent à lui seul.
    expect(back !== null && Buffer.from(back).equals(Buffer.from(bytes))).toBe(true);
  });
});
