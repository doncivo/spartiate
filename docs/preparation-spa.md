# Préparation des tickets Spartiate

1er novembre 2026 — CADRAGE-01. Complément opérationnel à SPA-001 v2.4, après relecture du socle et de D-49 à D-53. Aucun code ni PRD modifié par ce lot. Les 24 rôles suffisent ; aucun agent supplémentaire.

Les corrections factuelles déjà décidées s'appliquent dans SPA-001. Les choix de conception ci-dessous restent à arrêter dans le ticket indiqué, par le propriétaire et les relecteurs nommés ; une modification du produit ou du PRD requiert une décision D-n d'Ali. Une ligne ouverte n'est jamais une capacité acquise. Pas de blocage de SPA-001a pour une décision propre à I1 ou I4.

## P-01 — Contrôles documentaires, avant SPA-001a

Auteur : ci-release pour les scripts, architect pour les contrats des fiches ; relecture : qa-test et product-owner. qa-test possède les changements de configuration Vitest.

- Exactement 24 fiches, README exclu du frontmatter et du décompte. YAML parsé avec un parseur explicite et une dépendance déclarée si nécessaire, pas une expression régulière ; noms uniques et concordants, champs requis non vides, six rubriques ordonnées.
- Définir une convention déterministe pour les références actives, historiques, négatives et futures. Une ancienne identité servant à protéger des données doit passer ; la même identité prescrite comme identité active doit échouer. Les exceptions sont attachées à la mention, motivées et testées, jamais à un fichier entier.
- D-50 : résoudre les chemins relatifs au contexte déclaré, distinguer globs et paramètres de fichiers littéraux. Les chemins futurs ont un ticket et un propriétaire dans le registre prévu ; les décisions historiques ne sont ni effacées ni réécrites pour rendre le test vert. Le pont Rust d'un plugin reste sous son dossier, distinct du point d'enregistrement de l'app.
- D-49 : vérifier l'ordre et le contenu des sections, les tableaux, blocs de code et renvois. Comparer au texte source du commit de départ ; isoler les corrections D-47/D-48 dans un diff identifiable. Un compte identique de titres ne détecte pas une perte de paragraphes.
- D-51 : le script de renommage travaille sur une liste de fichiers suivis dans le dépôt ; pas de parcours des données utilisateur. Deuxième exécution sans changement. Protection explicite des références aux données CircleTasks et des preuves historiques.

Preuves : fixtures positives et négatives pour chaque distinction, commit de tests rouge avant implémentation, tests ciblés verts ensuite, suite verte en CI. Les tests seront créés en SPA-001a ; cette préparation ne prétend pas les avoir exécutés.

## P-02 — Base de laboratoire 19 → 1, avant SPA-001b

Auteur : data-model + desktop-tauri ; relecture : sync-icloud et qa-test. Livrable : procédure incluse dans l'inventaire soumis à Ali.

Un démarrage en 001a peut créer une base Spartiate au schéma 19 ; le migrateur refuse ensuite une application au schéma 1. Déclarer la provenance synthétique, l'emplacement isolé et le cycle de vie de la base de recette. Préférer une nouvelle fixture ou un environnement isolé. Toute réinitialisation d'un conteneur existant exige une cible vérifiée et une autorisation explicite ; D-38 n'autorise pas une suppression implicite. Ne jamais intervenir sur les données CircleTasks. Si Ali a commencé l'usage réel, arrêter cette procédure de laboratoire.

Preuves : base vide → schéma 1 ; base 19 → refus explicite sans altération ; checksum divergent → refus ; sauvegarde/restauration et transactions. H-18 : mêmes cas et DDL pertinents sur Wasm et SQLite natif, résultats consignés séparément ; un test du plugin seul ne prouve pas toute la parité des migrations.

## P-03 — Identité des données synchronisées, avant le schéma de SPA-001b

Auteur : sync-icloud pour le contrat d'identité et le catalogue ; data-model pour contraintes/repositories ; architect arbitre la conception, product-owner les comportements métier.

Arrêter et consigner : identité du profil unique ; identité d'une pesée (jour, source, fuseau, identifiant HealthKit éventuel) ; comportement de plusieurs saisies manuelles le même jour ; création indépendante sur deux appareils ; édition, suppression et recréation. Choisir entre identités déterministes et réconciliation explicite, sans inventer la règle pendant l'écriture de la migration. Toute exception à l'identifiant prévu au PRD est proposée à Ali sous forme de D-n.

Preuves : deux bases hors ligne créent le même objet logique avec des identifiants initialement distincts ; échanges dans les deux ordres, répétition des messages, convergence sans erreur UNIQUE ni doublon de profil ; suppression/recréation ; valeurs concurrentes résolues par le contrat. settings n'est jamais publié en I0 (D-47).

## P-04 — Versions et publication, avant SPA-002

Auteur : ci-release ; relecture : desktop-tauri, ios-mobile et qa-test.

Proposition à reporter au PRD après décision : prendre 0.1.0 comme N (identité imposée par SPA-001a), puis 0.1.1 comme N+1 ; aligner tags Windows/iOS, configuration, paquets, notes et recettes. Aucun tag 0.0.x avec une application 0.1.0. Confirmer les versions réellement disponibles avant l'essai et consigner les identifiants des artefacts.

RELEASES_TOKEN doit être disponible avant la première publication Windows SPA-002 ; il sert aussi à SPA-003. La paire minisign reste propre à Spartiate. Preuves : contrôles de version exacts, publication vers spartiate-releases, mise à jour N → N+1 sans perte. Aucune valeur de secret dans les preuves.

## P-05 — HealthKit et sortie I0, avant SPA-003 / SPA-006

Auteur : ios-mobile ; relecture : recovery, security-privacy et qa-test ; product-owner propose la clarification du critère I0 à Ali.

Le critère obligatoire d'entitlement HealthKit doit être conditionné au résultat du spike : il ne peut empêcher un résultat BLOCKED avec fallback autorisé. Distinguer build, signature finale, permission, lecture du poids, lecture des pas, écriture et suppression d'un poids créé par Spartiate. Une simple lecture de bodyMass ne confirme pas l'ensemble de H-3. Définir quels essais appartiennent au spike et lesquels restent à I5 ; leur absence reste visible dans la matrice.

Preuves : entitlement de l'artefact installé, opérations réellement testées et résultats datés, refus de permission et fallback manuel. Aucun statut CONFIRMED depuis le code seul. Ne jamais supprimer des échantillons Santé appartenant à une autre source.

## P-06 — Délai de synchronisation, avant SPA-008

Auteur : sync-icloud ; relecture : performance et qa-test.

Le moteur hérité a un intervalle de cinq minutes. Spécifier les déclencheurs d'envoi après transaction et de réception, la reprise après arrière-plan, la coalescence et le comportement hors ligne. Ne pas transformer le délai produit en promesse inconditionnelle sur la propagation iCloud.

Preuves : départ du chronomètre et arrivée définis, préconditions réseau et état des deux apps consignés, aller/retour < 60 s dans ces conditions, sans action manuelle si le parcours l'exige ; panne durable visible ; reprise sans doublon. Tests de planification à horloge contrôlée, puis recette sur appareils. Aucun délai ou timeout de test allongé pour masquer un défaut.

## P-07 — Export/import, avant SPA-005

Auteur : settings-personalization + desktop-tauri + data-model ; relecture : sync-icloud, security-privacy et qa-test.

Livrable : contrat versionné précisant données et préférences exportées, liste blanche excluant secrets/identité d'appareil/bookmarks, conservation des identifiants métier, mode de restauration/remplacement ou fusion, traitement des doublons et de la republication. Distinguer sauvegarde complète et filtre de publication : dès I1, une séance ouverte doit avoir un traitement explicite dans l'export même si elle n'est pas encore publiée.

Définir la projection canonique comparée par le hash (ordre stable, valeurs métier, métadonnées exclues) : des HLC régénérés ne doivent pas rendre la recette ambiguë. Présenter toute modification de la recette PRD à Ali. Validation complète avant écriture, transaction ou stratégie de récupération documentée, erreur persistante et visible sans succès partiel silencieux.

Preuves : aller-retour, archive corrompue, version future, interruption, import répété, références manquantes, état des appareils après restauration. Utiliser exclusivement des fixtures synthétiques.

## P-08 — Critère de sortie I0, avant SPA-010

Auteur : product-owner ; relecture : qa-test puis code-reviewer.

La matrice associe chaque exigence à un ticket, une preuve et un état (prouvé, ouvert, BLOCKED avec fallback accepté). Contrôler P-04 à P-07, I-06, renouvellement, coexistence et preuves N → N+1. Le code fusionné ne vaut pas recette native. Écrire le go/no-go d'Ali sans présenter un test non effectué comme réussi.

## P-09 — Références d'exercices, avant I1

Auteur : data-model + content-data ; relecture : training, sync-icloud et architect.

Définir le lien entre identifiants stables kebab-case de la bibliothèque JSON et références SQL : lignes de référence locales non publiées ou références logiques validées vers l'union bibliothèque/custom. Ne pas créer de clé étrangère vers une ligne absente. Documenter les exceptions UUID, la version de bibliothèque et la conservation des références historiques. Preuves : exercice embarqué/custom, suppression, ancienne bibliothèque, import/synchro de références inconnues.

## P-10 — Calculs métier, avant le ticket de chaque moteur

Auteur : domain-logic avec training / nutrition / recovery ; relecture : qa-test ; Ali valide les choix fonctionnels non tranchés.

Fournir formules et vecteurs avant implémentation : référentiel des standards et agrégation du StrengthScore ; interpolation de récence/dispersion ; définition et persistance d'une journée nutrition complète ; facteur sommeil et frontières de nuit/fuseau, déduplication des sources. Valeur absente distincte de zéro. I4 : ai-integration précise aussi réservation du budget, concurrence, coût inconnu et erreurs ; pas de plafond garanti sans mécanisme vérifiable.

## Reports proposés au PRD, sans modification dans ce lot

1. § 7 / 25 : versions cohérentes P-04 et critères HealthKit conditionnels P-05.
2. § 20 : identité profil/pesées P-03 et références d'exercices P-09, après choix documenté.
3. § 9 / 10 / SPA-008 : délai et conditions de mesure P-06.
4. § 21 / SPA-005 : contrat d'import et projection canonique P-07.
5. § 11–16 : formules/vecteurs manquants P-10 dans les tickets de moteurs.

Ces propositions s'ajoutent au report déjà approuvé D-47/D-48 et au découpage D-49 ; elles ne sont pas numérotées comme décisions acquises.

## Passe de préparation CADRAGE-01

- Product-owner : périmètre documentaire ; corrections factuelles immédiates, arbitrages répartis selon leur échéance, aucun rôle ajouté.
- Architect : matrice et fiches alignées ; catalogue conservé chez sync-icloud ; icône chez ui-design-system ; consignes chez product-owner ; contrôles chez ci-release.
- QA : contrôle ponctuel des 24 frontmatters avec le parseur YAML installé, unicité des noms et six rubriques ; reprise sous 5 000 octets ; diff sans changement du PRD, des décisions ou du code ; contrôle des espaces et recherche de secrets (seules mentions de motifs dans les consignes). Les contrôles permanents de SPA-001a restent à implémenter.
- Relecture locale du diff : correction de la matrice README et vérification des responsabilités après les edits. La revue de PR D-53 reste à effectuer après CI verte ; aucun statut « fait » attribué à SPA-001.
- Validation du bundle et statut CI : consignés dans la PR de CADRAGE-01. Aucun e2e local ni build iPhone dans ce lot documentaire.
