# AUDIT-0.26.0 — avancement

SHA audité : `8686a8fc2860f7a94eb193426cbcc640a33bac80` (`v0.26.0` et `ios-v0.26.0`, tags annotés résolus).
Début : 16 novembre 2026. Branche : `audit-0.26.0`, créée depuis le tag, jamais mise à jour depuis main.
Publication vérifiée : Windows 2026-11-16 04:30:31 UTC ; iOS 04:39:41 UTC, releases non brouillons et fichiers présents.

- Partie **0 terminée**, preuves examinées ; commit intitulé `AUDIT-0.26.0 : partie 0, contrôles et preuves`. Vérifier sa présence locale et distante avant toute reprise, sans recréer le commit. La session 84542 est terminée : ne pas relancer `partie0.ps1`.
- Partie **1 terminée le 19/11** : architecture et couches, `partie-01.md`. A-007 mineur (import Tauri dynamique hors façade, garde ESLint contournée), deux assertions rouges conservées. Aucun nouveau bloquant démontré. **Prochaine : partie 2**, données, repositories et migrations ; commencer par les risques de réintégration et de garde de démarrage listés dans `partie-01.md`.
- **Partie 2 en cours**, sauvegardée et poussée sous `6e14fb85` (`AUDIT-0.26.0 : partie 2`) : 19 migrations, migrateur, sérialiseur et réintégration lus ; **A-008 bloquant sous injection de panne**, écriture acquittée perdue après échec du rollback. Les fichiers présents ne permettaient pas de déclarer la partie terminée ; reliquat dans `partie-02.md`. Écriture dans `.git` réussie, aucun verrou supprimé.
- **Partie 3 en cours**, commencée après ce push à la demande d'Ali : `partie-03.md`. Parties 4 à 12 non commencées. La partie 2 reste à compléter.
- PR : **#148**, https://github.com/doncivo/spartiate/pull/148, brouillon vérifié le 19/11. Partie 0 présente en local et sur origin : `ef35e11f2dab802d6a3694532a8f83a951aadb89`. Ne jamais fusionner ni intégrer main.
- Constats A-001 à A-006 consignés. CI du SHA : 25 jobs Tests verts, publications Windows/iOS vertes. Local : 24 tests unitaires rouges / 9 167 et 12 rejets non interceptés ; aucun nouvel essai de cette suite. Bundle 173 verts, fmt/clippy verts, desktop 846 verts, SQL 30 + 1 verts après préparation du dossier manquant. Détails et limites : `partie-00.md`.
- Inventaire corrigé : **97 / 2 047 fichiers lus (4,74 %)**, dont **96 / 1 046 production/outillage** ; 81 fichiers vendored explicitement exclus. Ajout de 389 fichiers omis : 33 production/outillage, 356 tests/supports. Le banc compte donc **1 001 tests/supports**, pas seulement les 645 initiaux. `couverture.md` fait foi ; aucun scan n'augmente le taux de lecture.
- Budgets par partie (Ali, 16/11 confirmé le 19/11), remplaçant le L global : 1 M ; 2 L ; 3 L ; 4 L ; 5 M ; 6 M ; 7a Aujourd'hui/Entraînement L ; 7b Nutrition/Progrès L ; 7c Plus/onboarding/coquilles L ; 8a Rust hors sync L ; 8b Swift et sync Rust L ; 9 M ; 10 S ; 11 L ; 12 M. S 50 k, M 150 k, L 400 k. Rédaction documentaire limitée à 20 minutes par lot.

## Contraintes actives du 19/11

- **Nouvelle instruction d'Ali : poursuivre toutes les parties sans arrêt volontaire entre elles.** Les points de reprise/commits/pushes restent obligatoires ; ils ne terminent plus la session à eux seuls. Budgets par partie et contraintes mémoire maintenus.

- Code de production : lecture intégrale obligatoire de chaque fichier, y compris héritage ; progression dans `couverture.md`. Tests : partie 11 par outils et lecture complète moteur/nutrition/synchro/migrations/import ; échantillon motivé pour le reste. Inclure les tests et supports réintégrés dans l'inventaire.
- Claude Code mène le lot 0.27.0 dans `C:\Dev\spartiate`. Ne lire ni commenter ses branches. Lecture, outils légers et tests ciblés d'un seul fichier uniquement ; aucune suite complète, aucun build Rust complet. Les 24 échecs locaux ne sont pas relancés : en partie 11, seulement les 20 fichiers concernés, sans couverture, en parallèle comme la CI, lorsque la contrainte mémoire active le permet ; classer défaut réel/artefact d'environnement sans allonger de délai.
- Connus, **lot 0.27.0**, à vérifier sans refaire le travail de Claude : partie 5, cible importée du lundi suivant battue par l'onboarding (`effectiveTarget`, `targetRecord.ts:74-83`, HLC absent de l'archive) ; partie 4, `nextProgramDay` suit la rotation et non le jour de semaine ; partie 4, cycle par défaut de cinq semaines et changement en semaine 1 appliqué au cycle suivant.
- Tout nouveau bloquant établi (perte de données, mauvaise charge/cible prescrite, fuite corporelle) va immédiatement dans `bloquants.md`, avec push sans attendre la clôture de partie.
- Fin de partie 1 : pas de nouveau `test:bundle` (il reconstruit l'app), conformément à la restriction d'outils légers du 19/11. Preuve du 16/11 conservée, sources/configuration identiques au tag vérifiées ; aucune nouvelle mesure prétendue. Écart explicite à la règle habituelle avant push, détaillé dans `partie-01.md`.

## Reprise exacte

Lire AGENTS.md, CLAUDE.md, docs/reprise.md puis ce fichier. Les statuts historiques des documents de version ne remplacent pas les preuves.
Consulter `preuves/resultats/*.json` pour les commandes déjà exécutées ; un statut en cours nécessite de vérifier la session, pas de relancer automatiquement.
Pistes conservées : seuil training 90 % absent de `vitest.config.ts` (partie 11) ; effet de notifications `SupplementsView.tsx:127` poursuivi après démontage (parties 5/7/11) ; références partagées entre tests `epochCarryReplacedParentResume.test.ts:93-115` (partie 11). Relais de partie 1 : erreurs de réintégration/garde absorbées (`bootstrap.ts`, parties 2/3), fuseau/thème système (7c), chargements des notifications/récupération (5/6/7/11). Les budgets par partie ci-dessus remplacent l'estimation globale historique.
Périmètre d'écriture de cette mission : ce dossier seulement (hors installation/outillage explicitement demandés, sorties et caches redirigés dans `preuves/.runtime/`). Aucune correction de l'application, même si un test échoue. Les défauts sont consignés dans le rapport.
Pas de données réelles, pas de e2e/visual/smoke/perf locaux, pas de surveillance GitHub. L'interdiction de corriger l'application et la demande explicite des tests locaux priment sur les règles habituelles de correction et de tests ciblés.
