# PRD Spartiate v6.3 — index des chapitres

Le PRD est lu **par chapitre** (D-49) : un ticket cite des chapitres, jamais « le PRD » ; un agent ne lit que les chapitres cités. Un chapitre = une section du PRD v6.2, texte conservé à l'identique hors des corrections D-47, D-48, D-58, D-59 listées dans `scripts/release/fixtures/prd-v6.3-changes.json` (test `scripts/release/prd-split.test.ts`). Les renvois « § n » désignent le chapitre `n`. La v6.2 d'origine est conservée dans `docs/archive/PRD-v6.2.md`. Le découpage se rejoue avec `node scripts/release/split-prd.mjs`.

| § | Chapitre | Contenu en deux lignes | Agents concernés |
| ---: | --- | --- | --- |
| 0 | [Statut et conventions](00-statut-et-conventions.md) | Version, révisions 6.1 à 6.3, niveaux normatifs, statuts de capacité (CONFIRMED / UNVERIFIED / BLOCKED / INHERITED), hypothèses H-n. | product-owner, docs-writer |
| 1 | [Décision produit, mission, principes](01-decision-produit-mission-principes.md) | Pourquoi Spartiate, ce qu'il assemble et les principes qui tranchent. Lire avant toute décision de périmètre. | product-owner, architect |
| 2 | [Contexte — faits établis](02-contexte-faits-etablis.md) | Faits vérifiés sur le fork, les outils et les contraintes (SideStore, iOS sans Mac). | architect, ios-mobile |
| 3 | [Pile et fork](03-pile-et-fork.md) | Pile (ADR 0001), ce qui est gardé, retiré et ajouté par rapport à CircleTasks. | architect, data-model, sync-icloud |
| 4 | [Répartition PC / iPhone](04-repartition-pc-iphone.md) | Qui fait quoi sur chaque appareil ; règles de répartition. | architect, app-shell |
| 5 | [Chaîne de build, installation et mise à jour](05-chaine-de-build-installation-et-mise-a-jour.md) | `build-windows.yml`, `build-ios.yml`, SideStore, ce qui est hérité et ce qui reste à prouver. | ci-release, ios-mobile, desktop-tauri |
| 6 | [Matrice de capacités — état initial](06-matrice-de-capacites-etat-initial.md) | Capacités par statut, risques et fallbacks (HealthKit, Live Activity…). | product-owner, ios-mobile, recovery |
| 7 | [Gate I0](07-gate-i0-aucun-travail-i1-avant-passage.md) | Essais obligatoires et conditionnels avant I1 ; seuil de passage ; fallbacks ; versions 0.1.0 / 0.1.1 et critères HealthKit (D-58, D-59). | product-owner, qa-test, ci-release |
| 8 | [Itérations et critères « terminé »](08-iterations-et-criteres-termine.md) | I0 à I6, périmètre de chaque itération et liste « Hors périmètre ». | product-owner |
| 9 | [Synchronisation PC ↔ iPhone](09-synchronisation-pc-iphone.md) | Tables publiées, règles de synchro, périmètre explicite (D-26, D-27). | sync-icloud, data-model |
| 10 | [Onboarding et profil](10-onboarding-et-profil.md) | Parcours J0 à J7, onboarding, profil éditable, permissions iPhone. | settings-personalization, app-shell |
| 11 | [Moteur de progression](11-moteur-de-progression-src-domain-training.md) | Entrée, ordre de calcul, règles et constantes, garde-fous et tests du moteur (`src/domain/training`). | domain-logic, training |
| 12 | [Génération de séance et mésocycle](12-generation-de-seance-et-mesocycle-src-domain-training-i3.md) | Séance générée, mésocycle, modes, programmes de départ, pause et reprise. | domain-logic, training, content-data |
| 13 | [Séance active](13-seance-active-i1-enrichie-i2.md) | Démarrage, écran, timer, persistance, fin de séance, compléments du benchmark. | training, notifications |
| 14 | [Bibliothèque d'exercices et profils de matériel](14-bibliotheque-d-exercices-et-profils-de-materiel.md) | 150 exercices, fiche et recherche, profils de matériel. | content-data, training |
| 15 | [Nutrition adaptative](15-nutrition-adaptative-src-domain-nutrition-i4.md) | Formules, fiabilité, saisie, bases alimentaires et licences, écrans. | nutrition, domain-logic, ai-integration |
| 16 | [Récupération](16-recuperation-src-domain-recovery-plugin-healthkit-i5.md) | Niveaux A / B / C, plugin `healthkit`, scores, effets et publication. | recovery, ios-mobile |
| 17 | [Progrès, bilans, appels IA](17-progres-bilans-appels-ia.md) | Indicateurs, règles des appels IA, bilans et import de programme (I6). | ai-integration, nutrition, training |
| 18 | [Navigation, écrans et états dégradés](18-navigation-ecrans-et-etats-degrades.md) | Coquille `AppShell` / `TabRail`, écrans par onglet, états dégradés, charte § 18.4, maquettes, accessibilité. | app-shell, ui-design-system, accessibility-i18n |
| 19 | [Plugins Swift et contrat iOS](19-plugins-swift-et-contrat-ios.md) | Plugins repris et nouveaux, contrat `Info.plist`, entitlements. | ios-mobile, security-privacy |
| 20 | [Modèle de données SQLite](20-modele-de-donnees-sqlite.md) | Tables techniques héritées, colonnes communes, tables, index, migrations. | data-model, sync-icloud |
| 21 | [Persistance, sauvegarde, export / import](21-persistance-sauvegarde-export-import.md) | Emplacements, sauvegardes et journaux (D-32), export / import, réinitialisation. | desktop-tauri, settings-personalization |
| 22 | [Sécurité, journaux, clé API](22-securite-journaux-cle-api.md) | WebView, secrets, dépendances, journaux sans donnée corporelle. | security-privacy |
| 23 | [Qualité et tests](23-qualite-et-tests.md) | Pyramide de tests, CI, matrice de non-régression, budgets. | qa-test, ci-release, performance |
| 24 | [Contrat d'exécution](24-contrat-d-execution-claude-code-codex.md) | Agents, passes, budget, Definition of Done, gabarit de ticket avec « Relais » (D-48). | product-owner, architect |
| 25 | [Plan de fork et tickets I0](25-plan-de-fork-et-tickets-i0.md) | SPA-001 à SPA-010 : objectifs, tailles, preuves. | product-owner |
| 26 | [Registre des décisions et des hypothèses](26-registre-des-decisions-et-des-hypotheses.md) | D-1 à D-45 et hypothèses H-n (H-3a à H-3c, H-19a). La suite des décisions est dans `docs/decisions.md`. | product-owner, architect |
| 27 | [Questions ouvertes, glossaire, références](27-questions-ouvertes-glossaire-references.md) | Q-n ouvertes, glossaire, références. | product-owner |
| 28 | [Annexe A — `CLAUDE.md` et `AGENTS.md`](28-annexe-a-claude-md-et-agents-md-du-fork-fusion-d-42.md) | Cible de la fusion des consignes (D-42). | product-owner, architect |
| 29 | [Annexe B — `capability-matrix.md`](29-annexe-b-docs-capability-matrix-md-etat-initial.md) | État initial de la matrice de capacités (créée en SPA-001b). | product-owner |
