# Journal Spartiate

Une entrée par lot, écrite jamais relue en entier (D-52). Le journal de l'ancien projet est archivé : `docs/archive/circletasks/journal.md` (D-40).

| Date | Ticket · lot | Fichiers | Constat · décision |
| --- | --- | --- | --- |
| 2026-11-01 | SPA-001a · tests rouges | `scripts/release/{identity,agents,docs-paths,prd-split,rename}.test.ts`, `docs/archive/PRD-v6.2.md` | Commit 2346b2dc : cinq fichiers de tests en échec faute d'implémentation (modules `lib/` et `rename.mjs` absents). |
| 2026-11-01 | SPA-001a · renommage | `scripts/release/rename.mjs` et `lib/` | Table CircleTasks → Spartiate sur les fichiers suivis seulement, idempotente, références protégées ; rapport joint à la PR. |
| 2026-11-01 | SPA-001a · updater D-30 | `tauri.conf.json`, `desktop.rs`, `src/features/updater`, `src/platform/desktop` | Bloc `plugins.updater` retiré et plugin non enregistré (sans configuration son initialisation échouerait) ; état « non configuré », aucune requête ; SPA-002 le rétablit avec la nouvelle clé. |
| 2026-11-01 | SPA-001a · journal | `docs/journal.md` | Journal CircleTasks archivé avant création de celui-ci (critère 8). |
