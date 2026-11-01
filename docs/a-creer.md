# Fichiers à créer — registre des chemins futurs (D-50)

Tout chemin de la forme `src/…`, `src-tauri/…`, `scripts/…`, `tests/…`, `content/…`, `.github/…`, `.claude/…` cité entre accents graves dans `docs/prd/**`, `docs/SPA-*.md`, `docs/reprise.md`, `docs/decisions.md` et `.claude/agents/**` existe dans le dépôt **ou** figure ici avec son ticket et son propriétaire. Contrôle : `scripts/release/docs-paths.test.ts`.

- Un chemin se termine par `/` quand il désigne un dossier : tout ce qui est dessous est couvert.
- Quand le ticket crée le chemin, la ligne est retirée dans la même PR (le test n'exige plus l'entrée) ; une ligne dont le fichier existe déjà est une dette de ce registre, à nettoyer.
- Les globs (`*`, `{a,b}`), les paramètres (`<nom>`) et les alternatives (`a|b`) ne sont pas des fichiers à créer. Une mention historique ou négative garde sa place, avec `<!-- ancien-ok: motif -->` si la ligne ne se qualifie pas d'elle-même.

| Chemin | Ticket | Propriétaire |
| --- | --- | --- |
| `src/db/migrations/0001_spartiate_init.ts` | SPA-001b | data-model |
| `src-tauri/ios/Spartiate.entitlements` | SPA-003 | ios-mobile |
| `src-tauri/gen/apple/Spartiate.entitlements` | SPA-003 | ios-mobile |
| `scripts/ios/apply-entitlements.mjs` | SPA-003 | ios-mobile |
| `src-tauri/plugins/healthkit/` | SPA-006 | ios-mobile |
| `src/platform/healthkit/` | SPA-006 | ios-mobile |
| `src-tauri/plugins/live-activity/` | SPA-007 | ios-mobile |
| `src/platform/liveActivity/` | SPA-007 | ios-mobile |
| `src/domain/training/` | I1 | domain-logic |
| `tests/fixtures/training/` | I1 | domain-logic |
| `src/db/repositories/workoutRepository.ts` | I1 | data-model |
| `content/exercises/` | I1 | content-data |
| `scripts/content/validate-content.mjs` | I1 | content-data |
| `scripts/content/validate.test.ts` | I1 | content-data |
| `tests/fixtures/perf/` | I1 | performance |
| `src-tauri/plugins/camera/` | I4 | ios-mobile |
| `src/domain/nutrition/` | I4 | domain-logic |
| `tests/fixtures/nutrition/` | I4 | nutrition |
| `src/db/repositories/foodRepository.ts` | I4 | data-model |
| `content/food/` | I4 | content-data |
| `src/platform/ai/` | I4 | ai-integration |
| `src/domain/ai/` | I4 | ai-integration |
| `src/i18n/fr.ai.ts` | I4 | ai-integration |
| `src/db/repositories/aiCallRepository.ts` | I4 | data-model |
| `src-tauri/capabilities/ai.json` | I4 | ai-integration |
| `src-tauri/tests/desktop/ai.rs` | I4 | ai-integration |
| `tests/fixtures/ai/` | I4 | ai-integration |
| `src/domain/recovery/` | I5 | domain-logic |
| `src/db/repositories/recoveryDayRepository.ts` | I5 | data-model |
| `tests/unit/sync/workoutClosure.test.ts` | I1 | sync-icloud |

## Dépendances gardées sans usage jusqu'à SPA-002 (D-30)

- `tauri-plugin-updater` (crate, `src-tauri/Cargo.toml`) et `@tauri-apps/plugin-updater` (npm, `package.json`) : conservées, **non initialisées** côté Rust, aucun chemin d'exécution ne les appelle (`src/features/updater/updaterNoPlugin.test.ts`). SPA-002 (ci-release / desktop-tauri) les rétablit avec la nouvelle clé publique, le point d'accès `spartiate-releases`, l'enregistrement du plugin et les permissions `updater:*`.
