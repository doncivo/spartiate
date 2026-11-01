## 27. Questions ouvertes, glossaire, références

### 27.1 Questions ouvertes (à trancher par toi)

| # | Question | Échéance | Option par défaut si silence |
| --- | --- | --- | --- |
| Q-1 | Garder CircleTasks installée en parallèle (3 apps max) ? | SPA-004 | Oui, on vérifie H-16 |
| Q-2 | Fournisseur IA (Anthropic, OpenAI, autre) et plafond mensuel | Avant I4 | Abstraction `AiProvider`, choix reporté |
| Q-3 | Sources des médias d'exercices (photos libres, dessins générés, aucune) | I1 | Aucune image en I1 |
| Q-4 | Import d'historique Hevy / Strong nécessaire dès I1 ? | I1 | Reporté en I6 |
| Q-5 | Langue : FR seul ou FR + EN (i18n CircleTasks conservée) | SPA-001b | FR seul à tous les niveaux, chargement à la demande gardé |
| Q-6 | Verrou local (H-17) | I6 | Non |
| Q-7 | Objectif initial (prise de masse / perte / maintien) pour le profil par défaut | Onboarding | Saisi à l'onboarding, pas de défaut |

### 27.2 Glossaire

| Terme | Définition |
| --- | --- |
| 1RM | Charge maximale théorique sur une répétition (estimée par Epley) |
| RIR | Reps in Reserve, répétitions restantes avant l'échec |
| Double progression | Monter les reps dans la plage puis la charge |
| Mésocycle | Bloc de 4–6 semaines avec progression et deload |
| Deload | Semaine allégée (charge × 0,8) |
| TDEE | Dépense énergétique quotidienne totale, ici mesurée |
| HRV | Variabilité de la fréquence cardiaque (SDNN) |
| HLC | Hybrid Logical Clock, horodatage de la synchro par champ |
| IPA / NSIS | Paquet iOS / installeur Windows |
| SideStore | Installateur d'apps sideloadées sur iPhone, renouvelle la signature 7 j |
| Entitlement | Droit iOS déclaré à la signature (HealthKit…) |
| Live Activity | Affichage temps réel Dynamic Island / écran verrouillé |
| INHERITED | Capacité prouvée sur CircleTasks, à rejouer sur Spartiate |

### 27.3 Références

- Benchmark apps fitness (6 références) — document précédent.
- PRD Forge v5.1 — version iPhone natif, remplacée par ce document.
- Dépôt `doncivo/circletasks` : `CLAUDE.md`, `AGENTS.md`, `docs/adr/0001`, `0007`, `0008`, `0010`, `0011`, `0013`, `docs/install-iphone.md`, `.github/workflows/build-ios.yml`, `scripts/ios/*`, `docs/stories/I-02.md`, `I-06`.
- Gravl — documentation publique de l'algorithme de progression.
- Apple — HealthKit, ActivityKit, WidgetKit, équipes personnelles (limites de sideload).
- Tauri 2 — guide iOS, plugins Swift, `tauri ios init --ci`.
- SideStore — format `source.json`, renouvellement.
- ANSES Ciqual (Licence Ouverte 2.0), Open Food Facts (ODbL).
