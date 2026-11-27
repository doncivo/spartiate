/**
 * Textes de la lecture d'un PDF dans l'import de programme (IMPORT-0303, D-676). Catalogue à part, chargé avec le bloc à la demande
 * `PdfReader` (jamais dans le départ). Une phrase par refus de la façade `src/platform/pdf` (`PdfRefusal`).
 */
export const pdfImportFr = {
  pdf: 'Lire un PDF',
  pdfReading: 'Lecture du PDF…',
  pdfDone: '{n} lignes lues dans le PDF ({pages} p.) : vérifie le texte puis analyse-le.',
  pdfDoneOne: '{n} ligne lue dans le PDF ({pages} p.) : vérifie le texte puis analyse-le.',
  pdfPrivacy: 'Le PDF est lu sur cet appareil : rien n’est envoyé ni enregistré. 10 Mo et 20 pages au plus.',
  'pdf_too-large': 'PDF trop lourd (plus de 10 Mo) : rien n’a été lu.',
  'pdf_too-many-pages': 'PDF trop long (plus de 20 pages) : rien n’a été lu. Garde les pages du programme et réessaie.',
  pdf_encrypted: 'PDF protégé par un mot de passe : rien n’a été lu. Enregistre-le sans protection, ou fais une capture de la page et lis-la comme une photo.',
  pdf_invalid: 'Ce fichier n’est pas un PDF lisible : rien n’a été lu.',
  'pdf_no-text': 'Ce PDF ne contient pas de texte (page scannée ?). Fais une capture de la page et lis-la comme une photo.',
  pdf_timeout: 'La lecture du PDF a pris plus de 20 secondes et a été arrêtée : rien n’a été lu. Garde seulement les pages du programme, ou fais une capture de la page et lis-la comme une photo.',
  pdf_unsupported: 'La lecture des PDF n’a pas pu démarrer sur cet appareil. Fais une capture de la page et lis-la comme une photo.',
} as const;
