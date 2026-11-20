# FIX-A008 — Un ROLLBACK en échec ne doit plus laisser acquitter une écriture (lot 0.28.0, phase 1.3)

Statut : **en cours.** Budget M. Branche `FIX-A008` depuis `origin/main` (`046a085f`). Aucune migration. Rôle : data-model (src/db).
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
