# PROG-0301a — Progrès en 6 onglets, sous-onglets de Corps, test « rien ne disparaît » (lot 0.30.1)

Statut : en cours, branche `PROG-0301a` depuis `origin/main` `5191d828`. Registre « coquille, iOS et qualité » : BL-177.
Décisions d'origine : D-700, D-701 (Ali, 26/11), D-712, D-719 (choix prudents). Chapitres PRD : 17.1, 18 (§ 18.4, § 18.6), 23.1.
Inventaire et table P-01 à P-38 : `docs/PROGRES-0301.md`. Plage de décisions : D-720 à D-729.
Aucune migration, aucune table, aucun fichier de `src/sync/**`, `src/domain/**`, `src/features/training`, `src/features/nutrition`
ni du module santé touché.

## Passe product-owner : critères (étant donné / quand / alors)

1. Étant donné Progrès ouvert (iPhone 440 px et PC), alors une barre `role="tablist"` nommée « Progrès » montre 6 onglets `role="tab"`
   dans cet ordre : Récup, Séances, Bilan, Force, Corps, Activité ; un seul `role="tabpanel"` est rendu, nommé par son onglet
   (`aria-labelledby`), et l'onglet choisi porte `aria-selected="true"` et `aria-controls` vers ce panneau.
2. Étant donné Corps, alors une seconde barre `tablist` « Corps » montre Mesures · Santé · VISBODY · Photos, avec son propre panneau.
3. Clavier (PC et iPhone avec clavier) : un seul arrêt de tabulation par barre (onglet choisi) ; ← et → passent à l'onglet voisin (en
   boucle), Début et Fin au premier et au dernier ; l'activation suit le focus (D-719).
4. Étant donné un onglet et un sous-onglet choisis, quand Ali va dans une autre section puis revient sur Progrès (barre, palette), alors
   ils sont rendus tels quels ; quand Ali appuie sur Progrès (barre du bas, barre latérale ou Ctrl+4) alors que Progrès est déjà
   affiché, alors Progrès revient à Récup et Corps à Mesures (D-719). Mémoire seulement : rien dans `settings`, un redémarrage rouvre Récup.
5. Étant donné chaque onglet, alors ses blocs ne sont importés qu'à son ouverture ; l'hôte des onglets est lui-même un bloc à la
   demande ; `tests/bundle/start-modules.json`, le plafond de 358 400 octets et la mesure normalisée sont inchangés.
6. Règle absolue (D-700) : un test parcourt la liste figée P-01 à P-38 (fermée : mêmes ID que la table de `docs/PROGRES-0301.md`) et
   retrouve chaque élément, par un repère vérifiable (rôle et nom, ou texte du catalogue), dans le `tabpanel` de son onglet et
   sous-onglet, sur le gabarit iPhone et sur le gabarit PC ; les éléments d'une seule plateforme (P-13, P-14 iPhone ; P-15 PC) sont
   absents de l'autre, comme aujourd'hui. Il est rouge avant l'hôte en onglets, vert après.
7. Étant donné un onglet dont le bloc ne se charge pas, alors son panneau affiche « Impossible d'afficher cet écran. » et
   « Réessayer » (P-37) ; les autres onglets restent utilisables.
8. Les tests unitaires et e2e qui supposaient l'enchaînement des 7 blocs (SectionNotice, ErgoToday, BL-119, I6-06, captures)
   ouvrent l'onglet voulu ; aucun test désactivé, allongé ni retardé.

Hors périmètre : contenu des blocs (aucun texte, aucun calcul ni aucune donnée ne change) ; Corps › Mesures enrichi (BL-179) ; rappel
de mesure (BL-180) ; `src/domain/bodyProgress` ; CHANGELOG, version.

Exception annoncée (brief) : découpage de `BodyProgress` strictement nécessaire aux sous-onglets, sans changement de comportement du
rendu complet ; **la PR BL-179 (CORPS-0301c) modifiera `BodyProgress` ensuite et doit partir de ce découpage.**
