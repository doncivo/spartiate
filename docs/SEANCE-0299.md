# SEANCE-0299 — Séance et moteur : décision d'Ali réduite comme une référence (BL-171), correction affichée au journal (BL-176)

Lot 0.29.9, module « séance et moteur ». Branche `SEANCE-0299` depuis `origin/main` (`89d2a5da`). Registre : BL-171 (C-026, D-657),
BL-176 (C-072, D-659, § 13.4, § 13.8 c). Chapitres : 11 (moteur, § 11.2, § 11.5), 12.2 (décharge), 13.4 et 13.8 (journal, correction),
16.7 (journal rouge). Décisions réservées : D-681 à D-685. Budget annoncé : S (50k).

## Passe product-owner (Given / When / Then)

BL-171 (D-657, Ali, Q-11 option B) :
1. Étant donné une décision d'Ali (modification ou retour) datée après la dernière séance de l'exercice, sans contrainte, alors elle est
   reprise telle quelle (inchangé : raison principale « décision »).
2. Étant donné la même décision en semaine de décharge, alors elle devient la référence et est réduite comme une séance : moitié des séries,
   charge × 0,8 arrondie vers le bas au matériel, RIR ≥ 4 (90 kg × 8, 8, 8 → 70 kg × 8, une série).
3. Étant donné une pause de 3 semaines ou plus, alors la décote d'inactivité s'applique à la décision (90 kg, 35 jours : −3 % → 87,5 kg).
4. Étant donné une journée rouge acceptée (ou une récupération basse), alors × 0,95 vers le bas (90 → 85 kg ; 110 → 102,5 kg).
5. Fatigue, stagnation et décote de position ne s'appliquent pas (lues dans l'historique, pas dans la décision) ; aucun choix facultatif.
6. Même règle au poids du corps et chronométré (`prescribeUnloaded`) : décharge (moitié des séries, lest × 0,8 vers le bas), pause et
   récupération basse (mêmes valeurs, raison principale de la contrainte).
7. La phrase est celle de la contrainte ; une note dit que la référence est la dernière décision d'Ali (texte dans src/i18n, chargé à la
   demande avec fr.progression).
8. `ENGINE_VERSION` 5 → 6 (les propositions changent) ; épinglages mis à jour.
9. Les tests qui figeaient l'option A (constraints.test.ts, redDay.test.ts, seance0292.test.ts C-026) changent d'attente dans le commit rouge.

BL-176 (D-659, Q-13 B) :
10. Étant donné une série d'une séance close corrigée avec `correctedFrom` connu, quand le journal l'affiche, alors l'étiquette dit
    « corrigée : 80 → 82,5 kg » (virgule décimale, « → », unité) ; plusieurs valeurs changées : jointes par « ; » (répétitions, durée, RIR).
11. Deux haltères tenus : « corrigée : 2 × 26 → 2 × 28 kg ». Valeur d'avant absente : « — ».
12. `correctedFrom` absent ou identique (validation retirée sans changer les valeurs) : « corrigée » seul, comme avant.
13. Aucune migration, aucune table publiée changée, aucun module ajouté au départ (fr.training déjà hors départ).

Hors périmètre : historique complet des corrections (option C de Q-13, refusée) ; décote de position d'une décision.

## Passe agent du module

(à compléter)

## Passe qa-test

(à compléter)

## Relecture à froid (code-reviewer)

(à compléter)
