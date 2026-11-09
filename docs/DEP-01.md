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
