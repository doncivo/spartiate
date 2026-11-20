# FIX-RECUP — Récupération : aberrantes de la baseline, dette de la proposition de coucher, pas tronqués (lot 0.28.0, phase 2)

Statut : **en cours** (rouge puis vert, qa-test, consignés ci-dessous). 5e des 10 correctifs de l'audit Claude (constats C-049, C-050, C-052).
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
