Lot 0.27.0 : AUDIT-USAGE puis corrections. Décision d'Ali du 19/11 : auditer les parcours réellement utilisés depuis le 16/11 et corriger tout ce qui casse, en un seul déploiement.
Ne pose aucune question : prends le choix prudent, consigne-le en D- « révisable par Ali », et continue. Réponds en français.
Usage réel en cours (D-292) : aucune donnée d'Ali dans le dépôt, les tests ou les journaux ; jamais de lecture de %APPDATA%\fr.spartiate.app ni d'iCloud Drive/Spartiate ; fixtures synthétiques uniquement.

Avant toute chose
- Vérifie que v0.26.0 et ios-v0.26.0 sont publiées et que main est vert. Recopie ce prompt dans docs/LOT-0.27.0.md (premier commit de la première PR).
- L'audit Codex (PR #148, branche audit-0.26.0, lecture seule) continue en parallèle : ne touche jamais à sa branche ; ses constats A-001 à A-006 de la partie 0 sont repris ci-dessous.

Cadre (identique aux lots 0.25.0 et 0.26.0)
- Un ticket = une branche = une PR depuis main à jour ; fusion dès la CI verte, sans tag ; un seul tag v0.27.0 à la fin, une compilation build-ios (publish=false), puis ios-v0.27.0.
- Attente de CI : une commande bloquante par run (gh run watch <id> --exit-status), puis une lecture. Pas plus d'une lecture d'API GitHub par minute (limite atteinte au lot précédent).
- Passes consignées par ticket : product-owner, agent du module, qa-test, code-reviewer ; test rouge avant le vert, SHA consignés ; cargo fmt --check puis clippy avant tout push Rust.
- Worktrees DANS le dossier de travail : C:\Dev\spartiate\.codex-tmp\wt-<ticket> ; aucune action qui attend une autorisation (Ali dort ou est absent) ; sinon autre voie, consignée dans docs/reprise.md.
- Budget par ticket ; docs/reprise.md à jour après chaque fusion ; arrêt seulement si un ticket dépasse son budget ou au 2e compactage ; après un compactage, relire docs/reprise.md et docs/LOT-0.27.0.md.
- Mémoire du PC limitée : un seul agent lourd à la fois, jamais deux suites de tests en parallèle.
- Bundle de départ jamais augmenté.

1. AUDIT-USAGE, budget M (product-owner, qa-test, puis l'agent de chaque module touché)
Rejoue de bout en bout, en tests d'intégration sur base synthétique (et e2e en CI), les parcours exacts d'Ali depuis le 15/11, et consigne chaque écart dans docs/AUDIT-USAGE.md (constat, scénario, cause, ticket) :
  a. « Repartir de zéro » → onboarding complet (objectif perte 0,25 kg/sem, activité modérée, jours lun/mar/jeu/ven/sam) → import Remplacer d'une archive sv 18 contenant une routine programme de 5 jours nommés « Lundi — … » à « Samedi — … », une nutrition_target manuelle acceptée datée du lundi suivant (week_start futur, hlc absent ou ancien) et 3 compléments → lendemain : quelle cible est en vigueur ?
  b. Cycle : Entraînement › Cycle › « Commencer le cycle » sans toucher la durée, puis 4 semaines en cours de cycle, puis « Terminer le cycle » › « Répéter le cycle ».
  c. Aujourd'hui un jeudi après une seule séance close le lundi : quelle séance est proposée ?
  d. Saisie d'une charge à la barre « un seul côté » puis « Corriger » depuis Entraînement › Journal : la progression suivante repart-elle bien de la charge corrigée ?
  e. Cible des jours de repos enregistrée le lundi, puis check-in collaboratif du lundi (garder la cible).
  f. Raccourcis : import du dossier sante avec les formats confirmés (D-293), deux appareils en 0.26.0.
Puis traite tous les constats dans les tickets 2 à 5 (ou un ticket supplémentaire si nécessaire).

2. FIX-0271 — cible nutritionnelle, budget M (nutrition, data-model, sync-icloud si une règle de synchro change, D-26)
- Constat d'Ali (19/11, 0.26.0) : sa cible importée du 16/11 (2 450 kcal, manuelle acceptée) n'est pas en vigueur le 19/11 ; c'est la proposition de l'onboarding du 15/11 (3 177 kcal, week_start 09/11) qui s'applique. Cause probable : effectiveTarget (targetRecord.ts:74-83) retient la décision au HLC le plus récent parmi week_start ≤ date ; la ligne importée garde un HLC absent ou plus ancien que celle de l'onboarding faite juste avant l'import.
- Attendu : une cible importée par Remplacer (ou Fusionner) est une décision prise au moment de l'import, horodatée à ce moment (HLC de l'import), et une cible planifiée pour une date future ne peut pas être battue en silence par une décision antérieure à sa planification. Règle en D-, vecteurs : scénario 1a, archive sv 18 sans hlc, archive avec hlc ancien, deux appareils.
- Corrige aussi : « une décision reçue par la synchro peut masquer une cible future sans prévenir » (reste du lot 0.26.0) et « lecture des cibles futures hors transaction » (FIX-0244).
- Aujourd'hui et Stratégie affichent la même cible ; Stratégie montre pourquoi une cible est en vigueur (« décidée le … »).

3. PROG-04 — séance du jour selon le jour de la semaine, budget M (training, data-model, sync-icloud, D-26)
- Constat d'Ali (19/11) : un jeudi, Aujourd'hui propose « Mardi — Bas du corps » (rotation après la dernière séance, nextProgramDay) alors qu'il attend « Jeudi — Poussée ».
- Ajoute à chaque jour de routine un jour de la semaine facultatif (migration additive, schéma 20, catalogue syncTables, export/import sv 20 avec lecture sv 18 et 19 garantie, test « appareil resté au schéma 19 »).
- Si les jours ont un jour de la semaine : Aujourd'hui propose celui du jour ; un jour de repos affiche « Repos » ; une séance manquée est sautée, pas décalée ; « Autre séance… » reste possible. Sans jour de la semaine : rotation actuelle inchangée.
- Saisie : Entraînement › routine › jour › « Jour de la semaine » ; à l'import, un nom de jour qui commence par « Lundi », « Mardi »… est rattaché automatiquement (D-) ; les jours d'entraînement de la nutrition (D-270) se déduisent de ces jours quand ils existent.

4. PROG-05 — durée du cycle, budget S (training)
- Constats d'Ali (19/11) : au premier lancement, la durée par défaut était 5 semaines ; changer la durée en cours de cycle ne s'applique qu'au cycle suivant, sans proposer de l'appliquer tout de suite.
- Attendu : la durée proposée au lancement reprend le dernier réglage (onboarding, réglage précédent, ou durée portée par l'archive) ; en semaine 1 d'un cycle sans séance close, changer la durée s'applique au cycle en cours après confirmation ; ensuite, comportement actuel avec le message actuel.

5. FIX-0272 — constats de l'audit Codex partie 0 et dette connue, budget M (selon le module)
- A-003 : docs/licences.md complet (react-dom, zustand et toute dépendance livrée manquante).
- Couleurs en dur hors tokens.css et textes en dur hors i18n repérés par l'audit (preuves sur la branche audit-0.26.0, docs/audit-0.26.0/partie-00.md) : corrigés ou justifiés un par un.
- A-006 : le test chronométré de checklist sort de npm run test (renommé *.perf.test.ts ou équivalent, mesure inchangée).
- SupplementsView.tsx:127 : effet de notifications poursuivi après démontage ; les 12 rejets non interceptés de SupplementsViewErgo02.test.tsx et SupplementsFix0242.test.tsx corrigés (import asynchrone annulé au démontage).
- Tests instables connus : syncedData.test.tsx et TodayScreen.test.tsx : cause trouvée et corrigée, sans allonger les délais.
- src/features/settings/theme.ts:42 : import Tauri hors façade platform (ADR 0001) corrigé ou justifié en D-.

Fin du lot
- CHANGELOG 0.27.0 (en tête : « Mets à jour le PC et l'iPhone le même jour » si le schéma change), tag v0.27.0, build-ios, ios-v0.27.0, publication.
- Rapport en 15 lignes au plus : PR fusionnées ; versions ; schéma ; D- créées ; constats de l'AUDIT-USAGE et leur sort ; ce qu'Ali doit faire après la mise à jour (rattacher ses jours de routine aux jours de la semaine si l'import ne l'a pas fait, vérifier la cible du jour) ; ce qui reste.
