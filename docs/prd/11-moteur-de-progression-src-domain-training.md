## 11. Moteur de progression (`src/domain/training`)

Même historique → même prescription ; chaque charge explicable ; conservateur sans données ; aucun bonus cumulable. Règles issues de l'algorithme publié par Gravl et de la double progression ; constantes dans `src/domain/training/config.ts`, ajustables par exercice. Horloge et identifiants injectés (`Clock`, `IdGenerator` de CircleTasks).

### 11.1 Entrée

```ts
prescribe(input: {
  exercise: Exercise; history: readonly WorkoutSet[]; lastDecision: RecommendationDecision | null;
  profile: ProgressionProfile; equipment: EquipmentProfile; mesocycle: MesocycleContext | null;
  recovery: RecoverySnapshot | null; position: number; target: RepTarget; config: ProgressionConfig; now: Instant;
}): Prescription  // { targetSets, confidence, reasons: ReasonCode[], engineVersion, activeConfig }
```

### 11.2 Ordre de calcul (normatif)

1. **Valider** : exclure des statistiques les séries non terminées, warm-up, deload, aberrantes non confirmées (> 150 % du 1RM courant) ; les garder dans l'historique brut.
2. **Cible** : plage de reps et RIR de la semaine (mésocycle) ou de la routine ; matériel actif.
3. **Dernière prescription effective** (valeur choisie si modifiée) et historique ; sans historique : charge de départ conservatrice, confiance faible, « provisoire ».
4. **Double progression** : toutes les séries au haut de plage ET difficulté compatible → un cran ; sinon +1 rep sur une série (ladder 8-7-6 → 8-8-6 → 8-8-7 → 8-8-8) ; baisse répétée → stabilité ou réduction proposée.
5. **Difficulté** = confirmation ou prudence : `Dur` / RIR ≤ 1 bloque la hausse ; `Juste` confirme ; `Facile` / RIR ≥ 4 confirme le cran. **Exception bornée** : confiance < 60 % → `Facile` recalibre le 1RM de +5 %, une fois par exercice et par mois, jamais cumulé avec le cran.
6. **Contraintes** (fatigue, inactivité, deload, récupération) : maintien ou réduction seulement.
7. **Snap matériel** après tout : incréments, min / max, barre, stack ; au-delà du garde-fou, charge inférieure.
8. **Explication** : règles déclenchées dans l'ordre, confiance, version, source des données.
9. **Présenter sans imposer** ; la modification manuelle devient la référence et est tracée.

**Invariant** : aucune proposition > `maxGainPerSession` ; une progression de reps n'est jamais convertie en hausse de charge dans la même prescription.

### 11.3 Règles et constantes

| Règle | Spécification | Constante |
| --- | --- | --- |
| 1RM estimé | Epley `w × (1 + reps/30)` ; séries > 15 reps ou < 60 % du 1RM pondérées 0,25 ; 1RM courant = moyenne pondérée par récence (1 / 0,6 / 0,3) des 3 dernières séances ; indicatif | `maxRepsForEstimate: 15` |
| Confiance | 0,4 × (séries valides / 6, plafonné) + 0,3 × (1 − dispersion relative) + 0,3 × récence (1 si < 14 j, 0 si > 60 j) ; < 0,4 → provisoire, hausse ≤ 1 cran | `minSetsForConfident: 3` |
| Charge de départ | Niveau × standards (sexe, poids) × 0,9 | `startDiscount: 0.10` |
| Cran | +1 incrément du matériel | — |
| Position | 2ᵉ exercice d'un muscle × 0,93 ; 3ᵉ × 0,88 | `positionDiscount: [1, 0.93, 0.88]` |
| Snap | Arrondi au cran ; écart > 3 % → ± 1 rep ; sinon inférieur | `snapTolerance: 0.03` |
| Fatigue intra-séance | Baisse > 20 % de reps à charge égale → alerte, −5 % ou −2 reps, refusable | `fatigueDrop: 0.20` |
| Stagnation | 3 séances sans progression → variante, autre plage, ou mini-deload −10 % | `stallSessions: 3` |
| Inactivité | 14 j sans ce muscle : −1 %/semaine, plancher −10 % ; une séance manquée ≠ régression | `detrainStart: 14` |
| Deload | Volume d'abord : séries ÷ 2 ; charge × `deloadLoad` (0,8 par défaut, par exercice) ; RIR 4+ ; exclu des calculs, visible | `deloadLoad: 0.8` |
| Plafond | 1RM +10 % max par séance | `maxGainPerSession: 0.10` |
| Récupération (I5) | Recovery ≤ 33 ou sommeil < 6 h ou FC repos > +8 % : charge × 0,95 et −1 série sur les secondaires ; jamais de bonus | `lowRecovery: 33` |
| Machines | 1RM par profil de salle ; poids libres partagés | — |
| Sans charge | Poids de corps : reps puis lest ; chronométrés : secondes ; drop sets et partielles hors tonnage et 1RM | — |

### 11.4 Explication

Template depuis `reasons` (textes dans `src/i18n`) : « +2,5 kg — haut de plage atteint sur les 3 séries, difficulté Juste (confiance 72 %) » ; détail ligne par ligne.

### 11.5 Garde-fous

Jamais d'augmentation imposée ; modification manuelle tracée ; aberrantes signalées avant enregistrement ; série non terminée ≠ réussie ; séance < 50 % des séries ne met pas à jour le 1RM ; douleur ≠ incitation ; retour à une prescription antérieure ; absence de RIR n'empêche pas la progression.

### 11.6 Tests (Vitest)

Fixtures `tests/fixtures/training/` : nominal 8 séances, stagnation, deload, changement de salle, séance partielle, `Facile` répété, retour après 3 semaines, modification manuelle, charge aberrante, haltères pas 2 kg, stack 5 kg ; propriétés : déterminisme, monotonie du snap, plafond. Couverture `src/domain` ≥ 80 % (seuil CircleTasks), training ≥ 90 %.
