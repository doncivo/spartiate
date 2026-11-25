# Constats à faire par Ali

Liste unique des constats sur appareil qui restent ouverts (backlog, matrice des capacités, CHANGELOG 0.28.0, 0.28.1, 0.29.0 et 0.29.1).

**Usage.** Pour chaque constat : coche `- [ ]` → `- [x]` et note la date (AAAA-MM-JJ) et la version installée à la fin de la ligne. Écris « OK » ou « KO » et une phrase, sans valeur personnelle (pas de poids, de mesure, de cible chiffrée ni de date de séance réelle). Un constat concluant fait passer la ligne de `docs/capability-matrix.md` à CONFIRMED et, pour le backlog, la ligne à « fait » (D-36). Un constat non concluant reste UNVERIFIED ; note ce qui s'est passé.

**Sécurité.** Ne supprime aucune app et ne fais aucune nouvelle installation par-dessus l'existante : la mise à jour passe par « Mettre à jour » dans SideStore. Ne lance aucun installeur. Les captures restent hors du dépôt et ne montrent ni données de santé ni code d'appairage.

**Repères.** « Plus › X » désigne l'écran Plus puis la ligne X. Les libellés sont ceux de `src/i18n/fr*.ts` ; un libellé marqué « (à vérifier) » n'a pas été relu à l'écran.

---

## iPhone

### Aujourd'hui

- [ ] **BL-016** — Aujourd'hui, pendant un cycle de programme : regarde le repère sous le titre → il affiche « Semaine n sur m » (n et m à l'écran) ; en semaine de décharge, un badge « Décharge » en bronze ; sans cycle, rien. Date : ____ Version : ____
- [ ] **CHANGELOG 0.29.0** — Aujourd'hui, carte du poids et des pas : l'objectif de pas (8 000 par défaut) s'affiche et se règle → la valeur suit le réglage, sans écrire de donnée de santé. Date : ____ Version : ____

### Entraînement › Séance

- [ ] **BL-020 (journée rouge)** — Entraînement, un jour où la récupération est dans la zone rouge (Recovery 33 ou moins), séance ouverte : « Accepter l’allègement » → les charges affichées sont environ 5 % plus basses, arrondies vers le bas au matériel ; séries et répétitions inchangées ; sans jour rouge, aucun bandeau. Date : ____ Version : ____
- [ ] **§ 13.7** — Entraînement › Séance : lance un repos (ou le minuteur de test, Plus › À propos et diagnostic), verrouille l'iPhone, attends la fin, déverrouille → la fin est à l'heure prévue (pas de dérive), le minuteur reprend après le verrouillage, et l'arrêt est correct. Date : ____ Version : ____
- [ ] **§ 23.3 (verrouillage)** — Démarre une séance, verrouille l'iPhone deux minutes, déverrouille → la séance est retrouvée telle quelle (séries saisies conservées). Date : ____ Version : ____
- [ ] **§ 23.3 (visuel)** — Parcours manuel des écrans Aujourd'hui, Entraînement, Nutrition, Progrès et Plus, en thème clair puis sombre → aucun texte coupé, aucun contraste manifestement illisible. Date : ____ Version : ____
- [ ] **H-4 (Live Activity, deux défauts)** — Lance le minuteur de test (Plus › À propos et diagnostic › Minuteur de test, 60 s), verrouille l'iPhone → le décompte est lisible sur l'écran verrouillé (texte clair sur fond de la charte) ; à la fin, l'activité affiche « Terminé » et non 0:00 ; la notification « Minuteur terminé » arrive à l'échéance. Date : ____ Version : ____
- Renvoi : **H-35** se coche dans Entraînement › Cardio ci-dessous (même geste).
- [ ] **C-078 (SEANCE-0292)** — Entraînement › Séance, séance ouverte : tape une charge et des répétitions dans une série SANS la valider, attends deux secondes, ferme l'app de force (balayage vers le haut), rouvre-la et reviens à la séance → la saisie est là et la série est toujours « À faire ». Date : ____ Version : ____
- [ ] **§ 10.3 (SEANCE-0292)** — Sur un iPhone où Spartiate n'a jamais demandé les notifications (sinon : sans objet, coche « sans objet ») : fais une première séance avec un repos → aucune demande pendant la séance, le repos reste visible dans l'app ; « Terminer la séance » → iOS demande l'autorisation des notifications. Date : ____ Version : ____

### Entraînement › Cardio

- [ ] **C-083 (SEANCE-0292)** — Entraînement › Cardio, formulaire : touche « Heure de début » → un sélecteur d'heure s'ouvre (24 h) ; touche « Durée » → le pavé numérique a une virgule ; tape « 45,30 » et enregistre → la séance affiche 45:30. Avec VoiceOver, pendant un suivi GPS : l'annonce de la distance ne revient pas plus d'une fois par minute (pas à chaque dizaine de mètres). Date : ____ Version : ____
- [ ] **H-35** — Entraînement › Cardio › « Démarrer le suivi GPS » : autorise « pendant l'utilisation », marche un parcours de distance connue (par exemple 1 km mesuré) app ouverte, puis passe brièvement en arrière-plan et reviens → l'autorisation est demandée en français ; la distance est juste à environ 5 % près ; l'écart observé après le retour est noté tel quel ; « Arrêter et reporter » remplit durée et distance ; la séance porte « Suivi GPS · Tracé gardé sur cet appareil ». Date : ____ Version : ____
- [ ] **BL-021 (refus de la localisation)** — Réglages iOS › Spartiate › Localisation (à vérifier) : refuse ; puis Entraînement › Cardio › « Démarrer le suivi GPS » → le refus est dit par un texte à l'écran et la saisie à la main reste possible. Remets ensuite l'autorisation si tu le souhaites. Date : ____ Version : ____
- [ ] **BL-021 (Exertion avec cardio)** — le lendemain d'une séance cardio longue saisie, regarde la carte de récupération (écran à confirmer) → l'Exertion de la veille est plus haute, et la phrase « L'Exertion compte la musculation et le cardio saisi (minutes × ressenti). » est présente. Date : ____ Version : ____

### Entraînement › Routines et Importer un programme

- [ ] **H-40 (coller)** — Entraînement › Routines › Importer un programme : colle un bloc préparé avec le guide (ou des lignes « Squat 4×8-10 ») → l'aperçu montre chaque exercice rapproché de la bibliothèque et les lignes non reconnues ; rien n'est écrit avant « Créer la routine » ; la routine créée se retrouve sur le PC après synchro. Date : ____ Version : ____
- [ ] **H-40 (photo)** — même écran, « Lire une photo ou une capture » : photo d'un programme papier, puis capture d'écran d'un programme (inventé ou public) → part des exercices lus sans retouche, lignes « non reconnues » montrées, routine créée après confirmation. Date : ____ Version : ____
- Renvoi : **BL-017 (routine)** se coche dans « Les deux appareils › Synchro ».

### Entraînement › Matériel

- [ ] **BL-019 (« Salle complète »)** — Entraînement › Matériel : « Salle complète » est active par défaut ; ton historique et tes routines sont intacts ; si un exercice de ta routine n'existe pas dans cette salle, il porte l'avertissement habituel. Date : ____ Version : ____

### Entraînement › Bibliothèque

- [ ] **H-8** — Entraînement › Bibliothèque › fiche d'exercice : relis les 14 correspondances d'images (liste dans `docs/MEDIA-02.md`, section « Constats à faire par Ali » ; notamment les pressions aux haltères, le pull-over au câble, le développé militaire et le rowing barre prise large) → l'image montre le même mouvement ; sinon note le nom de l'exercice. Relis aussi les exercices de tes routines. Date : ____ Version : ____
- [ ] **BL-009** — Bibliothèque › fiche d'un exercice avec photo réduite : l'image est lisible en thème clair et en thème sombre (réglage du thème : Plus, à vérifier). Date : ____ Version : ____
- [ ] **BL-012** — même fiche, en thème sombre : le fond de l'image inversée est-il encore noir, au lieu de la teinte de la carte ? « Oui » = défaut toujours présent (BL-012 reste ouvert). Date : ____ Version : ____
- [ ] **BL-132 (iPhone)** — Bibliothèque › fiche d'un exercice sans photo (pictogramme, mention « pictogramme » sous le dessin) : les deux positions (départ et arrivée) et le muscle principal en bronze correspondent au mouvement ; regarde aussi quelques pictogrammes de ta routine. Date : ____ Version : ____

### Progrès

- [ ] **BL-016 (Strength Score)** — Progrès › Strength Score : chaque groupe affiche un score, ou « — » avec sa raison s'il manque des données ; jamais « 0 » pour un groupe sans donnée. Lis aussi la note sur la source des normes (voir « Documents » ci-dessous). Date : ____ Version : ____
- [ ] **BL-019 (fibres Renpho)** — Nutrition › Journal : saisis un repas un jour où l'import Renpho avait déjà mis un total de fibres → Progrès › Corps montre toujours les fibres de ce jour (elles ne disparaissent pas au repas saisi). Date : ____ Version : ____
- [ ] **CHANGELOG 0.29.0 (bilan)** — Progrès › Bilan de la semaine : chaque phrase indique d'où vient son chiffre ; une semaine sans données dit « pas assez de données » et pas 0 ; l'export en Markdown fonctionne. Date : ____ Version : ____
- [ ] **H-32** — Progrès › Corps, verrouillage de l'app désactivé : ouvre Corps avec une photo, puis balaie vers le sélecteur d'apps → aucune photo visible dans l'aperçu ; quitte Corps, balaie de nouveau → aperçu normal. Date : ____ Version : ____
- [ ] **H-27** — Progrès › Corps › « Ajouter une photo » : la photothèque et l'appareil photo sont proposés ; la photo s'affiche et reste après relance de l'app ; aucune photo n'est envoyée sur le réseau (rien à voir dans l'app). Date : ____ Version : ____
- Renvoi : **H-19a / C-113** se coche dans « Réglages iOS » ci-dessous ; **C-152** dans « Plus » ci-dessous.

### Nutrition

- [ ] **BL-016 (Stratégie avec cible à venir)** — Nutrition › Stratégie, après une cible acceptée avec une date future : la cible en vigueur et, à côté, « À partir du… » avec la cible à venir sont affichées ; « Fixer ma cible » n'est pas pré-rempli avec une valeur prête à écraser ; un enregistrement qui passe devant une cible future demande une confirmation. Date : ____ Version : ____
- Renvoi : **BL-017 (cible du jour)** se coche dans « Les deux appareils › Synchro ».
- [ ] **CHANGELOG 0.29.0 (repas rapides)** — Nutrition › Journal : « Copier le repas d’hier » puis « Copier la journée d’hier » → les repas arrivent au journal, la quantité se modifie avant l'ajout, et les repas favoris sont enregistrés comme recettes d'une portion. Date : ____ Version : ____
- [ ] **H-12 (scan, gestes 1 à 4)** — Nutrition › Journal › recherche d'un aliment, par scan de code-barres :
  1. scanne un produit de marque → fiche Open Food Facts, provenance et attribution visibles ;
  2. recherche « skyr » et appuie sur « Chercher en ligne » → résultats en ligne ;
  3. refais le même scan en mode avion → fiche lue du cache, sans réseau ;
  4. scanne un code inconnu → message et fiche personnelle pré-remplie.
  Refuse ensuite la caméra une fois pour voir le chemin Réglages › Spartiate › Appareil photo (à vérifier). Date : ____ Version : ____

### Récupération

- [ ] **BL-018 (réveil avec « Au lit »)** — Plus › Apple Santé : pour la dernière nuit importée, l'heure de réveil est la fin du dernier segment endormi, et non la fin du bloc « Au lit » (un long bloc « Au lit » ne repousse pas le réveil). Date : ____ Version : ____
- [ ] **BL-018 (stades inconnus)** — Plus › Apple Santé : une nuit contenant un stade non reconnu affiche la raison « stade de sommeil inconnu » ; un stade connu n'est jamais compté comme absent. Date : ____ Version : ____
- [ ] **BL-018 (relecture à 45 s)** — Plus › Journaux : après une ouverture de l'app sans nouveauté, une seule entrée « recovery-import-reread » (ok ou skipped) apparaît environ 45 s plus tard ; aucune boucle. Date : ____ Version : ____
- [ ] **BL-018 (journal de recalcul)** — Plus › Journaux (à vérifier) : après une lecture, les entrées « recovery-import-diag-sleep » donnent le nombre de nuits courtes et longues ; le recalcul de règle se fait sans fichier importé. Date : ____ Version : ____
- [ ] **H-25 (pas.csv)** — lance le raccourci « Spartiate — récupération », puis Plus › Apple Santé › Raccourcis : ligne « Pas (pas.csv) » → le fichier est lu sans refus, ou les lignes rejetées portent leur raison à l'écran. Note en mots le séparateur, la décimale et le fuseau (pas les valeurs). Date : ____ Version : ____

### Plus

- [ ] **H-17 (verrou, activation)** — Plus › « Verrouillage Face ID » : désactivé par défaut ; active-le → Face ID est demandé ; refuse une fois → rien n'est activé, un message le dit. Date : ____ Version : ____
- [ ] **H-17 (verrou, relance)** — verrou activé : ferme puis rouvre l'app → écran de verrou ; Face ID → déverrouillé ; annule Face ID puis « Déverrouiller » → le repli sur le code de l'iPhone s'affiche. Date : ____ Version : ____
- [ ] **H-17 (verrou, arrière-plan)** — retour au premier plan après plus de 30 s → verrou ; après moins de 30 s → pas de verrou ; dans le sélecteur d'apps, aucun contenu lisible. Date : ____ Version : ____
- [ ] **H-41 (Apple Intelligence)** — Plus › Journaux › Outils de test › « Essai Apple Intelligence » → « Lancer l’essai » : note (ou capture hors dépôt) la réponse ou le message d'erreur et son motif. Le log de `build-ios.yml` indique si le SDK contient FoundationModels. Date : ____ Version : ____
- [ ] **H-38 / C-152 (sauvegarde iCloud)** — Réglages › [ton nom] › iCloud › Gérer le stockage › Sauvegardes › cet iPhone : Spartiate est absent ou n'occupe que quelques Ko. Vérifie que le journal reste visible dans Fichiers › Sur mon iPhone › Spartiate › Journal, et que Plus › À propos et diagnostic n'affiche aucune ligne rouge « sauvegarde iCloud ». Pour C-152, note si la base et les photos sont comptées dans la sauvegarde (la liste par app suffit ; ne regarde pas les fichiers). Date : ____ Version : ____
- [ ] **CHANGELOG 0.28.0 (thème clair)** — Plus en thème clair : interrupteurs éteints nettement visibles ; anneau de focus visible au clavier sur le PC (voir la section PC). Date : ____ Version : ____
- [ ] **CHANGELOG 0.28.1 (gêne)** — Profil › Blessures : déclare une gêne fictive (par exemple « une gêne fictive » sur un muscle), puis marque-la « guérie » → la gêne passe à l'état guéri (libellé à l'écran à confirmer). Date : ____ Version : ____

### Réglages iOS (texte agrandi, transversal)

- [ ] **H-19a / C-113 (Dynamic Type)** — Réglages iOS › Luminosité (chemin de la matrice ; à vérifier sur ton iOS) › Taille du texte, au plus grand. Ouvre Aujourd'hui, une séance, Nutrition, Progrès et Plus → le texte grandit, aucun écran ne déborde, aucun bouton n'est coupé. Date : ____ Version : ____

### Recette

- [ ] **§ 23.1 h (recette signée)** — exécute l'itération en cours de `docs/qa/iphone.md`, après l'avoir mise à jour (son état date du 4 novembre) ; consigne une capture datée et le verdict. Date : ____ Version : ____

---

## PC

### Aujourd'hui

- [ ] **BL-016 (repère)** — Aujourd'hui, pendant un cycle : « Semaine n sur m » sous le titre ; semaine de décharge : badge « Décharge » ; sans cycle, rien. Date : ____ Version : ____

### Entraînement › Séance

- [ ] **BL-014** — Démarre une séance sur le PC, fenêtre à la largeur d'usage (environ 1 210 px) : aucune coupure, aucun débordement horizontal, les boutons restent accessibles au clavier. Date : ____ Version : ____

### Entraînement › Routines

- [ ] **BL-013 (lâcher sur un champ)** — Entraînement › Routines : glisse la poignée d'un exercice et lâche-la sur un champ (« Nom du jour », nom de la routine, champ d'un exercice) → aucun texte n'est inséré dans le champ. Date : ____ Version : ____
- [ ] **BL-013 (réordonner et clavier)** — éditeur d'une routine : glisse un exercice par sa poignée, puis un jour ; sur une poignée, Alt+↑ et Alt+↓ déplacent l'élément d'un cran ; avec le Narrateur, l'annonce donne la position. Date : ____ Version : ____
- [ ] **H-40 (photo, PC)** — Entraînement › Routines › Importer un programme › « Lire une photo ou une capture » : une photo d'un programme papier et une capture d'écran → lignes lues, exercices rapprochés, lignes non reconnues montrées, routine créée après confirmation. Date : ____ Version : ____
- Renvoi : **BL-017 (routine, PC)** se coche dans « Les deux appareils › Synchro ».

### Entraînement › Bibliothèque

- [ ] **BL-009 (PC)** — Bibliothèque › fiche d'un exercice avec photo réduite : lisible en thème clair et en thème sombre. Date : ____ Version : ____
- [ ] **BL-012 (PC)** — même fiche, en thème sombre : fond noir au lieu de la teinte de la carte ? « Oui » = défaut présent. Date : ____ Version : ____
- [ ] **BL-132 (PC, planche)** — ouvre `docs/maquettes/propositions/pictogrammes/planche.html` dans un navigateur : relis les 6 essais (Fente bulgare, Hip thrust à la barre, Tirage visage, Élévation latérale poulie, Squat gobelet, Relevé de jambes suspendu), puis les 8 de la routine (Enroulement du tronc, Extension triceps au-dessus de la tête, Fente bulgare, Hip thrust, Relevé de jambes suspendu, Rowing machine appui poitrine, Tirage visage, Élévation latérale poulie), en portant une attention particulière aux cas douteux (planche Copenhague, dips, dead bug, squat cosaque) → chaque pose correspond au mouvement. Les corrections vont dans `scripts/content/pictograms/specs.mjs`, puis `node scripts/content/build-pictograms.mjs`. Cas douteux corrigés : à lister dans `docs/MEDIA-03.md` ou la fiche du lot (à compléter après ta relecture). Date : ____ Version : ____

### Progrès

- [ ] **BL-016 (Strength Score, PC)** — Progrès › Strength Score : mêmes attendus que sur iPhone (score par groupe, « — » avec sa raison, jamais 0). Date : ____ Version : ____
- [ ] **CHANGELOG 0.29.0 (bilan, PC)** — Progrès › Bilan de la semaine : phrases sourcées, « pas assez de données » plutôt que 0, export en Markdown. Date : ____ Version : ____

### Nutrition

- Renvoi : **BL-017 (cible du jour, PC)** se coche dans « Les deux appareils › Synchro ».

### Plus

- [ ] **BL-019 (export, colonne unit)** — Plus › Export complet (CSV et JSON) : ouvre `csv/measurement.csv` dans Excel → la colonne `unit` est lisible (cm, pct, kg, g ; vide si inconnue). Date : ____ Version : ____
- [ ] **CHANGELOG 0.28.1 (clic droit)** — Plus › Journaux, puis une entrée du journal : clic droit, puis (autre essai) Maj+F10 → un menu contextuel apparaît ; double-clic sur une séance de l'historique l'ouvre. Date : ____ Version : ____
- [ ] **CHANGELOG 0.28.1 (barre latérale)** — replie la barre latérale puis déplie-la → la mise en page reste correcte. Date : ____ Version : ____
- [ ] **CHANGELOG 0.28.0 (thème clair, PC)** — Plus en thème clair : interrupteurs éteints visibles ; navigue au clavier (Tab) : un anneau de focus bleu bien visible. Date : ____ Version : ____
- [ ] **H-39 (capture d'appairage)** — Plus › Appareils et synchro : lance l'appairage ; pendant que le code est affiché, fais une capture (Impr. écran ou Outil Capture) → la fenêtre est noire ou vide dans la capture, et le code n'apparaît pas. Ne garde ni ne publie cette capture (elle contient le code si elle échoue). Date : ____ Version : ____

### Largeur et écrans

- [ ] **BL-015 (écrans à 1 210 px)** — parcours Aujourd'hui, Entraînement, Nutrition, Progrès et Plus à la largeur d'usage (environ 1 210 px) → aucun écran ne déborde, aucun texte n'est coupé. Date : ____ Version : ____
- [ ] **BL-015 (« Pris » en erreur)** — ce cas ne se provoque pas à la demande : si une erreur survient après « Pris » depuis une notification, note-la ; l'état doit rester visible sur Aujourd'hui. Date : ____ Version : ____

---

## Les deux appareils

Ces constats demandent les deux appareils : coche-les après avoir fait le geste sur chacun.

### Synchro

- [ ] **H-34 (rappel retiré)** — Nutrition › Compléments : active « Rappels sur cet iPhone » ; ajoute un complément dont la prise tombe bientôt ; coche la prise sur le PC avant l'heure ; rouvre l'iPhone après synchro → aucune notification à l'heure de la prise (la notification suivante de cette heure n'est plus planifiée). Note l'heure du test, pas une valeur personnelle. Date : ____ Version : ____
- [ ] **BL-020 (favoris)** — Nutrition › Rechercher un aliment, requête vide : tes favoris d'avant sont là sur chaque appareil ; un favori ajouté sur l'un apparaît sur l'autre après synchro ; retiré d'un côté et ajouté de l'autre, les deux gestes sont gardés. Date : ____ Version : ____
- [ ] **BL-021 (cardio saisi sur PC)** — saisis une séance cardio sur le PC (Entraînement › Cardio, sans GPS) ; après synchro, la séance apparaît sur l'iPhone, sans tracé, avec sa durée, sa distance et son ressenti. Date : ____ Version : ____
- [ ] **BL-015 (bandeau « appareil plus ancien »)** — provoque ce cas seulement si un appareil est resté en version précédente (sinon, note « non rencontré ») : le bandeau nomme le bon appareil à mettre à jour et ne propose rien d'autre. Date : ____ Version : ____
- [ ] **BL-017 (routine et cible)** — après la mise à jour (0.27.0 et suivantes) : Entraînement › Routines, ta routine : chaque jour porte son jour de la semaine (un import le fait si la mise à jour ne l'a pas fait) ; un jour de la semaine lance le jour prévu pour ce jour-là ; Nutrition › Stratégie : la cible du jour est la cible en vigueur, et une cible planifiée à date future n'est pas battue par une décision antérieure. Au lancement d'un cycle, la durée proposée reprend ton dernier réglage ; en cours de cycle, un changement de durée ne s'applique qu'après confirmation. Date : ____ Version : ____
- [ ] **BL-157 (clé de synchro après une mise à jour SideStore)** — avant une mise à jour SideStore N → N+1, note sur l'iPhone que la synchro fonctionne (Plus › Appareils et synchro : dernière synchro récente, une saisie faite sur le PC visible sur l'iPhone) ; après la mise à jour par « Mettre à jour » dans SideStore, vérifie que la synchro reprend sans redemander la clé ni l'appairage (une nouvelle saisie du PC arrive sur l'iPhone). Date : ____ Version : ____

### Documents (sans appareil, à lire)

- [ ] **H-11 (licence Ciqual, BL-156)** — lis la section « Licence — table Ciqual de l'Anses » de docs/licences.md et la page de l'entrepôt citée (DOI 10.57745/RDMHWY) : la licence indiquée est bien la Licence Ouverte Etalab 2.0 ; dans Nutrition › Rechercher un aliment, tape « pomme » : l'attribution Ciqual est écrite sous les résultats. Date : ____
- [ ] **H-9** — relis dans `docs/licences.md` la section « Médias d'exercices » : sources, licences et attributions. Puis, sur l'iPhone, vérifie que l'attribution s'affiche sous une image (légende). Date : ____ Version : ____
- [ ] **H-37 (normes du Strength Score)** — lis la documentation de la source des normes (FitnessVolt, citée dans `docs/licences.md`) : elle dit ce que mesurent les charges publiées (1RM ou charge totale). À défaut, compare un de tes scores avec la page de la source pour le même 1RM. Date : ____ Version : ____
- [ ] **H-8 (contenu)** — relis la bibliothèque (150 exercices) au regard de tes routines et programmes : les exercices qui te manquent ou qui te gênent sont notés. Date : ____ Version : ____

---

## 0.29.1

Après la mise à jour des deux appareils le même jour (CHANGELOG 0.29.1) :

- [ ] **BL-109 (écartés communs)** — iPhone, Entraînement › séance › « Retirer, ne plus proposer » sur un exercice ; puis PC, générer une séance du même jour de routine → l'exercice n'est plus proposé ; « Remettre » sur le PC → il revient sur l'iPhone. Date : ____ Version : ____
- [ ] **BL-120 (gênes communes)** — PC, Plus › Profil › Blessures, déclarer une gêne fictive ; iPhone, même écran → elle y est ; la marquer « guérie » sur l'iPhone → guérie sur le PC. Date : ____ Version : ____
- [ ] **BL-119 (zoom 150 %)** — PC, Paramètres Windows › Affichage › Échelle 150 % ; rouvrir Spartiate → barre latérale à gauche (jamais la barre d'onglets du bas), aucune bande horizontale à faire défiler, fenêtre entière à l'écran. Date : ____ Version : ____
- [ ] **Migration 21** — premier lancement après la mise à jour, sur chaque appareil → Plus › Journaux : aucune erreur de migration ; une sauvegarde « Avant mise à jour » existe ; tes anciens exercices écartés et tes gênes sont toujours là. Date : ____ Version : ____

- [ ] **0.29.1 (Progrès › Entraînement)** — sous chaque muscle, la ligne « Semaine dernière : n, dans / sous / au-dessus de la plage cible » (plage de 10 à 20) correspond aux séries de la semaine passée. Date : ____ Version : ____
- [ ] **0.29.1 (carte Adhérence)** — la carte Adhérence affiche « Prescriptions respectées » (séries faites, charges tenues). Date : ____ Version : ____
- [ ] **0.29.1 (Progrès › Bilan, Recommandations)** — la section « Recommandations » apparaît avec trois sous-parties (Entraînement, Nutrition, Sommeil et récupération), chacune avec sa règle, ou « aucune recommandation (pas assez de données) ». Date : ____ Version : ____

---

## 0.29.2

Après la mise à jour des deux appareils le même jour (CHANGELOG 0.29.2) :

- [ ] **C-103 (champ heure, Q-24)** — iPhone, Journal › Rechercher › choisir un aliment : le champ « Heure » s'affiche en 24 h (jamais AM / PM). Si tu vois AM / PM, réponds à Q-24. Date : ____ Version : ____
- [ ] **Migration 22** — premier lancement après la mise à jour, sur chaque appareil → Plus › Journaux : aucune erreur de migration ; une sauvegarde « Avant mise à jour » existe ; ton profil de matériel « Salle complète » est toujours le profil actif. Date : ____ Version : ____
- [ ] **C-105 (silhouette, Q-25)** — iPhone, Progrès › Corps : toucher le cou, les épaules et la poitrine de la silhouette sélectionne bien la zone touchée, sans en prendre une voisine. Date : ____ Version : ____

## 0.29.3

Après la mise à jour des deux appareils le même jour (CHANGELOG 0.29.3) :

- [ ] **Migration 23** — premier lancement après la mise à jour, sur chaque appareil → Plus › Journaux : aucune erreur de migration ; une sauvegarde « Avant mise à jour » existe ; tes séances et tes profils de progression sont intacts. Date : ____ Version : ____
- [ ] **0.29.3 (séries ajoutées)** — pendant une séance, ajoute une série, termine, puis Progrès › Entraînement › Adhérence : la ligne « Séries ajoutées en séance : 1 » apparaît, et la série n'abaisse pas les prescriptions respectées ; même chiffre sur l'autre appareil après synchro. Date : ____ Version : ____
- [ ] **0.29.3 (planche)** — Entraînement › Bibliothèque › Planche : la photo s'affiche avec son auteur, sa licence et la mention de modification. Date : ____ Version : ____

## 0.29.4

Après la mise à jour des deux appareils le même jour (CHANGELOG 0.29.4) :

- [ ] **§ 13.3 b (« +30 s » de la notification)** — iPhone, pendant une séance, valide une série, verrouille l'iPhone et attends la notification de fin de repos ; appuie longuement dessus puis sur « +30 s » : l'app s'ouvre (après Face ID) et la séance affiche un repos d'environ 30 s, une nouvelle notification sonne à la fin. Date : ____ Version : ____
- [ ] **BL-108 (« Passer » de la notification)** — même geste avec « Passer » : l'app s'ouvre, aucun repos n'est en cours et la Live Activity a quitté l'écran verrouillé et la Dynamic Island. Date : ____ Version : ____
- [ ] **C-156 (Live Activity, deux départs rapprochés)** — iPhone, valide deux séries coup sur coup (moins d'une seconde d'écart) : une seule Live Activity dans la Dynamic Island, avec le libellé de la dernière série. Date : ____ Version : ____
- [ ] **C-159 (écran de confidentialité, H-32)** — iPhone, Progrès › Corps (photos ouvertes), balaie depuis le bas et garde le doigt pour ouvrir le sélecteur d'apps sans quitter l'app : l'aperçu de Spartiate est uni, sans photo. Date : ____ Version : ____

## Table de contrôle (ID → section)

Chaque ligne « constat d'Ali » ouverte du registre (`docs/backlog.md`, `docs/capability-matrix.md`) et chaque consigne « Après la mise à jour » des sections 0.28.0, 0.28.1 et 0.29.0 du CHANGELOG figure ici.

| ID | Sections |
| --- | --- |
| C-103 | 0.29.2 |
| C-105 | 0.29.2 |
| BL-009 | iPhone › Bibliothèque ; PC › Bibliothèque |
| BL-012 | iPhone › Bibliothèque ; PC › Bibliothèque |
| BL-013 | PC › Routines |
| BL-014 | PC › Séance |
| BL-015 | iPhone (« Pris » en erreur) ; PC › Largeur et écrans ; Les deux appareils › Synchro (bandeau) |
| BL-016 | iPhone › Aujourd'hui, Progrès, Nutrition ; PC › Aujourd'hui, Progrès |
| BL-017 | Les deux appareils › Synchro |
| BL-018 | iPhone › Récupération |
| BL-019 | iPhone › Matériel ; iPhone › Progrès (fibres) ; PC › Plus (export) |
| BL-020 | iPhone › Séance (journée rouge) ; Les deux appareils › Synchro (favoris) |
| BL-021 | iPhone › Cardio ; Les deux appareils › Synchro |
| BL-132 | iPhone › Bibliothèque ; PC › Bibliothèque |
| BL-157 | Les deux appareils › Synchro |
| H-4 | iPhone › Séance |
| H-8 | iPhone › Bibliothèque ; Les deux appareils › Documents |
| H-9 | Les deux appareils › Documents |
| H-11 | Les deux appareils › Documents |
| H-12 | iPhone › Nutrition |
| H-17 | iPhone › Plus |
| H-19a | iPhone › Réglages iOS ; PC › Largeur et écrans (contrôle du texte) |
| H-25 | iPhone › Récupération |
| H-27 | iPhone › Progrès |
| H-32 | iPhone › Progrès |
| H-34 | Les deux appareils › Synchro |
| H-35 | iPhone › Cardio |
| H-37 | Les deux appareils › Documents ; Progrès (Strength Score) |
| H-38 | iPhone › Plus |
| H-39 | PC › Plus |
| H-40 | iPhone › Routines ; PC › Routines |
| H-41 | iPhone › Plus |
| C-078 | iPhone › Entraînement › Séance |
| C-083 | iPhone › Entraînement › Cardio |
| C-113 | iPhone › Réglages iOS |
| C-152 | iPhone › Plus |
| § 10.3 | iPhone › Entraînement › Séance |
| § 13.7 | iPhone › Séance |
| § 23.1 h | iPhone › Recette |
| § 23.3 | iPhone › Séance (verrouillage, visuel) |
| CHANGELOG 0.28.0 (thème clair, focus) | iPhone › Plus ; PC › Plus |
| CHANGELOG 0.28.1 (gêne fictive) | iPhone › Plus |
| CHANGELOG 0.28.1 (clic droit, barre latérale) | PC › Plus |
| CHANGELOG 0.29.0 (objectif de pas) | iPhone › Aujourd'hui |
| CHANGELOG 0.29.0 (bilan) | iPhone › Progrès ; PC › Progrès |
| CHANGELOG 0.29.0 (repas rapides) | iPhone › Nutrition |
| CHANGELOG 0.29.0 (verrou, essai Apple Intelligence, programme, photo, pictogrammes) | iPhone › Plus ; iPhone › Routines ; iPhone › Bibliothèque ; PC › Routines |
| 0.29.1 (Progrès, Adhérence, Recommandations) | 0.29.1 |
| § 13.3 b | 0.29.4 |
| BL-108 | 0.29.4 |
| C-156 | 0.29.4 |
| C-159 | 0.29.4 |

## Doutes à trancher

- Libellés et chemins marqués « (à vérifier) » : thème, Taille du texte iOS, Réglages › Spartiate › Localisation, Plus › Journaux, carte de récupération (écran).
- BL-015 onboarding : le constat « synchro reçue pendant la revue de l'onboarding » ne peut pas se faire sur des données réelles sans risque. Non listé ici comme geste ; à trancher par le product-owner (ou sur un environnement de laboratoire, D-38).
- BL-018 : les noms d'entrées du journal (« recovery-import-reread », « recovery-import-diag-sleep ») viennent du code ; le chemin à l'écran est à confirmer.
- C-152 : la liste de sauvegarde iCloud ne sépare pas toujours base et photos ; le constat se limite à ce que l'écran affiche.
- § 23.1 h : `docs/qa/iphone.md` décrit l'état du 4 novembre ; sa mise à jour est préalable.
- H-11 (Ciqual) et H-10 (Camera Control) : pas de constat d'Ali inscrit au registre, donc non listés.
- H-24 (libellés des stades) : non listé au registre comme constat ouvert.
- Les constats « non rencontré » (« Pris » en erreur, bandeau d'appareil plus ancien) ne se provoquent pas à la demande ; le marquer « non rencontré » laisse la ligne ouverte.
