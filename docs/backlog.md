# Registre des points en attente

Registre unique de ce qui reste à faire, à constater ou à trancher (décision d'Ali du 20/11/2026). Règle : chaque lot met ce
fichier à jour avant de se clore (lignes ajoutées, statuts changés, PR citée) ; un rapport de fin de lot renvoie ici pour « ce qui
reste » au lieu de le recopier. Une ligne par point ouvert ; ID existant quand il y en a un (C-xxx de l'audit Claude, A-xxx de l'audit
Codex, H-n, D-n, ticket), sinon BL-nnn. Statuts : « à faire (lot 0.28.0) », « lot prévu 0.29.0 », « reporté : motif », « fait (PR #n) ».
Dépôt public : aucune valeur réelle d'Ali (mesure, cible chiffrée, date de séance, contenu d'archive) n'est écrite ici.

## 1. Restes des lots 0.17 à 0.27

| ID | Origine | Description (une ligne) | Statut |
|---|---|---|---|
| CLEAN-03 | rapport de lot 0.27.0 (docs/reprise.md), docs/CLEAN-02.md | Migrer les tests de synchro hérités hors du banc legacy (222 fichiers, lots A à F, taille L, D-201) | à faire (lot 0.28.0) |
| BL-001 | rapport de lot 0.19 (docs/CLEAN-02.md) | Plugin vision et OCR natif conservés sans appelant (D-200) | reporté : gardés pour l'import de programme (I6-08) |
| BL-002 | rapport de lot 0.19 (docs/CLEAN-02.md) | CSP : `'wasm-unsafe-eval'` à retirer ou justifier (security-privacy, essai sur appareil) | à faire (lot 0.28.0) |
| BL-003 | rapport de lot 0.27.0 (docs/reprise.md) | Méthodes SQL de l'ancien schéma encore dans `SyncRepository` (banc legacy, D-67), à purger avec CLEAN-03 | à faire (lot 0.28.0) |
| BL-004 | rapport de lot 0.27.0 (docs/reprise.md) | Catalogues de textes hérités de CircleTasks à purger avec le banc legacy | à faire (lot 0.28.0) |
| BL-005 | rapport de lot 0.27.0 (docs/reprise.md) | Copie de conflit iCloud `state 2.spx` ignorée et signalée ; sa cause reste une hypothèse à établir | à faire (lot 0.28.0) |
| DEP-01 | rapport de lot 0.18.1 (docs/DEP-01.md) | Retirer `src-tauri/vendor/sqlx-sqlite` dès qu'un sqlx publié accepte libsqlite3-sys >= 0.39 (D-160) | reporté : attente d'une version publiée de sqlx |
| BL-006 | rapport de lot 0.26.0 (docs/reprise.md) | Worktree verrouillé `.codex-tmp/wt-STR-01` à supprimer | à faire (lot 0.28.0) |
| BL-007 | rapport de lot 0.25.0 (docs/LOT-0.25.0.md) | PR #127 (relecture Codex du 13/11) encore ouverte : à clore ou fusionner | à faire (lot 0.28.0) |
| M2 (ADR 0018) | rapport de lot 0.25.0 (docs/adr/0018) | Écrivain d'une ligne gardée déduit du plus grand hlc : message faux possible (older-device / received-unapplied) | à faire (lot 0.28.0) |
| M3 (ADR 0018) | rapport de lot 0.25.0 (docs/adr/0018) | Reprise depuis l'instantané gaspillée quand l'écrivain est vu à jour avant sa republication | à faire (lot 0.28.0) |
| M4 (ADR 0018) | rapport de lot 0.25.0 (docs/adr/0018) | Parties gardées par la 0.24.0 sans `sv` : comptées en received-unapplied, jamais en older-device | à faire (lot 0.28.0) |
| H-36 | rapport de lot 0.22.2 (docs/FIX-0221.md) | « Pris » depuis la notification, app en arrière-plan puis app tuée : constaté par Ali le 13/11 (D-318 (9)) | fait (DOC-PRIV, PR #156) |
| H-34 | rapport de lot 0.20 (docs/I6-05.md) | Rappels de compléments : retrait de la notification quand la prise est cochée sur l'autre appareil, non constaté | à faire (lot 0.28.0) |
| H-35 | rapport de lot 0.21.0 (docs/I6-06.md) | GPS au premier plan : distance après passage en arrière-plan, à constater (UNVERIFIED) | à faire (lot 0.28.0) |
| H-33 | rapport de lot 0.17 (docs/capability-matrix.md) | « Repartir de zéro » reçu par l’autre appareil par iCloud Drive : constaté par Ali le 19/11 (D-318 (8)) | fait (DOC-PRIV, PR #156) |
| H-32 | rapport de lot 0.17.1 (docs/FIX-0171.md) | privacy-shield de Progrès › Corps : aperçu du sélecteur d'apps opaque, à constater (UNVERIFIED) | à faire (lot 0.28.0) |
| H-9 | rapport de lot 0.26.0 (docs/MEDIA-02.md) | Médias d'exercices sous licence compatible : ligne de la matrice encore UNVERIFIED malgré D-71 | à faire (lot 0.28.0) |
| H-8 | rapport de lot 0.26.0 (docs/MEDIA-02.md) | Relire les 14 correspondances d'images (variantes proches) et le contenu de la bibliothèque | à faire (lot 0.28.0) |
| H-25 | rapport de lot 0.26.0 (docs/DOC-H21.md) | Format réel de `pas.csv` encore UNVERIFIED (D-293) | à faire (lot 0.28.0) |
| H-3a / H-3b | rapport de lot 0.27.0 (docs/reprise.md) | HealthKit direct BLOCKED (compte Apple gratuit) ; import par Raccourcis en place (D-69) | reporté : compte Apple gratuit |
| H-4 | rapport de lot 0.27.0 (docs/reprise.md) | Live Activity CONFIRMED avec deux défauts d'affichage restants (matrice) | à faire (lot 0.28.0) |
| BL-008 | rapport de lot 0.26.0 (docs/MEDIA-02.md) | 95 exercices sur 196 sans image, dont 8 de la routine en cours ; chercher d'autres sources à licence vérifiée | à faire (lot 0.28.0) |
| BL-009 | rapport de lot 0.26.0 (docs/MEDIA-02.md) | Lisibilité des images réduites (640 px, gris) en thèmes clair et sombre, à constater par Ali | à faire (lot 0.28.0) |
| BL-010 | rapport de lot 0.26.0 (docs/MEDIA-02.md) | Auteur par image non affiché : image de gainage reportée pour cette raison | à faire (lot 0.28.0) |
| BL-011 | rapport de lot 0.26.0 (docs/MEDIA-02.md) | `validateMediaFiles` n'impose pas originSha256, originBytes, transform à une source réduite ; CRC PNG non vérifié | à faire (lot 0.28.0) |
| BL-012 | rapport de lot 0.21 (docs/I6-07.md) | Image inversée en thème sombre : fond noir au lieu de la teinte de la carte, à constater par Ali | à faire (lot 0.28.0) |
| BL-013 | rapport de lot 0.26.0 (docs/PROG-03.md) | Glisser-déposer PC (WebView2) : lâcher sur un champ, Alt+↑/↓, annonce du Narrateur, à constater par Ali | à faire (lot 0.28.0) |
| BL-014 | rapport de lot 0.25.0 (docs/FIX-0241.md) | Séance active à la largeur d'usage du PC, hors test géométrique : à constater par Ali | à faire (lot 0.28.0) |
| BL-015 | rapport de lot 0.25.0 (docs/LOT-0.25.0.md) | Constats d'Ali : GPS, onboarding, « Pris » en erreur, écrans PC, bandeau « appareil plus ancien » | à faire (lot 0.28.0) |
| BL-016 | rapport de lot 0.26.0 (docs/LOT-0.26.0.md) | Constats d'Ali : Stratégie avec cible à venir, repère « Semaine n sur m », Strength Score (STR-01) | à faire (lot 0.28.0) |
| BL-017 | rapport de lot 0.27.0 (docs/LOT-0.27.0.md) | Après mise à jour : rattacher les jours de routine aux jours de la semaine, vérifier la cible du jour | à faire (lot 0.28.0) |
| BL-018 | rapport de lot 0.17.2 (docs/FIX-0172.md) | Constats d'Ali : journaux de recalcul, réveil avec long bloc « Au lit », relecture à 45 s, stades inconnus | à faire (lot 0.28.0) |
| BL-019 | rapport de lot 0.17.3 (docs/FIX-0173.md) | Constats d'Ali : « Salle complète », fibres Renpho effacées par un repas, colonne `unit` du CSV | à faire (lot 0.28.0) |
| BL-020 | rapport de lot 0.18 (docs/FIX-0181.md) | Constats d'Ali : favoris synchronisés entre appareils, journée rouge à −5 % arrondie au matériel | à faire (lot 0.28.0) |
| BL-021 | rapport de lot 0.21.0 (docs/I6-06.md) | Constats d'Ali : cardio saisi sur PC puis reçu, refus de la localisation, Exertion avec cardio | à faire (lot 0.28.0) |
| BL-022 | rapport de lot 0.17.1 (docs/FIX-0171.md) | Suggestions laissées : cible comparée au centième, confirmation groupée sur Résultat (D-124 (4)) | reporté : non bloquant, révisable par Ali |
| I6-09 | rapport de lot 0.21.0 (docs/I6-09.md) | GPS en arrière-plan ou écran verrouillé (`UIBackgroundModes`), tracé et rétention | reporté : décision d'Ali requise |
| I6-10 | rapport de lot 0.20 (docs/I6-10.md) | Verrou local de l'app, conditionnel à Q-6 et H-17 | reporté : décision d'Ali (Q-6) |
| FIX-0244 (reste) | rapport de lot 0.26.0 (docs/LOT-0.27.0.md) | Décision reçue par la synchro qui masque une cible future ; lecture des cibles futures hors transaction | fait (PR #150) |
| AUDIT-USAGE | rapport de lot 0.27.0 (docs/AUDIT-USAGE.md) | Sept écarts U-2, U-3, U-5, U-6, U-7, U-9, U-12 des parcours réels | fait (PR #150, #151, #152) |

## 2. Audit Claude 0.27.0

Source : branche `audit-claude-0.27.0` (PR brouillon #155), `docs/audit-claude-0.27.0/constats.md` et `rapport.md`. Ticket de tête
proposé par l'audit : FIX-ASSIST, FIX-ABERR, DOC-PRIV, FIX-CONFID-IOS, FIX-EXPORT, FIX-PLANCHER, FIX-SAISIE-NUTRI, FIX-RECUP,
FIX-PROGRAMME, FIX-COQUILLE (rapport.md, « Les 10 corrections à faire en premier »).

| ID | Origine | Description (une ligne) | Statut |
|---|---|---|---|
| C-001 | audit Claude 0.27.0 | bloquant — exercice assisté hors décharge : cran et réductions inversés (plus d'assistance proposée comme une hausse) | fait (FIX-ASSIST, PR à venir) |
| C-002 | audit Claude 0.27.0 | important — échauffement d'un exercice assisté plus dur que les séries de travail | fait (FIX-ASSIST, PR à venir) |
| C-003 | audit Claude 0.27.0 | important — « Mettre à jour la routine » double les séries d'un exercice présent sur deux lignes du jour | à faire (lot 0.28.0) |
| C-004 | audit Claude 0.27.0 | important — recalibrage « Facile » de deux crans en confiance provisoire (< 0,4 : au plus un cran) | à faire (lot 0.28.0) |
| C-005 | audit Claude 0.27.0 | bloquant — charge aberrante (faute de frappe) enregistrée sans alerte, puis prescrite à toute la séance suivante | fait (FIX-ABERR) |
| C-006 | audit Claude 0.27.0 | mineur — décharge « arrondie vers le bas » qui ajoute une répétition (snapToEquipment au lieu de snapDown) | à faire (lot 0.28.0) |
| C-007 | audit Claude 0.27.0 | mineur — grille de barre sans contrôle des disques réellement montables | à faire (lot 0.28.0) |
| C-008 | audit Claude 0.27.0 | important — distance GPS gonflée à l'arrêt | à faire (lot 0.28.0) |
| C-009 | audit Claude 0.27.0 | mineur — Recovery Split : seuil 50 % contre « ≥ 80 % » du § 12.1, commentaire faux | à faire (lot 0.28.0) |
| C-010 | audit Claude 0.27.0 | mineur — séries dégressives et partielles comptées dans l'écart de routine | à faire (lot 0.28.0) |
| C-011 | audit Claude 0.27.0 | mineur — tonnage et records d'un exercice assisté comptent l'assistance | fait (FIX-ASSIST, PR à venir) |
| C-012 | audit Claude 0.27.0 | mineur — durée estimée à 45 s par série quelle que soit la métrique (exercices chronométrés sous-estimés) | à faire (lot 0.28.0) |
| C-013 | audit Claude 0.27.0 | mineur — plages 5–10 / 8–15 du § 12.1.4 appliquées aux seules substitutions (à trancher, D-86) | à faire (lot 0.28.0) |
| C-014 | audit Claude 0.27.0 | mineur — replay : `doneAt` illisible, ordre indéfini au lieu de l'ordre par position | à faire (lot 0.28.0) |
| C-015 | audit Claude 0.27.0 | mineur — circuit : exercice compté membre du groupe par ses seules séries d'échauffement | à faire (lot 0.28.0) |
| C-016 | audit Claude 0.27.0 | amélioration — `isCompletedWorkSet` inutilisée hors tests, compte dégressives et partielles comme travail | à faire (lot 0.28.0) |
| C-017 | audit Claude 0.27.0 | mineur — dernier jour fait vidé : la rotation repart de l'avant-dernier (ambigu dans D-243) | à faire (lot 0.28.0) |
| C-018 | audit Claude 0.27.0 | à vérifier — `programDayFor` ignore la séance déjà close du jour (confirmé par C-063) | à faire (lot 0.28.0) |
| C-019 | audit Claude 0.27.0 | mineur — jour de la semaine non entier accepté ; « Lundi2 » rattaché au lundi (D-317) | à faire (lot 0.28.0) |
| C-020 | audit Claude 0.27.0 | important, à vérifier — « Semaine de reprise » préremplie par l'onboarding à chaque ouverture (voir C-064) | à faire (lot 0.28.0) |
| C-021 | audit Claude 0.27.0 | mineur — Recovery Split : arrondi avant la comparaison au seuil (49,6 % compté prêt) | à faire (lot 0.28.0) |
| C-022 | audit Claude 0.27.0 | mineur — GPS : premier point non contrôlé ; allure du dernier km figée au-delà de 10 000 points | à faire (lot 0.28.0) |
| C-023 | audit Claude 0.27.0 | mineur — Strength Score : à score égal, borne ignorée (« 99 » au lieu de « > 99 ») | à faire (lot 0.28.0) |
| C-024 | audit Claude 0.27.0 | à vérifier — tractions et dips : poids du corps ajouté à la charge saisie, double compte possible (voir C-071) | à faire (lot 0.28.0) |
| C-025 | audit Claude 0.27.0 | mineur — inactivité comptée en tranches de 24 h ; dates comparées comme chaînes ISO | à faire (lot 0.28.0) |
| C-026 | audit Claude 0.27.0 | à vérifier — décision datée après la dernière séance rendue sans contraintes (décharge, inactivité, journée rouge) | à faire (lot 0.28.0) |
| C-027 | audit Claude 0.27.0 | mineur — « Dur » bloque le cran mais pas l'échelle de répétitions (§ 11.2.5 ambigu) | à faire (lot 0.28.0) |
| C-028 | audit Claude 0.27.0 | mineur — aberrante : séances partielles et décharges comptées ; première séance jamais aberrante | fait (FIX-ABERR) |
| C-029 | audit Claude 0.27.0 | mineur — grille de charges : `stackMaxKg` NaN, une seule poulie retenue, matériel interdit non filtré | à faire (lot 0.28.0) |
| C-030 | audit Claude 0.27.0 | mineur — échauffement d'un exercice lesté calculé sur le lest seul | à faire (lot 0.28.0) |
| C-031 | audit Claude 0.27.0 | important — check-in à deux cibles : cible de repos sous le plancher, refus à « Accepter » | fait (FIX-PLANCHER) |
| C-032 | audit Claude 0.27.0 | important — correction des grammes d'une entrée : arrondis cumulés enregistrés | à faire (lot 0.28.0) |
| C-033 | audit Claude 0.27.0 | important — Open Food Facts : kcal pris tel quel même s'il contredit le kJ | à faire (lot 0.28.0) |
| C-034 | audit Claude 0.27.0 | important — Quick Add sans borne ni contrôle de cohérence des macros | à faire (lot 0.28.0) |
| C-035 | audit Claude 0.27.0 | mineur — rappel de complément perdu le jour du passage à l'heure d'été | à faire (lot 0.28.0) |
| C-036 | audit Claude 0.27.0 | important — lissage de la dépense sur 7 jours (§ 15.1) jamais appliqué | à faire (lot 0.28.0) |
| C-037 | audit Claude 0.27.0 | mineur — cible de repos : glucides ramenés à 0 sans recalcul des kcal ; floor contre round | à faire (lot 0.28.0) |
| C-038 | audit Claude 0.27.0 | à vérifier — premier check-in sans cible en cours : couverture non contrôlée (D-74) | à faire (lot 0.28.0) |
| C-039 | audit Claude 0.27.0 | mineur, à trancher — jour importé de Renpho jamais complet, exclu de la dépense mesurée (D-113) | à faire (lot 0.28.0) |
| C-040 | audit Claude 0.27.0 | mineur — horloge en avance : décision future qui passe devant une cible prévue ; HLC illisible mal classé | à faire (lot 0.28.0) |
| C-041 | audit Claude 0.27.0 | mineur — totaux du jour non arrondis (erreurs de virgule flottante) | à faire (lot 0.28.0) |
| C-042 | audit Claude 0.27.0 | à trancher — un aliment à lipides « traces » rend inconnus les lipides de toute la journée (D-75) | à faire (lot 0.28.0) |
| C-043 | audit Claude 0.27.0 | mineur — code à 8 chiffres toujours lu en EAN-8 ; format rapporté par le scanner non transmis | à faire (lot 0.28.0) |
| C-044 | audit Claude 0.27.0 | mineur — recette : `servings` à 0 donne Infinity ; recette vide acceptée avec une entrée toute nulle | à faire (lot 0.28.0) |
| C-045 | audit Claude 0.27.0 | mineur — UPC-A sur 12 chiffres non retrouvé dans le cache ; normalisation de « ß » fautive | à faire (lot 0.28.0) |
| C-046 | audit Claude 0.27.0 | mineur — `off.rs` : virgule de milliers lue comme décimale | à faire (lot 0.28.0) |
| C-047 | audit Claude 0.27.0 | amélioration — photo sans plafond de taille avant décodage ; fiche OFF périmée perdue sur « not-found » | à faire (lot 0.28.0) |
| C-048 | audit Claude 0.27.0 | mineur, à vérifier — « Pris » silencieux si l'heure a changé ; file d'actions tronquée qui recoche une prise | à faire (lot 0.28.0) |
| C-049 | audit Claude 0.27.0 | important — baseline : exclusion des aberrantes (> 2,5 σ) inopérante sur 7 ou 8 nuits | à faire (lot 0.28.0) |
| C-050 | audit Claude 0.27.0 | important — heure de coucher proposée avancée de 3 h par une nuit non valide | à faire (lot 0.28.0) |
| C-051 | audit Claude 0.27.0 | mineur — Exertion : une séance à date illisible fait planter le résumé du jour | à faire (lot 0.28.0) |
| C-052 | audit Claude 0.27.0 | important — `pas.csv` : totaux partiels qui écrasent les totaux complets | à faire (lot 0.28.0) |
| C-053 | audit Claude 0.27.0 | mineur — fuseau invalide : exception au lieu d'un rejet | à faire (lot 0.28.0) |
| C-054 | audit Claude 0.27.0 | mineur — pesée à 3e colonne vide rejetée au sélecteur, acceptée par le lecteur du dossier | à faire (lot 0.28.0) |
| C-055 | audit Claude 0.27.0 | mineur — deux pesées au même instant : la dernière ligne du fichier gagne | à faire (lot 0.28.0) |
| C-056 | audit Claude 0.27.0 | mineur, à vérifier — fichier Santé remplacé tronqué accepté (valeur coupée lue) | à faire (lot 0.28.0) |
| C-057 | audit Claude 0.27.0 | amélioration, à vérifier (H-25) — séparateur de milliers anglais lu comme décimale dans `pas.csv` | à faire (lot 0.28.0) |
| C-058 | audit Claude 0.27.0 | à trancher — jour d'une mesure calculé dans le fuseau actuel : glissement possible après un voyage | à faire (lot 0.28.0) |
| C-059 | audit Claude 0.27.0 | mineur — nuit du jour non soumise au seuil de 180 min pour le score | à faire (lot 0.28.0) |
| C-060 | audit Claude 0.27.0 | mineur — baseline à σ = 0 ou HRV absente classée niveau B (libellé seulement) | à faire (lot 0.28.0) |
| C-061 | audit Claude 0.27.0 | amélioration, à trancher — baseline sans limite de calendrier : ancienne baseline gardée en qualité « good » | à faire (lot 0.28.0) |
| C-062 | audit Claude 0.27.0 | à vérifier — récupération musculaire figée au calcul ; cardio importé non retiré (§ 16.3) ; rappel à heure inexistante | à faire (lot 0.28.0) |
| C-063 | audit Claude 0.27.0 | important — séance du jour proposée de nouveau après avoir été faite | à faire (lot 0.28.0) |
| C-064 | audit Claude 0.27.0 | important — semaine de reprise reconduite au 2e cycle dans un même montage | à faire (lot 0.28.0) |
| C-065 | audit Claude 0.27.0 | important — échanger deux jours de la semaine dans l'éditeur de routine échoue | à faire (lot 0.28.0) |
| C-066 | audit Claude 0.27.0 | important — profils de matériel : « 12,16 » lu comme un seul poids | à faire (lot 0.28.0) |
| C-067 | audit Claude 0.27.0 | important — suivi GPS en cours perdu (mémoire seule) et « Abandonner » sans confirmation | à faire (lot 0.28.0) |
| C-068 | audit Claude 0.27.0 | important — série supprimée sans confirmation ni annulation ; focus perdu après validation au clavier | à faire (lot 0.28.0) |
| C-069 | audit Claude 0.27.0 | important — « Accepter » peut écraser une série déjà validée | à faire (lot 0.28.0) |
| C-070 | audit Claude 0.27.0 | important — texte faux « Musculation seule, cardio non compté » | à faire (lot 0.28.0) |
| C-071 | audit Claude 0.27.0 | important — tractions et dips : champ « Charge (kg) » sans dire « lest » | à faire (lot 0.28.0) |
| C-072 | audit Claude 0.27.0 | important, à vérifier — correction d'une série validée sans trace (§ 13.4) ; charge vidée acceptée | à faire (lot 0.28.0) |
| C-073 | audit Claude 0.27.0 | important — brouillon de routine abandonné sans confirmation ; retraits de jour et d'exercice non confirmés | à faire (lot 0.28.0) |
| C-074 | audit Claude 0.27.0 | mineur — jour local lu au rendu, aucune relecture à minuit (séance de la veille proposée) | à faire (lot 0.28.0) |
| C-075 | audit Claude 0.27.0 | mineur — échec de lecture du profil : Aujourd'hui remplacé sans « Réessayer » ; carte Séance muette en échec | à faire (lot 0.28.0) |
| C-076 | audit Claude 0.27.0 | mineur — unités « min », « h » et séparateurs en dur hors i18n | à faire (lot 0.28.0) |
| C-077 | audit Claude 0.27.0 | mineur — double appui sur « Valider », « Ajouter une série » ou « Nouvelle routine » : doublons | à faire (lot 0.28.0) |
| C-078 | audit Claude 0.27.0 | mineur — saisie de série non validée perdue si la WebView est tuée ; report GPS qui écrase une saisie | à faire (lot 0.28.0) |
| C-079 | audit Claude 0.27.0 | mineur — erreurs des écrans d'entraînement non journalisées ou non rattrapées | à faire (lot 0.28.0) |
| C-080 | audit Claude 0.27.0 | mineur — lecture ancienne qui écrase la nouvelle (ExerciseProgression) ; écritures à chaque flèche | à faire (lot 0.28.0) |
| C-081 | audit Claude 0.27.0 | mineur — matériel : nombre de disques non modifiable, poids en double, suppression hors transaction | à faire (lot 0.28.0) |
| C-082 | audit Claude 0.27.0 | mineur — journal limité aux 50 dernières séances (les plus anciennes ni corrigeables ni supprimables) | à faire (lot 0.28.0) |
| C-083 | audit Claude 0.27.0 | à vérifier (appareil) — clavier numérique iOS sans « : » pour l'heure et la durée cardio ; H-35 | à faire (lot 0.28.0) |
| C-084 | audit Claude 0.27.0 | mineur — « 0 groupes » et vocabulaire incohérent (Variée, décharge, Ischios, nombres sans séparateur) | à faire (lot 0.28.0) |
| C-085 | audit Claude 0.27.0 | amélioration — catalogue `fr.routines` hérité au départ ; JSON servant à un seul test ; paramètres non typés | à faire (lot 0.28.0) |
| C-086 | audit Claude 0.27.0 | important — cible de repos sous le plancher : l'écran demande une confirmation qui n'existe pas | fait (FIX-PLANCHER) |
| C-087 | audit Claude 0.27.0 | important — cible confirmée sous 1 200 kcal : cible de repos impossible à ajouter ou retirer | fait (FIX-PLANCHER) |
| C-088 | audit Claude 0.27.0 | important — tableau de bord : un jour de repos compté sur la cible d'entraînement | fait (FIX-PLANCHER) |
| C-089 | audit Claude 0.27.0 | important, à vérifier — photos « supprimées sans retour possible » encore présentes dans les sauvegardes | fait (FIX-CONFID-IOS) |
| C-090 | audit Claude 0.27.0 | important — « +5 cm en 4 semaines » faux sur un historique espacé | à faire (lot 0.28.0) |
| C-091 | audit Claude 0.27.0 | important — compléments : changer une heure efface la constance passée | à faire (lot 0.28.0) |
| C-092 | audit Claude 0.27.0 | important — recherche : produit Open Food Facts masqué par la coupe à 50 résultats | à faire (lot 0.28.0) |
| C-093 | audit Claude 0.27.0 | mineur — tendance du poids : échelle étirée par une pesée aberrante | à faire (lot 0.28.0) |
| C-094 | audit Claude 0.27.0 | important — mesure corporelle supprimée d'un geste, sans confirmation ni annulation | à faire (lot 0.28.0) |
| C-095 | audit Claude 0.27.0 | important, à vérifier — virgule décimale dans les champs numériques de la nutrition (WebKit, WebView2) | à faire (lot 0.28.0) |
| C-096 | audit Claude 0.27.0 | important — journal ouvert après minuit : saisie rattachée à la veille | à faire (lot 0.28.0) |
| C-097 | audit Claude 0.27.0 | important — saisie enregistrée sur un autre jour que celui de l'ouverture | à faire (lot 0.28.0) |
| C-098 | audit Claude 0.27.0 | important — supprimer une autre entrée efface le formulaire en cours | à faire (lot 0.28.0) |
| C-099 | audit Claude 0.27.0 | mineur — déclaration de journée écrite à chaque flèche (« Complète » enregistrée par erreur) | à faire (lot 0.28.0) |
| C-100 | audit Claude 0.27.0 | mineur — prise issue d'un code scanné enregistrée en méthode « search » | à faire (lot 0.28.0) |
| C-101 | audit Claude 0.27.0 | mineur — erreurs masquées en recherche, journal et compléments (§ 18.3) | à faire (lot 0.28.0) |
| C-102 | audit Claude 0.27.0 | mineur — heure invalide signalée « quantité invalide » ; fiche OFF périmée sans avertissement ; Échap ferme tout | à faire (lot 0.28.0) |
| C-103 | audit Claude 0.27.0 | mineur — cocher puis décocher vite laisse coché ; « −200 » refusé sans message ; champ heure en 12 h | à faire (lot 0.28.0) |
| C-104 | audit Claude 0.27.0 | mineur — check-in : colonne « Actuel » déroutante ; historique sans « décidée le » ; préférences sans retour | à faire (lot 0.28.0) |
| C-105 | audit Claude 0.27.0 | mineur — « Taille » ambigu (tour ou hauteur) ; silhouette de Corps sans rôle ni clavier, zones trop petites | à faire (lot 0.28.0) |
| C-106 | audit Claude 0.27.0 | amélioration — anglicismes (Dashboard, loggé, Cache OFF) ; deux réglages « Objectif » ; catalogues hérités au départ | à faire (lot 0.28.0) |
| C-107 | audit Claude 0.27.0 | important — export simple : l'aide annonce profil, pesées et thème, l'archive contient toutes les données corporelles | fait (FIX-EXPORT) |
| C-108 | audit Claude 0.27.0 | important — « Repartir de zéro » : la liste effacée omet compléments, prises, cardio et tracés GPS | fait (FIX-EXPORT) |
| C-109 | audit Claude 0.27.0 | important — archive postérieure à « Repartir de zéro » qui ramène les données effacées | fait (FIX-EXPORT, D-334, horizon dans le manifeste) |
| C-110 | audit Claude 0.27.0 | important — textes qui conseillent de réinstaller l'app sur l'iPhone (perte de données) | fait (DOC-PRIV, PR #156) |
| C-111 | audit Claude 0.27.0 | important — anneau de focus sous 3:1 en thème sombre (thème par défaut) | à faire (lot 0.28.0) |
| C-112 | audit Claude 0.27.0 | mineur — contrastes de composants sous 3:1 (WCAG 1.4.11) | à faire (lot 0.28.0) |
| C-113 | audit Claude 0.27.0 | important — Dynamic Type « très grand texte » (§ 18.6) non branché sur iPhone | à faire (lot 0.28.0) |
| C-114 | audit Claude 0.27.0 | important — écran blanc définitif : aucune frontière d'erreur racine ni autour de « Démarrage bloqué » | à faire (lot 0.28.0) |
| C-115 | audit Claude 0.27.0 | important — chien de garde : « Réessayer » proposé pendant une migration lente | à faire (lot 0.28.0) |
| C-116 | audit Claude 0.27.0 | important — un bloc de signature illisible met toute l'app en erreur de démarrage | à faire (lot 0.28.0) |
| C-117 | audit Claude 0.27.0 | important — « Revoir mes réglages » écrase la durée de cycle choisie depuis (D-315) | à faire (lot 0.28.0) |
| C-118 | audit Claude 0.27.0 | important — oublier le dossier et la clé sans dire que les données iCloud deviendront illisibles | à faire (lot 0.28.0) |
| C-119 | audit Claude 0.27.0 | important, à vérifier — « À propos et licences » absent de Plus (§ 18.2) | à faire (lot 0.28.0) |
| C-120 | audit Claude 0.27.0 | mineur — toast « Annuler » mal annoncé, masqué par un message suivant sur iPhone | à faire (lot 0.28.0) |
| C-121 | audit Claude 0.27.0 | mineur — piège de focus perméable ; retour à un ouvreur démonté ; SegmentedControl sans arrêt de tabulation | à faire (lot 0.28.0) |
| C-122 | audit Claude 0.27.0 | mineur — clavier global : répétition et composition ignorées ; Ctrl+/ démonte l'onboarding en revue | à faire (lot 0.28.0) |
| C-123 | audit Claude 0.27.0 | mineur — capture globale des erreurs installée tard ; extrait de message gardé ; timeZoneWatcher silencieux | à faire (lot 0.28.0) |
| C-124 | audit Claude 0.27.0 | mineur — date de la barre PC figée la nuit ; état hérité (spaces, projects) jamais posé | à faire (lot 0.28.0) |
| C-125 | audit Claude 0.27.0 | mineur — objectif à rythme sans rythme ni poids : cible écrite à « maintien » sans le dire | à faire (lot 0.28.0) |
| C-126 | audit Claude 0.27.0 | mineur — alerte d'échec de mise à jour non fermable ; bandeau de signature retiré sur lecture en échec | à faire (lot 0.28.0) |
| C-127 | audit Claude 0.27.0 | mineur — « Remplacer » sans seconde confirmation ; thème importé non appliqué ; dates d'export en UTC | à faire (lot 0.28.0) |
| C-128 | audit Claude 0.27.0 | mineur, à vérifier — import corps et nutrition : un refus annule toute la transaction à chaque import | à faire (lot 0.28.0) |
| C-129 | audit Claude 0.27.0 | mineur — promesses sans catch (notifications de récupération, synchro) ; « en cours » annoncé trop tôt | à faire (lot 0.28.0) |
| C-130 | audit Claude 0.27.0 | mineur — réinitialisation sans rechargement si `syncNow` ne répond pas ; aucune sauvegarde après effacement | à faire (lot 0.28.0) |
| C-131 | audit Claude 0.27.0 | mineur — format 12 h encore proposé ; boîtes natives au vouvoiement ; « Logs » et « Journaux » mêlés | à faire (lot 0.28.0) |
| C-132 | audit Claude 0.27.0 | amélioration — 927 clés sur 1 715 de `fr.ts` jamais lues ; catalogues morts dans `start-modules.json` | à faire (lot 0.28.0) |
| C-133 | audit Claude 0.27.0 | amélioration — code mort hérité (csvImport, taskRules, planNotifications…) sans import de production | à faire (lot 0.28.0) |
| C-134 | audit Claude 0.27.0 | à vérifier (D-36) — « code absent des captures d'écran » sans ligne UNVERIFIED ; couleurs d'appairage mal justifiées | à faire (lot 0.28.0) |
| C-135 | audit Claude 0.27.0 | amélioration — PRD : rupture 1 024 contre 900 px, Ctrl+K absent sans décision ; commentaires faux | à faire (lot 0.28.0) |
| C-136 | audit Claude 0.27.0 | important — export importable seulement sous 2 Mo | fait (FIX-EXPORT) ; mesure d’une base synthétique de 12 mois à faire |
| C-137 | audit Claude 0.27.0 | important — la rotation peut supprimer la sauvegarde qu'elle vient de créer | à faire (lot 0.28.0) |
| C-138 | audit Claude 0.27.0 | important — aucune exclusion mutuelle entre restaurations, sauvegardes et mise de côté | à faire (lot 0.28.0) |
| C-139 | audit Claude 0.27.0 | important — double « Quitter » coupe l'attente du front ; icône de zone de notification en échec = plantage | à faire (lot 0.28.0) |
| C-140 | audit Claude 0.27.0 | important — journal technique saturable et sans filtre de donnée corporelle côté Rust | fait (FIX-CONFID-IOS) |
| C-141 | audit Claude 0.27.0 | important — commandes OCR et dictée exposées sans aucun usage | à faire (lot 0.28.0) |
| C-142 | audit Claude 0.27.0 | à vérifier — `vault_ios.rs` : course sur le cache de la clé (dépend de la sérialisation par SyncCore) | à faire (lot 0.28.0) |
| C-143 | audit Claude 0.27.0 | mineur — marqueur de démarrage illisible traité comme absent ; marqueur définitif écrit sans vérifier le jeton | à faire (lot 0.28.0) |
| C-144 | audit Claude 0.27.0 | mineur — `db_diagnostics` renvoie des chemins absolus (ADR 0009) ; dates de sauvegarde mal validées | à faire (lot 0.28.0) |
| C-145 | audit Claude 0.27.0 | mineur — export : lecteur réseau accepté, temporaire au-delà de 255 caractères, repli JSON avant plafond | à faire (lot 0.28.0) |
| C-146 | audit Claude 0.27.0 | mineur — libellés du plateau et date de fin de Live Activity non bornés ; WM_ENDSESSION non traité | à faire (lot 0.28.0) |
| C-147 | audit Claude 0.27.0 | mineur — journal iOS dans Documents/Journal, visible dans Fichiers et inclus dans la sauvegarde iCloud | fait (FIX-CONFID-IOS) |
| C-148 | audit Claude 0.27.0 | amélioration — copies de la clé en String non effacées ; texte d'erreur WinRT renvoyé ; code mort | à faire (lot 0.28.0) |
| C-149 | audit Claude 0.27.0 | amélioration — description de l'installeur et du binaire héritée de CircleTasks ; capabilities mal décrites | à faire (lot 0.28.0) |
| C-150 | audit Claude 0.27.0 | amélioration — `read_summary` compte la table task ; pas de fsync de dossier ni de secure_delete | à faire (lot 0.28.0) |
| C-151 | audit Claude 0.27.0 | important — journal technique : valeurs corporelles non masquées | fait (FIX-CONFID-IOS) |
| C-152 | audit Claude 0.27.0 | important, à vérifier sur l'appareil — base, photos et journal dans la sauvegarde iCloud de l'iPhone | fait (FIX-CONFID-IOS) ; constat d’Ali à faire (H-38) |
| C-153 | audit Claude 0.27.0 | important — folder-bookmark : un accès de sécurité de plus à chaque cycle de synchro | à faire (lot 0.28.0) |
| C-154 | audit Claude 0.27.0 | important, à vérifier (D-26) — écriture iCloud sur un fichier évincé | à faire (lot 0.28.0) |
| C-155 | audit Claude 0.27.0 | mineur — retour de fsync du dossier ignoré ; `download` qui dort jusqu'à 60 s sur la file série | à faire (lot 0.28.0) |
| C-156 | audit Claude 0.27.0 | mineur — Live Activity : deux démarrages rapprochés, libellé ancien, « Terminé » en dur ; lastError sans verrou | à faire (lot 0.28.0) |
| C-157 | audit Claude 0.27.0 | mineur — fichier d'actions de notification écrit sur le fil principal | à faire (lot 0.28.0) |
| C-158 | audit Claude 0.27.0 | mineur — textes d'usage Info.plist hérités (tâches) ; caméra sans scan alimentaire ; entitlements contre § 19.4 | à faire (lot 0.28.0) |
| C-159 | audit Claude 0.27.0 | mineur — privacy-shield posé après willResignActive (H-32) ; Vision « occupé » à vie | à faire (lot 0.28.0) |
| C-160 | audit Claude 0.27.0 | mineur — scripts iOS : entitlements en liste noire ; contrôles codesign rendus silencieux par `\|\| true` | à faire (lot 0.28.0) |
| C-161 | audit Claude 0.27.0 | amélioration — `prepare-a9.mjs` inexécutable et dangereux (même bundle id que l'app réelle) | à faire (lot 0.28.0) |
| C-162 | audit Claude 0.27.0 | mineur — façades : message brut en console ; import en échec gardé à vie (plus de fin de repos notifiée) | à faire (lot 0.28.0) |
| C-163 | audit Claude 0.27.0 | mineur — OS « other » si l'agent utilisateur est inconnu : synchro et sauvegardes masquées sans erreur | à faire (lot 0.28.0) |
| C-164 | audit Claude 0.27.0 | amélioration — setters de faux exportés sans garde DEV ; `plugins/README.md` incomplet | à faire (lot 0.28.0) |
| C-165 | audit Claude 0.27.0 | bloquant — donnée de sommeil publiée dans le dépôt public (docs et fixture de sommeil) | fait (DOC-PRIV, PR #156 ; historique : HIST-01) |
| C-166 | audit Claude 0.27.0 | important — actions GitHub non figées par SHA dans build-ios.yml et build-windows.yml | à faire (lot 0.28.0) |
| C-167 | audit Claude 0.27.0 | mineur — budgets de performance de Spartiate peu gardés par des tests (perf sur code hérité) | à faire (lot 0.28.0) |
| C-168 | audit Claude 0.27.0 | important — tests qui figent des défauts établis par l'audit (C-005, C-007, C-009…) | à faire (lot 0.28.0) |
| C-169 | audit Claude 0.27.0 | important — règles majeures sans test (assisté, deux lignes, provisoire, fixture nominale du § 11.6) | à faire (lot 0.28.0) |
| C-170 | audit Claude 0.27.0 | important — seuil de couverture training ≥ 90 % (§ 11.6) absent de `vitest.config.ts` | à faire (lot 0.28.0) |
| C-171 | audit Claude 0.27.0 | important — test FIX-0272 sans portée : il passe même sans la garde de démontage | à faire (lot 0.28.0) |
| C-172 | audit Claude 0.27.0 | important — signature sur le runner de `npm ci` ; publication d'un tag sans contrôle de la suite verte | à faire (lot 0.28.0) |
| C-173 | audit Claude 0.27.0 | important (documentaire) — CI sur main et PR seulement, contre « à chaque push de branche » | à faire (lot 0.28.0) |
| C-174 | audit Claude 0.27.0 | mineur — `needs` de « suite verte » non vérifié ; contrôles `\|\| true` ; pipe sans pipefail | à faire (lot 0.28.0) |
| C-175 | audit Claude 0.27.0 | mineur — cache cargo écrit sur tag, persist-credentials, artefacts sans rétention, pas de `npm audit` | à faire (lot 0.28.0) |
| C-176 | audit Claude 0.27.0 | mineur — tests qui se recalculent avec le code ; bornes lâches au lieu de valeurs exactes | à faire (lot 0.28.0) |
| C-177 | audit Claude 0.27.0 | mineur — propriété du plafond auto-référente ; générateur sans assisté, poids de corps ni décharge | à faire (lot 0.28.0) |
| C-178 | audit Claude 0.27.0 | mineur — TZ non fixé (tests dépendants du fuseau) ; compteurs d'identifiants partagés entre tests | à faire (lot 0.28.0) |
| C-179 | audit Claude 0.27.0 | amélioration — baisse du nombre de tests non bloquante ; `publish` ne revérifie pas la signature | à faire (lot 0.28.0) |
| C-180 | audit Claude 0.27.0 | mineur — licences : images dites « non modifiées » ; réponses FitnessVolt sans empreinte ; droit à vérifier | à faire (lot 0.28.0) |
| C-181 | audit Claude 0.27.0 | important — guides d'installation : consignes dangereuses (supprimer une app, effacer le dossier de données) | fait (DOC-PRIV, PR #156) |
| C-182 | audit Claude 0.27.0 | important — guides d'installation écrits pour CircleTasks | fait (DOC-PRIV, PR #156) |
| C-183 | audit Claude 0.27.0 | important — matrice : CONFIRMED incomplets ou contredits (H-34, H-36), capacités sans ligne | à faire (lot 0.28.0) |
| C-184 | audit Claude 0.27.0 | mineur — matrice : H-7 et H-5 sans version ou appareil ; en-têtes et renvois périmés | à faire (lot 0.28.0) |
| C-185 | audit Claude 0.27.0 | mineur — docs/reprise.md : « en publication » périmé, étape 2 manquante, branches et audit non mentionnés | à faire (lot 0.28.0) |
| C-186 | audit Claude 0.27.0 | mineur — CHANGELOG 0.27.0 : rattachement à l'import et jour du check-in décrits à tort | à faire (lot 0.28.0) |
| C-187 | audit Claude 0.27.0 | mineur — guide Santé « Plus → Logs » ; licences.md et install-pc.md périmés | à faire (lot 0.28.0) |
| C-188 | audit Claude 0.27.0 | mineur — PRD contradictoire : 1 024 / 900 px, Ctrl+K, Recovery Split, HealthKit, CI à chaque push | à faire (lot 0.28.0) |
| C-189 | audit Claude 0.27.0 | important — progression au poids du corps et chronométrée absente ; retour à une prescription antérieure absent | à faire (lot 0.28.0) |
| C-190 | audit Claude 0.27.0 | important — séance active incomplète : vignettes, sauter, remplacer, Failure, fatigue, disques, pause | à faire (lot 0.28.0) |
| C-191 | audit Claude 0.27.0 | important — Progrès incomplet : zone cible, tendances 30 j, volume par muscle, streak, records en séance | à faire (lot 0.28.0) |
| C-192 | audit Claude 0.27.0 | mineur — coquille PC : barre non rétractable, ni clic droit ni double-clic, pas de badge ; signature sans lien | à faire (lot 0.28.0) |
| C-193 | audit Claude 0.27.0 | important — couverture e2e et visuelle en deçà des § 23.1 et 18.3 (séance au clavier, journal, export) | à faire (lot 0.28.0) |
| C-194 | audit Claude 0.27.0 | mineur — divers PRD : imputation, assiette, notification de check-in, contrôle ITSApp…, synchronous NORMAL | à faire (lot 0.28.0) |
| BL-090 | rapport FIX-ASSIST (lot 0.28.0) | historique (`HistoryView`) : un assisté personnalisé (machine assistée) n'est pas exclu comme l'assisté du catalogue | à faire (lot 0.28.0) |
| BL-091 | rapport FIX-ASSIST (lot 0.28.0) | alerte secondaire d'inactivité : affiche « −x % » pour un exercice assisté dont l'assistance est maintenue | à faire (lot 0.28.0) |
| BL-092 | rapport FIX-ABERR (lot 0.28.0) | résumé de fin : séance passée datée par la dernière série et non par `ended_at` ; décharges comptées pour confirmer une aberrante (écart à D-323 (2)) | à faire (lot 0.28.0) |
| BL-093 | relecture sync-icloud de FIX-A008 (lot 0.28.0) | test sur base migrée : ROLLBACK rejeté puis arrêt, curseur, `sync_field_clock` et `sync_outbox` inchangés ; garde orpheline vue par `assertGuardEmpty` | à faire (lot 0.28.0) |
| BL-094 | relecture sync-icloud de FIX-A008 (lot 0.28.0) | `bootstrap.ts` ~300 : échec de `assertGuardEmpty` avalé (`.catch(() => 0)`) : garde orpheline durable possible, à mettre en échec fermé | à faire (lot 0.28.0) |
| BL-095 | relecture code-reviewer de FIX-A008 (lot 0.28.0) | `serializedDriver.ts` ~155 : BEGIN IMMEDIATE exécuté puis rejeté par le transport, transaction ouverte à l’insu du pilote (même classe que A-008) | à faire (lot 0.28.0) |
| FIX-A009b | relecture sync-icloud de FIX-A009 (lot 0.28.0) | bloquant (perte) — réintégration : champ gardé comparé à l'horloge `'*'` de la ligne ; jour renommé avant lecture → jour de la semaine perdu | fait (FIX-A009b) |
| BL-097 | rapport FIX-A009b (lot 0.28.0) | limite : colonne connue écrite nulle avec la ligne face à une valeur gardée plus ancienne non nulle (divergence possible, non atteignable aujourd'hui) ; correction complète = migration de `sync_unknown` ; déclencheur : tout ticket qui élargit une contrainte d’une colonne publiée (data-model, architect) | reporté : non atteignable avec le catalogue actuel (avenant 39) |
| BL-098 | relecture architecte de FIX-A009b (lot 0.28.0) | garde « colonne publiée ajoutée nulle » sur base vide : ajouter une ligne avant chaque migration pour attraper un remplissage par UPDATE | à faire (lot 0.28.0) |
| BL-099 | relecture architecte de FIX-A009b (lot 0.28.0) | réintégration : exclure aussi une ligne créée ici et non publiée (file d’envoi sur `*`), à soumettre à sync-icloud | à faire (lot 0.28.0) |
| BL-100 | revue FIX-EXPORT | mineur — test C-108 : comparer la liste `WIPED` de `ResetDataScreen.tsx` (et non les clés du catalogue) à `RESET_TABLES`, mots clés de tables plus précis, commentaire du cas « horizon local illisible » | reporté (S) |
| BL-096 | rapport FIX-A009 (lot 0.28.0) | `replaceFromSnapshot` ne garde pas une clé de réglage inconnue (aucun réglage publié aujourd'hui : sans effet) | reporté : sans effet tant qu'aucun réglage n'est publié |

## 3. Audit Codex 0.26.0

Source : branche `audit-0.26.0` (PR brouillon #148), `docs/audit-0.26.0/bloquants.md`, `partie-00.md` à `partie-03.md`, `rapport.md`.

| ID | Origine | Description (une ligne) | Statut |
|---|---|---|---|
| A-001 | audit Codex 0.26.0 | important — `npm audit` complet : 11 paquets de développement signalés (undici, zod élevés ; minimatch) | à faire (lot 0.28.0) |
| A-002 | audit Codex 0.26.0 | mineur — couleurs hors tokens (Sheet, ConfirmDialog, appairage iPhone) | fait (PR #153) |
| A-003 | audit Codex 0.26.0 | mineur — docs/licences.md sans react-dom ni zustand | fait (PR #153) |
| A-004 | audit Codex 0.26.0 | important — reste : 13 délais de 5 s, 7 attentes DOM, 3 tests liés par une référence nulle (rejets corrigés) | à faire (lot 0.28.0) |
| A-005 | audit Codex 0.26.0 | amélioration — huit avertissements cargo autorisés (tokio, rustix), rsa hors graphe : actualiser | à faire (lot 0.28.0) |
| A-006 | audit Codex 0.26.0 | mineur — test chronométré de checklist dans `npm run test` | fait (PR #153) |
| A-007 | audit Codex 0.26.0 | mineur — import Tauri dynamique hors façade dans `theme.ts`, garde ESLint aveugle à la forme dynamique | fait (PR #153) |
| A-008 | audit Codex 0.26.0 | bloquant — rollback en échec : écriture suivante acquittée puis perdue à la réouverture (`serializedDriver.ts`) | fait (FIX-A008) |
| A-009 | audit Codex 0.26.0 | bloquant — instantané : colonne nouvelle d'une table connue perdue par l'appareil ancien (dont `routine_day.weekday`) | fait (FIX-A009) |
| BL-030 | audit Codex 0.26.0 (partie 1) | piste — `bootstrap.ts` : réintégration en échec gardée au journal seul ; double panne de persistance à vérifier | à faire (lot 0.28.0) |
| BL-031 | audit Codex 0.26.0 (partie 1) | piste — `bootstrap.ts` : erreur de `assertGuardEmpty` transformée en zéro | à faire (lot 0.28.0) |
| BL-032 | audit Codex 0.26.0 (partie 1) | piste — `timeZoneWatcher.ts` absorbe les erreurs de réglage (rejoint C-123) | à faire (lot 0.28.0) |
| BL-033 | audit Codex 0.26.0 (partie 1) | piste — premier rendu du thème « système » : `index.html` impose `data-theme="dark"` | à faire (lot 0.28.0) |
| BL-034 | audit Codex 0.26.0 (partie 1) | piste — rejets de chargement des notifications et de l'import récupération limités au journal | à faire (lot 0.28.0) |
| BL-035 | audit Codex 0.26.0 (partie 1) | piste — cycle statique hérité goalRules → week → todayList, à purger avec CLEAN-03 | à faire (lot 0.28.0) |
| BL-036 | audit Codex 0.26.0 (partie 1) | piste — `preloadScreens` n'attend pas la fin d'un import avant de programmer le suivant | à faire (lot 0.28.0) |
| BL-037 | audit Codex 0.26.0 (partie 2) | piste — parseurs d'exercices et de matériel qui rendent une liste vide, compléments illisibles filtrés : risque de réécriture | à faire (lot 0.28.0) |
| BL-038 | audit Codex 0.26.0 (partie 3) | piste — publication : ajout natif réussi puis retrait local en échec, le catch efface l'intention | à faire (lot 0.28.0) |
| BL-039 | audit Codex 0.26.0 (partie 3) | piste — heure du dernier cycle qui avance sans `allRead` : texte et avertissements à examiner | à faire (lot 0.28.0) |
| BL-040 | audit Codex 0.26.0 (partie 3) | piste — purge au plafond des champs inconnus signalée au seul journal technique | à faire (lot 0.28.0) |
| BL-041 | audit Codex 0.26.0 (partie 3) | piste — filtration par horizon à vérifier lors de la conservation et de la réintégration des champs inconnus | à faire (lot 0.28.0) |
| BL-042 | audit Codex 0.26.0 (partie 0) | piste — code mort candidat : 31 fichiers non atteints, 48 morts, 1 172 exports inutilisés (rejoint C-133) | à faire (lot 0.28.0) |
| BL-043 | audit Codex 0.26.0 (partie 0) | piste — présence des avis de licence (MPL-2.0, avis composites) dans les binaires livrés à vérifier | à faire (lot 0.28.0) |
| BL-044 | audit Codex 0.26.0 (partie 0) | piste — 16 skip conditionnels et 106 délais de tests à relire ; couverture par module à établir | à faire (lot 0.28.0) |
| BL-045 | audit Codex 0.26.0 (rapport) | Audit incomplet (environ 5 % des fichiers relus) : parties 4 à 11 non faites | reporté : audit Codex en cours (PR #148) |

## 4. Exigences du PRD non faites

Source : `docs/audit-claude-0.27.0/tracabilite.md` (branche `audit-claude-0.27.0`), exigences « partiel » ou « absent » seulement.
§ 17.3 (bilans) et § 17.4 (import de programme) sont en section 5. Lettre ajoutée quand un même § porte plusieurs exigences.

| ID | Origine | Description (une ligne) | Statut |
|---|---|---|---|
| § 8 I1 | PRD § 8 | partiel — « 2 semaines d'usage réel » pas encore atteint (usage depuis le 16/11, D-292) | reporté : durée d'usage non atteinte |
| § 8 I2 | PRD § 8 | absent — adhérence ≥ 70 % sur 2 semaines : aucune mesure | à faire (lot 0.28.0) |
| § 8 I3 | PRD § 8 | partiel — aucun exercice impossible, décharge non destructive (C-001, C-007) | à faire (lot 0.28.0) |
| § 8 I6 | PRD § 8 | partiel — confort : App Intents et import de programme absents | à faire (lot 0.28.0) |
| § 9.2 | PRD § 9.2 | absent — e2e « séance iPhone → PC → édition PC → iPhone » | à faire (lot 0.28.0) |
| § 10 | PRD § 10 | absent — unités configurables (kg seul) | à faire (lot 0.28.0) |
| § 10.0 | PRD § 10.0 | partiel — scénario d'onboarding rejoué : étape 6 sans e2e | à faire (lot 0.28.0) |
| § 10.1-1 | PRD § 10.1 | partiel — poids prérempli depuis Santé : par Raccourcis seulement (D-69) | reporté : HealthKit direct BLOCKED (H-3a) |
| § 10.2 | PRD § 10.2 | absent — blessures avec check-in bimensuel | à faire (lot 0.28.0) |
| § 10.3 | PRD § 10.3 | partiel — notifications demandées au premier repos, pas en fin de première séance | à faire (lot 0.28.0) |
| § 11 | PRD § 11 | partiel — constantes ajustables par exercice : seul `deloadLoad` | à faire (lot 0.28.0) |
| § 11.2-5 | PRD § 11.2 | partiel — difficulté, recalibrage « Facile » borné (C-004, C-027) | à faire (lot 0.28.0) |
| § 11.2-6 | PRD § 11.2 | partiel — contraintes « maintien ou réduction seulement » (C-001) | à faire (lot 0.28.0) |
| § 11.2-7 | PRD § 11.2 | partiel — arrondi au matériel (C-006, C-007, C-029) | à faire (lot 0.28.0) |
| § 11.3 a | PRD § 11.3 | partiel — machines : 1RM par profil de salle (D-86, constat 5 reporté) | à faire (lot 0.28.0) |
| § 11.3 b | PRD § 11.3 | absent — poids de corps (répétitions puis lest) et exercices chronométrés (C-189) | à faire (lot 0.28.0) |
| § 11.5 a | PRD § 11.5 | absent — aberrantes signalées avant enregistrement (C-005) | à faire (lot 0.28.0) |
| § 11.5 b | PRD § 11.5 | absent — retour à une prescription antérieure (C-189) | à faire (lot 0.28.0) |
| § 11.6 a | PRD § 11.6 | partiel — fixtures et propriétés : nominal 8 séances, changement de salle absents (C-169) | à faire (lot 0.28.0) |
| § 11.6 b | PRD § 11.6 | absent — couverture training ≥ 90 % (C-170) | à faire (lot 0.28.0) |
| § 12.1-1 | PRD § 12.1 | partiel — Recovery Split ≥ 80 % (C-009 : 50 %) | à faire (lot 0.28.0) |
| § 12.1-4 | PRD § 12.1 | partiel — budget de 45 s, plages 5–10 / 8–15 (C-012, C-013) | à faire (lot 0.28.0) |
| § 12.3 | PRD § 12.3 | partiel — modes Guidé / Libre / Maison : Variable, Fixe, Statique sans effet (D-73 (1)) | à faire (lot 0.28.0) |
| § 12.4 | PRD § 12.4 | partiel — changement de salle sans perte (D-86, C-169) | à faire (lot 0.28.0) |
| § 13.2 a | PRD § 13.2 | partiel — chrono, terminer, abandonner : pas de pause de séance | à faire (lot 0.28.0) |
| § 13.2 b | PRD § 13.2 | absent — vignettes réordonnables, « sauter » (C-190) | à faire (lot 0.28.0) |
| § 13.2 c | PRD § 13.2 | absent — remplacer, « ne plus proposer », image, notes (C-190) | à faire (lot 0.28.0) |
| § 13.2 d | PRD § 13.2 | absent — type de série Failure (C-190) | à faire (lot 0.28.0) |
| § 13.2 e | PRD § 13.2 | absent — calculateur de disques (reporté en I2-01, jamais livré) | à faire (lot 0.28.0) |
| § 13.2 f | PRD § 13.2 | absent — fatigue déclarée (C-190) | à faire (lot 0.28.0) |
| § 13.3 a | PRD § 13.3 | absent — Live Activity étendue (suivant, +30 s, passer) (C-190) | à faire (lot 0.28.0) |
| § 13.3 b | PRD § 13.3 | partiel — notification de repli sans action « +30 s » | à faire (lot 0.28.0) |
| § 13.4 | PRD § 13.4 | partiel — correction d'une série validée non tracée (C-072) | à faire (lot 0.28.0) |
| § 13.5 a | PRD § 13.5 | absent — résumé : écart et prochaine séance (C-190) | à faire (lot 0.28.0) |
| § 13.5 b | PRD § 13.5 | absent — image partageable du résumé (C-190) | à faire (lot 0.28.0) |
| § 13.7 | PRD § 13.7 | partiel — test du minuteur après verrouillage | à faire (lot 0.28.0) |
| § 13.8 a | PRD § 13.8 | partiel — échauffement (C-002, C-030) | à faire (lot 0.28.0) |
| § 13.8 b | PRD § 13.8 | partiel — « Mettre à jour la routine ? » (C-003, C-010) | à faire (lot 0.28.0) |
| § 13.8 c | PRD § 13.8 | partiel — historique éditable et recalcul (C-072, C-082) | à faire (lot 0.28.0) |
| § 14.2 a | PRD § 14.2 | partiel — graphique d'exercice : tracé SVG décoratif au lieu de Recharts (C-191) | à faire (lot 0.28.0) |
| § 14.2 b | PRD § 14.2 | absent — filtres par carte du corps et par schéma de mouvement | à faire (lot 0.28.0) |
| § 14.3 a | PRD § 14.3 | partiel — inventaire complet du matériel (C-066, C-081) | à faire (lot 0.28.0) |
| § 14.3 b | PRD § 14.3 | partiel — matériel forcé ou interdit (C-029) | à faire (lot 0.28.0) |
| § 14.3 c | PRD § 14.3 | partiel — machines : 1RM par profil (D-86, constat 5) | à faire (lot 0.28.0) |
| § 15.1 a | PRD § 15.1 | absent — lissage EMA de 7 jours de la dépense (C-036) | à faire (lot 0.28.0) |
| § 15.1 b | PRD § 15.1 | absent — imputation des jours non saisis affichée avec incertitude (C-194) | à faire (lot 0.28.0) |
| § 15.2 a | PRD § 15.2 | partiel — check-in accepter / refuser / personnaliser (C-031, C-086) | à faire (lot 0.28.0) |
| § 15.2 b | PRD § 15.2 | partiel — bornes 1 200 / 800, perte 1 %, alerte 25 % (C-031, C-087) | à faire (lot 0.28.0) |
| § 15.3 a | PRD § 15.3 | partiel — recherche : récents, favoris, provenances ; « go-tos » absents (C-092, C-100) | à faire (lot 0.28.0) |
| § 15.3 b | PRD § 15.3 | absent — assiette (C-194) | à faire (lot 0.28.0) |
| § 15.5 | PRD § 15.5 | partiel — tableau de bord (C-088) | à faire (lot 0.28.0) |
| § 16.1 C | PRD § 16.1 | partiel — niveau C : zone cible jamais affichée (C-191) | à faire (lot 0.28.0) |
| § 16.3 a | PRD § 16.3 | partiel — baseline 14 nuits, 7 minimum, > 2,5 σ (C-049, C-061) | à faire (lot 0.28.0) |
| § 16.3 b | PRD § 16.3 | partiel — Exertion par zones FC remplacée par minutes × ressenti (D-88, D-220) | reporté : zones FC sans HealthKit direct (D-69) |
| § 16.3 c | PRD § 16.3 | partiel — zone cible ≥ 66 / 34–65 / ≤ 33 calculée et stockée, non affichée (C-191) | à faire (lot 0.28.0) |
| § 16.3 d | PRD § 16.3 | partiel — récupération par muscle : cardio importé non retiré (C-062) | à faire (lot 0.28.0) |
| § 16.4 | PRD § 16.4 | partiel — Recovery Split et modulation (C-009) | à faire (lot 0.28.0) |
| § 16.7 | PRD § 16.7 | partiel — heure de coucher et rappel 30 min avant (C-050) | à faire (lot 0.28.0) |
| § 17.1 a | PRD § 17.1 | partiel — records au résumé seulement, aucune notification en séance (C-191) | à faire (lot 0.28.0) |
| § 17.1 b | PRD § 17.1 | absent — volume par muscle et par semaine (C-191) | à faire (lot 0.28.0) |
| § 17.1 c | PRD § 17.1 | partiel — constance : streak et calendrier absents (C-191) | à faire (lot 0.28.0) |
| § 17.1 d | PRD § 17.1 | absent — tendances de récupération sur 30 jours (C-191) | à faire (lot 0.28.0) |
| § 17.1 e | PRD § 17.1 | partiel — graphiques Recharts < 300 ms : recharts déclaré, jamais importé (C-167) | à faire (lot 0.28.0) |
| § 18.1 a | PRD § 18.1 | partiel — barre latérale PC non rétractable (C-192) | à faire (lot 0.28.0) |
| § 18.1 b | PRD § 18.1 | partiel — Ctrl+1…5 présents, Ctrl+K absent (C-135) | à faire (lot 0.28.0) |
| § 18.1 c | PRD § 18.1 | partiel — swipe et appui long absents, haptique seule (C-192) | à faire (lot 0.28.0) |
| § 18.1 d | PRD § 18.1 | absent — clic droit et double-clic (C-192) | à faire (lot 0.28.0) |
| § 18.1 e | PRD § 18.1 | partiel — minuteur PC sans badge dans le titre (C-192) | à faire (lot 0.28.0) |
| § 18.2 a | PRD § 18.2 | partiel — Aujourd'hui : streak absent (C-191) | à faire (lot 0.28.0) |
| § 18.2 b | PRD § 18.2 | partiel — Progrès : graphiques, records, bilans (C-191) | à faire (lot 0.28.0) |
| § 18.2 c | PRD § 18.2 | partiel — Plus : « À propos et licences » (C-119) | à faire (lot 0.28.0) |
| § 18.3 a | PRD § 18.3 | partiel — signature < 24 h sans lien vers la procédure SideStore (C-126, C-192) | à faire (lot 0.28.0) |
| § 18.3 b | PRD § 18.3 | partiel — états dégradés testés (C-193) | à faire (lot 0.28.0) |
| § 18.4 a | PRD § 18.4 | partiel — contrastes AA (C-111, C-112) | à faire (lot 0.28.0) |
| § 18.4 b | PRD § 18.4 | partiel — icône d'app non générée par script depuis `spartiate.svg` (C-194) | à faire (lot 0.28.0) |
| § 18.5 a | PRD § 18.5 | partiel — `npm run visual` sans toutes les paires (C-193) | à faire (lot 0.28.0) |
| § 18.5 b | PRD § 18.5 | partiel — rupture à 1 024 px au lieu de ≥ 900 px (C-135, C-188) | à faire (lot 0.28.0) |
| § 18.6 a | PRD § 18.6 | absent — Dynamic Type « Très grand » (C-113) | à faire (lot 0.28.0) |
| § 18.6 b | PRD § 18.6 | partiel — zoom PC 100 à 150 % sans test | à faire (lot 0.28.0) |
| § 18.6 c | PRD § 18.6 | partiel — équivalent clavier (C-068, C-121, C-122) | à faire (lot 0.28.0) |
| § 19.1 a | PRD § 19.1 | partiel — notification-actions : aucune notification de check-in (C-194) | à faire (lot 0.28.0) |
| § 19.1 b | PRD § 19.1 | partiel — privacy-shield activable (C-159) | à faire (lot 0.28.0) |
| § 19.3 a | PRD § 19.3 | partiel — textes NSHealth* et caméra (C-158) | à faire (lot 0.28.0) |
| § 19.3 b | PRD § 19.3 | partiel — `ITSAppUsesNonExemptEncryption` présente, non contrôlée en CI (C-194) | à faire (lot 0.28.0) |
| § 19.4 a | PRD § 19.4 | partiel — entitlements (C-158) | à faire (lot 0.28.0) |
| § 19.4 b | PRD § 19.4 | partiel — ni App Groups, ni conteneur iCloud, ni push ; contrôle codesign (C-160, C-174) | à faire (lot 0.28.0) |
| § 21.1 | PRD § 21.1 | partiel — données réelles interdites (C-165) | à faire (lot 0.28.0) |
| § 21.2 a | PRD § 21.2 | partiel — WAL et checkpoint : `synchronous = NORMAL` jamais posé (C-194) | à faire (lot 0.28.0) |
| § 21.2 b | PRD § 21.2 | partiel — sauvegardes 14 / 5 / 3 (C-137, C-138) | à faire (lot 0.28.0) |
| § 21.2 c | PRD § 21.2 | partiel — journaux 256 Kio × 2 (C-140, C-147) | à faire (lot 0.28.0) |
| § 21.2 d | PRD § 21.2 | partiel — mise à jour SideStore sans supprimer l'app (H-5, C-110, C-181) | à faire (lot 0.28.0) |
| § 21.3 a | PRD § 21.3 | partiel — archive zip `data.json`, `manifest.json`, `media/` (D-57, D-104, C-136) | à faire (lot 0.28.0) |
| § 21.3 b | PRD § 21.3 | partiel — import zip en fusion ou remplacement avec aperçu (D-57, C-109, C-127) | à faire (lot 0.28.0) |
| § 21.4 | PRD § 21.4 | partiel — effacement en deux étapes (D-180 à D-182, C-108, C-130) | à faire (lot 0.28.0) |
| § 22 a | PRD § 22 | partiel — CSP stricte et capabilities par plateforme (C-141) | à faire (lot 0.28.0) |
| § 22 b | PRD § 22 | partiel — journaux sans donnée corporelle (C-140, C-151, C-123) | à faire (lot 0.28.0) |
| § 22 c | PRD § 22 | partiel — `cargo audit` présent, `npm audit` absent (C-175) | à faire (lot 0.28.0) |
| § 22 d | PRD § 22 | partiel — mise à jour signée (C-166, C-172, C-179) | à faire (lot 0.28.0) |
| § 23.1 a | PRD § 23.1 | absent — couverture de 90 % sur training (C-170) | à faire (lot 0.28.0) |
| § 23.1 b | PRD § 23.1 | partiel — vecteurs des § 11 à 16 (C-168, C-169) | à faire (lot 0.28.0) |
| § 23.1 c | PRD § 23.1 | partiel — parité base Wasm / plugin natif (H-18 UNVERIFIED) | à faire (lot 0.28.0) |
| § 23.1 d | PRD § 23.1 | partiel — e2e : séance au clavier, journal, export / import (C-193) | à faire (lot 0.28.0) |
| § 23.1 e | PRD § 23.1 | partiel — e2e WebKit (C-095) | à faire (lot 0.28.0) |
| § 23.1 f | PRD § 23.1 | partiel — visuel de chaque onglet et des états dégradés (C-193) | à faire (lot 0.28.0) |
| § 23.1 g | PRD § 23.1 | partiel — perf : démarrage et graphiques non mesurés, seul le bundle l'est (C-167) | à faire (lot 0.28.0) |
| § 23.1 h | PRD § 23.1 | partiel — recette iPhone signée par itération (C-183) | à faire (lot 0.28.0) |
| § 23.2 a | PRD § 23.2 | partiel — `tests.yml` à chaque push, « suite verte » (C-173, C-174) | à faire (lot 0.28.0) |
| § 23.2 b | PRD § 23.2 | partiel — fixtures entièrement synthétiques : une fixture bâtie sur une donnée d’usage (C-165) | fait (DOC-PRIV, PR #156) |
| § 23.3 | PRD § 23.3 | partiel — matrice de non-régression : verrouillage et visuel manuels (H-5) | à faire (lot 0.28.0) |

## 5. Lot 0.29.0 (prévu)

| ID | Origine | Description (une ligne) | Statut |
|---|---|---|---|
| § 17.3 | PRD § 17.3 | absent — bilans avec repli sur gabarit (aucun fournisseur IA, D-294) | lot prévu 0.29.0 |
| § 17.4 | PRD § 17.4 | absent — import de programme vers une routine Libre (C-141, C-191) | lot prévu 0.29.0 |
| I6-08 | rapport de lot 0.27.0 (docs/I6-08.md) | Fiche d'import de programme (texte, PDF, capture ; aperçu et confirmation), taille L, non exécutée | lot prévu 0.29.0 |
| BL-050 | demande d'Ali (lot 0.29.0) | Objectif de pas quotidien (dépend du format de `pas.csv`, H-25) | lot prévu 0.29.0 |
| BL-051 | demande d'Ali (lot 0.29.0) | Zone 2 (cardio), périmètre à fixer dans la fiche du lot | lot prévu 0.29.0 |
| BL-052 | demande d'Ali (lot 0.29.0) | Notes sur 10, périmètre à fixer dans la fiche du lot | lot prévu 0.29.0 |
| BL-053 | demande d'Ali (lot 0.29.0) | VISBODY, périmètre à fixer dans la fiche du lot | lot prévu 0.29.0 |
| BL-054 | demande d'Ali (lot 0.29.0) | Pictogrammes, périmètre à fixer dans la fiche du lot | lot prévu 0.29.0 |

## 6. Écarts à trancher par Ali

| ID | Origine | Description (une ligne) | Statut |
|---|---|---|---|
| D-293 | rapport de lot 0.26.0 (docs/reprise.md) | Nutrition facultative dans le guide Santé par Raccourcis | à faire (lot 0.28.0) |
| D-295 | rapport de lot 0.26.0 (docs/reprise.md) | Cible à venir montrée dans Stratégie | à faire (lot 0.28.0) |
| D-296 | rapport de lot 0.26.0 (docs/reprise.md) | « Fixer ma cible » replié et vide, confirmation devant une cible future (en partie remplacée par D-314) | à faire (lot 0.28.0) |
| D-310 | rapport de lot 0.26.0 (docs/reprise.md) | Normes FitnessVolt pour le Strength Score | à faire (lot 0.28.0) |
| D-311 | rapport de lot 0.26.0 (docs/reprise.md) | Strength Score sur barre et poids du corps seulement, Rowing barre noté sur le Pendlay row | fait (décision d'Ali du 20/11) |
| D-243 | rapport de lot 0.22.1 (docs/reprise.md) | Jour du programme proposé par la séance du jour | fait (décision d'Ali du 20/11) |
| D-244 | rapport de lot 0.22.1 (docs/reprise.md) | Cran de 2,5 kg sans profil de matériel | fait (décision d'Ali du 20/11) |
| D-246 | rapport de lot 0.22.1 (docs/reprise.md) | Une seule action rouge choisie par écran | fait (décision d'Ali du 20/11) |
| D-314 (9) | rapport de lot 0.27.0 (docs/reprise.md) | Relecture rétroactive d'une semaine et fuseau de lecture des cibles | fait (décision d'Ali du 20/11 : conservé) |
| D-317 | rapport de lot 0.27.0 (docs/reprise.md) | Rattachement par le nom du jour à l'import seulement | fait (décision d'Ali du 20/11) |
| D-73 (4) | rapport de lot 0.27.0 (docs/reprise.md) | Durée estimée de séance (45 s par série, repos, sans transitions), à recaler sur demande | à faire (lot 0.28.0) |
| D-88 / D-220 | rapport de lot 0.27.0 (docs/reprise.md) | Exertion : cardio compté en minutes × ressenti faute de zones FC, à recaler sur demande | à faire (lot 0.28.0) |
| D-144 | rapport de lot 0.27.0 (docs/reprise.md) | Archive `archive/agent-a0528c3a67af21a44` sur origin : supprimable sur décision d'Ali | à faire (lot 0.28.0) |
