# IMPORT-0303 — import d'un programme depuis un PDF (lot 0.30.3)

Budget M (≈ 150 k ; training, architect, performance). Registre : BL-126. Décisions lues : D-423, D-591, D-650, D-676, D-769 ; proposées :
D-786 à D-790 (ci-dessous, à inscrire par Ali ou en commit DEC). Chapitres : 17.4 (import de programme), 18.6 (accessibilité),
22 (sécurité : CSP, aucun appel réseau), 23.1 (bundle de départ). Aucune migration, aucune table, aucun fichier de synchro, aucun crate.

## Passes

- **product-owner** — Périmètre : dépendance `pdfjs-dist` (version exacte), façade `src/platform/pdf/` (types, index seul point d'import,
  faux), règles pures `src/domain/training/pdfImport.ts`, lecteur à la demande `src/features/training/import/PdfReader.tsx` et son
  catalogue `fr.pdfImport.ts`, montage dans `ProgramImportView.tsx`, retrait du refus « PDF : pas encore lu » (clé `pdfLater`), règle
  eslint, assertions de bundle, fixtures PDF générées par script, `docs/licences.md`. Hors périmètre : CSP (`src-tauri/tauri.conf.json`
  inchangé), analyseur `programImport.ts` (inchangé), PDF scannés (refusés, pas d'OCR de PDF), CHANGELOG, version, registres. Critères :
  1. Given un PDF texte, When il est choisi par « Lire un PDF », Then le texte de chaque page est extrait sur l'appareil, lignes dans
     l'ordre vertical puis horizontal, ajouté à la zone de texte, puis analysé par le même analyseur qu'un collage (aperçu et
     confirmation existants) ; rien n'est écrit avant « Créer la routine ».
  2. Given un fichier de plus de 10 Mo, Then « PDF trop lourd », octets jamais lus ; Given plus de 20 pages, Then « PDF trop long ».
  3. Given un PDF protégé par mot de passe, Then « PDF protégé par un mot de passe » ; aucun mot de passe demandé.
  4. Given un PDF sans texte (moins de 20 lettres ou chiffres), Then « Ce PDF ne contient pas de texte (page scannée ?). Fais une
     capture de la page et lis-la comme une photo. »
  5. Given un fichier illisible ou une bibliothèque impossible à charger, Then un message dit l'échec ; jamais d'échec silencieux,
     texte inchangé à chaque refus.
  6. Given une lecture, Then aucun appel réseau (aucune URL de document, CMap, police, ICC ni wasm), worker local de même origine, CSP
     inchangée ; `destroy()` après chaque lecture ; les octets ne sont pas enregistrés.
  7. Given le bundle de départ, Then inchangé (liste blanche et plafond de 358 400 octets) ; lecteur, façade, catalogue, pdf.js et
     worker hors du départ (assertions).
  8. Given un import de `pdfjs-dist` ailleurs que dans `src/platform/pdf/index.ts` (statique ou `import()`), Then eslint le refuse.
- **training / architect (agent du module)** — `pdfjs-dist` **6.5.438** (`npm view pdfjs-dist version`, Apache-2.0) installé par
  `npm install --save-exact` : le verrou n'ajoute que `pdfjs-dist` et `@napi-rs/canvas` (dépendance facultative, binaires Node par
  plateforme, jamais dans `dist/`). Build legacy : `pdfjs-dist/legacy/build/pdf.min.mjs` et `legacy/build/pdf.worker.min.mjs` (chemins
  vérifiés dans le paquet installé ; déclaration `src/platform/pdf/pdfjs.d.ts`, le build legacy n'en ayant pas). Façade :
  `extractPdfText(bytes, limits): Promise<PdfTextResult>` (`{ pages }` ou `{ reason }`), `createPdfTextExtractor(load)` pour les tests,
  crochet `__CT_FAKE_PDF__` en développement seulement (comme `__CT_FAKE_OCR__`) ; `import()` du module et du worker (`?url`),
  `GlobalWorkerOptions.workerSrc` = fichier local ; options `disableFontFace: true, useSystemFonts: false, useWorkerFetch: false,
  useWasm: false, enableXfa: false, stopAtErrors: true, verbosity: 0`, sur une copie des octets ; aucune option d'URL. Domaine :
  `PDF_IMPORT_LIMITS` (10 Mo, 20 pages), `pdfSizeRefusal`, `pdfBytesRefusal` (en-tête `%PDF-` dans les 1 024 premiers octets),
  `pdfPagesRefusal`, `pdfLinesFromItems` (regroupement par base à ½ hauteur près, tri par x, espace si écart > 0,15 hauteur),
  `pdfTextRefusal` (< 20 caractères utiles → `no-text`), `pdfPagesToImportText`. Écran : `PdfReader` (taille vérifiée sur `File.size`
  avant `arrayBuffer()`, un message par refus, `role="status"` de la vue), chargé par `import('./PdfReader')` à l'ouverture de l'import ;
  bloc introuvable → « La lecture des PDF n'a pas pu se charger » (clé `pdfLoadFailed` du catalogue de la vue, qui remplace `pdfLater`).
  ESLint : `PDFJS_PATTERN` dans tous les blocs `no-restricted-imports` de src, `PDFJS_DYNAMIC` (`ImportExpression`) dans
  `no-restricted-syntax` de src, bloc final de la façade (et de sa déclaration de type) qui garde les autres interdictions.
  **Écarts à l'avis de l'architecte** : (a) `isEvalSupported` n'existe plus en 6.5.438 (absent des types et du code ; pdf.js 6 ne
  contient plus d'`eval` ni de `new Function`) : non transmis, le test vérifie son absence ; (b) `PDFDocumentProxy.destroy()` n'existe
  plus : `loadingTask.destroy()` (qui détruit le document et le worker) dans un `finally` ; (c) `useWorkerFetch: false` ajouté (le worker
  ne cherche jamais de CMap, police ni wasm) ; (d) aucun NOTICE dans le paquet (seul `LICENSE`, Apache-2.0).
- **qa-test** — Rouge : `2f440fed` (5 fichiers en échec : modules absents, 6 cas eslint, PhotoReader sans refus PDF ; plus 9 assertions
  « hors du départ » dans `tests/bundle/startBundle.test.ts`). Vert : `c422b26b`. Suites : `tsc --noEmit` et eslint (fichiers touchés) sans erreur ; src/domain/training, src/features/training/import, src/platform/pdf, src/i18n et eslintGuards : 112 fichiers, 1 427 verts, 2 en dépassement du délai de 5 s sous charge (`noDeadCatalogs`, `programImport.qa`, fichiers non touchés ; verts avec `--testTimeout=60000` en diagnostic, `noDeadCatalogs` échoue de même sur main sur ce PC) ; `npm run test:bundle` : 209 verts (départ et plafond inchangés, liste blanche intacte) ; scripts/release : 292 verts (même diagnostic de délai pour 4 tests lents, identiques sur main), après `licences-npm.mjs --write` et `third-party-notices.mjs --write`. Poids : hors départ, dans `dist/assets` : pdf.js `pdf.min-*.js` 498 050 octets (150 106 gzip), worker `pdf.worker.min-*.mjs` 1 327 591 octets (395 990 gzip), lecteur `PdfReader-*.js` 5 093 octets (2 415 gzip), relais `?url` 117 octets ; soit ≈ 1,83 Mo de plus dans l'app (≈ 548 Ko gzip), 0 octet au départ.
  E2e iphone-webkit : non écrit — aucun e2e existant de l'import (le projet `iphone-webkit` ne lit que `lot-f-screens.spec.ts`) ; la
  preuve WebKit et WebView reste un constat (H-45 proposée).
- **security-privacy** — relecture à froid : **CONFORME** (CSP inchangée, aucun appel réseau, octets non conservés, aucun secret ni
  donnée corporelle). Point important remonté : borne `TEXT_MAX` contournée par l'ajout des lignes lues ; mineur : aucun délai maximal.
- **code-reviewer** — relecture à froid : **à corriger, aucun bloquant**. Important : branche `pdfLoadFailed` sans test ; mineurs :
  espion `fetch` peu probant sous Node, refus CJK non noté, H-45 à compléter, premier test de `PdfReader.test.tsx` lent sous
  `--maxWorkers=2`.
- **Corrections de relecture** (commit « IMPORT-0303 : relecture, … ») :
  1. `appendLines` (ProgramImportView) applique `TEXT_MAX` (50 000) aux lignes lues (photo et PDF) : au-delà, rien n'est ajouté,
     « Texte trop long (plus de 50 000 caractères) : les lignes lues n'ont pas été ajoutées… » (clé `textTooLong`) ; les lecteurs ne
     disent plus « N lignes lues » quand l'ajout est refusé (`onLines` rend un booléen) ; le texte courant est lu par une ref mise à jour par effet (une
     saisie faite pendant une lecture lente n'est pas écrasée). Test d'écran (2 000 lignes).
  2. Test de `pdfLoadFailed` : `PdfReader.loadFailure.test.tsx` (`vi.doMock('./PdfReader')` qui lève, `vi.resetModules`, modules
     de l'app importés après) : message dit, zone de texte, phrase de la photo et « Analyser » toujours là.
  3. Délai maximal `PDF_IMPORT_TIMEOUT_MS` = 20 s (domaine) dans la façade : au-delà, `loadingTask.destroy()` et nouvelle raison
     `timeout` dite à l'écran (`pdf_timeout`). Test avec un faux qui ne rend jamais la main, horloge simulée (`vi.useFakeTimers`).
  4. Commentaire de l'espion `fetch` (la garde réelle est le test des options) ; CJK et H-45 notés ci-dessous.
  5. Lenteur du premier test : la vue importe désormais `./PdfReader` à l'ouverture ; les cinq fichiers de tests qui ouvrent la vue le
     préchauffent en `beforeAll` (motif FIX-0302b), aucun délai allongé. Le reste du coût du premier test (≈ 3 à 4,5 s sous charge :
     première ouverture de la base et de l'écran Entraînement) existait déjà pour `PhotoReader.test.tsx`.
  Résultats : `tsc --noEmit` et eslint sans erreur ; src/domain/training, src/features/training/import, src/platform/pdf, src/i18n et eslintGuards : 113 fichiers, 1 431 verts, mêmes 2 dépassements du délai de 5 s sous charge qu'au commit vert (`noDeadCatalogs`, `programImport.qa`, non touchés ; 23 verts avec `--testTimeout=60000` en diagnostic) ; `npm run test:bundle` : 209 verts (départ et plafond inchangés).

## Décisions proposées

| ID | Décision | Origine |
| --- | --- | --- |
| D-786 | **IMPORT-0303 (D-676, avis de l'architecte) : dépendance et chargement de pdf.js.** `pdfjs-dist` 6.5.438 épinglée (Apache-2.0, sans crate), build legacy (`legacy/build/pdf.min.mjs`, worker `legacy/build/pdf.worker.min.mjs`) ; seul point d'import `src/platform/pdf/index.ts`, par `import()` (eslint `no-restricted-imports` et `no-restricted-syntax`) ; worker = fichier local émis par Vite (`?url`), même origine ; CSP inchangée (`worker-src 'self'`, D-650) ; aucune URL de document, CMap, police, ICC ni wasm ; `useWasm`, `useWorkerFetch`, `useSystemFonts` et XFA coupés ; `isEvalSupported` absent de la 6.x (pdf.js sans `eval`). | Claude (avis de l'architecte suivi) ; révisable par Ali |
| D-787 | **IMPORT-0303 : limites et refus.** 10 Mo (vérifiés sur la taille du fichier avant d'en lire les octets) et 20 pages ; en-tête `%PDF-` exigé ; mot de passe → refus « protégé » sans demande de mot de passe ; moins de 20 lettres ou chiffres → « PDF scanné » avec la consigne « Fais une capture de la page et lis-la comme une photo » ; bibliothèque non chargée → « lecture indisponible » ; lecture de plus de 20 s → arrêtée (`destroy()`), refus « timeout » (relecture) ; lignes lues qui porteraient le texte au-delà de 50 000 caractères → non ajoutées, « Texte trop long » (relecture, photo comprise) ; chaque refus dit à l'écran, texte inchangé. Octets jamais enregistrés ; `loadingTask.destroy()` après chaque lecture. | Claude (choix prudent) ; révisable par Ali |
| D-788 | **IMPORT-0303 : reconstruction des lignes.** Éléments de texte regroupés par ligne (bases à moins d'une demi-hauteur), lignes de haut en bas, éléments de gauche à droite, espace ajoutée si l'écart dépasse 0,15 hauteur ; pages mises à la suite sans ligne vide ; le texte rejoint la zone de texte et passe par `parseProgramText` comme un collage (aperçu et confirmation inchangés). Texte en colonnes ou pivoté : lu tel quel, corrigé dans la zone de texte. | Claude (choix prudent) ; révisable par Ali |
| D-789 | **IMPORT-0303 : chargement à la demande.** `PdfReader` (avec la façade et `fr.pdfImport`) est importé par `ProgramImportView` à l'ouverture de l'import ; pdf.js et son worker seulement à la première lecture ; bloc introuvable dit par `pdfLoadFailed` (catalogue de la vue) ; clé `pdfLater` retirée. Départ inchangé (liste blanche et plafond). | Claude (choix prudent) ; révisable par Ali |
| D-790 | **IMPORT-0303 : preuve sur l'appareil.** Le chargement du worker module `.mjs` dans la WebView (WebView2 sur PC, WKWebView sur iPhone, type MIME servi par le protocole d'actifs de Tauri) n'est pas prouvé par les tests (Node et jsdom) : hypothèse H-45, UNVERIFIED, constat d'Ali attendu. | Claude (choix prudent) ; révisable par Ali |

Ligne proposée pour `docs/capability-matrix.md` :

| Lecture du texte d'un PDF par pdf.js dans la WebView (IMPORT-0303, BL-126, H-45 proposée, D-786 à D-790 ; worker `.mjs` local, CSP inchangée) | UNVERIFIED | Constat d'Ali sur PC et iPhone : « Lire un PDF » sur un programme en PDF texte → lignes dans la zone de texte ; PDF scanné → consigne de capture | IMPORT-0303, constat d'Ali |

## Lignes proposées pour docs/capability-matrix.md (texte exact, port par le coordinateur)

Correction de la ligne IMPORT-029b : remplacer la fin « ; lignes ajoutées au texte puis même analyseur que le collage ; PDF non lu » par
« ; lignes ajoutées au texte puis même analyseur que le collage ; PDF lu à part (IMPORT-0303, H-45) ».

Nouvelle ligne :

| Lecture du texte d'un PDF par pdf.js dans la WebView (IMPORT-0303, BL-126, H-45 proposée, D-786 à D-790) : Entraînement › Routines › Importer un programme › « Lire un PDF » ; `pdfjs-dist` 6.5.438 (build legacy) chargé à la demande, worker `.mjs` local de même origine, CSP inchangée, aucun appel réseau ; 10 Mo, 20 pages, 20 s au plus ; PDF protégé, scanné, illisible ou trop long refusé et dit ; repli de pdf.js sur le fil principal si le worker ne démarre pas (écran possiblement figé pendant la lecture) | UNVERIFIED | Constat d'Ali sur PC et iPhone : « Lire un PDF » sur un programme en PDF texte → lignes dans la zone de texte en moins de quelques secondes, écran réactif ; PDF scanné → consigne de capture ; si « La lecture des PDF n'a pas pu se charger. Ferme puis rouvre l'import » apparaît, le noter | IMPORT-0303, constat d'Ali |

## Points non tranchés

- **H-45** — Type MIME des `.mjs` servis par Tauri (PC et iPhone) : si le worker ne démarre pas, pdf.js passe à son « faux worker »
  (lecture dans le fil principal, même résultat, mais l'écran peut se figer pendant la lecture ; le délai de 20 s la borne) ; si même ce
  repli échoue, l'écran dit « lecture indisponible ». Le conseil « Ferme puis rouvre l'import » de `pdfLoadFailed` suppose un échec
  passager du chargement du bloc ; non éprouvé sur l'appareil. Constat attendu.
- PDF en écriture asiatique (CJK) ou à police CID qui exige un CMap externe : aucun `cMapUrl` n'est fourni (aucun appel réseau, D-786),
  la lecture échoue et est refusée `invalid` (« pas un PDF lisible ») ; consigne de repli : capture et photo.
- Poids du worker (hors départ) embarqué dans l'app : voir Poids ; aucun budget de taille d'installeur n'existe au PRD § 23.1.
