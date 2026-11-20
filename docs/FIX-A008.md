# FIX-A008 — Un ROLLBACK en échec ne doit plus laisser acquitter une écriture (lot 0.28.0, phase 1.3)

Statut : **fait (relecture sync-icloud et revue à suivre).** Budget M. Branche `FIX-A008` depuis `origin/main` (`046a085f`). Aucune migration. Rôle : data-model (src/db).
Origine : audit Codex 0.26.0, A-008 (bloquant), preuve `partie2-rollback.test.mjs` (reprise dans `src/db/serializedDriver.a008.test.ts`,
SQLite Wasm synthétique, panne injectée avant ROLLBACK). Chapitres PRD : 20 (modèle de données, § 20.0), 18 (états dégradés, écran d'échec).
ADR 0002 (pilote sérialisé). Fixtures synthétiques uniquement (D-292).

## Constat

`createSerializedDriver` convertissait tout rejet de `ROLLBACK` en booléen (`rollbackLost`, vrai seulement pour « no transaction is active »).
Autre rejet : ni invalidation, ni arrêt de la file ; `inTransaction` repassait à faux alors que SQLite gardait la transaction ouverte. L'écriture
suivante était acquittée DANS cette transaction non validée, lue, puis perdue à la réouverture.

## Règle appliquée (choix prudents)

Échec fermé : si l'annulation ne peut pas être établie, le pilote est « empoisonné ». Toute opération suivante (lecture, écriture, transaction,
y compris celles déjà en file) est refusée par `DbError('connection-poisoned')`. Seul `close()` reste permis. Aucune nouvelle instruction SQL
n'est émise après l'empoisonnement (une instruction de plus serait exécutée dans la transaction peut-être ouverte).

## Critères (Given / When / Then)

| # | Critère | Test (`serializedDriver.a008.test.ts`) |
| --- | --- | --- |
| 1 | Given une transaction dont le travail échoue et un ROLLBACK qui réussit, When une écriture suit, Then elle est acquittée et durable (témoin). | témoin |
| 2 | Given un travail en échec et un ROLLBACK rejeté (autre que « no transaction is active »), When une écriture suit, Then elle est refusée `connection-poisoned`, rien n'est acquitté ; l'appelant de la transaction reçoit l'erreur d'origine. | critère 2 |
| 3 | Given le même état, When une lecture, une transaction ou une écriture déjà en file suivent, Then toutes sont refusées ; `close()` réussit. | critère 3 |
| 4 | Given l'état empoisonné, Then l'erreur porte l'erreur d'origine ET la cause du ROLLBACK (texte, sans valeur de donnée ni paramètre) et aucune instruction n'est émise ensuite. | critère 4 |
| 5 | Given « no transaction is active » au ROLLBACK ou au COMMIT, Then comportement inchangé : `transaction-lost` au COMMIT, `DELETE FROM sync_guard` puis file rendue. | critère 5, `serializedDriver.test.ts` |
| 6 | Given une transaction perdue et un retrait de `sync_guard` en échec, When une écriture suit, Then elle est refusée (échec fermé), l'erreur d'origine reste rendue à l'appelant. | critère 6 |
| 7 | Given un pilote empoisonné pendant l'app, Then `dbStatus = 'error'`, échec `kind: 'connection-poisoned'`, message « ferme puis rouvre l'app », sans bouton « Réessayer », diagnostic copiable ; une ligne de journal sans valeur de donnée. | critère 7 |

Périmètre : `src/db/driver.ts` (code d'erreur, abonnement optionnel `onPoisoned`), `src/db/serializedDriver.ts`,
`src/features/app/{bootstrap,appStore,DbFailureDetails}.ts(x)`, `src/App.tsx` (retry masqué), `src/i18n/fr.ts`. Hors périmètre : C-115, C-138.

## Passe agent du module (data-model) : choix

- Seuls deux états empoisonnent : ROLLBACK rejeté autrement que « no transaction is active » ; retrait de `sync_guard` en échec après transaction
  perdue. « no transaction is active » (ROLLBACK ou COMMIT), `transaction-lost`, retrait réussi : inchangés.
- Aucune relance de ROLLBACK ni réouverture : la voie sûre n'existe pas (le pool sqlx du plugin vit côté Rust ; une réouverture depuis le JS ne
  prouve pas que l'ancienne transaction est close). Seule sortie proposée : fermer puis rouvrir l'app (`app.dbPoisoned`, sans « Réessayer »).
- Chemin d'erreur réutilisé : `setDbStatus('error', { failure })` de `bootstrapDatabase` (phase `start`, étape `connection-poisoned`, kind
  `connection-poisoned`), abonnement par `SqlDriver.onPoisoned?` (optionnel : aucun faux pilote existant ne change). Journal : une ligne
  `db: connexion invalidée (DbError)` sans valeur ; le diagnostic copiable porte l'erreur d'origine et la cause du ROLLBACK (messages SQLite
  sans paramètres).
- L'appelant de la transaction fautive reçoit toujours l'erreur d'origine ; les appels suivants reçoivent `connection-poisoned`.

## Passe qa-test

Cas ajoutés : COMMIT perdu (`transaction-lost`, pas d'empoisonnement) ; COMMIT rejeté autrement avec ROLLBACK réussi (annulation établie, pas
d'empoisonnement) ; abonné tardif et abonné défaillant. Déjà couverts : « no transaction is active » (critère 5 et TRI-22 de
`serializedDriver.test.ts`), appel déjà en file et fermeture (critère 3). Vérifié : `src/db`, `src/features/app`, `src/platform/tauri` (137 fichiers,
1092 tests) verts ; `tsc`, `eslint` propres.

## Interactions avec les autres constats (non corrigés ici)

- C-115 (chien de garde, `startupSteps.ts`, `StartupWatchdog.tsx`, `bootstrap.ts`) : « Réessayer » recharge la page ; or le pool sqlx est côté Rust
  et survit au rechargement, donc une transaction restée ouverte aussi. FIX-COQUILLE devra : ne jamais proposer Réessayer/recharger quand
  `dbFailure.kind === 'connection-poisoned'` (déjà masqué dans `App.tsx`), ne pas écraser cet état par `ready` ni par un échec de démarrage, et ne
  pas relancer de migration sur un pilote empoisonné (elle serait refusée).
- C-138 (restaurations Rust sans exclusion mutuelle, `backup.rs`) : une restauration pendant un état empoisonné ou une transaction ouverte
  copierait un fichier incohérent. La correction Rust devra refuser ou attendre la fin des écritures, et rendre l'état « connexion invalidée »
  explicite (redémarrage obligatoire après restauration).

## Périmètre pour la relecture sync-icloud (D-26)

Aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src/db/repositories/**`, aucune migration, aucun déclencheur. À relire : `serializedDriver.ts`
(chemin TRI-22 : `DELETE FROM sync_guard` après transaction perdue, désormais échec fermé s'il échoue, aucune autre instruction ensuite) et son
effet sur `sync_outbox` : une écriture ne passe plus jamais hors capture sous garde orpheline.

## Décision proposée (pour docs/decisions.md, non écrite)

D-xxx : « Un pilote SQLite dont l'annulation d'une transaction ne peut pas être établie est empoisonné (`connection-poisoned`) : toute opération
sauf `close()` est refusée, l'app affiche l'échec et n'offre que le redémarrage. Pas de réouverture automatique de la connexion. » (ADR 0002,
avenant.)

## Relecture sync-icloud (D-26)

Verdict : **approuvé**. Aucune écriture hors `sync_outbox` après transaction perdue ou retrait de garde en échec ; cycle de synchro surpris par l'empoisonnement : lot, curseur et accusé annulés ensemble (`reader.ts`), intention `inflight` survivante reprise au démarrage (`publisher.ts`), époque, reset et oubli en transactions gardées ; invariants intacts. Tests relancés : serializedDriver.a008 (10), serializedDriver (16), qaTwoDevices (6), crashPoints (59). Constat 1 (assertion `sent` après le retrait de garde en échec) : ajouté. Constats 2 et 3 : registre (BL-093, BL-094). Constat 4 (C-115) : contrainte reprise dans D-326 (5) pour FIX-COQUILLE.
