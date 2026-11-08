# Contenu embarqué de Spartiate

Données uniquement, aucune logique métier. Le contenu est généré avec Claude Code, **à relire par Ali (H-8)** : voir `docs/i1-01-contenu-a-relire.md`. Aucune image ni vidéo n'est embarquée (H-9, D-71) : les exercices s'affichent sans image.

## Structure

| Chemin | Contenu |
| --- | --- |
| `exercises/exercises.json` | `{ schemaVersion: 1, exercises: [150 exercices] }` (PRD § 14.1), dans l'ordre des groupes de la préparation |
| `exercises/muscles.json` | Liste fermée des 34 muscles `{ id, nameFr, group }` |
| `exercises/equipment.json` | Liste fermée des 69 matériels `{ id, nameFr, family }` |
| `exercises/media/` | Réservé aux médias sous licence vérifiée (vide) ; tout média exige `license` et `source` |
| `equipment-profiles/profiles.json` | `{ schemaVersion: 1, defaultProfileId, profiles: [4] }` : Fitness Park Antony (défaut) et trois préréglages |
| `food/ciqual.json` | `{ schemaVersion: 1, source, groups, foods: [3 484 aliments Ciqual 2025] }` : énergie, protéines, lipides, glucides et fibres pour 100 g (`null` = inconnue, jamais 0), généré par `scripts/content/build-ciqual.mjs` depuis les XML officiels de l'Anses (Licence Ouverte Etalab 2.0, voir `docs/licences.md`), chargé à la demande |
| `programs/*.json` | Un fichier par programme de départ (PRD § 12.5) : `haut-bas-4j`, `full-body-3j`, `ppl-6j`, `maison-halteres-3j` |

Les fichiers XML bruts de Ciqual (70 Mo) ne sont pas versionnés ; `node scripts/content/build-ciqual.mjs --check` valide `food/ciqual.json` sans eux (les tests de `scripts/content/ciqual.test.ts` aussi).

## Identifiants

Kebab-case anglais (`bench-press-barbell`), stables : un identifiant publié ne change jamais (il est référencé par les routines, les séries et les instantanés de synchro). Un exercice embarqué n'a aucune ligne SQL : `routine_exercise.exercise_id` et `workout_set.exercise_id` contiennent l'`id` du JSON (P-09, pas de clé étrangère).

## Compatibilité de matériel

`equipment` liste tout le matériel cité ; `equipmentGroups` est une liste de groupes d'alternatives : l'exercice est faisable si, **pour chaque groupe, au moins un matériel** est présent dans le profil (`isExerciseCompatible` dans `scripts/content/validate-content.mjs`). Le matériel facultatif (« lest éventuel ») figure dans `equipment` mais dans aucun groupe.

## Valider

```
npm run validate:content
node scripts/content/validate-content.mjs content/
npx vitest run --coverage.enabled=false --maxWorkers=1 --project node scripts/content
```

Le validateur (Node, sans dépendance) sort en code 1 avec des lignes `::error::` sur : identifiant dupliqué, référence inconnue (muscle, matériel, alternative, exercice de programme, profil), champ manquant, valeur hors liste, média sans licence ou fichier absent, somme des poids des muscles principaux < 1, périodisation différente de D-20, exercice incompatible avec le profil du programme, comptage ≠ 150 exercices / 4 programmes.
