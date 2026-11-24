# Lot 0.29.2 et suivants (prompt d'Ali du 24/11, recopié tel quel)

Lot 0.29.2 et suivants : vider le registre. Même cadre que les lots 0.29.0 et 0.29.1 (docs/LOT-0.29.0.md, docs/LOT-0.29.1.md) et mêmes règles anti-blocage : pas d'arrêt pour un budget ou un compactage (D-333), aucune commande interactive (GIT_EDITOR=true, --yes, jamais de pager), aucune action qui demande une autorisation, 3 tentatives au plus par ticket puis PR en brouillon, cause consignée dans docs/backlog.md et ticket suivant. Une PR par module, un commit rouge puis vert par ligne (D-374), un worktree par module dans C:\Dev\spartiate\.codex-tmp\wt-<module> depuis origin/main (le main local est divergent : ne jamais s'y fier). Attente de la CI : une seule commande `gh run watch --exit-status` par run, jamais de boucle.

Avant toute chose : recopie ce prompt dans docs/LOT-0.29.2.md (premier commit, PR LOT-0292), puis note dans docs/reprise.md que v0.29.1 et ios-v0.29.1 sont publiées (22/11).

Contexte
- L'iPhone d'Ali est bloqué par SideStore (Apple refuse la connexion depuis le 20/11). Publier reste permis : publier n'installe rien. Ali n'installera ni le PC ni l'iPhone tant que l'iPhone ne peut pas suivre le même jour. Garde en tête du CHANGELOG de chaque version : « Mets à jour le PC et l'iPhone le même jour ».
- Le schéma est passé à 21 en 0.29.1. Toute nouvelle migration reste additive, avec lecture garantie des exports et des journaux de synchro des versions précédentes (relecture sync-icloud, D-26).

Registre (docs/backlog.md) — tout traiter, rien d'oublié
1. Compte d'abord les lignes « à faire (0.29.x, …) » par module et écris ce compte dans docs/LOT-0.29.2.md (au 24/11, sur origin/main : 175 lignes ; CI 11, coquille iOS et qualité 55, séance et moteur 45, nutrition et récupération 35, données et synchro 24, import et contenu 5). Remets à jour les statuts périmés (ligne faite ou caduque : statut changé avec sa preuve, PR ou commit).
2. Traite ensuite TOUTES ces lignes, module par module, dans cet ordre :
   - CI (11) en premier, parce qu'elle protège tout le reste ;
   - séance et moteur (45) ;
   - nutrition et récupération (35) ;
   - données et synchro (24, relecture sync-icloud obligatoire) ;
   - import et contenu (5) ;
   - coquille, iOS et qualité (55).
   Chaque défaut : test rouge, puis vert. Chaque « à vérifier » : vérification écrite, puis correction ou statut « sans défaut » avec la preuve.
3. Décisions d'Ali du 24/11 sur les lignes « à trancher » : consigne chacune en D- (une ligne par décision dans docs/decisions.md), passe la ligne du registre en « à faire (0.29.x, module) » et traite-la avec son module (vecteurs d'abord, test rouge puis vert) :
   - C-013 : les plages du § 12.1.4 (5–10 polyarticulaire, 8–15 isolation) s'appliquent à TOUS les exercices générés, pas seulement aux substitutions.
   - C-017 : une dernière séance vidée ou supprimée revient dans la rotation (comportement actuel conservé) ; documenter la règle en D- et la figer par un test.
   - C-027 : « Dur » bloque seulement la hausse de charge ; l'échelle de répétitions reste libre (comportement actuel conservé, § 11.2.5 précisé en D-, test qui le fige).
   - C-038 : premier check-in sans cible : pas de minimum de couverture exigé (comportement actuel conservé, D-74 précisée, test qui le fige).
   - C-039 : un jour dont la pesée vient de Renpho compte comme complet si ses repas le sont ; l'origine de la pesée n'intervient pas (D-113 amendée).
   - C-042 : un aliment à lipides « traces » compte pour 0 g ; le total du jour reste calculé (D-75 amendée).
   - C-058 : le jour d'une mesure de récupération est calculé dans le fuseau où elle a été prise (décalage enregistré avec la mesure), pas dans le fuseau actuel.
   - C-061 : la baseline ne retient que les nuits valides des 30 derniers jours calendaires ; en dessous de 14 nuits valides sur cette fenêtre, elle est marquée « en reconstruction » (qualité non « good »).
   - C-135 : sur PC, pas de seuil fixe de bascule (ni 900 ni 1 024 px) : la disposition PC s'adapte automatiquement à la largeur (barre latérale repliée en icônes quand la place manque) et ne passe JAMAIS en disposition iPhone (cohérent avec BL-119) ; § 18.5 amendé par une D-. Ctrl+K : palette de commandes sur PC (aller à un écran, démarrer la séance du jour, ajouter un repas), chargée à la demande avec son catalogue de textes (hors du bundle de départ).
   - BL-135 : distinguer dans l'adhérence les séries ajoutées en séance (en plus du programme, hors « proposées ») et les séries retirées (proposées non faites) ; marquage par colonne additive, migration additive, exports et journaux précédents lus sans perte (relecture sync-icloud).
   Toute autre question qui surgit pendant le lot : écris-la dans docs/decisions-a-prendre.md (question fermée de 2 à 4 options, recommandation et conséquences) et continue sans elle.
4. Lignes « reporté » et « écart décidé » (DEP-01, H-3a/H-3b, BL-022, I6-09, BL-096, BL-123, § 8 I1, § 10) : inchangées, sauf si leur motif ne tient plus (preuve à l'appui).
5. BL-045 « caduque » : laisse les brouillons #148 et #155 intacts (Ali les clora).
6. Constats d'Ali : tiens à jour docs/constats-ali.md (une liste à cocher par appareil et par écran, avec le geste exact) avec les constats que ce lot ajoute.

Soupape de publication
- Publie 0.29.2 dès que CI, séance et moteur, et nutrition et récupération sont fusionnés et que « suite verte » est verte sur main : tag v0.29.2 puis ios-v0.29.2 (build-ios d'abord en essai), suivi de Build Windows et Build iOS jusqu'à spartiate-releases.
- Continue en 0.29.3, 0.29.4… avec le même cadre, jusqu'à ce que le registre n'ait plus aucune ligne « à faire » hors constats d'Ali et hors décisions à prendre.

Fin de chaque version
- CHANGELOG (avec la ligne d'en-tête ci-dessus), docs/reprise.md (≤ 5 Ko, prochaine étape exacte), registre à jour.
- Rapport en 15 lignes au plus : versions publiées, lignes fermées par module (compte avant et après), lignes restantes avec leur cause, questions ajoutées dans docs/decisions-a-prendre.md.

## Compte de départ (24/11, origin/main 3602f4d2)

Compté par `grep -o 'à faire ([^)]*)' docs/backlog.md` (statut « à faire (0.29.x, module, taille) ») : **175 lignes**.

| Module | S | M | L | Total |
|---|---|---|---|---|
| CI | 6 | 4 | 1 | 11 |
| séance et moteur | 33 | 12 | 0 | 45 |
| nutrition et récupération | 30 | 5 | 0 | 35 |
| données et synchro | 18 | 6 | 0 | 24 |
| import et contenu | 3 | 2 | 0 | 5 |
| coquille, iOS et qualité | 45 | 10 | 0 | 55 |

Décisions d'Ali du 24/11 consignées en D-472 à D-481 ; les dix lignes concernées passent en « à faire » (C-013, C-017, C-027 : séance
et moteur ; C-038, C-039, C-042, C-058, C-061 : nutrition et récupération ; C-135 : coquille, iOS et qualité ; BL-135 : données et
synchro), soit 185 lignes à traiter.

## Recompte après le complément d'audit (24/11, AUDIT-0292)

Complément d'Ali : docs/LOT-0.29.2-audit.md (D-489 à D-505, lignes BL-138 à BL-159). Après la CI (#205) et séance et moteur (#206),
compté par `grep -c 'à faire (0' docs/backlog.md` : **154 lignes « à faire »** — CI 3, séance et moteur 10, nutrition et
récupération 43, données et synchro 26, import et contenu 5, coquille, iOS et qualité 67. S'y ajoutent 49 lignes « fait en partie ;
reste : … » (restes traités avec leur module) et 2 « à trancher par Ali » (Q-11 à Q-14 de docs/decisions-a-prendre.md). Ordre (D-492) :
BL-138 (données et synchro), les 3 lignes CI nouvelles, la suite de séance et moteur (BL-106, BL-140, BL-141, § 12.3, § 12.4, BL-111,
BL-112, § 13.2 a, § 13.3 b, § 17.1 a), nutrition et récupération, publication 0.29.2.
