// FIX-CONFID-IOS : preuve de l'audit Claude 0.27.0, parties 8b et 9 (docs/audit-claude-0.27.0/preuves/partie8b-9-confidentialite.test.ts,
// branche audit-claude-0.27.0), reprise telle quelle (chemin d'import adapté) : assainissement du journal (§ 22 : aucune donnée corporelle).
import { describe, expect, it } from 'vitest';
import { codeAndDetailOf, sanitizeLogDetail } from './sanitize';

describe('C-151 journal technique : valeurs corporelles non masquées', () => {
  it('témoin : un chemin et un e-mail sont masqués', () => {
    const s = sanitizeLogDetail('C:\\Users\\x\\a.db ali@example.org');
    expect(s).not.toContain('Users');
    expect(s).not.toContain('example.org');
  });
  it('« poids 82,4 kg hors bornes » : la valeur ne reste pas en clair', () => {
    expect(sanitizeLogDetail('poids 82,4 kg hors bornes')).not.toContain('82,4');
  });
  it('erreur non gérée dont le message cite un extrait JSON santé : HRV et FC non conservés', () => {
    const { code, detail } = codeAndDetailOf(new Error('Unexpected token in JSON: {"hrvMs":48.6,"restingHr":52}'));
    expect(`${code} ${detail}`).not.toMatch(/48\.6|52\b/);
  });
  it('« FC 142 » : la valeur ne reste pas en clair', () => {
    expect(sanitizeLogDetail('FC 142')).not.toContain('142');
  });
});
