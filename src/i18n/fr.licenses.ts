/**
 * « À propos et licences » (§ 18.2 c, C-119) : catalogue à part, chargé avec l'écran (hors du bundle de départ).
 * Source : docs/licences.md ; un ajout de ressource là-bas s'ajoute ici (`LicensesScreen.test.tsx`).
 */
export const licencesFr = {
  title: 'Licences',
  back: 'Retour à Plus',
  intro: 'Polices, icônes, données et bibliothèques embarquées dans Spartiate. Rien n’est chargé depuis Internet pour les polices et les icônes.',
  items: [
    { name: 'Cinzel', licence: 'SIL Open Font License 1.1 (OFL)', detail: 'Police des titres et des grands chiffres. Copyright The Cinzel Project Authors.' },
    { name: 'Lucide', licence: 'ISC', detail: 'Icônes au trait de l’interface (lucide-react).' },
    { name: 'qrcode-generator', licence: 'MIT', detail: 'Copyright Kazuhiko Arase. Dessin du QR code d’association. « QR Code » est une marque déposée de DENSO WAVE INCORPORATED.' },
    { name: 'Ciqual (Anses)', licence: 'Licence Ouverte Etalab 2.0', detail: 'Table de composition nutritionnelle des aliments Ciqual 2025, publiée par l’Anses.' },
    { name: 'keyring, reqwest, url, sha2, rand, base64', licence: 'MIT ou Apache-2.0', detail: 'Coffre système, requêtes réseau et utilitaires de la synchronisation.' },
    { name: 'aws-lc-rs', licence: 'ISC et (Apache-2.0 ou ISC)', detail: 'Chiffrement AES-256-GCM, HKDF et SHA-256 des journaux de synchro (bibliothèque aws-lc-sys : ISC, Apache-2.0, MIT, BSD-3-Clause).' },
    { name: 'zeroize, security-framework, windows', licence: 'MIT ou Apache-2.0', detail: 'Effacement des clés, Trousseau iOS et API Windows.' },
    { name: 'tauri-plugin-geolocation, tauri-plugin-dialog', licence: 'MIT ou Apache-2.0', detail: 'Plugins officiels Tauri (GPS du cardio sur iPhone, boîte « Enregistrer sous » sur PC).' },
  ],
} as const;
