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
    { name: 'Recharts', licence: 'MIT', detail: 'Graphiques ; dépendances d3 sous licences MIT ou ISC.' },
    {
      name: 'd3-ease',
      licence: 'BSD-3-Clause',
      detail: 'Easing des graphiques. L’avis de copyright, les conditions et l’avertissement de la licence sont reproduits en entier ci-dessous, comme elle l’exige.',
    },
    { name: 'qrcode-generator', licence: 'MIT', detail: 'Copyright Kazuhiko Arase. Dessin du QR code d’association. « QR Code » est une marque déposée de DENSO WAVE INCORPORATED.' },
    { name: 'Ciqual (Anses)', licence: 'Licence Ouverte Etalab 2.0', detail: 'Table de composition nutritionnelle des aliments Ciqual 2025, publiée par l’Anses.' },
    { name: 'keyring, reqwest, url, sha2, rand, base64', licence: 'MIT ou Apache-2.0', detail: 'Coffre système, requêtes réseau et utilitaires de la synchronisation.' },
    { name: 'aws-lc-rs', licence: 'ISC et (Apache-2.0 ou ISC)', detail: 'Chiffrement AES-256-GCM, HKDF et SHA-256 des journaux de synchro (bibliothèque aws-lc-sys : ISC, Apache-2.0, MIT, BSD-3-Clause).' },
    { name: 'zeroize, security-framework, windows', licence: 'MIT ou Apache-2.0', detail: 'Effacement des clés, Trousseau iOS et API Windows.' },
    { name: 'tauri-plugin-geolocation, tauri-plugin-dialog', licence: 'MIT ou Apache-2.0', detail: 'Plugins officiels Tauri (GPS du cardio sur iPhone, boîte « Enregistrer sous » sur PC).' },
  ],
} as const;

/** Texte intégral de node_modules/d3-ease/LICENSE (BSD-3-Clause, anglais : texte juridique) ; `LicensesScreen.test.tsx` le compare au fichier. */
export const d3EaseNotice = "Copyright 2010-2021 Mike Bostock\nCopyright 2001 Robert Penner\nAll rights reserved.\n\nRedistribution and use in source and binary forms, with or without modification,\nare permitted provided that the following conditions are met:\n\n* Redistributions of source code must retain the above copyright notice, this\n  list of conditions and the following disclaimer.\n\n* Redistributions in binary form must reproduce the above copyright notice,\n  this list of conditions and the following disclaimer in the documentation\n  and/or other materials provided with the distribution.\n\n* Neither the name of the author nor the names of contributors may be used to\n  endorse or promote products derived from this software without specific prior\n  written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS \"AS IS\" AND\nANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED\nWARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE\nDISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR\nANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES\n(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;\nLOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON\nANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS\nSOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n";

