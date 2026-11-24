import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/build-ios.yml', import.meta.url), 'utf8');

// BL-104 : si `codesign -d` échoue sur l'extension, la cause (stderr) est affichée dans le journal avant l'échec du job.
describe('BL-104 : contrôle des entitlements de l\'extension Live Activity', () => {
  const ligne = workflow.split('\n').findIndex((l) => l.includes('codesign -d --entitlements :- "$EXT"'));
  const bloc = workflow.split('\n').slice(ligne, ligne + 4).join('\n');

  it('un échec de codesign -d est testé explicitement', () => {
    expect(ligne).toBeGreaterThan(0);
    expect(bloc).toMatch(/if ! codesign -d --entitlements :- "\$EXT"/);
  });
  it('le fichier extension-entitlements.err est affiché puis le job échoue', () => {
    expect(bloc).toContain('cat "$RUNNER_TEMP/extension-entitlements.err"');
    expect(bloc).toMatch(/::error::[^\n]*codesign -d/);
    expect(bloc).toContain('exit 1');
  });
  it('aucun || true ne masque le contrôle', () => {
    expect(bloc).not.toContain('|| true');
  });
});
