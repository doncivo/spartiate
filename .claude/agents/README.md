# Agents Spartiate (`.claude/agents/`)

24 fiches : 18 reprises de CircleTasks et réécrites pour Spartiate (D-34), 6 nouvelles. Chaque fiche suit la même structure : quand intervenir, fichiers (modifie / relit / ne touche jamais), décisions d'autres rôles, règles et invariants, preuves, « terminé quand / arbitrage requis quand ». Les 8 agents métier CircleTasks (`calendar-integration`, `checklists-events`, `focus-time`, `quick-capture`, `routines`, `spaces-goals`, `stats-history`, `tasks-planning`) sont supprimés dans la PR qui introduit ces fiches (D-46).

Référence : `docs/PRD.md` v6.2 (§ 24), `docs/decisions.md` (D-22 à D-47), `AGENTS.md`, `CLAUDE.md`.

## Les 24 rôles

| Agent | Modèle | Périmètre en une ligne | Actif depuis |
| --- | --- | --- | --- |
| `architect` | opus | Couches ADR 0001, contrats TypeScript et Tauri, plugins, dépendances, ADR et lignes D-n | SPA-000 |
| `product-owner` | sonnet | Tickets `docs/SPA-*.md`, critères Given / When / Then, clôture, `reprise.md`, `journal.md`, `capability-matrix.md` | SPA-000 |
| `qa-test` | sonnet | Tests Vitest / Playwright / cargo, preuve rouge, vecteurs, fixtures synthétiques, check-list iPhone | SPA-000 |
| `code-reviewer` | opus | Revue à froid du diff : couches, sécurité § 22, tests, DoD § 24.4 ; verdict APPROUVÉ / À CORRIGER | SPA-000 |
| `debugger` | sonnet | Reproduction, cause racine, correctif minimal, test de non-régression ; journaux exportés | SPA-000 |
| `docs-writer` | haiku | README, CHANGELOG, guides d'installation PC / iPhone, guide utilisateur, `docs/licences.md`, archivage D-40 ; `docs/PRD.md` uniquement pour porter une décision D-n déjà inscrite (ex. D-47 → v6.3), en commit dédié | SPA-000 |
| `ci-release` | sonnet | `tests.yml`, `build-windows.yml`, `build-ios.yml`, scripts release / ios / smoke, tags, `spartiate-releases` | SPA-000 |
| `desktop-tauri` | sonnet | Rust hors `sync/`, plugin SQL vendored et `ALLOWED_URL`, sauvegardes, `applog`, coffre, updater, NSIS, capabilities | SPA-001a |
| `ios-mobile` | opus | Plugins Swift (repris + `healthkit`, `live-activity`, `camera`), plist, entitlements, SideStore ; aucun Mac | SPA-001b (spikes SPA-006 / 007) |
| `sync-icloud` | opus | `src/sync`, `src/domain/sync`, `src-tauri/src/sync`, catalogue, séance close, vecteurs ; relecture obligatoire D-26 | SPA-001b |
| `domain-logic` | sonnet | Fonctions pures `src/domain` : moteurs § 11–12, 15, 16 (vecteurs d'abord), modules transverses | SPA-001b |
| `data-model` | sonnet | Migrations TypeScript (`0001_spartiate_init` puis une par itération), repositories, déclencheurs de capture | SPA-001b |
| `ui-design-system` | sonnet | Tokens § 18.4 (`src/ui/theme/tokens.css`), composants `src/ui`, coquilles fidèles aux 24 maquettes, `visual`, `theme/contrast.test.ts`, icône d'app (`content/brand/spartiate.svg`, `npx tauri icon`) | SPA-001b (charte en SPA-009) |
| `security-privacy` | opus | Audit sans écriture : clés, réseau Rust, CSP, capabilities, plist, journaux, données interdites aux API | SPA-001a |
| `performance` | sonnet | Budgets § 23.1, bundle de départ 358 400 octets gzip, graphiques < 300 ms, cycle de synchro, `generateSession` < 1 s | SPA-001b |
| `accessibility-i18n` | sonnet | Catalogues `fr` seuls (Q-5), aucun texte en dur, Dynamic Type, 44 pt, clavier PC, contraste, ton § 18.4 | SPA-001b |
| `notifications` | sonnet | Notifications locales iPhone seulement (ADR 0012, fenêtre de 64) : repos, matin, check-in, coucher, expiration | SPA-004 (I-02) puis I1 |
| `settings-personalization` | sonnet | Onglet Plus : profil, poids, apparence, sauvegarde, journaux, à propos, Diagnostic, export / import, onboarding | SPA-001b |
| `app-shell` | sonnet | Bootstrap, navigation sans routeur, `tabsConfig` 5 sections, `AppShell` / `TabRail` (`useLayout`, rupture 1 024 px), montage à la demande, bandeaux A-09 | SPA-001b |
| `training` | opus | Entraînement § 11–13 : séance, timer, moteur (binôme domain-logic), routines, programmes, bibliothèque et matériel côté écrans | I1 |
| `nutrition` | sonnet | Nutrition § 15 : journal, recherche Ciqual / OFF, scan, photo via `AiProvider`, TDEE, check-in, Stratégie | I4 |
| `recovery` | opus | Récupération § 16 : niveaux A / B / C, scores, publication `recovery_day` iPhone → PC, contrat fonctionnel `healthkit` | I5 (spike SPA-006 dès I0) |
| `content-data` | sonnet | `content/` : 150 exercices, 4 programmes, Ciqual ; schémas, `validate-content.mjs`, provenance, licences | I1 |
| `ai-integration` | sonnet | Appels IA § 17.2–17.4, photo de repas : `src/platform/ai`, commandes Rust avec clé du coffre, budget, validation à la main | Inactif avant I4 |

Modèles et outils des 18 agents repris : inchangés par rapport à CircleTasks. Nouveaux agents : `content-data` et `ai-integration` ont `WebFetch` (licences et documentation d'API à vérifier à la source) ; les quatre autres ont les outils standard (`Read, Write, Edit, Grep, Glob, Bash`).

## Ordre des passes (règle CircleTasks conservée)

Tout agent (Claude Code, Codex ou autre) assure **lui-même**, en passes distinctes et dans cet ordre, en consignant chaque résultat dans `docs/SPA-0xx.md` :

1. **product-owner** : fiche de ticket, critères Given / When / Then, hypothèses H-n, taille et budget tokens.
2. **agent du module** (celui dont le périmètre contient les fichiers : `training`, `data-model`, `sync-icloud`…) : preuve rouge (commit de tests qui échoue, écrit avec `qa-test`), puis code.
3. **qa-test** : un test par critère, suite du module en local, bundle mesuré, push, lecture unique de `tests.yml` (« suite verte »).
4. **code-reviewer** : relecture à froid du diff, verdict APPROUVÉ ou À CORRIGER ; pour une zone sensible, vérifie que le propriétaire ci-dessous a relu.

Puis relecture Codex (§ 24.2), fusion par PR quand « suite verte » est obtenu sur la branche à jour. Jamais de push direct sur `main`, jamais `--force`, jamais de boucle de surveillance de la CI. Toute preuve iPhone vient d'Ali ; aucun statut `CONFIRMED` depuis une lecture de code (D-36).

## Matrice de propriété des zones sensibles

| Zone | Écrit | Relit obligatoirement avant fusion | Tranche en cas de doute |
| --- | --- | --- | --- |
| Migrations `src/db/migrations/**`, registre, `APP_SCHEMA_VERSION` | `data-model` (version Rust alignée par `desktop-tauri`) | `sync-icloud` (colonnes publiées, déclencheurs, instantanés, restauration) | `architect` (schéma hors § 20.2) ; Ali (migration destructive, H-18) |
| Synchro `src/sync/**`, `src/domain/sync/**` (dont le catalogue `syncTables.ts`, `SYNC_TABLE_ORDER`, `naturalIds.ts`), `src-tauri/src/sync/**`, `src/platform/sync/**`, `features/sync` | `sync-icloud` (seul auteur du catalogue ; `data-model` demande l'ajout d'une colonne publiée dans la PR de sa migration) | `sync-icloud` relit toute PR tierce (D-26), puis `code-reviewer` | `architect` par ADR pour tout changement de protocole ; Ali pour toute perte de données |
| Plugins Swift `src-tauri/plugins/**`, `Info.ios.plist`, `plist-contract.json`, entitlements (source durable `src-tauri/ios/Spartiate.entitlements`, copiée dans `gen/apple` par `scripts/ios/apply-entitlements.mjs` en CI ; `gen/` est ignoré par git) | `ios-mobile` | `security-privacy` (permissions, textes d'usage) ; `ci-release` (étape de build) | `architect` (contrat, clé plist interdite) ; Ali (issue d'un spike, `CONFIRMED` / `BLOCKED`) |
| Workflows `.github/workflows/*.yml`, scripts release / ios / smoke, tags, secrets nommés | `ci-release` | `security-privacy` (permissions des jobs, secrets) | `architect` (action tierce) ; Ali (tag, secrets GitHub, quota) |
| Tokens UI `src/ui/theme/tokens.css`, composants `src/ui`, coquilles, maquettes | `ui-design-system` (coquilles branchées par `app-shell`) | `accessibility-i18n` (contraste, Dynamic Type, clavier) ; `performance` (départ) | Ali (écart maquette, nouvelle planche, point de rupture) |
| Contenu JSON `content/**`, `validate-content.mjs`, `docs/licences.md` (données et médias) | `content-data` | `training` / `nutrition` (sémantique) ; `docs-writer` (mise en forme des licences) | Ali (relecture H-8, médias Q-3, licence douteuse) |
| Appels IA `src/platform/ai/**`, `src/domain/ai/**`, `src-tauri/src/ai/**`, écran Clé IA | `ai-integration` (Rust avec `desktop-tauri`, écran avec `settings-personalization`) | `security-privacy` (clé, données interdites, journaux) | Ali (fournisseur Q-2, plafond H-14, toute donnée à la frontière) ; `architect` (abstraction, crate) |

Parcours I6 (§ 8, § 17) et leurs propriétaires : bilans rédigés et import de programme → `ai-integration` (agrégats par `training` / `nutrition`) ; vidéos d'exercices et complétion IA d'un exercice custom → `content-data` (+ `ai-integration`) ; photos de progression et mensurations → `settings-personalization` (écran Corps) avec `sync-icloud` (métadonnées publiées) ; cardio GPS (plugin geolocation officiel) → `ios-mobile` (plugin) + `recovery` (effort, écriture Santé) ; App Intents / Siri / bouton Action → `ios-mobile` + `app-shell` ; Describe (dictée) → `nutrition` avec le plugin `speech` (`ios-mobile`) ; compléments et rappels → `nutrition` + `notifications`.

Zones transverses sans propriétaire unique : `src/domain/**` hors `sync` (`domain-logic` écrit les fonctions ; l'agent du module écrit les vecteurs) ; `src/i18n/**` (l'agent du module écrit les clés, `accessibility-i18n` relit et tient l'infrastructure) ; `tests/bundle/start-modules.json` (ajout par l'agent du module, commit justifié, relu par `performance`) ; `docs/decisions.md` (Ali seul ; les agents proposent le texte) ; `docs/PRD.md` (fond : Ali, par décision D-n ; texte : `docs-writer` porte une décision D-n déjà inscrite, en commit dédié « PRD vX.Y : D-nn », rien d'autre).

## Règles rappelées dans toutes les fiches

- Bundle de départ ≤ 358 400 octets gzip, jamais relevé ; écrans à la demande dès leur création ; `npm run test:bundle` avant tout push.
- Couverture `src/domain/**` ≥ 80 % (lignes, fonctions, branches, instructions), `src/domain/training` ≥ 90 %.
- Preuve rouge avant code ; pas de `test.fixme`, `skip`, délai ou timeout allongé ; aucun seuil relâché.
- Base `spartiate.db` : `TAURI_DB_URL`, `ALLOWED_URL`, `DB_FILE` changent ensemble ; 14 sauvegardes quotidiennes ; journaux `spartiate.log` + `.1`, 256 Kio chacun.
- Données réelles : CircleTasks (`%APPDATA%\fr.circletasks.planner`, `iCloud Drive/CircleTasks`) interdites toujours ; conteneur `fr.spartiate.app` = laboratoire jusqu'à la première utilisation réelle annoncée par Ali (D-38).
- SideStore : ne jamais désinstaller l'app, ne jamais conseiller la réinstallation ; une compilation `build-ios.yml` par lot.
- Extensions iOS : `BLOCKED` = widgets, App Groups, push, app Watch ; `UNVERIFIED` à tester = Live Activity (SPA-007), HealthKit via SideStore (SPA-006).
- FR seul ; tokens § 18.4 ; maquettes `docs/maquettes/` (D-21) ; Dynamic Type ; cibles ≥ 44 pt.
