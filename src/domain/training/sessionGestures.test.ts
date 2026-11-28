import { describe, expect, it } from 'vitest';
import { GESTURE_SLOP_PX, LONG_PRESS_MS, SWIPE_DELETE_PX, dropIndex, lockAxis, swipeOffset, swipeOutcome, withinSlop } from './sessionGestures';

/**
 * GEST-0303 (BL-169, D-653, § 18.1) : seuils et calculs purs des deux gestes iPhone de la séance active. Glisser une série vers la gauche au-delà
 * du seuil la supprime ; en deçà, retour élastique ; un défilement vertical ne supprime jamais. Appui long sur un exercice : place d'insertion
 * calculée depuis la position verticale du doigt. Valeurs inventées.
 */
describe('GEST-0303 : seuils', () => {
  it('seuils fixés : 10 px avant de choisir un axe, 96 px vers la gauche pour supprimer, 500 ms d’appui long', () => {
    expect(GESTURE_SLOP_PX).toBe(10);
    expect(SWIPE_DELETE_PX).toBe(96);
    expect(LONG_PRESS_MS).toBe(500);
  });
});

describe('GEST-0303 : axe du geste', () => {
  it('sous le seuil de déplacement, l’axe reste à choisir', () => {
    expect(lockAxis('pending', 0, 0)).toBe('pending');
    expect(lockAxis('pending', -9, 9)).toBe('pending');
  });

  it('au-delà du seuil : horizontal si le déplacement est surtout horizontal, vertical sinon (égalité : vertical, le défilement l’emporte)', () => {
    expect(lockAxis('pending', -30, 5)).toBe('horizontal');
    expect(lockAxis('pending', 25, -3)).toBe('horizontal');
    expect(lockAxis('pending', -12, 40)).toBe('vertical');
    expect(lockAxis('pending', -20, -20)).toBe('vertical');
  });

  it('un axe choisi ne change plus pendant le geste (un défilement vertical qui part ensuite à gauche ne devient pas une suppression)', () => {
    expect(lockAxis('vertical', -300, 2)).toBe('vertical');
    expect(lockAxis('horizontal', -1, 300)).toBe('horizontal');
  });

  it('valeurs non finies : axe à choisir', () => {
    expect(lockAxis('pending', Number.NaN, 50)).toBe('pending');
    expect(lockAxis('pending', -50, Number.POSITIVE_INFINITY)).toBe('pending');
  });

  it('seuil propre accepté', () => {
    expect(lockAxis('pending', -15, 0, 20)).toBe('pending');
    expect(lockAxis('pending', -25, 0, 20)).toBe('horizontal');
  });
});

describe('GEST-0303 : glisser une série vers la gauche', () => {
  it('décalage affiché : vers la gauche seulement, et seulement sur l’axe horizontal', () => {
    expect(swipeOffset('horizontal', -40)).toBe(-40);
    expect(swipeOffset('horizontal', 40)).toBe(0);
    expect(swipeOffset('vertical', -40)).toBe(0);
    expect(swipeOffset('pending', -8)).toBe(0);
    expect(swipeOffset('horizontal', Number.NaN)).toBe(0);
  });

  it('au-delà du seuil (compris) : suppression ; en deçà : retour élastique', () => {
    expect(swipeOutcome('horizontal', -SWIPE_DELETE_PX)).toBe('delete');
    expect(swipeOutcome('horizontal', -200)).toBe('delete');
    expect(swipeOutcome('horizontal', -SWIPE_DELETE_PX + 1)).toBe('return');
    expect(swipeOutcome('horizontal', -20)).toBe('return');
  });

  it('jamais de suppression vers la droite, par un défilement vertical ni avant le choix de l’axe', () => {
    expect(swipeOutcome('horizontal', 300)).toBe('return');
    expect(swipeOutcome('vertical', -300)).toBe('return');
    expect(swipeOutcome('pending', -300)).toBe('return');
    expect(swipeOutcome('horizontal', Number.NaN)).toBe('return');
  });

  it('seuil propre accepté', () => {
    expect(swipeOutcome('horizontal', -60, 50)).toBe('delete');
    expect(swipeOutcome('horizontal', -40, 50)).toBe('return');
  });
});

describe('GEST-0303 : appui long sur un exercice', () => {
  it('le doigt reste dans le seuil : l’appui long continue ; au-delà, c’est un défilement (appui annulé)', () => {
    expect(withinSlop(0, 0)).toBe(true);
    expect(withinSlop(6, -7)).toBe(true);
    expect(withinSlop(0, 12)).toBe(false);
    expect(withinSlop(-11, 0)).toBe(false);
    expect(withinSlop(Number.NaN, 0)).toBe(false);
    expect(withinSlop(15, 0, 20)).toBe(true);
  });

  // Trois exercices empilés : 0–100, 100–200, 200–300 (milieux 50, 150, 250).
  const spans = [
    { top: 0, bottom: 100 },
    { top: 100, bottom: 200 },
    { top: 200, bottom: 300 },
  ];

  it('place d’insertion : nombre des autres exercices dont le milieu est au-dessus du doigt', () => {
    expect(dropIndex(spans, 2, 40)).toBe(0);
    expect(dropIndex(spans, 2, 60)).toBe(1);
    expect(dropIndex(spans, 2, 160)).toBe(2);
    expect(dropIndex(spans, 0, 140)).toBe(0);
    expect(dropIndex(spans, 0, 160)).toBe(1);
    expect(dropIndex(spans, 0, 260)).toBe(2);
    expect(dropIndex(spans, 1, -500)).toBe(0);
    expect(dropIndex(spans, 1, 5000)).toBe(2);
  });

  it('position non finie : place d’origine (rien ne bouge) ; liste vide ou exercice soulevé absent : première place', () => {
    expect(dropIndex(spans, 1, Number.NaN)).toBe(1);
    expect(dropIndex([], 0, 10)).toBe(0);
    expect(dropIndex(spans, 7, 10)).toBe(0);
    expect(dropIndex(spans, -1, 10)).toBe(0);
  });

  it('déterministe : mêmes entrées, même place ; ordre des boîtes non trié accepté', () => {
    const shuffled = [spans[2], spans[0], spans[1]].filter((s): s is { top: number; bottom: number } => s !== undefined);
    // L'exercice soulevé est le premier de la liste (200–300) ; les autres, milieux 50 et 150.
    expect(dropIndex(shuffled, 0, 100)).toBe(1);
    expect(dropIndex(shuffled, 0, 100)).toBe(dropIndex(shuffled, 0, 100));
  });
});
