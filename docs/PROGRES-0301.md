# PROGRES-0301 — Progrès en onglets et Mensurations : inventaire, correspondance, décisions et plan du lot 0.30.1

Ticket de consignation DEC-0301 (branche DEC-0301), sans code. Il prépare le lot 0.30.1 (D-696). Chapitres : 17.1 (indicateurs de
Progrès, ligne « Corps »), 18 (navigation, § 18.4 charte, § 18.6 accessibilité), 10.2 (profil : mensurations), 16 (récupération,
tendances 30 j), 23.1 (bundle de départ). Décisions : D-700 à D-719. Registre : BL-177 à BL-181. Constats : docs/constats-ali.md,
section « 0.30.1 (Progrès en onglets et Mensurations) ». Aucune migration, aucune table, aucun fichier de synchro, aucun code.

## Consigne d'Ali du 26/11 (verbatim)

> « Règle absolue : aucun bloc, aucune donnée et aucune fonction existante de Progrès ne disparaît. Avant la PR, fais l'inventaire de tout ce qu'affichent aujourd'hui RecoveryProgress, TrainingProgress, WeeklyReview, StrengthScore, BodyProgress (avec VisbodySection), CardioProgress et TrackingProgress (src/features/app/SectionNotice.tsx). Ensuite, un test vérifie que chaque élément se retrouve dans un onglet.
> 1. Progrès en 6 onglets (iPhone et PC), dans cet ordre :
> - Récup : Tendances sur 30 jours (Recovery, HRV, FC repos, Sommeil, avec moyennes 30 j et 7 j, min, max, jours mesurés) ; « Ce qui change ta Recovery ».
> - Séances : Constance (série, calendrier du mois) ; Adhérence et Prescriptions respectées ; Volume par muscle (tous les muscles, cette semaine, moyenne sur 8 semaines, semaine dernière face à la plage cible).
> - Bilan : Bilan de la semaine (faits, Recommandations, Semaines précédentes, Exporter).
> - Force : Strength Score (global, 8 groupes, détail par mouvement, contexte poids, sexe et catégorie, méthode). Il suit le moteur maison de Q-29, sans FitnessVolt.
> - Corps : 4 sous-onglets, Mesures · Santé (Importé de Santé, Renpho) · VISBODY (Bilans VISBODY, mesures segmentaires, courbes) · Photos (ajout, masquer, Côte à côte, mention de confidentialité).
> - Activité : Cardio (4 dernières semaines) ; Suivis (Objectifs, Pas par semaine, Cardio en zone 2).
> L'onglet choisi est retenu tant que l'app est ouverte. Un nouvel appui sur Progrès ramène au premier onglet (même règle que Q-14). Navigation au clavier sur PC, rôles d'accessibilité tablist/tab/tabpanel. Le chargement de chaque onglet ne doit pas alourdir le départ de l'app.
> 2. Corps › Mesures : tout l'existant est gardé (silhouette, grande valeur avec date et écart sur 4 semaines, liste « Zones · dernière · 4 sem. », courbe, relevés, suppression avec confirmation, ↑ ↓ au clavier sur PC, saisie date + valeur). Ajouts :
> a. Correctif : l'unité « cm » ne se coupe plus en « c » / « m » à côté du champ (constat iPhone du 26/11).
> b. Silhouette et pastilles reliées : toucher un point de la silhouette ou une pastille choisit la même zone.
> c. Silhouette colorée par tendance : vert si la zone évolue dans le sens de l'objectif du profil (lu selon Q-23), orange si elle évolue à l'inverse, gris si elle est stable ou s'il n'y a pas assez de mesures. Une courte légende sous la silhouette.
> d. Courbe avec période : 4 sem. · 3 mois · 6 mois · Tout. Le tour de taille importé de Santé est superposé en pointillé sur la courbe du tour de taille. Sous la courbe : le rythme par mois de la zone et l'évolution du poids (tendance des pesées) sur la même période.
> e. Ratios, sur les dernières mesures : taille / hauteur, épaules / taille, taille / hanches, poitrine / taille, chacun avec sa valeur, son évolution sur la période et un repère. La hauteur vient du profil ou de Santé ; sans hauteur, « inconnu », jamais 0. Tu proposes les repères avec leur source, et je les valide avant publication (même règle que Q-40).
> f. Symétrie gauche / droite : bras, cuisses et mollets ; écart en cm et en %, signalé au-delà de 2 %.
> g. Saisie guidée : les 11 zones à la suite (Passer, Suivant), avec pour chaque zone un conseil de placement du mètre et la dernière valeur rappelée. Toutes les mesures d'une même séance de saisie portent la même date. La saisie zone par zone reste disponible.
> h. Rythme des mesures : chaque semaine par défaut, réglable dans Corps. L'écran affiche « dernière séance de mesures il y a N jours » et « prochaine conseillée dans N jours ». Une notification de rappel arrive le matin du jour prévu ; elle se désactive dans Corps.
> Calculs (tendance, ratios, symétrie, rythme) dans le domaine pur, avec tests sur des valeurs inventées. »

Correspondance des points avec les décisions : règle absolue D-700 ; 1 D-701 ; 2 D-702 ; a D-703 ; b D-704 ; c D-705 ; d D-706 ;
e D-707 ; f D-708 ; g D-709 ; h D-710 ; calculs D-711. Choix prudents : D-712 à D-719.

## Passe product-owner (critères du ticket de consignation)

1. Étant donné la consigne d'Ali, quand la PR est fusionnée, alors chaque point (règle absolue, 1, 2, a à h, calculs) a sa D- au nom
   d'Ali, avec « Ali (décision du 26/11) » en colonne auteur, au format de D-647, dans la plage D-700 à D-719.
2. Étant donné un choix que la consigne laisse ouvert, alors il porte une D- « Claude (choix prudent) ; révisable par Ali », et la revue
   générée (docs/decisions-a-prendre.md) est à jour (`node scripts/release/prudent-review.mjs` sans option ne signale rien).
3. Étant donné l'inventaire, alors chaque élément existant a une ligne dans la table de correspondance ci-dessous, avec son onglet et
   son sous-onglet ; aucun élément sans destination.
4. Étant donné le registre, alors BL-177 à BL-181 sont ouvertes au statut « à faire (0.30.x, module, taille) » et le décompte est relu
   par `node scripts/release/backlog-count.mjs`.
5. Étant donné docs/constats-ali.md, alors la section « 0.30.1 (Progrès en onglets et Mensurations) » liste des gestes sur l'iPhone et
   sur le PC, avec des chemins réels ou des libellés nouveaux nommés comme tels, et la table de contrôle les renvoie.
6. Hors périmètre : tout code, docs/reprise.md, CHANGELOG.md, fichiers de version, chapitres du PRD (figés par `prd-split.test.ts`).

## Inventaire de l'existant (repris de l'inventaire du 26/11, main 89d2a5da, lecture seule)

Hôte : `src/features/app/SectionNotice.tsx:48-56`. Ordre de rendu identique sur iPhone et PC : RecoveryProgress, TrainingProgress,
WeeklyReview, StrengthScore, BodyProgress, CardioProgress, TrackingProgress. La route `progress` n'a pas de sous-écran (navigation.ts:40).
Tous les blocs sont chargés à la demande (lazyScreens.tsx:135-139, SectionNotice.tsx:12-20). Le bloc qui échoue au chargement affiche
« Impossible d'afficher cet écran. », puis « Réessayer » et « Recharger ». Ctrl+4 ouvre Progrès. Sur PC, le h1 est masqué et le titre est
dans la barre du haut. Il n'existe encore aucun `role="tablist"` dans `src` : la sous-navigation existante est SegmentedControl (radiogroup).

### Récup
1. **Tendances sur 30 jours** (RecoveryTrends.tsx:86-122, fr.recoveryFactors.ts:48-61) : une ligne par mesure (Recovery, HRV, FC repos,
   Sommeil) ; chaque ligne a une courbe et un texte (moyenne sur 30 j et sur 7 j, min, max), plus le nombre de jours mesurés. États : vide
   « Aucune mesure sur les 30 derniers jours. » ; mesure sans valeur « {metric} : aucune mesure » ; valeur absente « — » ; en chargement ou
   en échec, le bloc n'affiche rien.
2. **Récupération : ce qui change ta Recovery** (RecoveryProgress.tsx:126-184) : 8 facteurs, pour chacun jours avec, jours sans, écart ;
   note « Association observée, pas une cause… ». États : chargement ; échec avec « Réessayer » ; vide ; pas assez de jours ; aucun facteur
   comparable. Seuils : 30 jours, 5 occurrences, 5 jours sans.

### Séances
3. **Constance** (TrainingProgress.tsx:135-169) : série de semaines et semaine en cours ; règle affichée (par défaut ou programme) ;
   calendrier du mois (initiales selon le début de semaine, cellules nommées : fait, aucun, pause, aujourd'hui) ; vide `streakNone`.
4. **Adhérence**, avec le sous-bloc **Prescriptions respectées** (l.191-211) : valeur, détail, règle ; `adherenceNone`, `adherenceWait` ;
   prescriptions : séries, ajouts et retraits, charges ou « aucune charge », règle, vide.
5. **Volume par muscle** (l.222-255) : sous-titre ; une ligne par muscle (barres, ligne de texte, position dans la plage : en dessous,
   dans, au-dessus) ; séries d'exercices inconnus, règle de plage, vide. États de TrainingProgress : chargement ; échec avec « Réessayer ».

### Bilan
6. **Bilan de la semaine** (WeeklyReview.tsx:80-167) : introduction et « Semaine du {from} au {to} » ; une phrase par thème (séances,
   records, volume, poids, nutrition, sommeil, cycle, textes « insuffisant » compris) ; **Recommandations** (introduction, 3 thèmes, ou
   `recNone`) ; **Semaines précédentes** (6 boutons, « Revenir à la semaine passée » quand une semaine précédente est choisie) ;
   **Exporter** (fichier spartiate-bilan-{date}.md, partage ou téléchargement, 4 statuts). États : chargement ; échec avec « Réessayer ».

### Force
7. **Strength Score** (StrengthScore.tsx:157-177) : sous-titre ; score global avec son palier ; nombre de groupes ; contexte (catégorie
   de poids, sexe) ; 8 groupes (Pectoraux, Dos, Épaules, Biceps, Triceps, Quadriceps, Ischios, Fessiers), chacun avec barre, valeur ou
   « — », « < 10 », « > 99 », ligne du mouvement ou raison (séance, aucune séance, norme, sexe, poids de corps) ; méthode. États : sans
   sexe ; sans pesée ; chargement ; échec avec « Réessayer ». L'attribution FitnessVolt est retirée par BL-174 (D-675).

### Corps (BodyProgress.tsx, BodyZones.tsx, bodyZone.ts, VisbodySection.tsx)
- **Mesures** : 11 zones (measurements.ts:14), zone par défaut le tour de taille.
  - iPhone : silhouette SVG de 11 points (BodyZones.tsx:52-69), non accessible au clavier ; pastilles en radiogroup de 11, avec les
    flèches (:72-91).
  - PC : liste « Zones · dernière · 4 sem. » en radiogroup avec ↑↓ (:94-135), sans écart affiché « 4 sem. : — ».
  - Grande valeur : chiffre et « cm », écart sur 4 semaines ou depuis une date, « dernière mesure le… », état « pas encore de mesure ».
  - Courbe : jusqu'aux 12 dernières mesures, à partir de 2 ; 200×56 sur iPhone, 620×200 sur PC.
  - Saisie : date (bornée à aujourd'hui, suit le jour courant) ; mesure (« Mesure (cm) », placeholder à la dernière valeur, ↑↓ change de
    zone) ; unité « cm » en `span` dans le même `label` (BodyProgress.tsx:299-301, CSS :190-207) ; « Enregistrer » et validation par
    Entrée ; aide clavier sur PC ; messages : enregistrée, échec, vide, format, hors bornes, date, futur.
  - Relevés : note, liste de la plus récente à la plus ancienne, « × » avec ConfirmDialog, suppression logique synchronisée, vide.
- **Importé de Santé (Renpho)** (:345-363), absent sans import : masse grasse %, masse maigre kg, tour de taille cm, hauteur cm, chacun
  avec sa date, et une note ; lecture seule ; les fibres sont importées mais pas affichées.
- **Bilans VISBODY** (VisbodySection.tsx:154-222, h2) : liste par mesure (dernière valeur, écart ou « premier bilan », courbe à partir de
  2 bilans) ; saisie (date, 6 champs, repli « Mesures segmentaires » de 10 champs) ; un bilan de même date est prérempli puis remplacé ;
  un champ vidé est retiré ; erreurs par champ et par formulaire ; « Lecture impossible des bilans. » ; vide.
- **Photos de progression** (:368-435) : mention de confidentialité et bouclier (échec signalé) ; ajout (limite de 40 Mo, messages) ;
  liste triée par date (image ou « pas sur cet appareil », « supprimée ailleurs », case « Comparer », 2 au plus) ; suppression avec
  confirmation en ligne là où le fichier est présent ; « Masquer sur cet appareil » là où il ne l'est pas ; « Réafficher les photos
  masquées ({count}) » ; **Côte à côte** (2 figures, image manquante signalée, « Fermer la comparaison ») ; vide.
- **Disposition sur PC** : grille de 1, 2 ou 3 colonnes selon la largeur (BodyProgress.css:365-426), colonne Progrès en pleine largeur
  (SectionNotice.css:31-35).
- **États de Corps** : chargement ; échec avec « Réessayer ».

### Activité
8. **Cardio** (CardioProgress.tsx:42-81) : 4 semaines, de la plus récente à la plus ancienne ; chaque semaine : nombre de séances, durée,
   distance (inconnue, partielle ou aucune). États : vide ; chargement ; échec avec « Réessayer ».
9. **Suivis** (TrackingProgress.tsx:225-256) : **Objectifs** (pas par jour, minutes en zone 2 par semaine, FC max ; enregistrement,
   erreurs) ; **Pas par semaine** (4 semaines ; sur PC, la raison « reste sur l'iPhone » ; autres raisons d'absence) ; **Cardio en zone 2**
   (règle, plage, 4 semaines, atteinte, sans FC, lecture impossible, avertissement) ; **Notes du matin (30 jours)** (Fatigue et Qualité du
   sommeil, chacune avec un résumé et une courbe ; vide ; lecture impossible). États : chargement ; échec avec « Réessayer ».

### Existant à réutiliser
- Hauteur du profil : `heightCm`, « Taille (cm) », dans Plus › Profil (`src/domain/bodyProfile.ts`) ; objectif du profil : `goal`
  (gain, loss, maintain), lu par Stratégie selon Q-23 (D-669).
- « Hauteur » importée de Santé (`health_height_cm`), séparée du profil ; tour de taille de Santé (`health_waist_cm`), séparé de la zone
  « Tour de taille » saisie (`src/domain/bodyProgress/measurements.ts`).
- Tendance des pesées : `computeTrend` (`src/domain/nutrition/weightTrend.ts`).
- Rappel de modèle : le rappel des blessures (`src/domain/injuryNotificationPlan.ts`, 09:00) et le registre des familles
  (`src/domain/notificationLedger.ts`).
- Il n'existe ni réglage de rythme des mesures, ni rappel de mesure, ni ratios, ni symétrie.

### Tests existants (à garder verts)
Hôte : SectionNotice.test.tsx, ErgoScreens.test.tsx:103-109, ErgoToday.test.tsx:138-143. Captures : `tests/visual/capture.spec.ts`
(l. 179, 181, 222, 223). Par composant : RecoveryFactors.test.tsx, RecoveryTrends.test.tsx ; TrainingProgress.*.test.tsx ;
WeeklyReview*.test.tsx ; StrengthScore.test.tsx ; BodyProgress*.test.tsx, ZoneList.test.tsx, bodyZone.test.ts, VisbodySection.test.tsx ;
CardioProgress.test.tsx ; Tracking*.test.tsx. Bundle : `tests/bundle/startBundle.test.ts` (blocs hors du départ). e2e :
`tests/e2e/BL-119-zoom-pc.spec.ts`. Synchro : bodyProgressSync.test.ts, bodyProgressCatalogue.test.ts.

## Table de correspondance « élément existant → onglet / sous-onglet »

Base du test « rien ne disparaît » (BL-177, D-700) : chaque ligne P-nn devient une entrée d'une liste figée (élément, onglet,
sous-onglet, repère vérifiable à l'écran : titre, nom accessible ou texte du catalogue) ; le test monte Progrès, ouvre chaque onglet et
vérifie que chaque repère de la liste y est rendu, dans le bon `tabpanel`, sur le gabarit iPhone et sur le gabarit PC. Une ligne retirée
de la liste échoue la garde (liste fermée, comme `tests/bundle/start-modules.json`).

| ID | Élément existant | Composant d'origine | Onglet | Sous-onglet / position | Plateforme |
| --- | --- | --- | --- | --- | --- |
| P-01 | Tendances sur 30 jours (4 lignes, courbe, moyennes 30 j et 7 j, min, max, jours mesurés, états) | RecoveryTrends | Récup | 1er bloc | les deux |
| P-02 | Ce qui change ta Recovery (8 facteurs, avec, sans, écart, note, états, seuils) | RecoveryProgress | Récup | 2e bloc | les deux |
| P-03 | Constance (série, semaine en cours, règle, calendrier du mois, vide) | TrainingProgress | Séances | 1er bloc | les deux |
| P-04 | Adhérence (valeur, détail, règle, aucun, attente) | TrainingProgress | Séances | 2e bloc | les deux |
| P-05 | Prescriptions respectées (séries, ajouts et retraits, charges, règle, vide) | TrainingProgress | Séances | dans Adhérence | les deux |
| P-06 | Volume par muscle (tous les muscles, barres, plage, inconnus, règle, vide) | TrainingProgress | Séances | 3e bloc | les deux |
| P-07 | États de TrainingProgress (chargement, échec, Réessayer) | TrainingProgress | Séances | onglet entier | les deux |
| P-08 | Bilan de la semaine : intro, période, phrases par thème | WeeklyReview | Bilan | 1er bloc | les deux |
| P-09 | Recommandations (3 thèmes ou aucune) | WeeklyReview | Bilan | dans le bilan | les deux |
| P-10 | Semaines précédentes (6 boutons, retour) | WeeklyReview | Bilan | dans le bilan | les deux |
| P-11 | Exporter (fichier Markdown, 4 statuts) | WeeklyReview | Bilan | dans le bilan | les deux |
| P-12 | Strength Score (global, palier, groupes, contexte, 8 groupes, détail, raisons, méthode, états) | StrengthScore | Force | bloc unique | les deux |
| P-13 | Silhouette de 11 points | BodyZones | Corps | Mesures | iPhone seulement (D-719) |
| P-14 | Pastilles des 11 zones (radiogroup, flèches) | BodyZones | Corps | Mesures | iPhone seulement (D-719) |
| P-15 | Liste « Zones · dernière · 4 sem. » (radiogroup, ↑↓) | ZoneList | Corps | Mesures | PC seulement (D-719) |
| P-16 | Grande valeur (cm, écart 4 sem. ou depuis, date, pas encore de mesure) | BodyProgress | Corps | Mesures | les deux |
| P-17 | Courbe de la zone (taille iPhone et PC) | ZoneCurve | Corps | Mesures | les deux |
| P-18 | Saisie date + valeur (bornes, placeholder, ↑↓, Entrée, aide clavier PC, 7 messages) | BodyProgress | Corps | Mesures | les deux |
| P-19 | Relevés (note, liste, « × » et confirmation, suppression synchronisée, vide) | BodyProgress | Corps | Mesures | les deux |
| P-20 | Importé de Santé (Renpho) : 4 valeurs datées, note, absent sans import | BodyProgress | Corps | Santé | les deux |
| P-21 | Bilans VISBODY : liste, écart ou premier bilan, courbes | VisbodySection | Corps | VISBODY | les deux |
| P-22 | Saisie VISBODY (date, 6 champs, préremplissage, remplacement, champ vidé, erreurs) | VisbodySection | Corps | VISBODY | les deux |
| P-23 | Mesures segmentaires (repli de 10 champs) | VisbodySection | Corps | VISBODY | les deux |
| P-24 | Photos : mention de confidentialité et bouclier | BodyProgress | Corps | Photos | les deux |
| P-25 | Photos : ajout (40 Mo, messages) | BodyProgress | Corps | Photos | les deux |
| P-26 | Photos : liste, « pas sur cet appareil », « supprimée ailleurs », Comparer | BodyProgress | Corps | Photos | les deux |
| P-27 | Photos : suppression avec confirmation, Masquer, Réafficher ({count}) | BodyProgress | Corps | Photos | les deux |
| P-28 | Côte à côte (2 figures, image manquante, Fermer la comparaison) | BodyProgress | Corps | Photos | les deux |
| P-29 | États de Corps (chargement, échec, Réessayer) | BodyProgress | Corps | chaque sous-onglet | les deux |
| P-30 | Disposition PC en grille de 1, 2 ou 3 colonnes | BodyProgress.css | Corps | Mesures (D-719) | PC |
| P-31 | Cardio (4 semaines, séances, durée, distance, états) | CardioProgress | Activité | 1er bloc | les deux |
| P-32 | Objectifs (pas, zone 2, FC max, enregistrement, erreurs) | TrackingProgress | Activité | Suivis | les deux |
| P-33 | Pas par semaine (4 semaines, raison PC « reste sur l'iPhone ») | TrackingProgress | Activité | Suivis | les deux |
| P-34 | Cardio en zone 2 (règle, plage, 4 semaines, atteinte, sans FC, avertissement) | TrackingProgress | Activité | Suivis | les deux |
| P-35 | Notes du matin (30 jours) : Fatigue, Qualité du sommeil, résumé, courbe, vide, lecture impossible | TrackingProgress | Activité | Suivis, dernier sous-bloc (D-712) | les deux |
| P-36 | États de TrackingProgress (chargement, échec, Réessayer) | TrackingProgress | Activité | Suivis | les deux |
| P-37 | Échec de chargement d'un bloc (« Impossible d'afficher cet écran. », Réessayer, Recharger) | SectionNotice | chaque onglet | panneau entier (D-719) | les deux |
| P-38 | Ctrl+4 ouvre Progrès ; titre dans la barre du haut sur PC | navigation, AppShell | Progrès | hors onglets | PC |

## Écarts entre l'inventaire et la consigne, et ambiguïtés

1. **Notes du matin (30 jours)** (P-35) n'est pas cité par Ali ; il existe, donc il reste : Activité › Suivis, dernier sous-bloc, comme
   aujourd'hui (D-712).
2. **Plateformes** : la liste « Zones · dernière · 4 sem. » est sur PC seulement, la silhouette et les pastilles sur iPhone seulement.
   Chacune reste sur sa plateforme (D-719) : iPhone, silhouette et pastilles reliées (b) et silhouette colorée (c) ; PC, la liste garde
   son radiogroup et ses ↑↓ et porte la même tendance sur chaque ligne (marque colorée et mot), sans silhouette ajoutée. La couleur n'est
   jamais seule (§ 18.6).
3. **Saisie VISBODY** (P-22, P-23) : Ali cite « Bilans VISBODY, mesures segmentaires, courbes » ; la saisie, le préremplissage et le
   remplacement existent : ils restent dans le sous-onglet VISBODY.
4. **Photos** : Ali cite « ajout, masquer, Côte à côte, mention de confidentialité » ; la suppression avec confirmation, « Comparer »,
   « Réafficher les photos masquées » et le bouclier existent : ils restent dans Photos (P-24 à P-28).
5. **Constance** : Ali cite « série, calendrier du mois » ; la semaine en cours et la règle affichée restent (P-03).
6. **« Nouvel appui sur Progrès »** : lu comme un appui sur Progrès (barre du bas, barre latérale ou Ctrl+4) quand Progrès est déjà
   affiché ; revenir à Progrès depuis une autre section rend l'onglet retenu (D-719). Le sous-onglet de Corps suit la même règle.
7. **Courbe** : aujourd'hui les 12 dernières mesures ; avec la période, la courbe montre toutes les mesures de la période choisie, période
   par défaut 3 mois (la plus proche de l'actuel, D-718).
8. **Tour de taille de Santé** : il ne se mélange pas à la zone saisie ; superposé en pointillé seulement, hors tendance, ratios et
   symétrie (D-715).
9. **« Lu selon Q-23 »** : l'objectif du profil (`goal`) est lu en lecture seule (D-669) ; le sens favorable par zone et par objectif
   n'est pas dit par Ali : D-716.
10. **Rappel du matin** : heure non dite ; 09:00 comme le rappel des blessures (D-714). Le PC n'émet aucune notification (CLAUDE.md) :
    l'interrupteur du rappel n'est actif que sur l'iPhone ; le PC dit « le rappel est émis sur l'iPhone ».
11. **Rythme « réglable »** : choix offerts non dits ; chaque semaine, toutes les 2 semaines, toutes les 4 semaines (D-713).
12. **Repères des ratios** : point d'arrêt (D-717, comme D-678) ; aucune version ni aucun tag n'affiche un repère avant la D- d'Ali.
13. **Strength Score** : l'onglet Force reçoit le bloc tel que le livre BL-174 (lot 0.30.0) ; si BL-174 n'est pas fusionné, il reçoit le
    bloc actuel, sans changement de contenu par BL-177.

## Passe agent du module (product-owner, docs-writer)

Écrits : cette fiche ; D-700 à D-719 dans docs/decisions.md (à la suite de D-697) ; BL-177 à BL-181 dans
docs/backlog.md ; section « 0.30.1 (Progrès en onglets et Mensurations) » et 4 lignes de la table de contrôle (BL-177, BL-179, BL-180, D-703) dans docs/constats-ali.md ;
revue générée par `node scripts/release/prudent-review.mjs --write`. docs/reprise.md non touché (ticket de version).

## Estimation du lot 0.30.1 (par PR) et parallélisme

| PR | Registre | Module | Taille | Fichiers principaux | Dépend de |
| --- | --- | --- | --- | --- | --- |
| PROGRES-0301a | BL-177 | coquille, iOS et qualité (app-shell, accessibility-i18n) | M (≈ 150 k) | hôte de Progrès, navigation, composant d'onglets dans src/ui, liste figée P-01 à P-38, bundle | — |
| CORPS-0301b | BL-178 | nutrition et récupération (domain-logic) | M (≈ 100 k) | src/domain/bodyProgress (nouveaux modules purs), tests | — |
| CORPS-0301e | BL-181 | nutrition et récupération (product-owner) | S (≈ 40 k) | docs seulement : proposition des repères, question fermée | — |
| CORPS-0301c | BL-179 | nutrition et récupération (ui-design-system, accessibility-i18n) | L (≈ 350 k) | src/features/bodyProgress, fr.bodyProgress, tokens | a et b fusionnées ; repères affichés après la D- de e |
| CORPS-0301d | BL-180 | coquille, iOS et qualité (notifications, settings-personalization) | M (≈ 150 k) | définitions de settings, plan de notification, registre des familles, composant de réglage à part | b fusionnée ; montage dans Corps après c |

Parallèle : vague 1 = a, b et e (dossiers disjoints : coquille et hôte ; domaine pur ; documents). Vague 2 = c et d en parallèle : d ne
touche que le domaine des notifications, les settings et son propre composant ; le montage de ce composant dans Corps › Mesures (une
ligne) est fait par la PR fusionnée en second. Total ≈ 790 k tokens. Une compilation iPhone en fin de lot ; tag 0.30.1 après la D-
d'Ali sur les repères (D-717).

## Passe qa-test

Contrôles documentaires : voir la section « Résultats » (rempli après exécution). Aucun test de code : ticket sans code.

## Passe code-reviewer (relecture à froid)

Voir la section « Résultats ».

## Résultats

(complété après les contrôles et la relecture)
