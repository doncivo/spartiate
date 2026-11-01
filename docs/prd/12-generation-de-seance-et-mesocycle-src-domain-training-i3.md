## 12. Génération de séance et mésocycle (`src/domain/training`, I3)

### 12.1 Séance

`generateSession({ day, program, library, equipment, profile, recovery, timeBudgetMin, config, clock })`

1. Muscles du jour par le split (Full Body ≤ 3 j, Upper/Lower 4 j, PPL 5–6 j, custom ≤ 7) ; Recovery Split en I5 (muscles ≥ 80 %).
2. Sélection : composés puis isolations ; filtre dur sur le matériel actif ; un exercice par pattern et muscle principal ; priorités en tête ; patterns douloureux exclus avec substitution.
3. Variété Consistent / Balanced (70 % récurrents, rotation 4 semaines) / Varied (rotation par mésocycle).
4. Volume borné par le budget temps (45 s par série + repos) et la plage de séries ; reps composés 5–10, isolations 8–15.
5. Style droites / pyramide / inversée.
6. « J'ai 35 min » : retrait des isolations puis réduction des séries, plan intact.

### 12.2 Mésocycle

| Élément | Spécification | Constante |
| --- | --- | --- |
| Durée | 4–7 semaines, dernière = deload ; option illimité | `mesoWeeks: 5` |
| Séries | +1 par muscle et par semaine dans la plage | `setsPerWeekIncrement: 1` |
| Intensité | RIR 3 → 1 par défaut, borne basse choisie | `rirStart: 3, rirEnd: 1` |
| Deload | Séries ÷ 2, RIR 4+, charge × `deloadLoad` ; anticipable | — |
| Fin de bloc | Bilan → répéter / changer / régénérer | — |
| Priorités | ± 1 série hebdo | — |

### 12.3 Modes

Guidé ; Libre (Variable / Fixe / Statique) ; Importé (I6, extraction IA validée) ; Maison (poids de corps).

### 12.4 Tests

Budget ± 10 % ; aucun exercice sans matériel ; aucun doublon de pattern ; < 1 s ; changement de salle sans perte ; mésocycle 5 semaines ; deload non destructif.

### 12.5 Programmes de départ (I1, `content/programs/*.json`)

Quatre routines prêtes, livrées comme contenu (même schéma que `routine` / `routine_day` / `routine_exercise`, validées par `validate-content.mjs`, exercices référencés par leur `id` de la bibliothèque § 14). Elles sont **relues par toi** comme la bibliothèque (H-8 étendu). Référence : la sortie du générateur Alpha Progression pour « prise de muscle, intermédiaire, 4 j/semaine, \~1 h 05, salle commerciale », dont la structure et la périodisation sont reprises ci-dessous.

| Programme | Jours | Public | Split |
| --- | --- | --- | --- |
| Haut / Bas 4 j (détaillé ci-dessous) | Lun Haut A · Mar Bas A · Jeu Haut B · Ven Bas B | Intermédiaire, salle | Upper / Lower |
| Full Body 3 j | Lun · Mer · Ven, mêmes patterns, exercices alternés A / B | Débutant ou reprise | Full Body |
| PPL 6 j | Push · Pull · Legs × 2 | Avancé, > 1 h disponible | PPL |
| Maison haltères 3 j | Haltères + banc + élastiques uniquement | Déplacement, maison | Full Body |

**Haut / Bas 4 j — exemple complet (valeurs de la semaine 2 ; la périodisation ci-dessous fait varier séries et RIR)**

| Jour | Exercice (`id`) | Séries × reps | Repos |
| --- | --- | --- | --- |
| Haut A | Développé couché barre (`bench-press-barbell`) | 3 × 6–10 | 150 s |
| Haut A | Rowing barre (`row-barbell`) | 3 × 6–10 | 150 s |
| Haut A | Développé incliné haltères (`incline-press-dumbbell`) | 3 × 8–12 | 120 s |
| Haut A | Tirage vertical (`lat-pulldown`) | 3 × 8–12 | 120 s |
| Haut A | Élévations latérales (`lateral-raise-dumbbell`) | 3 × 12–15 | 60 s |
| Haut A | Curl barre (`curl-barbell`) | 2 × 8–12 | 60 s |
| Haut A | Extension triceps poulie (`triceps-pushdown-cable`) | 2 × 8–12 | 60 s |
| Bas A | Squat barre (`squat-barbell`) | 3 × 5–8 | 180 s |
| Bas A | Soulevé de terre roumain (`romanian-deadlift-barbell`) | 3 × 6–10 | 150 s |
| Bas A | Presse à cuisses (`leg-press`) | 3 × 8–12 | 120 s |
| Bas A | Leg curl (`leg-curl-machine`) | 3 × 10–15 | 90 s |
| Bas A | Mollets debout (`calf-raise-standing`) | 3 × 10–15 | 60 s |
| Bas A | Planche (`plank`) | 3 × 45 s | 60 s |
| Haut B | Développé militaire barre (`overhead-press-barbell`) | 3 × 6–10 | 150 s |
| Haut B | Tractions ou tirage assisté (`pull-up`) | 3 × 6–10 | 150 s |
| Haut B | Développé couché haltères (`bench-press-dumbbell`) | 3 × 8–12 | 120 s |
| Haut B | Rowing haltère unilatéral (`row-dumbbell-one-arm`) | 3 × 8–12 | 90 s |
| Haut B | Écarté poulie (`cable-fly`) | 2 × 12–15 | 60 s |
| Haut B | Curl incliné haltères (`curl-incline-dumbbell`) | 2 × 10–15 | 60 s |
| Haut B | Dips ou extension nuque (`dips`) | 2 × 8–12 | 90 s |
| Bas B | Soulevé de terre barre (`deadlift-barbell`) | 3 × 4–6 | 180 s |
| Bas B | Fente bulgare (`split-squat-bulgarian`) | 3 × 8–12 | 120 s |
| Bas B | Hip thrust (`hip-thrust-barbell`) | 3 × 8–12 | 120 s |
| Bas B | Leg extension (`leg-extension-machine`) | 3 × 12–15 | 90 s |
| Bas B | Mollets assis (`calf-raise-seated`) | 3 × 12–15 | 60 s |
| Bas B | Relevé de jambes (`hanging-leg-raise`) | 3 × 10–15 | 60 s |

**Périodisation du mésocycle (5 semaines, reprise de l'exemple relevé chez Alpha Progression)**

| Semaine | Séries de travail | RIR cible | Charge | Note |
| --- | --- | --- | --- | --- |
| 1 | 2 | 3 | Prescription § 11 | Introduction, charges de départ |
| 2 | 3 | 2 | § 11 | Valeurs du tableau ci-dessus |
| 3 | 3 | 1 | § 11 | — |
| 4 | 4 | 0–1 | § 11 | Pic ; aucune hausse > 10 % |
| 5 | 2 | 5+ | × 0,8 | Deload planifié, 1RM et Strength Score gelés |

Le mésocycle suivant repart en semaine 1 avec les 1RM à jour. Les quatre programmes partagent cette périodisation ; seuls les jours et les exercices changent. Un programme de départ chargé devient une routine ordinaire, modifiable, synchronisée.

### 12.6 Pause et reprise (I3)

« Mettre le programme en pause » (vacances, maladie, déplacement sans salle) : les séances ne sont pas comptées comme manquées, le streak est gelé, aucune notification. À la reprise : décote de détraînement du § 11 (à partir de 14 jours, −1 %/semaine, comme Gravl), proposition d'une semaine allégée si la pause dépasse 21 jours, mésocycle décalé et non recommencé. Le profil « Maison haltères » peut être activé le temps de la pause sans toucher au programme principal.
