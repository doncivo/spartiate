# Provenance de cette copie (DEP-01, Spartiate 0.18.1)

- Paquet : `sqlx-sqlite` 0.8.6, publié sur crates.io par le projet SQLx (https://github.com/launchbadge/sqlx), licence
  `MIT OR Apache-2.0` (`LICENSE-MIT`, `LICENSE-APACHE`, inchangés).
- Source : archive `sqlx-sqlite-0.8.6.crate` du registre crates.io, empreinte SHA-256
  `c2d12fe70b2c1b4401038055f90f151b78208de1f9f89a7dbfd41587a10c3eea` (celle de `src-tauri/Cargo.lock` avant DEP-01), extraite
  telle quelle ; commit amont `bab1b022bd56a64f9a08b46b36b97c5cff19d77e` (`.cargo_vcs_info.json`).
- Branchement : `[patch.crates-io]` de `src-tauri/Cargo.toml` ; hors du workspace (`exclude`), donc ni `cargo fmt` ni clippy ne la
  réécrivent.

## Seul écart avec l'amont

`Cargo.toml` (manifeste normalisé, celui que Cargo lit) : borne de `libsqlite3-sys` élargie de `0.30.1` (soit `^0.30.1`) à
`>=0.30.1, <0.40.0`, pour que le graphe n'ait qu'un `libsqlite3-sys` 0.39 (`links = "sqlite3"`), partagé avec rusqlite 0.41 et le
plugin SQL vendored, qui embarque SQLite >= 3.54.0 (RUSTSEC-2026-0459). Aucune ligne de `src/` modifiée ; `Cargo.toml.orig` est
laissé tel que publié, pour la comparaison.

## Retrait

Supprimer cette copie et son entrée `[patch.crates-io]` dès qu'une version publiée de `sqlx` accepte `libsqlite3-sys` >= 0.39 (D-160).
