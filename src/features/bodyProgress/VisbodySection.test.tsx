import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalDate } from '../../domain/types';
import { openBaseDb, type TestDb } from '../../db/repositories/sql/testSetup';
import { tVisbody, type VisbodyPlainKey } from '../../i18n/visbodyText';
import { DEVICE, mountWith, NOW } from '../tracking/testKit';
import { VisbodySection } from './VisbodySection';

/** SUIVIS-029d : Progrès › Corps, bilans VISBODY (saisie manuelle, courbes, écart au bilan précédent) ; le poids n'entre pas dans les pesées. */
let db: TestDb;
const field = (kind: string): HTMLElement => screen.getByLabelText(tVisbody(`field_${kind}` as VisbodyPlainKey));

beforeEach(async () => {
  db = await openBaseDb(DEVICE, NOW);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

describe('Bilans VISBODY', () => {
  it('saisie d’un bilan (champs facultatifs) : écrit en mesures, jamais dans les pesées ; écart au bilan précédent', async () => {
    const m = await db.data.repos.measurements();
    await m.save('2026-11-02' as LocalDate, 'visbody_weight_kg', 79);
    mountWith(db, <VisbodySection />);
    const region = await screen.findByRole('region', { name: tVisbody('title') });
    fireEvent.change(within(region).getByLabelText(tVisbody('date')), { target: { value: '2026-11-20' } });
    fireEvent.change(field('visbody_weight_kg'), { target: { value: '78,4' } });
    fireEvent.change(field('visbody_bmr_dakcal'), { target: { value: '1653' } });
    fireEvent.click(within(region).getByRole('button', { name: tVisbody('save') }));
    expect(await within(region).findByText(tVisbody('saved'))).toBeInTheDocument();
    expect((await m.find('2026-11-20' as LocalDate, 'visbody_weight_kg'))?.value).toBe(78.4);
    expect((await m.find('2026-11-20' as LocalDate, 'visbody_bmr_dakcal'))?.value).toBe(165.3);
    expect(await (await db.data.repos.bodyWeights()).listRecent(10)).toEqual([]);
    expect(await within(region).findByText(tVisbody('delta', { delta: '−0,6', unit: tVisbody('unit_kg'), date: '02/11/2026' }))).toBeInTheDocument();
    expect(within(region).getByText(tVisbody('first'))).toBeInTheDocument();
  });

  it('refus : aucun champ, ou valeur hors bornes avec la plage ; rien n’est écrit', async () => {
    mountWith(db, <VisbodySection />);
    const region = await screen.findByRole('region', { name: tVisbody('title') });
    fireEvent.click(within(region).getByRole('button', { name: tVisbody('save') }));
    expect(await within(region).findByText(tVisbody('empty'))).toBeInTheDocument();
    fireEvent.change(field('visbody_fat_pct'), { target: { value: '90' } });
    fireEvent.click(within(region).getByRole('button', { name: tVisbody('save') }));
    expect(await within(region).findByText(tVisbody('range', { min: '3', max: '70' }))).toBeInTheDocument();
    expect(await (await db.data.repos.measurements()).list('visbody_fat_pct')).toEqual([]);
  });

  it('même date : le bilan est prérempli et remplacé ; un champ vidé est retiré', async () => {
    const m = await db.data.repos.measurements();
    await m.save('2026-11-21' as LocalDate, 'visbody_weight_kg', 78);
    await m.save('2026-11-21' as LocalDate, 'visbody_fat_pct', 18);
    mountWith(db, <VisbodySection />);
    await screen.findByRole('region', { name: tVisbody('title') });
    await waitFor(() => expect(field('visbody_weight_kg')).toHaveValue('78'));
    fireEvent.change(field('visbody_fat_pct'), { target: { value: '' } });
    fireEvent.change(field('visbody_weight_kg'), { target: { value: '77,5' } });
    fireEvent.click(screen.getByRole('button', { name: tVisbody('save') }));
    expect(await screen.findByText(tVisbody('saved'))).toBeInTheDocument();
    expect((await m.find('2026-11-21' as LocalDate, 'visbody_weight_kg'))?.value).toBe(77.5);
    expect((await m.find('2026-11-21' as LocalDate, 'visbody_fat_pct'))?.deletedAt).not.toBeNull();
  });

  it('aucun bilan : le dit, aucune valeur inventée', async () => {
    mountWith(db, <VisbodySection />);
    const region = await screen.findByRole('region', { name: tVisbody('title') });
    expect(await within(region).findByText(tVisbody('none'))).toBeInTheDocument();
    expect(within(region).queryByRole('img')).toBeNull();
  });

  it('aucune valeur dans un journal technique', async () => {
    const log = vi.spyOn(console, 'log');
    const info = vi.spyOn(console, 'info');
    mountWith(db, <VisbodySection />);
    await screen.findByRole('region', { name: tVisbody('title') });
    fireEvent.change(field('visbody_weight_kg'), { target: { value: '81,3' } });
    fireEvent.click(screen.getByRole('button', { name: tVisbody('save') }));
    await screen.findByText(tVisbody('saved'));
    for (const call of [...log.mock.calls, ...info.mock.calls]) expect(JSON.stringify(call)).not.toContain('81.3');
  });
});

describe('SUIVIS-029 (qa) : séparation des genres', () => {
  it('les bilans VISBODY et les notes ne se mêlent jamais aux mensurations saisies (liste des zones)', async () => {
    const m = await db.data.repos.measurements();
    await m.save('2026-11-20' as LocalDate, 'visbody_weight_kg', 78);
    await m.save('2026-11-20' as LocalDate, 'note_fatigue', 6);
    await m.save('2026-11-20' as LocalDate, 'waist', 80);
    expect((await m.list()).map((r) => r.kind)).toEqual(['waist']);
  });
});

describe('SUIVIS-029 (relecture) : préremplissage sans arrondi', () => {
  it('72,45 kg enregistré puis bilan corrigé sur un autre champ : 72,45 reste 72,45 (jamais arrondi à 72,5)', async () => {
    const m = await db.data.repos.measurements();
    await m.save('2026-11-21' as LocalDate, 'visbody_weight_kg', 72.45);
    mountWith(db, <VisbodySection />);
    await screen.findByRole('region', { name: tVisbody('title') });
    await waitFor(() => expect(field('visbody_weight_kg')).toHaveValue('72,45'));
    fireEvent.change(field('visbody_fat_pct'), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: tVisbody('save') }));
    expect(await screen.findByText(tVisbody('saved'))).toBeInTheDocument();
    expect((await m.find('2026-11-21' as LocalDate, 'visbody_weight_kg'))?.value).toBe(72.45);
    expect((await m.find('2026-11-21' as LocalDate, 'visbody_fat_pct'))?.value).toBe(18);
  });
});
