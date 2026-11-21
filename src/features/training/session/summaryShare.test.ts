import { describe, expect, it, vi } from 'vitest';
import { tSession } from '../../../i18n/trainingSessionText';
import { formatVolume } from '../../../i18n/trainingText';
import { renderSummaryImage, shareSummaryImage, summaryCard, type SummaryCardInput } from './summaryShare';

/**
 * SESS-01e (§ 13.5 « image partageable ») : image du résumé dessinée localement (canvas), sans aucune donnée corporelle (ni poids du corps, ni FC,
 * ni sommeil : la carte n'en reçoit pas), couleurs lues des jetons du thème ; partage par la feuille du système (`navigator.share` avec fichier)
 * si elle accepte un fichier, sinon téléchargement.
 */

const INPUT: SummaryCardInput = {
  name: 'Haut A',
  endedAt: '2026-11-21T18:10:00.000Z',
  durationSec: 3900,
  workSets: 14,
  volumeKg: 5230,
  records: [{ exerciseName: 'Développé couché à la barre', text: '82,5 kg × 6' }],
};

describe('summaryCard', () => {
  it('titre, date, durée, séries, volume, records ; rien d’autre (aucun champ corporel accepté)', () => {
    const card = summaryCard(INPUT);
    expect(card.title).toBe('Haut A');
    expect(card.lines).toEqual([
      tSession('shareDuration', { value: '1:05:00' }),
      tSession('shareSets', { n: 14 }),
      tSession('shareVolume', { value: formatVolume(5230) }),
      tSession('shareRecord', { name: 'Développé couché à la barre', text: '82,5 kg × 6' }),
    ]);
    expect(Object.keys(INPUT).sort()).toEqual(['durationSec', 'endedAt', 'name', 'records', 'volumeKg', 'workSets']);
  });
});

function fakeCanvas() {
  const texts: string[] = [];
  const styles: string[] = [];
  const ctx = {
    set fillStyle(v: string) {
      styles.push(v);
    },
    font: '',
    textBaseline: '',
    fillRect: vi.fn(),
    fillText: (t: string) => void texts.push(t),
  };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' })) };
  return { canvas: canvas as unknown as HTMLCanvasElement, texts, styles };
}

describe('renderSummaryImage', () => {
  it('dessine titre et lignes ; couleurs des jetons du thème (aucune en dur) ; PNG', async () => {
    const f = fakeCanvas();
    const token = (name: string): string => `jeton(${name})`;
    const blob = await renderSummaryImage(summaryCard(INPUT), { createCanvas: () => f.canvas, token });
    expect(blob?.type).toBe('image/png');
    expect(f.texts).toContain('Haut A');
    expect(f.texts).toContain(tSession('shareVolume', { value: formatVolume(5230) }));
    expect(f.styles.length).toBeGreaterThan(0);
    expect(f.styles.every((s) => s.startsWith('jeton('))).toBe(true);
  });

  it('canvas indisponible : null (l’écran le dit)', async () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(await renderSummaryImage(summaryCard(INPUT), { createCanvas: () => canvas, token: () => 'x' })).toBeNull();
  });
});

describe('shareSummaryImage', () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  it('feuille de partage avec fichier si acceptée ; annulation : « cancelled » sans erreur', async () => {
    const share = vi.fn(async () => undefined);
    expect(await shareSummaryImage(blob, 'seance.png', { nav: { share, canShare: () => true }, download: vi.fn() })).toBe('shared');
    expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]?.name).toBe('seance.png');
    const abort = vi.fn(async () => Promise.reject(new DOMException('annulé', 'AbortError')));
    expect(await shareSummaryImage(blob, 'seance.png', { nav: { share: abort, canShare: () => true }, download: vi.fn() })).toBe('cancelled');
  });
  it('sans partage de fichier : téléchargement ; échec du partage : téléchargement', async () => {
    const download = vi.fn();
    expect(await shareSummaryImage(blob, 'seance.png', { nav: {}, download })).toBe('downloaded');
    expect(download).toHaveBeenCalledWith(blob, 'seance.png');
    const failing = vi.fn(async () => Promise.reject(new Error('refus')));
    expect(await shareSummaryImage(blob, 'seance.png', { nav: { share: failing, canShare: () => true }, download })).toBe('downloaded');
  });
});
