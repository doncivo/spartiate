# Guide — tes données de Santé dans Spartiate avec l’app Raccourcis (D-69)

Avec le compte Apple gratuit, Spartiate ne peut pas lire Apple Santé directement (entitlement HealthKit retiré par SideStore).
L’app **Raccourcis** d’Apple, elle, peut lire Santé : un raccourci écrit des fichiers dans iCloud Drive, et Spartiate les lit.
Aucune donnée n’est envoyée à un service tiers : les fichiers restent dans ton iCloud Drive, et les résumés quotidiens (HRV et FC au repos comprises) passent par ta synchro chiffrée vers le PC. Le PC ne reçoit que des résumés quotidiens (prévu, chapitre 16 du PRD ; pas encore livré).

> **Nouveau chemin (version 0.11.1).** Les fichiers se déposent dans `iCloud Drive › Spartiate › sante` (et non plus dans un dossier voisin `Spartiate-sante`) : Spartiate les lit alors tout seul, par l’accès que la synchro a déjà au dossier `Spartiate`. Si tu as déjà créé tes raccourcis, change seulement le sous-chemin de l’action **Enregistrer le fichier** (voir A.1 et B.1) ; l’ancien dossier `Spartiate-sante` peut être supprimé. Pour que la lecture automatique marche, le dossier `Spartiate` doit être lié dans Spartiate (Plus › Appareils et synchro).

Ce guide contient deux parties :

- **Partie A — pesées** (raccourci « Spartiate — poids ») : fonctionne aujourd’hui.
- **Partie B — récupération** (raccourci « Spartiate — récupération ») : le raccourci est décrit ici ; Spartiate lit ses fichiers
  tout seul (voir la section B.4).

Durée : 5 minutes pour la partie A, 15 minutes pour la partie B, une seule fois.

---

## Partie A — Pesées

### A.1 Créer le raccourci « Spartiate — poids »

Dans **Raccourcis** → onglet **Raccourcis** → **+** (en haut à droite) → nomme-le « Spartiate — poids ». Ajoute ces actions dans
l’ordre (barre de recherche « Rechercher des actions ») :

1. **Rechercher des échantillons Santé**
   - Type : **Poids**
   - Ajoute un filtre : **Date de début** · **au cours des derniers** · **30 jours**
   - Trier par : **Date de début** · Ordre : **Plus récent en premier**
2. **Répéter avec chaque** (élément : *Échantillons Santé*). À l’intérieur de la boucle :
   1. **Formater la date**
      - Date : touche le champ → **Élément de répétition** → **Date de début**
      - Format de date : **Personnalisé** → `yyyy-MM-dd'T'HH:mm:ssZZZZZ`
   2. **Texte**, avec exactement : *Date formatée* `;` *Élément de répétition › Valeur* `;` *Élément de répétition › Unité*
      (trois variables séparées par un point-virgule, sans espace)
3. Après **Fin de la répétition** : **Combiner le texte** · *Résultats de la répétition* · avec **Nouvelles lignes**
4. **Enregistrer le fichier**
   - Fichier : *Texte combiné*
   - Désactive **Demander où enregistrer**
   - Destination : **iCloud Drive** · sous-chemin : `Spartiate/sante/poids.csv`
   - Active **Remplacer si le fichier existe**
   - Si Raccourcis ne crée pas le sous-dossier `sante`, crée-le d’abord dans Fichiers (iCloud Drive › Spartiate).

Touche ▶︎ une fois : Raccourcis demande l’accès à Santé (Poids) → **Autoriser**. Le fichier `iCloud Drive › Spartiate › sante ›
poids.csv` apparaît dans l’app Fichiers.

Exemple de contenu : `2026-11-08T06:50:12+01:00;81,4;kg`

Dans `iCloud Drive › Spartiate`, seul le sous-dossier `sante` est pour ces raccourcis. Ne touche à rien d’autre : le dossier `devices` et son contenu appartiennent à la synchro.

### A.2 Le lancer chaque matin (facultatif)

Raccourcis → onglet **Automatisation** → **+** → **Heure de la journée** → 09:00, **Quotidiennement** → **Exécuter immédiatement**
(sans demander) → choisis « Spartiate — poids ».

### A.3 Importer dans Spartiate

Spartiate → **Plus** → **Apple Santé** → **Importer le fichier du raccourci** → choisis `Spartiate/sante/poids.csv`.

- Une pesée par jour est gardée : la plus récente.
- Elles apparaissent avec l’origine « Santé » ; ta saisie manuelle du jour n’est jamais remplacée.
- Réimporter le même fichier ne crée aucun doublon.
- Le PC les reçoit ensuite par la synchronisation.

---

## Partie B — Récupération (sommeil, HRV, FC de repos, pas)

Le raccourci « Spartiate — récupération » écrit quatre fichiers, chacun dans `iCloud Drive › Spartiate › sante` :

| Fichier | Contenu d’une ligne | Exemple |
| --- | --- | --- |
| `hrv.csv` | date ; valeur (SDNN, en ms) | `2026-11-08T06:41:03+01:00;42` |
| `fc-repos.csv` | date ; valeur (bpm) | `2026-11-08T07:02:00+01:00;54` |
| `sommeil.csv` | début ; fin ; stade | `2026-11-07T23:10:00+01:00;2026-11-08T00:05:00+01:00;Profond` |
| `pas.csv` | date ; valeur (nombre de pas) | `2026-11-08T18:12:00+01:00;1250` |

Règles communes :

- Chaque date porte son fuseau (`+01:00` ou `Z` à la fin). Une ligne sans fuseau est ignorée.
- Pas d’en-tête, pas de colonne d’unité : deux colonnes pour HRV, FC de repos et pas ; trois pour le sommeil.
- Un fichier vide est normal s’il n’y a aucune donnée sur 30 jours : ce n’est pas une erreur.

### B.1 Créer le raccourci « Spartiate — récupération »

Dans **Raccourcis** → onglet **Raccourcis** → **+** → nomme-le « Spartiate — récupération ». Le raccourci contient **quatre blocs
identiques dans la structure**, un par fichier, dans cet ordre : HRV, FC de repos, sommeil, pas. Chaque bloc suit les mêmes étapes
(seuls le type Santé, le texte et le nom du fichier changent).

Pour chaque bloc :

1. **Rechercher des échantillons Santé**
   - Type : voir le tableau ci-dessous (noms des types en français, nom à vérifier sur ton iPhone si l’un manque)
   - Ajoute un filtre : **Date de début** · **au cours des derniers** · **30 jours**
   - Trier par : **Date de début** · Ordre : **Plus ancien en premier**
2. **Répéter avec chaque** (élément : *Échantillons Santé*). À l’intérieur de la boucle : voir le détail par bloc ci-dessous.
3. Après **Fin de la répétition** : **Combiner le texte** · *Résultats de la répétition* · avec **Nouvelles lignes**
4. **Enregistrer le fichier**
   - Fichier : *Texte combiné*
   - Désactive **Demander où enregistrer**
   - Destination : **iCloud Drive** · sous-chemin : le nom du fichier du bloc, dans `Spartiate/sante/` (ex. `Spartiate/sante/hrv.csv`)
   - Active **Remplacer si le fichier existe**

| Bloc | Type Santé (nom à vérifier) | Sous-chemin du fichier |
| --- | --- | --- |
| 1 | Variabilité de la fréquence cardiaque | `Spartiate/sante/hrv.csv` |
| 2 | Fréquence cardiaque au repos | `Spartiate/sante/fc-repos.csv` |
| 3 | Analyse du sommeil | `Spartiate/sante/sommeil.csv` |
| 4 | Pas | `Spartiate/sante/pas.csv` |

**Blocs 1, 2 et 4 (HRV, FC de repos, pas) — à l’intérieur de la boucle :**

1. **Formater la date**
   - Date : touche le champ → **Élément de répétition** → **Date de début**
   - Format de date : **Personnalisé** → `yyyy-MM-dd'T'HH:mm:ssZZZZZ`
2. **Texte**, avec exactement : *Date formatée* `;` *Élément de répétition › Valeur*
   (deux variables séparées par un point-virgule, sans espace, et sans unité)

**Bloc 3 (sommeil) — à l’intérieur de la boucle.** Chaque échantillon de sommeil a un début, une fin et un stade. Il faut donc
formater deux dates, puis écrire une ligne `début;fin;stade` :

1. **Formater la date** (début)
   - Date : **Élément de répétition** → **Date de début**
   - Format de date : **Personnalisé** → `yyyy-MM-dd'T'HH:mm:ssZZZZZ`
2. **Formater la date** (fin)
   - Date : **Élément de répétition** → **Date de fin**
   - Même format : `yyyy-MM-dd'T'HH:mm:ssZZZZZ`
3. **Texte**, avec exactement : *Date formatée* (début) `;` *Date formatée* (fin) `;` *Élément de répétition › Valeur*
   - Les deux dates sont les variables produites par les deux actions **Formater la date** (Raccourcis les nomme « Date formatée »
     et « Date formatée 2 » : nom à vérifier).
   - La valeur du stade (*Élément de répétition › Valeur*) doit donner l’un de ces libellés : **Au lit**, **Endormi**, **Éveillé**,
     **Paradoxal**, **Profond**, **Principal** (libellés en français, à vérifier sur ton iPhone). Un autre libellé est refusé.
   - Une seule ligne par segment : ne mets aucun autre texte dans la ligne.

Le texte produit ressemble à : `2026-11-07T23:10:00+01:00;2026-11-08T00:05:00+01:00;Profond`.

### B.2 Premier essai

1. Touche ▶︎ une fois. Raccourcis demande l’accès à chaque type Santé : **Autoriser** pour chacun.
2. Ouvre Fichiers → iCloud Drive → Spartiate → sante. Les quatre fichiers doivent apparaître.
3. Ouvre `sommeil.csv` et vérifie qu’une ligne ressemble à l’exemple ci-dessus.
4. iOS ne dit pas si un accès est refusé. Si un fichier est vide alors que tu as des données, vérifie Réglages › Santé › Accès aux
   données et appareils, puis relance le raccourci (nom du réglage à vérifier).

### B.3 Automatisation quotidienne à 07:30

Raccourcis → onglet **Automatisation** → **+** → **Heure de la journée** → 07:30, **Quotidiennement** → **Exécuter immédiatement**
(sans demander) → choisis « Spartiate — récupération ».

### B.4 Lecture dans Spartiate (automatique)

Spartiate lit les quatre fichiers du dossier `iCloud Drive › Spartiate › sante` **sans que tu fasses rien** :

- à l’ouverture de l’app et à chaque retour au premier plan, **au plus une fois toutes les 30 minutes** ;
- quand tu touches Plus → Apple Santé → **Importer maintenant** (relit le dossier tout de suite) ;
- **Choisir les fichiers** (même écran) reste le secours : le sélecteur d’iOS, si le dossier n’est pas lu.

Chaque fichier encore dans iCloud est téléchargé avant la lecture. La lecture ne modifie, ne renomme et ne supprime rien dans `sante`, et la synchro ne regarde jamais ce dossier : les fichiers ne sont ni publiés, ni chiffrés dans la synchro.

Cette lecture automatique n’est pas encore constatée sur ton iPhone (hypothèse H-26 : à confirmer). Si Spartiate dit que le dossier n’a pas pu être lu, lie le dossier `Spartiate` dans Plus → Appareils et synchro, ou utilise **Choisir les fichiers**.

L’écran Apple Santé montre, pour chaque type, la date du dernier import, le nombre de lignes ajoutées, déjà connues et refusées (avec la raison du refus : nombre de colonnes, date sans fuseau, stade inconnu…), sans jamais afficher une valeur de mesure. Un fichier absent est dit « absent », ce n’est pas une erreur.

---

## En cas de souci

- « Aucune pesée lisible » (partie A) : ouvre `poids.csv` dans Fichiers et vérifie qu’une ligne ressemble à l’exemple de la partie A
  (date avec `+01:00` ou `Z` à la fin, point-virgule, valeur).
- Une ligne sans fuseau horaire est ignorée (heure ambiguë). C’est le cas le plus fréquent avec une date écrite à la main.
- Une ligne au stade inconnu (sommeil) est ignorée : vérifie le libellé du stade dans la section B.1.
- Une valeur écrite avec un espace de milliers (ex. `8 200`) est rejetée : vérifie que `pas.csv` contient `8200`.
- Un fichier très long (plus de 10 000 lignes) n’est lu que jusqu’à cette limite. Sur 30 jours, un fichier de pas peut l’atteindre.
- Plus → Logs : les échecs d’import y sont notés (`shortcut-import-failed`), sans aucune valeur de mesure.
- **Ne copie jamais le contenu d’un fichier** (données de santé) dans un message, un ticket ou une capture d’écran. Pour demander de
  l’aide, donne seulement le nombre de lignes et la raison du rejet.
