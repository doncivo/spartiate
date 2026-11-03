// Y-01 critère 19 (QA) : textes de la section SYNCHRONISATION dans src/i18n (français seul), aucun texte en dur, boîtes natives complètes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import native from '../../i18n/native/fr.json';

describe('Y-01 critère 19 : textes', () => {
  it('aucun texte français en dur dans le composant (accents, guillemets, point d’interrogation)', () => {
    const source = readFileSync(new URL('./SyncSettingsSection.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const literals = [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2] ?? '');
    for (const text of literals) expect(text, text).not.toMatch(/[àâäéèêëîïôöùûüçœ’«»]/i);
    expect(source).not.toMatch(/>\s*[A-ZÉ][a-zéèêàç]+[^<{]*</);
  });

  it('les boîtes natives (trois de Y-08, « Oublier cet appareil » de Y-10, « Réinitialiser » de Y-11) ont titre, question, explication et deux boutons, « Annuler » en second', () => {
    expect(Object.keys(native.consent).sort()).toEqual(['eraseKey', 'forgetDevice', 'replaceKey', 'resetKey', 'showKey']);
    for (const [name, box] of Object.entries(native.consent)) {
      expect(Object.keys(box).sort(), name).toEqual(['cancel', 'confirm', 'content', 'instruction', 'title']);
      expect(box.cancel, name).toBe('Annuler');
      expect(box.instruction.endsWith('?'), name).toBe(true);
      expect(box.confirm, name).not.toBe(box.cancel);
    }
    expect(native.consent.showKey.confirm).toBe('Afficher la clé');
    expect(native.consent.eraseKey.content).toContain('Sans clé, cet appareil devra être associé de nouveau');
  });

  it('Y-10 (sécurité, basse) : les quatre clés de forgetDetail existent et ne sont pas vides (sinon la boîte perdrait son détail sans le dire)', () => {
    const detail = (native as unknown as { forgetDetail?: Record<string, unknown> }).forgetDetail ?? {};
    for (const key of ['detail', 'never', 'windows', 'ios']) {
      expect(typeof detail[key], key).toBe('string');
      expect((detail[key] as string).trim().length, key).toBeGreaterThan(0);
    }
    for (const field of ['{platform}', '{id}', '{date}', '{time}']) expect(detail.detail as string).toContain(field);
    expect(detail.never as string).toContain('{id}');
  });
});
