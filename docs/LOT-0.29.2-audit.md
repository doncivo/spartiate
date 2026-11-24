# Complément au lot 0.29.2 : audit du projet du 24/11 (prompt d'Ali, recopié tel quel)

Complément au lot 0.29.2 : audit du projet du 24/11 et décisions d'Ali (à coller dans la session Claude Code du lot en cours)

Cadre : celui de docs/LOT-0.29.2.md, inchangé (anti-blocage, une PR par module, un commit rouge puis vert par ligne, worktree depuis origin/main, aucune donnée réelle). Ce complément ne remplace pas le lot. Il s'y ajoute.

Avant toute chose
- Termine et fusionne la PR en cours. Ensuite, recopie ce texte tel quel dans docs/LOT-0.29.2-audit.md (premier commit d'une PR AUDIT-0292).
- L'audit a été fait en lecture seule sur origin/main f5a1b88 (24/11). Ses fichiers ne sont pas dans le dépôt. Tout ce dont tu as besoin est ci-dessous.

Règle de confidentialité propre à ce complément
- L'identifiant du profil de matériel par défaut (content/equipment-profiles/profiles.json:3) contient un nom de lieu réel. Ne recopie jamais ce nom, ni la ville, dans un commit, un titre de PR, une fiche, le registre, le CHANGELOG, une D- ou un test. Désigne-le seulement par « l'identifiant du profil par défaut ».

1. Décisions d'Ali du 24/11, après l'audit : une ligne par décision dans docs/decisions.md, à partir de D-489
- D-489 (BL-138) : renommer l'identifiant du profil par défaut en un identifiant neutre (« salle-complete »).
  - Migration additive : préférence locale training.activeEquipmentProfile, programmes de content/programs, routines et lignes equipment_profile qui le citent.
  - Les exports et les journaux de synchro des versions précédentes doivent rester lus sans perte (relecture sync-icloud, D-26).
  - Renommer aussi la constante de test du même nom, et retirer le nom de lieu du CHANGELOG, de content/README.md et des fiches docs/*.md (hors docs/archive).
  - Étendre scripts/release/privacy.test.ts aux noms de lieux, à content/ et au CHANGELOG. Le test doit être rouge avant le correctif.
  - Historique git inchangé : aucun push --force.
  - À la prochaine publication, vérifie si les notes des anciennes versions dans spartiate-releases/source.json contiennent ce nom. Si oui, retire-le par le script de publication (jamais à la main) et signale-le dans le rapport.
- D-490 (BL-149) : revue des « choix prudents, révisables par Ali » par thème : séance et moteur, nutrition, récupération, synchro et données, écrans, CI et outillage.
  - Dans docs/decisions-a-prendre.md, une section par thème. Pour chaque décision dont l'effet est visible ou chiffré : une question fermée (A = garder le comportement actuel, B ou C = alternative), avec la D- d'origine, la recommandation et les conséquences.
  - Les décisions sans effet visible sont listées en fin de section comme « gardées sans question ».
  - Aucun comportement ne change tant qu'Ali n'a pas répondu.
  - Le relevé de départ se fait par script : colonne source « Claude » ou « choix prudent », ou texte « révisable par Ali » (environ 229 décisions).
- D-491 : après le dernier lot 0.29.x, une relecture ligne à ligne des moteurs (src/domain/training, nutrition, recovery), de la synchro (src/sync, src/domain/sync, src/platform/sync, src-tauri/src/sync) et de src-tauri/src. Son prompt sera préparé à part. Ici, une ligne au registre seulement.
- D-492 : BL-138 est traité en premier, juste après la CI (déjà fusionnée en #205), avant de continuer « séance et moteur ».
- D-493 : repères de qualité OMS (§ 15.7), évaluation hypertrophie (§ 14.2), vidéos d'exercices (§ 8, 13.2, 14.1) et export CSV/JSON du bilan (§ 17.3, D-418 conservé) sont hors périmètre pour l'instant, motif « décision d'Ali du 24/11 ».
- D-494 : l'attente de la CI par une seule commande `gh run watch <id> --exit-status` par run est autorisée. Amende AGENTS.md (règle « aucune boucle de surveillance ») pour le dire explicitement : une commande par run, jamais de boucle, jamais en arrière-plan.
- D-495 : les branches distantes dont la PR est MERGED peuvent être supprimées, sauf main, audit-0.26.0 et audit-claude-0.27.0.
  - Avant toute suppression, liste chaque branche avec sa PR et son état ; jamais une branche d'une PR ouverte ou en brouillon.
  - Ne touche à aucun tag. Ne supprime aucun worktree local.
- D-496 à D-505 : réponses d'Ali aux questions Q-1 à Q-10 de docs/decisions-a-prendre.md (une D- par question). Chaque question tranchée sort du fichier.
  - Q-1 : B. Charge d'historique arrondie vers le bas à la grille du profil et plafonnée au maximum du matériel, avec la note. Traite BL-106 dans « séance et moteur » : vecteurs d'abord, test rouge puis vert. Le test de testsFiges.test.ts concerné est réécrit dans le commit du correctif.
  - Q-2 : A. Variable, Fixe et Statique retirés de l'écran ; § 12.3 amendé par la D-.
  - Q-3 : A. Le cardio importé ne charge aucun muscle ; § 16.3 et § 16.6 amendés ; D-364 close.
  - Q-4 : A. CI sur PR et main ; § 23.2 amendé ; C-173 et § 23.2 a passent « fait ».
  - Q-5 à Q-8 : A. Comportement actuel conservé : D-293, D-295, D-296 (1) et (3), D-310 validées ; lignes du registre passées « fait (D-…) ». H-37 reste ouverte.
  - Q-9 : B. Durée réelle de la série pour les exercices chronométrés, 45 s pour les autres. Traite C-012 et D-73 (4) dans « séance et moteur ».
  - Q-10 : A. Exertion du cardio en minutes × ressenti ; D-88 et D-220 validées.

2. Registre (docs/backlog.md)
Ajoute une section « 7. Audit du projet du 24/11 », origine « audit du projet 24/11 », avec les lignes suivantes, telles quelles.

| ID | Origine | Description (une ligne) | Statut |
|---|---|---|---|
| BL-138 | audit du projet 24/11 (N-01) | important — l'identifiant du profil de matériel par défaut nomme un lieu réel (content/equipment-profiles/profiles.json:3, programmes, tests, CHANGELOG, fiches) ; renommage avec migration et garde privacy.test.ts étendue (D-489) | à faire (0.29.x, données et synchro, M) |
| BL-139 | audit du projet 24/11 (N-02) | mineur — Exertion : séries au poids du corps, chronométrées et assistées comptées 0 (exertion.ts:35, recoveryImport/index.ts:33) ; charge totale (poids de corps × fraction ± charge) et charge par minute pour le chronométré | à faire (0.29.x, nutrition et récupération, S) |
| BL-140 | audit du projet 24/11 (N-03) | mineur — résumé de séance : « charge faite » d'un exercice assisté = série la plus assistée (summaryGap.ts:38, max au lieu de min) | à faire (0.29.x, séance et moteur, S) |
| BL-141 | audit du projet 24/11 (N-04) | mineur — résumé de séance : répétitions comparées par rang des séries faites et non par série prévue (summaryGap.ts:43) ; apparier par setIndex | à faire (0.29.x, séance et moteur, S) |
| BL-142 | audit du projet 24/11 (N-05) | mineur — libellés français utilisés comme clés dans src/domain/recovery/config.ts:96-130 ; clés neutres, libellés dans src/i18n | à faire (0.29.x, nutrition et récupération, S) |
| BL-143 | audit du projet 24/11 (N-06) | mineur — Réglages PC : poids retrouvé en cherchant « kg » dans un texte formaté (SettingsScreenPc.tsx:53) ; passer la valeur structurée | à faire (0.29.x, coquille, iOS et qualité, S) |
| BL-144 | audit du projet 24/11 (N-07) | amélioration — CSP : style-src 'unsafe-inline' (tauri.conf.json:32) à justifier ou retirer, avec BL-002 | à faire (0.29.x, coquille, iOS et qualité, S) |
| BL-145 | audit du projet 24/11 (N-08) | amélioration — 17 tests franchissent les couches ADR 0001 (ex. prescribe.review.test.ts:5, injuryKinds.test.ts:2-4, serializedDriver.a008.test.ts:5-6) ; fixtures dans tests/fixtures ou garde ESLint étendue aux tests avec exceptions motivées | à faire (0.29.x, coquille, iOS et qualité, S) |
| BL-146 | audit du projet 24/11 (N-09) | mineur — LOT-0.29.2.md (« gh run watch ») contredisait AGENTS.md | fait (D-494) une fois AGENTS.md amendé |
| BL-147 | audit du projet 24/11 (N-10) | mineur — trois décomptes des lignes ouvertes (reprise, LOT, registre) ; compteur unique produit par script et cité par docs/reprise.md | à faire (0.29.x, CI, S) |
| BL-148 | audit du projet 24/11 (N-11) | mineur — matrice : ligne « Fork, renommage… » encore UNVERIFIED (capability-matrix.md:15), H-12 UNVERIFIED alors que le scan OFF est CONFIRMED, H-15 caduque (Recharts) à reformuler ; ADR 0014 nomme encore circletasks.log (:17) | à faire (0.29.x, coquille, iOS et qualité, S) |
| BL-149 | audit du projet 24/11 (N-12) | important — environ 229 choix prudents de l'agent jamais présentés à Ali ; revue par thème dans docs/decisions-a-prendre.md (D-490) | à faire (0.29.x, coquille, iOS et qualité, M) |
| BL-150 | audit du projet 24/11 (N-13) | mineur — PRD : contradictions hors C-188 (D-16 contre § 21.2, mésocycle 4–6 contre 4–7, platform.kind du § 19.2 contre D-47, v0.0.x du § 25.2 contre D-58, renvois à docs/PRD.md) ; une D- de mise en cohérence chacune | à faire (0.29.x, coquille, iOS et qualité, S) |
| BL-151 | audit du projet 24/11 (N-14) | amélioration — branches distantes fusionnées à supprimer (D-495) | à faire (0.29.x, CI, S) |
| BL-152 | audit du projet 24/11 (O-02) | PRD § 15.7 repères de qualité OMS | hors périmètre (D-493) |
| BL-153 | audit du projet 24/11 (O-03) | PRD § 14.2 évaluation hypertrophie | hors périmètre (D-493) |
| BL-154 | audit du projet 24/11 (O-04) | vidéos d'exercices (§ 8 I6, § 13.2, § 14.1) | hors périmètre (D-493) |
| BL-155 | audit du projet 24/11 (O-05) | export CSV / JSON du bilan (§ 17.3), remplacé par le Markdown (D-418) | hors périmètre (D-493) |
| BL-156 | audit du projet 24/11 (O-06) | mineur — hypothèses sans ligne : H-1 (vecteurs comparés aux exemples publiés de Gravl), H-6 (minutes CI de l'essai 9 du gate et de SPA-010), H-11 (licence Ciqual : relecture de docs/licences.md, puis statut) | à faire (0.29.x, CI, S) |
| BL-157 | audit du projet 24/11 (O-07) | important — clé de synchro (Trousseau) conservée après la mise à jour SideStore N → N+1 : non couverte par le constat H-5 (capability-matrix.md:25) | constat d'Ali à faire (docs/constats-ali.md) |
| BL-158 | audit du projet 24/11 (O-12) | amélioration — D-412 : réévaluer Siri / App Intents, Camera Control et micronutriments après quelques semaines d'usage réel ; proposer une date dans docs/decisions-a-prendre.md | à faire (0.29.x, coquille, iOS et qualité, S) |
| BL-159 | D-491 | relecture ligne à ligne des moteurs, de la synchro et de src-tauri/src après le dernier lot 0.29.x (prompt à part) | reporté : après le dernier lot 0.29.x |

Statuts à changer (preuve dans le commit) :
- A-001 → « fait (BL-134, TECH-0291, PR #195 ; npm audit à 0 au 24/11, dépendances de développement comprises) ». Vérifie d'abord par `npm audit`.
- C-135 → « fait en partie ; reste : palette Ctrl+K (D-480), repli automatique de la barre latérale, § 18.5 amendé ; disposition PC à toute largeur sur Windows déjà faite (D-459) ».
- C-119 : ajoute au reste « src/i18n/fileFailureText.ts:8 renvoie à Réglages › À propos › Logs, qui n'existe pas ».
- Lignes tranchées par D-496 à D-505 : statut mis à jour comme dit au point 1.
- Constats d'Ali : ajoute BL-157 à docs/constats-ali.md (geste exact : avant une mise à jour SideStore, noter sur l'iPhone que la synchro fonctionne ; après la mise à jour, vérifier qu'elle reprend sans redemander la clé ni l'appairage).

3. Traitement
- Chaque nouvelle ligne « à faire » se traite avec son module, dans l'ordre du lot (après BL-138, D-492). Pour chaque défaut : test rouge puis vert. Recompte les lignes et écris le nouveau total dans docs/LOT-0.29.2.md et docs/reprise.md.
- BL-149 est un travail de documentation (aucun code) : fais-le dans la PR du module « coquille, iOS et qualité », ou plus tôt si tu attends une CI.
- La soupape de publication de 0.29.2 est inchangée ; BL-138 doit y être inclus.

Fin
- Le rapport de fin de version cite les D-489 à D-505, les lignes BL-138 à BL-159 avec leur statut, et le nouveau décompte.

Vérification : inclus — décisions d'Ali sur les 8 questions de l'audit et sur Q-1 à Q-10, les 21 lignes de l'audit (BL-138 à BL-158) plus BL-159 (D-491), les statuts A-001, C-135 et C-119, le constat BL-157 ; reportés — la relecture ligne à ligne (D-491, prompt à part après le dernier lot 0.29.x) et la réponse d'Ali aux questions par thème de D-490.
