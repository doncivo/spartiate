Lot 0.26.0 : DOC-H21, ERGO-03, PROG-03, STR-01, MEDIA-02. Décision d'Ali du 15/11 : ces cinq tickets forment un seul déploiement, à lancer après la publication de la 0.25.0.
Ne pose aucune question : prends le choix prudent, consigne-le en D- « révisable par Ali », et continue. Réponds en français.

Avant toute chose
- Vérifie que v0.25.0 et ios-v0.25.0 sont publiées et que main est vert. Sinon, arrête-toi et dis-le.
- Recopie ce prompt tel quel dans docs/LOT-0.26.0.md (premier commit de la première PR du lot).
- Usage réel commencé le 16/11 (à consigner en D-38 si ce n'est pas fait) : aucune donnée d'Ali dans le dépôt, les tests ou les journaux ; fixtures synthétiques uniquement.

Cadre du lot (identique au lot 0.25.0)
- Un ticket = une branche = une PR depuis main à jour ; fusion dès la CI verte, sans tag ; un seul tag v0.26.0 à la fin, une seule compilation build-ios (publish=false), puis ios-v0.26.0.
- Attente de CI : une seule commande bloquante par run (gh run watch <id> --exit-status), puis une lecture ; jamais de lectures répétées.
- Passes consignées par ticket : product-owner, agent du module, qa-test, code-reviewer. Test rouge avant le vert, SHA consignés.
- cargo fmt --check puis clippy avant tout push qui touche du Rust. Un job en échec hors périmètre : une seule relance ; vert = test consigné instable ; rouge = corrigé.
- Budget par ticket ; à la fin de chaque ticket fusionné, docs/reprise.md à jour puis ticket suivant. Arrêt seulement si un ticket dépasse son budget ou après le 2e compactage ; après chaque compactage, relire docs/reprise.md et docs/LOT-0.26.0.md.
- Bundle de départ : aucun ticket ne l'augmente ; tout nouvel écran à la demande, catalogue i18n avec lui.
- Travail sans surveillance (Ali absent ou endormi) : aucune action ne doit attendre une autorisation. Les worktrees se créent DANS le dossier de travail, sous C:\Dev\spartiate\.codex-tmp\wt-<ticket> (dossier déjà ignoré par git), jamais à côté (C:\Dev\spartiate-<ticket>) : aucune lecture hors des dossiers de travail, donc aucune question. Vérifie au début que `git check-ignore .codex-tmp/wt-test` répond, sinon arrête-toi et dis-le. Si une commande demande malgré tout une autorisation, prends une autre voie qui n'en demande pas et consigne-la dans docs/reprise.md.

1. DOC-H21, budget S (product-owner, docs-writer) — constats d'Ali du 14/11 sur l'iPhone, 0.24.0, raccourcis « Spartiate — récupération » et « Spartiate — corps et nutrition » :
- capability-matrix et docs/decisions.md :
  - H-21 CONFIRMED : poids.csv écrit `date;valeur;kg`, décimale au POINT (pas à la virgule), décalage `+01:00`/`+02:00`, parfois une espace avant le `;` (le lecteur l'ignore), valeurs du type [retiré].800000001 lues et arrondies.
  - H-22, H-23, H-24 CONFIRMED : hrv.csv, fc-repos.csv et sommeil.csv lus sans refus à l'ouverture (dernier import 17:35), sommeil cohérent avec Santé (constat du 13/11 : [retiré]) ; filtre « Source est Apple Watch » ajouté sur ces trois blocs.
  - H-25 (pas.csv) reste UNVERIFIED.
  - H-28 CONFIRMED avec correction : en français, le type s'appelle « Indice de masse grasse » (et non « Pourcentage de graisse corporelle ») ; « Masse maigre », « Tour de taille », « Poids » existent sous ces noms ; Renpho écrit bien masse grasse et masse maigre.
  - H-29 CONFIRMED : masse grasse en `%` ([retiré];%), masses en kg, tour de taille en cm.
  - H-30 et H-31 : sans objet, décision d'Ali du 15/11 : la nutrition se saisit dans Spartiate, pas de bloc nutrition dans le raccourci.
- docs/guide-raccourcis-sante.md : type « Indice de masse grasse » ; nutrition retirée (choix d'Ali) ou marquée facultative ; automatisation « Lorsque Spartiate est ouverte » qui lance les deux raccourcis (remplace les automatisations horaires, qui échouent iPhone verrouillé) ; filtre Source = Apple Watch sur HRV, FC repos, sommeil (jamais sur les pas) ; avertissement : avec « Grouper par », l'action « Formater la date » doit pointer « Date de début », sinon deux dates par ligne.
- PRD § 27 / Q-2 : fournisseur IA = aucun (décision d'Ali du 15/11, pas de budget) ; fonctions IA grisées avec leur cause.

2. ERGO-03, budget M (ui-design-system, nutrition, accessibility-i18n) — Stratégie et Aujourd'hui :
- Stratégie (iPhone et PC) :
  - afficher la cible EN VIGUEUR et, à côté, la cible À VENIR quand une cible acceptée a une date future (« À partir du lundi 16/11 : [retiré] kcal · P · G · L [retirés] ») ;
  - « Fixer ma cible » n'est plus pré-rempli avec une valeur prête à écraser : champs vides ou repliés derrière un bouton « Modifier ma cible », et enregistrement d'une cible du jour qui passerait devant une cible future = confirmation explicite qui le dit ;
  - cible des jours de repos : section titrée, interrupteur libellé (si FIX-0244 ne l'a pas fait), jours de repos lisibles en toutes lettres ;
  - écran moins dense : groupes Style / Objectif / Cible / Jours de repos / Historique, une ligne par réglage avec sa valeur, comme Plus.
- Aujourd'hui (iPhone et PC) : repère du cycle « Semaine 1 sur 4 » ; la semaine de décharge affiche « Décharge » (badge bronze) ; rien si aucun cycle.
- Tokens seulement, contrastes AA testés, cibles ≥ 44 pt, très grand texte sans coupure, captures avant / après depuis la CI dans docs/ERGO-03.md.

3. PROG-03, budget S (training, ui-design-system) — PC, PRD § 18.1 :
- glisser-déposer pour réordonner les exercices d'un jour de routine et les jours d'une routine sur PC, avec équivalent clavier (Alt+↑/↓) et annonce lecteur d'écran ; sur iPhone, l'ordre se change comme aujourd'hui.
- L'ordre est publié par la synchro comme aujourd'hui (relecture sync-icloud si une colonne ou une règle de synchro change, D-26).

4. STR-01, budget M (domain-logic, training, ui-design-system) — Strength Score, PRD § 17.1 :
- score par 8 groupes, à partir des 1RM estimés, barre et haltères, ajusté au poids de corps et au sexe ; inchangé pendant une décharge ; utilise le champ `strengthStandardKey` du catalogue.
- Normes de référence : source publique citée dans docs/licences.md et D- (choix prudent, révisable) ; aucun nombre inventé ; groupe sans données = « — » avec sa raison, jamais 0.
- Fonction pure dans src/domain/training, vecteurs d'abord ; écran Progrès › Strength Score (iPhone et PC) dans la charte bronze, à la demande ; maquette d'abord dans docs/maquettes/propositions/.

5. MEDIA-02, budget M (content-data) — images d'exercices, D-71 (4) et règles de I6-07 inchangées (licence vérifiée image par image, NC/ND refusés, provenance et SHA-256 au registre, validate-content vert) :
- priorité aux 12 exercices de la routine d'Ali encore sans image : Développé épaules aux haltères, Enroulement du tronc à la poulie, Extension triceps au-dessus de la tête à la poulie, Fente bulgare, Hip thrust à la barre, Pull-over à la poulie, Relevé de jambes suspendu, Rowing à la barre, Rowing à la machine avec appui poitrine, Tirage vertical à la poulie, Tirage visage à la corde, Élévation latérale à la poulie ;
- puis le reste des 109, tant que des images sous licence vérifiée existent (wger image par image avec auteur et licence, Everkinetic) ; les autres restent sans image, avec le repli actuel ; nombre final consigné.
- Budget média inchangé (153 600 octets par image, 8 388 608 au total) ; si le plafond total bloque, priorité à la routine d'Ali et D- pour le reste.

Fin du lot
- CHANGELOG 0.26.0, tag v0.26.0, build-ios, ios-v0.26.0, publication.
- Rapport en 15 lignes au plus : PR fusionnées ; versions publiées ; D- créées ; bundle de départ avant / après ; nombre d'images ajoutées (dont les 12 de la routine) ; constats à faire par Ali (Stratégie avec cible à venir, repère de semaine, glisser-déposer PC, Strength Score, images) ; ce qui reste.
