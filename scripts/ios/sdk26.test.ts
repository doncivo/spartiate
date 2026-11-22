import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * BL-130 (D-436, lot 0.29.1) : build-ios.yml prouve qu'il compile avec le SDK iOS 26 (version de Xcode et du SDK affichées, étape qui
 * échoue sinon) et que FoundationModels est lié en faible (LC_LOAD_WEAK_DYLIB), pour que l'app se lance sous iOS 18 à 25.
 * Contrôle statique : aucun Mac, la preuve d'exécution est le journal du run build-ios.
 */
const root = resolve(__dirname, '..', '..');
const workflow = readFileSync(join(root, '.github/workflows/build-ios.yml'), 'utf8');

const stepBody = (name: string): string => {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, `étape « ${name} » absente`).toBeGreaterThan(-1);
  const next = workflow.indexOf('\n      - ', start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
};

describe('build-ios : SDK iOS 26 et lien faible de FoundationModels (BL-130)', () => {
  it('une étape affiche Xcode et le SDK iphoneos et échoue sous la version 26', () => {
    const body = stepBody('SDK iOS 26');
    expect(body).toMatch(/xcodebuild -version/);
    expect(body).toMatch(/xcrun --sdk iphoneos --show-sdk-version/);
    expect(body).toMatch(/-lt 26/);
    expect(body).toMatch(/exit 1/);
    expect(body).toMatch(/GITHUB_STEP_SUMMARY/);
  });

  it("l'étape du SDK précède la compilation de l'IPA", () => {
    expect(workflow.indexOf('- name: SDK iOS 26')).toBeGreaterThan(-1);
    expect(workflow.indexOf('- name: SDK iOS 26')).toBeLessThan(workflow.indexOf("- name: Compiler l'IPA sans signature"));
  });

  it("le binaire de l'IPA finale lie FoundationModels en faible, jamais en fort", () => {
    const body = stepBody('Lien faible de FoundationModels');
    expect(body).toMatch(/otool -l/);
    expect(body).toMatch(/LC_LOAD_WEAK_DYLIB/);
    expect(body).toMatch(/LC_LOAD_DYLIB/);
    expect(body).toMatch(/FoundationModels\\\.framework/);
    expect(body).toMatch(/exit 1/);
  });
});
