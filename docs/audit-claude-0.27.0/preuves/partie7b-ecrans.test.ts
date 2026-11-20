// AUDIT-CLAUDE-0.27.0, partie 7b : Nutrition et Progrès (fonctions pures appelées par les écrans). Jamais branché sur la CI.
import { describe, expect, it } from 'vitest';
import { summarizeZone } from '../../../src/features/bodyProgress/bodyZone';
import { supplementAdherence } from '../../../src/domain/nutrition/supplements';
import { searchFoods } from '../../../src/domain/nutrition/foodSearch';
import { trendScale } from '../../../src/features/nutrition/dashboard/model';

describe('C-090 « +5 cm en 4 semaines » sur un historique espacé', () => {
  it('ROUGE mesures au 01/06 (80) puis au 01/11 (85) : l’écart n’est pas dit « en 4 semaines »', () => {
    expect(summarizeZone([{ date: '2026-06-01', value: 80 }, { date: '2026-11-01', value: 85 }] as never).span).not.toBe('four-weeks');
  });
});

describe('C-091 compléments : changer l’heure efface la constance passée', () => {
  it('ROUGE créatine prise à 08:00 chaque jour, heure passée à 08:30 : la constance des 7 derniers jours n’est pas 0 %', () => {
    const S = { id: 's1', name: 'Créatine', dose: null, unit: null, times: ['08:30'], days: 127, active: true, since: '2026-10-01' };
    const intakes = Array.from({ length: 7 }, (_, i) => ({ supplementId: 's1', date: `2026-11-${String(13 + i).padStart(2, '0')}`, moment: '08:00' }));
    expect(supplementAdherence([S] as never, intakes as never, '2026-11-13' as never, '2026-11-19' as never).ratio).toBeGreaterThan(0);
  });
});

describe('C-092 recherche : filtre de provenance appliqué après la coupe à 50 résultats', () => {
  it('ROUGE 60 fiches Ciqual « yaourt … » et un produit OFF en cache « yaourt marque » : l’OFF figure dans les résultats non filtrés', () => {
    const per100g = { kcal: 60, proteinG: 4, fatG: 2, carbG: 6, fiberG: null };
    const foods = [...Array.from({ length: 60 }, (_, i) => ({ ref: `ciqual:${i}`, provenance: 'ciqual', name: `Yaourt ${i}`, brand: null, barcode: null, per100g })), { ref: 'off-1', provenance: 'off', name: 'Yaourt marque', brand: 'X', barcode: null, per100g }];
    expect(searchFoods('yaourt', foods as never).map((f) => f.ref)).toContain('off-1');
  });
});

describe('C-093 tendance du poids : échelle étirée par une pesée aberrante', () => {
  it('ROUGE pesées 80 ; 80,2 ; 120 (aberrante) : le haut de l’échelle reste sous 90', () => {
    const pts = [{ date: '2026-11-17', kg: 80, trend: 80, outlier: false }, { date: '2026-11-18', kg: 80.2, trend: 80.05, outlier: false }, { date: '2026-11-19', kg: 120, trend: 82.5, outlier: true }];
    expect(trendScale(pts as never, '2026-11-19' as never).max).toBeLessThan(90);
  });
});
