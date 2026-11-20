# FIX-EXPORT — Export, import et « Repartir de zéro » : plafond, textes vrais, horizon (lot 0.28.0, phase 2)

Statut : **en cours** (rouge puis vert, qa-test, consignés ci-dessous). 2e des 10 correctifs de l'audit Claude (constats C-136, C-107, C-108,
C-109). Budget M (150 k) ; dépassement seulement consigné (D-333). Branche `FIX-EXPORT` depuis `origin/main` (`34187399`). Rôles :
settings-personalization (export, import, Repartir de zéro), desktop-tauri (`src-tauri/src/import.rs`). Chapitres PRD : 21 (persistance, export,
import), 22 (sécurité). Décisions lues : D-57, D-104, D-187, D-318 à D-333. Fixtures synthétiques uniquement ; aucune donnée d'Ali.
`src/sync/**` et `src/domain/sync/**` : lus, jamais modifiés (D-26 non déclenché).

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 1 | Given une archive d'export de 3 Mo (entre 2 Mo et 24 Mio), When on la choisit pour l'import, Then elle est lue (plafond d'import = limite de lecture de l'archive, 24 Mio) ; le plafond du sélecteur d'archive vaut `IMPORT_ZIP_LIMITS.maxBytes` côté TS et `MAX_IMPORT_BYTES` côté Rust (test par lecture du source). Le plafond des fichiers texte (CSV, 2 Mo) ne change pas. | `fixExport.limits.test.ts` |
| 2 | Given un export dont l'archive dépasse 24 Mio, When on exporte (simple ou complet), Then rien n'est enregistré et un message clair dit que l'archive ne pourrait pas être réimportée. | `fixExport.screen.test.tsx` |
| 3 | Given l'écran Export et import, When on lit l'aide de l'export, Then elle liste les familles réellement exportées (profil, pesées, thème, entraînement, nutrition, récupération, mensurations, compléments, cardio), dit que photos et tracés GPS n'y sont pas, et un avertissement « données de santé en clair » précède les boutons. | `fixExport.texts.test.ts` |
| 4 | Given l'aperçu d'import, When on lit `mergeHint` et `replaceHint`, Then ils citent toutes les familles ; « Remplacer » dit qu'il supprime ce que l'archive ne contient pas, dans toutes ces familles, ici puis sur les autres appareils. | `fixExport.texts.test.ts` |
| 5 | Given `RESET_TABLES`, When une table effacée n'a pas de mot clé dans la liste du test, ou que ce mot n'est pas dans le texte « Ce qui est effacé », Then le test échoue ; compléments, prises, cardio et tracés GPS sont cités. | `fixExport.texts.test.ts` |
| 6 | Given « Ce qui est gardé », When on lit `keptContent`, Then il est vrai : la bibliothèque d'exercices embarquée, les programmes de départ et Ciqual sont gardés ; les exercices personnalisés sont effacés (dits tels dans la liste effacée). | `fixExport.texts.test.ts` |
| 7 | Given un appareil qui a appliqué une remise à zéro d'horizon `H`, When une archive porte un horizon strictement antérieur à `H`, ou n'en porte aucun alors qu'elle est postérieure en date, Then elle est refusée avant l'aperçu (message précis) ; une archive d'horizon ≥ `H` ou exportée par cet appareil après l'effacement s'importe. | `dataResetArchive.test.ts`, `ExportImportScreen.test.tsx` |
| 8 | Given un appareil jamais remis à zéro, When on importe une archive des versions précédentes (sans horizon dans le manifeste), Then elle est lue et admise comme avant ; le manifeste porte `reset_horizon` seulement si l'appareil exportant en a un, le hash de `data.json` est inchangé. | `dataResetArchive.test.ts`, `archive.test.ts` |

Périmètre écrit : `src/domain/exportImport/archive.ts` (manifeste, limite d'export), `src/domain/exportImport/fullExport.ts` (horizon), `src/domain/dataReset.ts`
(verdict pur), `src/features/settings/ExportImportScreen.tsx`, `src/platform/files/{types,browser,iosFiles,open,tauriFiles}.ts` (plafond d'archive),
`src-tauri/src/import.rs`, `src/i18n/fr.exportImport.ts`, `fr.dataReset.ts`, tests, cette fiche. Hors périmètre : `src/sync/**`, `src/domain/sync/**`, format de
`data.json`, `EXPORT_SV`, CSV Hevy / Strong.

## Passe agent du module : écarts et choix prudents

- **C-109, écart au brief** : l'archive ne porte ni HLC ni `created_at` par ligne (D-57, équivalence par hash de `data.json`) ; comparer l'horizon « aux lignes »
  est donc impossible sans changer le format. Choix : le manifeste porte `reset_horizon` (hlc de l'horizon que l'appareil exportant a appliqué), seulement s'il en a un ;
  `data.json`, son hash et `EXPORT_SV` sont inchangés. Import : refus si l'horizon de l'archive est antérieur au nôtre (`before-reset`) ou absent alors que cet appareil a un
  horizon (`unproven`, message « sans preuve », refus prudent, y compris pour une archive d'ancienne version faite après l'effacement : à réexporter depuis un appareil à jour).
  Aucun effacement ici : toute archive est admise comme avant (archives des versions précédentes lues, test). Le test PROG-01 (archive d'un autre appareil après l'effacement)
  porte désormais l'horizon ; l'ancien test « archive d'après s'importe » de D-187 passe par l'export de l'écran.
- **C-136** : plafond d'import des archives 24 Mio (`DEFAULT_PICK_ARCHIVE_MAX_BYTES`, `IMPORT_ZIP_LIMITS.maxBytes`, `MAX_IMPORT_BYTES` Rust, test par lecture du source) ; les fichiers texte (CSV) restent à
  2 Mo (façade TypeScript, la commande Rust lit jusqu'à 24 Mio puis TS refuse). L'export refuse > 24 Mio (message `exportNotReimportable`).
- **C-107** : `exportHint`, `exportWarning` (données de santé en clair, avant les boutons), `mergeHint`, `replaceHint` ; mention « famille inconnue d'une archive ancienne laissée telle quelle » (`TABLE_SINCE_SV`).
- **C-108** : tables effacées couvertes par `wipedTraining` (exercices perso, progression), `wipedSupplements`, `wipedCardio` (GPS), `wipedTechnical` ; test table par table contre `RESET_TABLES`.
  `keptContent` : faux avant (la table `exercise` ne contient que les exercices perso, effacés) ; vrai maintenant (bibliothèque embarquée gardée).

## Passe qa-test

Ajoutés (verts dès l'écriture : comportement déjà couvert par le vert, aucun rouge possible) : `reset_horizon` nul, numérique, vide, en majuscules : `bad-manifest` ; clé de manifeste inconnue ignorée ;
archive d'ancienne version lue et admise sans effacement ; horizon local illisible : la date seule décide.

## Décisions : D-334 à D-336 (docs/decisions.md)

- **D-334 (complète D-187)** : l'archive d'export porte dans son manifeste `reset_horizon` (hlc), seulement si l'appareil exportant a appliqué une remise à zéro (ni `data.json`, ni son hash, ni `EXPORT_SV`
  ne changent). Verdict d'import pur `archiveResetVerdict` : date du manifeste <= dernier effacement ou illisible : refus ; sinon, si cet appareil a un horizon : archive sans horizon : refus « sans preuve » ;
  horizon < le nôtre : refus ; >= : admise. Aucun effacement ici : tout est admis comme avant. Limite : une archive d'une ancienne version faite après un effacement légitime est refusée (à réexporter).
- **D-335** : plafond d'import des archives = limite de lecture de l'archive = 24 Mio (TS, Rust, test par lecture du source) ; l'export refuse une archive > 24 Mio (non compressée) plutôt que d'en produire une
  non réimportable. Compression non retenue (hors périmètre). Mesure d'une base synthétique de 12 mois toujours à faire (constat C-136).
- **D-336** : textes de l'export, de l'import et de « Repartir de zéro » testés contre le code (familles de l'archive ; `RESET_TABLES` table par table) ; avertissement « données de santé en clair » avant l'export.

## Constats d'Ali à faire

Aucun avant la première utilisation réelle (D-38). À valider par Ali : le refus prudent d'une archive sans horizon après un effacement local (D-334).
