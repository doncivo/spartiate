# AUDIT-CLAUDE-0.27.0 — rapport final

- **SHA audité** : `d056640910db32cc9d08b940e9a6ae9e602d3b19` (tags `v0.27.0` et `ios-v0.27.0`). Branche `audit-claude-0.27.0`, PR brouillon #155, jamais fusionnée. Audit du 20/11/2026, parties 4 à 12 ; parties 0 à 3 (données, migrations, synchronisation) : Codex, PR #148.
- **Couverture** : 892 / 892 fichiers de production et d'outillage du périmètre lus (`couverture.md`, généré par `preuves/couverture.mjs`) ; 179 hors relecture motivée (vendored, généré, binaires) ; 597 tests et supports hors décompte, dont les tests du moteur, de la nutrition et de la récupération lus en entier (partie 11). Lecture déléguée à des relecteurs en contexte neuf, un lot chacun ; constats consignés par l'auditeur.
- **Constats** : 194 identifiants dans `constats.md` — **3 bloquants** (`bloquants.md`), ~70 importants, ~93 mineurs, 15 améliorations, 9 à vérifier ou à trancher (`preuves/gravites.mjs`). Traçabilité des chapitres 8 à 23 : `tracabilite.md` (195 fait, 90 partiel, 28 absent, 32 hors périmètre).
- **Preuves exécutées** : 9 fichiers de test dans `preuves/` (jamais branchés sur la CI) : 39 tests rouges qui établissent des constats, 35 vecteurs verts recalculés à la main, 4 mesures de performance et des témoins ; sorties dans `preuves/resultats/`. CI du tag lue une fois : 25 jobs verts (`preuves/ci-v0.27.0.tsv`).

## Résumé (15 lignes)

1. Trois bloquants : C-001 (assisté : progression et réductions inversées), C-005 (faute de frappe sur la charge enregistrée sans alerte puis prescrite), C-165 (moyenne de sommeil réelle publiée dans un dépôt public).
2. Le moteur respecte ses formules (Epley, confiance, cran, plafond, position, inactivité, décharges 4/5/6 semaines, pause, séance du jour) : 20 vecteurs verts.
3. Ses écarts portent sur les cas limites : assisté, aberrantes, recalibrage provisoire, grille de disques, décharge qui ajoute une répétition.
4. Nutrition : formules justes (8 vecteurs verts), mais plancher contrôlé sur la moyenne seulement (C-031, C-086, C-087), lissage TDEE jamais branché (C-036), saisies sans garde (C-032 à C-034, C-095).
5. Récupération : exclusion des aberrantes inopérante sur 7-8 nuits (C-049), heure de coucher faussée par une nuit courte (C-050), `pas.csv` tronqué du mauvais côté (C-052).
6. Écrans : peu de défauts de forme (aucun texte ni couleur en dur), mais des pertes de saisie et des suppressions sans confirmation (C-067, C-068, C-073, C-094, C-098).
7. Coquille : aucune frontière d'erreur racine (C-114), chien de garde qui propose de recharger pendant une migration (C-115).
8. Confidentialité : base, photos et journal probablement dans la sauvegarde iCloud de l'iPhone (C-152) ; journal sans filtre de valeurs corporelles (C-151, C-140).
9. Plus : export plus large que son aide (C-107) et réimportable seulement sous 2 Mo (C-136) ; liste « Ce qui est effacé » incomplète (C-108).
10. Rust : sain sur les chemins, la signature et la CSP ; rotation et restauration sans exclusion mutuelle (C-137, C-138) ; OCR et dictée exposés sans usage (C-141).
11. Swift : propre (aucun déballage forcé) ; fuite d'accès de sécurité à chaque cycle de synchro (C-153).
12. Tests : plusieurs défauts figés par des tests (C-168), règles majeures sans test (C-169), seuil training 90 % absent (C-170), test FIX-0272 sans portée (C-171).
13. CI : actions non figées et signature sur un runner partagé avec `npm ci` (C-166, C-172), publication sans contrôle de la suite verte.
14. Documentation : guides d'installation dangereux et hérités de CircleTasks (C-181, C-182), matrice incohérente sur H-36 / H-34 (C-183).
15. Performance : bundle de départ 196 042 octets sur 358 400 ; calculs du domaine en millisecondes sur 3 ans de données (C-167 : budgets peu gardés par des tests).

## Constats triés par gravité puis par partie

Détail, preuves et corrections : `constats.md`. Seuls les bloquants et les importants sont repris ici ; mineurs et améliorations par partie en fin de liste.

### Bloquants
- **C-001** (partie 4, confirmé en 7a) — exercice personnalisé assisté : cran qui augmente l'assistance, inactivité et position qui la réduisent ; tests rouges `partie4-moteur.test.ts`.
- **C-005** (parties 4 et 7a) — charge aberrante (200 au lieu de 100) acceptée sans alerte, puis prescrite ; tests rouges `partie7a-ecrans.test.ts`, `partie4-moteur.test.ts`.
- **C-165** (partie 9) — `docs/FIX-0172.md:66` publie la moyenne de sommeil d'Ali ([retiré]) dans le dépôt public `doncivo/spartiate`.

### Importants
- **Partie 4** : C-002 échauffement d'un assisté plus dur que le travail ; C-003 « Mettre à jour la routine » double les séries d'un exercice présent sur deux lignes ; C-004 recalibrage « Facile » de deux crans en confiance provisoire ; C-008 distance GPS gonflée à l'arrêt (600 m pour 0) ; C-020 → C-064.
- **Partie 5** : C-031 cible de repos sous le plancher, refus à « Accepter » ; C-032 arrondis cumulés à la correction des grammes ; C-033 kcal Open Food Facts contredit par le kJ ; C-034 Quick Add sans borne de macros ; C-036 lissage de la dépense jamais appliqué.
- **Partie 6** : C-049 exclusion des aberrantes sans effet sur 7-8 nuits (journée rouge manquée) ; C-050 heure de coucher avancée de 3 h ; C-052 `pas.csv` : totaux partiels qui écrasent les complets.
- **Partie 7a** : C-063 séance du jour reproposée après avoir été faite ; C-064 semaine de reprise reconduite au 2e cycle ; C-065 échange de jours de la semaine impossible ; C-066 « 12,16 » lu comme un poids ; C-067 suivi GPS perdu, « Abandonner » sans confirmation ; C-068 série supprimée sans confirmation, focus perdu ; C-069 « Accepter » écrase une série validée ; C-070 texte faux « cardio non compté » ; C-071 champ « Charge » des tractions sans « lest » ; C-072 correction de série non tracée ; C-073 brouillon de routine abandonné sans confirmation.
- **Partie 7b** : C-086 confirmation inexistante sous le plancher ; C-087 cible de repos impossible sous une cible confirmée < 1 200 ; C-088 tableau de bord sur la cible d'entraînement un jour de repos ; C-089 photos supprimées dans les sauvegardes ; C-090 « en 4 semaines » faux ; C-091 constance effacée au changement d'heure d'un complément ; C-092 produit OFF masqué par la coupe à 50 ; C-094 mesure supprimée sans confirmation ; C-095 virgule dans `type="number"` (à vérifier sur WebKit) ; C-096 journal après minuit ; C-097 saisie rattachée à un autre jour ; C-098 formulaire effacé par une autre suppression.
- **Partie 7c** : C-107 aide de l'export ; C-108 liste « Ce qui est effacé » ; C-109 archive postérieure à l'effacement qui ramène les données ; C-110 conseils de réinstaller l'app ; C-111 anneau de focus à 2,74:1 ; C-113 Dynamic Type non branché ; C-114 écran blanc définitif ; C-115 « Réessayer » pendant une migration ; C-116 bloc de signature illisible → erreur de démarrage ; C-117 revue de l'onboarding qui écrase la durée de cycle ; C-118 oubli de la clé sans dire la conséquence ; C-119 licences absentes de Plus (à vérifier).
- **Partie 8a** : C-136 import limité à 2 Mo ; C-137 rotation qui supprime la sauvegarde créée ; C-138 restaurations sans exclusion mutuelle ; C-139 double « Quitter » et plantage du plateau au démarrage ; C-140 journal saturable et sans filtre corporel côté Rust ; C-141 OCR et dictée exposés sans usage.
- **Partie 8b** : C-151 valeurs corporelles non masquées dans le journal ; C-152 base, photos et journal dans la sauvegarde iCloud (à constater) ; C-153 accès de sécurité non relâchés ; C-154 écriture sur un fichier iCloud évincé (à vérifier, D-26).
- **Partie 9** : C-166 actions non figées dans les workflows de publication.
- **Partie 11** : C-168 tests qui figent des défauts ; C-169 règles sans test ; C-170 seuil training 90 % ; C-171 test FIX-0272 sans portée ; C-172 chaîne du job qui signe, publication sans suite verte ; C-173 déclencheurs CI contraires à la documentation.
- **Partie 12** : C-181 consignes dangereuses des guides ; C-182 guides hérités de CircleTasks ; C-183 matrice incohérente ; C-189 progression au poids du corps absente ; C-190 séance active incomplète ; C-191 Progrès incomplet ; C-193 couverture e2e et visuelle.

### Mineurs, améliorations, à vérifier (par partie)
Partie 4 : C-006, C-007, C-009 à C-030 (sauf C-020) · partie 5 : C-035, C-037 à C-048 · partie 6 : C-051, C-053 à C-062 · partie 7a : C-074 à C-085 · partie 7b : C-093, C-099 à C-106 · partie 7c : C-112, C-120 à C-135 · partie 8a : C-142 à C-150 · partie 8b : C-155 à C-164 · partie 10 : C-167 · partie 11 : C-174 à C-180 · partie 12 : C-184 à C-188, C-192, C-194.

## Les 10 corrections à faire en premier (tickets prêts à lancer)

Les bloquants de Codex (A-008 rollback en échec, A-009 colonnes nouvelles d'un instantané, branche `audit-0.26.0`) ont leurs propres tickets et ne sont pas repris ; C-115 et C-138 touchent la même zone qu'A-008 (base pendant un échec ou une relance) et doivent être relus avec lui ; C-153 et C-154 relèvent de la relecture sync-icloud (D-26).

| # | Ticket | Périmètre (constats) | Fichiers | Test rouge attendu | Budget |
|---|---|---|---|---|---|
| 1 | **FIX-ASSIST** — exercice assisté traité comme charge négative | C-001, C-002, C-011 | `src/domain/training/prescribe.ts`, `constraints.ts`, `warmup.ts`, `closure.ts`, `exerciseSheet.ts` | `preuves/partie4-moteur.test.ts` C-001a2, C-001b, C-001c, C-002 (repris dans `src/domain/training/`) | M |
| 2 | **FIX-ABERR** — aberrantes signalées avant enregistrement, référence plafonnée | C-005, C-028, C-168 (tests figés) | `SetRow.tsx`, `ActiveSession.tsx`, `domain/training/session.ts`, `prescribe.ts`, `estimate1rm.ts`, `prescribe.test.ts:237`, `prescribe.review.test.ts:126` | `preuves/partie7a-ecrans.test.ts` C-005 (saisie 200 kg signalée ; prescription < 150 kg) | M |
| 3 | **DOC-PRIV** — aucune donnée réelle ni consigne dangereuse dans le dépôt public | C-165, C-110, C-181, C-182 | `docs/FIX-0172.md`, `docs/AUDIT-USAGE.md`, `docs/install-iphone.md`, `docs/install-pc.md`, `src/i18n/fr.ts:378`, `fr.syncPairing.ts:24`, `fr.syncFolder.ts:21` | test documentaire : motifs de valeurs corporelles réelles et « réinstalle / supprime l'app » refusés dans `docs/` et `src/i18n` ; décision d'Ali sur la visibilité du dépôt | S |
| 4 | **FIX-CONFID-IOS** — sauvegarde iCloud, photos supprimées, journal | C-152, C-089, C-151, C-140, C-147 | `src-tauri/src/ios_setup.rs`, `backup.rs`, `applog.rs`, `src/platform/logs/sanitize.ts`, `fr.bodyProgress.ts:87` | `preuves/partie8b-9-confidentialite.test.ts` (82,4 kg et extrait JSON masqués) ; test statique de l'exclusion de sauvegarde avant le plugin SQL ; constat d'Ali sur l'iPhone | M |
| 5 | **FIX-EXPORT** — export complet, réimportable, honnête | C-136, C-107, C-108, C-109 | `src-tauri/src/import.rs`, `src/platform/files/types.ts`, `fr.exportImport.ts`, `fr.dataReset.ts`, `domain/dataReset.ts`, `ExportImportScreen.tsx` | `preuves/partie7c-ecrans.test.ts` C-107, C-108 ; aller-retour d'une archive synthétique de 3 Mo ; archive datée après l'effacement mais contenant des lignes d'avant refusée | M |
| 6 | **FIX-PLANCHER** — plancher et confirmation sur les deux cibles, type du jour partout | C-031, C-086, C-087, C-088 | `domain/nutrition/checkIn.ts`, `restDay.ts`, `features/nutrition/useCases.ts`, `StrategyView.tsx`, `TargetForm.tsx`, `CheckInView.tsx`, `DashboardView.tsx` | `preuves/partie5-nutrition.test.ts` C-031 ; Testing Library : case de confirmation affichée pour une cible de repos à 1 100 | S |
| 7 | **FIX-SAISIE-NUTRI** — saisies et jour du journal | C-032, C-033, C-034, C-095, C-096, C-097, C-098, C-036 | `domain/nutrition/journal.ts`, `offProduct.ts`, `mealEntry.ts`, `features/nutrition/shared.tsx`, `JournalView.tsx`, `useCases.ts`, `tdee.ts`, `offProduct.test.ts:44`, `tdee.test.ts:158` | `preuves/partie5-nutrition.test.ts` C-032, C-033, C-034, C-036 ; e2e iphone-webkit « 12,5 » | M |
| 8 | **FIX-RECUP** — baseline, coucher, pas | C-049, C-050, C-052 | `domain/recovery/baseline.ts`, `bedtimeProposal.ts`, `shortcutFiles.ts`, `features/settings/recoveryImport/service.ts` | `preuves/partie6-recuperation.test.ts` C-049, C-050, C-052 | S |
| 9 | **FIX-PROGRAMME** — séance du jour, routines, cycles | C-063, C-064, C-065, C-117, C-003 | `domain/training/programDay.ts`, `closure.ts`, `TodaySessionCard.tsx`, `CycleView.tsx`, `RoutinesView.tsx`, `onboardingData.ts`, `trainingRoutineRepository.ts` | `preuves/partie7a-ecrans.test.ts` C-018 ; `preuves/partie4-moteur.test.ts` C-003 ; Testing Library : clôture puis relance de cycle sans reprise, échange Lundi ↔ Mardi enregistré | M |
| 10 | **FIX-COQUILLE** — démarrage robuste et pertes de saisie | C-114, C-115, C-116, C-067, C-068, C-073, C-094 | `src/App.tsx`, `main.tsx`, `StartupWatchdog.tsx`, `startupSteps.ts`, `CardioGps.tsx`, `SetRow.tsx`, `RoutinesView.tsx`, `BodyProgress.tsx` | Testing Library : composant de la coquille qui lève → message et « Réessayer » ; étape `db.migration.N` à 9 s sans bouton de rechargement ; suppression d'une série, d'une mesure et abandon du GPS demandent confirmation | M |

Ensuite, dans cet ordre : CI de publication (C-166, C-172, C-174, C-175 ; S), tests figés et manquants restants (C-168 à C-171 ; M), sauvegardes Rust (C-137, C-138 ; M, avec A-008), accessibilité (C-111, C-112, C-113 ; S), matrice et documentation (C-183 à C-187 ; S).

## Ce qui n'a pas pu être vérifié, et pourquoi

- **Comportements sur l'appareil** (pas de Mac, aucune commande iOS locale, D-36) : sauvegarde iCloud de la base et des photos (C-152), seuil des accès de sécurité (C-153), écriture sur un fichier évincé (C-154), clavier numérique sans « : » (C-083), virgule dans `type="number"` sous WebKit (C-095), Dynamic Type (C-113), privacy-shield sur l'aperçu du sélecteur (C-159), sélecteurs bloqués sans `cancel` (C-105, C-163), fermeture de session Windows (C-146), échec du plateau au démarrage (C-139).
- **e2e, visuel, smoke et perf locaux** (interdits sur ce PC) : seuls les résultats de la CI du tag ont été lus ; rendu des graphiques et démarrage non mesurés ; mesures du domaine faites sur le PC local, non représentatives de l'iPhone.
- **Taille réelle d'une archive d'export d'Ali** (C-136) : données réelles interdites ; seules les limites ont été relevées.
- **Moteur de synchronisation, migrations, repositories** : périmètre de Codex ; les constats qui en dépendent (C-109, C-142, C-153, C-154, C-115) sont à relire avec lui.
- **Code vendored** (plugin SQL, sqlx-sqlite) et données générées (`backup_triggers.rs`, permissions autogénérées) : hors relecture, motifs dans `couverture.md`.
- **Captures et constats d'Ali** cités par la matrice (conservés hors dépôt) : la complétude des CONFIRMED a été jugée sur le texte seulement (C-183, C-184).
- **Profondeur de vérification** : bloquants et la plupart des importants vérifiés par un test rouge ou une lecture ciblée de l'auditeur (deux relevés corrigés : C-020, C-167) ; une partie des mineurs repose sur la lecture d'un relecteur, marquée « Preuve : lecture (relecteur) ». Quelques CSS ont été contrôlés par motifs seulement, `src/platform/sync/memory.ts` en structure (DEV seulement).
