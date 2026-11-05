# Changelog Spartiate

Le changelog de l'ancien projet est archivé : `docs/archive/circletasks/CHANGELOG.md` (D-40).

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
