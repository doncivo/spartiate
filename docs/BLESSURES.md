# BLESSURES : gênes déclarées et check-in bimensuel (lot 0.28.1, phase 3, point 3.2)

Chapitres : docs/prd/10-onboarding-et-profil.md (§ 10.1 étape 6, § 10.2), docs/prd/11-*.md (§ 11.4, § 11.5 « douleur n'est pas une incitation »). Budget M, modules settings-personalization, training (exclusions), notifications (iPhone seulement). Groupe D-374 : une branche, une PR, un commit rouge puis un commit vert par sous-ticket.

## Données (décision de conception)

Réglage LOCAL `training.injuries` (`{ v: 1, items }`), jamais synchronisé, jamais exporté (l'export du réglage `settings` ne porte que `ui.theme`), effacé par « Effacer mes données » (`wiped`), jamais envoyé à une API, jamais dans les journaux (le journal ne reçoit que des codes). Aucune table, aucune migration. Conséquence : une gêne déclarée sur un appareil n'est pas vue sur l'autre (voir « Décisions proposées »).

## BLESSURES-a : Profil › Blessures

- Given aucune gêne, When j'ouvre Profil et poids, Then une section « Blessures » à la demande (bloc chargé avec ses textes) explique l'effet sans promesse : « Spartiate évite ces mouvements dans ses propositions ; il ne remplace pas un avis médical ».
- Given je choisis un muscle du contenu et/ou des patterns douloureux, une date de début (pas dans le futur), une note de 140 caractères au plus, When j'enregistre, Then la gêne est active et listée ; sans muscle ni pattern, refus avec message.
- Given une gêne active, When je la marque « guérie », Then elle passe dans les gênes passées (date de guérison) et n'a plus d'effet.
- Given des gênes actives, When une séance est proposée, Then aucun exercice des patterns déclarés ni dont le muscle déclaré contribue pour au moins 0,3 n'est proposé (règle pure `injuryAvoidance`) ; la douleur n'augmente jamais une charge ni un volume (aucune entrée du moteur de progression).

## BLESSURES-b : check-in tous les 14 jours

- Given une gêne active, When 14 jours ou plus se sont écoulés depuis son début ou sa dernière réponse, Then Aujourd'hui affiche la carte « Où en est ta gêne ? » (Mieux / Pareil / Pire / Guérie, boutons d'au moins 44 px, texte et non couleur seule).
- When je réponds, Then la réponse est tracée (date, réponse), la prochaine échéance est à +14 jours ; « Guérie » clôt la gêne ; « Pire » affiche une phrase prudente (avis d'un professionnel de santé), sans rien proposer d'augmenter.
- Given aucune réponse, Then rien ne change (la gêne reste active, l'évitement continue).
- iPhone seulement : une notification locale neutre (nature `injury`, texte sans mention de gêne, écran verrouillé) à 09:00 le jour d'échéance (ou le jour même si l'échéance est passée et 09:00 pas encore atteint) ; une par jour, plafond partagé des 64 ; le PC n'en envoie aucune (planificateur vide).

## Montage et mesure

La carte de check-in est montée par le bloc à la demande des Compléments d'Aujourd'hui (`SupplementsTodayCard`, chargement dynamique de `InjuryCheckinCard`) : aucun point d'entrée de plus dans le départ (un premier montage par `lazyScreens` coûtait +146 octets normalisés : 193 956 sur main, 194 102). Le rappel est replanifié par `supplementWake` (même file de passages). Évitement des propositions : `GeneratedSession` seulement ; le remplacement d'exercice en séance active (`ReplaceExercise`) n'applique pas encore les gênes (reporté).

## Preuves

Tests : `src/domain/training/injuries.test.ts`, `src/domain/injuryNotificationPlan.test.ts`, `src/features/notifications/injuryNotifications.test.ts`, `src/features/settings/injuries/InjuriesSection.test.tsx`, `src/features/settings/injuries/InjuryCheckinCard.test.tsx`, bundle (mesure avant / après : main 193 956, branche 193 937 octets normalisés).

## Décisions proposées (numéros à donner par l'appelant)

1. Gêne en stockage LOCAL (réglage `training.injuries`, non exporté, effacé par la réinitialisation). Publier une table `injury` pour que les deux appareils la voient exige une migration publiée et la relecture de sync-icloud (D-26) : à trancher par Ali.
2. Seuil d'évitement par muscle : contribution de 0,3 ou plus dans les muscles de l'exercice ; patterns évités en totalité.
3. Notification de check-in : neutre (jamais « gêne » à l'écran verrouillé), 09:00, nature `injury` ajoutée à la liste des natures.

## Constats d'Ali à faire

iPhone : déclarer une gêne fictive, vérifier la carte Aujourd'hui après 14 jours (ou en avançant la date de début), la notification neutre. PC : la section Blessures dans Profil et poids.

## Relecture à froid

Verdict : à corriger, corrigé. (1) La carte de check-in utilisait des classes `ct-body__*` définies dans `BodyScreen.css`, absentes d'Aujourd'hui au lancement à froid : elle porte maintenant `ct-today__card`, `ct-today__eyebrow`, `ct-today__muted`, `ct-today__text` (feuille d'Aujourd'hui) et sa propre `Injuries.css`, avec test. (2) Tests de branchement ajoutés : proposition de séance sans exercice évité (`GeneratedSession.injuries.test.tsx`), replanification de `injury` par `supplementWake`, nature `injury` (contrat, validation, registre) ; date effacée : message « date requise » ; échec du chargement des muscles : message dit, aucun rejet non géré. Rouge 69e136fe (les tests de branchement et de nature étaient déjà verts : ils prouvent un code existant), vert dans le commit suivant.

Surcoût propre au ticket : +46 octets normalisés sur main (194 002 contre 193 956) avant le retrait de 7 clés de `fr.ts` sans usage (tasks.complete, tasks.reopen, reminders.more, editTitle, saveError, sectionTitle, recaps) ; après retrait 193 937. COQUILLE-PC retire les mêmes 7 clés : à la fusion, le surcoût propre reste +46 octets contre main (marge très large, plafond non touché).

Constat pour Ali : le rappel est replanifié à l'ouverture, au retour au premier plan et après un lot de synchro touchant les compléments, pas en arrière-plan : une gêne déclarée puis une app fermée avant replanification n'est pas un cas (la déclaration replanifie tout de suite).
