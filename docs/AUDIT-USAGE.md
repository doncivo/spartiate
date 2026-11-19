# AUDIT-USAGE — parcours réels d'Ali depuis le 15/11 (lot 0.27.0)

Budget M. Branche `AUDIT-USAGE`, depuis `origin/main` 8686a8fc (0.26.0 publiée : v0.26.0 et ios-v0.26.0 le 16/11, CI de main verte).
Base synthétique uniquement (D-292) : aucune donnée d'Ali lue ni recopiée. Les parcours conformes sont gardés en caractérisation dans
`src/db/repositories/sql/auditUsage.test.ts` ; chaque écart est prouvé par le test rouge du ticket qui le corrige.

## Passes

- **product-owner** : périmètre = les six parcours a à f du prompt (docs/LOT-0.27.0.md) ; critère : pour chaque parcours, un verdict
  « conforme » (test vert) ou « écart » (constat, scénario, cause, ticket). Aucun code de production dans ce ticket.
- **qa-test** : sonde exécutée sur SQLite en mémoire (dépôts réels, horloge manuelle, deux appareils simulés par deux bases) ; résultats
  ci-dessous. Rouge/vert : sans objet pour un ticket qui n'ajoute que des tests de caractérisation (tous verts) ; les preuves rouges sont
  dans FIX-0271, PROG-04 et PROG-05.
- **agents des modules** (nutrition, training, settings-personalization) : causes lues dans le code, citées par fichier et ligne.
- **code-reviewer** : relecture du diff (docs et un fichier de test) : aucune donnée réelle, aucun délai, aucun test sauté. Approuvé.

## Constats

| # | Parcours | Verdict | Constat et scénario | Cause | Ticket |
|---|---|---|---|---|---|
| U-1 | a. onboarding puis import « Remplacer », check-in **avant** l'import | conforme | Cible importée (2 450, prévue le lundi 16/11) en vigueur le 19/11. | — | test `a` |
| U-2 | a. check-in de la semaine du 09/11 accepté **après** l'import (même jour, ou reçu de l'autre appareil) | **écart** | Le 19/11, 3 177 kcal (week_start 09/11) est en vigueur au lieu de 2 450. | `effectiveTarget` (targetRecord.ts) : dernière décision par HLC parmi `week_start ≤ date` (D-82) ; une décision prise le 15/11 pour une semaine passée, plus récente que l'import, masque la cible planifiée du 16/11. La confirmation D-296 (4) ne protège que la saisie sur cet appareil, pas une ligne reçue par la synchro. | FIX-0271 |
| U-3 | a. même archive importée en **« Fusionner »** après le check-in | **écart** | La cible 2 450 n'est pas importée du tout, sans message. | plan.ts (REV-01 constat 3) : une décision acceptée de l'archive plus ancienne (`decided_at` 14/11) que la dernière décision locale (15/11) n'est pas réintroduite, même quand elle est prévue pour une date future. | FIX-0271 |
| U-4 | a. archive sv 18 sans `hlc` ou avec un HLC ancien | conforme pour le HLC | L'import réécrit toujours la ligne avec le HLC de l'import (`upsert`, exportImportRepository.ts) ; le HLC de l'archive n'est jamais lu. Le défaut vient de U-2 et U-3, pas du HLC d'archive. | — | FIX-0271 (vecteurs) |
| U-5 | a. routine de 5 jours « Lundi — … » à « Samedi — … » | **écart** | Les jours importés ne sont rattachés à aucun jour de la semaine (la notion n'existe pas). | Schéma 19 : `routine_day` sans jour de la semaine. | PROG-04 |
| U-6 | b. « Commencer le cycle » sans toucher la durée, après l'import | **écart** | Durée proposée : 5 semaines, quelle que soit la réponse de l'onboarding. | CycleView.tsx : les réponses de l'onboarding ne valent que s'il n'existe **aucun** cycle ; l'archive importée en apporte (clos), donc retour au défaut 5. | PROG-05 |
| U-7 | b. durée changée en semaine 1 sans séance close | **écart** | Le changement ne vaut qu'au cycle suivant, sans proposer de l'appliquer tout de suite. | `changeNextWeeks` (D-267 (3)) écrit `nextWeeks` seulement. | PROG-05 |
| U-8 | b. « Terminer le cycle » › « Répéter le cycle » après un changement de durée | conforme | Le cycle répété prend la durée choisie. | — | test `b` |
| U-9 | c. jeudi, une seule séance close le lundi | **écart** | Aujourd'hui propose le jour qui suit le lundi dans la routine (« Mardi — … »), pas « Jeudi — … ». | `nextProgramDay` (programDay.ts) : rotation après le dernier jour fait, sans date (D-243). | PROG-04 |
| U-10 | d. charge d'un seul côté saisie, puis « Corriger » depuis le journal | conforme | L'historique lu par la progression rend la charge corrigée ; une décision de séance ne prime que si elle est postérieure à la clôture (prescribe.ts, étape 3). | — | test `d` |
| U-11 | e. cible de repos enregistrée le lundi, puis check-in collaboratif « garder la cible » | conforme | « Garder » trace une proposition refusée ; la cible de repos reste en vigueur. | — | test `e` |
| U-12 | e. variante : « Accepter » au check-in du même lundi | **écart** | La décision acceptée est écrite sans la cible de repos enregistrée le matin : les jours de repos repassent à la cible unique. | CheckInView.tsx : le plan de repos est lu dans la cible en vigueur à la **fin de la semaine analysée** (dimanche), qui ignore la décision du lundi. | FIX-0271 |
| U-13 | f. import du dossier `sante` (formats D-293), deux appareils | conforme | Lecture sur l'iPhone seul (« unsupported » sur le PC), une pesée Santé par jour, réimport sans doublon, pesées reçues par la synchro sur le PC. | — | tests existants `healthBodyImport/service.test.ts`, `bodyShortcutFiles.test.ts` |

Constats repris de la dette (hors parcours) : décision reçue par la synchro qui masque une cible future (= U-2), lecture des cibles futures
hors transaction (FIX-0244) → FIX-0271 ; constats A-001 à A-006 de l'audit Codex partie 0 → FIX-0272.
