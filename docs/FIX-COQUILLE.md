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
