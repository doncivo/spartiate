# Changelog Spartiate

Le changelog de l'ancien projet est archivé : `docs/archive/circletasks/CHANGELOG.md` (D-40).

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
