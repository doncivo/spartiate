import { describe, expect, it } from 'vitest';
import { hidePhotoId, parseHiddenPhotoIds, photoActions, showAllPhotos } from './photos';

/**
 * FIX-0171 (décision d'Ali du 12/11/2026, D-121) : le fichier d'une photo ne se supprime que sur l'appareil qui le détient, avec confirmation ; un
 * appareil sans le fichier ne peut que masquer la fiche chez lui (réglage local, jamais publié) ; une suppression reçue n'efface jamais le fichier.
 */
describe('photoActions', () => {
  it('fichier ici : supprimer (avec confirmation), jamais masquer', () => {
    expect(photoActions({ hasFile: true, deletedElsewhere: false })).toEqual({ canDelete: true, canHide: false, deletedElsewhere: false });
  });
  it('fichier ici, fiche supprimée ailleurs : dite comme telle, suppression locale encore possible', () => {
    expect(photoActions({ hasFile: true, deletedElsewhere: true })).toEqual({ canDelete: true, canHide: false, deletedElsewhere: true });
  });
  it('sans fichier (PC) : seulement masquer sur cet appareil', () => {
    expect(photoActions({ hasFile: false, deletedElsewhere: false })).toEqual({ canDelete: false, canHide: true, deletedElsewhere: false });
  });
});

describe('fiches masquées sur cet appareil', () => {
  it('valeur absente, illisible ou mal formée : aucune fiche masquée', () => {
    for (const raw of [null, undefined, 'x', 3, {}, [1, 2], ['']]) expect(parseHiddenPhotoIds(raw)).toEqual([]);
  });
  it('liste lue triée, sans doublon ; masquer ajoute une fois ; tout réafficher vide la liste', () => {
    expect(parseHiddenPhotoIds(['b', 'a', 'b'])).toEqual(['a', 'b']);
    expect(hidePhotoId(['a'], 'c')).toEqual(['a', 'c']);
    expect(hidePhotoId(['a', 'c'], 'c')).toEqual(['a', 'c']);
    expect(showAllPhotos()).toEqual([]);
  });
  it('identifiant trop long : ignoré', () => {
    expect(parseHiddenPhotoIds(['a'.repeat(65), 'ok'])).toEqual(['ok']);
  });
});
