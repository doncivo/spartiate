import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ERGO-02b (critère 3, revue d'ERGO-02 point 5) : le nombre d'haltères tenus pour afficher une charge (« 2 × 26 kg », D-261) n'a qu'une
 * règle d'écran, `heldFor` / `heldLookup` (loadDisplay.ts). Les écrans qui affichent une charge la réemploient au lieu de recomposer
 * `dumbbellsHeld` et `loadGrid` (comportement identique : source null ou absente = déduite du matériel de l'exercice).
 */
const root = resolve(__dirname, '..', '..', '..');
const code = (path: string): string => readFileSync(join(root, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SCREENS = ['src/features/app/TodayPcSide.tsx', 'src/features/training/session/todaySessionPreview.ts'] as const;

describe('heldFor réemployé (une seule règle d’affichage des haltères)', () => {
  for (const path of SCREENS) {
    it(`${path} : importe heldFor ou heldLookup, ne recompose pas dumbbellsHeld`, () => {
      const text = code(path);
      expect(text).toMatch(/import \{[^}]*\bheld(For|Lookup)\b[^}]*\} from '[^']*training\/loadDisplay'/);
      expect(text).not.toMatch(/\bdumbbellsHeld\b/);
    });
  }
});
