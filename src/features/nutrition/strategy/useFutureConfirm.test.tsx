import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { NutritionTargetRecord } from '../../../db/repositories/nutritionTargetRepository';
import { useFutureConfirm } from './useFutureConfirm';

/** ERGO-03 revue 1 (points 2 et 3, D-296) : la confirmation devant une cible future ne reste jamais suspendue et n'est pas redemandée. */
const FUTURE = { id: 'f', weekStart: '2026-11-16', target: { kcal: 2350, proteinG: 180, fatG: 72, carbG: 240 } } as unknown as NutritionTargetRecord;

afterEach(cleanup);

describe('ERGO-03 revue 1 : useFutureConfirm', () => {
  it('sans cible future : accordé sans fenêtre', async () => {
    const { result } = renderHook(() => useFutureConfirm(null));
    await expect(result.current.ask('k')).resolves.toBe(true);
    expect(result.current.dialog).toBeNull();
  });

  it('la cible future disparaît pendant que la fenêtre est ouverte (synchro) : la demande se résout à faux', async () => {
    const { result, rerender } = renderHook(({ upcoming }) => useFutureConfirm(upcoming), { initialProps: { upcoming: FUTURE as NutritionTargetRecord | null } });
    let answer: Promise<boolean> = Promise.resolve(true);
    act(() => {
      answer = result.current.ask('k');
    });
    expect(result.current.dialog).not.toBeNull();
    rerender({ upcoming: null });
    await expect(answer).resolves.toBe(false);
    expect(result.current.dialog).toBeNull();
  });

  it('démontage pendant que la fenêtre est ouverte : la demande se résout à faux', async () => {
    const { result, unmount } = renderHook(() => useFutureConfirm(FUTURE));
    let answer: Promise<boolean> = Promise.resolve(true);
    act(() => {
      answer = result.current.ask('k');
    });
    unmount();
    await expect(answer).resolves.toBe(false);
  });

  it('même saisie déjà confirmée pour la même cible future : accordé sans nouvelle fenêtre ; autre saisie : redemandée', async () => {
    const { result } = renderHook(() => useFutureConfirm(FUTURE));
    let first: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.ask('1100|150|40|80');
    });
    act(() => result.current.confirm());
    await expect(first).resolves.toBe(true);
    await expect(result.current.ask('1100|150|40|80')).resolves.toBe(true);
    expect(result.current.dialog).toBeNull();
    act(() => {
      void result.current.ask('1200|150|40|80');
    });
    expect(result.current.dialog).not.toBeNull();
  });
});
