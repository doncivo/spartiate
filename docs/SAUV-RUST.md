# SAUV-RUST — sauvegardes Rust : cible jamais purgée, exclusion mutuelle (lot 0.28.0, phase 2)

Constats de l'audit Claude 0.27.0 : C-137, C-138 ; A-008 (audit Codex 0.26.0, côté Rust : D-326 (5)). Budget M (150 k) ; un dépassement serait seulement consigné ici (D-333). Chapitre : PRD 21 (persistance, sauvegardes). ADR : 0002 (avenants SEC-01, FIX-A008, et l'avenant SAUV-RUST ajouté ici), 0010. Rôle : desktop-tauri. Aucune nouvelle dépendance cargo. Hors périmètre : `src-tauri/src/sync/**`, le marqueur de restauration, la restauration elle-même (ordre des étapes inchangé), le front.

## Périmètre

`src-tauri/src/backup.rs` seulement (fonctions publiques `create_migration_backup`, `create_daily_backup`, `restore_backup_file`, `recover_interrupted_restore`, `prune_family`, `swap_database`) ; test `src-tauri/tests/desktop/backup_safety.rs` ; avenant ADR 0002. `startup_gate.rs` n'est pas modifié (aucun appel imbriqué des fonctions verrouillées).

## Règles (choix prudents, révisables par Ali)

1. C-137 : la rotation ne supprime jamais le fichier que l'appel vient de créer (exclu de la purge, compté dans `keep`) ; les autres sont triés par nom comme avant. Valable pour les familles migration, quotidienne et copie avant restauration.
2. C-137 : `created: true` et `path` ne sont rendus que si le fichier existe après la rotation (sinon erreur `io`).
3. C-138 : un verrou de processus, clé = chemin de la base, est pris (sans attente) par `create_migration_backup`, `create_daily_backup`, `restore_backup_file` et `recover_interrupted_restore` ; une seconde opération sur la même base est refusée avec le code `busy`. Des bases différentes (tests en parallèle) ne se gênent pas ; en production il n'y a qu'une base, donc un verrou commun.
4. C-138 : l'échange n'écrase jamais une cible existante : si `spartiate.db` existe au moment de placer le fichier préparé, l'échange échoue et l'ancienne base revient ; le retour arrière ne remplace pas non plus un fichier présent (il est alors signalé `rollback-failed` et `.restore-old` reste, la récupération au démarrage l'archive).
5. `busy` est déjà dans `BackupFailureReason` côté TypeScript ; aucun texte nouveau.

## Critères (Given / When / Then)

- C-137 migration. Given 5 sauvegardes de migration datées 2099, When un appel daté 2026, Then le fichier créé existe, `path` existe, 5 fichiers restent.
- C-137 quotidienne. Given 14 quotidiennes de 2099, When un jour de 2026, Then `created` et le fichier existe.
- C-137 pré-restauration. Given 3 copies de 2099, When une restauration datée 2026, Then `safety_copy` existe.
- C-138. Given une restauration en cours (bloquée à `Staged`), When une seconde restauration ou une quotidienne sur la même base, Then `busy` et rien n'est modifié ; When la première finit, Then une nouvelle sauvegarde réussit. Une autre base n'est pas bloquée.
- C-138 échange. Given un fichier créé à la place de la base entre le déplacement et le renommage, Then l'échange échoue, le fichier étranger n'est pas remplacé, l'ancienne base reste récupérable.
