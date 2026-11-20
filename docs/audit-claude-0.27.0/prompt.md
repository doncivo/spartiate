AUDIT-CLAUDE-0.27.0 : audit complet, parties 4 à 12, en relecture à froid. Décision d'Ali du 20/11 : Codex atteint trop vite sa limite ; l'audit est partagé.
- Codex (PR #148, branche audit-0.26.0) garde les parties 0 à 3 : données, migrations, synchronisation (src/db, src/sync, src/domain/sync, src-tauri/src/sync, migrations). Tu ne relis PAS ces dossiers, sauf pour suivre un appel depuis ta partie, et tu ne touches jamais à sa branche.
- Toi : parties 4 à 12 ci-dessous, sur la version publiée v0.27.0.

Rôle : auditeur indépendant, EN LECTURE SEULE pour l'application. Tu n'as pas le contexte de développement : ne présume rien, prouve tout. Ne pose aucune question : un doute devient un constat « à vérifier ». Réponds en français.

Cadre
- Nouvelle session, sans reprendre le contexte d'un lot. Worktree DANS le dossier de travail : git worktree add .codex-tmp/wt-audit-claude v0.27.0, puis branche audit-claude-0.27.0 depuis ce tag. Note le SHA audité en tête du rapport.
- Tu n'écris que dans docs/audit-claude-0.27.0/ (rapport, couverture, avancement, preuves/). Aucune modification de src/, src-tauri/, content/, scripts/, tests/, .github/. Les tests de preuve vivent dans docs/audit-claude-0.27.0/preuves/ et ne sont jamais branchés sur la CI.
- Interdits du CLAUDE.md : aucune lecture des données réelles (%APPDATA%\fr.spartiate.app, %APPDATA%\fr.circletasks.planner, iCloud Drive/Spartiate, conteneur iPhone). Usage réel en cours (D-292).
- Pas de e2e, visual, smoke ni perf en local : lis les résultats de la CI du tag v0.27.0. Mémoire du PC limitée : tests ciblés d'un seul fichier, jamais la suite complète ; un seul agent lourd à la fois.
- Commit et push sur audit-claude-0.27.0 à la fin de CHAQUE partie ; PR en brouillon « AUDIT-CLAUDE-0.27.0 » dès le premier push, jamais fusionnée. avancement.md à jour pour reprendre exactement.
- Enchaîne les parties sans arrêt volontaire ; arrêt propre (commit, push, avancement.md) seulement au 2e compactage ou si une partie dépasse son budget. Après un compactage, relis avancement.md et ce prompt (recopié dans docs/audit-claude-0.27.0/prompt.md au premier commit).
- Utilise des sous-agents en contexte neuf pour la lecture (agent code-reviewer, ou l'agent du module en lecture seule), un fichier ou un dossier à la fois ; c'est toi qui consignes les constats.

Méthode (D-50, D-51)
- Outils déterministes d'abord (graphe d'imports, recherche de motifs, couverture), lecture ensuite.
- Constat : identifiant C-001…, gravité (bloquant / important / mineur / amélioration), partie, fichier:ligne, scénario concret qui casse (entrée → résultat faux), preuve (test rouge dans preuves/, sortie d'outil, extrait), correction suggérée en une ligne. Pas de preuve = « à vérifier ».
- Bloquant = perte ou corruption de données, fuite de donnée corporelle ou de secret, plantage au démarrage, mauvaise charge ou mauvaise cible prescrite. Tout bloquant est poussé immédiatement dans docs/audit-claude-0.27.0/bloquants.md.
- Couverture : couverture.md liste chaque fichier de production lu dans ton périmètre (tout src/ et src-tauri/ hors dossiers de Codex, src-tauri/plugins/*/ios, scripts/, .github/workflows/) ; aucun ne doit manquer à la fin. Vendored : « hors relecture, motif ».

Parties et budgets
- 4. Moteur d'entraînement (L) : 1RM, double progression, RIR, fatigue, stagnation, échauffement, arrondis au cran du matériel, haltères par paire, assisté (D-273), lest, unilatéral, temps et distance ; mésocycle 4/5/6 (D-267, D-269, D-315), décharge à 2 séries et ~90 %, semaine de reprise, pause, journée rouge ; séance du jour par jour de la semaine et rotation (D-243, D-316, D-317) ; Strength Score (D-310 à D-312). Un vecteur chiffré recalculé à la main par règle.
- 5. Nutrition (M) : cibles et cible en vigueur (D-82, D-314), cible des jours de repos, type du jour (D-270 à D-272), cibles futures, check-in (± 150 kcal, protéines fixes, plancher de lipides), tendance du poids, dépense mesurée, journal, Ciqual, Open Food Facts, scan, recettes, compléments (masque des jours, rappels, « Pris »).
- 6. Récupération et Santé (M) : lecture du dossier sante (formats D-293), sommeil et stades, dette de sommeil, HRV, FC, baseline, Recovery, Recovery Split, dates et fuseaux (changement d'heure, minuit).
- 7a. Aujourd'hui et Entraînement (L), 7b. Nutrition et Progrès (L), 7c. Plus, onboarding, coquilles (L) : états vides et dégradés (§ 18.3), erreurs visibles, chargement à la demande, aucune action destructrice sans confirmation, parcours clavier PC, 1 024 à 1 920 px, accessibilité (§ 18.6 : noms accessibles, contrastes AA, 44 pt, très grand texte, réduire les animations).
- 8a. Rust hors sync (L) : commandes, entrées validées, chemins, unwrap/expect en production, sauvegardes, journal, coffre, updater et signature. 8b. Swift (M) : plugins, marque-pages, actions de notification en arrière-plan, Info.plist et entitlements cohérents avec la matrice ; notifications sur l'iPhone seulement.
- 9. Sécurité et confidentialité (M) : secrets et données corporelles dans le dépôt, tout l'historique git, journaux, artefacts ; appels réseau et destinations ; CSP et capabilities ; ce qui part vers Open Food Facts.
- 10. Performance (S) : bundle de départ, démarrage, génération de séance < 1 s, graphiques sur 3 ans de données synthétiques, fuites au démontage (écouteurs, minuteurs, GPS).
- 11. Tests et CI (L) : tests qui ne testent rien, règles sans test, tests instables, workflows (permissions minimales, actions figées, secrets nommés seulement) ; lecture complète des tests du moteur et de la nutrition (Codex lit ceux de la synchro et des migrations).
- 12. Conformité au PRD et documentation (M) : docs/audit-claude-0.27.0/tracabilite.md, chaque exigence des chapitres 8 à 23 → fait / partiel / absent / hors périmètre avec sa preuve ; capability-matrix (chaque CONFIRMED a son constat daté, D-36) ; reprise, CHANGELOG et guides cohérents avec la 0.27.0.

Rapport final (docs/audit-claude-0.27.0/rapport.md et résumé dans la PR)
- SHA audité, couverture, constats triés par gravité puis par partie.
- Les 10 corrections à faire en premier, regroupées en tickets prêts à lancer (titre, périmètre, fichiers, test rouge attendu, budget S / M / L), en tenant compte des constats de Codex déjà poussés (bloquants.md de la branche audit-0.26.0) sans les dupliquer.
- Ce qui n'a pas pu être vérifié et pourquoi. Résumé en 15 lignes au plus.
