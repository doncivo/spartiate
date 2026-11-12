# Guide — tes données de Santé dans Spartiate avec l’app Raccourcis (D-69)

Avec le compte Apple gratuit, Spartiate ne peut pas lire Apple Santé directement (entitlement HealthKit retiré par SideStore).
L’app **Raccourcis** d’Apple, elle, peut lire Santé : un raccourci écrit des fichiers dans iCloud Drive, et Spartiate les lit.
Aucune donnée n’est envoyée à un service tiers : les fichiers restent dans ton iCloud Drive, et les résumés quotidiens (HRV et FC au repos comprises) passent par ta synchro chiffrée vers le PC. Le PC ne reçoit que des résumés quotidiens (prévu, chapitre 16 du PRD ; pas encore livré).

> **Nouveau chemin (version 0.11.1).** Les fichiers se déposent dans `iCloud Drive › Spartiate › sante` (et non plus dans un dossier voisin `Spartiate-sante`) : Spartiate les lit alors tout seul, par l’accès que la synchro a déjà au dossier `Spartiate`. Si tu as déjà créé tes raccourcis, change seulement le sous-chemin de l’action **Enregistrer le fichier** (voir A.1 et B.1) ; l’ancien dossier `Spartiate-sante` peut être supprimé. Pour que la lecture automatique marche, le dossier `Spartiate` doit être lié dans Spartiate (Plus › Appareils et synchro).

Ce guide contient trois parties :

- **Partie A — pesées** (raccourci « Spartiate — poids ») : fonctionne aujourd’hui.
- **Partie B — récupération** (raccourci « Spartiate — récupération ») : le raccourci est décrit ici ; Spartiate lit ses fichiers
  tout seul (voir la section B.4).
- **Partie C — corps et nutrition** (balance Renpho via Santé, raccourci « Spartiate — corps et nutrition », dix fichiers, I6-04) : poids, masse grasse,
  masse maigre, tour de taille, taille, énergie, protéines, glucides, lipides et fibres du jour ; lus tout seuls comme ceux de la partie B.

Durée : 5 minutes pour la partie A, 15 minutes pour la partie B, 20 minutes pour la partie C, une seule fois.

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
4. **Définir le nom** (entre Combiner et Enregistrer)
   - Nom : le nom complet du fichier du bloc (ici `poids.csv`) ; active **Ne pas inclure d’extension de fichier** : sans cela Raccourcis ajoute `.txt` (`hrv.csv.txt`) et Spartiate ne trouve pas le fichier
5. **Enregistrer le fichier**
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

**Réglage iOS à faire une fois (parties A et B)** : Réglages › Raccourcis › Avancé › active **Autoriser le partage de grandes quantités de données** (nom à vérifier sur ton iPhone). À faire avant le premier essai : les fichiers de 30 jours (HRV, pas) sont volumineux.

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
4. **Définir le nom** (entre Combiner et Enregistrer)
   - Nom : le nom complet du fichier du bloc (ex. `hrv.csv`) ; active **Ne pas inclure d’extension de fichier** : sans cela Raccourcis ajoute `.txt` (`hrv.csv.txt`) et Spartiate ne trouve pas le fichier
5. **Enregistrer le fichier**
   - Fichier : *Texte combiné*
   - Désactive **Demander où enregistrer**
   - Destination : **iCloud Drive** · sous-chemin : le nom du fichier du bloc, dans `Spartiate/sante/` (ex. `Spartiate/sante/hrv.csv`)
   - Active **Remplacer si le fichier existe**

| Bloc | Type Santé (nom à vérifier) | Sous-chemin du fichier |
| --- | --- | --- |
| 1 | Variabilité de la fréquence cardiaque | `Spartiate/sante/hrv.csv` |
| 2 | Fréquence cardiaque au repos | `Spartiate/sante/fc-repos.csv` |
| 3 | Sommeil | `Spartiate/sante/sommeil.csv` |
| 4 | Pas | `Spartiate/sante/pas.csv` |

**Réglages propres à chaque type (nom des options à vérifier sur ton iPhone) :**

- **Sommeil** (bloc 3) : choisis le type **Sommeil** (et non un autre type voisin).
- **Pas** (bloc 4) : dans **Rechercher des échantillons Santé**, règle **Grouper par : Jour** (un total par jour) ; dans **Enregistrer le fichier**, laisse **Fichier manquant** désactivé.

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
   - La valeur du stade (*Élément de répétition › Valeur*) doit donner l’un de ces libellés : **Au lit**, **Endormi**,
     **Endormi (non précisé)**, **Éveillé**, **Paradoxal**, **Profond**, **Principal** ou **Essentiel** (libellés en français, à vérifier
     sur ton iPhone ; les libellés anglais In Bed, Asleep, Asleep (Unspecified), Awake, REM, Deep, Core sont lus aussi). Tous les stades
     de l’Apple Watch (Principal ou Essentiel, Profond, Paradoxal, Endormi non précisé) comptent comme temps endormi ; « Au lit » et
     « Éveillé » jamais. Un autre libellé est refusé.
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


**Nom du dossier `sante` (important).** Si tu crées le dossier à la main dans Fichiers, **tape « sante » toi-même, sans utiliser les suggestions du clavier** : la suggestion ajoute une espace ou une majuscule que iOS garde (« sante », « Sante »), et le dossier a un nom différent de « sante » (la lecture le retrouve en général, mais retaper le nom évite tout doute). Si Spartiate dit « Dossier sante illisible (nom du dossier) », renomme-le en tapant « sante » à la main, puis touche « Importer maintenant ».

**Après une mise à jour de Spartiate** qui change le calcul du sommeil, les résumés des 30 derniers jours sont recalculés une seule fois, à l’ouverture suivante, à partir des données déjà lues, sans rien faire de ta part : même si le dossier `sante` n’est pas joignable ou si les fichiers sont absents. Si ce recalcul est interrompu, il est repris à l’ouverture suivante.
Cette lecture automatique est constatée sur ton iPhone (H-26, 11 nov. 2026). Si Spartiate dit que le dossier n’a pas pu être lu, lie le dossier `Spartiate` dans Plus → Appareils et synchro, ou utilise **Choisir les fichiers**.

L’écran Apple Santé montre, pour chaque type, la date du dernier import, le nombre de lignes ajoutées, déjà connues et refusées (avec la raison du refus : nombre de colonnes, date sans fuseau, stade inconnu…), sans jamais afficher une valeur de mesure. Un fichier absent est dit « absent », ce n’est pas une erreur.

---

## Partie C — Corps et nutrition (balance Renpho via Santé, I6-04)

Ta balance Renpho écrit ton poids, ta masse grasse, ta masse maigre (et parfois ton tour de taille) dans **Santé**. Le raccourci
« Spartiate — corps et nutrition » les copie, avec l’énergie et les macros du jour (protéines, glucides, lipides, fibres), dans dix fichiers
du dossier `iCloud Drive › Spartiate › sante`. Spartiate les lit seul, comme ceux de la partie B. Aucune donnée n’est envoyée à un service tiers :
les fichiers restent dans ton iCloud Drive, et les valeurs passent par ta synchro chiffrée vers le PC.

Durée : 20 minutes, une seule fois. Les noms de fichiers ci-dessous sont **exacts** (minuscules, tirets, sans accent) : Spartiate refuse tout autre nom.

| Fichier | Type Santé (nom à vérifier) | Unité écrite | Regroupement | Ce que Spartiate en fait |
| --- | --- | --- | --- | --- |
| `poids.csv` | Poids | kg (lb accepté) | aucun | une pesée Santé par jour, la plus récente ; ta saisie manuelle n’est jamais remplacée |
| `masse-grasse.csv` | Pourcentage de graisse corporelle | % | aucun | une valeur par jour (Corps) |
| `masse-maigre.csv` | Masse maigre | kg (lb accepté) | aucun | une valeur par jour (Corps) |
| `tour-taille.csv` | Tour de taille | cm (m, po acceptés) | aucun | une valeur par jour (Corps) |
| `taille.csv` | Taille | cm (m, po acceptés) | aucun | une valeur par jour (Corps) |
| `energie.csv` | Énergie alimentaire | kcal (cal, kJ acceptés) | Grouper par **Jour** | total du jour (journal, voir C.12) |
| `proteines.csv` | Protéines | g | Grouper par **Jour** | total du jour |
| `glucides.csv` | Glucides | g | Grouper par **Jour** | total du jour |
| `lipides.csv` | Lipides (graisse totale) | g | Grouper par **Jour** | total du jour |
| `fibres.csv` | Fibres | g | Grouper par **Jour** | total du jour (Corps) |

Si ton iPhone n’expose pas un de ces types sous ce nom, cherche le plus proche dans la liste de **Rechercher des échantillons Santé**
(nom à vérifier sur ton iPhone) ; si un type n’existe pas du tout (par exemple le tour de taille, que Renpho n’écrit pas toujours), saute simplement
son bloc : un fichier absent n’est pas une erreur.

### C.1 Créer le raccourci

Dans **Raccourcis** → **+** → nomme-le « Spartiate — corps et nutrition ». Le raccourci contient **dix blocs identiques dans la structure**, un par
fichier. Pour chaque bloc :

1. **Rechercher des échantillons Santé**
   - Type : voir le bloc ci-dessous
   - Ajoute un filtre : **Date de début** · **au cours des derniers** · **30 jours**
   - Trier par : **Date de début** · Ordre : **Plus ancien en premier**
   - Regroupement : voir le bloc (**Grouper par : Jour** pour la nutrition)
2. **Répéter avec chaque** (élément : *Échantillons Santé*). À l’intérieur de la boucle :
   1. **Formater la date** — Date : **Élément de répétition** → **Date de début** ; format **Personnalisé** → `yyyy-MM-dd'T'HH:mm:ssZZZZZ`
   2. **Texte**, avec exactement : *Date formatée* `;` *Élément de répétition › Valeur* `;` *Élément de répétition › Unité*
      (trois variables séparées par un point-virgule, sans espace)
3. Après **Fin de la répétition** : **Combiner le texte** · *Résultats de la répétition* · avec **Nouvelles lignes**
4. **Définir le nom** — le nom complet du fichier du bloc ; active **Ne pas inclure d’extension de fichier** (sans cela Raccourcis ajoute `.txt`
   et Spartiate ne trouve pas le fichier)
5. **Enregistrer le fichier** — Fichier : *Texte combiné* · désactive **Demander où enregistrer** · destination **iCloud Drive** · sous-chemin
   `Spartiate/sante/<nom du fichier>` · active **Remplacer si le fichier existe**

Le réglage iOS « Autoriser le partage de grandes quantités de données » (partie B) vaut aussi ici.

**Si tu as déjà le raccourci « Spartiate — poids » (partie A)** : il écrit déjà `poids.csv` dans le bon format. Garde-le et saute le bloc 1, ou remplace-le
par le bloc 1 : n’écris jamais deux fois le même fichier.

### C.2 Bloc 1 — `poids.csv`

- **Type Santé** : Poids
- **Unité** : kg (Spartiate convertit les lb)
- **Regroupement** : aucun (un échantillon par ligne ; la pesée la plus récente du jour est gardée)
- **Fichier** : `Spartiate/sante/poids.csv`
- **Réglages** : 30 jours, plus ancien en premier. Exemple : `2026-11-08T06:50:12+01:00;81,4;kg`
- Plausible : 20 à 500 kg ; au-delà, la ligne est refusée et comptée.

### C.3 Bloc 2 — `masse-grasse.csv`

- **Type Santé** : Pourcentage de graisse corporelle
- **Unité** : % (Santé la garde en fraction, 0,185 ; Spartiate lit aussi `18,5;%` et `0,185;`, le résultat est 18,5 %)
- **Regroupement** : aucun
- **Fichier** : `Spartiate/sante/masse-grasse.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T06:50:12+01:00;18,5;%`
- Plausible : 3 à 60 %.

### C.4 Bloc 3 — `masse-maigre.csv`

- **Type Santé** : Masse maigre
- **Unité** : kg (lb accepté)
- **Regroupement** : aucun
- **Fichier** : `Spartiate/sante/masse-maigre.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T06:50:12+01:00;64,3;kg`
- Plausible : 15 à 200 kg.

### C.5 Bloc 4 — `tour-taille.csv`

- **Type Santé** : Tour de taille
- **Unité** : cm (m et po convertis)
- **Regroupement** : aucun
- **Fichier** : `Spartiate/sante/tour-taille.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T06:50:12+01:00;82;cm`
- Plausible : 40 à 200 cm. Rangé dans Corps à part de ta saisie manuelle de la zone « Taille » : jamais écrasée par l’import.

### C.6 Bloc 5 — `taille.csv`

- **Type Santé** : Taille
- **Unité** : cm (Santé donne souvent des mètres, `1,78;m` : Spartiate convertit)
- **Regroupement** : aucun
- **Fichier** : `Spartiate/sante/taille.csv`
- **Réglages** : 30 jours (une taille change rarement : un seul échantillon suffit). Exemple : `2026-11-08T06:50:12+01:00;178;cm`
- Plausible : 100 à 250 cm. N’est **pas** copiée dans ton profil : elle reste une mesure de Corps.

### C.7 Bloc 6 — `energie.csv`

- **Type Santé** : Énergie alimentaire (Énergie consommée selon la version d’iOS)
- **Unité** : kcal (cal compté comme kcal, kJ converti)
- **Regroupement** : **Grouper par : Jour** (un total par jour). Sans regroupement, laisse un échantillon par ligne : Spartiate les additionne par jour,
  mais **ne mélange pas** les deux manières dans un même fichier
- **Fichier** : `Spartiate/sante/energie.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T00:00:00+01:00;2300;kcal`
- Plausible : de 1 à 10 000 kcal par jour ; un jour hors limites est refusé et compté. **Sans énergie un jour donné, rien n’est écrit pour ce jour.**

### C.8 Bloc 7 — `proteines.csv`

- **Type Santé** : Protéines · **Unité** : g · **Regroupement** : Grouper par **Jour** · **Fichier** : `Spartiate/sante/proteines.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T00:00:00+01:00;150;g` · plausible : 0 à 600 g par jour.

### C.9 Bloc 8 — `glucides.csv`

- **Type Santé** : Glucides · **Unité** : g · **Regroupement** : Grouper par **Jour** · **Fichier** : `Spartiate/sante/glucides.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T00:00:00+01:00;260;g` · plausible : 0 à 1 500 g par jour.

### C.10 Bloc 9 — `lipides.csv`

- **Type Santé** : Lipides (Graisse totale) · **Unité** : g · **Regroupement** : Grouper par **Jour** · **Fichier** : `Spartiate/sante/lipides.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T00:00:00+01:00;70;g` · plausible : 0 à 600 g par jour.

### C.11 Bloc 10 — `fibres.csv`

- **Type Santé** : Fibres · **Unité** : g · **Regroupement** : Grouper par **Jour** · **Fichier** : `Spartiate/sante/fibres.csv`
- **Réglages** : 30 jours. Exemple : `2026-11-08T00:00:00+01:00;28;g` · plausible : 0 à 300 g par jour. Les fibres sont gardées dans Corps (Spartiate n’a pas de
  colonne de fibres dans le journal).

### C.12 Comment Spartiate range la nutrition (« les deux selon les jours »)

- Si tu as saisi **au moins un repas** dans le journal Spartiate pour un jour, **le journal fait foi** : l’import n’écrit rien pour ce jour.
- Sinon, une **seule** ligne « **Renpho — total du jour** » porte les totaux (énergie, protéines, glucides, lipides) de ce jour, dans le journal. Un nouvel import
  **met à jour cette même ligne**, jamais de doublon.
- Si tu saisis ensuite un repas ce jour-là, la ligne « Renpho — total du jour » est **supprimée** : ton journal la remplace.
- Si tu supprimes toi-même la ligne « Renpho — total du jour » (ou une mesure de Corps), elle **ne revient pas** au prochain import.
- Une ligne de total n’est pas une journée « complète » : l’état de la journée reste celui que Spartiate calcule (ou que tu déclares).
- Pour corriger un total importé, saisis tes repas : le journal prend le relais.

### C.13 Premier essai et automatisation

1. Touche ▶︎ : Raccourcis demande l’accès à chaque type Santé : **Autoriser** pour chacun.
2. Ouvre Fichiers → iCloud Drive → Spartiate → sante : les fichiers des blocs que tu as créés apparaissent.
3. Spartiate → **Plus** → **Apple Santé** → « Corps et nutrition depuis Raccourcis » → **Importer maintenant** : chaque fichier dit ses lignes lues, ajoutées,
   mises à jour et refusées (avec la raison), sans jamais afficher une valeur.
4. Automatisation : Raccourcis → **Automatisation** → **+** → **Heure de la journée** → 07:45 puis 22:00, **Quotidiennement** → **Exécuter
   immédiatement** → « Spartiate — corps et nutrition ». Spartiate lit alors tout seul, au plus une fois toutes les 30 minutes.

---

## En cas de souci

- « Aucune pesée lisible » (partie A) : ouvre `poids.csv` dans Fichiers et vérifie qu’une ligne ressemble à l’exemple de la partie A
  (date avec `+01:00` ou `Z` à la fin, point-virgule, valeur).
- Une ligne sans fuseau horaire est ignorée (heure ambiguë). C’est le cas le plus fréquent avec une date écrite à la main.
- Une ligne au stade inconnu (sommeil) est ignorée : vérifie le libellé du stade dans la section B.1.
- Une valeur écrite avec un espace de milliers (ex. `8 200`) est rejetée : vérifie que `pas.csv` contient `8200`.
- Un fichier très long (plus de 10 000 lignes) n’est lu que jusqu’à cette limite. Sur 30 jours, un fichier de pas peut l’atteindre.
- Plus → Logs : les échecs d’import y sont notés (`shortcut-import-failed`, `body-import-failed`), sans aucune valeur de mesure.
- Partie C : « valeur hors limites » = la valeur sort des bornes plausibles de son fichier (voir C.2 à C.11), la ligne n’est pas importée ; « date sans fuseau horaire » : vérifie le format `yyyy-MM-dd'T'HH:mm:ssZZZZZ`.
- Partie C : un jour sans énergie n’écrit rien dans le journal ; un jour où tu as saisi un repas garde ton journal (C.12).
- Partie C : Spartiate ne lit que les quatorze noms exacts (les quatre de la partie B et les dix de la partie C) ; `Poids.csv`, `poids.csv.txt` ou `masse_grasse.csv` sont ignorés.
- **Ne copie jamais le contenu d’un fichier** (données de santé) dans un message, un ticket ou une capture d’écran. Pour demander de
  l’aide, donne seulement le nombre de lignes et la raison du rejet.
