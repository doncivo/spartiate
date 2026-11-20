# FIX-RECUP — Récupération : aberrantes de la baseline, dette de la proposition de coucher, pas tronqués (lot 0.28.0, phase 2)

Statut : **prêt pour revue** (rouge `75d2cbd1`, vert `86b7cd99`, qa-test `83f5a995`). 5e des 10 correctifs de l'audit Claude (constats C-049, C-050, C-052).
Budget M (150 k) ; dépassement seulement consigné (D-333). Branche `FIX-RECUP` depuis `origin/main` (`77a89e5d`). Rôles : recovery, domain-logic.
Chapitre PRD : 16 (§ 16.3 baseline, Recovery, besoin de sommeil ; § 16.7 heure de coucher cible). Décisions lues : D-69, D-94, D-130, D-133, D-318 (4),
D-333. Preuve : `partie6-recuperation.test.ts` (branche `audit-claude-0.27.0`), cas C-049, C-050, C-052 repris en tests rouges. Fixtures synthétiques
uniquement ; aucune donnée d'Ali. `src/sync/**` et `src/domain/sync/**` : non touchés (D-26 non déclenché).

D-318 (4) (Recovery Split à 50 %) : lue ; le seuil est dans `src/domain/training/recoverySplit.ts` (`spareBelowPercent`), hors de ce ticket, inchangé.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 1 | Given 7 nuits valides HRV [48, 50, 52, 50, 48, 52, 200], When on bâtit la baseline HRV, Then 200 est exclu (1 exclue), moyenne 50, σ = √(16/5) ≈ 1,789 (calcul à la main : chaque valeur est jugée contre la moyenne et le σ des AUTRES valeurs). | `fixRecup.test.ts` |
| 2 | Given ces 7 nuits (FC repos 58 / 62 alternées) et la nuit du jour HRV 30, FC 60, sommeil au besoin, When on calcule la Recovery, Then le score existe (7 nuits valides, une aberrante écartée), z HRV = (30 − 50) / 1,789 ≈ −11,18, brut borné à −2, score 0 : la journée rouge (≤ 33) est proposée. | `fixRecup.test.ts` |
| 3 | Given 14 nuits HRV 45 / 55 alternées (vecteur de l'audit), When on bâtit la baseline, Then rien n'est exclu, moyenne 50, σ = √(350/13) ; la Recovery vaut 67 (ratio 0,9) et 74 (ratio 1) : vecteurs inchangés. | `fixRecup.test.ts` |
| 4 | Given 6 valeurs identiques et une 7e différente, When on bâtit la baseline, Then rien n'est exclu (σ des autres nul : pas d'exclusion), jamais une baseline à σ = 0 fabriquée par l'exclusion. | `fixRecup.test.ts` |
| 5 | Given 13 nuits de 450 min et la nuit du jour à 120 min (< 180, non valide), lever 7 h 00, When on propose l'heure de coucher, Then besoin 450 min, coucher 23:30 (et non 630 min, 20:30). | `fixRecup.test.ts` |
| 6 | Given une nuit du jour VALIDE de 400 min, When on propose le coucher de la nuit à venir, Then elle compte dans la dette (fenêtre de la nuit à venir : les 7 jours jusqu'à aujourd'hui compris = `debtNights` du lendemain) ; une nuit du jour sous 180 min n'y compte jamais. | `fixRecup.test.ts` |
| 7 | Given un `pas.csv` de 10 000 lignes du 01/11 puis une ligne du 02/11, When on le lit, Then le 02/11 est présent (les DERNIÈRES lignes sont gardées, guide « Plus ancien en premier ») et le fichier est dit tronqué. | `fixRecup.test.ts` |
| 8 | Given un `pas.csv` qui couvre plusieurs jours (ou un fichier tronqué), When on le lit, Then son jour le plus ancien est signalé `partialDay` (total peut-être partiel : fenêtre « 30 derniers jours » commencée à l'heure de l'export, ou troncature) ; un fichier d'un seul jour non tronqué n'en a pas. | `fixRecup.test.ts` |
| 9 | Given un total complet de 8 000 pas déjà importé pour un jour, When un nouvel import apporte 1 200 pas pour ce jour comme jour le plus ancien du fichier, Then 8 000 est gardé (le jour partiel n'est jamais réécrit, seulement inséré s'il manque) ; les autres jours du fichier sont remplacés comme avant (le total du jour grandit). | `service.fixRecup.test.ts` |

Périmètre écrit : `src/domain/recovery/baseline.ts`, `recoveryScore.ts`, `bedtimeProposal.ts`, `shortcutFiles.ts`, `src/features/settings/recoveryImport/service.ts`
(chemin `pas` seulement), tests, cette fiche. Hors périmètre : seuils (`outlierSigma` 2,5, `minNights` 7, 180 min), C-051, C-053 à C-062, Recovery Split.

## Passe agent du module : corrections et choix prudents

- **C-049** (`baseline.ts`) : exclusion en une passe, chaque valeur jugée contre la moyenne et le σ des AUTRES valeurs de la fenêtre (seuil 2,5 σ
  inchangé) ; σ des autres nul ou moins de 2 autres valeurs : valeur gardée. Limite connue, testée : deux aberrantes proches se masquent.
  `recoveryScore.ts` : l'abstention « baseline_incomplete » porte sur les nuits VALIDES (≥ 7), plus sur les valeurs retenues après exclusion ;
  sans cela le cas de la preuve (7 nuits, une aberrante) restait sans score. La journée rouge est proposée (score 0 au lieu de 41).
- **C-050** (`bedtimeProposal.ts`) : la dette de la nuit à venir réutilise `debtNights(nuits, lendemain).valid` (seuil de 180 min, source unique) ;
  fenêtre inchangée (7 jours jusqu'à aujourd'hui compris : la nuit terminée ce matin est passée pour la nuit à venir ; D-130 « aujourd'hui exclu »
  vaut pour le résumé du jour, dont la nuit du jour est celle qu'on note). Besoin 450 min, 23:30 sur le cas de la preuve.
- **C-052** (`shortcutFiles.ts`, `recoveryImport/service.ts`) : `readRows` reconnaît l'en-tête sur la première ligne du fichier puis garde les
  10 000 DERNIÈRES lignes (vaut pour tous les fichiers lus par `readRows` : HRV, FC repos, pas, sommeil, fichiers du corps) ; `parseShortcutSteps`
  rend `partialDay` (jour le plus ancien d'un fichier de plusieurs jours, ou d'un fichier tronqué) ; l'import l'écrit par `insertMany` (inséré s'il
  manque, jamais réécrit), les autres jours par `upsertTotals` comme avant. Aucun changement de dépôt ni de migration.

## Passe qa-test

Ajoutés (`fixRecup.test.ts`, describe « passe qa-test ») : baselines de 1, 2 et 3 valeurs ; 6 nuits valides → toujours « baseline_incomplete » ;
nuit courte aberrante hors baseline ; nuit du jour sans durée et nuit future hors dette ; bord de la fenêtre de 7 jours (J−7 dehors, J−6 dedans) ;
pas d'un seul jour tronqué (partiel) ; HRV tronqué : la première ligne écartée, la dernière gardée. Tous verts. Suites voisines vertes :
`src/domain/recovery`, `src/domain/health`, `src/features/recovery`, `src/features/settings/recoveryImport`, `src/features/notifications`,
dépôts et synchro de la récupération, `RedDay`, `RecoverySplitProposed` (553 tests). Preuve de l'audit rejouée sur le vert : C-049, C-050, C-052 et
les vecteurs verts ; C-051, C-053, C-054 restent rouges (hors périmètre). `tsc` et eslint (fichiers touchés, tests compris) propres.

## Relecture de fin de l'agent du module (auto-relecture, ne vaut pas passe code-reviewer)

Relu : aucune constante changée (`config.ts` intact), logique dans `src/domain/recovery`, service limité au chemin `pas`, pas de `!`, aucun texte
d'interface. Coût de l'exclusion O(n²) avec n ≤ 14 : négligeable. Les résumés `recovery_day` déjà publiés des jours passés gardent l'ancien calcul tant
qu'ils ne sont pas recalculés ; `SLEEP_RULES_VERSION` non relevé (D-345).

## Passe code-reviewer (à froid, agent distinct) : approuvé

Contrôles : eslint vide, 314 tests ciblés verts, aucun test existant modifié, couches respectées, rouge `75d2cbd1` avant vert `86b7cd99` (échec du rouge
établi par lecture). Aberrantes conformes au § 16.3 ; `recovery_day` n'est calculé que par l'iPhone (aucun écart entre appareils) ; dette du coucher sur
les nuits du résumé de demain ; lecture par la fin sans régression (CRLF, BOM, sans en-tête inchangés). Suggestions : (1) `poids.csv` décrit « plus récent
en premier » dans docs/guide-raccourcis-sante.md : au-delà de 10 000 lignes, les pesées les plus anciennes seraient gardées (écrit dans D-348) ; (2)
`writeSteps` écrit en deux fois (`upsertTotals` puis `insertMany`) : tout ou rien par fichier perdu si la seconde échoue (registre BL-102) ; (3) sur un
fichier de 2 jours, la veille reste figée à son total partiel (écrit dans D-348) ; (4) proposer à Ali `SLEEP_RULES_VERSION` 4 (recalcul des 30 jours),
écrit dans D-345.

## Décisions : D-345, D-346, D-347, D-348 (docs/decisions.md)

- **D-345** : (C-049, complète § 16.3, seuil 2,5 σ inchangé) une valeur de baseline est exclue si elle s'écarte de plus de 2,5 σ de la moyenne
  des AUTRES valeurs de la fenêtre, σ calculé sans elle ; σ des autres nul ou moins de 2 autres : gardée. Une passe ; deux aberrantes proches peuvent
  se masquer (limite acceptée, testée). Les résumés des jours passés ne sont pas recalculés d'office (`SLEEP_RULES_VERSION` inchangé, test figé qui
  l'attend à 3) ; à trancher par Ali si l'historique de 30 jours doit être recalculé. Choix prudent, révisable par Ali. Proposé à Ali (revue) : relever `SLEEP_RULES_VERSION` à 4 pour recalculer les 30 derniers jours avec la nouvelle règle (test figé à mettre à jour) ; non fait ici.
- **D-346** : (C-049) le minimum de 7 nuits du § 16.3 porte sur les nuits valides de la fenêtre, avant exclusion des aberrantes : une aberrante
  écartée ne remet pas la Recovery en apprentissage. Choix prudent, révisable par Ali.
- **D-347** : (C-050, complète D-130) la dette de la proposition de coucher (§ 16.7) ne compte que les nuits valides (≥ 180 min) des 7 jours
  jusqu'à aujourd'hui compris (`debtNights` du lendemain) ; le résumé du jour garde « aujourd'hui exclu ». Choix prudent, révisable par Ali.
- **D-348** : (C-052, H-25 toujours UNVERIFIED) un fichier Raccourcis de plus de 10 000 lignes est lu par ses 10 000 dernières lignes (guide
  « Plus ancien en premier ») ; le jour le plus ancien d'un `pas.csv` de plusieurs jours, ou tronqué, est un total possiblement partiel : inséré
  s'il manque, jamais réécrit. Coût : si ce jour a été importé partiel une première fois, il n'est jamais complété. Choix prudent, révisable par Ali.
 Coûts (revue) : un fichier de 2 jours laisse la veille figée à son total partiel ; un `poids.csv` exporté « plus récent en premier » (docs/guide-raccourcis-sante.md, partie A) garderait au-delà de 10 000 lignes les pesées les plus anciennes, irréaliste sur 30 jours.
## Constats d'Ali à faire

Aucun avant la première utilisation réelle (D-38). À valider : D-345 à D-348 ; recalcul de l'historique (D-345).

## Écarts au brief

- Deux vecteurs de mes propres tests rouges étaient faux à la main (aberrantes 200 / 210 sur 9 nuits : 210 est bien exclue, z ≈ 2,66 ; fenêtre de
  lecture des pas qui finissait avant le 08/11 12:00 UTC) : corrigés dans le commit vert, recalcul consigné dans le test. Les assertions des
  constats (preuve de l'audit) n'ont pas changé.
- Budget M : tenu (environ 110 k).
