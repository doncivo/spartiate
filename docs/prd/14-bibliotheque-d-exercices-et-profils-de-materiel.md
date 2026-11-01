## 14. Bibliothèque d'exercices et profils de matériel

### 14.1 Contenu (I1)

150 exercices en JSON embarqué (`content/exercises/exercises.json`), générés avec Claude Code et **relus par toi**, validés en CI par `scripts/content/validate-content.mjs` (Node, sans dépendance, comme les scripts CircleTasks) :

```json
{
  "id": "bench-press-barbell",
  "nameFr": "Développé couché à la barre",
  "aliasesEn": ["barbell bench press"],
  "muscles": [{"id": "chest", "weight": 1.0}, {"id": "triceps", "weight": 0.5}, {"id": "front-delts", "weight": 0.3}],
  "equipment": ["barbell", "flat-bench"],
  "pattern": "push-horizontal",
  "kind": "compound",
  "metric": "load-reps",
  "bodyweightFraction": null,
  "defaultRepRange": [5, 10],
  "defaultRestSec": 150,
  "instructions": {"setup": "…", "execution": "…", "mistakes": ["…", "…", "…"]},
  "media": {"images": ["bench-press-barbell-1.jpg", "bench-press-barbell-2.jpg"], "video": null, "license": "…", "source": "…"},
  "strengthStandardKey": "bench",
  "schemaVersion": 1
}
```

Règles : `id` unique et stable ; `nameFr` et instructions non vides ; muscles et matériel dans des listes fermées (`muscles.json`, `equipment.json`) ; pattern ∈ {push-horizontal, push-vertical, pull-horizontal, pull-vertical, hinge, squat, lunge, carry, core, isolation} ; `metric` ∈ {load-reps, bodyweight-reps, time, distance} ; chaque média a licence et source (`H-9`). Les médias sont servis depuis le bundle (hors du plafond du bundle de départ : chargés à la demande, règle CircleTasks).

### 14.2 Fiche, recherche, custom

Fiche Info / Instructions / Historique (PR, 1RM, confiance, graphique Recharts) ; recherche nom FR / alias EN, body map, matériel, pattern ; custom en I1 (table `exercise`, publiée par la synchro), complétion IA depuis le nom en I6 ; évaluation hypertrophie en I6.

### 14.3 Profils de matériel

Plusieurs profils (salle, maison, voyage), un actif par appareil (le profil actif est une préférence locale, les profils eux-mêmes sont synchronisés) ; barres (type, poids), disques (inventaire par côté), haltères (plage, pas), kettlebells, machines (stack min / max / pas, 1RM par profil), câbles, bancs, racks, poids de corps ; incréments par type ; forcés / interdits ; préréglages « salle commerciale », « maison haltères », « poids de corps ».
