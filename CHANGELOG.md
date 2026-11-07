# Changelog Spartiate

Le changelog de l'ancien projet est archivé : `docs/archive/circletasks/CHANGELOG.md` (D-40).

## 0.3.2

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
