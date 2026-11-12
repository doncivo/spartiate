import { PHOTO_MAX_BYTES, photoTargetSize } from '../../domain/bodyProgress/measurements';

/**
 * Choix d'une photo de progression (I6-02, D-99) par le sélecteur d'image du navigateur intégré (`<input type="file" accept="image/*">`) : sur iPhone,
 * la photothèque ou l'appareil photo ; sur PC, la boîte « Ouvrir ». Aucune commande native, aucun envoi : l'image est lue en mémoire, réduite
 * (côté le plus grand borné) et recodée en JPEG par un canevas, ce qui retire aussi les métadonnées d'origine (position GPS comprise).
 *
 * Rend les octets du JPEG réduit, `null` si l'utilisateur annule ; rejette si l'image est illisible ou ne tient pas dans `PHOTO_MAX_BYTES`.
 * Non vérifié sur appareil (H-27) : le comportement du sélecteur de WKWebView sous SideStore reste à constater par Ali.
 */

const QUALITIES = [0.82, 0.7, 0.55] as const;

function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('encodage JPEG impossible'));
        else blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function pickPhotoJpeg(): Promise<Uint8Array | null> {
  const file = await chooseFile();
  if (!file) return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const size = photoTargetSize(bitmap.width, bitmap.height);
    if (!size) throw new Error('dimensions invalides');
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canevas indisponible');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    for (const quality of QUALITIES) {
      const bytes = await toJpeg(canvas, quality);
      if (bytes.length <= PHOTO_MAX_BYTES) return bytes;
    }
    throw new Error('image trop lourde après réduction');
  } finally {
    bitmap.close();
  }
}
