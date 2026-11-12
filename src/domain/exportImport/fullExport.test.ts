import { describe, expect, it } from 'vitest';
import { buildExportArchive, canonicalHash, EXPORT_SV, IMPORT_ZIP_LIMITS, parseExportArchive, TRAINING_EXPORT_TABLES, type ExportData } from './archive';
import { CSV_BOM, MEASUREMENT_VALUE_UNIT, buildFullExport, csvCell, csvText, FULL_EXPORT_EXCLUDED, FULL_EXPORT_TABLES, fullExportColumns, parseCsvText } from './fullExport';
import { readZip } from './zip';

/**
 * I6-03 (§ 21, export complet) : archive zip CSV + JSON de toutes les tables de données de l'utilisateur. Format : CSV UTF-8 AVEC marque d'ordre
 * des octets (Excel ouvre les accents), séparateur « ; » (comme l'export de l'historique, Excel en français), fin de ligne CRLF, guillemets
 * doublés, dates ISO, nombres avec point décimal et sans notation scientifique, cellule vide = NULL. Jamais de fichier de photo, de table
 * technique, de clé ni de jeton.
 */
const DATA: ExportData = {
  profile: { id: 'profile|singleton', sex: 'male', birthYear: 1990, heightCm: 181, goal: null, experience: null, units: 'metric' },
  weights: [
    { id: 'weight|2026-10-05|manual', date: '2026-10-05', kg: 82.1, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null },
    { id: 'weight|2026-10-04|manual', date: '2026-10-04', kg: 82.4, source: 'manual', timezone: 'Europe/Paris', healthUuid: null, measuredAt: null },
  ],
  settings: { 'ui.theme': 'light' },
  training: {
    exercise: [{ id: '11111111-0000-4000-8000-000000000001', values: { name_fr: 'Tirage ; « poulie », haute\nà deux mains', muscles: '[{"muscle":"lats","weight":1}]' } }],
    measurement: [
      { id: 'measurement|2026-11-09|waist', values: { date: '2026-11-09', kind: 'waist', value: 82.5 } },
      { id: 'measurement|2026-11-01|arm_left', values: { date: '2026-11-01', kind: 'arm_left', value: 36 } },
    ],
  },
};
const entries = async (data: ExportData = DATA) => {
  const built = await buildFullExport(data, { date: '2026-11-12T10:00:00.000Z', sv: EXPORT_SV, appVersion: '0.14.0' });
  const map = new Map(readZip(built.bytes, IMPORT_ZIP_LIMITS).map((e) => [e.name, e.data]));
  return { built, map, text: (name: string): string => new TextDecoder('utf-8', { ignoreBOM: true }).decode(map.get(name)) };
};

describe('cellules et fichiers CSV', () => {
  it('cellule : vide pour NULL, point décimal, jamais de notation scientifique, guillemets si ; " retour à la ligne', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(82.5)).toBe('82.5');
    expect(csvCell(36)).toBe('36');
    expect(csvCell(0.0000001)).toBe('0.0000001');
    expect(csvCell(1e21)).not.toMatch(/e/i);
    expect(csvCell('2026-11-09')).toBe('2026-11-09');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit « oui »')).toBe('dit « oui »');
    expect(csvCell('il a dit "non"')).toBe('"il a dit ""non"""');
    expect(csvCell('ligne1\nligne2')).toBe('"ligne1\nligne2"');
    expect(csvCell('ligne1\r\nligne2')).toBe('"ligne1\r\nligne2"');
  });
  it('un texte qui commencerait une formule dans un tableur est neutralisé par une apostrophe (= + - @ % tabulation) ; les nombres négatifs restent des nombres', () => {
    for (const text of ['=1+1', '+33 6 00 00 00 00', '@cmd', '\tx', '-cmd']) expect(csvCell(text), text).toBe(`'${text}`);
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell('café')).toBe('café');
  });
  it('csvText : marque d’ordre des octets, en-tête, CRLF, ligne finale terminée', () => {
    const text = csvText(['a', 'b'], [[1, 'x;y'], [null, 'z']]);
    expect(text).toBe(`${CSV_BOM}a;b\r\n1;"x;y"\r\n;z\r\n`);
    expect(csvText(['a'], [])).toBe(`${CSV_BOM}a\r\n`);
  });
  it('relecture indépendante : parseCsvText retrouve cellules, guillemets, retours à la ligne et accents', () => {
    const rows = [['é;"à"', 'ligne1\nligne2', ''], ['', '1.5', 'x']];
    expect(parseCsvText(csvText(['c1', 'c2', 'c3'], rows))).toEqual([['c1', 'c2', 'c3'], ...rows]);
  });
});

describe('contenu de l’archive', () => {
  it('tables : profil, pesées, réglages exportés et toutes les tables d’entraînement, dans l’ordre du catalogue ; aucun fichier de photo, aucune table technique', () => {
    expect(FULL_EXPORT_TABLES).toEqual(['profile', 'body_weight', 'settings', ...TRAINING_EXPORT_TABLES]);
    for (const banned of ['progress_photo_file', 'sync_outbox', 'sync_field_clock', 'sync_meta', 'sync_state', 'sync_unknown', 'conflict_log', 'recovery_sample', 'recovery_import_state', 'schema_migrations']) {
      expect((FULL_EXPORT_TABLES as readonly string[]).includes(banned), banned).toBe(false);
      expect(FULL_EXPORT_EXCLUDED, banned).toContain(banned);
    }
  });

  it('fichiers : manifest.json, contenu.json, data.json, un CSV par table sous csv/ ; rien d’autre', async () => {
    const { map } = await entries();
    expect([...map.keys()]).toEqual(['manifest.json', 'contenu.json', 'data.json', ...FULL_EXPORT_TABLES.map((t) => `csv/${t}.csv`)]);
    expect([...map.keys()].some((n) => /\.(jpe?g|png|heic|key|pem|token)$/i.test(n))).toBe(false);
  });

  it('nom du fichier daté ; octets identiques à date et données identiques', async () => {
    const a = await entries();
    expect(a.built.fileName).toBe('spartiate-export-complet-2026-11-12.zip');
    expect((await entries()).built.bytes).toEqual(a.built.bytes);
  });

  it('chaque CSV : BOM UTF-8, en-tête = colonnes documentées (id d’abord), lignes triées par id, une ligne par donnée', async () => {
    const { map, text } = await entries();
    for (const table of FULL_EXPORT_TABLES) {
      const bytes = map.get(`csv/${table}.csv`) as Uint8Array;
      expect([...bytes.slice(0, 3)], table).toEqual([0xef, 0xbb, 0xbf]);
      const rows = parseCsvText(text(`csv/${table}.csv`));
      expect(rows[0], table).toEqual(fullExportColumns(table).map((c) => c.name));
      expect(rows[0]?.[0] === 'id' || table === 'settings', table).toBe(true);
      const ids = rows.slice(1).map((r) => r[0] ?? '');
      expect(ids, table).toEqual([...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
    }
    const measurement = parseCsvText(text('csv/measurement.csv'));
    expect(measurement.slice(1)).toEqual([
      ['measurement|2026-11-01|arm_left', '2026-11-01', 'arm_left', '36', 'cm'],
      ['measurement|2026-11-09|waist', '2026-11-09', 'waist', '82.5', 'cm'],
    ]);
    const exercise = parseCsvText(text('csv/exercise.csv'));
    const col = exercise[0]?.indexOf('name_fr') as number;
    expect(exercise[1]?.[col]).toBe('Tirage ; « poulie », haute\nà deux mains');
  });

  it('profil, pesées et réglages', async () => {
    const { text } = await entries();
    expect(parseCsvText(text('csv/profile.csv'))).toEqual([['id', 'sex', 'birth_year', 'height_cm', 'goal', 'experience', 'units'], ['profile|singleton', 'male', '1990', '181', '', '', 'metric']]);
    expect(parseCsvText(text('csv/body_weight.csv')).slice(1).map((r) => r[0])).toEqual(['weight|2026-10-04|manual', 'weight|2026-10-05|manual']);
    expect(parseCsvText(text('csv/settings.csv'))).toEqual([['key', 'value'], ['ui.theme', 'light']]);
  });

  it('contenu.json : format, séparateur, unités, fichiers (nombre de lignes, colonnes), exclusions ; aucune clé, aucun jeton, aucun identifiant d’appareil', async () => {
    const { text } = await entries();
    const content = JSON.parse(text('contenu.json')) as { format: number; app: string; sv: number; appVersion: string; csv: { encoding: string; bom: boolean; separator: string; eol: string }; files: { file: string; table: string; rows: number; columns: { name: string; type: string; unit: string | null }[] }[]; excluded: string[] };
    expect(content).toMatchObject({ format: 1, app: 'spartiate', sv: EXPORT_SV, appVersion: '0.14.0', csv: { encoding: 'utf-8', bom: true, separator: ';', eol: 'CRLF' } });
    expect(content.files.map((f) => f.file)).toEqual(FULL_EXPORT_TABLES.map((t) => `csv/${t}.csv`));
    expect(content.files.find((f) => f.table === 'measurement')).toMatchObject({ rows: 2 });
    expect(content.files.find((f) => f.table === 'measurement')?.columns).toEqual([
      { name: 'id', type: 'text', unit: null },
      { name: 'date', type: 'date', unit: null },
      { name: 'kind', type: 'text', unit: null },
      { name: 'value', type: 'real', unit: MEASUREMENT_VALUE_UNIT },
      { name: 'unit', type: 'enum', unit: null },
    ]);
    expect(content.excluded).toEqual([...FULL_EXPORT_EXCLUDED]);
    const all = JSON.stringify(content) + text('data.json');
    expect(all).not.toMatch(/device_id|hlc|secret|token|passphrase|bookmark/i);
  });

  it('data.json et manifest.json : même forme que l’export habituel (l’archive complète est aussi une archive importable)', async () => {
    const importable: ExportData = { ...DATA, training: { measurement: DATA.training?.measurement ?? [] } };
    const { text, built } = await entries(importable);
    const plain = await buildExportArchive(importable, { date: '2026-11-12T10:00:00.000Z', sv: EXPORT_SV });
    expect(text('data.json')).toBe(new TextDecoder().decode(readZip(plain.bytes).find((e) => e.name === 'data.json')?.data));
    const parsed = await parseExportArchive(built.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
    expect(await canonicalHash(parsed.data)).toBe(await canonicalHash(importable));
  });
});

describe('FIX-0173 (constat 4) : unité des mesures selon leur genre', () => {
  const MIXED: ExportData = {
    ...DATA,
    training: {
      measurement: [
        { id: 'measurement|2026-11-09|waist', values: { date: '2026-11-09', kind: 'waist', value: 82.5 } },
        { id: 'measurement|2026-11-09|health_body_fat_pct', values: { date: '2026-11-09', kind: 'health_body_fat_pct', value: 18.5 } },
        { id: 'measurement|2026-11-09|health_lean_mass_kg', values: { date: '2026-11-09', kind: 'health_lean_mass_kg', value: 64.2 } },
        { id: 'measurement|2026-11-09|health_fiber_g', values: { date: '2026-11-09', kind: 'health_fiber_g', value: 28 } },
        { id: 'measurement|2026-11-09|health_waist_cm', values: { date: '2026-11-09', kind: 'health_waist_cm', value: 83 } },
        { id: 'measurement|2026-11-09|future_kind', values: { date: '2026-11-09', kind: 'future_kind', value: 3 } },
      ],
    },
  };

  it('CSV lisible : valeur stockée inchangée et unité par ligne (cm, pct, kg, g ; genre inconnu : cellule vide)', async () => {
    const { text } = await entries(MIXED);
    const rows = parseCsvText(text('csv/measurement.csv'));
    expect(rows[0]).toEqual(['id', 'date', 'kind', 'value', 'unit']);
    const byKind = new Map(rows.slice(1).map((r) => [r[2], [r[3], r[4]]] as const));
    expect(byKind.get('waist')).toEqual(['82.5', 'cm']);
    expect(byKind.get('health_body_fat_pct')).toEqual(['18.5', 'pct']);
    expect(byKind.get('health_lean_mass_kg')).toEqual(['64.2', 'kg']);
    expect(byKind.get('health_fiber_g')).toEqual(['28', 'g']);
    expect(byKind.get('health_waist_cm')).toEqual(['83', 'cm']);
    expect(byKind.get('future_kind')).toEqual(['3', '']);
  });

  it('contenu.json : la valeur ne prétend plus être en cm, l’unité de chaque genre est dite ; data.json et réimport inchangés', async () => {
    // Réimport : genres connus seulement (l'archive refuse un genre inconnu, règle inchangée).
    const KNOWN: ExportData = { ...MIXED, training: { measurement: (MIXED.training?.measurement ?? []).filter((r) => r.values.kind !== 'future_kind') } };
    const { text, built } = await entries(KNOWN);
    const content = JSON.parse(text('contenu.json')) as { files: { table: string; columns: { name: string; unit: string | null }[] }[]; measurementUnits: Record<string, string> };
    expect(content.files.find((f) => f.table === 'measurement')?.columns.find((c) => c.name === 'value')?.unit).not.toBe('cm');
    expect(content.measurementUnits).toMatchObject({ waist: 'cm', arm_left: 'cm', health_body_fat_pct: 'pct', health_lean_mass_kg: 'kg', health_waist_cm: 'cm', health_height_cm: 'cm', health_fiber_g: 'g' });
    expect(text('data.json')).not.toContain('"unit"');
    const parsed = await parseExportArchive(built.bytes, { currentSv: EXPORT_SV, currentYear: 2026 });
    const byId = (rows: readonly { id: string; values: Record<string, unknown> }[] | undefined) => new Map((rows ?? []).map((r) => [r.id, r.values.value]));
    expect(byId(parsed.data.training?.measurement)).toEqual(byId(KNOWN.training?.measurement));
  });
});

describe('colonnes documentées', () => {
  it('type, unité et possibilité de NULL pour chaque colonne ; unités des mesures et des charges', () => {
    const unit = (table: string, name: string) => fullExportColumns(table).find((c) => c.name === name)?.unit;
    expect(unit('measurement', 'value')).toBe(MEASUREMENT_VALUE_UNIT);
    expect(MEASUREMENT_VALUE_UNIT).not.toBe('cm');
    expect(unit('workout_set', 'load_kg')).toBe('kg');
    expect(unit('workout_set', 'duration_sec')).toBe('s');
    expect(unit('workout_set', 'target_rest_sec')).toBe('s');
    expect(unit('workout_set', 'circuit_rest_sec')).toBe('s');
    expect(unit('body_weight', 'kg')).toBe('kg');
    expect(unit('profile', 'height_cm')).toBe('cm');
    expect(fullExportColumns('workout_set').map((c) => c.name)).toEqual(expect.arrayContaining(['circuit_id', 'circuit_rest_sec']));
  });
  it('sans created_at, deleted_at, updated_at, device_id ni hlc dans aucune table', () => {
    for (const table of FULL_EXPORT_TABLES) for (const banned of ['created_at', 'deleted_at', 'updated_at', 'device_id', 'hlc']) expect(fullExportColumns(table).map((c) => c.name), `${table}.${banned}`).not.toContain(banned);
  });
});
