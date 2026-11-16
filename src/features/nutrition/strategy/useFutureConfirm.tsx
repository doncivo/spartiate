import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NutritionTargetRecord } from '../../../db/repositories/nutritionTargetRepository';
import { formatInt, formatWeekdayDate, tNutrition } from '../../../i18n/nutritionText';
import { ConfirmDialog } from '../../../ui';

interface Pending {
  readonly key: string;
  readonly resolve: (ok: boolean) => void;
}

export interface FutureConfirm {
  /** Demande la confirmation D-296 pour la saisie `key` ; `true` sans cible future, ou si cette saisie est déjà confirmée pour cette cible. */
  readonly ask: (key: string) => Promise<boolean>;
  /** Réponse « Enregistrer quand même » (exposée pour les tests du crochet). */
  readonly confirm: () => void;
  readonly dialog: ReactNode;
}

/**
 * ERGO-03 (D-296, revue 1) : confirmation d'une décision acceptée datée d'aujourd'hui ou avant, qui passerait devant la cible à venir
 * `upcoming` (D-82). Partagée par Stratégie et le check-in. Une saisie confirmée n'est plus redemandée pour la même cible future (le
 * plancher sous 1 200 kcal la renvoie) ; la demande se résout à faux si la cible future disparaît (synchro) ou au démontage : jamais suspendue.
 */
export function useFutureConfirm(upcoming: NutritionTargetRecord | null): FutureConfirm {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const confirmed = useRef<string | null>(null);

  const settle = useCallback((ok: boolean): void => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (current === null) return;
    if (ok && upcoming !== null) confirmed.current = `${upcoming.id}|${current.key}`;
    current.resolve(ok);
  }, [upcoming]);

  useEffect(() => {
    if (upcoming === null && pendingRef.current !== null) settle(false);
  }, [upcoming, settle]);
  useEffect(
    () => () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    },
    [],
  );

  const ask = useCallback(
    (key: string): Promise<boolean> => {
      if (upcoming === null || confirmed.current === `${upcoming.id}|${key}`) return Promise.resolve(true);
      pendingRef.current?.resolve(false);
      return new Promise<boolean>((resolve) => {
        const next = { key, resolve };
        pendingRef.current = next;
        setPending(next);
      });
    },
    [upcoming],
  );

  const dialog =
    pending !== null && upcoming !== null ? (
      <ConfirmDialog
        title={tNutrition('futureConfirmTitle')}
        description={tNutrition('futureConfirmText', { date: formatWeekdayDate(upcoming.weekStart), kcal: formatInt(upcoming.target.kcal) })}
        confirmLabel={tNutrition('futureConfirm')}
        cancelLabel={tNutrition('cancel')}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    ) : null;
  return { ask, confirm: () => settle(true), dialog };
}

/** Clé d'une saisie de cible (même saisie = mêmes valeurs). */
export const targetKey = (t: { readonly kcal: number; readonly proteinG: number; readonly fatG: number; readonly carbG: number }): string => `${t.kcal}|${t.proteinG}|${t.fatG}|${t.carbG}`;
