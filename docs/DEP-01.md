# DEP-01 : SQLite embarqué à jour (libsqlite3-sys >= 0.39)

**Statut** : code et preuves locales en 0.18.1 (D-160), PR ouverte, non fusionnée ; CI (cargo audit sans exception) et compilation iPhone à constater. Historique : non réalisé en 0.9.2, garde-fou -wal en 0.9.4 (D-87).

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

## Résultat de la vérification (0.9.4, 9 novembre 2026)
- Aucune version publiée de `sqlx` n'accepte `libsqlite3-sys` >= 0.39 avec rusqlite : sqlx / sqlx-sqlite 0.8.6 exige `^0.30.1`, 0.9.0 (la plus récente) `>=0.30.1, <0.38.0` ; rusqlite 0.41 exige `^0.39.0`, 0.40 `^0.38.2`. Un seul `libsqlite3-sys` peut exister dans le graphe (`links = "sqlite3"`). Passer à sqlx 0.9.0 ne corrigerait rien (SQLite embarqué toujours < 3.54.0). Ni fork de sqlx, ni version alpha ou non publiée (règle d'Ali).
- **Aucune dépendance modifiée** ; l'exception D-84 (`--ignore RUSTSEC-2026-0459` dans tests.yml) reste en place.
- Décision d'Ali (option 2) : garde-fou dans l'app, 0.9.4. Avant toute restauration (`check_backup_file`, avant la moindre ouverture), un fichier de base dont le `-wal` voisin annonce une taille de page différente de la sienne est refusé : code `wal-page-size`, message français (« son journal voisin (-wal) ne correspond pas à lui »), événement de journal de nom fixe `backup` / `wal-page-size-mismatch`. Tests : `src-tauri/tests/desktop/restore_wal_guard.rs`.
- **Ce garde-fou réduit le risque, il ne corrige pas la faille** : le moteur embarqué reste SQLite < 3.54.0 (libsqlite3-sys 0.30.1). La revue du 30 novembre 2026 est maintenue ; options à ce moment : version de sqlx acceptant libsqlite3-sys >= 0.39, ou réécriture du plugin sur rusqlite 0.41 en gardant la garde (autorisateur, liste blanche de pragmas, pool à une connexion, filtre VACUUM).

## Passes (0.9.4)
- product-owner : périmètre = option 2 d'Ali (garde-fou -wal) + décote de position sur charge totale ; aucune migration, aucune dépendance changée, D-84 et revue du 30 novembre maintenues.
- desktop-tauri / data-model : `refuse_foreign_wal` posée avant toute ouverture SQLite dans `check_backup_file` (donc liste, vérification nommée et restauration) ; sauvegardes de l'app sans `-wal` non touchées ; schéma inchangé. Limite connue : intervalle contrôle/ouverture (un `-wal` écrit entre les deux), risque local faible, la garde réduit le risque sans le supprimer.
- training / domain-logic : décote sur la charge totale (lest : vers le bas, jamais négatif ; assistance : vers le haut) ; sans pesée ou sans fraction, comportement d'avant.
- qa-test : tests rouges avant chaque correctif (`restore_wal_guard.rs`, `dep01.positionTotal.test.ts`), puis verts ; aucun test désactivé.
- code-reviewer : 2 points importants corrigés avec test rouge d'abord : (1) pourcentage dit sur la charge totale (`positionBasisKg`), pas sur le lest ; (2) traction assistée : raison principale « position » et phrase juste quand l'assistance monte. Réserve restante (hors périmètre) : phrase d'inactivité en assistée, comportement d'avant inchangé.

## Réalisation (0.18.1, 13 novembre 2026, D-160)

Essai demandé par Ali le 12 novembre : sqlx-sqlite 0.9.0 exige toujours `libsqlite3-sys` < 0.38 ; on copie donc sqlx-sqlite 0.8.6 (version
de Cargo.lock) et on n'élargit que sa borne.

- Copie : `src-tauri/vendor/sqlx-sqlite`, extraite de l'archive crates.io dont la SHA-256 est celle de l'ancien Cargo.lock
  (`c2d12fe7…`), licences MIT et Apache incluses, `PROVENANCE-SPARTIATE.md`. `diff -r` avec le registre : seule la borne
  `libsqlite3-sys` du `Cargo.toml` (`>=0.30.1, <0.40.0`). Branchée par `[patch.crates-io]`, hors du workspace (`exclude`).
- Graphe : un seul `libsqlite3-sys` 0.39.1 (`cargo tree -d -i libsqlite3-sys --target all`), SQLite **3.54.1** ; rusqlite 0.32.1 → 0.41.1
  (fonction `fallible_uint`) ; plugin SQL : `libsqlite3-sys` `0.39`. `cargo update -p sqlx-sqlite -p rusqlite -p libsqlite3-sys` seulement :
  hashlink 0.9.1 → 0.12.2, ahash et hashbrown 0.14 retirés, `sqlite-wasm-rs` 0.6.3 et `rsqlite-vfs` 0.2.0 ajoutés.
- `sqlite-wasm-rs` et `rsqlite-vfs` : `cargo tree -i` sur l'hôte Windows et sur `aarch64-apple-ios` : rien (« nothing to print ») ;
  avec `--target all` : seulement par rusqlite pour la cible wasm. Jamais compilés pour Spartiate.
- Commits : rouge `e70bd165` (SQLite 3.46.0 < 3.54.0 sur les deux chemins, rusqlite et plugin), copie telle quelle `e74b5906`,
  branchement `af66232a`, vert `25da782d` (rusqlite `fallible_uint` : sans elle, 6 erreurs `u64: FromSql`).
- Preuves locales (Windows, `-j 2`, l'une après l'autre ; une première tentative sans `-j 2` a été arrêtée par le système, mémoire basse,
  sans résultat) : `cargo test --locked -p tauri-plugin-sql --features sqlite` 31 verts ; `cargo test --locked --features test-hooks --test
  desktop` 841 verts, 2 ignorés d'origine (vecteurs ponctuels, iCloud réel), après fusion de main (0.18.0) ; `cargo clippy --locked --
  -D warnings` et `cargo fmt --check` verts. `cargo audit` absent en local : la CI tranche, sans `--ignore RUSTSEC-2026-0459`.
- Gardé : garde-fou `-wal` de D-87 (`restore_wal_guard.rs` vert), garde du plugin (autorisateur, pragmas, pool à une connexion).

## Passes (0.18.1)

### product-owner
Critères : (1) un seul `libsqlite3-sys` >= 0.39 dans Cargo.lock ; (2) `select sqlite_version()` >= 3.54.0 par rusqlite et par le plugin,
rouge avant, vert après ; (3) suites desktop et plugin, clippy, fmt verts ; (4) cargo audit sans l'exception ; (5) aucune migration, aucun
écran, aucune donnée réelle. Aucune hypothèse H-n touchée. Les critères 1 à 3 et 5 sont prouvés ; 4 et la compilation iPhone restent à la
CI et à Ali (build-ios), écrits dans le statut. D-84 levée par une ligne nouvelle (D-160), l'ancienne n'est pas réécrite.

### architect (dépendance)
Dépendance nouvelle : aucune bibliothèque nouvelle compilée ; seul changement structurel, une copie vendored d'un paquet déjà présent,
sur le modèle de `tauri-plugin-sql` (licence, provenance, écart unique, retrait daté par condition : un sqlx publié acceptant >= 0.39).
Licences inchangées (MIT OR Apache-2.0 ; SQLite domaine public). iOS : `cargo tree --target aarch64-apple-ios` sans paquet wasm ni PC ;
la compilation C de SQLite 3.54.1 sur iOS reste à constater par build-ios. Bundle de départ non touché (aucun fichier front).
Risque accepté : sqlx-sqlite 0.8.6 n'a pas été écrit pour `libsqlite3-sys` 0.39 ; il compile sans modification et toutes les suites qui
l'exercent passent ; la borne < 0.40 empêche une montée non essayée. Avertissements : 40 dépréciations de `time` dans la copie (paquet
local, avertissements non plafonnés), sans effet sur clippy du workspace ; acceptés plutôt que de modifier le code amont.

### desktop-tauri (agent du module)
Plugin SQL vendored : seule la version de `libsqlite3-sys` change ; `guard.rs` compile tel quel contre 0.39 (`sqlite3_set_authorizer`,
`sqlite3_limit`, constantes) et `guard_tests.rs` passe. Rusqlite 0.41 : `fallible_uint` rend la lecture et l'écriture de `u64` identiques
à la 0.32 (conversion vérifiée, erreur hors bornes), aucun code applicatif modifié. Fichiers de base : format SQLite rétrocompatible, une
base ou une sauvegarde écrite en 3.54.1 reste lisible par une version 0.18.0 (3.46.0) ; aucun mode ni pragma nouveau utilisé.

### security-privacy (dépendance native)
CONFORME. Source de la copie vérifiée par empreinte ; C de SQLite pris de `libsqlite3-sys` 0.39.1 (crates.io, somme dans Cargo.lock).
Aucun appel réseau, aucune capability, aucune permission, aucun journal nouveaux. L'exception RUSTSEC-2026-0459 est retirée ; seule
RUSTSEC-2023-0071 reste (rsa jamais compilé, étape de preuve inchangée). Garde-fou `-wal` maintenu en défense en profondeur. Basse :
`sqlite-wasm-rs` figure dans Cargo.lock (donc lu par cargo audit) sans être compilé ; si un avis le vise un jour, la CI le dira.

### qa-test
Rouge `e70bd165` : `dep01_rusqlite_engine_is_at_least_3_54_0`, `dep01_plugin_sql_engine_is_at_least_3_54_0`
(`tests/desktop/sqlite_engine.rs`) et `dep01_engine_is_at_least_sqlite_3_54_0` (plugin, `wrapper.rs`) échouent (« SQLite 3.46.0 ») ;
vert `25da782d` et après fusion de main. Aucun test désactivé, allongé ni affaibli ; les deux tests ignorés le sont depuis l'origine.
Restent à la CI : cargo test Windows, cargo audit, e2e, smoke, NSIS (taille de l'installeur).

### code-reviewer
Diff relu à froid (`git diff origin/main`, hors code amont copié, comparé au registre par `diff -r`). Approuvé. Points vérifiés : borne
élargie seulement, aucune ligne de `src/` amont ; patch et `exclude` cohérents (fmt ne réécrit pas la copie) ; `fallible_uint` justifié par
le compilateur, pas par commodité ; job cargo audit : seule l'exception visée retirée, commentaire D-84 remplacé par D-160 ; D-84 et D-87
non réécrites. Réserves non bloquantes : 40 avertissements de compilation de la copie (bruit de log) ; compilation iPhone et cargo audit
non constatés localement.
