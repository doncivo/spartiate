/**
 * Construction déterministe de `tests/fixtures/sync/vectors.json` (ADR 0011, sections 1.2, 1.3, 2 et 12 ; Y-08 critère 4).
 *
 * Les vecteurs sont produits par le codec de référence (`syncCodec.ts`) avec des nonces imposés, puis vérifiés par Vitest
 * (`tests/unit/syncCodec.test.ts`) et par `cargo test` (`src-tauri/tests/desktop/sync_crypto.rs`). La section `rustSealed` est écrite
 * une fois par Rust (nonce tiré par la bibliothèque) et lue par le codec : elle n'est pas reconstruite ici.
 *
 * Régénération : `CT_WRITE_SYNC_VECTORS=1 npx vitest run tests/unit/syncCodec.test.ts` (garde `rustSealed`).
 */

import { encryptedLineBytes, paddedPlaintextBytes, type FileHeader } from '../../src/domain/sync/format';
import { aadBytes, aadFields, headerLine, kidOf, qrTextOf, recordKeyOf, recoveryKeyOf, sealRecord, toHex, type Bytes, type RecordPlace } from './syncCodec';
import type { DeviceId } from '../../src/domain/types';
import type { EpochId } from '../../src/domain/sync/format';

/** Texte clair : littéral, ou chaîne JSON `"aaa…"` d'exactement `bytes` octets (grands enregistrements). */
export type VectorPlaintext = { readonly json: string } | { readonly jsonStringBytes: number };

export interface RecordVector {
  readonly name: string;
  readonly place: RecordPlace;
  readonly sm: number;
  readonly sv: number;
  readonly plaintext: VectorPlaintext;
  readonly nonce: string;
  /** Ligne complète (petits enregistrements) ou son condensé SHA-256 (grands). */
  readonly line?: string;
  readonly lineSha256?: string;
  /** Octets écrits sur disque, `\n` compris = `encryptedLineBytes`. */
  readonly lineBytes: number;
}

export interface LineGroup {
  readonly sv: number;
  /** Paliers de 4 Kio du texte clair bourré ; le texte clair vaut `4096 × blocks − 4` octets. */
  readonly blocks: number;
  readonly count: number;
}

export interface SyncVectors {
  readonly description: string;
  readonly key: string;
  readonly recordKey: string;
  readonly kid: string;
  readonly recoveryKey: string;
  readonly recoveryInputs: readonly { readonly input: string; readonly ok: boolean }[];
  readonly qr: { readonly deviceId: string; readonly epoch: string | null; readonly expiresAt: number; readonly text: string };
  readonly aad: readonly { readonly place: RecordPlace; readonly sm: number; readonly sv: number; readonly hex: string }[];
  readonly padding: readonly { readonly jsonBytes: number; readonly paddedBytes: number }[];
  readonly headers: readonly { readonly header: FileHeader; readonly line: string; readonly bytes: number }[];
  readonly records: readonly RecordVector[];
  readonly limits: {
    readonly segment: {
      readonly header: FileHeader;
      readonly headerBytes: number;
      readonly prefix: readonly LineGroup[];
      readonly last: { readonly blocks: number; readonly acceptedSv: number; readonly refusedSv: number };
      readonly total: number;
    };
    readonly appendCall: { readonly accepted: readonly LineGroup[]; readonly refused: readonly LineGroup[]; readonly limit: number };
  };
  readonly rustSealed: readonly { readonly place: RecordPlace; readonly sm: number; readonly sv: number; readonly json: string; readonly line: string }[];
}

export const VECTOR_DEVICE = '3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60' as DeviceId;
export const VECTOR_OTHER_DEVICE = '7d4e1a2b-3c5f-4a6b-8d7e-9f0a1b2c3d4e' as DeviceId;
export const VECTOR_EPOCH = `e0001-${VECTOR_DEVICE}` as EpochId;

/** Clé fixe des vecteurs (jamais une vraie clé). */
export function vectorKey(): Bytes {
  const key = new Uint8Array(32);
  for (let i = 0; i < key.length; i += 1) key[i] = (i * 37 + 11) & 0xff;
  return key;
}

function nonceOf(seed: number): Bytes {
  const nonce = new Uint8Array(12);
  for (let i = 0; i < nonce.length; i += 1) nonce[i] = (seed * 29 + i * 13 + 5) & 0xff;
  return nonce;
}

export function plaintextOf(p: VectorPlaintext): string {
  return 'json' in p ? p.json : `"${'a'.repeat(p.jsonStringBytes - 2)}"`;
}

export const blockPlaintext = (blocks: number): VectorPlaintext => ({ jsonStringBytes: 4096 * blocks - 4 });

async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

const journal = (segment: number, index: number): RecordPlace => ({ kind: 'j', dev: VECTOR_DEVICE, epoch: VECTOR_EPOCH, segment, index });

/** Champs d'une opération, tous au même horodatage synthétique (vecteurs I6-05). */
const fieldsAt = (values: Readonly<Record<string, string | number | null>>): Record<string, [string | number | null, string, null]> =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [name, [value, '001794480000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null]]));

export async function buildSyncVectors(rustSealed: SyncVectors['rustSealed'] = []): Promise<SyncVectors> {
  const key = vectorKey();
  const kid = await kidOf(key);
  const recoveryKey = await recoveryKeyOf(key);
  const compact = recoveryKey.replace(/-/g, '');
  const tolerant = recoveryKey.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
  const lastChar = compact.at(-1) ?? '0';
  const otherLast = lastChar === '0' ? '4' : '0';
  const recoveryInputs = [
    { input: recoveryKey, ok: true },
    { input: compact, ok: true },
    { input: tolerant, ok: true },
    { input: `  ${recoveryKey.slice(4)}  `, ok: true },
    // Dernier caractère changé : somme de contrôle (ou bits de remplissage) fausse.
    { input: compact.slice(0, -1) + otherLast, ok: false },
    { input: compact.slice(0, -5), ok: false },
    { input: compact.replace(/.$/, 'U'), ok: false },
  ];

  const places: { readonly place: RecordPlace; readonly sm: number; readonly sv: number }[] = [
    { place: journal(1, 0), sm: 1, sv: 14 },
    { place: { kind: 's', dev: VECTOR_DEVICE, epoch: VECTOR_EPOCH, seq: 3, index: 7 }, sm: 1, sv: 14 },
    { place: { kind: 'state', dev: VECTOR_DEVICE, epoch: VECTOR_EPOCH, stateSeq: 42 }, sm: 1, sv: 14 },
  ];
  const aad = places.map((p) => ({ ...p, hex: toHex(aadBytes(aadFields(p.place, p.sm, p.sv))) }));

  const padding = [0, 1, 2, 4092, 4093, 5000, 8188, 8189, 262_144].map((jsonBytes) => ({ jsonBytes, paddedBytes: paddedPlaintextBytes(jsonBytes) }));

  const header = (f: FileHeader['f'], n: number): FileHeader => ({ f, sm: 1, kid, dev: VECTOR_DEVICE, e: VECTOR_EPOCH, n });
  const headers = [header('sp-j', 1), header('sp-s', 12), header('sp-state', 99_999_999), header('sp-state', 123_456_789_012)].map((h) => {
    const line = headerLine(h);
    return { header: h, line, bytes: new TextEncoder().encode(line).length + 1 };
  });

  const specs: { readonly name: string; readonly place: RecordPlace; readonly sm: number; readonly sv: number; readonly plaintext: VectorPlaintext; readonly full: boolean }[] = [
    {
      name: 'journal-ops',
      place: journal(1, 0),
      sm: 1,
      sv: 14,
      plaintext: { json: '{"k":"ops","sv":14,"ops":[{"t":"task","id":"t1","at":"2026-10-05T08:00:00.000Z","f":{"title":["Acheter du pain","000001759651200000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60",null]}}]}' },
      full: true,
    },
    { name: 'smallest', place: journal(1, 1), sm: 1, sv: 1, plaintext: { json: '{}' }, full: true },
    { name: 'empty', place: journal(2, 0), sm: 1, sv: 1, plaintext: { json: '' }, full: true },
    { name: 'four-kib-boundary', place: journal(2, 1), sm: 1, sv: 14, plaintext: { jsonStringBytes: 4092 }, full: true },
    { name: 'four-kib-plus-one', place: journal(2, 2), sm: 1, sv: 14, plaintext: { jsonStringBytes: 4093 }, full: true },
    { name: 'digits', place: journal(12, 345), sm: 12, sv: 123_456, plaintext: { json: '{"k":"ops","sv":123456,"ops":[]}' }, full: true },
    { name: 'utf8', place: journal(3, 0), sm: 1, sv: 14, plaintext: { json: '{"title":"Réunion à 9 h — café ☕"}' }, full: true },
    {
      name: 'snapshot',
      place: { kind: 's', dev: VECTOR_DEVICE, epoch: VECTOR_EPOCH, seq: 3, index: 7 },
      sm: 1,
      sv: 14,
      plaintext: { json: '{"k":"snap-rows","rows":[]}' },
      full: true,
    },
    {
      name: 'state',
      place: { kind: 'state', dev: VECTOR_DEVICE, epoch: VECTOR_EPOCH, stateSeq: 42 },
      sm: 1,
      sv: 14,
      plaintext: { json: '{"deviceId":"3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60"}' },
      full: true,
    },
    { name: 'max-256-kib', place: journal(4, 0), sm: 1, sv: 999_999, plaintext: { jsonStringBytes: 256 * 1024 }, full: false },
    // I5-01 (§ 16.6) : journal d'un iPhone en schéma 10, résumé du jour et muscle (valeurs synthétiques), lu par Vitest et cargo test.
    {
      name: 'journal-ops-recovery',
      place: journal(5, 0),
      sm: 1,
      sv: 10,
      plaintext: {
        json: "{\"k\":\"ops\",\"sv\":10,\"ops\":[{\"t\":\"recovery_day\",\"id\":\"recovery|2026-11-09\",\"at\":\"2026-11-09T07:00:00.000Z\",\"f\":{\"date\":[\"2026-11-09\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"level\":[\"C\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"recovery\":[72,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"abstain_reason\":[null,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"quality\":[\"good\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"exertion\":[4.5,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"exertion_prev_day\":[2,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"sleep_minutes\":[450,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"sleep_need_minutes\":[480,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"sleep_score\":[94,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"bedtime_sigma_minutes\":[22.5,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"target_zone_from\":[6,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"target_zone_to\":[8,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"hrv_ms\":[61.5,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"resting_hr\":[47,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"learning_nights\":[14,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"contributors\":[\"[{\\\"key\\\":\\\"hrv\\\",\\\"value\\\":0.4,\\\"weight\\\":0.7}]\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"explanation_keys\":[\"[\\\"exertion_cardio_not_counted\\\"]\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"computed_at\":[\"2026-11-09T07:00:00.000Z\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"engine_version\":[1,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"created_at\":[\"2026-11-09T07:00:00.000Z\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"deleted_at\":[null,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null]}},{\"t\":\"muscle_recovery\",\"id\":\"muscle|2026-11-09|quads\",\"at\":\"2026-11-09T07:00:00.000Z\",\"f\":{\"date\":[\"2026-11-09\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"muscle_id\":[\"quads\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"muscle_group\":[\"Jambes\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"percent\":[40,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"hours\":[96,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"last_worked_at\":[\"2026-11-08T18:00:00.000Z\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"ready_at\":[\"2026-11-12T18:00:00.000Z\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"created_at\":[\"2026-11-09T07:00:00.000Z\",\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null],\"deleted_at\":[null,\"001794000000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60\",null]}}]}",
      },
      full: true,
    },
    // I6-01 (§ 16.7) : journal d'un appareil en schéma 11, journal de facteurs d'un jour (valeurs synthétiques), lu par Vitest et cargo test.
    {
      name: 'journal-ops-recovery-factor',
      place: journal(6, 0),
      sm: 1,
      sv: 11,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 11,
          ops: [
            {
              t: 'recovery_factor',
              id: 'recovery_factor|2026-11-09',
              at: '2026-11-10T07:00:00.000Z',
              f: Object.fromEntries(
                Object.entries({ date: '2026-11-09', factors: '["alcohol","stress"]', none: 0, created_at: '2026-11-10T07:00:00.000Z', deleted_at: null }).map(([name, value]) => [
                  name,
                  [value, '001794100000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null],
                ]),
              ),
            },
          ],
        }),
      },
      full: true,
    },
    // I6-02 (§ 17.1) : journaux d'un appareil en schéma 12, une mensuration et la fiche d'une photo (valeurs synthétiques, aucun contenu d'image), lus par Vitest et cargo test.
    {
      name: 'journal-ops-measurement',
      place: journal(7, 0),
      sm: 1,
      sv: 12,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 12,
          ops: [
            {
              t: 'measurement',
              id: 'measurement|2026-11-09|waist',
              at: '2026-11-12T07:00:00.000Z',
              f: Object.fromEntries(
                Object.entries({ date: '2026-11-09', kind: 'waist', value: 82.5, created_at: '2026-11-12T07:00:00.000Z', deleted_at: null }).map(([name, value]) => [
                  name,
                  [value, '001794200000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null],
                ]),
              ),
            },
          ],
        }),
      },
      full: true,
    },
    {
      name: 'journal-ops-progress-photo',
      place: journal(8, 0),
      sm: 1,
      sv: 12,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 12,
          ops: [
            {
              t: 'progress_photo',
              id: '7d3c2e4f-0000-4000-8000-000000000001',
              at: '2026-11-12T07:00:00.000Z',
              f: Object.fromEntries(
                Object.entries({ date: '2026-11-09', file_name: '7d3c2e4f-0000-4000-8000-000000000001.jpg', created_at: '2026-11-12T07:00:00.000Z', deleted_at: null }).map(([name, value]) => [
                  name,
                  [value, '001794200000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null],
                ]),
              ),
            },
          ],
        }),
      },
      full: true,
    },
    // I6-03 (§ 13.8) : journal d'un appareil en schéma 13, une série de séance close dans un circuit (valeurs synthétiques), lu par Vitest et cargo test.
    {
      name: 'journal-ops-workout-set-circuit',
      place: journal(9, 0),
      sm: 1,
      sv: 13,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 13,
          ops: [
            {
              t: 'workout_set',
              id: '7d3c2e4f-0000-4000-8000-0000000000a1',
              at: '2026-11-12T19:00:00.000Z',
              f: Object.fromEntries(
                Object.entries({
                  workout_id: '7d3c2e4f-0000-4000-8000-0000000000a0',
                  exercise_id: 'bench-press-barbell',
                  exercise_name: 'Développé couché à la barre',
                  position: 0,
                  set_kind: 'work',
                  target_reps_min: 8,
                  target_reps_max: 8,
                  target_load_kg: 50,
                  target_rest_sec: 75,
                  reps: 8,
                  load_kg: 50,
                  duration_sec: null,
                  rir: 2,
                  done: 1,
                  done_at: '2026-11-12T18:30:00.000Z',
                  corrected_at: null,
                  created_at: '2026-11-12T18:00:00.000Z',
                  deleted_at: null,
                  difficulty: null,
                  circuit_id: 'c-7d3c2e4f',
                  circuit_rest_sec: 10,
                }).map(([name, value]) => [name, [value, '001794200000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null]]),
              ),
            },
          ],
        }),
      },
      full: true,
    },
    // I6-03b (§ 13.8) : journal d'un appareil en schéma 14, une ligne de routine dans un superset (valeurs synthétiques), lu par Vitest et cargo test.
    {
      name: 'journal-ops-routine-exercise-circuit',
      place: journal(10, 0),
      sm: 1,
      sv: 14,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 14,
          ops: [
            {
              t: 'routine_exercise',
              id: '7d3c2e4f-0000-4000-8000-0000000000b1',
              at: '2026-11-12T20:00:00.000Z',
              f: Object.fromEntries(
                Object.entries({
                  routine_day_id: '7d3c2e4f-0000-4000-8000-0000000000b0',
                  exercise_id: 'bench-press-barbell',
                  exercise_name: 'Développé couché à la barre',
                  sets: 3,
                  rep_min: 8,
                  rep_max: 10,
                  rir: 2,
                  rest_sec: 90,
                  position: 0,
                  created_at: '2026-11-12T20:00:00.000Z',
                  deleted_at: null,
                  circuit_id: '7d3c2e4f-0000-4000-8000-0000000000b9',
                  circuit_rest_sec: 15,
                }).map(([name, value]) => [name, [value, '001794210000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null]]),
              ),
            },
          ],
        }),
      },
      full: true,
    },
    // FIX-0181 (D-171) : journal d'un appareil en schéma 15, un favori de la recherche d'aliments (référence Ciqual synthétique), lu par Vitest et cargo test.
    {
      name: 'journal-ops-food-favorite',
      place: journal(11, 0),
      sm: 1,
      sv: 15,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 15,
          ops: [
            {
              t: 'food_favorite',
              id: 'favorite|ciqual:20',
              at: '2026-11-13T08:00:00.000Z',
              f: Object.fromEntries(
                Object.entries({ source: 'ciqual', ref: 'ciqual:20', added_at: '2026-11-13T08:00:00.000Z', created_at: '2026-11-13T08:00:00.000Z', deleted_at: null }).map(([name, value]) => [
                  name,
                  [value, '001794480000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null],
                ]),
              ),
            },
          ],
        }),
      },
      full: true,
    },
    // I6-05 (D-210) : journal d'un appareil au schéma des compléments, un complément et une prise cochée (valeurs synthétiques), lu par Vitest et cargo test.
    {
      name: 'journal-ops-supplement',
      place: journal(12, 0),
      sm: 1,
      sv: 17,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 17,
          ops: [
            {
              t: 'supplement',
              id: '30000000-0000-4000-8000-000000000001',
              at: '2026-11-13T08:00:00.000Z',
              f: fieldsAt({ name: 'Créatine', dose: 5, unit: 'g', times: '["08:00"]', days: 127, active: 1, created_at: '2026-11-13T08:00:00.000Z', deleted_at: null }),
            },
            {
              t: 'supplement_intake',
              id: 'intake|30000000-0000-4000-8000-000000000001|2026-11-13|08:00',
              at: '2026-11-13T08:00:00.000Z',
              f: fieldsAt({ supplement_id: '30000000-0000-4000-8000-000000000001', date: '2026-11-13', moment: '08:00', taken_at: '2026-11-13T08:00:00.000Z', created_at: '2026-11-13T08:00:00.000Z', deleted_at: null }),
            },
          ],
        }),
      },
      full: true,
    },
    // I6-06 (D-221) : journal d'un appareil en schéma 18, une séance cardio synthétique (durée et distance seulement : le tracé ne quitte jamais
    // l'appareil), lu par Vitest et cargo test.
    {
      name: 'journal-ops-cardio-session',
      place: journal(13, 0),
      sm: 1,
      sv: 18,
      plaintext: {
        json: JSON.stringify({
          k: 'ops',
          sv: 18,
          ops: [
            {
              t: 'cardio_session',
              id: '7d3c2e4f-0000-4000-8000-0000000000c6',
              at: '2026-11-13T18:00:00.000Z',
              f: Object.fromEntries(
                Object.entries({
                  kind: 'run',
                  started_at: '2026-11-13T17:00:00.000Z',
                  duration_sec: 2700,
                  distance_m: 7500,
                  avg_hr: 152,
                  rpe: 7,
                  source: 'gps',
                  notes: '',
                  created_at: '2026-11-13T18:00:00.000Z',
                  deleted_at: null,
                }).map(([name, value]) => [name, [value, '001794600000000-0000-3f2b8c1e-5a7d-4e9b-9c2a-1b2c3d4e5f60', null]]),
              ),
            },
          ],
        }),
      },
      full: true,
    },
  ];
  const records: RecordVector[] = [];
  for (const [i, spec] of specs.entries()) {
    const nonce = nonceOf(i + 1);
    const json = plaintextOf(spec.plaintext);
    const line = await sealRecord({ key, place: spec.place, json, sm: spec.sm, sv: spec.sv, nonce });
    const lineBytes = new TextEncoder().encode(line).length + 1;
    if (lineBytes !== encryptedLineBytes(new TextEncoder().encode(json).length, spec.sm, spec.sv)) throw new Error(`encryptedLineBytes faux : ${spec.name}`);
    records.push({
      name: spec.name,
      place: spec.place,
      sm: spec.sm,
      sv: spec.sv,
      plaintext: spec.plaintext,
      nonce: toHex(nonce),
      ...(spec.full ? { line } : { lineSha256: await sha256Hex(line) }),
      lineBytes,
    });
  }

  // Plafonds (section 1.3, avenant « Amorce ») : combinaisons de lignes dont la somme tombe exactement sur 1 Mio et 1 Mio + 1.
  const segmentHeader = header('sp-j', 1);
  const segmentHeaderBytes = new TextEncoder().encode(headerLine(segmentHeader)).length + 1;
  const MIB = 1024 * 1024;

  return {
    description:
      'Vecteurs croisés de la synchro (ADR 0011, sections 1.2, 1.3, 2 ; Y-08). Produits par tests/sim/syncVectors.ts, vérifiés par Vitest et cargo test. Clé de test, jamais une vraie clé.',
    key: toHex(key),
    recordKey: toHex(await recordKeyOf(key)),
    kid,
    recoveryKey,
    recoveryInputs,
    qr: { deviceId: VECTOR_DEVICE, epoch: VECTOR_EPOCH, expiresAt: 1_790_000_000_000, text: qrTextOf({ key, deviceId: VECTOR_DEVICE, epoch: VECTOR_EPOCH, expiresAt: 1_790_000_000_000 }) },
    aad,
    padding,
    headers,
    records,
    limits: {
      segment: {
        header: segmentHeader,
        headerBytes: segmentHeaderBytes,
        prefix: [
          { sv: 1, blocks: 1, count: 73 },
          { sv: 1, blocks: 2, count: 50 },
          { sv: 1, blocks: 17, count: 1 },
        ],
        last: { blocks: 1, acceptedSv: 9, refusedSv: 10 },
        total: MIB,
      },
      appendCall: {
        accepted: [
          { sv: 1, blocks: 1, count: 127 },
          { sv: 1, blocks: 64, count: 1 },
        ],
        refused: [
          { sv: 1, blocks: 1, count: 125 },
          { sv: 1, blocks: 3, count: 2 },
          { sv: 1, blocks: 60, count: 1 },
        ],
        limit: MIB,
      },
    },
    rustSealed,
  };
}

/** Octets sur disque d'un groupe de lignes. */
export const groupBytes = (groups: readonly LineGroup[]): number =>
  groups.reduce((total, g) => total + g.count * encryptedLineBytes(4096 * g.blocks - 4, 1, g.sv), 0);
