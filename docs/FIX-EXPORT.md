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
