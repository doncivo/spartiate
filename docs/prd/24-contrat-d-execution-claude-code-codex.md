## 24. Contrat d'exécution (Claude Code + Codex)

### 24.1 Agents (`.claude/agents/`, D-34)

Correspondance explicite avec les 26 agents de CircleTasks. Aucune étape obligatoire ne dépend d'un nom inexistant.

| Agent | Sort | Rôle sur Spartiate |
| --- | --- | --- |
| `architect`, `product-owner`, `qa-test`, `code-reviewer`, `debugger`, `docs-writer` | Gardés | Passes de travail (§ 24.2) ; `code-reviewer` vérifie couches ADR 0001, sécurité § 22, tests, DoD § 24.4 |
| `ci-release` | Gardé | Tags `vX.Y.Z` / `ios-vX.Y.Z`, workflows, `source.json`, publication ; identifiants et dépôts Spartiate |
| `desktop-tauri` | Gardé | Commandes Rust, plugin SQL vendored, sauvegardes, updater |
| `ios-mobile` | Gardé | Plugins Swift, contrat plist, entitlements ; + `healthkit`, `live-activity` |
| `sync-icloud` | Gardé | Relit toute PR touchant `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` (D-26) |
| `domain-logic` | Gardé | Moteurs `src/domain/*` : implémente uniquement depuis les § 11–16, vecteurs d'abord |
| `data-model` | Gardé | Migrations, repositories, catalogue (§ 20) |
| `ui-design-system`, `accessibility-i18n` | Gardés | Tokens § 18.4, maquettes § 18.5, accessibilité § 18.6, FR seul |
| `security-privacy`, `performance`, `notifications`, `settings-personalization` | Gardés | § 22, § 23.1 perf et bundle, ADR 0012, `settings` |
| `calendar-integration`, `checklists-events`, `focus-time`, `quick-capture`, `routines`, `spaces-goals`, `stats-history`, `tasks-planning` | **Supprimés** (métier CircleTasks, SPA-001b) | — |

### 24.2 Passes et outils

| Passe | Outil | Règle |
| --- | --- | --- |
| Spécification | Ce PRD (`docs/PRD.md`) + ADR | Toute décision nouvelle = ADR numéroté ; toute hypothèse = `H-n` dans le registre § 26 |
| Implémentation | Claude Code (Opus) | Un ticket = une branche = une PR ; **preuve rouge avant code pour toute story** : un commit qui n'ajoute que les tests et échoue, puis le commit de code qui les fait passer, les deux identifiants dans la fiche |
| Relecture croisée | Codex | Relit chaque PR ; commentaires résolus avant merge ; ne pousse jamais directement |
| Intégration | CI GitHub | Verte obligatoire ; merge par toi |
| Validation iPhone | Toi | Check-list § 23.1 ; ton retour clôt le ticket. Chaque agent assure lui-même product-owner → agent du module → qa-test → code-reviewer en passes distinctes, dans cet ordre, et consigne chaque résultat |

### 24.3 Budget et discipline

- Tokens : chaque ticket annonce un budget (S ≤ 50 k, M ≤ 150 k, L ≤ 400 k) ; dépassement = arrêt et point d'étape, pas de poursuite silencieuse.
- Interdits (AGENTS.md) : `git push --force`, `git reset --hard`, `rm -rf`, lecture des données réelles (CircleTasks toujours ; Spartiate dès ta première utilisation réelle, D-38), installation manuelle demandée à toi (D-39), suppression de l'app sideloadée, secrets dans un prompt, boucle de surveillance de la CI (une lecture à la fois, `gh pr checks` / `gh run view`), écriture hors de `C:\Dev\spartiate` et de ses worktrees.
- Tests : jamais de test désactivé, sauté ou retardé ; **pas de `test.fixme` de commodité** — on adapte le test, ou on supprime celui d'une fonction effectivement supprimée (D-35). Aucun seuil de taille ni de couverture relâché.
- Bundle de départ : plafond **358 400 octets gzip** (`tests/bundle/startBundle.test.ts`), toujours écrit en octets, jamais relevé ; tout écran hors du premier affichage d'Aujourd'hui est en chargement à la demande dès sa création ; garde par liste blanche `tests/bundle/start-modules.json` ; `npm run test:bundle` avant tout push.
- Toute capacité non prouvée reste `UNVERIFIED` dans `docs/capability-matrix.md` jusqu'à un spike documenté (log CI ou capture iPhone). Aucun statut `CONFIRMED` depuis une lecture de code (D-36).

### 24.4 Definition of Done (par ticket)

1. Critères d'acceptation du ticket couverts par un test automatisé (preuve rouge puis verte) ou, pour l'iPhone, par la check-list manuelle.
2. `tests.yml` au statut « suite verte » sur la branche à jour ; bundle mesuré avant push ; pas de nouvelle dépendance non justifiée.
3. Couches ADR 0001 respectées (vérifié par `code-reviewer`).
4. `docs/capability-matrix.md` et registre `H-n` mis à jour si le ticket touche une hypothèse.
5. Note de version (`scripts/release/release-notes.mjs`) à jour.
6. Relecture Codex résolue.

### 24.5 Gabarit de ticket

```md
# SPA-0xx — <titre>
Itération : I0 | Taille : S/M/L | Budget tokens : …
## Objectif
## Hors périmètre
## Références PRD : § … | ADR : … | Hypothèses : H-…
## Critères d'acceptation (Given / When / Then)
## Tests à écrire
## Risques et plan B
## Preuve attendue (log CI, capture, vecteur)
## Relais (auteur · relecteur obligatoire · livrable · test de réception · dépendances)
```

La rubrique « Relais » (D-48) est un tableau d’une ligne par lot : **auteur**, **relecteur obligatoire**, **livrable**, **test de réception**, **dépendances**. Elle ne duplique pas les fiches `.claude/agents/`, qui restent la référence des règles.
