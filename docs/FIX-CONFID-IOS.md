# FIX-CONFID-IOS — Confidentialité sur l'iPhone : sauvegarde iCloud, photos supprimées, journal sans valeur corporelle (lot 0.28.0)

Statut : **prêt pour PR (non poussé).** Commits : rouge `7d400b72`, vert `807e5cef`, qa-test et fiche (commit suivant). Budget M. Branche `FIX-CONFID-IOS` depuis `origin/main` (`29d99d19`, après HIST-01). Lot 0.28.0, phase 2, 1er des 10
correctifs de l'audit Claude. Rôles : ios-mobile (`ios_setup.rs`, plugin `ct-files`), desktop-tauri (`applog.rs`, plugin SQL vendored),
security-privacy (règles du journal, § 22). Aucune migration, aucun format sur disque changé, aucune dépendance nouvelle.
Origine : audit Claude 0.27.0 (`origin/audit-claude-0.27.0`, `docs/audit-claude-0.27.0/constats.md`) : C-152, C-089, C-151, C-140, C-147 ;
preuve `preuves/partie8b-9-confidentialite.test.ts`, reprise dans `src/platform/logs/confidentialite.test.ts` (jamais branchée depuis docs/).
Chapitres PRD : 19 (contrat iOS, plugins Swift), 21 (persistance, sauvegardes natives), 22 (sécurité, journaux). ADR lu : 0014 (journal
technique). Décisions lues : D-36 (aucun CONFIRMED sans constat d'Ali), D-99 (1) (les photos ne quittent jamais l'appareil, validée par Ali
via D-119), D-121. Fixtures synthétiques uniquement (D-292).

## Constats

- C-152 / C-147 : aucune exclusion de sauvegarde (`NSURLIsExcludedFromBackupKey`) ; la base (`Library/Application Support`, photos
  comprises dans `progress_photo_file`), ses sauvegardes `VACUUM INTO` (`backups/`) et le journal (`Documents/Journal`) partent
  probablement dans la sauvegarde iCloud de l'iPhone, contraire à D-99 (1).
- C-089 : une photo « supprimée sans retour possible » reste dans les sauvegardes locales et dans les pages libres de la base
  (pas de `secure_delete`).
- C-151 (TS) et C-140 (Rust) : « poids 82,4 kg », « FC 142 », `{"hrvMs":48.6}` passent en clair dans le journal ; débit limité par couple
  seulement, table de débit sans borne, `n` additionné sans saturation, scopes réservés à Rust écrivables par la WebView, rotation bloquée
  par un fichier verrouillé.

## Règles appliquées (choix prudents, révisables par Ali)

1. **Exclusion de la sauvegarde (iPhone).** Au démarrage, après l'ouverture du journal et AVANT l'enregistrement du plugin SQL, Rust
   (`backup_exclusion.rs`) crée au besoin puis fait exclure par le plugin Swift existant `ct-files` (nouvelle commande `excludeFromBackup`,
   `URLResourceValues.isExcludedFromBackup`, relu après écriture) : le dossier de la base (`app_config_dir`), celui des sauvegardes locales
   (`backups/`) et celui du journal (`Documents/Journal`, qui reste visible dans Fichiers). Idempotent (posé à chaque démarrage), délai 5 s,
   jamais bloquant : un échec est inscrit au journal (`backup-exclusion` / code, aucun chemin) et dit dans Plus › À propos et diagnostic.
   Aucun CONFIRMED : H-38 UNVERIFIED dans la matrice, constat d'Ali à faire.
2. **Photos (C-089).** `PRAGMA secure_delete = ON` sur la connexion de l'app (posé par Rust à l'ouverture, hors de portée de la WebView) :
   toute suppression écrase le contenu effacé (photo comprise) ; coût négligeable pour une base d'un seul utilisateur (écritures de pages
   supprimées seulement). Les sauvegardes existantes ne sont pas réécrites ; les textes disent vrai : la photo disparaît de l'app, elle peut
   subsister dans les sauvegardes locales de cet appareil jusqu'à leur rotation, jamais ailleurs.
3. **Journal (C-151, C-140).** Masquage commun TS et Rust (vecteurs partagés `tests/fixtures/logs/sanitize-vectors.json`, liste blanche de
   clés partagée) : un mot qui contient un nombre décimal, un nombre suivi d'une unité corporelle (`kg`, `%`, `bpm`, `ms`, `kcal`, `h`, `min`,
   `cm`, attachée ou au mot suivant), un nombre qui suit un mot corporel (`poids`, `fc`, `hrv`…) ou une unité, ou une valeur numérique
   d'extrait JSON, devient `[masqué]`. Restent lisibles : versions à trois parties ou plus (`0.27.0`), nombres entiers seuls (codes HTTP,
   compteurs), UUID, et les valeurs des clés de la liste blanche (`rules_version=3`, `nights_known=7`, `"count":2`…). Côté Rust : plafond
   global de 60 entrées par minute (résumé `log` / `rate-capped`), table de débit bornée à 256 couples, `saturating_add`, scopes réservés à
   Rust (`log`, `sync-rust`, `backup-recovery`, `sql-refused`, `backup-exclusion`) refusés à la WebView (`invalid`), rotation qui ne bloque
   jamais : si le renommage échoue (fichier `.1` verrouillé), l'ancien `.1` est supprimé puis le renommage retenté ; sinon le fichier
   courant est vidé et l'écriture reprend par `log` / `rotation-failed`.

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Test |
| --- | --- | --- |
| 1 | Given le démarrage iPhone, When `ios_setup::setup` s'exécute, Then l'exclusion de sauvegarde est demandée après `applog::init` et avant `register_sql_after_recovery`, sans `?` ni arrêt possible. | `backup_exclusion.rs` (statique) |
| 2 | Given les dossiers de la base, des sauvegardes et du journal, When l'exclusion est appliquée, Then les trois dossiers existent et sont passés en chemins absolus à `excludeFromBackup` ; un lien est refusé (`unsafe-folder`). | `backup_exclusion.rs` (faux transport) |
| 3 | Given un rejet, un délai dépassé ou une réponse partielle du plugin, When l'exclusion échoue, Then le journal porte `backup-exclusion` / code (sans chemin), l'état rend ce code, le démarrage continue. | `backup_exclusion.rs` |
| 4 | Given le plugin `ct-files`, When on lit le Swift, Then `excludeFromBackup` pose `isExcludedFromBackup`, relit la valeur, refuse un chemin hors du conteneur ou un lien, rejette par code ; contrat JSON = Swift = Rust. | `export_ios.rs` (contrat) |
| 5 | Given un échec d'exclusion, When Ali ouvre Plus › À propos et diagnostic, Then une ligne d'alerte dit que les données peuvent partir dans la sauvegarde iCloud, avec le code. | `AboutSection` (DOM) |
| 6 | Given une photo écrite puis supprimée, When la base est relue octet par octet après point de contrôle, Then le contenu de la photo n'y est plus. | `wrapper.rs` (plugin SQL) |
| 7 | Given l'écran Corps, When on supprime une photo, Then le texte dit qu'elle disparaît de l'app et peut subsister dans les sauvegardes locales jusqu'à leur rotation, ou dans une sauvegarde iCloud de l'iPhone (revue 1). | `BodyProgress.test.tsx` |
| 8 | Given « poids 82,4 kg », « FC 142 », `{"hrvMs":48.6,"restingHr":52}`, When le journal assainit (TS et Rust), Then aucune valeur n'est en clair ; `rules_version=3`, `nights_known=7`, `0.27.0`, `401` restent lisibles. | vecteurs partagés, `confidentialite.test.ts`, `applog.rs` |
| 9 | Given 200 codes différents dans la même minute, When ils sont écrits, Then 60 au plus sont écrits et le surplus est résumé ; la table de débit ne dépasse jamais 256 couples ; `n` = `u32::MAX` ne déborde pas. | `applog.rs` |
| 10 | Given une entrée de la WebView sous `sync-rust`, `backup-recovery` ou `log`, When elle est écrite, Then son scope devient `invalid`. | `applog.rs` |
| 11 | Given `spartiate.log.1` verrouillé, When la rotation est due, Then l'écriture continue, le journal reste ≤ 2 × 256 Kio et porte `log` / `rotation-failed`. | `applog.rs` (Windows) |

Hors périmètre : purge des photos dans les sauvegardes existantes (refusée par la règle 2), relecture de `globalErrors.ts` au-delà du
masquage (le message passe par la même barrière), synchro (aucun fichier de `src/sync`, `src-tauri/src/sync` touché).

## Passe ios-mobile / desktop-tauri / security-privacy (agent du module) : correction

- Rouge `7d400b72` constaté : Vitest 18 vecteurs rouges (`sanitize.test.ts`) et la preuve de l'audit (`confidentialite.test.ts`) ;
  `BodyProgress.test.tsx` 2 rouges ; Rust 8 rouges (plafond global, saturation, scopes réservés, rotation verrouillée, trois contrôles
  statiques de l'exclusion, contrat `ct-files`) et `i04_5` (vecteurs) ; plugin SQL : `fix_confid_deleted_content_does_not_remain_in_free_pages`
  rouge (photo lisible dans le fichier après suppression).
- Vert `807e5cef` : `src-tauri/src/backup_exclusion.rs` (nouveau, compilé partout, faux transport), `ios_setup.rs` (ordre : journal,
  exclusion, purge, SQL), commande Swift `excludeFromBackup` dans `CtFilesPlugin.swift` (aucune dépendance, aucune clé Info.plist, aucun
  entitlement, aucune permission WebView), `applog.rs` (masquage, débit, scopes, rotation, `backupExclusion` dans `log_read`),
  `vendor/tauri-plugin-sql/src/wrapper.rs` (`secure_delete`), `src/platform/logs/*` (masquage, état), `AboutSection.tsx` (ligne d'alerte),
  textes `fr.bodyProgress.ts` et `fr.logs.ts`, matrice (H-38). `cargo fmt` a aussi reformaté les tests du commit rouge (sans changer leur sens).
- Coût de `secure_delete` sur toute la base : négligeable (pages supprimées réécrites à zéro, base d'un seul utilisateur, aucune mesure
  de perf touchée) ; choisi plutôt qu'un réglage par suppression, que la liste blanche de pragmas aurait dû ouvrir à la WebView.
- Fichier verrouillé à la rotation (Windows seulement : sous iOS, un renommage remplace toujours) : suppression de l'ancien `.1` puis
  nouvel essai ; sinon le fichier courant est vidé et commence par `log` / `rotation-failed` (perte des 256 Kio courants, jamais de blocage).

## Passe qa-test : cas limites

Ajoutés (commit qa) et verts : mot corporel collé (`FC142`, `hrv48`) mais pas au milieu d'un mot (`8fc3a1d`, `sha256` gardés) ; espace
insécable U+00A0 / U+202F entre nombre et unité ou mot corporel ; unité en majuscules (`82,4 KG`) ; valeur JSON séparée de sa clé par une
espace (`{"restingHr": 52}`, `{"count": 2}` gardé) ; phrase double (`poids … et FC … bpm`) ; table de débit sous 3 × 1 000 couples (≤ 256,
journal ≤ 2 × 256 Kio) ; un fichier à la place du dossier `backups/` refusé (`unsafe-folder`, rien demandé au plugin) ; jonction refusée ;
rejet texte libre du plugin réduit à `failed`. Locaux : `cargo test --features test-hooks --test desktop` 859 verts (2 ignorés) puis ciblés
53 verts après qa ; `cargo test -p tauri-plugin-sql --features sqlite` 31 + 1 verts ; `cargo fmt --check`, `cargo clippy -D warnings`
propres ; Vitest `src/platform/logs`, `src/features/settings`, `src/features/bodyProgress`, `src/i18n` (733 verts, puis logs 107 après qa),
contrôles documentaires et `privacy.test.ts`, `sqlPragmaScan.test.ts` verts ; `tsc` et `eslint` propres. Le code `cfg(target_os = "ios")`
(transport réel, `exclude_on_launch`, Swift) n'est pas compilé ici : la compilation build-ios du lot fera foi.

## Passe code-reviewer

- Aucun fichier de `src/sync`, `src-tauri/src/sync`, `src/domain` ni migration touché : pas de relecture sync-icloud requise (D-26).
- Limites relevées, acceptées : (1) `secure_delete` vaut pour la connexion du plugin SQL ; une écriture par une connexion rusqlite (synchro
  Rust, sauvegardes) n'en hérite pas — aucune ne supprime de photo ; (2) une trame WAL d'avant la suppression peut garder la photo jusqu'au
  point de contrôle suivant (le test vide le WAL) ; (3) les photos déjà copiées dans les sauvegardes locales y restent jusqu'à leur rotation
  (dit à l'écran) ; (4) une clé de compteur nouvelle dans un extrait JSON du journal sera masquée tant qu'elle n'est pas ajoutée à
  `allowedKeys` (choix prudent : masquer par défaut) ; (5) l'exclusion bloque le démarrage 5 s au plus si Swift ne répond pas ; (6) un
  SHA court commençant par des lettres corporelles (`fc12…`) est masqué.
- Verdict : approuvé sous réserve de la CI verte et de la compilation build-ios.

## Décisions : D-329 à D-332 (docs/decisions.md)

- **D-329** (révisable par Ali) : exclusion de la sauvegarde iCloud de l'iPhone pour la base (photos comprises), `backups/` et
  `Documents/Journal`, posée à chaque démarrage par `ct-files` (`excludeFromBackup`) avant le plugin SQL, jamais bloquante ; le journal
  reste dans Fichiers. Hypothèse **H-38** « exclusion de sauvegarde iCloud effective », UNVERIFIED (ligne de la matrice), à inscrire au
  registre (chapitre 26 figé, comme H-37). L'ADR 0014 (« `<app_config_dir>/logs` ») est à compléter par un avenant iPhone (C-147).
- **D-330** : `PRAGMA secure_delete = ON` posé par Rust sur la connexion de l'app ; les sauvegardes existantes ne sont pas réécrites ;
  texte de suppression de photo « disparaît de l'app, peut subsister dans les sauvegardes locales de cet appareil jusqu'à leur rotation,
  jamais ailleurs » (remplace « sans retour possible »).
- **D-331** : règle du journal (§ 22) : masquage des décimaux, des nombres avec unité corporelle ou après un mot corporel, des valeurs
  JSON hors `allowedKeys` ; listes partagées dans `tests/fixtures/logs/sanitize-vectors.json` ; une clé de compteur nouvelle s'y ajoute.
- **D-332** : journal Rust : 60 entrées par minute au plus (`log` / `rate-capped`), 256 couples suivis, compteurs saturés, scopes de
  Rust (`log`, `sync-rust`, `backup-recovery`, `sql-refused`, `backup-exclusion`) refusés à la WebView, rotation qui vide le fichier
  courant plutôt que de bloquer.

## Constats à faire par Ali sur l'iPhone (après installation de la version qui contient ce ticket)

1. Réglages › [ton nom] › iCloud › Gérer le stockage › Sauvegardes › cet iPhone : Spartiate absent de la liste ou de taille minime.
2. Fichiers › Sur mon iPhone › Spartiate › Journal : le journal est toujours là et s'exporte.
3. Plus › À propos et diagnostic : aucune ligne rouge « … exclues de la sauvegarde iCloud … ».
Aucun statut ne change avant ces constats (D-36).

## Budget

Budget M (150 k) dépassé par l'agent du module (≈ 273 k tokens), sous l'arrêt au double (D-324) : consigné, travail poursuivi.

## Passe code-reviewer — revue 1 (à froid) : à corriger

1. (Important, preuve rouge) le vert `807e5cef` ajoute des tests sans rouge préalable : `src-tauri/tests/desktop/backup_exclusion.rs` (critères 2, 3), deux tests de `src-tauri/tests/desktop/applog.rs` (critère 9 : table de 256 couples, listes de la fixture), `src/features/settings/logs/logsRow.test.tsx` ~92 (critère 5). À faire : les rejouer contre le code de `7d400b72` dans un worktree jetable et consigner l'échec, sinon le dire comme écart.
2. (Important, masquage) passent encore en clair, TS et Rust : tableau JSON sous une clé non permise (`{"restingHr":[52]}`), clé composée contenant un mot corporel (`heart_rate=142`, `body_mass=82`, `poidsKg=82`), `=` entouré d'espaces (`hrv = 48`), espace fine U+2009 et U+2007 (`82 kg`). À faire : commit rouge (vecteurs ajoutés à `tests/fixtures/logs/sanitize-vectors.json`, lus par les deux langages), puis vert.
3. (Suggestion, D-330) `fr.bodyProgress.ts` ~100, ~105 : « jamais ailleurs » est faux pour les sauvegardes iCloud prises avant cette version et si l'exclusion échoue (H-38) : retirer la promesse absolue.
4. (Suggestion, D-331) tout décimal est masqué (`v0.28`, `took 120 ms`) : choix voulu, à écrire dans D-331.
5. (Suggestion) résumé `log` / `rate-capped` perdu si l'app se ferme avant la minute suivante (comme `suppressed`, déjà avant) : à consigner.
6. (Suggestion) écart au code amont du plugin SQL vendored (`secure_delete`) : une ligne dans l'avenant SEC-01 de l'ADR 0002.
Conformes : Swift et Rust iOS plausibles (appel avant le plugin SQL, délai de 5 s, pas de clé plist ni d'entitlement), scopes réservés, débit borné, rotation dite, BodyProgress.test.tsx corrigé dans le rouge, couches et textes.

## Point d'étape (arrêt au double du budget, D-324)

Le ticket a atteint le double de son budget M (≈ 273 k pour l'agent du module, plus les relectures) : arrêt (D-324). Branche poussée, PR #163 ouverte, **non fusionnée** (revue 1 à corriger). À la reprise : traiter les points 1 et 2 (rouge puis vert), 3, 4 et 6 ; relire la compilation build-ios de branche (run 44765785227) et la CI ; revue 2 ; fusion. Suivant ensuite : FIX-EXPORT.

Compilation build-ios de la branche (publish=false, run 44765785227, sur `d2f49c48`) : **verte** ; le Swift de `ct-files` et le Rust iOS compilent. À relancer seulement si les corrections touchent le Swift.
