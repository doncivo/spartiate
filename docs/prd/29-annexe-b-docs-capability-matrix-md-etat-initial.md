## Annexe B — `docs/capability-matrix.md` (état initial)

| Capacité | Statut | Preuve | Ticket |
| --- | --- | --- | --- |
| Build Windows NSIS + smoke installeur | INHERITED | CircleTasks `build-windows.yml`, `tests.yml` smoke-windows | SPA-002 |
| Updater Windows signé (clé Spartiate) | UNVERIFIED (non configuré avant SPA-002, D-30) | — | SPA-002 |
| Build iOS non signé en CI | INHERITED | CircleTasks `build-ios.yml` | SPA-003 |
| Installation et renouvellement SideStore | INHERITED | `docs/archive/circletasks/install-iphone.md` | SPA-004 |
| Lecture date d'expiration + notification | INHERITED | I-02 | SPA-004 |
| Mise à jour N → N+1 sans perte de données (base et Trousseau) | **UNVERIFIED (code hérité)** — H-5 ; I-06 CircleTasks non prouvée sur appareil | — | SPA-010 |
| Synchro iCloud chiffrée PC ↔ iPhone (protocole) | INHERITED | ADR 0011 + vecteurs | SPA-008 |
| Synchro des tables Spartiate (`profile`, `body_weight`) | UNVERIFIED (catalogue et repositories adaptés, D-26) | — | SPA-008 |
| Verrouillage / reprise de session | INHERITED | ADR 0013 | I1 |
| Haptique, notifications locales, fichiers, scanner QR | INHERITED | Plugins existants | I1 |
| Entitlement HealthKit via SideStore | UNVERIFIED | — | SPA-006 |
| Lecture HRV / FC / sommeil / workouts | UNVERIFIED (dépend H-3) | — | I5 |
| Recovery HRV comme type HealthKit | UNVERIFIED (H-20) | — | I5 |
| Observer queries sans mode fond | UNVERIFIED (H-13) | — | I5 |
| Live Activity (extension WidgetKit) | UNVERIFIED | — | SPA-007 |
| Widgets écran d'accueil | BLOCKED | Pas d'App Groups en équipe personnelle | — |
| App Apple Watch | BLOCKED | Interdit en équipe personnelle | — |
| Push distant | BLOCKED | Interdit en équipe personnelle | — |
| Scan code-barres alimentaire / Camera Control | UNVERIFIED (scanner présent, Camera Control non prouvé, H-10) | — | I4 |
| Appels API IA via Rust | UNVERIFIED (fournisseur Q-2, H-14) | — | I4 |
| Trois apps sideloadées simultanées | UNVERIFIED (H-16) | — | SPA-004 |
| Parité SQLite Wasm / natif | UNVERIFIED (H-18) | — | SPA-001b |
| Verrou local Face ID / Windows Hello | DEFERRED (code conservé, entrée masquée, D-37) | — | — |

*Fin du document. Toute modification passe par une nouvelle révision numérotée (v6.3, v6.4…) avec journal des changements en tête, par PR sur `docs/PRD.md` (D-22).*
