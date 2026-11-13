# Changelog Spartiate

Le changelog de l'ancien projet est archivé : `docs/archive/circletasks/CHANGELOG.md` (D-40).

## 0.22.0

Aucune migration : ta base et ta synchro restent telles quelles. Tu peux mettre à jour le PC et l'iPhone quand tu veux.

- **Illustrations d'exercice** : 87 exercices sur 196 ont maintenant un dessin du mouvement dans leur fiche (Entraînement › Bibliothèque). Les dessins viennent d'Everkinetic, sous licence libre CC BY-SA 4.0 ; l'auteur et la licence sont écrits sous chaque image.
- **Rien n'est téléchargé** : les images sont dans l'app (3,7 Mo en tout) et ne se chargent qu'à l'ouverture d'une fiche ; le démarrage ne change pas.
- **Les autres exercices** restent sans image : aucune source à licence vérifiée ne les couvrait ; pas d'icône cassée.
- **À regarder** : si un dessin ne correspond pas à l'exercice, dis-le ; la liste des correspondances est dans `scripts/content/media-map.json`.

## 0.19.1

Rien ne change pour toi à l'écran, aucune migration : ta base et ta synchro restent telles quelles. Tu peux mettre à jour le PC et l'iPhone quand tu veux.

- **Second nettoyage** (ta décision du 12 novembre) : la lecture de texte de secours (tesseract.js), l'analyse de dates en langage libre (chrono-node) et la saisie rapide de tâches, héritées de CircleTasks et sans aucun écran dans Spartiate, sont retirées. L'app embarque environ 4,7 Mo de moins.
- **Gardé exprès** : la lecture de texte native (Vision sur l'iPhone, Windows sur le PC), prévue par le PRD pour importer un programme papier (I6). La retirer demande ta décision.
- **Pas encore fait** : la réécriture des tests de synchro qui s'appuient encore sur les anciennes tâches et projets de CircleTasks (222 fichiers) dépasse ce ticket ; elle passe dans un ticket dédié (CLEAN-03).

## 0.19.0

**Sans migration** (la base reste en schéma 15) : cette version peut s'installer sur PC et iPhone à tout moment.

Premier lot du chantier ergonomie, d'après l'aperçu esthétique que tu as validé le 12 novembre. Mêmes informations, mêmes onglets, seule la présentation change.

- **Séance active** : la série à faire maintenant est mise en avant au centre (« Série en cours », grands chiffres, « Valider la série » plus grand). Après validation, la suivante prend sa place, y compris dans un superset ou un circuit. Sous le chrono, tu vois où tu en es (« Exercice 2 sur 5 »).
- **Repos** : une barre se remplit pendant le repos, en plus du temps restant ; elle reste juste après un « +30 s » ou un redémarrage.
- **Un chiffre par bloc** : calories restantes (Aujourd'hui, Journal, Dashboard), séries faites d'une séance ouverte, Recovery (cadran agrandi), chiffres du résumé de séance et semaine du programme ressortent en grand, en bronze.
- **Moins de cartes** : la nutrition d'Aujourd'hui n'est plus encadrée, les pas sont dans le bloc Récupération, les chiffres du résumé ne sont plus dans une carte.
- **Import Santé plus court** : quand ta récupération date de plusieurs jours, « Ouvrir Apple Santé » est proposé directement dans la carte (un tap de moins).
- **Boutons plus faciles à toucher** : « Annuler » du bandeau d'annulation et les jours de la semaine de la configuration font au moins 44 points.
- **Progrès** ne dit plus « arrive avec une prochaine version » au-dessus de Récupération et Corps, qui y fonctionnent.
- **À valider** : quatre propositions qui changeraient la navigation (lancer la séance du jour en un tap, ajouter un repas en un tap de moins, « − / + » sur la charge, Aujourd'hui sur PC regroupé) t'attendent en maquettes dans `docs/maquettes/propositions/ergo-01-structure/`.

## 0.18.3

**Schéma 16 : mettre à jour le PC et l'iPhone le même jour, avant d'utiliser « Repartir de zéro ».** Migration 0016 : une petite table synchronisée porte les remises à zéro. Un appareil resté en 0.18.2 ou avant affiche « Mets à jour l'app », garde ses données le temps de sa mise à jour, puis efface à son tour.

- **Repartir de zéro** (ta décision) : Plus › Données › « Repartir de zéro », sur l'iPhone et le PC. L'écran dit ce qui est effacé (profil, objectifs, programmes, routines, matériel, séances, nutrition, pesées, mensurations, photos, récupération, Renpho, onboarding) et ce qui est gardé (tes réglages de l'appareil, l'appairage et la clé de synchro, le contenu fourni avec l'app). Tu confirmes en tapant EFFACER. C'est irréversible, sans archive avant.
- **Sur tes deux appareils** : l'autre appareil efface aussi à sa prochaine synchro, même s'il était hors ligne. Rien d'avant ne revient, ni d'un vieux journal, ni d'un appareil en retard. Ce que tu saisis après circule normalement.
- **Comme neuf** : après l'effacement, l'app redémarre sur l'onboarding. Refusé si une séance est en cours. Le dossier Santé n'est pas touché, le prochain import relit ses fichiers. Une sauvegarde d'avant ne peut plus être restaurée par erreur.

## 0.18.2

**Schéma 15 : mettre à jour le PC et l'iPhone le même jour, avant toute saisie.** Migration 0015 : tes favoris d'aliments sont enregistrés dans une table synchronisée. Un appareil resté en 0.18.1 ou avant garde les favoris reçus sans les afficher et les retrouve après sa mise à jour.

- **Favoris synchronisés** (ta décision) : une étoile posée sur le PC apparaît sur l'iPhone et inversement. Tes favoris d'avant sont repris une fois, dans leur ordre, à la première ouverture de « Rechercher un aliment » sur chaque appareil, puis réunis par la synchro, sans doublon. Retirer un favori sur un appareil le retire aussi sur l'autre ; si tu le remets plus tard ailleurs, c'est ton dernier geste qui compte. Un favori dont l'aliment n'est pas encore arrivé sur cet appareil reste masqué au lieu d'être effacé.
- **Journée rouge : charges −5 %** (ta décision) : quand tu acceptes la journée rouge (Recovery 33 ou moins), tes charges sont multipliées par 0,95 et arrondies vers le bas au matériel de ta salle (100 kg → 95 kg), jamais sous la charge la plus petite disponible (barre seule, plus petite paire d'haltères). Séries et répétitions restent celles de ta dernière séance, aucune hausse. Le bandeau dit « charges allégées de 5 % » et le bouton devient « Accepter l'allègement ». Sur un exercice assisté, l'assistance n'est jamais réduite.
- **Export** : l'export et l'export complet (`food_favorite.csv`) portent tes favoris. Une archive faite avant cette version s'importe toujours et ne retire jamais un favori.
## 0.18.1

**Sans migration** (la base reste en schéma 14) : cette version peut s'installer sur PC et iPhone à tout moment.

- **Moteur de base de données à jour** : Spartiate embarque maintenant SQLite 3.54.1 (avant : 3.46.0), qui corrige une faille de sécurité (RUSTSEC-2026-0459) : un fichier de base accompagné d'un journal `-wal` piégé pouvait faire relire des octets de mémoire. Tu n'avais rien à craindre en pratique (Spartiate n'ouvre que ta propre base et tes sauvegardes), mais l'exception qui tolérait cette faille dans nos contrôles est retirée.
- **Rien ne change pour toi** : tes données, tes séances et tes sauvegardes restent lisibles telles quelles. La protection ajoutée en 0.9.4 (une sauvegarde dont le journal `-wal` ne correspond pas est refusée) reste en place.

## 0.18.0

**Schéma 14 : mettre à jour le PC et l'iPhone le même jour, avant toute saisie.** Migration 0014 : les lignes de routine reçoivent leur groupe de circuit. Un appareil resté en 0.17 garde les groupes de routine reçus sans les afficher et les retrouve après sa mise à jour.

- **Superset, triset ou circuit dans tes routines** (ta décision) : dans l'éditeur de routine, « Grouper en circuit » relie des exercices d'un même jour (deux = superset, trois = triset, quatre ou plus = circuit), avec le nombre de tours, le repos entre exercices et le repos de fin de tour. Le groupe est enregistré avec la routine et tu le retrouves dans chaque séance démarrée depuis ce jour : séries alternées, repos du groupe. « Défaire le groupe » ou retirer un exercice d'un superset le dissout. Les programmes de départ et les séances proposées restent sans groupe tant que tu n'en crées pas.
- **Déroulé série par série** (ta décision) : dans Journal, le détail d'une séance passée propose « Voir le déroulé série par série ». Tu y revois chaque série dans l'ordre où tu l'as validée, avec l'heure, la charge, les répétitions et le repos réellement pris face à ce qui était prévu, et l'écart écrit en toutes lettres (« conforme », « 2,5 kg de plus », « plus long de 1 min 30 s »). Le repos est mesuré d'une validation à la suivante, exécution de la série comprise. Si l'heure d'une validation manque, le repos est dit « inconnu », jamais 0. Rien n'est créé ni modifié.
- **« Refaire cette séance »** : le bouton qui crée une nouvelle séance à partir d'une séance passée (même exercices, mêmes groupes, tes charges et répétitions en cibles) s'appelait « Rejouer cette séance ». Il fonctionne comme avant.
- **Export** : l'export et l'export complet (`routine_exercise.csv`) portent les groupes de tes routines. Une archive faite avant cette version s'importe toujours et ne retire jamais un groupe existant.

## 0.17.3

**Sans migration** (la base reste en schéma 13) : cette version peut s'installer sur PC et iPhone à tout moment ; installe pourtant les deux le même jour, pour voir le même nom de salle des deux côtés.

- **Une seule salle : « Salle complète »** (ta décision) : le profil de ta salle devient un profil générique avec tout le matériel d'une grande salle (machines Hammer Strength et Technogym, poulies, cages, Smith, banc décliné, pupitre, haltères de 2 à 58 kg, kettlebells de 4 à 20 kg). C'est le même profil, renommé : tes séances, ton historique, tes routines et ton profil actif ne bougent pas. Le préréglage « Salle commerciale » y est réuni. Tes copies personnelles gardent leur nom et leur contenu.
- **Fibres Renpho** : quand tu saisis un repas un jour où Renpho avait mis son total, ou quand tu supprimes ce total, les fibres de ce jour partent avec lui, tout de suite. Une correction des fibres à 0 g dans Santé est appliquée ; un fichier de fibres absent ne change rien.
- **Export complet** : le fichier `measurement.csv` dit maintenant l'unité de chaque ligne (cm, pct pour la masse grasse, kg, g pour les fibres) ; les valeurs ne changent pas.
- **Premier lancement** : l'assistant de départ ne s'ouvre plus tout seul si ta base contient déjà de la récupération, des facteurs, des mensurations ou des photos.
- **Petites finitions** : le fondu au bord des onglets défilants suit aussi un changement de taille de texte ; dans Plus, la ligne Apple Santé « dernier import » se met à jour dès qu'un import se termine.

## 0.17.2

**Sans migration** (la base reste en schéma 13) : cette version peut s'installer sur PC et iPhone à tout moment ; installe pourtant les deux le même jour, pour que le PC affiche les valeurs inhabituelles comme l'iPhone.

- **Dette de sommeil plus juste** (ta décision) : une nuit courte ajoute ce qui manque pour 7 h 30 ; une nuit longue rembourse maintenant jusqu'à 1 h de dette. La dette reste entre 0 et 3 h, sur les 7 nuits avant aujourd'hui. Avec des nuits irrégulières autour de 7 h 30, ton besoin affiché redescend vers 7 h 30 à 8 h 45 au lieu de 10 h 30.
- **Nuit et réveil** : seuls les moments où tu dors comptent pour délimiter ta nuit ; un long bloc « Au lit » ne relie plus ta nuit à une sieste et ne repousse plus l'heure de ton réveil. Tous les stades de l'Apple Watch (Principal ou Essentiel, Profond, Paradoxal, Endormi non précisé) comptent comme du sommeil.
- **Recalcul automatique** : les résumés des 30 derniers jours sont recalculés une fois avec ces règles, à l'ouverture suivante, même si le dossier `sante` n'est pas joignable ou si les fichiers sont absents. S'il est interrompu, il reprend à l'ouverture d'après.
- **Valeurs inhabituelles** : la carte « repos conseillé » ne s'affiche que pour une HRV ou une FC au repos à plus de 2 σ de ta base (exactement 2 σ ne suffit plus), jugée sur la valeur exacte et non arrondie. Le PC affiche la même décision que l'iPhone.
- **Raccourci à l'ouverture de Spartiate** : si tu lances ton raccourci avec l'automatisation « Lorsque Spartiate est ouverte », Spartiate relit le dossier `sante` une seule fois, environ 45 secondes après l'ouverture, quand la première lecture n'a rien apporté de nouveau. Rien si tu quittes l'app avant. Le guide (`docs/guide-raccourcis-sante.md`, B.3 bis) explique comment créer cette automatisation.

## 0.17.1

**Sans migration** (la base reste en schéma 13) : cette version peut s'installer sur PC et iPhone à tout moment ; installe pourtant les deux le même jour (la règle des photos doit être la même des deux côtés).

- **Import d'une ancienne archive** : une archive faite avant les circuits (0.13.0 ou plus ancienne) n'efface plus tes groupes de circuit ni leurs repos, en « Fusionner » comme en « Remplacer ». Une valeur vraiment vidée dans une archive récente reste appliquée.
- **Photos protégées dans le sélecteur d'apps** : sur iPhone, l'écran Corps cache désormais ses photos dans l'aperçu du sélecteur d'apps, même si le verrouillage de l'app est désactivé ; si la protection ne peut pas se poser, l'écran te le dit. À constater sur ton iPhone (H-32).
- **Supprimer une photo** : seulement sur l'appareil qui a la photo, après confirmation. Sur le PC, qui n'a que la fiche, tu peux seulement « Masquer sur cet appareil » (rien ne change ailleurs) et tout réafficher plus tard.
- **Une suppression venue d'ailleurs n'efface plus ta photo** : si la fiche est supprimée sur l'autre appareil ou par un import, la photo reste sur ton iPhone, marquée « Supprimée sur un autre appareil ou par un import », jusqu'à ce que tu la supprimes toi-même.
- **Photo et fiche enregistrées ensemble** : un échec pendant l'ajout ou la suppression ne laisse plus une fiche sans image ni une image perdue.
- **« Revoir mes réglages »** part maintenant de ton profil et de ta dernière pesée actuels, plus d'un ancien brouillon. Terminer sans rien changer n'écrit rien et ne crée aucune pesée ; si tu remplaces une valeur déjà enregistrée, Spartiate te montre l'avant et l'après et te laisse refuser chaque remplacement.

## 0.17.0

**Sans migration** (la base reste en schéma 13) : cette version peut s'installer sur PC et iPhone à tout moment.

- **Nettoyage** : du code, des textes et des réglages hérités de l'ancien projet de tâches, qui ne servaient plus à rien dans Spartiate, ont été retirés ; rien ne change dans ce que tu vois ni dans tes données.

## 0.16.0

**Sans migration** (la base reste en schéma 13) : cette version peut s'installer sur PC et iPhone à tout moment ; installe pourtant les deux le même jour (un PC resté en 0.15.0 ne sait pas réimporter une archive contenant les nouvelles mesures).

- **Import des données de ta balance Renpho (I6-04)**, via Santé et l'app Raccourcis : dix fichiers de plus dans `iCloud Drive › Spartiate › sante` (poids, masse grasse, masse maigre, tour de taille, taille, énergie, protéines, glucides, lipides, fibres), lus par Spartiate comme ceux de la récupération (à l'ouverture, au retour au premier plan, « Importer maintenant »). Le guide `docs/guide-raccourcis-sante.md` (partie C) décrit les dix blocs du raccourci. Plus › Apple Santé › « Corps et nutrition depuis Raccourcis » dit, par fichier, les lignes lues, ajoutées, mises à jour et refusées (avec la raison), jamais une valeur.
- **Poids** : une pesée Santé par jour (la plus récente) ; ta saisie manuelle n'est jamais remplacée. **Composition et mensurations** : masse grasse, masse maigre, tour de taille et taille apparaissent dans Progrès › Corps (« Importé de Santé (Renpho) », lecture seule) ; tes mensurations saisies ne sont jamais touchées.
- **Nutrition « les deux selon les jours »** : si tu as saisi un repas dans le journal pour un jour, ton journal fait foi et rien n'est importé pour ce jour. Sinon, une seule ligne « Renpho — total du jour » porte les totaux, mise à jour à chaque import ; elle est remplacée dès que tu saisis un repas ce jour-là. Ce qui est supprimé par toi ne revient pas.
- **Valeurs hors limites** (poids, masse grasse, taille, tour de taille, énergie, macros) : rejetées et comptées. Rien n'est envoyé à un service tiers ; aucune valeur dans les journaux techniques.
- À constater sur iPhone : les types Santé et les unités exposés par Raccourcis (H-28 à H-31).

## 0.15.0

**Sans migration** (la base reste en schéma 13) : cette version peut s'installer sur PC et iPhone à tout moment.

- **Onboarding en 8 écrans (I3-07)**, sur PC et iPhone : Toi (sexe, année de naissance, taille, poids, niveau d'activité), Objectif (muscle, force, recomposition, perte de gras, maintien, et rythme en % du poids par semaine, de −1 % à +0,5 %), Expérience, Disponibilité (séances par semaine, durée, jours), Matériel, Priorités (silhouettes avant et arrière : 2 muscles à prioriser, 4 à éviter, mouvements douloureux), Split proposé selon ta fréquence, Résultat (première séance et cibles du jour). Chaque question est ignorable, le brouillon est enregistré à chaque changement.
- **Dépense de départ** : estimation Mifflin-St Jeor selon ton sexe, ton âge, ta taille, ton poids et ton niveau d'activité déclaré, présentée comme un point de départ recalculé après 2 semaines de données ; tu peux la modifier ou rétablir l'estimation.
- **Quand il s'ouvre** : au premier lancement sur une base vide seulement. Une installation qui contient déjà des données ne le voit jamais tout seul ; Plus › Profil et poids › « Revoir mes réglages » le rouvre, prérempli.
- **Ta routine n'est jamais remplacée** : le programme proposé s'ajoute comme une nouvelle routine, ou pas du tout si tu l'écartes.
- **Pas encore branchés** : les muscles prioritaires ou évités, les mouvements douloureux et la variété sont enregistrés mais ne pilotent pas encore la séance proposée (ticket Entraînement à venir).
- Retiré : l'ancien assistant de bienvenue hérité de CircleTasks (écrans, textes, réglage d'étape).

## 0.14.0

**Schéma 13 : mettre à jour le PC et l'iPhone le même jour, avant toute saisie.** La mise à jour ajoute deux colonnes (additif) aux séries d'une séance ; aucune donnée saisie n'est modifiée.

- **Circuits (I6-03)** : dans la séance active, « Grouper en circuit » relie deux exercices ou plus (superset, triset, circuit : un seul mécanisme) avec un nombre de tours, un repos entre exercices (nul = aucun minuteur) et un repos de fin de tour. Les séries s'enchaînent une à une (A1 B1 A2 B2…), l'exercice et le tour suivants sont dits en texte, « Défaire le groupe » garde les séries faites. La décote de position (D-87) ne s'applique pas entre exercices de muscles différents d'un même circuit. Les groupes ne sont pas encore proposés par les routines ni par la génération de séance.
- **Rejouer une séance** : depuis le Journal, « Rejouer cette séance » crée une nouvelle séance avec les mêmes exercices et les mêmes groupes ; les charges et les répétitions de la séance passée deviennent les cibles, rien n'est copié comme déjà fait.
- **Export complet** : Plus › Export et import › « Export complet (CSV et JSON) » : une archive zip avec un CSV par table (UTF-8 avec BOM, séparateur point-virgule, dates ISO, nombres à point décimal), le JSON complet et un fichier décrivant chaque colonne (docs/export-complet.md). Les photos de progression ne sont jamais exportées. L'archive complète est aussi une archive d'import valide.
- **Sauvegarde / synchro** : les groupes sont dans l'archive, la restauration et la synchro (publiés avec la séance close).

## 0.13.0

**Schéma 12 : mettre à jour le PC et l'iPhone le même jour, avant toute saisie.** La mise à jour ajoute trois tables (additif) ; aucune donnée saisie n'est modifiée.

- **Corps (I6-02)** : Progrès › Corps, sur PC et iPhone. **Mensurations** en centimètres (cou, épaules, poitrine, taille, hanches, bras, cuisses, mollets) : une mesure par jour et par zone, valeurs plausibles seulement, écart entre les deux dernières mesures, synchronisées entre les deux appareils.
- **Photos de progression** : copie réduite gardée sur l'appareil, jamais envoyée, ni synchronisée, ni exportée ; seule la date (la fiche) passe d'un appareil à l'autre, l'autre appareil dit « photo prise sur un autre appareil ». Deux photos côte à côte ; supprimer une photo efface le fichier et la fiche. La synchro iCloud des photos n'est pas faite (D-99).
- **Sauvegarde / export / synchro** : mensurations et fiches de photos sont dans l'archive (jamais les images), dans la restauration et dans la synchro.
- À constater sur iPhone : le sélecteur de photo (H-27).

## 0.12.0

**Schéma 11 : mettre à jour le PC et l'iPhone le même jour, avant toute saisie.** La mise à jour ajoute une table (additif) ; aucune donnée saisie n'est modifiée.

- **Journal de facteurs (I6-01)** : sur Aujourd'hui (PC et iPhone), cases à cocher le matin pour la journée de la veille (alcool, caféine après 16 h, repas tardif, stress, courbatures, maladie, voyage, entraînement tardif) ou « Rien de particulier » en un tap ; modifiable dans la journée, synchronisé entre les deux appareils, jamais envoyé à un tiers. Progrès › Récupération : après 30 jours renseignés et au moins 5 jours avec un facteur, l'écart moyen de Recovery du lendemain avec et sans ce facteur, dit comme une association observée, pas une cause.
- **Valeurs inhabituelles** : deux nuits de suite avec une HRV nettement sous ta base (au moins 2 σ) ou une fréquence cardiaque au repos nettement au-dessus : carte « repos conseillé » sur Aujourd'hui. Estimation, pas un avis médical ; aucune notification.
- **Sauvegarde / export / synchro** : le journal est dans l'archive, dans la restauration et dans la synchro (les deux appareils l'écrivent).

## 0.11.5

Correctifs (FIX-0115). **Pas de mise à jour de la base** (reste en version 10).

- **Onglets défilants** (Entraînement, Nutrition) : un fondu sur le bord signale les onglets cachés, à droite à l’ouverture puis à gauche une fois défilé ; l’onglet actif reste entièrement visible.
- **Plus › Apple Santé** : la ligne dit « via Raccourcis · dernier import HH:MM » au lieu de « non disponible ».
- **Sommeil** : événement de diagnostic dans le journal (compteurs de nuits retenues et écartées par raison ; aucun chiffre de santé).
- Test d’onglets de la CI rendu fiable (il mesurait un onglet pas encore affiché).

## 0.11.4

Correctif du sommeil et du dossier sante (constat du 11 nov.). **Pas de mise à jour de la base** (reste en version 10).

- **Sommeil** : les blocs « Au lit » de l’après-midi ne comptent plus ni comme du sommeil ni comme des nuits ; la dette et le besoin ne sont plus gonflés. Les résumés des 30 derniers jours sont recalculés une fois, à l’import suivant.
- **Dossier sante** : un dossier dont le nom a une espace ou un caractère invisible est lu ; si le nom est refusé, l’écran dit « illisible (nom du dossier) » et le journal en donne la raison en code.
- **Guide** : taper « sante » à la main, sans les suggestions du clavier.

## 0.11.3

Correctif de la lecture automatique du dossier sante (constat du 11 nov. sur l'iPhone). **Pas de mise à jour de la base** (reste en version 10) ; aucune donnée saisie n'est modifiée.

- **Dossier sante reconnu** : un dossier iCloud encore « dans le nuage » (présenté comme un fichier) est maintenant téléchargé puis lu ; les noms à espace ou caractère invisible sont acceptés. Un dossier pas encore téléchargé est dit « à télécharger », jamais « absent ». Cause exacte non prouvée sans l'appareil (docs/I5-05.md).
- **Diagnostic** : Plus › Logs décrit chaque entrée du dossier lié par des codes (dossier, nuage, égal à devices, égal à sante), sans aucun nom ; la taille d'un fichier lu par « Choisir les fichiers » est la vraie.
- **Journal exporté complet** : sur l'iPhone, l'export de Logs contient les événements de l'app et ceux de la synchro (ils étaient écrits dans deux dossiers différents).
- **Sommeil** : une nuit est le plus long épisode (segments séparés de moins de 60 min) qui se termine le jour du réveil ; les siestes ne comptent plus comme des nuits (dette, baseline, régularité, heure de lever).
- **Phrase d'état** : après un import réussi, « Non trouvé à la lecture du dossier de HH:MM » remplace « Fichier absent » au-dessus des comptes.

## 0.11.2

Correctif de l'import Raccourcis (constat du 10 nov. sur l'iPhone). **Pas de mise à jour de la base** (reste en version 10) ; aucune donnée saisie n'est modifiée.

- **Plus jamais de silence** : chaque appui sur « Importer maintenant » ou « Choisir les fichiers » affiche une phrase près du bouton (fichiers lus et lignes ajoutées, aucun fichier trouvé dans iCloud Drive › Spartiate › sante, dossier non lié, lecture déjà faite…) et laisse une trace dans Plus › Logs. « Importer maintenant » n'est jamais freiné par l'intervalle de 30 minutes.
- **Diagnostic du dossier sante** : Plus › Logs note, sans aucune valeur, si le dossier lié est atteint, si `sante` et `devices` y sont, et pour chaque fichier son état (absent, présent, à télécharger, illisible) et sa taille. La lecture retrouve aussi `sante` et les quatre fichiers sous une autre casse ou un accent (« Santé », « HRV.csv »).
- **Valeurs à nombreuses décimales** : le raccourci écrit des valeurs comme 33,7171717171717 ; elles sont lues (jusqu'à 15 décimales, point ou virgule). HRV et FC au repos sont arrondies au dixième, les pesées au centième.

## 0.11.1

Import automatique des fichiers Raccourcis et réglages de la récupération. **Pas de mise à jour de la base** (reste en version 10) ; aucune donnée saisie n'est modifiée.

- **Import automatique** : le raccourci « Spartiate — récupération » écrit désormais dans `iCloud Drive › Spartiate › sante` (**nouveau chemin : change le sous-chemin de l'action « Enregistrer le fichier »**, guide mis à jour). Spartiate lit ces quatre fichiers tout seul à l'ouverture et au retour au premier plan (au plus une fois toutes les 30 minutes) ; « Importer maintenant » relit le dossier ; « Choisir les fichiers » reste en secours. Lecture seule : la synchro ne regarde jamais ce dossier. À constater sur ton iPhone (H-26).
- **Exertion** : une séance lourde compte enfin. Échelle de la musculation de 20 : 6 t → 3,3 ; 12 t → 5,5 ; 20 t → 7,4 (choix prudent, révisable). La zone cible et le supplément de sommeil jouent à partir d'environ 12 t.
- **Journée rouge** : accepter le bandeau maintient les charges (aucune hausse, jamais de baisse automatique) ; ignorer garde la proposition normale.

## 0.11.0

Les écrans de la récupération. **Pas de mise à jour de la base** (reste en version 10) ; aucune donnée saisie n'est modifiée.

- **Aujourd'hui** : cadrans Recovery, Exertion et Sommeil (valeur, ou « en apprentissage J+x/14 », qualité, contributeurs, « estimation, pas un avis médical »), tuile Pas (iPhone). La carte « Arrive ensuite » disparaît. Même affichage sur le PC, à partir des résumés reçus.
- **Séance** : si ta Recovery est ≤ 33 au lancement, bandeau « Journée rouge : maintien des charges proposé » (Accepter ou Ignorer ; jamais imposé, la phrase de la proposition le dit). Récupération par muscle visible sur la séance proposée et la séance active.
- **Sommeil** : heure de coucher proposée (besoin de sommeil moins ton heure de lever habituelle). Notifications du coucher (30 min avant) et du matin (une par jour, texte sans chiffre), **désactivées par défaut**, iPhone seulement : Plus → Apple Santé.

## 0.10.0

**Schéma 10 : mettre à jour le PC et l'iPhone le même jour, avant toute saisie.** La mise à jour ajoute des tables (additif) ; aucune donnée saisie n'est modifiée.

- **Récupération (I5-01)** : l'iPhone importe les fichiers de l'app Raccourcis (variabilité cardiaque, fréquence cardiaque au repos, sommeil, pas), calcule la récupération (estimation, pas un avis médical) et publie des résumés quotidiens vers le PC. Plus → Apple Santé → Raccourcis : « Importer maintenant » (choix des fichiers), dernière date par type, lignes lues et refusées par raison, sans aucune valeur. Guide : un seul raccourci « Spartiate — récupération ». Les cadrans arrivent en 0.11.0.
- **Sauvegarde / export** : les résumés de récupération sont dans l'archive (les échantillons importés non) ; sur le PC, l'import ne les écrit pas.
- **Restauration** : référentiel des déclencheurs prouvé identique à une base migrée à chaque version.

## 0.9.4

**Pas de mise à jour de la base** (reste en version 9) ; aucune donnée saisie n'est modifiée.

- **Charges** : pour les exercices lestés (traction, dips, pompe lestés) la décote de position (2ᵉ exercice −7 %, 3ᵉ −12 %) se calcule sur la charge totale, poids de corps compris, comme le 1RM ; le lest affiché en est déduit. En traction assistée, l'assistance augmente. Sans pesée connue : comme avant.
- **Restauration** : un fichier de base dont le journal `-wal` voisin annonce une autre taille de page est refusé, avec un message en français. Réduit un risque connu du moteur de base embarqué (D-84, DEP-01) ; le moteur lui-même ne change pas.

## 0.9.3

Correctifs de la relecture du 9 novembre, et prise en compte du poids de ton corps. **Pas de mise à jour de la base** (reste en version 9) ; aucune donnée saisie n'est modifiée ni perdue.

- **Sauvegarde (Export)** : l'archive contient maintenant ta séance en cours et ses séries. À l'import, elle reste en cours et n'est publiée qu'à sa clôture ; si une autre séance est déjà en cours ici, la tienne est gardée et l'importée est close à sa dernière série validée.
- **« Remplacer »** avec une archive récente dont les tables sont vides vide bien ces tables ; une archive plus ancienne ne supprime toujours rien.
- **Cible nutritionnelle** : l'ordre de tes décisions est conservé dans l'archive ; la cible en vigueur est la même après export puis import, en remplacement comme en fusion.
- **Nutrition** : si une relecture échoue, les dernières valeurs restent affichées avec « peut-être périmées », un message et « Réessayer ».
- **Charges** : le 2ᵉ exercice d'un même muscle dans la séance est proposé 7 % plus bas (3ᵉ : 12 %), la phrase le dit ; une décote déjà comprise dans ta dernière séance n'est pas comptée deux fois.
- **Poids du corps** : pour les tractions et pompes lestées, le 1RM estimé et les écarts de charge comptent ton poids de corps (dernière tendance de poids) ; la charge saisie reste le lest. Sans pesée, comportement d'avant, avec une phrase qui le dit.
- **Recettes** : un ingrédient copié d'un aliment au nom très long est rogné à 120 caractères au lieu de bloquer l'enregistrement.
- **Pesées Raccourcis** : une pesée est rangée au jour local de l'appareil, pour le dédoublonnage comme pour l'enregistrement (deux pesées de jours différents ne sont plus fusionnées).

## 0.9.2

Onglets de l’Entraînement et de la Nutrition, et bibliothèque plus complète. **Pas de mise à jour de la base** (reste en version 9).

- **Onglets écrasés sur le PC** : sur Entraînement, les onglets Routines, Bibliothèque, Matériel, Journal et Cycle se réduisaient à une bande de quelques pixels quand l’écran était long (Bibliothèque). Ils gardent maintenant leur hauteur (44 px au moins), sur le PC comme sur l’iPhone.
- **Bibliothèque** : 46 exercices de plus (196 au total), dont l’extension triceps prise supination à la poulie ; la recherche sans accent et le filtre « Compatibles avec mon matériel » les prennent en compte. « Rowing T-bar » et « Barre au front à la barre EZ » retrouvent les exercices existants par leur nom anglais.

## 0.9.1

Correctifs du moteur, avant ta première séance réelle. **Pas de mise à jour de la base** (reste en version 9).

- **Fatigue** : après avoir choisi « −2 reps », la séance suivante n’est plus comparée à celle d’avant la décote ; la progression reprend normalement.
- **Reprise après inactivité** : la phrase annonce l’écart réel (« −2 kg (−10 %) »), jamais un « −1 % » pour un passage de 20 à 18 kg ; une décote de moins d’un demi-cran de matériel donne « Charge maintenue ».
- **Recalibrage « Facile »** : plus de « +0 kg » ni de 1RM relevé quand la charge ne bouge pas.
- **Cycle** : le RIR de la semaine, affiché sur la séance proposée, est enregistré avec elle ; le deload du cycle ne s’active que sur une séance issue de la routine du cycle (ni séance libre, ni autre routine).
- Une décision de progression illisible est ignorée (et journalisée) au lieu de faire échouer l’écran de séance.
- **Dépense mesurée** : sans pesée récente (moins de 7 jours) aux deux bouts de la fenêtre, elle n’est plus calculée : retour à la formule déclarée et « Pèse-toi pour que la dépense mesurée reprenne ». Une cible acceptée au check-in s’applique même après une cible fixée à la main plus tôt dans la semaine (départage par horloge de synchro). Réglages par défaut proposés (D-82), révisables.

## 0.9.0

**Schéma 9 : mets à jour le PC et l’iPhone le même jour, avant toute saisie.** Un appareil resté en 0.8.x garde de côté les recettes et les déclarations reçues (rien n’est perdu, tout revient après sa mise à jour), lit la prise d’une recette mais ne peut ni la modifier ni la copier, seulement la supprimer. PC : bannière de mise à jour dans l’app ; iPhone : SideStore.

- **Journée complète déclarée** (Nutrition → Journal) : pour le jour affiché, « Non déclarée » (l’app déduit : au moins 3 prises sur 8 h), « Complète » ou « Incomplète ». Ta déclaration prime sur la déduction ; le Dashboard, la couverture, la dépense mesurée et le check-in l’utilisent. Un jour sans prise reste « inconnu », jamais zéro, même déclaré complet. Elle passe d’un appareil à l’autre ; en cas de désaccord, la dernière écriture gagne.
- **Recettes** (Nutrition → Recettes) : un nom, des ingrédients (tes fiches, Ciqual ou Open Food Facts, en grammes), un poids cuit facultatif et un nombre de portions. Un nutriment inconnu dans un ingrédient rend le total de ce nutriment inconnu (« — »), jamais une somme partielle. Ajout au journal par portions ou par grammes ; la prise garde un instantané : modifier la recette ensuite ne change pas le passé. Suppression avec confirmation. Les recettes apparaissent dans la recherche, avec le badge « Recette ». Elles passent d’un appareil à l’autre.
- Archive d’export : les nouvelles tables y entrent ; une archive plus ancienne s’importe sans rien supprimer de ce côté. Réglages par défaut proposés cette nuit (D-80, D-81), révisables.

## 0.8.1

- **Favoris** (Nutrition → Rechercher un aliment) : une étoile sur la fiche d’un aliment (Ciqual, Open Food Facts ou perso) l’ajoute aux favoris, qui s’affichent en tête de la recherche, avant les récents. **Les favoris restent sur l’appareil où tu les as posés** (ni synchro, ni export) : réglage par défaut proposé cette nuit (D-79), révisable. Un favori dont l’aliment n’existe plus disparaît sans message.
- **Restauration d’une sauvegarde** : correctif de fond. Les déclencheurs qui alimentent la synchro (repas, séances, cycle…) sont recréés après une restauration ; sans eux, ce que tu saisissais ensuite ne partait pas vers l’autre appareil.
- Ménage : règle du premier check-in déplacée dans le domaine, mesure de démarrage conservée par la CI. Pas de mise à jour de la base (reste en version 8).

## 0.8.0

- **Open Food Facts et scan de code-barres** (Nutrition → Journal → Rechercher un aliment). **Scanner** (iPhone) lit EAN-13, EAN-8 et UPC ; un champ **Code-barres** permet de saisir le code à la main (PC et iPhone). **Chercher en ligne** interroge Open Food Facts, seulement quand tu appuies dessus (jamais à la frappe).
- Ce qui part sur le réseau : seulement le code-barres ou le texte cherché, en HTTPS, sans aucun identifiant ni donnée personnelle. Recherche en ligne limitée à 10 par minute. Une fiche choisie est gardée 90 jours dans l’appareil : le même scan se relit sans réseau.
- Cas dégradés en français : hors ligne ou délai dépassé (la recherche Ciqual reste là), produit inconnu (fiche perso pré-remplie avec le code), fiche incomplète (valeurs manquantes inconnues, jamais 0), refus de la caméra (chemin Réglages). Chaque fiche issue d’Open Food Facts porte la mention « Open Food Facts » (licence ODbL, voir docs/licences.md).
- Pas encore : recettes, favoris, photo de repas (IA). Réglages par défaut proposés cette nuit (D-77, D-78), révisables. **Pas de mise à jour de la base** (reste en version 8).

## 0.7.1

Correctifs de mise en page et de cohérence, vus sur l’iPhone en 0.7.0. Pas de mise à jour de la base.

- **Nutrition, fiche d’ajout d’un aliment** : plus aucun débordement à droite (Quantité et Heure se partagent la largeur de la carte), marge intérieure comme les autres cartes ; le bas de la fiche (« Choisir un autre aliment », « Annuler ») reste atteignable au-dessus de la barre d’onglets et du clavier.
- **Cartes sans marge** : « Séance » et « Nutrition » d’Aujourd’hui et « Séance » d’Entraînement ont la marge intérieure de la carte « Poids » (une seule cause corrigée).
- **Onglets** d’Entraînement (Routines, Bibliothèque, Matériel, Journal, Cycle) et de Nutrition : une seule ligne, qui défile si besoin ; l’onglet actif reste visible.
- **Bibliothèque** : filtres compacts les uns sous les autres, la liste se voit sans défiler.
- **Poids de tendance** : une seule règle pour Aujourd’hui et le Dashboard. Tant que la tendance apprend (moins de 14 pesées), le Dashboard montre la dernière pesée et « en apprentissage », pas un chiffre de tendance.
- **Graphique de tendance** : avec peu de données, l’axe couvre au moins 7 jours finissant aujourd’hui ; l’échelle englobe toutes les pesées avec une marge.
- **Check-in** : avant la première donnée saisie, l’écran dit « Premier check-in : lundi 9 novembre » avec ce qu’il faut d’ici là, au lieu d’un check-in suspendu sur une semaine vide. La règle de décision ne change pas.
- **Dates** : « 1er novembre » au lieu de « 1 novembre », partout.
- **Aujourd’hui, « Arrive ensuite »** : ne garde que la Récupération (Séance et Nutrition sont livrées).

## 0.7.0

- **Nutrition** (nouvel onglet) : Journal du jour (couverture et incertitude sans faux zéro, provenance de chaque aliment, ajout, correction, suppression avec confirmation), recherche locale (récents, tes fiches, table Ciqual ; grammes ou portions), Ajout rapide de macros, tableau de bord (tendance du poids, balance sur 7 jours, dépense, confiance), Stratégie et cibles, et check-in hebdomadaire (accepter, personnaliser ou refuser, relançable ; jamais sous 1 200 kcal sans ta confirmation, jamais sous 800). Sur Aujourd’hui, une carte montre les cibles restantes.
- Pas encore : scan de code-barres, Open Food Facts, recettes, favoris, photo de repas (IA) — rien n’est envoyé nulle part. Réglages par défaut proposés cette nuit (D-74, D-76), révisables : activité déclarée puis dépense mesurée après 28 jours, jours hauts / bas désactivés.
- Pas de mise à jour de la base (reste en version 8).

## 0.6.0

- Nutrition, en coulisse (I4) : l’app sait maintenant calculer tendance de poids, dépense et cibles (activité déclarée sédentaire / légère / modérée / active, dépense mesurée après 28 jours de données), et garde en mémoire le catalogue d’aliments (table Ciqual de l’Anses, 3 484 aliments, chargée à la demande), le journal des repas et les cibles. **Rien n’est encore affiché** : l’écran Nutrition arrive ensuite. Réglages par défaut proposés cette nuit (D-74), révisables : jours hauts / bas désactivés.
- Mise à jour de la base (version 8) : quatre tables ajoutées, qui passent d’un appareil à l’autre. **Mets à jour le PC et l’iPhone le même jour** : un appareil resté en 0.5.0 garde de côté ce qui vient de la 0.6.0 (rien n’est perdu), mais refuse une sauvegarde ou un export fait en 0.6.0. PC : bannière de mise à jour dans l’app ; iPhone : SideStore.

## 0.5.0

- **Cycle** (Entraînement → section Cycle) : un mésocycle de 5 semaines par défaut (4 à 7 au choix), dernière semaine en deload ; l’option « illimité » enchaîne des blocs de 5 semaines avec un deload à la fin de chaque bloc. Séries −1 / 0 / 0 / +1 et RIR 3 / 2 / 1 / 1 sur les semaines de travail : jamais de RIR 0. « Proposer une séance » suit la semaine du cycle ; en semaine de deload, l’option « Deload » est cochée d’office dans la proposition (tu peux la décocher).
- Deload anticipé : l’app peut te le proposer, jamais l’imposer. **Pause** : le cycle se fige et se décale d’autant, sans jours manqués ni notifications ; après plus de 21 jours d’arrêt, une semaine allégée est proposée à la reprise. Bilan de fin de cycle : répéter, régénérer, changer ou terminer.
- Ce sont des réglages par défaut (D-73), révisables : dis-moi ce que tu veux changer.
- **Mise à jour de la base (version 7)** : une table de cycle est ajoutée et passe d’un appareil à l’autre. **Mets à jour le PC et l’iPhone le même jour** : un appareil resté en 0.4.0 garde de côté le cycle reçu (rien n’est perdu, tout revient après sa mise à jour), mais refuse une sauvegarde ou un export fait en 0.5.0. PC : bannière de mise à jour dans l’app ; iPhone : SideStore.

## 0.4.0

- **Séance proposée** (Entraînement → Nouvelle séance → Séance proposée) : l’app compose une séance à partir de ta routine, avec trois modes. **Guidé** : l’app propose tout ; **Libre** : tu choisis les exercices, elle propose les charges (rien n’est remplacé sans toi, un remplaçant est seulement suggéré) ; **Maison** : comme Guidé, limité au matériel maison. Tu peux régler le temps disponible (« J’ai 35 min »), les priorités et les douleurs ; le matériel et les douleurs sont toujours respectés, un mouvement sans remplaçant compatible est simplement omis.
- Rien n’est écrit avant « Commencer cette séance », et ta routine n’est jamais modifiée. Le style (droites, pyramide, inversée) est une consigne d’ordre, non enregistrée. Ce sont des réglages par défaut proposés cette nuit (D-73) : ils sont révisables, dis-moi ce que tu veux changer. Pas de mise à jour de la base.

## 0.3.4

- Séance : **échauffement**. Sous la proposition d’un exercice, quand tu l’acceptes ou la modifies, l’app ajoute une rampe de séries d’échauffement légères (40 % × 8, 60 % × 5, 80 % × 2 de la charge de travail), calées sur les charges que ton matériel permet vraiment (paire d’haltères de 9 kg comprise). Une rampe par groupe de mouvement, sur le premier exercice composé ; rien n’est ajouté après un refus, pour un exercice « à saisir », ou si tu as déjà commencé l’exercice. Une rampe ne passe jamais avant une série que tu as déjà validée. Pas de mise à jour de la base.

## 0.3.3

- Séance : la phrase de la Proposition te prévient quand les charges reposent sur du matériel marqué « à vérifier » dans ton profil (barre EZ, machine…), et quand ta dernière séance, avec moins de la moitié des séries faites, n’est pas prise en compte. La proposition elle-même ne change pas.
- Profil de matériel Fitness Park Antony copié avant la 0.3.0 : la paire d’haltères de 9 kg est de nouveau proposée, sans rien modifier dans ton profil. Pas de mise à jour de la base.

## 0.3.2

- Correctifs du moteur après relecture à froid : une charge très au-dessus de ton historique (faute de frappe possible) n’est jamais augmentée tant qu’une seconde séance ne la confirme pas, et la phrase te demande de vérifier ta saisie ; la charge de référence est celle de la majorité de tes séries, plus un seul top set ; au haut de la fourchette, un « Facile » ne remplace plus le cran de matériel.
- **Apple Santé, pesées via Raccourcis** (Plus → Apple Santé → Importer) : tu importes le fichier écrit par le raccourci « Spartiate — poids » (guide : docs/guide-raccourcis-sante.md). Une pesée par jour, la plus récente ; une pesée que tu as supprimée ne revient pas à l’import suivant ; ta saisie manuelle du jour est conservée. Le format réel du fichier reste à confirmer sur ton iPhone (hypothèse H-21).
- PC : les erreurs de fichier iCloud verrouillé qui restaient muettes dans le journal portent maintenant leur cause (fichier utilisé, accès refusé, suppression en attente, autre), sans chemin ni contenu.
- Séance : la **Proposition** tient compte de ta forme du moment, toujours pour maintenir ou alléger, jamais pour ajouter. Une phrase dit pourquoi, et les autres signaux s’affichent en texte juste en dessous.
- **Fatigue** : si tu as fait plus de 20 % de répétitions en moins qu’à la dernière séance à la même charge (20 % pile ne compte pas), la proposition garde ta charge et tes répétitions, sans hausse. Deux **choix facultatifs** s’affichent : « −5 % de charge » ou « 2 répétitions de moins par série ». Aucun n’est appliqué tout seul : « Choisir » remplit les séries à faire, « Accepter » garde la proposition, « Refuser » ne remplit rien.
- **3 séances sans progrès** : trois pistes facultatives : essayer une variante de l’exercice, changer de plage de répétitions dans la routine, ou un mini-deload à −10 % (le seul des trois qu’on peut choisir d’un geste).
- **Pause** : à partir de 3 semaines sans travailler l’exercice, la charge baisse de 1 % par semaine au-delà de 2 semaines, jusqu’à −10 % au plus. Une séance manquée n’est pas comptée comme un recul. Pour l’instant la pause se mesure sur l’exercice lui-même, pas encore sur le muscle travaillé par d’autres exercices.
- **Deload pour cette séance** (bouton facultatif sous la proposition) : moitié des séries arrondie en dessous (au moins une), charge × 0,8, au moins 4 répétitions en réserve. Une fois retenue, la séance reste dans ton historique, mais ne compte pas pour les propositions suivantes.
- Récupération (Recovery, sommeil, FC de repos) : le moteur sait la prendre en compte (−5 % de charge et une série de moins sur un exercice d’isolation si elle est basse), mais rien ne l’alimente encore. Elle arrivera avec Apple Santé (I5) ; d’ici là, aucune valeur n’est inventée.
- Ta saisie l’emporte toujours, et chaque choix est enregistré avec la séance (accepté, modifié, choix facultatif ou refus). Pas de mise à jour de la base ; mets quand même à jour le PC et l’iPhone le même jour : un appareil resté en 0.3.1 compterait une séance de deload comme une séance normale. PC : bannière de mise à jour dans l’app ; iPhone : SideStore.

## 0.3.1

- Séance : chaque exercice affiche maintenant une **Proposition** — charge et répétitions pour chaque série (ex. « 62,5 kg × 8 · 8 · 8 »), une phrase qui dit pourquoi (ex. « +2,5 kg : 3 × 10 atteint la dernière fois. ») et la confiance (« Confiance 50 % (moyenne) »). Un exercice jamais fait affiche « À saisir » : aucune charge n’est inventée. Les exercices au poids du corps ou chronométrés n’ont pas de proposition.
- Rien n’est rempli sans toi : **Accepter** remplit les séries à faire encore vides (tu peux encore les changer avant de valider), **Modifier** te laisse saisir ta charge et tes répétitions (Entrée pour enregistrer, Échap pour annuler), **Refuser** ne remplit rien. Ton choix est enregistré (accepté, modifié ou refusé) et part sur l’autre appareil avec la séance terminée ; une séance abandonnée n’en garde rien, et la séance suivante repart de ce que tu as réellement fait.
- Sous la proposition, **Ressenti de l’exercice** : Facile, Juste ou Dur (facultatif ; un second appui efface). « Dur » empêche la hausse de charge à la séance suivante ; « Facile » avec une confiance sous 60 % recale l’estimation de +5 % quand tu termines la séance (au plus une fois par mois et par exercice ; une séance abandonnée ne compte pas).
- Synchro : tes ressentis, tes choix et le suivi par exercice passent maintenant d’un appareil à l’autre, avec les séances terminées. Export et import les incluent ; un export fait en 0.3.0 reste importable.
- Mise à jour de la base (version 6). **Mets à jour le PC et l’iPhone le même jour** : un appareil resté en 0.3.0 garde de côté ce qui vient de la 0.3.1 (rien n’est perdu, tout revient après sa mise à jour), mais refuse une sauvegarde ou un export fait en 0.3.1. PC : bannière de mise à jour dans l’app ; iPhone : SideStore.

## 0.3.0

- Moteur de charges (I2), en coulisse : l’app sait maintenant calculer la prochaine charge et les prochaines répétitions de chaque exercice à partir de tes séances terminées, mais ne l’affiche pas encore (ce sera la 0.3.1). Rien ne change à l’écran.
- Règles validées le 7 nov. : jamais de charge inventée (un exercice jamais fait reste « à saisir ») ; une répétition de plus sur une seule série tant que le haut de la plage n’est pas atteint partout (8-7-6 → 8-8-6 → 8-8-7 → 8-8-8), puis un cran de matériel ; hausse plafonnée à +10 % ; arrondi à la charge disponible juste en dessous, avec une répétition de plus si l’écart dépasse 3 % ; « Dur » bloque la hausse ; ta valeur l’emporte toujours. Les arrondis suivent ton profil de matériel (par défaut Fitness Park Antony).
- Mise à jour de la base (version 5) : deux tables vides ajoutées pour le suivi par exercice et tes choix (accepté ou modifié). Elles restent sur l’appareil pour l’instant ; leur synchro arrive avec l’affichage.
- Mise à jour : mets à jour le PC et l’iPhone le même jour. Une app restée en 0.2.x affiche « version plus récente » et refuse une sauvegarde ou un export fait en 0.3.0, même si rien n’y est illisible pour elle.

## 0.2.4

- Journal technique plus parlant : la synchro note ce qui se passe (lignes reçues et appareil d’origine, enregistrements publiés, fichiers que l’iCloud n’a pas encore téléchargés), seulement quand il se passe quelque chose. Les échecs disent l’étape où ils sont survenus ; sur PC, une erreur de fichier dit si le fichier est verrouillé, refusé ou en cours de suppression. Les erreurs imprévues de l’app sont notées aussi. Aucun titre, aucune note, aucune valeur : des codes, des compteurs et des noms de tables.
- Plus → Logs → Exporter : le fichier commence par un bilan (version, appareils connus et leur dernière synchro, entrées en attente d’envoi, lignes mises de côté, conflits, nombre de lignes par table). Le fichier garde jusqu’à 2 000 entrées au lieu de 500.
- Synchro plus réactive : quand un fichier d’iCloud n’est pas encore là, un nouveau passage a lieu 10 secondes plus tard (trois fois au plus), au lieu d’attendre. Le Journal d’entraînement du PC se relit dès qu’une séance arrive, même s’il est déjà ouvert.
- Séance : si tu fermes l’app pendant le résumé de fin, « Mettre à jour la routine ? » t’est reproposée à la réouverture.

## 0.2.3

- Export / import : l’archive contient maintenant tes routines, tes exercices personnalisés, tes profils de matériel et tes séances terminées avec leurs séries, en plus du profil et des pesées. Une séance en cours n’est jamais exportée. « Remplacer » ne supprime tes séances que si l’archive contient des données d’entraînement (une archive d’avant la 0.2.3 n’en supprime aucune).
- Routines : « Enregistrer la routine » revient à la liste avec une confirmation courte.
- Séance : types de série renommés (« Normale » par défaut, Échauffement, Dégressive, Partielle), avec une aide d’une ligne ; un repos nul n’affiche plus « repos 0 s ».
- Notifications : la fin du repos et le minuteur de test ont chacun leur notification (lancer l’un n’annule plus l’autre).
- PC : la ligne « Tester le minuteur » ne parle plus de Live Activity ni de Dynamic Island.

## 0.2.2

- Séance : « Terminer la séance » clôt la séance en une seule opération (rien n’est écrit à moitié), arrête le repos et la Live Activity, puis affiche le résumé de fin : durée, séries validées, volume (séries dégressives, partielles et chronométrées exclues du tonnage) et records. « Mettre à jour la routine ? » propose « Oui » ou « Cette fois seulement » quand la séance diffère de la routine ; la routine n’est modifiée qu’après « Oui ».
- Journal : nouvelle section « Journal » dans l’onglet Entraînement (et depuis la carte Séance d’Aujourd’hui) : liste des séances terminées, détail par exercice (un exercice supprimé garde son nom), correction d’une série (charge, répétitions, durée, RIR, type, repérée « corrigée »), suppression d’une séance avec confirmation. La copie d’une séance passée lit ce journal.
- Synchronisation : une séance terminée part sur l’autre appareil avec toutes ses séries, d’un seul bloc ; une séance en cours n’est jamais envoyée, ni dans les journaux, ni dans les instantanés. Corrections et suppressions se synchronisent. Migration 0004 ; une séance est limitée à 200 séries ; les séances abandonnées depuis plus de 30 jours sont effacées de l’appareil sans rien envoyer.
- Mise à jour : mets à jour le PC et l’iPhone le même jour, et ne fais ni réinitialisation ni « Appliquer partout » depuis un appareil resté en 0.2.1 ou avant.

## 0.2.1

- Séance active : démarre une séance vide, depuis un jour de routine ou en copiant une séance passée (carte « Séance » dans Aujourd’hui et dans l’onglet Entraînement). Chaque série validée est enregistrée tout de suite ; la séance se reprend à l’identique après verrouillage, fermeture forcée ou redémarrage. Ajout, retrait et annulation de séries, échauffement (jamais compté comme série de travail), exercices chronométrés, abandon avec confirmation. La clôture et le journal arrivent avec la 0.2.2.
- Minuteur de repos : il démarre seul à la validation d’une série de travail, durée réglable (« Repos par défaut »), boutons « +30 s » et « Passer ». Le temps restant est toujours recalculé depuis la date de fin enregistrée. Sur iPhone : Live Activity « Repos » (sinon minuteur dans l’app avec une phrase qui explique pourquoi) et notification « Repos terminé » sans doublon ; sur PC : minuteur dans l’app seulement.
- Live Activity : texte clair sur le fond de la charte (plus de texte noir illisible sur l’écran verrouillé), heure de fin toujours lisible, état final « Terminé » et fin programmée de l’activité ; à constater sur l’iPhone.
- Données : migration 0003 (séances et séries, locales tant qu’elles ne sont pas closes : rien n’est publié par la synchro).

## 0.2.0

- Entraînement : l’onglet Entraînement s’ouvre sur trois sections, Routines, Bibliothèque et Matériel (chargées à la demande, le démarrage de l’app ne grossit pas).
- Bibliothèque : 150 exercices (recherche en français ou par alias anglais, filtre par groupe musculaire, bascule « compatibles avec mon matériel », fiche avec muscles, matériel, consignes, repos et alternatives, sans image) et exercices personnalisés (création, modification, suppression ; un exercice supprimé reste affiché par son nom dans les routines et l’historique).
- Matériel : profil « Fitness Park Antony » utilisé par défaut, trois autres profils de départ, duplication d’un profil pour le modifier ; le profil actif reste propre à l’appareil.
- Routines : les 4 programmes de départ (Haut / Bas 4 j, Full Body 3 j, PPL 6 j, Maison haltères 3 j) s’ajoutent en une fois et se modifient (jours, exercices, séries, plages de répétitions, repos, RIR, ordre) ; un exercice incompatible avec le matériel actif est signalé sans bloquer.
- Données : migration 0002 (exercices personnalisés, profils de matériel, routines) ; ces tables se synchronisent entre le PC et l’iPhone, les exercices embarqués restent hors de la base. Les sauvegardes du PC acceptent le schéma 2. Le contenu des exercices et des programmes est à relire par Ali (docs/i1-01-contenu-a-relire.md).
- Mise à jour : mets à jour le PC et l’iPhone le même jour, sans restauration ni nouvel appairage entre les deux.

## 0.1.6

- Apple Santé : quand l’entitlement manque (compte Apple gratuit), la phrase « Spartiate lit ton poids et tes pas… » ne s’affiche plus, l’état est gardé à la réouverture de l’écran, et la ligne d’Apple Santé dans Plus dit « non disponible » au lieu de « lecture seule ».
- Textes : « Repartir de zéro » dit « Tes données ne sont pas supprimées ». Les restes de l’ancien projet (tâches, rappels, routines…) sont retirés des textes affichés, et un test les interdit dans les catalogues des écrans livrés.
- Live Activity : à l’échéance, l’activité n’est plus figée à 0:00 si l’app est fermée : le widget affiche lui-même « Terminé » (date de fin = péremption) et l’activité est fermée dès l’ouverture de l’app, sans activité orpheline.
- Minuteur de test : la notification de fin sonne à la seconde de l’échéance (arrondie à la seconde supérieure, jamais jusqu’à 59 s plus tôt), avec le même identifiant à la reprise.
- Documentation : preuves d’Ali du 2026-11-06 reportées dans la matrice des capacités, dossier go / no-go d’I0 (docs/gate-i0.md), mémoire de reprise réécrite.

## 0.1.5

- Live Activity (SPA-007, H-4) : un compteur de test de 60 s dans Plus › À propos (« Tester le minuteur (60 s) »). Sur iPhone il s’affiche sur l’écran verrouillé et dans la Dynamic Island (extension WidgetKit SpartiateLiveActivity, décompte avancé par le système, aucun push, aucun App Group, aucun mode d’arrière-plan, aucun nouvel entitlement). Si la Live Activity est indisponible, le minuteur reste dans l’app avec une notification à l’échéance et une phrase qui explique pourquoi.
- Le temps restant est toujours recalculé depuis la date de fin enregistrée (jamais depuis un compteur), la notification n’est jamais en double après une reprise, « Arrêter » ferme l’activité sans la laisser orpheline. Notifications refusées : l’app le dit et ne promet rien. Sur PC : minuteur dans l’app seulement.
- Build iPhone : l’extension est ajoutée au projet généré (script idempotent), signée avant l’app, et l’IPA finale est contrôlée (extension présente, deux signatures strictes, plist de l’extension). H-4 reste à prouver sur l’iPhone.
- Projet : la chaîne de livraison (fusion, tags, publication) est confiée à Claude Code (D-70).

## 0.1.4

- iPhone : toucher un champ (Poids, Taille…) ne zoome plus la page. Le texte des champs de saisie fait au moins 16 px sur iOS ; le zoom de l’utilisateur reste libre.
- Synchronisation : Profil et poids et Aujourd’hui se rechargent tout seuls quand la synchro applique des données reçues de l’autre appareil, sans changer d’onglet ; un champ que tu es en train de modifier n’est pas écrasé.
- Journal des conflits : « Profil : expérience », « Pesée du 5 nov. », valeurs traduites (« Intermédiaire », « Perte de poids », « Homme »…), nombres au format français avec leur unité (« 106,25 kg », « 186 cm »). Plus aucune clé technique ni mot anglais.
- Synchronisation : « PC : Jamais lu » à tort sur l’iPhone corrigé. Après une reprise depuis un instantané ou un changement d’époque, la dernière modification lue ne dépendait que du dernier enregistrement de journal lu, donc restait vide tant que l’autre appareil n’avait rien écrit de nouveau ; un curseur arrivé à la tête annoncée de l’autre appareil vaut désormais lecture jusqu’à cette tête.
- Synchronisation : les copies de conflit créées par iCloud (« state 2.spx ») sont ignorées à la lecture, jamais supprimées, et signalées une seule fois dans le journal technique. Une seule synchro tourne à la fois sur chaque appareil (minuteur, retour au premier plan, bouton, écriture différée), vérifié par un test.
- Apple Santé : quand Santé répond « Missing com.apple.developer.healthkit entitlement » (app installée par SideStore avec un compte Apple gratuit), l’écran dit que Santé n’est pas accessible dans ce cas et que l’import passera par l’app Raccourcis dans une prochaine version ; « Autoriser l’accès » est masqué, « Détail technique » est conservé. Accès direct HealthKit BLOCKED dans la matrice des capacités (D-69).
- Profil et poids : l’aide « en centimètres, ex. 186 » sous Taille est supprimée, le libellé « Taille (cm) » suffit.
- iPhone : l’icône de l’app est celle de Spartiate et non l’icône Tauri par défaut. Le build copie src-tauri/icons/ios dans l’AppIcon du projet généré (échec si une taille manque) et contrôle sur l’IPA finale, par hash, que l’icône Spartiate y est.

## 0.1.3

- Diagnostic d’Apple Santé : quand la demande d’accès échoue, l’erreur native (domaine, code, description) n’est plus perdue. Elle s’affiche sous « Détail technique » (repliable) avec la présence du texte d’usage Santé dans l’Info.plist et la disponibilité de Santé, et s’écrit dans le journal technique pour être partagée. Aucune donnée de santé n’y figure.
- iPhone : la flèche de retour et le haut du contenu ne chevauchent plus la barre d’état (marge du haut comptée une seule fois : le plus grand de la zone de sécurité et d’un plancher de 59 px).
- iPhone : les cartes de Profil et poids ne dépassent plus le bord droit (marge de 20 px à gauche et à droite, aucune largeur ne dépasse la colonne) ; vérifié par la géométrie à 440 × 956 en CI.
- Synchronisation : une pesée ou un profil enregistré arrive sur l’autre appareil en moins de 60 s. Cycle 3 s après une écriture locale (regroupées), toutes les 25 s tant que l’app est visible au premier plan, et au retour au premier plan ; toujours rien en arrière-plan.

## 0.1.2

- Écrans I0 alignés sur les planches : Aujourd’hui, Profil et poids, Plus (cartes, groupes, contraste).
- Apple Santé en lecture seule (iPhone) : ligne dans Plus, demande d’accès, poids et pas du jour avec leur source, états vide, refusé et indisponible distincts ; « Utiliser cette pesée » enregistre la pesée sans écraser la saisie manuelle. Aucune écriture dans Santé.
- Corrections constatées sur l’iPhone : entrée « Verrouillage Face ID » masquée (D-37), grand espace au-dessus des titres supprimé (marge de l’encoche comptée une seule fois), alerte des notifications en jaune d’avertissement.
- Tous les textes de l’app tutoient.

## 0.1.1

- Correctif de démarrage iPhone : écran « Démarrage bloqué : <étape> » avec « Réessayer » et « Partager le journal » au-delà de 8 secondes sur une étape ; étapes de démarrage chronométrées au journal technique.
- Les sections sans écran le disent au lieu d’une zone blanche ; onglets inactifs lisibles sur la barre.
- Journal technique visible dans l’app Fichiers de l’iPhone (Documents/Journal).

## 0.1.0

- Première version de Spartiate pour Windows : identité `fr.spartiate.app`, dépôt de versions `spartiate-releases` (D-58).
- Base neuve (schéma 1) ; profil et poids synchronisés entre appareils.
- Mises à jour signées : l'app vérifie `latest.json` et propose la bannière « Installer et redémarrer ».
