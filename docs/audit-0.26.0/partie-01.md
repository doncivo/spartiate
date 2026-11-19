# Partie 1 — architecture et couches

Audit du tag `v0.26.0`, SHA `8686a8fc2860f7a94eb193426cbcc640a33bac80`, le 19/11/2026. **Passe architecture terminée ; audit global incomplet.** Budget M (150 k tokens), décision d’Ali des 16 et 19/11. Aucun code applicatif modifié.

## Périmètre et méthode

- Contrat : PRD § 3, CLAUDE.md, ADR 0001 et ADR 0004 (composition et avenant P-02). Les éléments CircleTasks historiques ne valent pas exigences métier actuelles.
- Lecture intégrale des points de composition, conteneur, accès abstrait aux données, démarrage, chargement différé et candidats d’architecture ; fichiers et observations dans `preuves/lectures.json`.
- Graphe de partie 0 : 835 fichiers TS/TSX, imports statiques, dynamiques littéraux et réexports. Complément `preuves/partie1.mjs` : résolution des chemins, cycles statiques de valeurs, candidats globaux/état de module, sondes ESLint sans écrire de fixture dans `src/`.
- Le scan ne compte jamais comme lecture. La lecture intégrale de chaque module métier reste aux parties 2–10 ; la pureté sémantique, les formules, les transactions, les migrations et les effets natifs ne sont pas validés par un graphe.

## Résultats

1. **Frontières : A-007, mineur.** Un import dynamique Tauri contourne `platform` dans `src/features/settings/theme.ts:42`. Aucun autre candidat de frontière dans le graphe conservateur. Cela ne prouve pas l’absence de règle métier placée dans un écran.
2. **Domaine.** Aucun import externe trouvé par le complément AST ; les lectures d’horloge et de hasard repérées restent dans les fabriques injectables `clock.ts` et `id.ts`. `window` dans `confidence.ts` et `sleepNeed.ts` désigne une variable locale de fenêtre de calcul, pas le navigateur. Les deux `let` de module détectés appartiennent aux fabriques de fixtures `eventTestKit.ts` et `routineTestKit.ts`. La recherche ne démontre pas l’immutabilité profonde des objets `const`.
3. **Cycle statique hérité.** `goalRules.ts:4` → `week.ts:3` → `todayList.ts:2` → `goalRules.ts`. Les trois fichiers ont été lus ; les fonctions croisées ne sont pas appelées pendant leur initialisation. Dette de découpage, aucun plantage démontré. Ne pas confondre `todayList` hérité et l’écran Spartiate `TodayScreen` ; purge héritée à traiter avec CLEAN-03, sans correction dans l’audit.
4. **Composition.** `bootstrapApp` crée le HLC après lecture de la graine et utilise un stamper qui refuse les écritures avant cette étape. `createStorage` associe catalogue et fabrique de repositories. `DataAccess.transaction` recrée les repositories sur l’exécuteur transactionnel. `defineFeatureStore` isole les stores par conteneur via `WeakMap` ; le contexte React refuse son absence. La conformité de chaque appel métier à ces contrats reste à examiner par module.
5. **SQL hors repositories.** Les appels directs repérés dans le démarrage et les adaptateurs concernent les PRAGMA, les diagnostics, la sauvegarde ou une prise de test sous `DEV`. Les méthodes `data.transaction` sont le contrat de repositories, pas du SQL direct ; `Intl.PluralRules.select` est un faux positif. Pas de requête métier directe établie dans une feature par ces scans.
6. **Démarrage et chargement différé.** Statut `loading` posé avant la première attente ; choix du driver derrière `platform/database`; blocage explicite si un build Tauri est pris pour un navigateur ; erreurs d’ouverture rendues dans `DbFailureDetails`. Les écrans différés ont Suspense et une frontière d’erreur avec réessai/rechargement. `preloadScreens` espace les départs, mais n’attend pas la fin d’un import pour programmer le suivant : ne pas affirmer que tous les chargements sont séquentiels. Le graphe réel du bundle reste la preuve de poids, pas la seule présence d’`import()`.
7. **Configuration.** TypeScript strict et options renforcées présents ; `sideEffects` limité aux CSS, entrées Vite `main`/`pairing` séparées, accroches e2e conditionnelles. Configurations lues : `eslint.config.js`, `tsconfig.json`, `vite.config.ts`, `package.json`, entrées HTML. Le contrôle des workflows et des permissions natives reste aux parties dédiées.

## A-007 — import Tauri hors façade et garde incomplète

- Fichiers : `src/features/settings/theme.ts:42`, `eslint.config.js:23` (`no-restricted-imports`).
- Scénario : ouvrir le port de thème sous Tauri → la feature importe directement `@tauri-apps/api/window`. ESLint sur le vrai fichier : zéro erreur, zéro avertissement. Sonde équivalente statique : rejet ; sonde dynamique : aucun rejet.
- L’ADR 0004, avenant P-02, décrit la personnalisation sans autoriser une exception à la frontière de l’ADR 0001. Ignorer l’échec cosmétique de la barre de titre ne justifie pas le placement de son adaptateur dans une feature.
- Preuve : `preuves/partie1.json` ; deux assertions rouges dans un seul fichier `preuves/partie1-rouges.test.mjs`, résultat `preuves/resultats/partie1-rouges.json` (code 1 attendu). Pas de vert après : aucune correction autorisée.
- Impact établi : couplage à Tauri et angle mort de la garde. Aucune perte de données, mauvaise prescription ou fuite corporelle démontrée.
- Correction suggérée : déplacer le port natif derrière `platform` et contrôler aussi les imports dynamiques aux frontières, avec un test qui rejette leur forme interdite.

## Relais explicites

- Parties 2/3 : `bootstrap.ts:164-176` ne conserve que le journal technique si la réintégration échoue ; `bootstrap.ts:293-295` transforme une erreur de `assertGuardEmpty` en zéro. Examiner les scénarios de défaillance et les états persistants avant de conclure sur les écritures perdues ou non publiées. Aucun scénario de perte établi dans cette partie.
- Partie 7c : `timeZoneWatcher.ts:45-47` absorbe les erreurs de réglage ; vérifier l’impact utilisateur actuel. Vérifier également le premier rendu du thème système : `index.html` impose `data-theme="dark"` et `theme-init.js` ne le retire pas pour `system`.
- Parties 5/6/7/11 : rejets de chargement des notifications et de l’import récupération limités au journal (`startup.ts`, `App.tsx`) ; confronter aux lignes d’état persistantes et aux preuves A-004.
- Les trois constats d’usage d’Ali sont conservés dans `avancement.md`, marqués **connu, lot 0.27.0** ; aucune lecture de ce lot.

## Inventaire et validation de la passe

L’inventaire initial omettait **389 fichiers** : 33 de production/outillage et 356 de tests/supports. Réconciliation par script depuis la liste Git du tag : **1 046 production/outillage + 1 001 tests/supports = 2 047**, avec 81 fichiers vendored toujours exclus comme en partie 0. Les 645 initiaux ne couvraient pas tout le banc de tests. Liste des ajouts : `preuves/inventaire-ajouts-partie1.json`. Les supports de tests ne sont pas autant de fichiers de tests exécutables ; aucun ajout n’est marqué lu automatiquement.

Passes distinctes : cadrage sur PRD/ADR ; lecture architecture ; preuve mécanique et deux assertions rouges ; relecture du constat et des limites. Pas de validation native ni de relecture globale de PR prétendue. Aucun bloquant démontré en partie 1.

Restriction mémoire du 19/11 : aucune suite complète, aucun Rust, aucun e2e, aucun build. `test:bundle` non relancé avant ce push documentaire : il reconstruit l’app et dépassait quatre minutes en partie 0. La consigne actuelle d’outils légers prime ; preuve précédente conservée (173 tests verts du 16/11), sources et configuration identiques au tag vérifiées par `partie1.mjs`. Ce n’est pas une nouvelle mesure du bundle. Vérifications de publication : cohérence du registre de lecture, `git diff --check`, scan de secrets ; uniquement le dossier d’audit modifié.
