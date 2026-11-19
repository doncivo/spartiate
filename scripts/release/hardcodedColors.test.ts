import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FIX-0272 (audit 0.26.0, partie 0 : 47 candidats couleur) : aucune couleur littérale (#hex, rgb(), rgba(), hsl()) dans le style de l'app
 * (CSS et TSX de src/) hors de src/ui/theme/tokens.css. Les commentaires ne comptent pas. Exceptions justifiées une par une ci-dessous ;
 * la liste ne peut que se réduire.
 */
const root = resolve(import.meta.dirname, '..', '..');
const ALLOWED: Readonly<Record<string, string>> = {
  // Écran « Associer au PC » de l'iPhone : jetons LOCAUX de la maquette Appairage.html (fond et textes propres à l'appairage, mêmes valeurs
  // dans les deux thèmes), déclarés une fois par variante en propriétés personnalisées, jamais en dur dans les règles.
  'src/features/sync/IosPairingScreen.css': 'jetons locaux de la maquette Appairage.html',
  // Fenêtre d'appairage du PC (pairing.html) : document séparé qui ne charge pas tokens.css ; le QR code doit rester noir sur blanc pour
  // être lu par l'appareil photo, quel que soit le thème.
  'src/features/sync/pairing-window/pairing.css': 'fenêtre séparée, QR noir sur blanc',
  'src/features/sync/pairing-window/PairingView.tsx': 'QR code noir sur blanc (lisibilité du scan)',
};

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(css|tsx)$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(path);
  }
  return out;
}
const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m, p: string) => p + ' '.repeat(m.length - p.length));
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

describe('couleurs en dur (FIX-0272)', () => {
  it('aucune couleur littérale hors de tokens.css et des exceptions justifiées', () => {
    const found: string[] = [];
    for (const path of files(resolve(root, 'src'))) {
      const rel = relative(root, path).replace(/\\/g, '/');
      if (rel === 'src/ui/theme/tokens.css' || ALLOWED[rel] !== undefined) continue;
      stripComments(readFileSync(path, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (COLOR.test(line)) found.push(`${rel}:${String(i + 1)} ${line.trim().slice(0, 80)}`);
        });
    }
    expect(found).toEqual([]);
  });

  it('les exceptions existent encore (une exception devenue inutile est retirée)', () => {
    for (const rel of Object.keys(ALLOWED)) expect(COLOR.test(stripComments(readFileSync(resolve(root, rel), 'utf8'))), rel).toBe(true);
  });
});
