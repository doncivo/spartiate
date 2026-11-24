import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoTooLargeError, pickPhotoJpeg } from './picker';

/** Relecture A (C-047) : un fichier de plus de 40 Mo est refusé avant tout décodage, avec une erreur dédiée (message propre à l'écran). */
afterEach(() => vi.restoreAllMocks());

describe('pickPhotoJpeg : fichier trop gros', () => {
  it('refuse au-delà de 40 Mo avec PhotoTooLargeError, sans décoder l\'image', async () => {
    const decode = vi.fn();
    vi.stubGlobal('createImageBitmap', decode);
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [{ size: 40_000_001 }] });
      this.dispatchEvent(new Event('change'));
    });
    await expect(pickPhotoJpeg()).rejects.toBeInstanceOf(PhotoTooLargeError);
    expect(decode).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
