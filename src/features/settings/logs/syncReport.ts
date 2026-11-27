import type { Repositories } from '../../../db/repositories';
import { hlcMs } from '../../../domain/sync/parse';
import type { SyncDiagnostics } from '../../../db/repositories/syncRepository';

/** Un appareil connu (ligne de `sync_state`) : identifiant court, plateforme, version, statut, heures et curseur ; rien du contenu. */
export interface SyncReportDevice {
  readonly id: string;
  readonly self: boolean;
  readonly platform: string | null;
  readonly appVersion: string | null;
  readonly status: string;
  readonly lastSyncAt: string | null;
  /** SYNC-0302 (D-673) : cet appareil, heure posée par une lecture partielle (`sync_meta.partialRead` qui désigne `lastSyncAt`). */
  readonly partialRead: boolean;
  /** Heure de la dernière modification lue de cet appareil (extraite de l'horloge hybride, jamais l'horloge entière). */
  readonly lastSeen: string | null;
  /** `segment/enregistrement`. */
  readonly cursor: string;
}

export interface SyncReport extends SyncDiagnostics {
  readonly devices: readonly SyncReportDevice[];
}

/** Bilan indisponible : code seulement. */
export interface SyncReportUnavailable {
  readonly unavailable: string;
}

function isoOfHlc(hlc: string | null): string | null {
  if (hlc === null) return null;
  try {
    return new Date(hlcMs(hlc as never)).toISOString();
  } catch {
    return null;
  }
}

/** SYNC-0302 : heure de `sync_meta.partialRead` (`{ at }`), null si absente ou illisible (le bilan reste exportable). */
function partialAtOf(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as { at?: unknown } | null;
    return typeof value?.at === 'string' ? value.at : null;
  } catch {
    return null;
  }
}

/** Compteurs du bilan de l'export des journaux (0.2.4 point 3) : lecture seule, aucune valeur de champ. */
export async function readSyncReport(repos: Repositories): Promise<SyncReport> {
  const [states, counts, partialRaw] = await Promise.all([repos.sync.getStates(), repos.sync.diagnostics(), repos.sync.getMeta('partialRead')]);
  const partialAt = partialAtOf(partialRaw);
  return {
    ...counts,
    devices: states.map((row) => ({
      id: row.deviceId.slice(0, 8),
      self: row.isSelf,
      platform: row.platform,
      appVersion: row.appVersion,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      partialRead: row.isSelf && row.lastSyncAt !== null && row.lastSyncAt === partialAt,
      lastSeen: isoOfHlc(row.lastSeenHlc),
      cursor: `${String(row.cursorSegment)}/${String(row.cursorRecord)}`,
    })),
  };
}
