# Journal Spartiate

Une entrée par lot, écrite jamais relue en entier (D-52). Le journal de l'ancien projet est archivé : `docs/archive/circletasks/journal.md` (D-40).

| Date | Ticket · lot | Fichiers | Constat · décision |
| --- | --- | --- | --- |
| 2026-11-01 | SPA-001a · tests rouges | `scripts/release/{identity,agents,docs-paths,prd-split,rename}.test.ts`, `docs/archive/PRD-v6.2.md` | Commit 2346b2dc : cinq fichiers de tests en échec faute d'implémentation (modules `lib/` et `rename.mjs` absents). |
| 2026-11-01 | SPA-001a · renommage | `scripts/release/rename.mjs` et `lib/` | Table CircleTasks → Spartiate sur les fichiers suivis seulement, idempotente, références protégées ; rapport joint à la PR. |
| 2026-11-01 | SPA-001a · updater D-30 | `tauri.conf.json`, `desktop.rs`, `src/features/updater`, `src/platform/desktop` | Bloc `plugins.updater` retiré et plugin non enregistré (sans configuration son initialisation échouerait) ; état « non configuré », aucune requête ; SPA-002 le rétablit avec la nouvelle clé. |
| 2026-11-01 | SPA-001a · journal | `docs/journal.md` | Journal CircleTasks archivé avant création de celui-ci (critère 8). |
| 2026-11-01 | SPA-001a · icône | `content/brand/spartiate.svg`, `src-tauri/icons/*` | `npx tauri icon` (dossier `android` généré puis retiré : hors périmètre). Capture de la fenêtre soumise à Ali avant push. |
| 2026-11-01 | SPA-001a · PRD v6.3 | `docs/prd/`, `docs/PRD.md`, `scripts/release/fixtures/prd-v6.3-changes.json` | 30 chapitres ; 26 corrections listées (D-47, D-48, D-49, D-58, D-59) ; conservation vérifiée par `prd-split.test.ts` contre `docs/archive/PRD-v6.2.md`. |
| 2026-11-01 | SPA-001a · consignes | `CLAUDE.md`, `AGENTS.md`, `docs/decisions.md`, `docs/a-creer.md` | Fusion D-42 (règles permanentes conservées, données des deux apps protégées) ; D-1 à D-21 recopiées dans les décisions ; registre des chemins futurs (D-50). |
| 2026-11-01 | SPA-001a · protocole | `src-tauri/src/sync/crypto.rs`, `src/platform/sync/memory.ts`, `tests/sim/syncCodec.ts` | Constat : le renommage mécanique changeait le sel HKDF (« circletasks » → « spartiate »), ce qui aurait rendu les vecteurs de synchro illisibles ; sel figé (D-26), `rename.mjs` protège toute ligne HKDF, test ajouté. |
