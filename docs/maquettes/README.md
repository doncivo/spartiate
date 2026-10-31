# Maquettes Spartiate — 31 octobre 2026

24 planches HTML autonomes, référence visuelle du PRD (§ 18.5, décision D-21). Ouvrir `index.html`.
iPhone 16 Pro Max : 440 × 956 pt. PC Windows : 1440 × 900. Mode sombre (charte § 18.4), données d'exemple figées : ven. 30 oct. 2026, programme Haut / Bas 4 j, mésocycle 1 semaine 2 / 5.

## Statut
- Écart PRD / maquette → la maquette est suivie, l'écart est noté dans `docs/decisions.md`.
- Écran sans maquette → composé à partir des motifs de Plus / Réglages, consigné dans `docs/decisions.md`.
- `npm run visual` capture l'app et la maquette correspondante à la même taille (`<nom>-app.png` / `<nom>-maquette.png`).
- Toute modification d'une maquette passe par une PR dédiée ; les stories citent le commit de référence.

## Règles transversales (reprises de CircleTasks)
1. Chaque écran est dessiné dans l'état où il est utilisé : séance au repos entre deux séries, recherche avec le mot tapé, caméra ouverte pour l'appairage.
2. Une décision, une commande.
3. Aucun réglage qui ne peut rien faire.
4. Aucune valeur interne affichée ; aucun faux zéro : « en apprentissage J+3 », « rien de saisi », « inconnu ».
5. Le rouge n'est jamais une couleur de texte ; il porte le bouton principal et les séries validées. Le bronze porte charges, records, scores et l'onglet actif. Le vert ne signifie qu'une chose : c'est fait ou synchronisé.
6. L'action destructrice descend, s'annonce avec son coût et n'est jamais la seule action visible.
7. Sur grand écran, on borne (400–660 px de contenu) et on navigue ; on n'étire pas la mise en page du téléphone.
8. La zone de sécurité iOS est respectée partout (îlot dynamique, indicateur d'accueil).

## Planches
| Fichier | Écran |
|---|---|
| iPhone-Onboarding | Onboarding, étape 6 / 8 (body map) |
| iPhone-Aujourdhui · PC-Aujourdhui | Aujourd'hui |
| iPhone-Routine · PC-Routine | Programme et mésocycle |
| iPhone-Seance · PC-Seance | Séance active |
| iPhone-Resume | Résumé de séance |
| iPhone-Fiche · PC-Fiche | Fiche exercice, bibliothèque |
| PC-Materiel | Profil de matériel |
| iPhone-Journal · PC-Journal | Journal nutrition |
| iPhone-Dashboard · PC-Dashboard | Dashboard nutrition, stratégie |
| iPhone-CheckIn | Check-in hebdomadaire |
| iPhone-Recuperation | Récupération |
| iPhone-Progres · PC-Progres | Progrès |
| iPhone-Appairage · PC-Appairage | Appareils et synchro |
| iPhone-Degrade-Apprentissage · -HorsLigne · -Signature | États dégradés |

## Décisions de dessin (D-21)
Actions de page en barre du haut sur PC ; caméra d'appairage en bloc et non plein écran ; cadrans remplacés par « en apprentissage » la première semaine ; bandeau de signature prioritaire sur le contenu ; check-in motivé par le lissage 4 semaines.
