import { describe, expect, it } from 'vitest';
import { importStatusMessage } from './statusMessage';
import type { FileOutcome, ImportRunResult } from './service';

/** I5-04 point 1 : aucun échec silencieux, chaque statut a une phrase française. */
const base: ImportRunResult = { status: 'done', files: [], recomputedDays: 0, recomputeFailed: false, at: null };
const file = (state: FileOutcome['state'], added = 0): FileOutcome => ({ type: 'hrv', state, read: added, added, duplicates: 0, updated: 0, rejectedTotal: 0, rejected: null, truncated: false });
const four = (state: FileOutcome['state'], added = 0): FileOutcome[] => [file(state, added), file(state), file(state), file(state)];

describe('phrase de chaque statut d’import (I5-04 point 1)', () => {
  it('chaque statut hors « done » a une phrase non vide', () => {
    for (const status of ['unsupported', 'needs-pick', 'busy', 'throttled', 'folder-unavailable', 'cancelled'] as const) {
      const message = importStatusMessage({ ...base, status });
      expect(message, status).toMatch(/\S/);
    }
  });

  it('les phrases sont toutes différentes', () => {
    const all = (['unsupported', 'needs-pick', 'busy', 'throttled', 'folder-unavailable', 'cancelled'] as const).map((status) => importStatusMessage({ ...base, status }));
    expect(new Set(all).size).toBe(all.length);
  });

  it('unsupported : dit que la lecture est impossible ici ; needs-pick : renvoie à « Choisir les fichiers »', () => {
    expect(importStatusMessage({ ...base, status: 'unsupported' })).toMatch(/iPhone/);
    expect(importStatusMessage({ ...base, status: 'needs-pick' })).toMatch(/Choisir les fichiers/);
  });

  it('throttled : dit qu’une lecture récente a eu lieu', () => {
    expect(importStatusMessage({ ...base, status: 'throttled' })).toMatch(/30 minutes/);
  });

  it('done sans aucun fichier trouvé : nomme le dossier attendu', () => {
    expect(importStatusMessage({ ...base, files: four('absent') })).toMatch(/iCloud Drive › Spartiate › sante/);
  });

  it('done avec fichiers illisibles seulement : le dit, sans parler de dossier vide', () => {
    const message = importStatusMessage({ ...base, files: four('unreadable') });
    expect(message).toMatch(/illisible|n’ont pas pu être lus/);
    expect(message).not.toMatch(/Aucun des quatre/);
  });

  it('done avec import : compte les fichiers lus et les lignes ajoutées', () => {
    const message = importStatusMessage({ ...base, files: [file('imported', 12), file('imported', 3), file('absent'), file('absent')] });
    expect(message).toContain('2 fichiers');
    expect(message).toContain('15');
  });

  it('done avec import et recalcul : la phrase du recalcul s’ajoute', () => {
    expect(importStatusMessage({ ...base, files: [file('imported', 1), ...four('absent').slice(1)], recomputedDays: 3 })).toMatch(/3 jours/);
    expect(importStatusMessage({ ...base, files: [file('imported', 1)], recomputeFailed: true })).toMatch(/calcul/i);
  });
});

describe('I5-06 : illisible dit pourquoi', () => {
  it('fichiers illisibles et nom du dossier refusé : « illisible (nom du dossier) » et la consigne de retaper sante', () => {
    const message = importStatusMessage({ ...base, files: four('unreadable'), folderIssue: 'unsafe-name' });
    expect(message).toMatch(/illisible \(nom du dossier\)/);
    expect(message).toMatch(/sante/);
  });

  it('fichiers illisibles sans raison de nom : phrase d’origine (encore dans iCloud, ou illisibles)', () => {
    expect(importStatusMessage({ ...base, files: four('unreadable') })).toMatch(/encore dans iCloud/);
    expect(importStatusMessage({ ...base, files: four('unreadable'), folderIssue: 'cloud' })).toMatch(/encore dans iCloud/);
  });
});

describe('NUTRI-0299 (BL-172, D-664) : fichier refusé faute de saut de ligne final', () => {
  it('seul ou avec des fichiers importés : la phrase nomme le raccourci « Spartiate — récupération » et ce qu’il faut y modifier', () => {
    for (const files of [four('unterminated'), [file('imported', 3), file('unterminated'), file('absent'), file('absent')]]) {
      const message = importStatusMessage({ ...base, files });
      expect(message).toMatch(/saut de ligne final/);
      expect(message).toMatch(/« Spartiate — récupération »/);
      expect(message).toMatch(/« Texte »/);
    }
  });
  it('sans fichier refusé : la phrase n’en parle pas', () => {
    expect(importStatusMessage({ ...base, files: four('imported', 1) })).not.toMatch(/saut de ligne/);
  });
});
