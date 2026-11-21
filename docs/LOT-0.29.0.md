# Lot 0.29.0 (prompt d'Ali, recopié tel quel)

Lot 0.29.0 : IA-0, PROG-02, MEDIA-03, PRD-I6, TECH-01. Décisions d'Ali du 19/11. À lancer APRÈS le lot des corrections de l'audit Codex (0.28.0), quand il est publié.
Ne pose aucune question : prends le choix prudent, consigne-le en D- « révisable par Ali », et continue. Réponds en français.
Usage réel en cours (D-292) : aucune donnée d'Ali dans le dépôt, les tests ou les journaux ; fixtures synthétiques uniquement.

Décisions d'Ali du 19/11 à consigner en D- au premier commit
- Fournisseur IA : aucun (D-294 confirmé) ; les fonctions « intelligentes » se font sans API payante.
- Compte Apple gratuit conservé : HealthKit direct, widgets, Apple Watch et push distant restent BLOCKED ; les raccourcis restent la voie Santé.
- Siri / App Intents, Camera Control et micronutriments : pas maintenant (réévaluation après quelques semaines d'usage).
- Pictogrammes dessinés pour les 95 exercices sans image.

Avant toute chose
- Vérifie que v0.28.0 et ios-v0.28.0 sont publiées et main vert ; sinon arrête-toi et dis-le. Recopie ce prompt dans docs/LOT-0.29.0.md.

Cadre (identique aux lots précédents)
- Un ticket = une branche = une PR depuis main à jour ; fusion dès la CI verte, sans tag ; un seul tag v0.29.0 à la fin, une compilation build-ios (publish=false), puis ios-v0.29.0.
- Attente de CI : une commande bloquante par run (gh run watch <id> --exit-status), puis une lecture ; au plus une lecture d'API GitHub par minute.
- Passes consignées par ticket : product-owner, agent du module, qa-test, code-reviewer ; test rouge avant le vert, SHA consignés ; cargo fmt --check puis clippy avant tout push Rust.
- Worktrees dans C:\Dev\spartiate\.codex-tmp\wt-<ticket> ; aucune action qui attend une autorisation ; un seul agent lourd à la fois.
- Budget par ticket ; docs/reprise.md à jour après chaque fusion ; arrêt si un ticket dépasse son budget ou au 2e compactage ; après un compactage, relire docs/reprise.md et docs/LOT-0.29.0.md.
- Bundle de départ jamais augmenté : tout nouvel écran à la demande, catalogue i18n avec lui ; migrations additives, catalogue syncTables, export/import avec lecture des versions précédentes garantie, relecture sync-icloud (D-26) dès qu'une table publiée change.

1. IA-0 — fonctions intelligentes sans fournisseur, budget L (product-owner, domain-logic, training, nutrition, ios-mobile pour l'essai)
a. Bilan hebdomadaire (PRD § 17.3, modèle de secours) : texte généré par règles à partir des faits de la semaine (séances faites / prévues, records, volume par groupe, poids et tendance, adhérence nutrition, sommeil moyen, semaine du cycle, décharge) ; aucun chiffre inventé, chaque phrase porte sa source ; jours sans données = phrase « pas assez de données » ; écran Progrès › Bilan (iPhone et PC), archivé par semaine, exportable.
b. Import de programme (I6-08 compris) : 1) collage d'un bloc structuré (format documenté dans docs/guide-import-programme.md, avec un exemple prêt à faire remplir par Claude dans une conversation) ; 2) lecture d'une photo ou d'une capture du programme par le plugin vision existant (D-200), puis analyseur de lignes « Exercice 4×8-10 », « 3 x 12 », « RIR 2 »… ; dans les deux cas, rapprochement des noms avec la bibliothèque (correspondance approchée, choix proposé si doute), aperçu complet avant création, aucune écriture sans confirmation ; une ligne non reconnue est montrée, jamais ignorée.
c. Saisie rapide des repas : repas favoris (enregistrer un repas du journal comme favori), « Copier le repas d'hier » et « Copier la journée d'hier », repas récents en un geste depuis Aujourd'hui et le journal ; quantités modifiables avant validation.
d. Essai Apple Intelligence (spike, sans engagement) : plugin Swift minimal qui interroge le modèle local d'Apple (Foundation Models, iOS 26) avec un texte synthétique et rend la réponse ; hypothèse H-n dans le PRD § 26.2 et ligne UNVERIFIED dans capability-matrix ; constat à faire par Ali sur son iPhone installé par SideStore (fonctionne ou erreur affichée telle quelle). Aucune donnée corporelle envoyée, même au modèle local, dans cet essai. Si le build iOS ne peut pas compiler ce plugin (SDK), consigne-le et passe.

2. PROG-02 — suivis complémentaires, budget M (recovery, nutrition, training, data-model)
- Objectif de pas : objectif quotidien réglable, progression du jour sur Aujourd'hui, moyenne hebdomadaire ; source pas.csv (H-25 reste UNVERIFIED : si le fichier est absent ou illisible, « — » avec sa raison).
- Cardio en zone 2 : zone 2 calculée depuis la FC max (âge ou valeur saisie, D-) ; minutes en zone 2 par semaine à partir des séances de cardio (durée et FC moyenne saisies ou importées), objectif hebdomadaire réglable.
- Notes sur 10 : chaque matin, fatigue et qualité du sommeil notées de 1 à 10 en un geste sur Aujourd'hui (facultatif, jamais bloquant) ; courbes dans Progrès ; prises en compte comme indice dans la récupération seulement si la règle est documentée en D-.
- Mesures VISBODY : saisie manuelle d'un bilan (date, poids, masse grasse %, masse musculaire, graisse viscérale, eau, métabolisme de base, mesures segmentaires si présentes) dans Progrès › Corps, courbes et écart au bilan précédent ; chaque champ facultatif.

3. MEDIA-03 — pictogrammes des exercices sans image, budget L (content-data, ui-design-system)
- Pictogrammes vectoriels (SVG) dessinés pour le projet, licence du projet consignée dans docs/licences.md : silhouette simple dans la charte bronze, position de départ et d'arrivée, muscle principal en accent ; même gabarit pour tous.
- D'abord 6 pictogrammes d'essai dans docs/maquettes/propositions/pictogrammes/ (dont 3 de la routine d'Ali), puis les 95, en commençant par les 8 de sa routine : Enroulement du tronc à la poulie, Extension triceps au-dessus de la tête à la poulie, Fente bulgare, Hip thrust à la barre, Relevé de jambes suspendu, Rowing à la machine avec appui poitrine, Tirage visage à la corde, Élévation latérale à la poulie.
- Une photo sous licence existante reste prioritaire sur le pictogramme ; budget média inchangé (validate-content vert) ; l'écran affiche « pictogramme » discrètement pour ne pas le confondre avec une photo.

4. PRD-I6, budget M — fonctions du PRD récupérées par Ali le 20/11 (settings-personalization, security-privacy, nutrition, ios-mobile)
- Verrou Face ID / code (§ 10.2, § 10.3, § 22, H-17 ; D-37 « code conservé, activation différée ») : activer le verrou local, désactivé par défaut, réglable dans Plus ; Face ID demandé à l'activation ; repli sur le code de l'iPhone ; jamais de verrou sur le PC sans décision (D-) ; constat à faire par Ali sur l'iPhone (ligne UNVERIFIED dans la matrice).
- Dépense ajustée aux pas (§ 15.2, modificateur des pas) : la dépense du jour tient compte des pas importés (pas.csv, H-25 UNVERIFIED : sans fichier lisible, aucun ajustement et la raison affichée) ; règle et bornes en D-, vecteurs d'abord ; le check-in et la dépense mesurée ne comptent jamais les pas deux fois.
- Décisions d'Ali du 20/11 à consigner : charge de départ d'un exercice jamais fait toujours saisie par Ali (D-72 (1) confirmée, pas de tables de standards) ; repas à la voix et import Hevy / Strong : non retenus pour l'instant (restent hors périmètre, motif « décision d'Ali du 20/11 »).

5. TECH-01 — dette technique, budget M (selon le module)
- CLEAN-03 : nettoyage des anciens tests de synchro (périmètre de la fiche CLEAN-03), relecture sync-icloud (D-26).
- DEP-01 : suivi des dépendances (mises à jour sûres, cargo audit et npm audit sans alerte sur le graphe livré, alertes de développement traitées ou justifiées).

Fin du lot
- CHANGELOG 0.29.0 (en tête si le schéma change : « Mets à jour le PC et l'iPhone le même jour »), tag v0.29.0, build-ios, ios-v0.29.0, publication.
- Rapport en 15 lignes au plus : PR fusionnées ; versions ; schéma ; D- créées ; nombre de pictogrammes ; constats à faire par Ali (bilan de la semaine, import d'un programme collé et d'une photo, favoris et copie d'hier, essai Apple Intelligence, pas, zone 2, notes, VISBODY, pictogrammes) ; ce qui reste.

Note (D-333, décision d'Ali du 20/11, 19 h 30) : l'arrêt pour budget ou au 2e compactage de ce cadre est levé ; règles 1 à 4 de D-333 applicables.
