import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ArchiveError,
  EXPORT_APP,
  EXPORT_SETTING_KEYS,
  buildExportArchive,
  canonicalDataJson,
  DEFAULT_THEME,
  canonicalHash,
  parseExportArchive,
  weightCsv,
  type ExportData,
} from './archive';
import { buildZip, readZip } from './zip';

const DATE = '2026-11-04T09:30:00.000Z';
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array | undefined): string => new TextDecoder().decode(b);
const sha = (s: string | Uint8Array): string => createHash('sha256').update(s).digest('hex');

const W1 = { id: 'weight|2026-10-05|manual', date: '2026-10-05', kg: 82.4, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null } as const;
const W2 = { id: 'weight|2026-10-06|health', date: '2026-10-06', kg: 82.1, source: 'health', timezone: 'Europe/Paris', healthUuid: 'HK-1', measuredAt: '2026-10-06T06:30:00.000Z' } as const;
const DATA: ExportData = {
  profile: { id: 'profile|singleton', sex: 'male', birthYear: 1990, heightCm: 181, goal: null, experience: 'intermediate', units: 'metric' },
  weights: [W1, W2],
  settings: { 'ui.theme': 'light' },
};
const opts = { currentSv: 1, currentYear: 2026 };

const archiveOf = async (data: ExportData = DATA): Promise<Uint8Array> => (await buildExportArchive(data, { date: DATE, sv: 1 })).bytes;

/** Reconstruit l'archive après modification des fichiers ; le manifeste garde l'ancien hash sauf `rehash`. */
async function tampered(change: (files: Map<string, string>) => void, rehash = false): Promise<Uint8Array> {
  const files = new Map(readZip(await archiveOf()).map((e) => [e.name, dec(e.data)] as const));
  change(files);
  if (rehash) {
    const manifest = JSON.parse(files.get('manifest.json') ?? '{}') as Record<string, unknown>;
    manifest['sha256'] = sha(files.get('data.json') ?? '');
    files.set('manifest.json', JSON.stringify(manifest));
  }
  return buildZip([...files].map(([name, content]) => ({ name, data: enc(content) })));
}
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ArchiveError) return e.code;
    throw e;
  }
  return 'accepted';
}
const withData = (fn: (d: Record<string, unknown>) => void): Promise<Uint8Array> =>
  tampered((f) => {
    const d = JSON.parse(f.get('data.json') ?? '{}') as Record<string, unknown>;
    fn(d);
    f.set('data.json', JSON.stringify(d));
  }, true);
const rows = (d: Record<string, unknown>): Record<string, unknown>[] => d['body_weight'] as Record<string, unknown>[];

describe('export : contenu et liste blanche', () => {
  it('contient data.json, manifest.json et weight.csv, et rien d’autre', async () => {
    const { bytes, fileName } = await buildExportArchive(DATA, { date: DATE, sv: 1 });
    expect(readZip(bytes).map((e) => e.name)).toEqual(['data.json', 'manifest.json', 'weight.csv']);
    expect(fileName).toBe('spartiate-export-2026-11-04.zip');
  });

  it('manifeste : app, sv, date et sha256 des octets archivés de data.json ; aucune identité d’appareil', async () => {
    const files = new Map(readZip(await archiveOf()).map((e) => [e.name, e.data] as const));
    const manifest = JSON.parse(dec(files.get('manifest.json'))) as Record<string, unknown>;
    expect(manifest).toEqual({ app: EXPORT_APP, sv: 1, date: DATE, sha256: sha(files.get('data.json') ?? new Uint8Array()) });
  });

  it('data.json canonique : ni hlc, ni device_id, ni updated_at, ni table de synchro', () => {
    const json = canonicalDataJson(DATA);
    for (const banned of ['hlc', 'device_id', 'updated_at', 'sync_', 'conflict_log', 'epoch_carry', 'bookmark']) expect(json).not.toContain(banned);
    expect(EXPORT_SETTING_KEYS).toEqual(['ui.theme']);
  });

  it('canonique : l’ordre des pesées en entrée ne change ni le texte ni le hash', async () => {
    const reversed: ExportData = { ...DATA, weights: [W2, W1] };
    expect(canonicalDataJson(reversed)).toBe(canonicalDataJson(DATA));
    expect(await canonicalHash(reversed)).toBe(await canonicalHash(DATA));
    expect(await canonicalHash({ ...DATA, weights: [W1] })).not.toBe(await canonicalHash(DATA));
  });

  it('weight.csv : entête fixe, une ligne par pesée, rien d’autre', () => {
    const csv = weightCsv(DATA.weights);
    expect(csv.split('\n')[0]).toBe('date;kg;source;fuseau;health_uuid;mesure_a');
    expect(csv).toContain('2026-10-05;82.4;manual;Europe/Paris;;');
    expect(csv).toContain('2026-10-06;82.1;health;Europe/Paris;HK-1;2026-10-06T06:30:00.000Z');
    expect(csv.trimEnd().split('\n')).toHaveLength(3);
  });

  it('sans donnée : archive valide, profil null', async () => {
    const empty: ExportData = { profile: null, weights: [], settings: {} };
    // `archiveSv` (I4-07) : version de schéma du manifeste, portée par les données lues.
    expect((await parseExportArchive(await archiveOf(empty), opts)).data).toEqual({ ...empty, archiveSv: 1 });
  });
});

describe('import : validation complète avant écriture', () => {
  it('aller-retour : mêmes données, même hash canonique', async () => {
    const parsed = await parseExportArchive(await archiveOf(), opts);
    expect(parsed.data).toEqual({ ...DATA, archiveSv: 1 });
    expect(parsed.manifest).toMatchObject({ app: 'spartiate', sv: 1, date: DATE });
    expect(await canonicalHash(parsed.data)).toBe(await canonicalHash(DATA));
  });

  it('refuse : pas une archive, fichier absent, manifeste illisible', async () => {
    expect(await refusal(parseExportArchive(enc('texte'), opts))).toBe('not-zip');
    expect(await refusal(parseExportArchive(await tampered((f) => f.delete('data.json')), opts))).toBe('missing-file');
    expect(await refusal(parseExportArchive(await tampered((f) => f.set('manifest.json', '{pas json')), opts))).toBe('bad-manifest');
  });

  it('refuse un octet corrompu (checksum du zip) et un data.json modifié sans nouveau hash', async () => {
    const zip = (await archiveOf()).slice();
    const at = zip.indexOf(0x7b) + 2;
    zip[at] = (zip[at] ?? 0) ^ 0x55;
    expect(await refusal(parseExportArchive(zip, opts))).toBe('corrupt');
    expect(await refusal(parseExportArchive(await tampered((f) => f.set('data.json', `${f.get('data.json') ?? ''} `)), opts))).toBe('hash-mismatch');
  });

  it('refuse une autre application et une version de schéma future', async () => {
    const other = await tampered((f) => f.set('manifest.json', (f.get('manifest.json') ?? '').replace('"spartiate"', '"autre-app"')));
    expect(await refusal(parseExportArchive(other, opts))).toBe('wrong-app');
    const future = await tampered((f) => f.set('manifest.json', (f.get('manifest.json') ?? '').replace('"sv":1', '"sv":2')));
    expect(await refusal(parseExportArchive(future, opts))).toBe('future-version');
  });

  it('refuse valeurs hors bornes, identité incohérente, doublon, clé hors liste blanche, champ inconnu, santé sans instant', async () => {
    const bad = async (fn: (d: Record<string, unknown>) => void): Promise<string> => refusal(parseExportArchive(await withData(fn), opts));
    expect(await bad((d) => { (rows(d)[0] as Record<string, unknown>)['kg'] = -3; })).toBe('invalid-data');
    expect(await bad((d) => { (rows(d)[0] as Record<string, unknown>)['id'] = 'weight|2026-10-09|manual'; })).toBe('invalid-data');
    expect(await bad((d) => { d['body_weight'] = [rows(d)[0], rows(d)[0]]; })).toBe('invalid-data');
    expect(await bad((d) => { (d['profile'] as Record<string, unknown>)['height_cm'] = 50; })).toBe('invalid-data');
    expect(await bad((d) => { (d['settings'] as Record<string, unknown>)['sync.deviceId'] = 'x'; })).toBe('invalid-data');
    expect(await bad((d) => { d['device_id'] = 'x'; })).toBe('invalid-data');
    expect(await bad((d) => { (rows(d)[1] as Record<string, unknown>)['measured_at'] = null; })).toBe('invalid-data');
  });
});

describe('thème par défaut (SPA-009 : « dark »)', () => {
  it('la forme canonique omet le thème par défaut du registre et garde « system » quand il est choisi', () => {
    expect(DEFAULT_THEME).toBe('dark');
    const base: ExportData = { profile: null, weights: [], settings: {} };
    expect(canonicalDataJson({ ...base, settings: { 'ui.theme': 'dark' } })).toBe(canonicalDataJson(base));
    expect(canonicalDataJson({ ...base, settings: { 'ui.theme': 'system' } })).not.toBe(canonicalDataJson(base));
  });
});
