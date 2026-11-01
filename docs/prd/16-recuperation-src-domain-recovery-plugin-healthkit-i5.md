## 16. Récupération (`src/domain/recovery` + plugin `healthkit`, I5)

Heuristiques expérimentales inspirées de Recovery / Strain / Sleep ; jamais un diagnostic ; abstention quand les données manquent ; proposition seulement. Les mesures sont lues **sur l'iPhone** par le plugin Swift `healthkit`, les résumés quotidiens sont publiés vers le PC par la synchro.

### 16.1 Niveaux

| Niveau | Données | Comportement | Itération |
| --- | --- | --- | --- |
| A | Fatigue déclarée, historique | Récupération par muscle estimée ; suggestion prudente | I1 / I5 |
| B | Sommeil (durée) et FC repos sans baseline complète | Modulation prudente par seuils absolus, avec message | I5 |
| C | ≥ 7 nuits (14 recommandées) HRV, FC repos, sommeil | Recovery, Exertion, zone cible, besoin de sommeil | I5 |

### 16.2 Plugin `healthkit` (contrat, § 19)

| Commande | Entrée | Sortie |
| --- | --- | --- |
| `healthkit_authorize` | types lecture / écriture | statut par type |
| `healthkit_read_quantity` | type (`hrvSDNN`, `restingHeartRate`, `stepCount`, `activeEnergy`, `heartRate`, `respiratoryRate`, `wristTemperature`, `bodyMass`), fenêtre | échantillons horodatés |
| `healthkit_read_sleep` | fenêtre | segments avec stade |
| `healthkit_read_workouts` | fenêtre | workouts (type, début, fin, énergie, UUID) |
| `healthkit_write_workout` | début, fin, énergie | UUID |
| `healthkit_write_body_mass` / `delete_sample` | valeur, date / UUID | ok |
| `healthkit_observe` | types | événements vers le front (observer queries, `H-13`) |

### 16.3 Scores (niveau C)

| Score | Définition | Constante |
| --- | --- | --- |
| Baseline | Moyenne et σ glissants sur 14 nuits valides (7 min) de HRV et FC repos ; outliers > 2,5 σ exclus de la baseline | `baselineDays: 14`, `minNights: 7` |
| Recovery 0–100 | `z_hrv = (HRV − μ) / σ`, `z_fc = (μ_fc − FC) / σ_fc` ; `raw = 0,7 z_hrv + 0,3 z_fc` borné \[−2, 2\] ; `score = 50 + 25 raw`, × facteur sommeil \[0,8 ; 1,0\] ; **null** avec raison si mesure absente, < 7 nuits ou σ = 0 | `hrvWeight: 0.7` |
| Qualité | good / partial / insufficient | — |
| Exertion 0–10 | `cardio = Σ min_zone_i × w_i`, w = \[1,2,3,4,5\] (zones depuis FC max estimée ou mesurée) ; `muscu = tonnage/1000 × facteur` (0,8 / 1 / 1,2) ; `10 × (1 − e^(−(cardio+muscu)/k))` | `k: 300` |
| Zone cible | ≥ 66 → 6–8 ; 34–65 → 4–6 ; ≤ 33 → 0–3 ; null → aucune | — |
| Sommeil | Besoin = 7 h 30 + 0,2 h × max(0, Exertion\_veille − 5) + dette (7 j, plafond 3 h) ; score = durée / besoin ; régularité σ coucher 7 j | `baseSleepHours: 7.5` |
| Par muscle | 0 % après séance (séries × difficulté) → 100 % sur `recoveryHours[muscle]` (48 / 72 / 96 h) ; cardio importé retire 10 / 25 / 40 % aux jambes, 5 / 10 / 20 % au reste ; **approximation** | `recoveryHours` |

### 16.4 Effets et publication

Recovery Split ; modulation du moteur (maintien ou réduction) ; cadrans Aujourd'hui ; notification du matin ≤ 1/jour (iPhone). L'iPhone écrit `recovery_day` (date, niveau, scores, qualité, raison d'abstention) et `muscle_recovery` ; le PC les lit et les affiche, sans recalcul.

### 16.5 Présentation

Valeur ou « en apprentissage J+x/14 », qualité, contributeurs, « estimation, pas un avis médical » ; aucun cadran à faux zéro.

### 16.6 Tests

Fixtures 30 nuits : baseline, abstention, σ = 0, nuit courte, FC élevée, 3 jours sans Watch, outlier, cardio importé ; vecteurs de synchro pour `recovery_day`.

### 16.7 Compléments issus du benchmark (révision 6.1)

| Fonction | Spécification | Référence | Itération |
| --- | --- | --- | --- |
| Journal de facteurs | Cases cochées le matin (alcool, caféine après 16 h, repas tardif, stress, courbatures, maladie, voyage, entraînement tardif) ; après 30 jours et ≥ 5 occurrences, moyenne de Recovery avec / sans le facteur, affichée avec `n` ; corrélation, pas causalité, dit tel quel | WHOOP Journal, Athlytic | I6 |
| Heure de coucher cible | Besoin de sommeil (§ 16.3) − heure de lever habituelle (médiane 14 j) → heure de coucher proposée ; notification iPhone optionnelle 30 min avant | WHOOP Sleep Planner, Athlytic | I5 |
| Valeurs inhabituelles | FC repos > μ + 2 σ ou HRV < μ − 2 σ deux nuits de suite → carte « valeurs inhabituelles, repos conseillé » ; aucune hypothèse médicale | WHOOP Health Monitor (simplifié) | I6 |
| Pas | Tuile Aujourd'hui : pas du jour, moyenne 7 j (`stepCount`), sans classement ni duel | Reboot Plan | I5 |
| Récupération en séance | Si Recovery ≤ 33 au lancement : bandeau « journée rouge : maintien des charges proposé », un tap pour accepter ou ignorer | Athlytic (zone cible) | I5 |
