# MATRICE-DOC — matrice des capacités et documentation (lot 0.28.0, phase 2)

Statut : en PR. Budget S. Branche `MATRICE-DOC` depuis `origin/main`. Constats de l'audit Claude 0.27.0 : C-183, C-184, C-185, C-186, C-187. Ticket documentaire : aucun code, aucune migration.

## Passe product-owner : critères

1. Given la matrice, When un `CONFIRMED` est lu, Then il porte date, appareil et référence de constat (décision ou fiche), ou il redevient UNVERIFIED (D-36).
2. Given une capacité annoncée à Ali sans ligne, Then elle a une hypothèse H-n au registre provisoire et une ligne UNVERIFIED.
3. Given le CHANGELOG, les guides et les licences, Then aucune phrase n'est fausse ni périmée.
4. Les tests documentaires (docs-paths, privacy, agents, purge, prd-split) restent verts.

## Passe agent du module (docs-writer, exécutée par l'appelant : la fiche de rôle n'a pas d'outil shell)

- C-183 : H-36 (« Pris ») reste CONFIRMED : date (13/11/2026), appareil (iPhone), référence (FIX-0242, D-318 (9) : décision d'Ali qui fait foi contre les mentions « à constater ») ; version non notée par Ali, écrite telle quelle. H-34 était déjà séparée (affichage CONFIRMED, retrait sur l'autre appareil UNVERIFIED, DOC-PRIV). docs/FIX-0242.md dit déjà « constatées par Ali le 13/11 (D-318 (9)) ». Capacité sans ligne : exclusion de capture de la fenêtre d'appairage (C-134) → **H-39** et ligne UNVERIFIED. La sauvegarde iCloud de l'iPhone (C-152) a déjà H-38 (FIX-CONFID-IOS). OCR et dictée sans usage (C-141) : constat de code, sans capacité annoncée à Ali, laissé au registre.
- C-184 : en-tête de la matrice daté et vrai ; H-5 ne revendique plus le Trousseau ; « à corriger en I1-02 » (H-4) remplacé par le suivi réel (D-71, nouveau constat à faire).
- C-185 : docs/reprise.md relu : ni « 0.27.0 en publication », ni étape manquante ; tenue par l'appelant à chaque fusion.
- C-186 : CHANGELOG 0.27.0 : « check-in du lundi » ; c'est la mise à jour qui ne rattache pas les jours d'une routine déjà présente, l'import les rattache (D-317 (1)).
- C-187 : guide Raccourcis « Plus › Journaux » ; licences : attribution Ciqual (affichage non relevé : BL-107) et mention I4-02 historique ; installation PC : toutes les versions de Spartiate portent le crochet REL-TECH-02 (repris avant la première version, docs/archive/circletasks/audit-1.0.md B15).

## Passe qa-test

Tests documentaires : voir « Vérifications ». Aucun test rouge préalable : aucun contrôle automatique ne couvrait ces phrases (écart consigné ; la règle « un CONFIRMED porte date et référence » reste une relecture, BL-107 et H-39 au registre).

## Décisions

Aucune nouvelle décision ; H-39 au registre provisoire (docs/decisions.md, après H-38).

## Passe code-reviewer (à froid, agent distinct) : à corriger, puis corrigé

Justes : CHANGELOG 0.27.0 (D-317, FIX-0271), « toutes les versions » de install-pc.md (`hooks.nsh` du 17/10/2026, Spartiate 0.1.0 du 03/11/2026), aucun CONFIRMED promu, H-39 conforme. Corrigés : (1) install-pc.md, paragraphe « Attention : avant cette version » devenu faux pour Spartiate, réécrit ; (2) licences.md, phrase I4-02 (« fournissait seulement », attribution affichée depuis I4-05, H-12 sans constat) ; (3) matrice H-4 : correction publiée en 0.2.1 ; (4) H-39 cite `sync/commands.rs` (appel) et `sync/pairing.rs`.
