# SYNC-01 — Ligne créée par un appareil au schéma précédent : jamais perdue en silence (lot 0.25.0)

Statut : **en cours.** Budget M. Branche `SYNC-01` depuis `origin/main` (`e77f3c51`, après ERGO-02b, schéma 19). Lot 0.25.0 (docs/LOT-0.25.0.md), dernier ticket : pas de tag à la fusion. Relecture sync-icloud obligatoire (D-26), agent data-model pour toute table ou colonne.
Origine : D-275 (limite connue de la 0.24.0), constat D-275 de la relecture Codex (`git show 5d80c1eb:docs/relecture-codex-2026-11-13.md`, § 6 : création d'un mésocycle sur un appareil 18 → aucune ligne reçue sur 19). ADR 0005, 0010, 0011.
Chapitres PRD : 19 (synchronisation), 18 (bandeaux A-09, états dégradés), 20 (modèle de données). Fixtures synthétiques uniquement.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Tests |
| --- | --- | --- |
| 1 | Appareil A au schéma 18, appareil B au schéma 19, appairés. A crée une ligne (mésocycle, ou toute table dont la 0019 a ajouté des colonnes) → B la détecte (journal reçu d'un `sv` plus ancien sans les colonnes) et ne la perd jamais : elle est conservée telle quelle, durablement (redémarrage compris), jamais écrasée ni oubliée en silence. | non-régression deux appareils, schémas 18 et 19 |
| 2 | Même situation → B affiche un bandeau « Un appareil utilise une version plus ancienne. Mets-le à jour. » (texte dans src/i18n, bandeau A-09 existant), tant que des lignes restent en attente ; aucune donnée de la ligne dans le bandeau ni dans le journal technique. | test d'écran |
| 3 | A passe au schéma 19 (migration 0019) et republie, ou B dispose d'une règle sûre → la ligne conservée est reprise (appliquée) sur B, une seule fois, avec la même valeur que sur A ; le bandeau disparaît. | non-régression deux appareils |
| 4 | Sens inverse (B 19 → A 18 : champs inconnus mis de côté puis réintégrés) inchangé ; synchro entre appareils au même schéma inchangée. | `twoVersions`, `reintegrate`, suites de synchro existantes |
| 5 | Si la correction complète (compléter à nul les colonnes absentes d'un `sv` plus ancien, à l'application) exige de changer le format des journaux de synchro : seules la détection, le bandeau et la conservation sont livrées, avec un ADR de proposition pour le reste ; aucun changement de format sans validation d'Ali. | revue sync-icloud, ADR |
| 6 | Bundle de départ non augmenté (main `e77f3c51`, 196 136 octets) ; bandeau et textes chargés à la demande. | `test:bundle`, mesure normalisée |

## Passes

**Agents des modules.** (en cours)

**qa-test.** (à venir)

**code-reviewer.** (à venir)
