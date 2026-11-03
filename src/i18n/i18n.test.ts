import { describe, expect, it } from 'vitest';
import { getLocale, t, translate } from './index';

describe('i18n', () => {
  it('le français est la langue par défaut', () => {
    expect(getLocale()).toBe('fr');
    expect(t('app.name')).toBe('Spartiate');
    expect(t('app.loading')).toBe('Chargement…');
  });

  it('interpole les paramètres', () => {
    expect(t('app.version', { version: '0.1.0' })).toBe('Version 0.1.0');
    expect(translate('fr', 'app.version', { version: 2 })).toBe('Version 2');
  });

  it('laisse visible un paramètre manquant et une clé inconnue', () => {
    const loose = translate as (locale: 'fr', key: string, params?: Record<string, string>) => string;
    expect(loose('fr', 'app.version', {})).toBe('Version {version}');
    expect(loose('fr', 'inconnu.cle')).toBe('inconnu.cle');
    expect(loose('fr', 'app')).toBe('app');
  });
});
