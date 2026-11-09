# DEP-01 : SQLite embarqué à jour (libsqlite3-sys >= 0.39)

**Statut** : à faire. **Revue au 30 novembre 2026 au plus tard** (D-84). Non réalisé en 0.9.2.

## Contexte
RUSTSEC-2026-0459 (CVE-2026-119375) : `libsqlite3-sys` 0.30.1 embarque SQLite < 3.54.0. `cargo audit` l'ignore par exception
justifiée dans `.github/workflows/tests.yml` (D-84).

## Périmètre
- Dans `src-tauri/vendor/tauri-plugin-sql` : passer `sqlx` (0.8.6) et `rusqlite` (0.32) à des versions dont `libsqlite3-sys` est >= 0.39
  (rusqlite 0.41, Rust 1.89 requis ; vérifier la version de sqlx compatible).
- Retirer `--ignore RUSTSEC-2026-0459` de `tests.yml` et son commentaire.

## Critères
- `cargo audit` vert sans l'exception ; `cargo test --locked -p tauri-plugin-sql --features sqlite` et la suite desktop verts.
- Migrations 1 à 9 rejouées sur une base de laboratoire (D-38), aucune donnée réelle ; garde du plugin inchangée.
- Passes desktop-tauri, data-model, qa-test, code-reviewer ; builds PC et iPhone vérifiés.
