# Importer un programme dans Spartiate (IMPORT-029, PRD § 17.4)

Entraînement › Routines › **Importer un programme**. Deux voies, le même aperçu :

1. **Coller un texte** : le bloc structuré ci-dessous (le plus sûr), ou des lignes libres (« Squat 4×8-10 »).
2. **Lire une photo ou une capture** (iPhone : Vision ; PC : lecture de texte de Windows) : les lignes lues remplissent le texte, que tu peux corriger avant l'aperçu.

Rien n'est écrit avant « Créer la routine ». L'aperçu montre chaque séance, chaque exercice rapproché de la bibliothèque, ses séries, sa plage de répétitions et son RIR, ainsi que toute ligne non reconnue avec sa raison (jamais ignorée). La routine créée est une routine **Libre** ordinaire : modifiable dans l'éditeur, synchronisée. Aucune charge n'est importée : la charge de départ reste la tienne (D-72). Le texte et l'image restent sur l'appareil ; rien n'est envoyé à un service.

Le PDF n'est pas lu (aucune voie sans dépendance nouvelle) : fais une capture de la page et passe par la photo.

## 1. Bloc structuré (à faire remplir par Claude)

Format : un objet JSON `{ "name", "sessions": [ { "name", "exercises": [ { "name", "sets", "repsMin", "repsMax", "rir" } ] } ] }`.

| Champ | Obligatoire | Valeurs |
| --- | --- | --- |
| `name` | non | nom de la routine (modifiable dans l'aperçu) |
| `sessions[].name` | non | nom de la séance (« Jour A — Poussée ») ; absent : « Séance n » |
| `exercises[].name` | oui | nom de l'exercice en français, comme dans un programme papier |
| `exercises[].sets` | oui | entier de 1 à 20 |
| `exercises[].repsMin`, `repsMax` | oui (`repsMax` absent : égal à `repsMin`) | entiers de 1 à 999, `repsMin` ≤ `repsMax` ; secondes pour un exercice tenu (planche) |
| `exercises[].rir` | non | entier de 0 à 5 (répétitions en réserve), ou `null` |
| `exercises[].restSec` | non | repos en secondes, de 0 à 900 ; absent : repos par défaut de l'exercice |

Le bloc peut être collé avec le texte qui l'entoure ou dans une clôture de code : Spartiate lit l'objet entre la première `{` et la dernière `}`.

### Consigne à coller dans une conversation avec Claude

> Convertis le programme ci-dessous en un bloc JSON unique, sans commentaire, au format suivant : `{"name": string, "sessions": [{"name": string, "exercises": [{"name": string, "sets": entier, "repsMin": entier, "repsMax": entier, "rir": entier ou null}]}]}`. Une séance par jour d'entraînement, dans l'ordre. Noms d'exercices en français, sans abréviation (« Développé couché à la barre », pas « DC »). Une plage « 8-10 » donne `repsMin` 8 et `repsMax` 10 ; un nombre seul donne la même valeur aux deux. `rir` seulement s'il est écrit (RIR ou « reps en réserve »), sinon `null` ; ne convertis pas un RPE. N'ajoute aucun exercice, aucune charge, aucun échauffement. Programme :
>
> (colle ici ton programme)

### Exemple prêt à l'emploi (programme inventé)

```json
{
  "name": "Haut / Bas d'essai",
  "sessions": [
    {
      "name": "Jour A — Haut",
      "exercises": [
        { "name": "Développé couché à la barre", "sets": 4, "repsMin": 6, "repsMax": 8, "rir": 2 },
        { "name": "Rowing à la barre", "sets": 4, "repsMin": 8, "repsMax": 10, "rir": 2 },
        { "name": "Élévation latérale aux haltères", "sets": 3, "repsMin": 12, "repsMax": 15, "rir": null }
      ]
    },
    {
      "name": "Jour B — Bas",
      "exercises": [
        { "name": "Squat à la barre", "sets": 4, "repsMin": 5, "repsMax": 8, "rir": 2 },
        { "name": "Soulevé de terre roumain à la barre", "sets": 3, "repsMin": 8, "repsMax": 10, "rir": 2 },
        { "name": "Planche", "sets": 3, "repsMin": 30, "repsMax": 45, "rir": null }
      ]
    }
  ]
}
```

## 2. Lignes libres

Une ligne par exercice ; une ligne de titre ouvre une séance.

| Écrit | Lu |
| --- | --- |
| `Jour A — Poussée`, `Séance 1`, `Lundi`, `# Haut du corps`, `Pectoraux :` | titre de séance (mot « Jour », « Séance », « Session », « Semaine », un jour de la semaine, un `#` en tête ou un `:` final) |
| `Squat 4×8-10`, `Curl marteau 3 x 12`, `Rowing 4x8 RIR 2` | 4 séries de 8 à 10 ; 3 séries de 12 ; 4 séries de 8, RIR 2 |
| `Développé couché : 3 séries de 10`, `Fente bulgare 3 séries de 8 à 10 répétitions` | 3 séries de 10 ; 3 séries de 8 à 10 |
| `Planche 3 x 30 s` | 3 séries de 30 secondes |
| `… RIR 1-2` | plage de RIR : la valeur haute est retenue (plus de réserve), et c'est dit |
| `… repos 90 s`, `… repos 2 min` | repos de l'exercice (sans unité : secondes) |
| `Tirage vertical` puis, ligne suivante, `3 x 12` | un exercice (photo d'un tableau en colonnes) |
| `RIR 2` ou `repos 90 s` seul | s'applique à l'exercice de la ligne précédente |
| puces et numéros en tête (`-`, `•`, `1.`, `A1)`) | retirés |

Ce qui n'est pas compris est montré : une ligne sans « séries × répétitions », des séries sans nom, une valeur hors bornes, un RIR sans exercice ; une partie de ligne non lue (« tempo 3-1-1 », « RPE 8 ») est affichée sous l'exercice.

## 3. Rapprochement avec la bibliothèque

Chaque nom est comparé aux exercices de la bibliothèque (embarqués et personnels) : accents, majuscules, articles et pluriels ignorés ; synonymes simples (haltère / dumbbell / DB, barre / barbell / BB, poulie / câble, DC, DI, DM, RDL, SDT). Un score de 0 à 1 en sort :

- **proposé** (score ≥ 0,85 et nettement devant le suivant) : présélectionné, modifiable ;
- **à confirmer** (score de 0,5 à 0,85, ou deux candidats proches) : choix parmi les 3 meilleurs ;
- **à choisir** (score < 0,5) : sélecteur de la bibliothèque.

« Créer la routine » attend que chaque exercice ait le sien (ou soit retiré de l'import).
