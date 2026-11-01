## 10. Onboarding et profil

En I1, configuration minimale (unités, premier profil de matériel, dossier iCloud si tu veux synchroniser). L'onboarding complet arrive en I3, sur PC ou iPhone, et se synchronise. HealthKit (iPhone) est demandé de façon contextuelle avec un mode dégradé.

### 10.0 Parcours de bout en bout (J0 → J7)

Le fil complet, de l'installation à la première synchro, avec pour chaque étape l'application de référence dont on reprend le geste. Il sert de scénario E2E de référence (§ 23) et de check-list de la première semaine.

| Étape | Appareil | Ce qui se passe | Référence reprise | Cible |
| --- | --- | --- | --- | --- |
| 1. Installer | PC | Installeur NSIS depuis `spartiate-releases` (chaîne CircleTasks) ; premier lancement, choix du dossier iCloud Drive | CircleTasks | < 2 min |
| 2. Onboarding | PC | 8 écrans (§ 10.1) : objectif, expérience, fréquence, durée, matériel, body map, split, résultat ; estimation initiale de la dépense (Mifflin) affichée comme « point de départ, recalculé après 2 semaines » | Alpha Progression (wizard, body map) ; MacroFactor (dépense initiale honnête) | < 8 min |
| 3. Première routine | PC | Un programme de départ (§ 12.5) ou génération (§ 12.1) ; édition en grille jours × exercices ; charges de départ déduites des standards de force avec décote 10 % | Alpha Progression (éditeur), Gravl (1RM initial) | < 5 min |
| 4. Ajouter l'iPhone | PC → iPhone | Plus → Appareils → « Ajouter un iPhone » affiche un QR ; sur l'iPhone, installation via SideStore (source `spartiate-releases`), ouverture, « J'ai déjà un PC », scan du QR, appairage ; la routine et le profil arrivent en < 60 s ; aucune permission iOS demandée à ce stade | CircleTasks (SideStore, appairage ADR 0011) | < 10 min hors SideStore |
| 5. Première séance | iPhone | Aujourd'hui → Lancer (≤ 3 taps) ; séries pré-remplies ; tap sur la charge → « charge de départ estimée depuis ton niveau, affinée dès la 2ᵉ séance » ; timer de repos Live Activity ou notification ; Facile / Juste / Dur ; Finish → résumé, écriture Apple Santé (première demande de permission, ici et pas avant) | Hevy (un écran, 10 s), Gravl (explication), Reboot Plan / Alpha (Dynamic Island) | Séance ≤ durée choisie |
| 6. Synchro retour | iPhone → PC | La séance terminée est publiée ; le PC l'affiche dans Historique et Progrès sans action | CircleTasks (synchro) | < 60 s après Finish |
| 7. Deuxième séance | iPhone | Premières recommandations réelles avec « Pourquoi ? » ; rep ladder ; records détectés | Alpha (recommandations dès la 2ᵉ séance), Gravl | — |
| 8. Première semaine | Les deux | Pesées (manuelles ou Santé) ; journal nutrition facultatif tant que I4 n'est pas livré ; J+6 : notification « signature à renouveler » (I-02) ; J+7 : si ≥ 4 jours loggés, premier check-in proposé, sinon « en apprentissage » | MacroFactor (check-in), CircleTasks (expiration) | Aucun faux zéro, aucun écran vide |

Critère : un utilisateur qui suit ces 8 étapes sans lire de documentation arrive à l'étape 6 le premier jour. Le scénario est rejoué à chaque release (Playwright pour 1–3, 6 ; check-list iPhone § 23.1 pour 4, 5, 7, 8).

### 10.1 Onboarding complet (I3)

| # | Étape | Données | Règle |
| --- | --- | --- | --- |
| 1 | Toi | Sexe, naissance, taille, poids (pré-rempli depuis Apple Santé sur iPhone si autorisé) | Standards de force et macros |
| 2 | Objectif | Muscle / force / recomposition / perte de gras / maintien ; rythme en % du poids par semaine | Borné −1 % à +0,5 % |
| 3 | Expérience | Débutant / intermédiaire / avancé | Charges de départ conservatrices |
| 4 | Disponibilité | Séances par semaine, durée, jours | La durée plafonne les séries |
| 5 | Matériel | Préréglage salle / maison à affiner | Profil actif |
| 6 | Priorités | Body map : 2 muscles à prioriser, 4 à éviter ; patterns douloureux | Exclusion sans promesse de prévention |
| 7 | Split | Proposé selon la fréquence ; variété Consistent / Balanced / Varied | Modifiable |
| 8 | Résultat | Première séance + cibles du jour | Commencer / Modifier |

Brouillon persisté ; toute question non essentielle ignorable.

### 10.2 Profil éditable

Tout ce qui précède, mensurations, photos de progression (locales, synchro optionnelle I6), % MG déclaré, blessures avec check-in bimensuel, clé API et plafond (par appareil), unités, jour de check-in, notifications (iPhone), verrou (Face ID / code iPhone, code PC : code conservé, entrée masquée, activation différée jusqu'à ta décision, D-37), profil de matériel actif, synchronisation (écran repris de CircleTasks).

### 10.3 Permissions (iPhone)

| Permission | Quand | Mode dégradé |
| --- | --- | --- |
| HealthKit lecture poids | Première pesée ou étape 1 | Saisie manuelle |
| HealthKit écriture séances / pesées | Fin de première séance | Séances dans l'app seulement |
| HealthKit HRV, FC repos, sommeil | Premier écran Récupération (I5) | Fatigue déclarée |
| Notifications | Fin de première séance | Timer visible dans l'app |
| Caméra | Premier scan ou photo | Recherche texte |
| Face ID | Activation du verrou | Code |
| Localisation | Premier cardio (I6) | Cardio sans tracé |
