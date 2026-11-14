Lot 0.25.0 : FIX-0242, FIX-0241, ERGO-02b, SYNC-01. Décision d'Ali du 14/11 : ces quatre tickets forment un seul déploiement.
Ne pose aucune question : prends le choix prudent, consigne-le en D- « révisable par Ali », et continue.

Avant toute chose
- Vérifie que v0.24.0 est publiée et que main est vert. Sinon, arrête-toi et dis-le.
- Recopie ce prompt tel quel dans docs/LOT-0.25.0.md (commit et push dans la première PR du lot).

Cadre du lot
- Un ticket = une branche = une PR, chacune partant de main à jour. Chaque PR est fusionnée dès que sa CI est verte (une seule lecture de la CI à la fois), sans tag.
- Pendant la CI d'un ticket, commence le suivant s'il ne touche pas les mêmes dossiers.
- Un seul tag à la fin : v0.25.0, posé quand Tests sur main est vert après la dernière fusion. Une seule compilation build-ios pour tout le lot (publish=false sur le dernier commit), puis ios-v0.25.0 pour publier sur l'iPhone.
- Passes consignées pour chaque ticket : product-owner, agent du module, qa-test, code-reviewer. Un test rouge avant le vert, SHA consignés.
- Avant tout push qui touche du Rust : cargo fmt --check, puis clippy.
- Si un job échoue sur un commit qui ne touche pas son périmètre : une seule relance des jobs en échec. S'il redevient vert, consigne le test comme instable ; s'il échoue encore, corrige-le.
- Pousse après chaque étape verte.
- Le budget s'entend par ticket : à la fin de chaque ticket fusionné, mets docs/reprise.md à jour (ticket suivant, étape) puis enchaîne le suivant dans cette session. Arrête-toi seulement si un ticket dépasse son budget M ou après le 2e compactage de contexte ; dans ce cas, arrêt propre et rapport.
- Après chaque compactage, relis docs/reprise.md et docs/LOT-0.25.0.md avant de continuer.
- Bundle de départ : aucun ticket ne l'augmente. Fixtures synthétiques uniquement, aucune donnée d'Ali.

1. FIX-0242, budget M (agents : training, settings-personalization, notifications, nutrition)
- Bloquant GPS : le suivi ne démarre jamais et ne continue jamais après le démontage de l'écran Cardio (CardioGps.tsx:33/69). Tests de démontage pendant la demande d'autorisation et pendant le suivi.
- Bloquant onboarding : une synchro reçue entre l'aperçu et la validation ne fait jamais écrire de pesée non saisie (OnboardingFlow.tsx:242, onboardingData.ts:165, review.ts:100).
- Cardio : la séance et le tracé s'écrivent dans une seule transaction, sans doublon au nouvel essai (cardioRepository.ts:68).
- « Pris » : une erreur laisse un état durable et visible sur Aujourd'hui, pas un message furtif (supplementActions.ts:76/114, supplementWake.ts:65).
- Affichage :
  - « 1 g » et non « 1 G » ;
  - le libellé « Qualité : bonne » du sommeil devient un libellé sans ambiguïté (D-).
- Test du masque des jours d'un complément, de la saisie au rappel, vendredi compris.
- Test instable TodayScreen.test.tsx:61 (« sans profil : carte d'accueil ») : cause trouvée et corrigée, sans allonger les délais.
- capability-matrix : H-34 et H-36 passent en CONFIRMED, d'après les constats d'Ali sur l'iPhone le 13/11.
  - H-34 : le rappel apparaît sans le nom du complément sur l'écran verrouillé.
  - H-36 : « Pris » coche la prise sans ouvrir l'app, même app fermée, et la prise est visible sur Aujourd'hui et sur le PC.

2. FIX-0241, budget M, d'après la fiche fusionnée dans la #130 (agents : ui-design-system, accessibility-i18n)
- Écrans PC corrects de 1 024 à 1 920 px. Ali utilise environ 1 210 px ; Corps y casse aujourd'hui.
- Largeur de 1 280 px ajoutée aux captures de la CI.
- Pluriels gérés partout (« 1 jour », « 2 jours »).

3. ERGO-02b, budget M (agents : performance, domain-logic, training, nutrition)
- Bundle de départ : option A (configuration du build) pour revenir sous le niveau de la 0.22.3, en absorbant aussi les +321 octets de D-274. Mets à jour D-265 et D-274.
- Calculs d'écran déplacés vers src/domain.
- Mention « par haltère » cohérente.
- La semaine affichée sur le PC suit le réglage.
- Chaînes inutilisées retirées des catalogues i18n.
- Tests à ajouter : la case « pris » ; les dates Renpho.
- Jours d'entraînement par défaut repris de la routine active.
- Le réglage du mésocycle fait à l'onboarding ne s'applique qu'au premier cycle.

4. SYNC-01, budget M, en dernier (agents : sync-icloud, obligatoire selon D-26, et data-model)
- D-275 : une ligne créée par un appareil resté au schéma précédent ne doit plus jamais être perdue en silence.
- Minimum attendu :
  - détection ;
  - bandeau sur l'appareil à jour (« un appareil utilise une version plus ancienne, mets-le à jour ») ;
  - ligne conservée, puis reprise après la mise à jour.
- Tests de non-régression entre deux appareils de schémas différents.
- Si la correction complète exige de changer le format des journaux de synchro : livre seulement la détection, le bandeau et la conservation, puis rédige un ADR de proposition pour le reste. Ne change jamais le format sans validation d'Ali.

Fin du lot
- CHANGELOG de la 0.25.0, tag v0.25.0, build-ios, ios-v0.25.0, publication.
- Rapport en 15 lignes au plus :
  - PR fusionnées ;
  - versions publiées (PC et iPhone) ;
  - D- créées ;
  - bundle de départ, avant et après ;
  - constats à vérifier par Ali sur l'iPhone et sur le PC : GPS, onboarding, « Pris » en erreur, écrans à 1 210 px, bandeau de version ;
  - ce qui reste.
