# PROG-01 — Mésocycle réglable et cible des jours de repos (0.24.0)

Statut : **en cours.** Budget M. Branche `PROG-01-mesocycle-jours-repos` depuis `DOC-FIX-0241-fiche` (remplace #130). Schéma 19. À publier avant le dimanche 15/11 au soir : Ali démarre son programme réel le lundi 16/11 (12 semaines, 3 mésocycles de 4 semaines, séances lundi, mardi, jeudi, vendredi, samedi ; repos mercredi et dimanche). Décisions D-267 (fait foi pour le mésocycle et la semaine de reprise), D-269 à D-272. Fixtures synthétiques uniquement (§ 22, D-38) : aucune donnée d'Ali dans le dépôt, les tests ou les journaux.

Chapitres PRD : 12 (mésocycle, § 12.2, § 12.5), 11 (prescription, deload), 15 (cibles, check-in, § 15.1–15.2), 20 (schéma), 18 (écrans). Sync : D-26 (passe sync-icloud).

## Décisions complémentaires d'Ali du 13/11 (D-267, à intégrer avant la fusion)

1. Durée du mésocycle réglable à 4, 5 ou 6 semaines ; défaut inchangé : 5.
   - 4 semaines : semaines 1 à 3 de travail (RIR 3, 2-3, 2 ; RIR 1 sur l'isolation en dernière semaine de travail à partir du 2e mésocycle), semaine 4 de décharge.
   - 6 semaines : semaines 1 à 5 de travail (RIR 3, 3, 2-3, 2, 1-2 ; RIR 1 sur l'isolation en semaine 5 à partir du 2e mésocycle), semaine 6 de décharge.
   - Décharge : 2 séries par exercice, charges ≈ 90 % de la référence arrondies au cran du matériel vers le bas, RIR 3 à 4. Jamais RIR 0 par défaut. Décharge anticipée toujours proposée, jamais imposée.
   - Changement de durée en cours de mésocycle : appliqué au mésocycle suivant, historique intact.
2. Semaine de reprise (semaine 1 allégée d'une série sur les exercices à 4 séries) : désactivée par défaut, activable à la main. Désactivée : semaine 1 avec toutes les séries, à RIR 3.
3. Tests attendus : vecteurs pour 4, 5 et 6 semaines (RIR et séries par semaine, décharge à 90 % avec cran de 2,5 kg et paires d'haltères) ; semaine de reprise activée et désactivée ; passage de durée en cours de mésocycle.

## Réglages du jour J d'Ali (à partir du 16/11)

- Mésocycle : 4 semaines (6 semaines prévu à la revue du 07/02).
- Semaine de reprise : désactivée.
- Cible des jours de repos : 2 250 kcal.

## Passe product-owner : critères

### A. Mésocycle (D-267, D-269)

| # | Critère (Given / When / Then) |
| --- | --- |
| A1 | Durée réglable à 4, 5 ou 6 semaines dans Entraînement › Programme et à l'étape 7 (« split ») de l'onboarding ; défaut 5. |
| A2 | 4 semaines : RIR 3, 2-3, 2, puis décharge ; 6 semaines : RIR 3, 3, 2-3, 2, 1-2, puis décharge ; 5 semaines : RIR 3, 2-3, 2, 1-2, puis décharge (D-269). Séries de la routine en semaines de travail. |
| A3 | Dernière semaine de travail, à partir du 2e mésocycle : RIR 1 sur les exercices d'isolation. Jamais RIR 0 par défaut. |
| A4 | Décharge : 2 séries par exercice (1 si la ligne n'en a qu'une), charge = 90 % de la référence arrondie au cran du matériel vers le bas (2,5 kg ; par haltère pour une paire), RIR 3-4. Décharge anticipée proposée, jamais imposée (inchangé). |
| A5 | Semaine de reprise désactivée par défaut, activable à la main : semaine 1, −1 série sur les lignes à 4 séries ou plus. Désactivée : semaine 1 avec toutes les séries, RIR 3. |
| A6 | Changement de durée en cours de cycle : enregistré dans `next_weeks`, appliqué au cycle suivant ; semaines, historique et séances du cycle en cours inchangés. |
| A7 | Pause (D-73 (9)) : semaine allégée de reprise = semaine 1 avec l'allègement de la semaine de reprise. |

### B. Cible des jours de repos (D-270 à D-272)

| # | Critère |
| --- | --- |
| B1 | Sans cible de repos (défaut) : comportement identique à 0.23.0, partout. |
| B2 | Cible de repos saisie dans Stratégie, en kcal ou par un écart (défaut −200 kcal, porté par les glucides : −50 g) ; protéines et lipides identiques ; jours d'entraînement choisis (défaut : jours de la routine active si connus, sinon lundi, mardi, jeudi, vendredi, samedi). |
| B3 | Type de jour : jour d'entraînement prévu, sinon jour de repos ; une séance de musculation close ce jour-là le fait passer en jour d'entraînement (D-270). |
| B4 | Aujourd'hui et le journal : cible du type de jour, mention « Jour d'entraînement » ou « Jour de repos » ; Stratégie : moyenne hebdomadaire. |
| B5 | Check-in : sur la moyenne hebdomadaire, même écart appliqué aux deux cibles (différence conservée), borne ± 150 kcal, protéines fixes, plancher de lipides inchangé. Balance et dépense mesurée : comparaison à la cible du jour. |
| B6 | Schéma 19 additif ; catalogue de synchro ; export / import ; appareil resté au schéma 18. |
| B7 | Une archive sv 18 s'importe en 0.24.0, en Remplacer comme en Fusionner, sans cible de repos (archive synthétique : routine en mode programme de 5 jours avec un superset, nutrition_target, 3 compléments, profil, une pesée). |

## Vérification après fusion

Sur une base de test vide : « Repartir de zéro », onboarding passé, import Remplacer de l'archive sv 18 synthétique → routine, cibles et compléments présents, aucune erreur. Résultat consigné ici.

## Passes (reprise du 14/11, budget M supplémentaire)

**domain-logic.** `mesocycle.ts` : tables RIR de 4 et 6 semaines (plage, moteur sur la borne haute), décharge 2 séries × 0,9 au cran vers le bas, RIR 1 sur l'isolation en dernière semaine de travail à partir du 2e cycle, semaine de reprise, `changeNextWeeks` ; 5 semaines inchangé (test de non-régression). `constraints.ts` : assisté jamais plus lourd (D-273). `restDay.ts`, `checkIn.ts`, `journal.ts` : cible de repos, type de jour, check-in sur la moyenne, balance par jour. Rouge `b148b1f8` puis vert ; vecteurs : 4 / 5 / 6 semaines, 2,5 kg (100 → 90, 87,5 → 77,5, 52,5 → 45), haltères (26 → 22, 30 → 26), reprise, 5 → 4 en cours, pause, tractions assistées seules et avec la journée rouge. Deux attentes de test corrigées en cours (grille inconnue au lieu d'un cran de 2,5 kg ; 47,25 arrondi vers le bas = 45).

**training.** Décharge propagée à la séance (`ExerciseProgression`), à l'aperçu d'Aujourd'hui (calcul déplacé dans l'aperçu chargé à la demande) et au générateur (RIR de l'isolation, reprise). Écran Programme : semaine de reprise (désactivée par défaut), durée du prochain cycle (4 / 5 / 6), RIR en plage, note de l'isolation. Onboarding étape 7 : durée et reprise, qui préremplissent le premier cycle (D-269 (7)).

**nutrition.** Stratégie : cible de repos par écart (200 kcal par défaut) ou en kcal, jours d'entraînement, moyenne de la semaine ; une nouvelle cible manuelle garde l'écart ; check-in à deux cibles (ligne « Calories, jours de repos »), décision acceptée, refusée ou personnalisée qui garde la cible de repos. Aujourd'hui et journal : cible du type de jour et mention.

**data-model.** Schéma 19 additif (`0019_program_rest_day.ts` + test) ; repositories : `next_weeks`, `ramp_up`, `closedBefore`, cible de repos ; export sv 19, import sv 18 (Remplacer, Fusionner) vert.

**sync-icloud (D-26).** Relecture : captures, garde, restauration Rust conformes ; défaut corrigé : catalogues V7 à V17 du banc sans les colonnes 19 (`tests/sim/syncDevice.ts`, neuf scénarios « appareil resté au schéma N » rouges puis verts). Limite consignée (D-275) : une ligne créée par un appareil 18 n'est pas appliquée par un appareil 19 (déjà vrai en 0012 et 0013) ; correction = avenant ADR 0011, ticket SYNC-01 ; mesure : mise à jour des deux appareils le même jour, avant toute saisie.

**qa-test.** Local, `--maxWorkers=1` : src/domain, src/db, features training / nutrition / onboarding / app, platform/backup, scripts/release, tests/unit/sync, src/sync, src/i18n : verts (après mise à jour de l'identité 0.24.0 / schéma 19 et des libellés de conflit). Typecheck propre (hors `plugin-geolocation` connu), lint propre. `test:bundle` vert ; départ +321 octets (D-274). Non lancés en local : cargo, e2e, visual (CI).

## État au 14/11, nuit (arrêt : budget M dépassé, consigne de la mission de nuit)

Branche `PROG-01-mesocycle-jours-repos`, PR #131 en brouillon, à jour sur main (#130 fusionnée). Rien n'est publié.

Fait et poussé (tests ciblés verts en local) :
- Schéma 19 (migration 0019 + test, catalogue syncTables, déclencheurs de restauration Rust, fixture, `APP_SCHEMA_VERSION` 19).
- Domaine nutrition : `restDay.ts` (cible de repos, type de jour, moyenne hebdomadaire), check-in sur la moyenne (D-272), balance comparée à la cible du jour ; rouge `656e1d94` → vert `f243a52a`. Le test écrit avant le code avait un décalage d'un jour sur le jour ISO, corrigé.
- Repository des cibles : lecture et écriture de la cible de repos (+ tests ; rouge non vérifié à part).
- Import : archive sv 18 synthétique en Remplacer et Fusionner, rouge `invalid-data` puis vert ; `EXPORT_SV` 19, colonnes de la 0019 dans `LATER_COLUMNS`, docs/export-complet.md.
- Version 0.24.0 (manifestes).

Reste, dans l'ordre :
1. Mésocycle, domaine (D-267, D-269) : table RIR 4 / 5 / 6 semaines, séries de la routine, décharge (2 séries, 90 % au cran vers le bas, RIR 3-4), isolation RIR 1 à partir du 2e cycle, semaine de reprise (`ramp_up`), `next_weeks` ; vecteurs. Le travail de l'agent training est perdu (rien sur disque) : à refaire.
2. Constat 6 de Codex (PR #127) : en décharge, un exercice assisté ne devient jamais plus lourd (garder l'assistance ou réduire la charge totale) ; D- à créer ; tests : tractions assistées en décharge seule, puis décharge et journée rouge.
3. Repository mésocycle (`next_weeks`, `ramp_up`, cycles clos avant le cycle courant) ; écrans : Programme (4 / 5 / 6, reprise), onboarding étape 7 ; Stratégie (cible de repos, jours), Aujourd'hui et journal (mention du type de jour) sans grossir le bundle de départ.
4. Relecture sync-icloud (D-26), passes qa-test et code-reviewer, CHANGELOG 0.24.0, CI, fusion, tags, build-ios publish=false, vérification « Repartir de zéro → onboarding → import Remplacer sv 18 ».
