import { logFailure } from '../../../platform/desktop/log';
import { openShortcutFiles, openShortcutPicker, type ShortcutFilesReader } from '../../../platform/shortcutFiles';
import { detectTimeZone } from '../../../platform/timeZone';
import type { AppContainer } from '../../app/container';
import { createHealthBodyImportService, type BodyImportLog, type BodyImportSummary, type HealthBodyImportService } from './service';

export * from './service';

/** Journal de l'import : événement fixe en code, comptes en message (`clé=entier`), jamais une valeur corporelle. */
export const bodyImportLog: BodyImportLog = (event, counts) =>
  logFailure('health-body-import', { code: event, message: Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ') || 'ok' });

const services = new WeakMap<AppContainer, HealthBodyImportService>();

/** Service d'import du conteneur (un seul par conteneur : « un import à la fois » vaut pour l'écran comme pour l'ouverture). */
export function healthBodyImportFor(container: AppContainer, reader?: ShortcutFilesReader, fallback?: ShortcutFilesReader): HealthBodyImportService {
  const existing = services.get(container);
  if (existing !== undefined && reader === undefined && fallback === undefined) return existing;
  const { runtime, os } = container.platform;
  const service = createHealthBodyImportService({
    reader: reader ?? openShortcutFiles(runtime, os),
    fallback: fallback ?? openShortcutPicker(runtime, os),
    transaction: (work) => container.data.transaction(async (repos) => work({ weights: await repos.bodyWeights(), measurements: await repos.measurements(), meals: await repos.mealEntries() })),
    clock: container.clock,
    timeZone: detectTimeZone() ?? 'Europe/Paris',
    log: bodyImportLog,
    state: {
      get: () => container.data.repos.settings.get('healthBody.lastImport'),
      set: (summary) => container.data.repos.settings.set('healthBody.lastImport', summary),
    },
  });
  services.set(container, service);
  return service;
}

/** Résumé gardé du dernier import (comptes seulement), ou null (jamais importé, valeur illisible). */
export function parseBodyImportSummary(raw: unknown): BodyImportSummary | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as { at?: unknown; files?: unknown; nutrition?: unknown };
  if (typeof value.at !== 'string' || !Array.isArray(value.files) || typeof value.nutrition !== 'object' || value.nutrition === null) return null;
  return raw as BodyImportSummary;
}
