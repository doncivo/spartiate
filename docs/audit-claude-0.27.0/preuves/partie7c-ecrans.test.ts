// AUDIT-CLAUDE-0.27.0, partie 7c : Plus, onboarding, coquilles. Jamais branché sur la CI.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESET_TABLES } from '../../../src/domain/dataReset';
import { dataResetFr } from '../../../src/i18n/fr.dataReset';
import { exportImportFr } from '../../../src/i18n/fr.exportImport';

const css = readFileSync('src/ui/theme/tokens.css', 'utf8');
const hexIn = (block: string, name: string) => block.match(new RegExp(`--ct-color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1] as string;
const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
const dark = css.slice(css.indexOf(":root[data-theme='dark']"), css.indexOf(":root[data-theme='light']"));
const light = css.slice(css.indexOf(":root[data-theme='light']"));

describe('C-111 anneau de focus (`--ct-color-accent`) sous 3:1 en thème sombre (WCAG 2.4.11 / 1.4.11)', () => {
  it('ROUGE accent sur surface-raised (fond des champs et du SegmentedControl) ≥ 3:1', () => {
    expect(ratio(hexIn(dark, 'accent'), hexIn(dark, 'surface-raised'))).toBeGreaterThanOrEqual(3);
  });
});

describe('C-112 interrupteur éteint et bordure des champs sous 3:1', () => {
  it('ROUGE thème clair : piste éteinte sur surface ≥ 3:1', () => {
    expect(ratio(hexIn(light, 'switch-off'), hexIn(light, 'surface'))).toBeGreaterThanOrEqual(3);
  });
  it('ROUGE thème sombre : bordure forte des champs sur surface ≥ 3:1', () => {
    expect(ratio(hexIn(dark, 'border-strong'), hexIn(dark, 'surface'))).toBeGreaterThanOrEqual(3);
  });
});

describe('C-108 « Repartir de zéro » : la liste « Ce qui est effacé » couvre les tables effacées', () => {
  it('ROUGE compléments, prises, séances cardio et tracés GPS sont cités', () => {
    const wiped = Object.entries(RESET_TABLES).filter(([, f]) => f === 'wiped').map(([t]) => t);
    expect(wiped).toEqual(expect.arrayContaining(['supplement', 'supplement_intake', 'cardio_session', 'cardio_track'])); // témoin
    const texte = Object.entries(dataResetFr).filter(([k]) => k.startsWith('wiped')).map(([, v]) => String(v)).join(' ');
    expect(texte).toMatch(/compl[ée]ment/i);
    expect(texte).toMatch(/cardio|GPS/i);
  });
});

describe('C-107 aide de l’export simple : elle annonce « profil, pesées et thème »', () => {
  it('ROUGE l’aide mentionne l’entraînement, la nutrition, la récupération et les mensurations exportés', () => {
    expect(exportImportFr.exportHint).toMatch(/nutrition|entraînement|mensurations|récupération/i);
  });
});
