import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tNutrition } from '../../../i18n/nutritionText';
import type { BarcodeScannerLoader } from '../../../platform/barcode';
import { withExcursion } from '../../security/excursion';
import { createBarcodeScan, type BarcodeScan, type ScanOutcome } from './scanBarcode';

/** Classe posée sur `<html>` pendant le scan : la WebView devient transparente, la caméra du plugin est derrière (même principe que l'appairage). */
export const FOOD_SCANNING_CLASS = 'ct-scanning-food';

export interface BarcodeScanViewProps {
  readonly load: BarcodeScannerLoader;
  /** Une seule fois par scan : code lu, annulation, refus de la caméra, illisible ou échec. */
  readonly onOutcome: (outcome: ScanOutcome) => void;
}

/**
 * Écran de visée du scan alimentaire (I4-05), chargé à la demande : iPhone seulement. Lance le scan à l'ouverture (geste d'Ali : le bouton
 * « Scanner »), n'affiche que le cadre et « Annuler » ; l'annulation (bouton, fermeture, page masquée) arrête le plugin proprement.
 */
export function BarcodeScanView({ load, onOutcome }: BarcodeScanViewProps) {
  const scanRef = useRef<BarcodeScan | null>(null);
  const report = useRef(onOutcome);
  const loader = useRef(load);
  useEffect(() => {
    report.current = onOutcome;
    loader.current = load;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(FOOD_SCANNING_CLASS);
    const scan = createBarcodeScan(() => loader.current());
    scanRef.current = scan;
    let live = true;
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') void scan.cancel();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Caméra = excursion (pas de reverrouillage immédiat au retour, I-03).
    void withExcursion('camera', () => scan.run()).then((outcome) => {
      if (live) report.current(outcome);
    });
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisibility);
      root.classList.remove(FOOD_SCANNING_CLASS);
      void scan.cancel();
    };
  }, []);

  return createPortal(
    <div className="ct-nutrition-scan" role="dialog" aria-modal="true" aria-label={tNutrition('scanButton')}>
      <p className="ct-nutrition-scan__aim">{tNutrition('scanAim')}</p>
      <div className="ct-nutrition-scan__frame" aria-hidden="true" />
      <button type="button" className="ct-nutrition-scan__cancel" aria-label={tNutrition('scanCancelLabel')} onClick={() => void scanRef.current?.cancel()}>
        {tNutrition('scanCancel')}
      </button>
    </div>,
    document.body,
  );
}
