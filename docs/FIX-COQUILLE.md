# FIX-COQUILLE — coquille sans écran blanc, démarrage lent, confirmations avant perte (lot 0.28.0, phase 2)

Constats de l'audit Claude 0.27.0 : C-114, C-115, C-116, C-067, C-068, C-073, C-094. Budget M (150 k) ; un dépassement serait seulement consigné ici (D-333). Chapitres : PRD 18 (§ 18.1 à § 18.3, § 18.6), 13 et 14 (routines, séance). Décisions liées : D-326 (5), A-008 (pilote empoisonné), D-37, BUNDLE-01. Rôles : app-shell, training, accessibility-i18n.

## Périmètre

Dans : `src/App.tsx` (frontière racine, signature), `src/main.tsx`, `src/features/app/StartupWatchdog.tsx`, `StartupBlocked.tsx`, `startupSteps.ts`, `DbFailureDetails.tsx` ; `src/features/training/RoutinesView.tsx`, `session/SetRow.tsx`, `session/ActiveSession.tsx` ; `src/features/cardio/CardioGps.tsx` ; `src/features/bodyProgress/BodyProgress.tsx` ; catalogues `fr.ts`, `fr.training.ts`, `fr.cardio.ts`, `fr.bodyProgress.ts`. Hors périmètre : `src/sync/**`, migrations, Rust, `tests/bundle/start-modules.json` (aucun module nouveau dans le départ : la frontière racine vit dans `App.tsx`).

## Critères (Given / When / Then)

- C-114. Given un composant de la coquille qui lève au rendu, When l'app s'affiche, Then un message statique et « Relancer l'app » remplacent l'écran blanc ; Given la base empoisonnée (`connection-poisoned`), Then aucun bouton de rechargement, seulement la consigne de fermer l'app. Given le bloc « Démarrage bloqué » illisible, When le chien de garde se déclenche, Then un message statique nomme le blocage au lieu d'effacer toute l'app.
- C-115. Given une étape `db.backup` ou `db.migration.N` ouverte depuis plus de 8 s mais moins de 120 s, Then « Démarrage bloqué » n'apparaît pas ; Given plus de 120 s, Then il apparaît SANS « Réessayer » (aucun rechargement en pleine migration) ; Given une étape hors base à 9 s, Then « Réessayer » reste proposé ; Given le pilote empoisonné, Then jamais de rechargement ni de « Réessayer ». Given l'ouverture de la base en étape `backup`/`schema`/`migration`/`afterApply` au-delà de 15 s, Then le diagnostic s'affiche sans « Réessayer ».
- C-116. Given l'échec du chargement du bloc de signature après le montage, Then `dbStatus` ne change pas (aucune « erreur de démarrage »), l'échec est journalisé.
- C-067 (partie livrée). Given un suivi GPS en cours, When Ali touche « Abandonner le suivi », Then une confirmation (« Continuer le suivi » par défaut) précède la perte ; rien n'est arrêté avant « Abandonner ». Non livré : brouillon persistant du suivi (écart, voir plus bas).
- C-068. Given une série à faire où Ali a saisi une valeur, When il touche la croix, Then une confirmation précède le retrait ; une série intacte se retire sans question ; Given Entrée dans « Répétitions », Then le focus passe au champ de la série suivante à faire (sinon sur la ligne validée), jamais sur `body`.
- C-073. Given un brouillon de routine modifié, When Ali touche « Retour aux routines », Then une confirmation « Quitter sans enregistrer » ; brouillon intact : retour direct. Given « Retirer le jour » (jour non vide) ou « Retirer » un exercice, Then une confirmation précède le retrait dans le brouillon.
- C-094. Given une mesure corporelle, When Ali touche la croix, Then une confirmation précède la suppression (propagée par synchro).

## Passes

product-owner (cette fiche), agent du module, qa-test, code-reviewer : consignés plus bas.

## Passes consignées

- product-owner : fiche ci-dessus, avant les tests.
- Agent du module : `App.tsx` (`RootErrorBoundary`, `startSigningLazily`), `main.tsx`, `StartupWatchdog` (frontière locale, délai 120 s et pas de « Réessayer » sur les étapes de base, jamais de rechargement sur pilote empoisonné), `StartupBlocked` (prop `retry`), `startupSteps` (`isDatabaseWorkStep`, `stepDeadlineMs`), `DbOpenWatchdog` (délai par étape, pas de « Réessayer » en travail de base), `SetRow`, `RoutinesView`, `CardioGps`, `BodyProgress`, 14 clés i18n (`app.crash*`, `leaveRoutine*`, `remove*Title/Hint`, `sessionRemoveSet*`, `gpsCancel*`, `measureDelete*`). `src/sync/**` non touché.
- qa-test : bornes de `isDatabaseWorkStep` (`db.migrationX`, `xdb.backup` refusés), dernière série validée au clavier (focus sur la ligne), pilote empoisonné sur les trois chemins (frontière, chien de garde, ouverture). 91 fichiers / 670 tests verts sur `src/features/app`, `src/App.test.tsx`, `training`, `cardio`, `bodyProgress` ; `tsc` et eslint propres ; `startModules.test.ts` vert sans ajout à la liste blanche. Bundle de départ mesuré (`measureStart.ts`, build de production) : 196 689 o (main) -> 197 040 o (+351 o gzip, marge 161 360 o sous le plafond de 358 400 o) ; aucun module nouveau dans le départ.
- code-reviewer : à faire par l'appelant.

## Écarts au brief

- C-067 : seule la confirmation de l'abandon est livrée. Le brouillon persistant du suivi GPS (tracé en SQLite pour survivre à la WebView tuée) est reporté : il écrit des coordonnées, ce que la garde `geolocationGuard` (D-222) interdit hors table locale dédiée ; à décider.
- C-068 : le focus perdu du journal des facteurs (`RecoveryToday.tsx`, clé `hlc`) n'est pas traité (zone récupération).
- C-115 : « effet sur la transaction et le pool Rust » non vérifié ici (aucun rechargement n'est désormais déclenché par l'app pendant une migration ; un rechargement manuel par l'OS reste hors de portée).

## Décisions : D-353, D-354, D-355, D-356 (docs/decisions.md)

- **D-353** : la coquille a une dernière frontière d'erreur (`RootErrorBoundary`, `App.tsx`) : message statique et « Relancer l'app » ; sur pilote empoisonné, seule la consigne de fermer l'app (D-326 5). L'écran « Démarrage bloqué » est protégé par sa propre frontière.
- **D-354** : une étape de démarrage `db.backup`, `db.schema`, `db.migration.N` ou `db.afterApply` a 120 s avant « Démarrage bloqué » (8 s ailleurs), et ce diagnostic n'offre jamais « Réessayer » ; l'ouverture de la base repart d'un délai de 15 s à chaque étape et ne propose pas « Réessayer » pendant ces étapes.
- **D-355** : l'échec de chargement du bloc de signature est journalisé seulement ; il ne change jamais l'état de la base (C-116).
- **D-356** : perte de saisie confirmée : abandon du suivi GPS, retrait d'une série où Ali a saisi une valeur (une série intacte se retire sans question), retour d'un brouillon de routine modifié, retrait d'un jour non vide ou d'un exercice de routine, suppression d'une mesure corporelle. Après Entrée sur une série, le focus passe à la série suivante à faire.

## Constats d'Ali à faire

Aucun (confirmations visibles à l'usage ; relance de l'app après erreur d'affichage non reproductible sans défaut).

## Passe code-reviewer (à froid, agent distinct) : à corriger, puis corrigé

Six points, corrigés (tests rouges 7c672a90 pour 1 à 3, correctifs c58fe9c6, compensation dans le commit suivant) :

1. `RootErrorBoundary` ne propose plus « Relancer l'app » pendant une migration ni sur pilote empoisonné (contrôle au rendu et à l'appui : `connection-poisoned` ou étape `isDatabaseWorkStep` ouverte) ; consigne `app.crashMigration` (ou `app.dbPoisoned`). Test rouge puis vert.
2. `DbOpenWatchdog` : délai des étapes de base (120 s) pour `schema`/`backup`/`migration`/`afterApply`, et texte vrai `app.dbSlow` (« patiente ») au lieu de « touche Réessayer » quand le bouton est retiré. Test rouge puis vert.
3. `SetRow` : le focus après Entrée va à la première série à faire située APRÈS la ligne (`compareDocumentPosition`), pas à la première du document. Test rouge puis vert.
4. C-116 : le journal reçoit le code fixe « chargement impossible », plus l'`Error` brute.
5. Une seule classe de frontière, `FallbackBoundary` (`fallback` en prop), pour la racine et « Démarrage bloqué ».
6. Compensation du bundle de départ (C-132) : 163 clés mortes retirées de `fr.ts` (`tasks.*`, `detail.*` sauf `detail.stamp*`, `undo.*` mortes, `shortcuts.*` mortes, etc., vérifiées par recherche du chemin complet et des préfixes calculés, `tsc` propre) et `fr.importCsv.ts` réduit à `undoLabel` et `undoLabelOne`. Mesure normalisée (`measureStart.ts`, build de production) : origin/main c1613768 = 196 698 o ; branche après compensation = 194 349 o (-2 349 o). Avant compensation, sur l'ancienne base 43020e9a : 196 689 o (main) contre 197 040 o (branche).
