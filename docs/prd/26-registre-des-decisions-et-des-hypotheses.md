## 26. Registre des décisions et des hypothèses

### 26.1 Décisions (D-n)

| ID | Décision | Source |
| --- | --- | --- |
| D-1 | Usage personnel, aucune commercialisation, aucun App Store | Toi |
| D-2 | Références : Gravl, Alpha Progression, Hevy, MacroFactor, WHOOP / Athlytic, Reboot Plan | Benchmark validé |
| D-3 | Cibles : iPhone 16 Pro Max (iOS 18+) + PC Windows, même code | Toi |
| D-4 | Apple Watch Series 11 46 mm comme **source de données** via Santé ; pas d'app Watch (interdit en équipe personnelle) | Contraintes § 6 |
| D-5 | Pas de compte développeur, pas de Mac : chaîne CI macOS → IPA non signée → SideStore | Toi + CircleTasks |
| D-6 | Développement Claude Code + Codex, contrat § 24 | Toi |
| D-7 | Fork de `doncivo/circletasks` (Tauri 2, React, Rust, SQLite, synchro iCloud) plutôt que projet neuf | Toi (« OK pour le fork ») |
| D-8 | Nom : **Spartiate**, identifiant `fr.spartiate.app` | Toi |
| D-9 | Moteurs (progression, mésocycle, nutrition, récupération) en TypeScript dans `src/domain`, testés Vitest sur Windows ; natif Swift limité aux plugins d'accès système | PRD v6 |
| D-10 | Séance en cours jamais publiée par la synchro avant sa fin | PRD v6 § 13 |
| D-11 | Récupération calculée sur l'iPhone, publiée en résumé vers le PC, pas de recalcul PC | PRD v6 § 16 |
| D-12 | Appels IA effectués par Rust avec clé du coffre ; données corporelles jamais envoyées | PRD v6 § 17 |
| D-13 | Dépôts publics pour minutes macOS gratuites | CircleTasks ADR 0007 |
| D-14 | Entitlements injectés par codesign ad-hoc en CI après `--no-sign` | PRD v6 § 19.4 |
| D-15 | Conventions CircleTasks reprises intégralement (ADR 0001, AGENTS.md, scripts) | PRD v6 |
| D-16 | Pas de sauvegarde locale sur iPhone au-delà de la synchro iCloud | PRD v6 § 21 |
| D-17 | Pas de chiffrement complet de la base locale | PRD v6 § 22 |
| D-18 | Suppression des plugins `reminders` et `web-auth` au fork | PRD v6 § 19.1 |
| D-19 | Charte visuelle laconique, sombre, rouge / bronze ; sombre par défaut ; tokens § 18.4 | Toi (30 oct.) |
| D-20 | Quatre programmes de départ livrés comme contenu, périodisation reprise d'Alpha Progression (§ 12.5) | Toi (30 oct.) |
| D-21 | 24 maquettes HTML validées (§ 18.5) = référence visuelle ; méthode CircleTasks (docs/maquettes, index, npm run visual) | Toi (31 oct.) |
| D-22 | Le PRD vivant est `docs/PRD.md` dans `doncivo/spartiate` à partir de v6.2 ; le document Claude reste l'archive v6.1 ; toute révision = PR | Relecture Codex 31 oct., arbitrage Ali |
| D-23 | Base Spartiate neuve : aucune migration ne purge une base CircleTasks ; registre TS `src/db/migrations/index.ts` réinitialisé avec `0001_spartiate_init` ; `APP_SCHEMA_VERSION` (Rust) = 1 | Relecture Codex 31 oct., arbitrage Ali |
| D-24 | Tables techniques héritées conservées telles quelles (`settings`, `schema_migrations`, `sync_guard`, `sync_field_clock`, `sync_outbox`, `sync_state`, `sync_tombstone`, `sync_unknown`, `sync_parked`, `conflict_log`, `sync_meta`, `epoch_carry_report`) ; `app_meta` et `app_pref` abandonnés (doublons de `settings`) | Relecture Codex 31 oct., arbitrage Ali |
| D-25 | Modèle canonique = § 20.2 ; § 9.1 réécrit avec ces noms ; `profile` et `body_weight` créés et publiés dès I0 | Relecture Codex 31 oct., arbitrage Ali |
| D-26 | Synchro non « inchangée » : catalogue (`syncTables.ts`, `SYNC_TABLE_ORDER`, `naturalIds.ts`), repositories de synchro et règles d'application / réparation adaptés ; invariants conservés et testés ; toute PR `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` relue par `sync-icloud` ; seuil « 200 lignes » supprimé | Relecture Codex 31 oct., arbitrage Ali |
| D-27 | Publication d'une séance à sa clôture (journaux et instantanés, enfants, édition ultérieure, suppression) = conception et tests I1, pas un acquis | Relecture Codex 31 oct., arbitrage Ali |
| D-28 | Workflows réels : `tests.yml` (« suite verte »), `build-windows.yml` (tag `vX.Y.Z`, manuel), `build-ios.yml` (tag `ios-vX.Y.Z`, manuel) ; commandes Rust CI `cargo test --locked --features test-hooks --test desktop`, `cargo test --locked -p tauri-plugin-sql --features sqlite`, `cargo clippy --locked -- -D warnings` | Relecture Codex 31 oct., arbitrage Ali |
| D-29 | Secrets GitHub nommés, jamais leurs valeurs : `RELEASES_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (nouvelle paire minisign, SPA-002) ; `CT_GOOGLE_*` supprimés en 001b | Relecture Codex 31 oct., arbitrage Ali |
| D-30 | Updater Windows : en 001a bloc `plugins.updater` retiré et écran « mises à jour non configurées » sans requête réseau ; SPA-002 le rétablit avec la nouvelle clé et l'endpoint `spartiate-releases` ; pas de clé vide ni factice | Relecture Codex 31 oct., arbitrage Ali |
| D-31 | Tests de migration : Vitest + `@sqlite.org/sqlite-wasm` (mémoire), `npx vitest run --coverage.enabled=false src/db/migrator.test.ts src/db/migrations` ; plugin SQL natif = copie vendored `src-tauri/vendor/tauri-plugin-sql` (garde `ALLOWED_URL`) testée par `cargo test -p tauri-plugin-sql` ; H-18 = parité Wasm / natif | Relecture Codex 31 oct., arbitrage Ali |
| D-32 | Héritage exact : base `app_config_dir()` → `spartiate.db` (`TAURI_DB_URL`, `ALLOWED_URL`, `DB_FILE` alignées) ; sauvegardes quotidiennes `spartiate-daily-AAAAMMJJ.db` gardées 14, familles pré-migration / pré-restauration ; journaux `logs/spartiate.log` + `.1`, 256 Kio chacun (ADR 0014) ; « 7 sauvegardes » et « tracing 5 × 2 Mo » de la v6.1 retirés | Relecture Codex 31 oct., arbitrage Ali |
| D-33 | Plugins : `speech` et `vision` conservés comme infrastructure I6 (écrans de capture supprimés) ; `@tauri-apps/plugin-barcode-scanner` officiel déjà présent (appairage), reclassé hérité ; `reminders` et `web-auth` supprimés (D-18 confirmé) ; structure réelle `src-tauri/plugins/<nom>/ios/Package.swift`, `ios/Sources/<Nom>Plugin.swift`, pont Rust, façade `src/platform/<nom>` là où elle existe | Relecture Codex 31 oct., arbitrage Ali |
| D-34 | Agents : 18 gardés (`architect`, `product-owner`, `qa-test`, `code-reviewer`, `debugger`, `docs-writer`, `ci-release`, `desktop-tauri`, `ios-mobile`, `sync-icloud`, `domain-logic`, `data-model`, `ui-design-system`, `security-privacy`, `performance`, `accessibility-i18n`, `notifications`, `settings-personalization`) ; 8 agents métier CircleTasks supprimés ; les noms `sync-guardian`, `ios-plugin`, `reviewer`, `domain-engineer` de la v6.1 remplacés par les noms réels | Relecture Codex 31 oct., arbitrage Ali |
| D-35 | Qualité héritée : couverture `src/domain/**` 80 % (lignes, fonctions, branches, instructions), objectif 90 % pour `src/domain/training` seul ; plafond bundle 358 400 octets gzip jamais relevé ; `visual` = paires relues par un humain ; `test:contrast` et tout seuil pixel = outillage à créer (ticket rattaché à SPA-009) ; `test.fixme` de commodité interdit | Relecture Codex 31 oct., arbitrage Ali |
| D-36 | Preuves appareil : I-06 non prouvée sur appareil côté CircleTasks ; H-5 `UNVERIFIED (code hérité)`, prouvée sur Spartiate en SPA-010 ; H-16 `UNVERIFIED` partout ; aucun `CONFIRMED` depuis une lecture de code | Relecture Codex 31 oct., arbitrage Ali |
| D-37 | Verrou local : code conservé, entrée masquée, activation différée jusqu'à décision d'Ali (§ 3.2, 4, 10.2, 22, H-17) | Relecture Codex 31 oct., arbitrage Ali |
| D-38 | Données réelles : conteneur `fr.spartiate.app` = laboratoire tant qu'Ali n'a pas commencé à utiliser Spartiate (annoncé par lui, consigné dans `decisions.md`) ; ensuite règle CircleTasks (aucune lecture, fixtures synthétiques, CI) ; « données réelles anonymisées » retiré | Relecture Codex 31 oct., arbitrage Ali |
| D-39 | Installation PC : installeur NSIS éprouvé par le smoke CI ; Ali installe lui-même quand il le décide ; aucun agent ne lui demande de lancer un installeur ; mise à jour ensuite par l'updater | Relecture Codex 31 oct., arbitrage Ali |
| D-40 | Documents CircleTasks déplacés dans `docs/archive/circletasks/` (stories, essais, reprise, journal, backlog, dettes, audits, maquettes-refonte), liens de preuve conservés ; `docs/journal.md`, `docs/decisions.md`, `docs/reprise.md` Spartiate créés vides ; tests lecteurs de guides adaptés en 001a | Relecture Codex 31 oct., arbitrage Ali |
| D-41 | Contrôle d'identité : `git grep` sur fichiers suivis avec exemptions nommées (`docs/PRD.md`, `docs/SPA-*.md`, `docs/relecture-*.md`, `docs/decisions.md`, `docs/adr/**`, `docs/archive/**`, `docs/licences.md`, `README.md`, en-têtes « repris de CircleTasks ») ; trois niveaux : nom utilisateur, identifiant technique actif, référence historique | Relecture Codex 31 oct., arbitrage Ali |
| D-42 | `CLAUDE.md` et `AGENTS.md` : fusion de l'annexe A avec les règles permanentes CircleTasks (bundle, chargement à la demande, passes distinctes, preuve rouge, pas de fixme, bundle avant push, pas de surveillance de CI en boucle, données des deux apps protégées, périmètre `C:\Dev\spartiate`) ; pas de remplacement intégral | Relecture Codex 31 oct., arbitrage Ali |
| D-43 | I0 prouve profil et poids synchronisés, navigation minimale, diagnostics, chaîne de livraison ; coquille 001b fonctionnelle et sobre, mise en page fidèle aux maquettes en SPA-009 ; le gate § 7 ne demande pas de séance avant I1 | Relecture Codex 31 oct., arbitrage Ali |
| D-44 | SPA-001 découpé en 001a (renommage, S / M) et 001b (purge, L, inventaire au niveau des symboles validé par Ali) ; 001b avance par lots verticaux compilables depuis un point de composition minimal, pas par suppression de dossiers | Relecture Codex 31 oct., arbitrage Ali |
| D-45 | Un identifiant = une hypothèse ; renvois corrigés (budget IA → H-14, écriture Santé → H-3, question HRV → H-20) ; H-19 scindée en H-19a (responsive 440 / 1 440, rupture 900 px) et H-19b (micronutriments Ciqual) | Relecture Codex 31 oct., arbitrage Ali |

### 26.2 Hypothèses (H-n) — statut au 31 octobre 2026

Un identifiant désigne une seule hypothèse (D-45). Aucune promotion depuis la seule lecture du code (D-36).

| ID | Hypothèse | Statut | Comment la lever |
| --- | --- | --- | --- |
| H-1 | Les algorithmes publiés par Gravl sont reproductibles à partir de leur documentation publique | UNVERIFIED | Vecteurs de test comparés à des exemples publiés (I2) |
| H-2 | Tauri 2 iOS supporte iOS 18 avec la WebView requise sans régression | INHERITED | Cible iOS 18 attestée par le code CircleTasks ; revalidation sur l'IPA Spartiate re-signée en SPA-004 |
| H-3a | L'entitlement HealthKit est présent dans l'artefact signé (`codesign -d --entitlements`) et survit à la re-signature SideStore (AltSign) | **UNVERIFIED — risque I0** | SPA-003 |
| H-3b | Autorisation Santé accordée, lecture de `bodyMass` et `stepCount` sur l'IPA SideStore | **UNVERIFIED — risque I0** | SPA-006 |
| H-3c | Écriture puis suppression d'un échantillon **créé par Spartiate** (jamais d'une autre source) | UNVERIFIED | I1 (séance), I5 (reste) |

Les renvois « H-3 » du texte désignent la famille H-3a, H-3b, H-3c (D-59).
| H-4 | Une extension WidgetKit (Live Activity) peut être injectée dans le projet généré par `tauri ios init` et passée par SideStore | **UNVERIFIED — risque I0** | SPA-007 |
| H-5 | La mise à jour via SideStore conserve le conteneur et le Trousseau | **UNVERIFIED (code hérité)** — I-06 CircleTasks « code fusionné, en attente de vérification appareil », aucun essai archivé | Preuve appareil en SPA-010 (capture datée avant / après N → N+1) |
| H-6 | Quota CI macOS suffisant | INHERITED (D-13) | Consommation et disponibilité mesurées en SPA-010 |
| H-7 | La date d'expiration du profil est lisible par l'app | INHERITED (I-02, `app_signing_info`, implémentation attestée) | Rejoué sur l'IPA Spartiate en SPA-004 |
| H-8 | 150 exercices et quatre programmes de départ suffisent pour tes routines | UNVERIFIED | Ta relecture de la bibliothèque et des programmes (I1) |
| H-9 | Médias d'exercices disponibles sous licence compatible | UNVERIFIED | Recherche de sources (I1) ; fallback : sans image |
| H-10 | Camera Control utilisable par une WebView Tauri / plugin AVFoundation ; le scanner existant ne le prouve pas | UNVERIFIED | Spike I4 ; fallback bouton |
| H-11 | Licence Ciqual (Etalab 2.0) autorise l'embarquement | UNVERIFIED (très probable) | Lecture de la licence, note dans `docs/licences.md` (I4) |
| H-12 | API Open Food Facts accessible sans clé à l'usage prévu | UNVERIFIED | Appel de test (I4) ; la présence de `reqwest` ne prouve rien |
| H-13 | Les observer queries HealthKit se déclenchent pour une app sans mode fond (`UIBackgroundModes` interdit par le contrat plist) | UNVERIFIED | SPA-006 étendu (I5) ; fallback lecture à l'ouverture |
| H-14 | Fournisseur IA, coût mensuel et plafond configurable acceptables | UNVERIFIED | Décision avant I4 (Q-2) |
| H-15 | Recharts tient les volumes (3 ans de séries Spartiate) en < 300 ms | UNVERIFIED | `test:perf` avec fixture synthétique 3 ans sur le chemin réel des graphiques (I2) |
| H-16 | Limite de 3 apps sideloadées : SideStore + CircleTasks + Spartiate tiennent ensemble | UNVERIFIED | Vérifié en SPA-004 ; fallback : retirer une app ou bascule Spartiate seul |
| H-17 | Un verrou local (Face ID / Windows Hello) a une utilité pour toi | DEFERRED (code conservé, entrée masquée, D-37) | Ta décision (Q-6) |
| H-18 | Le driver `@sqlite.org/sqlite-wasm` des tests reproduit fidèlement le plugin SQL natif vendored : parité DDL, déclencheurs, transactions, pragmas, restauration | UNVERIFIED (outil identifié, D-31) | Tests natifs CI (`cargo test -p tauri-plugin-sql`, `--test desktop`) couvrant les mêmes scénarios que `migrator.test.ts` ; smoke Windows |
| H-19a | Deux largeurs (440 / 1 440 px, rupture unique 1 024 px, `PC_MIN_WIDTH_PX` de `src/ui/useLayout.ts`) couvrent tous les usages, y compris zoom et texte agrandi, sans débordement autour de 1 024 px | UNVERIFIED | Scénarios `visual` Spartiate aux deux largeurs plus relecture à 1 024 px et en Dynamic Type « Très grand » (SPA-009) |
| H-19b | Ciqual fournit les 8 micronutriments épinglés pour la majorité des aliments génériques | UNVERIFIED | Comptage des colonnes Ciqual au chargement (I6) |
| H-20 | « Recovery HRV » de l'Apple Watch est lisible comme un type HealthKit (ou dérivable de `hrvSDNN`) | UNVERIFIED | Lecture des types exposés par `healthkit_read_quantity` sur l'iPhone (I5) ; fallback : HRV SDNN nocturne seule |

Règle : aucune hypothèse ne passe `CONFIRMED` sans preuve archivée (log CI, capture, vecteur) référencée dans `docs/capability-matrix.md`.
