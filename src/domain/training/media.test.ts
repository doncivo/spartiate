import { describe, expect, it } from 'vitest';
import { exerciseImage } from './media';

// I6-07 : lecture pure du champ `media` d'un exercice (§ 14.1) : une image, sa source ; sinon aucun média (repli, D-71).
describe('exerciseImage', () => {
  it('rend le fichier et l’identifiant de source d’un média image', () => {
    expect(exerciseImage({ images: ['bench-press-barbell.png'], video: null, license: 'CC-BY-SA-4.0', source: 'everkinetic:dist/png/0042-tension.png' })).toEqual({
      file: 'bench-press-barbell.png',
      sourceId: 'everkinetic',
      license: 'CC-BY-SA-4.0',
    });
  });

  it('rend null sans média, sans image, ou avec une source sans identifiant', () => {
    expect(exerciseImage(null)).toBeNull();
    expect(exerciseImage({ images: [], video: 'x.mp4', license: 'CC0-1.0', source: 'everkinetic:x' })).toBeNull();
    expect(exerciseImage({ images: ['x.png'], video: null, license: 'CC0-1.0', source: ':x' })).toBeNull();
    expect(exerciseImage({ images: ['x.png'], video: null, license: 'CC0-1.0', source: 'sans-separateur' })).toBeNull();
  });
});
