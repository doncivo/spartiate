import { describe, expect, it } from 'vitest';
import type { ExportData, ExportWeight } from './archive';
import { planImport } from './plan';

const w = (date: string, kg: number, source: 'manual' | 'health' = 'manual'): ExportWeight => ({
  id: `weight|${date}|${source}`,
  date,
  kg,
  source,
  timezone: 'Europe/Paris',
  healthUuid: source === 'health' ? `HK-${date}` : null,
  measuredAt: source === 'health' ? `${date}T06:00:00.000Z` : null,
});
const profile = (over: Partial<NonNullable<ExportData['profile']>> = {}): NonNullable<ExportData['profile']> => ({
  id: 'profile|singleton',
  sex: 'male',
  birthYear: 1990,
  heightCm: 181,
  goal: null,
  experience: null,
  units: 'metric',
  ...over,
});
const EMPTY: ExportData = { profile: null, weights: [], settings: {} };

describe('aperçu et plan d’import', () => {
  it('base vide + archive : tout est ajouté', () => {
    const incoming: ExportData = { profile: profile(), weights: [w('2026-10-05', 82), w('2026-10-06', 81.5)], settings: { 'ui.theme': 'dark' } };
    const plan = planImport(EMPTY, incoming, 'merge');
    expect(plan.counts).toEqual({ add: 4, modify: 0, delete: 0, unchanged: 0 });
    expect(plan.ops.map((o) => `${o.kind}:${o.table}`).sort()).toEqual(['add:body_weight', 'add:body_weight', 'add:profile', 'add:settings']);
  });

  it('fusion : identité (date, source) existante → modification ; autre source → ajout ; absent de l’archive → conservé', () => {
    const local: ExportData = { profile: null, weights: [w('2026-10-05', 82), w('2026-10-01', 90)], settings: {} };
    const incoming: ExportData = { profile: null, weights: [w('2026-10-05', 81), w('2026-10-05', 80.7, 'health')], settings: {} };
    const plan = planImport(local, incoming, 'merge');
    expect(plan.counts).toEqual({ add: 1, modify: 1, delete: 0, unchanged: 0 });
    expect(plan.writes.deleteWeightIds).toEqual([]);
    expect(plan.writes.weights.map((x) => x.id).sort()).toEqual(['weight|2026-10-05|health', 'weight|2026-10-05|manual']);
  });

  it('fusion répétée : rien à écrire (idempotent)', () => {
    const incoming: ExportData = { profile: profile(), weights: [w('2026-10-05', 82)], settings: { 'ui.theme': 'light' } };
    const first = planImport(EMPTY, incoming, 'merge');
    expect(first.counts.add).toBe(3);
    const second = planImport(incoming, incoming, 'merge');
    expect(second.counts).toEqual({ add: 0, modify: 0, delete: 0, unchanged: 3 });
    expect(second.ops).toEqual([]);
    expect(second.writes.weights).toEqual([]);
    expect(second.writes.profile).toBeNull();
  });

  it('fusion du profil : une valeur absente de l’archive (NULL) n’efface jamais la valeur locale', () => {
    const local: ExportData = { profile: profile({ goal: 'gain', heightCm: 181 }), weights: [], settings: {} };
    const incoming: ExportData = { profile: profile({ goal: null, heightCm: 183 }), weights: [], settings: {} };
    const plan = planImport(local, incoming, 'merge');
    expect(plan.counts.modify).toBe(1);
    expect(plan.writes.profile).toMatchObject({ goal: 'gain', heightCm: 183 });
  });

  it('remplacement : les lignes locales absentes de l’archive sont supprimées ; le profil aussi s’il est absent', () => {
    const local: ExportData = { profile: profile(), weights: [w('2026-10-05', 82), w('2026-10-01', 90)], settings: {} };
    const incoming: ExportData = { profile: null, weights: [w('2026-10-05', 82)], settings: {} };
    const plan = planImport(local, incoming, 'replace');
    expect(plan.counts).toEqual({ add: 0, modify: 0, delete: 2, unchanged: 1 });
    expect(plan.writes.deleteWeightIds).toEqual(['weight|2026-10-01|manual']);
    expect(plan.writes.deleteProfile).toBe(true);
  });

  it('remplacement : le profil de l’archive remplace tel quel (NULL compris)', () => {
    const local: ExportData = { profile: profile({ goal: 'gain' }), weights: [], settings: {} };
    const incoming: ExportData = { profile: profile({ goal: null }), weights: [], settings: {} };
    const plan = planImport(local, incoming, 'replace');
    expect(plan.writes.profile).toMatchObject({ goal: null });
    expect(plan.counts.modify).toBe(1);
  });

  it('l’aperçu ne dépend que des données : le plan ne contient aucune écriture non listée dans ops', () => {
    const incoming: ExportData = { profile: profile(), weights: [w('2026-10-05', 82)], settings: {} };
    const plan = planImport(EMPTY, incoming, 'replace');
    expect(plan.ops).toHaveLength(plan.counts.add + plan.counts.modify + plan.counts.delete);
  });
});
