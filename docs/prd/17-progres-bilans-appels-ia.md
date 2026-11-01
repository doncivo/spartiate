## 17. Progrès, bilans, appels IA

### 17.1 Indicateurs

| Indicateur | Définition | Itération |
| --- | --- | --- |
| Charges et 1RM | Par exercice, bande de confiance | I2 |
| Records | Charge, reps, volume, 1RM estimé ; notification en séance | I1 |
| Volume | Séries par muscle / semaine vs plage | I3 |
| Constance | Streak, séances / semaine, calendrier | I1 |
| Corps | Tendance, dépense et confiance, mensurations, photos côte à côte | I4 / I6 |
| Strength Score | 8 groupes, barre et haltères, ajusté poids et sexe ; inchangé en deload | I3 |
| Récupération | Tendances 30 j (lues depuis `recovery_day`) | I5 |

Graphiques Recharts (dépendance CircleTasks), calculés côté front depuis les repositories, < 300 ms ; sur PC, vues larges multi-graphiques.

### 17.2 Appels IA — règles

| Règle | Spécification |
| --- | --- |
| Déclenchement | Bouton explicite, aperçu de l'envoi |
| Clé | Coffre de l'appareil (keyring Windows / Trousseau iOS, mécanisme CircleTasks) ; saisie par appareil ; jamais synchronisée ni dans le dépôt |
| Appel | Effectué **par Rust** (`reqwest`, déjà présent) avec la clé lue du coffre ; la WebView ne voit jamais la clé (règle ADR 0008) |
| Budget | Plafond mensuel par appareil, compteur, blocage |
| Données | Image de repas, texte, programme à importer, agrégats de bilan ; **jamais** HRV, FC, sommeil, poids nominatif, photos corporelles |
| Réponse | JSON validé contre un schéma écrit à la main (`src/domain/ai/parse.ts`, comme `sync/parse.ts`) ; rejet sinon ; aucune action sans confirmation |
| Fournisseur | Abstrait (`AiProvider` dans `src/platform/ai`) ; à décider avant I4 (`H-14`) |

### 17.3 Bilans (I6)

Agrégat local → texte (3 faits, 1 recommandation) → **vérification que chaque nombre existe dans l'agrégat** → affichage ; fallback template. Export CSV / JSON.

### 17.4 Import de programme (I6)

Capture, PDF ou texte → `{sessions:[{name, exercises:[{name, sets, repsMin, repsMax, rir?}]}]}` → mapping validé → routine Libre.
