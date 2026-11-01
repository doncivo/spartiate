## 15. Nutrition adaptative (`src/domain/nutrition`, I4)

La dépense est **mesurée** depuis les apports loggés et la tendance de poids ; les cibles sont ajustées chaque semaine avec ton accord ; chaque valeur est traçable. Saisie au clavier sur PC, scan et photo sur iPhone ; tout se synchronise.

### 15.1 Formules (normatives)

- Tendance `T(t)` : EMA des pesées, demi-vie 14 jours ; pesée à > 2 % de `T` pondérée 0,25.
- Dépense sur `N` jours (21) : `TDEE = moyenne(kcal des jours complets) − (ΔT_kg / N) × 7 700`, `ΔT_kg = T(fin) − T(début)` ; lissage EMA demi-vie 7 jours.
- Initialisation Mifflin-St Jeor × activité ; pondération formule → mesure sur 28 jours.
- Jours non loggés : **jamais 0** ; imputés à l'affichage avec incertitude ; exclus du TDEE si couverture insuffisante.
- Confiance affichée (couverture, pesées).

### 15.2 Fiabilité et ajustement

| Règle | Spécification | Constante |
| --- | --- | --- |
| Couverture | ≥ 4 jours complets / 7 et ≥ 2 pesées / 7 j sur 2 semaines, sinon aucun ajustement | `minLoggedDays: 4`, `minWeighIns: 2` |
| Jour complet | Déclaré ou déduit (≥ 3 entrées sur ≥ 8 h) ; sinon `partial` / `unknown` | — |
| Amplitude | ≤ ± 150 kcal / semaine ; semaines indépendantes | `maxWeeklyDelta: 150` |
| Macros | Protéines 1,6–2,2 g/kg (± 2 g par check-in) ; lipides ≥ 0,6 g/kg ; ajustement sur glucides | — |
| Check-in | Jour configurable ; accepter / refuser / personnaliser ; relançable ; sur PC ou iPhone | `checkInWeekday` |
| Bornes | Plancher 1 200 kcal (800 sur confirmation) ; perte ≤ 1 %/semaine ; > ±25 % du TDEE → alerte et révision manuelle | — |
| Styles | Guidé / Collaboratif / Manuel | — |
| Modificateurs (I6) | Tendance de pas (iPhone) accélère les mises à jour | opt-in |

### 15.3 Saisie

| Méthode | PC | iPhone | Itération |
| --- | --- | --- | --- |
| Recherche (récents, favoris, go-tos ; Perso / Ciqual / OFF ; grammes ou portions ; provenance) | Oui | Oui | I4 |
| Quick Add, recettes, assiette | Oui | Oui | I4 |
| Code-barres (plugin officiel `@tauri-apps/plugin-barcode-scanner`, hérité de CircleTasks où il sert à l'appairage ; Camera Control si `CONFIRMED`) | — | Oui | I4 |
| Photo → API IA (aperçu, confirmation, JSON strict, lignes corrigeables, « estimation ») | Import d'une image possible | Caméra | I4 |
| Describe (texte / dictée) | Texte | Texte, dictée via plugin `speech` hérité (infrastructure conservée, écrans de capture CircleTasks supprimés, D-33) | I6 |
| Compléments avec rappels | Oui | Oui (rappels iPhone) | I6 |

### 15.4 Bases alimentaires et licences

| Base | Usage | Licence | Statut |
| --- | --- | --- | --- |
| Ciqual (ANSES) | \~3 000 génériques FR embarqués (`content/food/ciqual.json`) | Licence Ouverte Etalab 2.0 avec attribution (`H-11`) | I4 |
| Open Food Facts | Produits de marque, API publique appelée par Rust, cache local 90 jours | ODbL, attribution (`H-12`) | I4 |
| Fiches perso | Créées / corrigées, synchronisées | — | I4 |

Licences consignées dans `docs/licences.md` (fichier CircleTasks repris).

### 15.5 Écrans

Journal timeline horaire, cibles restantes, couverture du jour ; dashboard calories / macros, balance 7 j, tendance de poids et dépense avec confiance ; Stratégie. Écriture Apple Santé (iPhone, si `CONFIRMED`).

### 15.6 Tests

Fixtures 8 semaines : couverture complète, partielle, pesée aberrante, changement d'objectif, plancher ; signe de la formule ; jamais 0 ; borne ± 150.

### 15.7 Compléments issus du benchmark (révision 6.1)

| Fonction | Spécification | Référence | Itération |
| --- | --- | --- | --- |
| Étiquette nutritionnelle → fiche | Photo de l'étiquette → même adaptateur IA que la photo de repas → fiche `food` custom pré-remplie (par 100 g et par portion), à confirmer | MacroFactor | I6 |
| Repères de qualité | Sel, sucres, graisses saturées, fibres du jour face aux repères OMS, calculés depuis Ciqual ; affichage seul, jamais d'ajustement de cible ; « inconnu » quand la fiche n'a pas la donnée (jamais 0) | Reboot Plan (OMS), MacroFactor | I6 |
| Micronutriments | 8 nutriments épinglés (fer, calcium, magnésium, potassium, vitamines D, B12, C, zinc) depuis Ciqual, seuils min / cible configurables ; les fiches Open Food Facts sans donnée comptent « inconnu » (H-19b) | MacroFactor Nutrient Explorer | I6 |
| Jours hauts / bas | Répartition hebdomadaire des calories (jours d'entraînement +, repos −) à somme constante ; option de la Stratégie | MacroFactor | I4 |
| Note d'équilibre par aliment | Non retenu : classement « équilibré / à surveiller / à limiter » jugé culpabilisant et redondant avec les repères ci-dessus | Reboot Plan | — |
