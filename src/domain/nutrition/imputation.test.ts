import { describe, expect, it } from 'vitest';
import { addDays } from '../localDate';
import type { LocalDate } from '../types';
import { imputeKcalDays, imputeWeightDays } from './imputation';
import type { DayTotals, WeighIn } from './types';

/** NUTRI-b (§ 15.1, C-194) : jours non loggés imputés À L'AFFICHAGE avec leur incertitude, jamais 0, jamais une mesure. Valeurs synthétiques. */
const E = '2026-11-20' as LocalDate;
const at = (back: number): LocalDate => addDays(E, -back);
const complete = (date: LocalDate, kcal: number): DayTotals => ({ date, state: 'complete', origin: 'declared', entryCount: 3, spanHours: 10, kcal, proteinG: 100, fatG: 40, carbG: 100, usableForTdee: true, reasons: [] });
const unknown = (date: LocalDate): DayTotals => ({ date, state: 'unknown', origin: 'none', entryCount: 0, spanHours: null, kcal: null, proteinG: null, fatG: null, carbG: null, usableForTdee: false, reasons: ['no-entries'] });
const partial = (date: LocalDate, kcal: number): DayTotals => ({ date, state: 'partial', origin: 'inferred', entryCount: 2, spanHours: 3, kcal, proteinG: null, fatG: null, carbG: null, usableForTdee: false, reasons: ['too-few-entries'] });

// Cinq jours complets : 2 000, 2 200, 2 400, 2 000, 2 400 → moyenne 2 200, écart type d'échantillon 200 (écarts −200, 0, 200, −200, 200 : 160 000 / 4 = 40 000).
const base = (): DayTotals[] => [10, 9, 8, 7, 6].map((b, i) => complete(at(b), [2000, 2200, 2400, 2000, 2400][i] ?? 0));

describe('NUTRI-b : imputation des kcal', () => {
  it('un jour sans entrée reçoit la moyenne des jours complets, ± l’écart type, marqué imputé', () => {
    const r = imputeKcalDays({ days: [...base(), unknown(at(2))], startDate: at(2), endDate: at(2) });
    expect(r.reason).toBeNull();
    expect(r.days).toEqual([{ date: at(2), kcal: 2200, spread: 200, sampleDays: 5, basis: 'imputed' }]);
  });
  it('un jour absent de la liste est imputé de la même façon', () => {
    const r = imputeKcalDays({ days: base(), startDate: at(3), endDate: at(1) });
    expect(r.days.map((d) => d.date)).toEqual([at(3), at(2), at(1)]);
    expect(r.days.every((d) => d.kcal === 2200 && d.basis === 'imputed')).toBe(true);
  });
  it('un jour complet n’est jamais imputé', () => {
    const r = imputeKcalDays({ days: base(), startDate: at(10), endDate: at(6), referenceEnd: at(1) });
    expect(r.days).toEqual([]);
  });
  it('moins de 4 jours complets : aucune imputation, cause dite, jamais 0', () => {
    const r = imputeKcalDays({ days: base().slice(0, 3), startDate: at(2), endDate: at(1) });
    expect(r.days).toEqual([]);
    expect(r.reason).toBe('too-few-complete-days');
  });
  it('jour partiel : jamais imputé, il reste partiel (son logué n’est pas remplacé par une estimation)', () => {
    const r = imputeKcalDays({ days: [...base(), partial(at(2), 2500), partial(at(3), 1000)], startDate: at(3), endDate: at(2) });
    expect(r.days).toEqual([]);
  });
  it('incertitude : au moins 5 % de la moyenne quand tous les jours sont identiques (jamais « ± 0 »)', () => {
    const same = [10, 9, 8, 7].map((b) => complete(at(b), 2000));
    const r = imputeKcalDays({ days: same, startDate: at(1), endDate: at(1) });
    expect(r.days[0]).toMatchObject({ kcal: 2000, spread: 100 });
  });
  it('seuls les jours complets de la fenêtre de 21 jours qui précède comptent', () => {
    const old = [30, 29, 28, 27].map((b) => complete(at(b), 5000));
    const r = imputeKcalDays({ days: [...old, ...base().slice(0, 3)], startDate: at(1), endDate: at(1) });
    expect(r.reason).toBe('too-few-complete-days');
  });
  it('ne modifie pas ses entrées', () => {
    const days = [...base(), unknown(at(2))];
    const copy = JSON.stringify(days);
    imputeKcalDays({ days, startDate: at(2), endDate: at(2) });
    expect(JSON.stringify(days)).toBe(copy);
  });
});

describe('NUTRI-b : imputation du poids', () => {
  const steady = (): WeighIn[] => [9, 6, 3].map((b) => ({ date: at(b), kg: 80 }));
  it('un jour sans pesée reçoit la tendance, ± l’écart des pesées à la tendance (au moins 0,3 kg)', () => {
    const r = imputeWeightDays({ weighIns: steady(), startDate: at(2), endDate: at(2) });
    expect(r.days).toEqual([{ date: at(2), kg: 80, spread: 0.3, basis: 'imputed' }]);
  });
  it('un jour pesé n’est pas imputé', () => {
    expect(imputeWeightDays({ weighIns: steady(), startDate: at(3), endDate: at(3) }).days).toEqual([]);
  });
  it('avant la première pesée : rien (jamais inventé)', () => {
    expect(imputeWeightDays({ weighIns: steady(), startDate: at(12), endDate: at(10) }).days).toEqual([]);
  });
  it('dernière pesée trop ancienne (> 7 jours) : rien', () => {
    expect(imputeWeightDays({ weighIns: steady(), startDate: at(-6), endDate: at(-6) }).days).toEqual([]);
  });
  it('pesées dispersées : l’incertitude dépasse le plancher', () => {
    const noisy: WeighIn[] = [{ date: at(9), kg: 80 }, { date: at(6), kg: 81.5 }, { date: at(3), kg: 79 }];
    const r = imputeWeightDays({ weighIns: noisy, startDate: at(2), endDate: at(2) });
    expect(r.days[0]?.spread ?? 0).toBeGreaterThan(0.3);
  });
  it('sans pesée : rien', () => {
    expect(imputeWeightDays({ weighIns: [], startDate: at(2), endDate: at(1) }).days).toEqual([]);
  });
});
