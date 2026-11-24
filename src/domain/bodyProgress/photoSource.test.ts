import { describe, expect, it } from 'vitest';
import { PHOTO_SOURCE_MAX_BYTES, photoSourceAccepted } from './measurements';

/** NUTRI-0292 (C-047) : plafond de taille du fichier source, avant tout décodage. */
describe('photoSourceAccepted', () => {
  it('un fichier raisonnable est accepté, le plafond compris', () => {
    expect(photoSourceAccepted(3_000_000)).toBe(true);
    expect(photoSourceAccepted(PHOTO_SOURCE_MAX_BYTES)).toBe(true);
  });
  it('un fichier plus gros, vide ou de taille invalide est refusé', () => {
    expect(photoSourceAccepted(PHOTO_SOURCE_MAX_BYTES + 1)).toBe(false);
    expect(photoSourceAccepted(0)).toBe(false);
    expect(photoSourceAccepted(Number.NaN)).toBe(false);
  });
});
