## 22. Sécurité, journaux, clé API

| Sujet | Règle |
| --- | --- |
| Données au repos | SQLite en clair dans le conteneur de l'app (protégé par l'OS : Data Protection iOS, profil Windows) ; chiffrement complet de la base **non retenu** (D-17 : complexité vs bénéfice pour un usage personnel ; révisable) |
| Données en transit | iCloud Drive : paquets AES-256-GCM, clé dérivée lors de l'appairage QR, jamais dans iCloud (ADR 0011) ; API IA et Open Food Facts : HTTPS via `reqwest` côté Rust, `rustls`, pas de HTTP |
| Secrets | Clé IA et clé de synchro dans le coffre OS uniquement ; aucune valeur dans le dépôt, les journaux, les artefacts CI, les prompts, les exports. Secrets GitHub nommés (jamais leurs valeurs, D-29) : `RELEASES_TOKEN` (publication vers `spartiate-releases`), `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (nouvelle paire minisign Spartiate, indépendante de CircleTasks, SPA-002) ; les `CT_GOOGLE_*` hérités disparaissent en SPA-001b |
| WebView | CSP stricte héritée (`tauri.conf.json`), `withGlobalTauri: false` (explicite dans `tauri.conf.json` depuis SPA-001a ; absent avant, valeur par défaut, D-47), commandes exposées listées dans `capabilities/*.json` par plateforme ; la WebView n'a jamais accès au réseau direct ni aux clés |
| Permissions iOS | Demandées au premier usage, chacune avec sa raison ; refus = fonction masquée, pas de relance automatique |
| Journaux | Journal technique hérité (`applog.rs`, ADR 0014) : `logs/spartiate.log` + `spartiate.log.1`, 256 Kio chacun, dans le conteneur ; **aucune donnée corporelle, alimentaire ni clé** ; identifiants d'enregistrements uniquement ; export depuis Plus → Journaux pour les transmettre aux agents (seule lecture autorisée après ta première utilisation réelle, D-38) |
| Dépendances | `cargo audit` en CI (job repris) ; `npm audit` à ajouter à `tests.yml` (SPA-001b, lot workflows, D-47) ; versions épinglées ; pas d'ajout de dépendance sans ligne dans le ticket |
| Mise à jour | IPA et NSIS publiés avec sha256 dans `source.json` et `latest.json` ; SideStore vérifie le hash ; sur PC, l'updater vérifie la signature minisign avec la clé publique Spartiate et propose le téléchargement (mécanisme CircleTasks). Jusqu'à SPA-002 l'updater est non configuré : bloc `plugins.updater` retiré, écran « mises à jour non configurées », aucune requête réseau, aucune clé vide ni factice (D-30) |
| Privé | `privacy-shield` optionnel ; verrou local (Face ID / code Windows Hello) : code conservé, entrée masquée, activation différée jusqu'à ta décision (D-37, `H-17` `DEFERRED`) |
