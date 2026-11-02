import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { SHORTCUTS, type ShortcutId } from './shortcuts';
import { RESERVED_SHORTCUTS, appShortcutUsing, buildHelpGroups, formatChord, spokenChord } from './shortcutsHelp';

/**
 * Table des raccourcis clavier PC de Spartiate, figée par le test (la table a été réduite aux 5 onglets, à l'annulation, aux
 * Réglages, à l'aide et à Échap ; les raccourcis des tâches, de la Semaine, des listes et la capture rapide ont disparu).
 * Chaque cellule « Raccourci » est développée en ses combinaisons.
 */
const PRD_SECTION_5: ReadonlyArray<{ readonly shortcut: string; readonly scope: string }> = [
  { shortcut: 'Alt+1', scope: 'Application' },
  { shortcut: 'Alt+2 à Alt+5', scope: 'Application' },
  { shortcut: 'Ctrl+Z', scope: 'Application' },
  { shortcut: 'Ctrl+,', scope: 'Application' },
  { shortcut: 'Ctrl+/', scope: 'Application' },
  { shortcut: 'Échap', scope: 'Application' },
];

const SCOPE_LABEL: Record<string, string> = { global: 'Global', app: 'Application', list: 'Listes', week: 'Semaine' };

/** Développe une cellule du tableau : « Alt+2 à Alt+6 » → Alt+2…Alt+6 ; « A / B » → A, B. */
function expand(cell: string): string[] {
  const range = /^Alt\+(\d) à Alt\+(\d)$/.exec(cell);
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])];
    return Array.from({ length: to - from + 1 }, (_, i) => `Alt+${from + i}`);
  }
  return cell.split(' / ').map((part) => part.trim());
}

/** Raccourcis du registre absents de la table : aucun. */
const BEYOND_PRD: readonly ShortcutId[] = [];

describe('liste des raccourcis = PRD section 5 (P-08 critère 4)', () => {
  const ids = Object.keys(SHORTCUTS) as ShortcutId[];
  const french = (id: ShortcutId): string => formatChord(SHORTCUTS[id].keys);

  it('la table compte 6 lignes', () => {
    expect(PRD_SECTION_5).toHaveLength(6);
  });

  it('chaque combinaison de la table existe dans le registre, avec sa portée et une description', () => {
    for (const row of PRD_SECTION_5) {
      for (const chord of expand(row.shortcut)) {
        const found = ids.filter((id) => french(id) === chord);
        expect(found, `« ${chord} » absente du registre`).toHaveLength(1);
        const id = found[0] as ShortcutId;
        expect(row.scope.startsWith(SCOPE_LABEL[SHORTCUTS[id].scope] ?? '?'), `${chord} : portée ${row.scope}`).toBe(true);
        expect(t(SHORTCUTS[id].descriptionKey).length).toBeGreaterThan(0);
      }
    }
  });

  it('le registre ne contient rien d’autre que la table', () => {
    const prd = new Set(PRD_SECTION_5.flatMap((row) => expand(row.shortcut)));
    const extra = ids.filter((id) => !prd.has(french(id)));
    expect(extra.sort()).toEqual([...BEYOND_PRD].sort());
  });
});

describe('formatChord et spokenChord (P-08 critères 2 et 9)', () => {
  it('écrit les touches en français', () => {
    expect(formatChord('Ctrl+Shift+F')).toBe('Ctrl+Maj+F');
    expect(formatChord('Delete')).toBe('Suppr');
    expect(formatChord('Enter')).toBe('Entrée');
    expect(formatChord('Escape')).toBe('Échap');
    expect(formatChord('Space')).toBe('Espace');
    expect(formatChord('Ctrl+ArrowLeft')).toBe('Ctrl+←');
    expect(formatChord('Ctrl+,')).toBe('Ctrl+,');
  });

  it('annonce « Contrôle plus Maj plus F »', () => {
    expect(spokenChord('Ctrl+Shift+F')).toBe('Contrôle plus Maj plus F');
    expect(spokenChord('Ctrl+/')).toBe('Contrôle plus barre oblique');
    expect(spokenChord('Alt+ArrowUp')).toBe('Alt plus flèche haut');
  });
});

describe('buildHelpGroups', () => {
  const labels = (input: Parameters<typeof buildHelpGroups>[0]) => buildHelpGroups(input).map((g) => g.label);
  const idsOf = (input: Parameters<typeof buildHelpGroups>[0]) => buildHelpGroups(input).flatMap((g) => g.entries).map((e) => e.id);

  it('groupe par portée : seul le groupe Application subsiste', () => {
    expect(labels({ activeIds: [] })).toEqual(['Application']);
  });

  it('aucun raccourci n’est réservé : plus de mention « bientôt », aucun n’est grisé', () => {
    expect(RESERVED_SHORTCUTS).toEqual([]);
    const entries = buildHelpGroups({ activeIds: [] }).flatMap((g) => g.entries);
    expect(entries).toHaveLength(Object.keys(SHORTCUTS).length);
    for (const entry of entries) expect(entry).toMatchObject({ note: null, dimmed: false });
    expect(entries.find((e) => e.id === 'app.undo')).toMatchObject({ keys: 'Ctrl+Z' });
  });

  it('la recherche instantanée restreint la liste, sans tenir compte des accents ni de la casse (critère 7)', () => {
    const found = idsOf({ activeIds: [], query: 'REGLAGES' });
    expect(found).toContain('app.settings');
    expect(found).not.toContain('app.undo');
    expect(buildHelpGroups({ activeIds: [], query: 'zzzz' })).toEqual([]);
    expect(idsOf({ activeIds: [], query: 'ctrl+z' })).toEqual(['app.undo']);
    expect(idsOf({ activeIds: [], query: 'alt+' })).toEqual([
      'app.tab.today',
      'app.tab.training',
      'app.tab.nutrition',
      'app.tab.progress',
      'app.tab.more',
    ]);
  });

  it('chaque entrée porte une description et des touches annoncées', () => {
    for (const entry of buildHelpGroups({ activeIds: [] }).flatMap((g) => g.entries)) {
      expect(entry.description).not.toBe('');
      expect(entry.spoken).not.toBe('');
    }
  });
});

describe('appShortcutUsing (D-04 critère 6)', () => {
  it('repère une combinaison déjà prise par l’application', () => {
    expect(appShortcutUsing('Ctrl+Z')).toBe('app.undo');
    expect(appShortcutUsing('Ctrl+/')).toBe('app.shortcutsHelp');
    expect(appShortcutUsing('Alt+3')).toBe('app.tab.nutrition');
  });

  it('ignore les combinaisons libres', () => {
    expect(appShortcutUsing('Ctrl+K')).toBeNull();
    expect(appShortcutUsing('Ctrl+Shift+Space')).toBeNull();
    expect(appShortcutUsing('pas une combinaison')).toBeNull();
  });
});
