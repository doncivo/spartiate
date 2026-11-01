## 21. Persistance, sauvegarde, export / import

### 21.1 Emplacements

La base est résolue nativement par `app_config_dir()` (plugin SQL vendored, `wrapper.rs`) : `<app_config_dir>/spartiate.db`. Trois constantes alignées désignent ce fichier et changent ensemble (D-32, SPA-001a) : `TAURI_DB_URL` (`sqlite:spartiate.db`, `src/platform/tauri/sqlDriver.ts`), `ALLOWED_URL` (garde du plugin vendored, `guard.rs` : seule URL ouvrable, jamais élargie à des noms arbitraires) et `DB_FILE` (`src-tauri/src/backup.rs`).

| Appareil | Base | Fichiers | Clé de chiffrement |
| --- | --- | --- | --- |
| Windows | `%APPDATA%\fr.spartiate.app\spartiate.db` | `backups/`, `logs/`, `media/` dans le même dossier ; exports dans Documents | Windows Credential Manager (`keyring`) |
| iPhone | Conteneur de l'app (`app_config_dir()`, `spartiate.db`) | `backups/`, `logs/`, `Documents/media/` | Trousseau iOS |
| iCloud Drive | `iCloud Drive/Spartiate/<device_id>/` : paquets chiffrés AES-256-GCM, jamais la base en clair | — | — |

**Données réelles (D-38).** Tant que tu n'as pas commencé à utiliser Spartiate (annoncé par toi, consigné dans `docs/decisions.md`), le conteneur `fr.spartiate.app` est un conteneur de laboratoire : `tauri dev` et la lecture de `spartiate.db` sont permis aux agents. Dès ta première utilisation réelle, la règle CircleTasks s'applique : aucun agent ne lit ni n'écrit ces emplacements, fixtures synthétiques uniquement, smoke / Rust / e2e en CI ; seuls les fichiers que tu désignes explicitement (un export, un journal) peuvent être lus. Les données réelles de CircleTasks (`%APPDATA%\fr.circletasks.planner`, dossier iCloud `CircleTasks`) restent interdites en permanence.

### 21.2 Sauvegarde et journaux (héritage exact, D-32)

- Écriture SQLite en WAL, `synchronous = NORMAL`, checkpoint à la fermeture (configuration CircleTasks).
- Sauvegardes natives (`backup.rs`) : quotidienne `spartiate-daily-AAAAMMJJ.db` (14 gardées), familles pré-migration et pré-restauration conservées avec leurs propres quotas (réels : quotidiennes 14, pré-migration 5, pré-restauration 3, D-47) ; version de schéma lue dans `schema_migrations`, repli sur `APP_SCHEMA_VERSION`. Sur PC comme sur iPhone ; sur iPhone, la synchro iCloud reste la sauvegarde hors appareil (D-16).
- Journaux (`applog.rs`, ADR 0014) : `logs/spartiate.log` (courant) et `spartiate.log.1` (précédent), 256 Kio chacun, une entrée JSON par ligne.
- Mise à jour SideStore : le code hérité conserve le conteneur ; la preuve appareil N → N+1 est ouverte (H-5 `UNVERIFIED (code hérité)`, SPA-010) ; **ne jamais supprimer l'app** ; si réinstallation nécessaire, restauration depuis la synchro ou un export.
- Toute politique différente (quota, taille, nommage) est un changement explicite à tester, pas une propriété attribuée au fork.

### 21.3 Export / import (SPA-005 en I0 sur le format Spartiate profil / poids ; complet en I1)

| Format | Contenu | Usage |
| --- | --- | --- |
| `spartiate-export-<date>.zip` | `data.json` (toutes les tables publiées + préférences), `media/`, `manifest.json` (version schéma, app, appareil, sha256) | Sauvegarde complète, migration d'appareil |
| CSV par domaine | `workouts.csv`, `sets.csv`, `nutrition.csv`, `weight.csv` | Analyse externe |
| Import | Zip Spartiate (fusion ou remplacement, aperçu avant) ; CSV Hevy / Strong (mapping exercices avec validation) en I6 (Q-4) | Reprise d'historique |

L'import passe par les repositories (jamais SQL direct), génère des HLC et entre dans la synchro comme n'importe quelle écriture. Export déclenché depuis Plus → Export / import, sur PC vers un dossier choisi, sur iPhone via la feuille de partage (plugin `files`).

### 21.4 Réinitialisation

« Effacer mes données » : confirmation en deux étapes, suppression de la base, des médias, de la clé locale et du dossier iCloud de cet appareil (procédure ADR 0011 « reset ») ; les autres appareils reçoivent un marqueur et proposent de conserver ou d'oublier.
