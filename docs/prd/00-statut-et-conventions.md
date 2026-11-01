# PRD Spartiate v6.3 — document de référence (PC + iPhone, fork CircleTasks)

30 octobre 2026 · Ali Cherif · révision 6.2 du 31 octobre 2026 (confrontation au dépôt, D-22 à D-45)

## 0. Statut et conventions

**Version 6.3 — document de référence unique du projet Spartiate (lu par chapitre : `docs/prd/README.md`, D-49).** Il remplace le PRD Forge v5.1 et tous les documents antérieurs. À partir de cette révision, le PRD vivant est le dossier `docs/prd/` (index `docs/prd/README.md` ; `docs/PRD.md` n’est plus qu’une page de renvoi, D-49) dans le dépôt `doncivo/spartiate` (fork de `doncivo/circletasks`) ; le document Claude reste l'archive de la v6.1 et toute révision ultérieure passe par une PR (D-22). Il est lu par sections ciblées par Claude Code et Codex. En cas de contradiction entre ce document et un ADR de CircleTasks repris, ce document prime pour Spartiate.

**Révision 6.1 (30 octobre 2026, après ta relecture)** — ajouts : § 10.0 parcours de bout en bout, § 12.5 programmes de départ, § 12.6 pause et reprise, § 13.8 / 15.7 / 16.7 fonctions reprises du benchmark qui manquaient, § 18.4 charte visuelle, § 18.5 maquettes (règle responsive et liste), § 18.6 accessibilité, décisions D-19 et D-20, hypothèse H-19. Aucune section existante n'a été modifiée.

**Révision 6.2 (31 octobre 2026)** — confrontation du PRD au dépôt réel (`doncivo/circletasks` à `c8bdb308`, identique au fork) par la relecture Codex du 31 octobre (PR #3, 43 constats, 20 modifications), arbitrée par toi. Corrections d'infrastructure, de schéma, de synchro, de CI et de preuves : migrations TypeScript (`src/db/migrations`, migrateur front, base neuve sans purge), tables techniques réelles (`settings`, `sync_*`, `conflict_log`, `epoch_carry_report` ; `app_meta` et `app_pref` abandonnés), colonnes `updated_at` / `device_id` / `hlc` et `sync_field_clock`, § 9 réécrit avec le vocabulaire canonique du § 20.2 et un périmètre de synchro explicite (D-26, D-27), workflows réels (`tests.yml`, `build-windows.yml` sur tag `vX.Y.Z`, `build-ios.yml`), secrets nommés, sauvegardes et journaux hérités exacts, plugins (`speech` / `vision` infrastructure I6, `barcode-scanner` hérité), agents réels, I-06 non prouvée sur appareil (H-5 `UNVERIFIED`), H-16 `UNVERIFIED` partout, verrou local uniformisé, découpage SPA-001a / 001b, I0 sans séance, fixtures synthétiques seulement. Décisions D-22 à D-45 au registre § 26.1 ; H-18 reformulée, H-19 scindée en H-19a / H-19b, H-20 créée, renvois H-1 / H-2 / H-8 corrigés (budget IA → H-14, écriture Santé → H-3, question HRV → H-20). Renvois de sections corrigés (synchro § 9, plugins § 19, modèle § 20, registre § 26). § 11–12, § 14–17 (contenu fonctionnel) et § 18 (hors `test:contrast` et H-19a) inchangés.

**Révision 6.3 (1er novembre 2026, SPA-001a)** — portage des décisions déjà approuvées, sans autre changement de fond : D-47 (coquilles réelles `AppShell` / `TabRail`, rupture 1 024 px, commandes CI réelles, `contrast.test.ts`, caméra seule sur iPhone, `settings` hors catalogue, quotas de sauvegarde, `withGlobalTauri` explicite), D-48 (rubrique « Relais » au gabarit de ticket § 24.5), D-49 (PRD découpé en `docs/prd/NN-<titre>.md`, un chapitre par section), D-58 (versions 0.1.0 / 0.1.1) et D-59 (H-3 scindée en H-3a, H-3b, H-3c). Les corrections sont listées dans `scripts/release/fixtures/prd-v6.3-changes.json` ; la v6.2 est conservée dans `docs/archive/PRD-v6.2.md`.

### 0.1 Ce qui change par rapport à la v5.1

| Sujet | v5.1 (Forge) | v6 (Spartiate) |
| --- | --- | --- |
| Nom | Forge (nom de code) | **Spartiate** ; identifiant `fr.spartiate.app` |
| Plateformes | iPhone seul | **PC Windows + iPhone**, même code, livrés ensemble |
| Pile | Swift 6 + SwiftUI + 4 packages Swift | **Tauri 2 : React + TypeScript strict (front commun), Rust (cœur, SQLite, synchro, chiffrement), plugins Swift pour l'iPhone** — la pile de CircleTasks |
| Moteurs | Packages Swift testés sous WSL | **TypeScript pur dans `src/domain`**, testés par Vitest sur Windows |
| Données | SwiftData, aucune sync | **SQLite (plugin Tauri SQL)** + **synchronisation chiffrée par iCloud Drive** entre PC et iPhone (ADR 0011 de CircleTasks, réutilisée) |
| HealthKit, Live Activity | Frameworks directs | **Plugins Swift Tauri** (`healthkit` nouveau, `live-activity` nouveau), sur le gabarit de `haptics`, `vision`, `speech` de CircleTasks |
| Dépôt | Neuf | **Fork de CircleTasks** : chaîne CI, SideStore, synchro, plugins, scaffold d'agents conservés ; métier et écrans remplacés |
| Installation iPhone | SideStore | Identique ; source `spartiate-releases` |
| Installation PC | — | Installeur NSIS + plugin updater, dépôt `spartiate-releases` (comme CircleTasks) |

### 0.2 Niveaux normatifs

**doit** = obligatoire ; **devrait** = recommandé, s'en écarter demande une entrée dans `docs/decisions.md` ; **peut** = option.

### 0.3 Statuts de capacité

| Statut | Sens | Preuve |
| --- | --- | --- |
| `CONFIRMED` | Exécuté sur ton iPhone ou ton PC via la chaîne réelle | Capture ou log daté |
| `INHERITED` | Prouvé sur CircleTasks, même appareil, même chaîne ; **à rejouer sur Spartiate avant d'être `CONFIRMED`** | Référence à la story CircleTasks |
| `PROTOTYPED` | Compile en CI | Build vert |
| `UNVERIFIED` | Hypothèse | — |
| `BLOCKED` | Testé, indisponible, fallback actif | Erreur documentée |
| `DEFERRED` | Reporté | Itération cible |

### 0.4 Hypothèses

Tout ce qui n'est pas vérifié est marqué `H-n` et repris au registre § 26.2 avec sa méthode de vérification. Un identifiant désigne une seule hypothèse (D-45). Les constantes numériques des moteurs sont des valeurs de départ dans des fichiers de configuration, jamais en dur.

### 0.5 Comment lire

Démarrer : § 3 à 9, § 25 à 26, annexes. Coder un moteur : § 11, 12, 15, 16 + § 20 + § 24. Coder un écran : § 18 + section fonctionnelle + § 5. Synchro : § 9 + § 20. Plugin iPhone : § 19.
