# FIX-CONFID-IOS — Confidentialité sur l'iPhone : sauvegarde iCloud, photos supprimées, journal sans valeur corporelle (lot 0.28.0)

Statut : **en cours.** Budget M. Branche `FIX-CONFID-IOS` depuis `origin/main` (`29d99d19`, après HIST-01). Lot 0.28.0, phase 2, 1er des 10
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
| 7 | Given l'écran Corps, When on supprime une photo, Then le texte dit qu'elle disparaît de l'app et peut subsister dans les sauvegardes locales jusqu'à leur rotation, jamais ailleurs. | `BodyProgress.test.tsx` |
| 8 | Given « poids 82,4 kg », « FC 142 », `{"hrvMs":48.6,"restingHr":52}`, When le journal assainit (TS et Rust), Then aucune valeur n'est en clair ; `rules_version=3`, `nights_known=7`, `0.27.0`, `401` restent lisibles. | vecteurs partagés, `confidentialite.test.ts`, `applog.rs` |
| 9 | Given 200 codes différents dans la même minute, When ils sont écrits, Then 60 au plus sont écrits et le surplus est résumé ; la table de débit ne dépasse jamais 256 couples ; `n` = `u32::MAX` ne déborde pas. | `applog.rs` |
| 10 | Given une entrée de la WebView sous `sync-rust`, `backup-recovery` ou `log`, When elle est écrite, Then son scope devient `invalid`. | `applog.rs` |
| 11 | Given `spartiate.log.1` verrouillé, When la rotation est due, Then l'écriture continue, le journal reste ≤ 2 × 256 Kio et porte `log` / `rotation-failed`. | `applog.rs` (Windows) |

Hors périmètre : purge des photos dans les sauvegardes existantes (refusée par la règle 2), relecture de `globalErrors.ts` au-delà du
masquage (le message passe par la même barrière), synchro (aucun fichier de `src/sync`, `src-tauri/src/sync` touché).
