# AUDIT-0.26.0 — avancement

SHA audité : `8686a8fc2860f7a94eb193426cbcc640a33bac80` (`v0.26.0` et `ios-v0.26.0`, tags annotés résolus).
Début : 16 novembre 2026. Branche : `audit-0.26.0`, créée depuis le tag, jamais mise à jour depuis main.
Publication vérifiée : Windows 2026-11-16 04:30:31 UTC ; iOS 04:39:41 UTC, releases non brouillons et fichiers présents.

- Partie **0 terminée**, preuves examinées ; commit intitulé `AUDIT-0.26.0 : partie 0, contrôles et preuves`. Vérifier sa présence locale et distante avant toute reprise, sans recréer le commit. La session 84542 est terminée : ne pas relancer `partie0.ps1`.
- Partie en cours / prochaine : **1 — architecture et couches**. Préparation : graphe AST (`preuves/architecture.json`), horloge/UUID lus, import dynamique Tauri hors façade repéré dans `src/features/settings/theme.ts:42`, à confronter aux décisions avant constat final. Aucun verdict global de partie 1.
- Parties 2 à 12 : non commencées. Les observations transverses issues de la partie 0 ne valent pas clôture de ces parties.
- PR : brouillon `AUDIT-0.26.0`, à ouvrir au premier push ; retrouver son numéro par la branche `audit-0.26.0` si l'interruption survient pendant la publication. Ne jamais fusionner.
- Constats A-001 à A-006 consignés. CI du SHA : 25 jobs Tests verts, publications Windows/iOS vertes. Local : 24 tests unitaires rouges / 9 167 et 12 rejets non interceptés ; aucun nouvel essai de cette suite. Bundle 173 verts, fmt/clippy verts, desktop 846 verts, SQL 30 + 1 verts après préparation du dossier manquant. Détails et limites : `partie-00.md`.
- Inventaire : **14 / 1 658 fichiers lus (0,84 %)**, 81 fichiers vendored explicitement exclus ; `couverture.md`, `preuves/lectures.json` et `preuves/inventaire.json`. Les scans n'augmentent pas le taux de lecture.
- Budget de travail : L (400 k tokens), réévaluer au point de commit si nécessaire ; audit technique, rédaction documentaire limitée à 20 minutes par lot.

## Reprise exacte

Lire AGENTS.md, CLAUDE.md, docs/reprise.md puis ce fichier. Les statuts historiques des documents de version ne remplacent pas les preuves.
Consulter `preuves/resultats/*.json` pour les commandes déjà exécutées ; un statut en cours nécessite de vérifier la session, pas de relancer automatiquement.
Pistes conservées pour les prochaines parties : seuil spécifique training 90 % absent de `vitest.config.ts` (à confronter en partie 11) ; effet de notifications `SupplementsView.tsx:127` poursuivi après démontage (parties 5/7/11) ; références partagées entre tests `epochCarryReplacedParentResume.test.ts:93-115` (partie 11). Les 1 658 fichiers représentent environ 11,7 Mo de source, avant PRD/ADR : l'estimation initiale L doit être réévaluée au premier point de commit pour une lecture exhaustive.
Périmètre d'écriture de cette mission : ce dossier seulement (hors installation/outillage explicitement demandés, sorties et caches redirigés dans `preuves/.runtime/`). Aucune correction de l'application, même si un test échoue. Les défauts sont consignés dans le rapport.
Pas de données réelles, pas de e2e/visual/smoke/perf locaux, pas de surveillance GitHub. L'interdiction de corriger l'application et la demande explicite des tests locaux priment sur les règles habituelles de correction et de tests ciblés.
