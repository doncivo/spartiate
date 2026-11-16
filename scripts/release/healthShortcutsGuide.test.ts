// DOC-H21 (lot 0.26.0, D-293, D-294) : le guide des raccourcis Santé et la matrice suivent les constats d'Ali du 14/11.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const guide = readFileSync('docs/guide-raccourcis-sante.md', 'utf8');
const matrix = readFileSync('docs/capability-matrix.md', 'utf8');
const row = (needle: string): string => matrix.split('\n').find((l) => l.includes(needle)) ?? '';

describe('guide des raccourcis Santé (DOC-H21)', () => {
  it('nomme le type « Indice de masse grasse » et plus « Pourcentage de graisse corporelle »', () => {
    expect(guide).toContain('Indice de masse grasse');
    expect(guide).not.toMatch(/Type Santé\*\* : Pourcentage de graisse corporelle/);
    expect(guide).not.toMatch(/\| Pourcentage de graisse corporelle \|/);
  });
  it('filtre Source = Apple Watch sur HRV, FC repos et sommeil, jamais sur les pas', () => {
    expect(guide).toMatch(/Blocs 1 à 3 \(HRV, FC de repos, sommeil\).{0,80}\*\*Source\*\* · \*\*est\*\* · \*\*Apple Watch\*\*/s);
    expect(guide).toMatch(/jamais sur les pas/);
  });
  it('une automatisation « Lorsque Spartiate est ouverte » lance les deux raccourcis, plus d’heure fixe', () => {
    expect(guide).toMatch(/B\.3 Automatisation « Lorsque Spartiate est ouverte »/);
    expect(guide).toMatch(/Exécuter le raccourci\*\* →\s+« Spartiate — corps et nutrition »/);
    expect(guide).not.toMatch(/\*\*Heure de la journée\*\* → \d\d:\d\d/);
  });
  it('avertit que « Formater la date » doit pointer « Date de début » avec « Grouper par »', () => {
    expect(guide).toMatch(/Grouper par.{0,200}Formater la date.{0,120}Date de début.{0,200}deux dates/s);
  });
  it('marque la nutrition facultative (décision d’Ali du 15/11)', () => {
    expect(guide).toMatch(/Blocs 6 à 10 — nutrition \(facultatifs, déconseillés\)/);
    for (const f of ['energie', 'proteines', 'glucides', 'lipides', 'fibres']) expect(guide).toContain('| `' + f + '.csv` (facultatif) |');
  });
  it('écrit les exemples avec la décimale au point (H-21)', () => {
    expect(guide).toContain('+01:00;81.4;kg');
    expect(guide).toContain('+01:00;[retiré];%');
    expect(guide).not.toContain(';81,4;kg');
  });
});

describe('matrice des capacités (DOC-H21)', () => {
  it('H-21, H-22 à H-24, H-28 et H-29 CONFIRMED ; H-25 UNVERIFIED ; H-30, H-31 et IA sans objet', () => {
    expect(row('(H-21,')).toMatch(/\| CONFIRMED \|/);
    expect(row('(H-22 à H-25,')).toMatch(/CONFIRMED pour H-22, H-23, H-24 ; UNVERIFIED pour H-25/);
    expect(row('(H-28 et H-29,')).toMatch(/\| CONFIRMED/);
    expect(row('(H-30)')).toMatch(/\| DEFERRED \(sans objet\) \|/);
    expect(row('(H-14)')).toMatch(/Q-2 tranchée : aucun/);
  });
});
