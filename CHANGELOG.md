# Changelog Spartiate

Le changelog de l'ancien projet est archivé : `docs/archive/circletasks/CHANGELOG.md` (D-40).

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
