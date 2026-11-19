# PROG-05 — durée du cycle (lot 0.27.0)

Budget S (training). Constats AUDIT-USAGE U-6, U-7. Décision D-315 (révisable par Ali). PRD § 12.

## Passes

- **product-owner** — (1) Given un réglage de durée 4 (onboarding refait) et un cycle clos de 5 semaines venu de l'import, When j'ouvre
  Entraînement › Cycle, Then « 4 semaines » est proposé. (2) Given un cycle de 5 semaines en semaine 1 sans séance close, When je choisis
  4 semaines, Then une confirmation ; « Appliquer maintenant » → « Semaine 1 sur 4 » ; « Annuler » n'écrit rien. (3) En semaine 2 : comportement
  d'avant. (4) La semaine de reprise ne se reprend pas.
- **training** — `defaultCycleWeeks`, `canApplyWeeksNow`, `weeksNowSpec` (mesocycle.ts) ; réglage local `training.cycleWeeks` (settings.ts,
  effacé par la remise à zéro) ; écrit par l'onboarding et l'écran Cycle dans la même transaction que le cycle.
- **qa-test** — Rouge : `3232f3d9` (10 rouges ; le premier test du fichier CycleView, « sans cycle », a aussi échoué une fois au rouge sur
  « region introuvable » et passe depuis à chaque exécution : à surveiller, aucun délai touché). Vert : commit suivant. Suites ciblées
  vertes : src/features/training, src/domain/training, src/features/onboarding, src/domain/model, ResetDataScreen (818 + 140) ; typecheck et
  lint verts. Tests adaptés : ERGO-02b critère 9 (la durée reste 4 après un cycle clos, la reprise revient désactivée) ; le changement de
  durée « au prochain cycle » se teste désormais en semaine 2.
- **code-reviewer** — Diff relu (130 lignes) : couches respectées (règles dans src/domain, écran dans features), textes dans
  fr.trainingCycle.ts, aucun échec silencieux (geste refusé → erreur affichée par `write`). Approuvé.
