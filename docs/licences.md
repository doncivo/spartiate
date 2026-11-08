# Licences — polices et icônes embarquées (PREP-04)

Toutes ces ressources sont embarquées dans l'app (fichiers locaux inclus dans `dist/` puis
dans le bundle Tauri) : aucune n'est chargée depuis Internet au moment de l'exécution.

## Cinzel

- Rôle : capitales romaines des titres et des grands chiffres (`--ct-font-title`), une seule graisse (600) ; charte § 18.4 du PRD.
- Paquet : [`@fontsource/cinzel`](https://www.npmjs.com/package/@fontsource/cinzel).
- Licence : SIL Open Font License 1.1 (OFL).
- Copyright : The Cinzel Project Authors (github.com/NDISCOVER/Cinzel).
- Fichiers embarqués : `cinzel-latin-600-normal.woff2`, `cinzel-latin-ext-600-normal.woff2` (sous-ensembles latin et latin-ext seulement).
- Texte complet de la licence : `node_modules/@fontsource/cinzel/LICENSE`.
- Le corps de texte utilise la police du système (SF Pro, Segoe UI) : aucune police embarquée pour lui. Fraunces et DM Sans (PREP-04) sont retirées.

## Lucide

- Rôle : icônes au trait des maquettes (`src/ui/Icon.tsx`), importées nommément par
  composant pour permettre le tree-shaking.
- Paquet : [`lucide-react`](https://www.npmjs.com/package/lucide-react).
- Licence : ISC.
- Texte complet de la licence : `node_modules/lucide-react/LICENSE`.

## Rappel OFL

La licence SIL OFL autorise l'intégration et la redistribution des polices avec le
logiciel, à condition de conserver la mention de copyright et le texte de la licence
(ce que fait ce document) et de ne pas vendre les polices seules. CircleTasks ne
redistribue pas les fichiers de police séparément de l'application.

# Licences — dépendances Rust des agendas externes (K-01, ADR 0008)

- `keyring` 3 (coffre système : Gestionnaire d'identification Windows, Trousseau iOS) : MIT OU Apache-2.0.
- `reqwest` 0.13 avec `rustls` (HTTP des agendas, déjà compilé par l'updater) : MIT OU Apache-2.0.
- `url`, `sha2`, `rand`, `base64` (analyse d'URL, PKCE) : MIT OU Apache-2.0.

# Licence — chrono-node (Q-02, ADR 0001 avenant)

- Paquet : [`chrono-node`](https://www.npmjs.com/package/chrono-node) 2.10, licence MIT (copyright Wanasit Tanakitrungruang).
- Usage : lecture des dates absolues et de "dans N jours" dans la saisie rapide, locale française seule (`src/domain/naturalDate.ts`).
- Texte complet de la licence : `node_modules/chrono-node/LICENSE`.

# Licence — carillon de fin de session Focus (F-04 D4)

- Fichier : `src/features/focus/assets/focus-end.wav` (22 050 Hz, mono, 16 bits, 1,6 s, environ 70 Ko).
- Origine : synthétisé par `scripts/generate-focus-chime.mjs` (partiels de cloche à décroissance exponentielle) ; œuvre originale du projet, sans échantillon tiers, placée dans le domaine public (CC0). Aucune attribution requise.
- Lu par un élément `Audio` au volume du système (`src/platform/focus/sound.ts`), jamais par une API Rust ; aucune notification Windows.

# Licences — lecture de texte des images (Q-04, PRD sections 7 et 10)

- Windows.Media.Ocr (PC) : API du système (Windows 10 et 11), via la crate `windows` 0.62 (MIT OU Apache-2.0, déjà compilée par Tauri) ; aucune donnée embarquée. Le pack de langue français est installé par l'utilisateur (Paramètres Windows).
- Repli hors ligne, embarqué (PC et iPhone), chargé à la demande :
  - [`tesseract.js`](https://www.npmjs.com/package/tesseract.js) 7.0.0, licence **Apache-2.0** (worker `worker.min.js`, 111 Ko).
  - [`tesseract.js-core`](https://www.npmjs.com/package/tesseract.js-core) 7.x, licence **Apache-2.0** : noyau WebAssembly Tesseract (LSTM seul, SIMD) `tesseract-core-simd-lstm.wasm.js`, 3,9 Mo (1,5 Mo compressé).
  - [`@tesseract.js-data/fra`](https://www.npmjs.com/package/@tesseract.js-data/fra) 1.0.0, paquet MIT ; données `4.0.0_best_int/fra.traineddata.gz` (modèle « best » quantifié de Tesseract, Apache-2.0), 0,7 Mo.
  - Les fichiers sont copiés de `node_modules` dans `dist/ocr/` par le plugin Vite `vite.ocrAssets.ts` (aucun binaire versionné) et ne sont jamais téléchargés d'Internet (`cacheMethod: 'none'`, aucun cache disque).
  - Poids ajouté à l'installeur : environ 2,3 Mo compressés (PRD section 8 : installeur sous 15 Mo). Les autres variantes du noyau (sans SIMD, legacy) ne sont pas embarquées.
- Textes complets : `node_modules/tesseract.js/LICENSE.md`, `node_modules/tesseract.js-core/LICENSE`.

# Licence — Recharts (H-02 D4)

- Paquet : [`recharts`](https://www.npmjs.com/package/recharts) 3.10, licence **MIT** ; dépendances transitives (`victory-vendor` d3, `@reduxjs/toolkit`, `immer`, `reselect`, `decimal.js-light`) sous licences MIT ou ISC.
- Usage : graphique en barres « taux de complétion par semaine » du rapport du mois (`src/features/stats/CompletionChart.tsx`), chargé à la demande par import dynamique (jamais dans le paquet de départ).
- Texte complet de la licence : `node_modules/recharts/LICENSE`.
- `victory-vendor` (copie des modules d3 utilisés) : licence **MIT AND ISC** (d3-array, d3-scale, d3-shape, d3-time, d3-interpolate, d3-color, d3-format, d3-path, d3-timer : ISC).
- `d3-ease` : licence **BSD-3-Clause** (Copyright 2010-2021 Mike Bostock, Copyright 2001 Robert Penner). Cette licence demande de conserver l'avis de copyright, la liste des conditions et l'avertissement dans la documentation fournie avec le logiciel : le texte complet est dans `node_modules/d3-ease/LICENSE` ; il doit rester reproduit dans les mentions de licences de l'application. Les noms des auteurs ne servent pas à promouvoir l'application.

# Licences — export de fichiers (H-03)

- Aucun plugin Tauri dialog ni fs côté WebView : « Enregistrer sous » est ouvert et le fichier écrit par Rust. Seule la crate `tauri-plugin-dialog` (MIT OU Apache-2.0, projet Tauri, PC Windows uniquement) sert à ouvrir la boîte depuis Rust ; `tauri-plugin-opener` (déjà présent) affiche le fichier dans le dossier.
- Aucune dépendance pour le PDF ni le PNG (dessin canvas, PDF minimal écrit par `src/domain/pdfDocument.ts`).

# Licences — dépendances Rust de la synchronisation (Y-08, ADR 0011 section 2)

Ajoutées en dépendances directes **sans nouvelle entrée dans `Cargo.lock`** (déjà compilées par les dépendances existantes ; seule la liste des dépendances du paquet `circletasks` change) :

- `aws-lc-rs` 1.18 (AES-256-GCM par `RandomizedNonceKey`, HKDF-SHA256, SHA-256, aléa système), fonctionnalités `aws-lc-sys` et `alloc` seulement : licence **ISC ET (Apache-2.0 OU ISC)** ; déjà fournisseur de `rustls` (via `reqwest`). Bibliothèque C embarquée `aws-lc-sys` 0.45 : ISC, Apache-2.0, MIT, BSD-3-Clause (fichiers d'origine OpenSSL / BoringSSL), voir le dépôt `aws/aws-lc`.
- `zeroize` 1.9 (effacement des tampons de clé) : MIT OU Apache-2.0 ; déjà tirée par `keyring` et `aws-lc-rs`.
- `security-framework` 3.7, **cible iOS seulement** (clé de synchro au Trousseau avec `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, non synchronisée) : MIT OU Apache-2.0 ; même version que celle déjà compilée pour iOS par `rustls-platform-verifier` (`cargo tree --target aarch64-apple-ios -i security-framework@3.7.0`).
- `windows` 0.62 : fonctionnalités ajoutées (`Win32_Security`, `Win32_System_IO`, `Win32_Storage_FileSystem`, `Win32_Storage_CloudFilters`, `Win32_UI_Controls`, `Wdk_Foundation`, `Wdk_Storage_FileSystem`), même crate, même licence (MIT OU Apache-2.0).

# Licence — qrcode-generator (Y-06, ADR 0011 section 10.3)

- Paquet : [`qrcode-generator`](https://www.npmjs.com/package/qrcode-generator) **2.0.4** (version exacte), licence **MIT** (copyright Kazuhiko Arase), sans aucune dépendance.
- Usage : dessin du QR code d'association dans la seule fenêtre `pairing` (`src/features/sync/pairing-window/PairingView.tsx`), chargé à la demande ; absent du bundle principal et du bundle `capture` (contrôlé par `npm run test:bundle`, `tests/bundle/pairingBundle.test.ts`).
- Avis de licence : en tête de `node_modules/qrcode-generator/dist/qrcode.d.ts` et de `dist/qrcode.mjs` (le paquet ne fournit pas de fichier `LICENSE` séparé). « QR Code » est une marque déposée de DENSO WAVE INCORPORATED.

# Licence — table Ciqual de l'Anses (I4-02, H-11)

- Donnée : **Table de composition nutritionnelle des aliments Ciqual 2025** (3 484 aliments), publiée par l'Anses (Observatoire des aliments) sur Recherche Data Gouv, **DOI 10.57745/RDMHWY**, version 1.0 du 2025-11-19 (fichiers du 2025-11-03). Licence indiquée par l'entrepôt : **Licence Ouverte Etalab 2.0** (SPDX `etalab-2.0`), qui autorise la réutilisation, y compris commerciale, sous réserve de mentionner la source et la date de la dernière mise à jour.
- Édition retenue : la 2025, car la notice data.gouv.fr de l'édition 2020 indique que la version de Recherche Data Gouv « annule et remplace » celle-ci.
- Fichiers sources (XML, français), téléchargés depuis `https://entrepot.recherche.data.gouv.fr/api/access/datafile/<id>` puis vérifiés par MD5 contre les sommes publiées par l'entrepôt (le générateur refuse toute autre somme) :
  - `alim_2025_11_03.xml` (id 666252) : `8e1171d63cee4b6010cfce25dd29243d`
  - `alim_grp_2025_11_03.xml` (id 666250) : `c31aeea90349c3aab86f98ef5f4f10da`
  - `compo_2025_11_03.xml` (id 666249, 69 Mo) : `2da725585946434df320d8041631998b`
  - `const_2025_11_03.xml` (id 666246) : `d8f2f25fdacb887bc993a6eeaf80f203`
- Génération : `node scripts/content/build-ciqual.mjs <dossier-des-xml>` écrit `content/food/ciqual.json` (déterministe, un aliment par ligne) ; `node scripts/content/build-ciqual.mjs --check` le valide. Les XML ne sont pas versionnés.
- Contenu retenu par aliment : code, nom français, groupe, énergie (kcal, constituant 328, règlement UE 1169/2011), protéines (25003, N x 6,25), lipides (40000), glucides (31000), fibres (34100), pour 100 g. Une valeur absente (« - »), « traces » ou « < x » devient `null` (inconnue) : elle n'est jamais remplacée par zéro. Le code de groupe 00 (« aliment moyen ») n'a pas de nom dans la table : `group` vaut `null`.
- Décomptes à la génération (valeurs `null`) : absentes `{kcal 143, protéines 29, lipides 20, glucides 70, fibres 70}` ; « traces » `{2, 4, 15, 134, 45}` ; « < x » `{0, 0, 166, 8, 130}`.
- Attribution affichée par l'app (écran à venir, I4-03) : « Source : Anses, Table de composition nutritionnelle des aliments Ciqual 2025 (Licence Ouverte Etalab 2.0). » Elle est portée par le champ `source.attribution` du fichier.
- Chargement : à la demande (import dynamique), jamais dans le paquet de départ (`src/features/nutrition/catalogue/ciqualCatalogue.ts`).
- **H-11 reste UNVERIFIED** (D-36) : la licence est lue dans les métadonnées de l'entrepôt, aucun constat d'Ali ; pas de CONFIRMED depuis une lecture.

# Licence — Open Food Facts (I4-02 : cache seulement, H-12)

- Données : base **Open Food Facts**, licence **ODbL 1.0** (base de données) ; contenus des fiches sous licence Database Contents License ; images CC BY-SA (non utilisées). Attribution requise : « Open Food Facts, contributeurs d'Open Food Facts, ODbL » avec lien vers `https://world.openfoodfacts.org`.
- Cette étape n'embarque aucune donnée OFF et n'appelle pas l'API (client Rust : ticket suivant, desktop-tauri). Elle ne fournit que le dépôt local validé des produits (`food.source = 'off'`, cache de 90 jours). Les fiches OFF mises en cache restent des données dérivées sous ODbL : l'attribution sera affichée avec la provenance « OFF » (I4-03). **H-12 reste UNVERIFIED** (aucun appel réalisé).
