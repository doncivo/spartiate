## 2. Contexte — faits établis

| Élément | Fait | Conséquence |
| --- | --- | --- |
| iPhone | iPhone 16 Pro Max, iOS 18+, mode développeur activé, SideStore installé avec VPN local et fichier d'appairage (CircleTasks) | Dynamic Island, Action button, Camera Control ; installation par SideStore déjà opérationnelle |
| Watch | Apple Watch Series 11, 46 mm, watchOS 11+ | Écrit dans Apple Santé : HRV, FC de repos, sommeil avec stades, fréquence respiratoire, température du poignet, séances, pas, énergie. « Recovery HRV » non documentée comme type HealthKit (`H-20`) |
| PC | Windows, pas de Mac ; iTunes (site Apple), iloader, iCloud pour Windows avec iCloud Drive actif (CircleTasks, 5 octobre 2026) | Dev local complet : Vitest, `cargo check` partiel (les dépendances C comme SQLite exigent `xcrun` pour iOS), Tauri dev PC ; aucune commande iOS locale |
| Compte Apple | Identifiant gratuit utilisé par SideStore ; pas de Developer Program (D-5) | 7 jours de signature, 3 apps hors App Store : **SideStore + CircleTasks + Spartiate = la limite** (`H-16`), 10 identifiants d'app par semaine |
| CircleTasks | Dépôt public `doncivo/circletasks` (React 18, Vite, TypeScript 6 strict, Zustand 5, SQLite via tauri-plugin-sql, Rust Tauri 2, plugins Swift `files`, `folder-bookmark`, `haptics`, `notification-actions`, `privacy-shield`, `reminders`, `speech`, `vision`, `web-auth`) ; `build-windows.yml` (NSIS, updater) et `build-ios.yml` (IPA non signée, SideStore) ; dépôt public `doncivo/circletasks-releases` ; synchro iCloud Drive chiffrée (ADR 0011) en production entre ton PC et ton iPhone depuis octobre 2026 ; 16 ADR ; 26 agents ; AGENTS.md | Spartiate est un fork : tout cela est repris (§ 4) |
| Outils | Claude Code, Codex, GitHub, WSL2 facultatif (plus nécessaire : les moteurs sont en TypeScript) | Scaffold et conventions CircleTasks (§ 24) |
| Langue | Français ; code et identifiants en anglais | — |
| Budget | 0 € Apple ; IA à l'usage avec ta clé, plafond configurable (`H-14`) | — |
| Usage | Toi seul | Pas de personas ni KPI business |
