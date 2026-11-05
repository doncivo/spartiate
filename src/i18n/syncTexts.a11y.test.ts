// Ordre 4 : accessibilité et parité des textes de synchro (fenêtre `pairing` comprise, que le test général de i18n.test.ts ne couvre pas).
import { describe, expect, it } from 'vitest';
import { fr } from './fr';
import { syncPairingWindowFr } from './fr.syncPairing';

type Tree = { readonly [key: string]: string | Tree };

function flatten(node: Tree, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(node).flatMap(([key, value]) => (typeof value === 'string' ? [[`${prefix}${key}`, value]] : Object.entries(flatten(value, `${prefix}${key}.`)))));
}

describe('textes de synchro : fenêtre pairing', () => {
  const frFlat = flatten(syncPairingWindowFr as unknown as Tree);

  it('aucun texte français vide', () => {
    for (const [key, text] of Object.entries(frFlat)) expect(text.trim(), key).not.toBe('');
  });

  it('la fenêtre est celle du PC : aucune consigne « touche » (souris et clavier)', () => {
    for (const text of Object.values(frFlat)) expect(text).not.toMatch(/touche[zr]/i);
  });
});

describe('textes de synchro : cohérence des libellés', () => {
  it('aucun jargon technique dans les messages affichés (époque excepté, voir rapport)', () => {
    const sync = flatten(fr.sync as unknown as Tree);
    for (const [key, text] of Object.entries(sync)) expect(text, key).not.toMatch(/budget de la clé|key budget|déclaration n’a pas pu être apprise|declaration could not be learned/i);
  });

  it('chaque nom accessible d’un bouton à libellé court contient son libellé visible (WCAG 2.5.3), hors écarts connus', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['sync.folder.choose', 'sync.folder.chooseLabel'],
      ['sync.folder.forget', 'sync.folder.forgetLabel'],
      ['sync.pairing.importAction', 'sync.pairing.importLabel'],
      ['sync.pairing.show', 'sync.pairing.showLabel'],
      ['sync.pairing.retry', 'sync.pairing.retryLabel'],
      ['sync.forget.rejoin', 'sync.forget.rejoinLabel'],
      ['sync.reset.action', 'sync.reset.actionLabel'],
      ['sync.reset.dismiss', 'sync.reset.dismissLabel'],
      ['sync.reset.retry', 'sync.reset.retryLabel'],
      ['sync.reset.syncFirst', 'sync.reset.syncFirstLabel'],
      ['sync.conflicts.restore', 'sync.conflicts.restoreLabel'],
      ['status.syncTroubleView', 'status.syncTroubleViewLabel'],
      ['status.syncTroubleView', 'status.signingViewLabel'],
      ['signing.about.allow', 'signing.about.allowLabel'],
      ['signing.about.viewReminders', 'signing.about.viewRemindersLabel'],
    ];
    for (const catalog of [fr]) {
      const flat = flatten(catalog as unknown as Tree);
      for (const [visible, label] of pairs) expect((flat[label] ?? '').toLowerCase(), label).toContain((flat[visible] ?? '').toLowerCase());
    }
  });
});
