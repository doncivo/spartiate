# Guide — tes pesées de Santé dans Spartiate avec l’app Raccourcis (D-69)

Avec le compte Apple gratuit, Spartiate ne peut pas lire Apple Santé directement (entitlement HealthKit retiré par SideStore).
L’app **Raccourcis** d’Apple, elle, peut lire Santé : un raccourci écrit tes pesées dans un fichier d’iCloud Drive, et Spartiate
importe ce fichier. Rien ne quitte ton iPhone et ton iCloud.

Durée : 5 minutes, une seule fois.

## 1. Créer le raccourci « Spartiate — poids »

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
   - Destination : **iCloud Drive** · sous-chemin : `Spartiate-sante/poids.csv`
   - Active **Remplacer si le fichier existe**

Touche ▶︎ une fois : Raccourcis demande l’accès à Santé (Poids) → **Autoriser**. Le fichier `iCloud Drive › Spartiate-sante ›
poids.csv` apparaît dans l’app Fichiers.

Exemple de contenu : `2026-11-08T06:50:12+01:00;81,4;kg`

N’utilise pas le dossier `iCloud Drive › Spartiate` : il est réservé à la synchronisation.

## 2. Le lancer chaque matin (facultatif)

Raccourcis → onglet **Automatisation** → **+** → **Heure de la journée** → 9:00, **Quotidiennement** → **Exécuter immédiatement**
(sans demander) → choisis « Spartiate — poids ».

## 3. Importer dans Spartiate

Spartiate → **Plus** → **Apple Santé** → **Importer le fichier du raccourci** → choisis `Spartiate-sante/poids.csv`.

- Une pesée par jour est gardée : la plus récente.
- Elles apparaissent avec l’origine « Santé » ; ta saisie manuelle du jour n’est jamais remplacée.
- Réimporter le même fichier ne crée aucun doublon.
- Le PC les reçoit ensuite par la synchronisation.

## En cas de souci

- « Aucune pesée lisible » : ouvre `poids.csv` dans Fichiers et vérifie qu’une ligne ressemble à l’exemple ci-dessus (date avec
  `+01:00` ou `Z` à la fin, point-virgule, valeur).
- Une ligne sans fuseau horaire est ignorée (heure ambiguë).
- Plus → Logs : les échecs d’import y sont notés (`shortcut-import-failed`), sans aucune valeur de poids.
