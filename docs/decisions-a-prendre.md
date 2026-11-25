# Décisions à prendre par Ali

Questions fermées ouvertes pendant les lots 0.29.2 et suivants (prompt du 24/11, docs/LOT-0.29.2.md) et lignes « à trancher par Ali »
du registre (docs/backlog.md) restées sans réponse au 24/11. Chaque question : 2 à 4 options, une recommandation, les conséquences.
Le lot continue sans la réponse : le comportement actuel reste en place tant qu'une option n'est pas choisie. Réponse attendue sous la
forme « Q-n : option ». Une question tranchée devient une D- dans docs/decisions.md et sort de ce fichier.


Q-1 à Q-10 tranchées par Ali le 24/11 : D-496 à D-505 (docs/decisions.md). La revue par thème des choix prudents (D-490, BL-149) sera
ajoutée ici en sections « séance et moteur », « nutrition », « récupération », « synchro et données », « écrans », « CI et outillage ».

## Q-11 — Décision d'Ali postérieure à la dernière séance et réductions (C-026, SEANCE-0292)

Une décision (modification ou retour en arrière depuis la fiche) datée après la dernière séance de l'exercice est reprise telle quelle,
même en semaine de décharge, après 3 semaines de pause ou un jour de journée rouge acceptée (règle I2-02 « l'entrée d'Ali l'emporte »).
- A. Garder la règle (décision jamais modulée).
- B. La décision devient la référence ; la décharge, la pause et la journée rouge la réduisent comme une référence d'historique.
- C. Seule la décharge (semaine programmée) la réduit.

Recommandation : B (une semaine de décharge à pleine charge contredit le § 12.2). Conséquences : deux tests existants qui figent A
changent d'attente ; correctif prêt hors git, à porter aussi sur les exercices au poids du corps.

## Q-12 — Pause de séance (BL-110, § 13.2 « Pause / abandonner », SEANCE-0292)

La durée publiée est `ended_at − started_at` : une pause qui n'en retire pas son temps n'a pas d'effet utile.
- A. Colonnes additives `workout.paused_at` et `workout.paused_ms` (publiées avec la séance close ; anciens exports et journaux : 0) ;
  chrono, résumé, énergie Apple Santé et replay hors pause ; repos annulé pendant la pause.
- B. Pause locale : chrono figé à l'écran, durée publiée inchangée.
- C. Pas de pause : « Abandonner » seulement (actuel).

Recommandation : A. Conséquences : migration additive et relecture sync-icloud (module données et synchro), puis écran de séance.

## Q-13 — Trace d'une correction de série (C-072, § 13.4, § 13.8, SEANCE-0292)

Seule la date de correction (`corrected_at`) est gardée, pas la valeur d'avant.
- A. Garder la date seule (actuel).
- B. Colonne additive `workout_set.corrected_from` (valeurs d'avant la dernière correction), publiée ; « corrigée : 80 → 82,5 kg ».
- C. Table publiée de l'historique complet des corrections.

Recommandation : B. Conséquences : migration additive, relecture sync-icloud, affichage au journal.

## Q-14 — « Fermer le résumé » de séance (BL-160, SEANCE-0292)

- A. Retour à l'accueil de l'Entraînement (choix prudent, fait en SEANCE-0292).
- B. Rester sur « Nouvelle séance » ; un nouvel appui sur l'onglet actif ramène à son accueil (règle commune à tous les onglets).

Recommandation : A (moins de gestes).

## Q-15 — Arrondi de la décote de position (H-1, écart G3) (SEANCE-0292b)

Constat : 2ᵉ exercice du muscle, 40 kg × 0,93 = 37,2 kg. Gravl publie 37,5 kg (arrondi au plus proche, répétitions compensées dans les deux
sens) ; Spartiate propose 35 kg et une répétition de plus (arrondi vers le bas, § 11.3 « +1 rep si l'écart dépasse 3 % »).
- A (recommandé) : garder l'arrondi vers le bas (jamais au-dessus de la cible, règle unique du moteur). Conséquence : séance un peu plus
  légère au 2ᵉ rang.
- B : arrondi au plus proche avec une répétition de moins si la charge monte. Conséquence : règle d'arrondi propre à la position, ENGINE_VERSION
  relevée.

## Q-16 — Échelle après un cran (H-1, écart G2b) (SEANCE-0292b)

Constat : après 8-8-8 et un cran, Gravl repart à 8-7-6 (série d'appui en tête), Spartiate au bas de la plage sur chaque série (6-6-6).
- A (recommandé) : garder (règle D-72, figée par TESTS-FIGES). B : repartir au profil de répétitions de la première séance de l'échelle.


## Q-17 — Référence sous la plus petite charge du profil (D-536 dépasse D-496) (SEANCE-0292b)

Constat : D-496 (Ali) dit « arrondie vers le bas à la grille, plafonnée au maximum » ; sous le minimum, il n'existe aucune charge en dessous.
D-536 (Claude) répond « à saisir » (aucune charge proposée) ; ce cas n'était pas tranché par Ali. Aucun code changé par cette question.
- A (recommandé) : garder « à saisir », note « sous la plus petite charge de ce profil ». Conséquences : jamais de hausse au-delà du plafond
  de +10 % (4 kg → 5 kg = +25 %) ; Ali saisit la charge qu'il utilise ; la propriété `prescribe.property.test.ts` (D-536) le fige.
- B : proposer la plus petite charge du profil avec des répétitions réduites pour garder l'effort (e1RM ≤ référence + 10 %). Conséquences :
  une proposition chiffrée tout de suite ; règle nouvelle (répétitions ajustées à la baisse sur une hausse de charge, contraire au
  « reps → charge jamais dans la même prescription »), vecteurs et propriété à réécrire, `ENGINE_VERSION` relevée.


## Q-18 — Fichier Santé tronqué en pleine valeur (C-056, NUTRI-0292)

Constat : « 4000 » coupé en « 40 » est indiscernable d'une vraie valeur ; limite figée par `shortcutFiles.steps.test.ts`.
- A : garder (limite connue). Conséquences : aucun changement ; une valeur fausse rare reste possible.
- B (recommandé si le raccourci le permet) : le raccourci écrit toujours un saut de ligne final, l'app refuse un fichier qui n'en a pas.
  Conséquences : guide du raccourci à modifier, constat sur l'iPhone ; les anciens fichiers sans saut de ligne sont refusés.

## Q-19 — Base HRV sans dispersion ou HRV du jour absente (C-060, NUTRI-0292)

- A (recommandé) : garder le niveau B (seuils absolus). Conséquences : aucun changement, comportement figé par `tonightValidity.test.ts`.
- B : un message dédié (« base trop régulière », « HRV manquante »). Conséquences : deux textes et un état de plus à l'écran.

## Q-20 — « traces » de Ciqual (C-042, D-477, NUTRI-0292)

Constat : la source Ciqual écrit « traces » en `null` pour chaque nutriment ; D-477 ne parle que des lipides.
- A : 0 g pour les lipides seulement (D-477 à la lettre). Conséquences : les autres nutriments en traces restent inconnus.
- B (recommandé) : 0 g pour tous les nutriments. Conséquences : contenu régénéré par content-data (`scripts/content/ciqual.mjs`) en 0.29.3.

## Q-21 — Libellé « Base en construction » (C-061, D-479, NUTRI-0292)

- A (recommandé) : garder le même libellé pour le premier apprentissage et une base redevenue trop courte. Conséquences : aucun changement.
- B : « en reconstruction » quand des nuits plus anciennes existent. Conséquences : un texte et une règle de plus.

## Q-22 — Définition des « go-tos » (BL-117, D-560, NUTRI-0292)

- A (recommandé, livré) : aliments pris au moins 3 fois sur 90 jours, 6 au plus. Conséquences : aucun changement.
- B : les repas entiers répétés (même heure, mêmes aliments). Conséquences : règle nouvelle dans le domaine, liste plus courte.
- C : aliments épinglés par Ali. Conséquences : un réglage et une donnée de plus (synchro à relire).

## Q-23 — Deux réglages « Objectif » (C-106, NUTRI-0292)

Constat : `profile.goal` (Réglages › Corps) et `nutrition.prefs.goal` (Stratégie) peuvent se contredire.
- A (livré) : garder deux réglages aux libellés distincts. Conséquences : contradiction possible, visible.
- B (recommandé) : Stratégie lit l'objectif du profil, le rythme reste en Stratégie. Conséquences : lecture seule, sans schéma ; avis de data-model.
- C : Stratégie écrit aussi le profil. Conséquences : écriture d'une table publiée, relecture sync-icloud.

## Q-24 — Champ « Heure » en 12 h sur l'iPhone (C-103, NUTRI-0292)

À constater par Ali sur l'iPhone (docs/constats-ali.md).
- A : garder le champ système. Conséquences : l'heure peut s'afficher en 12 h, contraire aux 24 h de la charte.
- B (recommandé si constaté) : deux champs numériques H et M en 24 h. Conséquences : un composant de saisie de plus, tests d'écran.

## Q-25 — Silhouette de Corps et date de la photo (C-105, NUTRI-0292)

- Silhouette : A (recommandé) garder en complément des pastilles ; B la retirer ; C agrandir les zones (cou et épaules déplacés, rayon 11).
  Conséquences : A aucun changement ; B les pastilles seules ; C des zones de 22 px, encore sous 44 pt.
- Photo : A (recommandé) toujours datée du jour de l'ajout (D-99) ; B un champ de date. Conséquences : B permet d'importer d'anciennes photos.
- Après constat sur l'iPhone.

## Q-26 — Jour complet par le seul total importé de Santé (C-039, D-547, NUTRI-0292)

Constat : un jour dont la seule entrée est « Renpho — total du jour » (reconnue par son nom figé) est rendu complet.
- A (recommandé) : garder D-547. Conséquences : la dépense mesurée reste alimentée par Santé ; un renommage de l'entrée la ferait redevenir une saisie ordinaire.
- B : complet seulement si des repas saisis existent et sont complets. Conséquences : moins de jours complets, donc moins de jours pour le TDEE mesuré.
- C : comme A, mais l'entrée est reconnue par un marqueur (source dédiée). Conséquences : migration additive et relecture sync-icloud.

## Q-27 — Heure de « Dernière synchronisation » quand tous les fichiers n'ont pas pu être lus (BL-039) (DATA-0293)

Le moteur avance l'heure du dernier cycle dès que la publication a réussi, sans erreur de lecture permanente et sans fichier en attente, même si un fichier d'un autre appareil n'a pas pu être lu complètement (`allRead` faux).
- A. Garder (l'heure dit « ce cycle s'est terminé sans erreur »).
- B. N'avancer l'heure que si tout a été lu (un fichier évincé d'un appareil absent la figerait).
- C. Avancer, mais dire « lecture partielle » à côté de l'heure.

Recommandation : C. Conséquences : A ne change rien et peut afficher une heure récente alors que des changements de l'autre appareil ne sont pas lus ; B est le plus honnête mais peut figer l'heure durablement ; C demande un texte et un avertissement, sans changer le moteur de lecture (relecture sync-icloud).

## Q-28 — Gilet lesté comme source de lest (BL-113, D-383) (CONTENT-0293)
- A (recommandé) : champ optionnel « poids du gilet (kg) » au profil de matériel, lest = ce poids par crans choisis. Conséquences : l'inventaire du profil gagne un champ (table publiée `equipment_profile` : relecture sync-icloud, data-model) ; éditeur de profil à compléter.
- B : gilet à lest modulable : saisie des plaques de gilet comme les disques de ceinture. Conséquences : plus fin, plus de saisie.
- C : le gilet reste un simple matériel (disponibilité), sans lest proposé. Conséquences : aucun changement.

## Q-29 — Droit de relicence des normes FitnessVolt (C-180, D-310) (CONTENT-0293)
- A (recommandé) : garder la source, écrire la limite dans licences.md (fait) et écrire à FitnessVolt. Conséquences : app personnelle, risque faible ; réponse à consigner.
- B : retirer les normes tant que le droit n'est pas confirmé. Conséquences : Strength Score sans normes.
- C : remplacer par une source dont la licence est vérifiable. Conséquences : nouvelle étude de sources.

## Q-30 — Lecture du PDF d'un programme (BL-126, D-423) (CONTENT-0293)
- A (recommandé) : ajouter `pdfjs-dist`, chargé à la demande, texte extrait localement, aucun appel réseau. Conséquences : dépendance de plus (architect), poids hors départ, PDF scannés toujours refusés.
- B : rester sans PDF (capture puis photo). Conséquences : aucun changement.
- C : extracteur maison pour les PDF simples. Conséquences : texte faux possible sans signal.

## Q-31 — `cable-kickback` et `cable-hip-extension` (BL-128) (CONTENT-0293)
Constat : même mouvement, même matériel, deux ids publiés ; aucune redirection d'identifiant n'existe pour une fusion.
- A (recommandé) : garder les deux, aucune fusion. Conséquences : deux fiches voisines, aucune référence perdue.
- B : fusionner avec redirection d'id dans le chargeur (hors périmètre content-data : training et data-model). Conséquences : un mécanisme de plus, test d'identifiants stables à adapter.

## Q-32 — « Démarrer la séance du jour » dans la palette Ctrl+K (SHELL-0294a)
Constat : D-480 demande « démarrer la séance du jour » ; la palette ouvre l'écran de séance (options de départ, ou reprise de la séance ouverte), comme le bouton d'Aujourd'hui (D-592).
- A (recommandé) : garder l'ouverture de l'écran de séance. Conséquences : un geste de plus pour lancer, aucune séance créée par une frappe de clavier.
- B : créer la séance du jour directement depuis la palette. Conséquences : un seul geste, mais une séance peut naître d'une frappe accidentelle (annulation à prévoir côté training).

## Q-33 — Entitlements du § 19.4 : `healthkit.access` et `keychain-access-groups` (SHELL-0294b)
Constat : le § 19.4 demande trois clés ; la source durable `src-tauri/ios/Spartiate.entitlements` n'en porte qu'une (`com.apple.developer.healthkit`). La signature ad hoc de la CI ne développe pas `$(AppIdentifierPrefix)`, et changer le groupe du Trousseau d'une app installée peut rendre illisible la clé de synchro qu'il garde (D-598).
- A (recommandé) : garder l'écart et amender le § 19.4 par une D- (une seule clé, HealthKit). Conséquences : aucun risque pour la clé de synchro ; le chapitre 19 et l'app disent la même chose.
- B : ajouter `com.apple.developer.healthkit.access` (tableau vide) seulement. Conséquences : conforme au modèle d'Xcode pour HealthKit, sans effet tant que HealthKit direct reste BLOCKED (D-69) ; une compilation iOS et un constat d'installation par SideStore.
- C : ajouter les deux clés. Conséquences : `keychain-access-groups` à développer par la CI avec le préfixe de l'équipe de SideStore, inconnu de la CI ; risque de perdre l'accès à la clé de synchro du Trousseau après la mise à jour (réappairage).

## Q-34 — Libellé « Logs » ou « Journaux » (SHELL-0294c)
Constat : Plus affiche « Journaux » dans le sommaire PC (`navLogs`) mais l'écran, la ligne de Réglages et l'export disent « Logs » (`fr.logs.ts`, 11 textes) ; trois suites e2e (`I-04`, `lot-f-qa`, `lot-f-screens`) et huit tests unitaires nomment « Logs » (C-131). Le renvoi du texte d'échec de fichier a été corrigé vers « Plus › Journaux » (D-605).
- A (recommandé) : « Journaux » partout (écran, ligne, export). Conséquences : un seul mot, comme le reste de Plus ; les e2e se mettent à jour dans une PR dont la CI les lance (impossible en local).
- B : « Logs » partout, y compris le sommaire PC. Conséquences : anglicisme gardé, un seul libellé de plus à changer, aucun e2e touché.
- C : garder les deux (état actuel). Conséquences : l'utilisateur voit deux mots pour un même écran.

## Q-35 — Essai de la CSP stricte sur l'appareil (SHELL-0294d)
Constat : la CSP ne contient plus `'wasm-unsafe-eval'` ni `style-src 'unsafe-inline'` (D-611). Aucun essai n'est possible sur ce PC ni sur l'iPhone par un agent ; un style ou un module qui ne s'afficherait pas serait vu à la première ouverture de la version.
- A (recommandé, appliqué) : garder la CSP stricte ; Ali ouvre les écrans listés dans docs/constats-ali.md (0.29.4, « CSP ») et signale tout défaut d'affichage. Conséquences : un défaut éventuel est corrigé à la source (style en ligne retiré).
- B : rétablir `style-src 'unsafe-inline'` seulement. Conséquences : plus de risque d'affichage cassé, mais les styles injectés par une page hostile redeviennent possibles.
- C : rétablir les deux directives. Conséquences : état d'avant, sans gain de sécurité.

## Q-36 — Système inconnu dans l'app installée : message visible ? (C-163, SHELL-0294e)
Constat : si l'agent utilisateur et la plateforme du navigateur intégré ne disent rien (cas jamais vu sur Windows ni sur l'iPhone), l'app garde le système « other » : synchro et sauvegardes indisponibles, et seul le journal le dit (`os-unknown`, D-616).
- A (recommandé, appliqué) : journal seulement ; le cas est théorique et un bandeau de plus alourdirait le départ. Conséquences : si cela arrivait, l'utilisateur verrait des réglages absents et le journal en donnerait la cause.
- B : lire aussi `navigator.platform` quand l'agent utilisateur est vide (14 à 24 octets de départ, à compenser ailleurs).
- C : afficher dans Plus une ligne « Système non reconnu : synchro et sauvegardes indisponibles ». Conséquences : cause visible, un texte et un test de plus, catalogue à charger à la demande.
