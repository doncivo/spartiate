# Lot 0.29.1 (prompt d'Ali, recopié tel quel)

Lot 0.29.1, décisions d'Ali du 21/11 (réponses aux questions du rapport 0.29.0). Même cadre que le lot 0.29.0 (docs/LOT-0.29.0.md), mêmes règles anti-blocage que la nuit du 20/11 : pas d'arrêt pour un budget ou un compactage, aucune commande interactive, aucune action qui demande une autorisation, ticket bloqué après 3 tentatives = brouillon consigné puis ticket suivant, point d'étape écrit dans docs/reprise.md et jamais à l'écran. Réponds en français.
Avant toute chose : recopie ce prompt dans docs/LOT-0.29.1.md (premier commit), consigne les décisions en D- et mets docs/backlog.md à jour.

Décisions d'Ali du 21/11
- BL-109 / BL-120 : exercices écartés (« ne plus proposer ») et gênes déclarées synchronisés entre le PC et l'iPhone (relecture sync-icloud, D-26 ; migration additive et lecture des exports précédents garanties si une table change).
- BL-114 : plage cible de 10 à 20 séries difficiles par muscle et par semaine dans Progrès.
- BL-115 : adhérence affichée sous deux mesures : séances faites / prévues, ET prescriptions respectées (séries et charges faites / proposées). Règles en D-, vecteurs d'abord.
- BL-119 : au zoom Windows de 150 %, le PC garde sa disposition PC (jamais la disposition iPhone), adaptée à la largeur effective ; tests aux largeurs effectives correspondantes (1 280, 1 366, 1 920 px à 150 %).
- BL-123 : kg seulement ; « unités configurables » (PRD § 10) devient un écart décidé par Ali.
- BL-125 : bilan de la semaine avec une recommandation par thème (entraînement, nutrition, sommeil et récupération), chacune issue d'une règle documentée, avec sa source ; aucune recommandation sans données.
- BL-131 : action « Pris » depuis l'écran verrouillé sans authentification, conservée.

Restes techniques, dans cet ordre
- BL-130 : prouver en CI que build-ios compile avec le SDK iOS 26 (version de Xcode affichée et vérifiée par une étape qui échoue sinon) ; si le runner ne le permet pas, consigner et passer.
- BL-134 : corriger minimatch et ajouter cargo audit à la CI (alerte bloquante seulement sur le graphe livré).
- BL-133 : migrer les 177 anciens tests de synchro restants (mêmes règles que TECH-01) ; s'ils ne tiennent pas dans le lot, en migrer le plus possible et consigner le reste.

Registre (docs/backlog.md) — tout traiter, rien d'oublié
- Commence par remettre les statuts à jour : plusieurs lignes marquées « à faire (lot 0.28.0) » sont faites ou caduques (ex. BL-006 wt-STR-01, BL-007 PR #127 fermée, BL-050 à BL-054 livrées en 0.29.0, BL-045 couverte par l'audit Claude des parties 4 à 12). Chaque changement de statut cite sa PR ou sa décision.
- Puis traite TOUTES les lignes encore « à faire » (hors constats d'Ali), regroupées par module en PR (un commit par ligne, test rouge puis vert quand c'est un défaut) :
  - séance et moteur : BL-090, BL-091, BL-092, BL-106, BL-108 (+30 s et Passer de la Live Activity), BL-110 (pause de séance), BL-111, BL-112, BL-113, BL-121 ;
  - données et synchro (relecture sync-icloud) : BL-093, BL-094 et BL-031, BL-095, BL-097, BL-098, BL-099, BL-122, BL-030, BL-037, BL-038, BL-039, BL-040, BL-041, BL-005 ;
  - nutrition et récupération : BL-101, BL-102, BL-103, BL-117, BL-124, BL-107 (attribution Ciqual affichée) ;
  - import et contenu : BL-126 (PDF sans dépendance nouvelle), BL-127, BL-128, BL-010 ;
  - coquille, iOS et qualité : BL-002 (CSP wasm-unsafe-eval), BL-032, BL-033, BL-034, BL-036, BL-118, BL-129, BL-116 (retirer recharts), BL-003, BL-004, BL-035 (avec CLEAN-03), BL-042, BL-043, BL-044, BL-100, BL-104, BL-105.
  - BL-132 (relecture des poses des pictogrammes) : relis-les toi-même d'abord (planche des cas douteux), corrige ce qui est faux, et laisse à Ali le constat final.
- Les constats à faire par Ali (BL-009, BL-012 à BL-021, BL-132 final, et ceux des CHANGELOG 0.28.1 / 0.29.0 / 0.29.1) : regroupe-les dans une seule liste à cocher, docs/constats-ali.md, par appareil et par écran, avec le geste exact pour chacun.
- Lignes « reporté » (BL-001, BL-022, BL-096) : inchangées, sauf si leur motif ne tient plus.
- Si tout ne tient pas dans le lot, publie 0.29.1 quand les décisions d'Ali et les restes techniques sont fusionnés, puis continue en 0.29.2… avec le même cadre, jusqu'à ce que le registre n'ait plus de ligne « à faire » hors constats d'Ali.

Fin du lot
- CHANGELOG 0.29.1 (en tête : « Mets à jour le PC et l'iPhone le même jour »), tag v0.29.1, build-ios, ios-v0.29.1, publication.
- Rapport en 15 lignes au plus ; tout ce qui reste renvoie à docs/backlog.md.
