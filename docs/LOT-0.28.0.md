# Lot 0.28.0 — prompt d'Ali (copie fidèle, 20/11/2026)

Suivi : docs/reprise.md (phase et ticket suivants), docs/backlog.md (points ouverts). Fiches par ticket : docs/<ticket>.md.

---

Lot 0.28.0 : corrections des deux audits, conformité au PRD et ajouts d'Ali. Décisions d'Ali du 19 et du 20/11.
Ne pose aucune question : prends le choix prudent, consigne-le en D- « révisable par Ali », et continue. Réponds en français.
Usage réel en cours (D-292) : aucune donnée d'Ali dans le dépôt, les tests, les journaux ni les messages de commit ; jamais de lecture de %APPDATA%\fr.spartiate.app ni d'iCloud Drive/Spartiate ; fixtures synthétiques uniquement.

Sources (lis-les avant de commencer, sur leurs branches, en lecture seule)
- Audit Claude, parties 4 à 12 : branche audit-claude-0.27.0, PR #155, docs/audit-claude-0.27.0/ (rapport.md, constats.md, bloquants.md, tracabilite.md, preuves/).
- Audit Codex, parties 0 à 3 : branche audit-0.26.0, PR #148, docs/audit-0.26.0/ (bloquants.md, partie-02.md, partie-03.md, avancement.md). Codex peut encore pousser la fin de sa partie 3 pendant ce lot : relis son bloquants.md au début de chaque phase.
- Ne fusionne jamais #148 ni #155 ; ne modifie jamais leurs branches (sauf l'étape HIST-01, qui les réécrit avec tout le dépôt).

Avant toute chose
- Vérifie que v0.27.0 et ios-v0.27.0 sont publiées et main vert. Recopie ce prompt dans docs/LOT-0.28.0.md (premier commit de la première PR).

Cadre
- Un ticket = une branche = une PR depuis main à jour ; fusion dès la CI verte, sans tag. Un seul tag v0.28.0 à la fin, une compilation build-ios (publish=false), puis ios-v0.28.0.
- Soupape : si le lot dure plus de 72 h ou dépasse 3 compactages, publie v0.28.0 dès que les phases 0 à 2 sont fusionnées, puis continue en 0.28.1, 0.28.2… avec le même cadre (le correctif des bloquants ne doit pas attendre la conformité au PRD).
- Attente de CI : une commande bloquante par run (gh run watch <id> --exit-status), puis une lecture ; au plus une lecture d'API GitHub par minute.
- Passes consignées par ticket : product-owner, agent du module, qa-test, code-reviewer ; test rouge avant le vert, SHA consignés ; les tests de preuve des audits deviennent les tests rouges (copiés dans src/ ou tests/, jamais branchés depuis docs/). Un test qui figeait un défaut (C-168) est corrigé dans un commit qui le dit.
- cargo fmt --check puis clippy avant tout push Rust. Relecture sync-icloud (D-26) pour tout ce qui touche la synchro, les migrations ou les repositories.
- Worktrees dans C:\Dev\spartiate\.codex-tmp\wt-<ticket> ; aucune action qui attend une autorisation ; un seul agent lourd à la fois ; jamais la suite complète en local.
- Budget par ticket ; docs/reprise.md à jour après chaque fusion (phase et ticket suivants) ; arrêt au dépassement d'un budget ou au 2e compactage d'une session ; après un compactage, relire docs/reprise.md et docs/LOT-0.28.0.md. Ali relancera avec « Reprends le lot 0.28.0 depuis docs/reprise.md ».
- Bundle de départ jamais augmenté ; migrations additives, catalogue syncTables, export / import avec lecture des versions précédentes garantie.

Décisions d'Ali à consigner au premier commit (docs/decisions.md)
- D-243 validée : séance du jour par calendrier quand les jours de routine sont rattachés (PROG-04), rotation sinon.
- D-244 et D-246 validées telles quelles. D-314 (9) : la décision vaut pour toute sa semaine (conservé) et la date suit le fuseau de l'appareil qui lit (conservé, documenté). D-314 à D-317 validées.
- Recovery Split : seuil de 50 % (D-93) conservé ; le PRD est mis en cohérence (chapitre concerné, ou D- si le chapitre est figé par un test).
- Dépôt doncivo/spartiate : reste public ; données réelles retirées des fichiers ET de l'historique (HIST-01), exception unique à la règle « pas de force push », décidée par Ali le 20/11.
- Écarts au PRD : tous traités dans ce lot (phase 3), sauf ceux déjà prévus au lot 0.29.0 (bilans § 17.3, import de programme § 17.4 et I6-08, objectif de pas, zone 2, notes sur 10, VISBODY, pictogrammes).
- D-291 confirmée (un réglage de repos venu d'un check-in est remplacé par l'enregistrement manuel) et D-311 validée (Strength Score : barre et poids du corps seulement) : vérifier qu'elles portent bien la mention « validée par Ali », sinon l'ajouter.
- docs/reprise.md : SideStore renouvelé par Ali le 19/11 (prochaine échéance à noter d'après l'app).
- Constats d'Ali du 19/11 en CONFIRMED dans capability-matrix : scan d'un code-barres alimentaire avec fiche produit ; « Repartir de zéro » fait sur un appareil et reçu par l'autre. H-34 / H-36 : rendre la matrice cohérente (C-183) avec les constats d'Ali du 13/11.

PHASE 0 — confidentialité, en premier
0.1 DOC-PRIV, budget S (security-privacy, docs-writer) : C-165, C-110, C-181, C-182. Retire de tous les fichiers suivis toute donnée réelle d'Ali (moyennes et valeurs de sommeil, HRV, FC, poids, mensurations, cibles et calories personnelles, dates de ses séances, contenu de ses archives) : docs/FIX-0172.md, docs/AUDIT-USAGE.md et toute autre occurrence trouvée par recherche exhaustive (garde la liste exacte des motifs dans un fichier HORS dépôt, .codex-tmp/hist01-motifs.txt, pour HIST-01). Ajoute un test documentaire qui refuse ces motifs et les formes « valeur réelle d'Ali ». Corrige les guides dangereux ou hérités de CircleTasks (install-iphone.md, install-pc.md, textes cités par C-110 / C-181 / C-182).
0.2 HIST-01 — réécriture de l'historique, à faire UNE seule fois, seulement quand toutes les conditions sont réunies, sinon reporte-la en fin de lot et dis-le :
  - conditions : DOC-PRIV fusionné ; Codex n'a pas poussé sur audit-0.26.0 depuis 2 h (sinon attends, et reporte en fin de lot) ; aucune autre PR ouverte que #148 et #155 ; aucune session Claude Code ou Codex en cours d'écriture sur le dépôt.
  - sauvegarde : git clone --mirror du dépôt dans C:\Dev\spartiate-backup-avant-hist01 (jamais poussée), vérifiée par git fsck.
  - désactive les workflows qui se déclenchent sur un push de branche ou de tag (gh workflow disable, liste notée) AVANT tout push, pour qu'aucune compilation ni publication ne reparte ; spartiate-releases n'est pas touché.
  - réécriture avec git filter-repo --replace-text .codex-tmp/hist01-motifs.txt (remplacement par « [retiré] »), sur toutes les branches et tous les tags ; vérifie ensuite par recherche dans tout l'historique qu'aucun motif ne subsiste.
  - pousse en force toutes les branches et tous les tags réécrits (exception autorisée par Ali pour cette seule opération, consignée en D-), puis réactive exactement les workflows désactivés ; vérifie que spartiate-releases et ses releases sont inchangées et qu'aucun run de publication n'est parti.
  - consigne dans docs/HIST-01.md : SHA avant / après de main et de chaque tag, liste des branches réécrites, résultat de la vérification. Préviens dans ton rapport : Ali doit recloner C:\Dev\spartiate-codex (Codex) et envoyer à GitHub Support la demande de purge des références de PR en cache (modèle de message dans docs/HIST-01.md, à envoyer par Ali).

PHASE 1 — bloquants (Claude et Codex)
1.1 FIX-ASSIST, budget M : C-001, C-002, C-011 (assisté traité comme charge négative : cran, inactivité, position, échauffement).
1.2 FIX-ABERR, budget M : C-005, C-028, C-168 (charge aberrante signalée avant enregistrement, référence plafonnée ; tests figés corrigés).
1.3 FIX-A008, budget M (data-model, sync-icloud) : A-008 de Codex (écriture acquittée perdue après échec du rollback), relu avec C-115 et C-138 ; reprends sa preuve.
1.4 FIX-A009, budget M (sync-icloud) : A-009 de Codex (colonne nouvelle ignorée à la réception d'un instantané), y compris la colonne « jour de la semaine » de routine_day (schéma 20) ; test entre deux appareils.
1.5 Tout autre bloquant ajouté par Codex dans son bloquants.md pendant ce lot : un ticket chacun, même cadre.

PHASE 2 — les 10 corrections prioritaires de l'audit Claude (rapport.md, tableau « Les 10 corrections »), dans son ordre, hors celles déjà faites en phases 0 et 1 : FIX-CONFID-IOS (C-152, C-089, C-151, C-140, C-147), FIX-EXPORT (C-136, C-107, C-108, C-109), FIX-PLANCHER (C-031, C-086, C-087, C-088), FIX-SAISIE-NUTRI (C-032 à C-034, C-095 à C-098, C-036), FIX-RECUP (C-049, C-050, C-052), FIX-PROGRAMME (C-063, C-064, C-065, C-117, C-003), FIX-COQUILLE (C-114, C-115, C-116, C-067, C-068, C-073, C-094). Puis, dans l'ordre du rapport : CI de publication (C-166, C-172, C-174, C-175), tests figés et manquants (C-168 à C-171), sauvegardes Rust (C-137, C-138, avec A-008), accessibilité (C-111, C-112, C-113), matrice et documentation (C-183 à C-187).
Puis tous les autres constats « important » des deux audits, regroupés par module en tickets M ; les mineurs et améliorations : regroupés par module en tickets S, ou consignés « reporté » avec motif s'ils sont sans effet pour Ali.

PHASE 3 — conformité au PRD et ajouts d'Ali
3.1 SESS-01 (séance active, § 13.2 et C-190), budget L : « Remplacer l'exercice » en séance (alternatives de la fiche d'abord : même groupe musculaire, matériel disponible ; puis recherche ; garde la position, le nombre de séries et la plage ; charge de départ estimée depuis l'exercice remplacé quand le nouveau n'a pas d'historique, règle barre ↔ haltères par paire ↔ machine en D-, arrondie au cran, toujours prudente ; case « Remplacer aussi dans la routine », sinon « Mettre à jour la routine ? » à la fin) ; « Retirer, ne plus proposer » ; vignettes réordonnables et « Sauter » ; image et notes de l'exercice ; type de série Failure ; calculateur de disques ; fatigue déclarée au démarrage (Frais / Normal / Fatigué) ; Live Activity étendue (exercice suivant, +30 s, passer) ; résumé de fin avec écart et prochaine séance ; image partageable. Exemple de recette : Développé couché à la barre → Développé couché aux haltères.
3.2 Toutes les autres exigences « absent » et « partiel » de docs/audit-claude-0.27.0/tracabilite.md, chapitre par chapitre (Progrès § 17.1 et C-191 en tête : volume par muscle et par semaine, tendances de récupération sur 30 jours ; poids du corps et lest § 11.3 et C-189 ; retour à une prescription antérieure § 11.5 ; filtres body map et pattern § 14.2 ; lissage EMA et imputation affichée § 15.1 ; assiette § 15.3 ; clic droit et double-clic PC § 18.1 ; Dynamic Type § 18.6 ; couverture training ≥ 90 % § 11.6 / § 23.1 ; adhérence mesurée I2 ; E2E « séance iPhone → PC → édition PC → iPhone » § 9.2 ; blessures avec check-in bimensuel § 10.2), sauf les exigences réservées au lot 0.29.0 (voir décisions). Une exigence jugée disproportionnée pour un seul utilisateur n'est jamais abandonnée en silence : D- « écart proposé, à trancher par Ali », listée dans le rapport (exemple probable : unités configurables, § 10).
3.3 Restes des lots précédents : limites connues M2 à M4 de l'ADR 0018 (republication après montée de schéma) traitées ou tranchées en D- avec relecture sync-icloud ; règle de validation des sources d'images réduites (reste du lot 0.26.0) imposée par scripts/content/validate-content.mjs, avec test.
3.4 Nettoyage : branche archive/agent-a0528c3a67af21a44 (vérifier commit par commit que le contenu est dans main ou volontairement abandonné, consigner la preuve, puis supprimer la branche distante ; si un changement manque, ne rien supprimer et le signaler) ; .codex-tmp/wt-STR-01 et .codex-tmp/wt-audit-claude (git worktree prune puis suppression, après HIST-01) ; pairingBundle.test qui échoue seulement depuis un worktree (corriger le chemin ou documenter, sans affaiblir le test).

Registre des points en attente (décision d'Ali du 20/11)
- Crée docs/backlog.md dès la première PR : une ligne par point ouvert (identifiant, origine : rapport de lot / audit / demande d'Ali avec date, description en une ligne, statut : à faire / lot prévu / reporté avec motif / fait avec PR). Remplis-le avec : tous les « ce qui reste » des rapports des lots 0.17 à 0.27 (docs/reprise.md, CHANGELOG, fiches de lot), les constats des deux audits non traités dans ce lot, les exigences du PRD non « fait », le contenu prévu du lot 0.29.0, et les écarts à trancher par Ali.
- Règle permanente à ajouter à AGENTS.md : chaque lot met docs/backlog.md à jour avant de se clore (points ajoutés, statuts changés) ; un rapport de fin de lot ne liste « ce qui reste » qu'en renvoyant à ce fichier.

Fin du lot
- tracabilite.md mis à jour sur main (docs/tracabilite-prd.md) : chaque exigence fait / partiel / absent / hors périmètre / écart décidé, avec sa preuve.
- CHANGELOG 0.28.0 (en tête si le schéma change : « Mets à jour le PC et l'iPhone le même jour »), tag v0.28.0, build-ios, ios-v0.28.0, publication (ou 0.28.x selon la soupape).
- Rapport en 20 lignes au plus : PR fusionnées ; versions et schéma ; bloquants corrigés (Claude et Codex) ; nombre de constats corrigés / reportés ; exigences du PRD passées à « fait » ; écarts à trancher par Ali ; HIST-01 fait ou reporté (et ce qu'Ali doit faire : recloner spartiate-codex, message à GitHub Support) ; constats à faire par Ali sur l'iPhone et le PC (dont C-152 : Réglages › iCloud › Gérer le stockage › Sauvegardes, et le remplacement d'un exercice en séance) ; ce qui reste.
