## 6. Matrice de capacités — état initial

Tenue à jour dans `docs/capability-matrix.md` (annexe B) par le ticket qui change un statut.

| Capacité | Statut | Précédent CircleTasks | Fallback si `BLOCKED` | Ticket |
| --- | --- | --- | --- | --- |
| Fork, renommage, purge du métier, base neuve, tests verts | `UNVERIFIED` | — | — | SPA-000, 001a, 001b |
| Build PC (NSIS), smoke installeur et updater | `INHERITED` (updater non configuré jusqu'à SPA-002, D-30) | `build-windows.yml`, smoke CI, REL-TECH-02 | — | SPA-002 |
| Build IPA non signée en CI | `INHERITED` | POC-01 | — | SPA-003 |
| Signature ad hoc après `--no-sign` avec entitlements | `UNVERIFIED` | — | Sans entitlements (perd HealthKit) | SPA-003 |
| Publication `spartiate-releases` (PC + source SideStore) | `INHERITED` | `circletasks-releases` | Import manuel | SPA-004 |
| Installation et ouverture SideStore | `INHERITED` | 1.0.x | AltStore | SPA-004 |
| Trois apps sideloadées ensemble | `UNVERIFIED` (`H-16`) | — | Retirer une app | SPA-004 |
| Mise à jour iPhone sans perte | `UNVERIFIED (code hérité)` (`H-5`) | I-06 : code fusionné, preuve appareil ouverte | Export avant mise à jour | SPA-010 |
| Date d'expiration lisible | `INHERITED` | I-02 | Saisie manuelle | SPA-004 |
| Synchro iCloud PC ↔ iPhone sur les tables Spartiate | `INHERITED` (protocole) / `UNVERIFIED` (catalogue et repositories adaptés, D-26) | ADR 0011, lots Y | Export / import manuel | SPA-008 |
| Export / import JSON | `UNVERIFIED` | P-04 (restauration, partiel) | — | SPA-005 |
| **HealthKit lecture / écriture** (plugin Swift) | `UNVERIFIED` — **risque principal** (`H-3`) | Aucun | Saisie manuelle ; séances dans l'app seulement | SPA-006 |
| HealthKit HRV / FC repos / sommeil | `UNVERIFIED` (`H-3`, `H-20`, `H-13`) | Aucun | Fatigue déclarée | I5 |
| **Live Activity / Dynamic Island** (plugin + extension) | `UNVERIFIED` — risque élevé (`H-4`) | Aucun ; extensions exclues sans test | Timer in-app + notification locale (`INHERITED`) | SPA-007 |
| Notifications locales | `INHERITED` | N-01, ADR 0012 | — | SPA-007 |
| Face ID, Trousseau, haptique, Fichiers, caméra, scan | `INHERITED` | lots I, M, Y, CAP, FILES | — | I1 / I4 |
| Camera Control | `UNVERIFIED` | — | Bouton | I4 |
| App Intents (Siri, Action button) | `UNVERIFIED` ; nécessite un plugin Swift | — | Démarrage depuis l'app | I6 |
| Widgets lisant les données | `BLOCKED` (App Groups) | contrat plist | `DEFERRED` | — |
| Background modes (observer queries HealthKit, GPS) | `UNVERIFIED` ; `UIBackgroundModes` interdit par choix sur CircleTasks | — | Lecture au premier plan | I5 / I6 |
| Quota CI | `INHERITED` (dépôt public) | — | Builds par lot | SPA-003 |
| Open Food Facts, API IA | `UNVERIFIED` | — | Ciqual + manuel | I4 |
