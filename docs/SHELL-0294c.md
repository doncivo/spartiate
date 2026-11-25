# SHELL-0294c — interface : À propos et licences, focus et clavier, textes (lot 0.29.4)

Lot 0.29.4 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « coquille, iOS et qualité », troisième PR (après SHELL-0294a, #216, et SHELL-0294b, #217).
Chapitres : 18.1 (navigation), 18.2 (Plus), 18.3 (états dégradés), 18.6 (accessibilité), 21.3 (import). Choix prudents : D-605 à D-610,
« Claude (choix prudent) ; révisable par Ali ». Question : Q-34. Aucune migration, aucune synchro, aucun Rust ni Swift.

## Passe product-owner (critères Étant donné / quand / alors)

1. C-119, § 18.2 c : étant donné Plus (iPhone ou PC), quand j'ouvre « Licences », alors la liste des polices, icônes, données et bibliothèques de
   `docs/licences.md` s'affiche avec leur licence et l'avis BSD de d3-ease ; le retour ramène à Plus ; l'écran et son catalogue ne sont pas dans le départ.
2. C-120 : étant donné un bandeau « Annuler » en cours, quand un autre message arrive, alors les deux sont visibles (message au-dessus), « Annuler » reste actif.
3. C-121 : étant donné une fenêtre à piège de focus, quand le focus est sorti du conteneur, alors Tab l'y ramène ; quand l'ouvreur a été démonté
   à la fermeture, le focus va au contenu principal ; étant donné un groupe segmenté dont la valeur n'est dans aucun choix, alors son premier choix reste atteignable par Tab.
4. C-122 : étant donné une touche maintenue ou une saisie en composition, alors aucun raccourci ne se déclenche ; étant donné « Revoir mes réglages »
   ouvert, quand j'appuie sur Ctrl+/, alors la liste des raccourcis s'ouvre par-dessus sans démonter l'assistant.
5. C-074, C-124 : étant donné Aujourd'hui ouvert au passage de minuit (ou l'appareil réveillé le lendemain), alors la date de la barre PC et le contenu passent au nouveau jour.
6. C-075 : étant donné une lecture du profil en échec, alors Aujourd'hui dit l'échec et propose « Réessayer ».
7. C-126 : étant donné l'alerte « Vérification des mises à jour impossible », alors « Fermer » la masque pour la session ; étant donné une lecture de la
   signature en échec après une lecture connue à moins de 24 h, alors le bandeau reste. § 18.3 a : la ligne d'expiration de Plus (moins de 24 h, ou expirée) porte le lien « Voir la procédure SideStore » ; « Voir » du bandeau ouvre toujours Plus (e2e I-02).
8. C-127 : étant donné un import en mode « Remplacer » qui supprime des lignes, alors une seconde confirmation chiffrée est demandée ; le thème importé
   s'applique aussitôt ; la date de l'aperçu est celle du jour local.
9. BL-164 : « Enregistrer en recette » est désactivé tant qu'une quantité de l'assiette est invalide. BL-143 : le poids du sommaire PC vient d'une valeur
   structurée. BL-033 : le thème « système » enregistré retire le sombre de `index.html` au premier rendu.

## Passe agent du module (coquille)

Fichiers : `src/features/settings/{LicensesScreen,SideStoreScreen,SettingsScreen,SettingsScreenPc,SettingsPanels,ExportImportScreen,ProfileCard}.tsx`,
`src/i18n/{fr.licenses,fr.sidestore,fr.exportImport,fr.today,plusText,fileFailureText}.ts`, `src/features/app/{UndoToast,ShellChrome,TodayScreen,appStore,navigation,lazyScreens,screenNames,shortcuts}`,
`src/App.tsx`, `src/ui/{useFocusTrap,SegmentedControl,AppShell}`, `src/features/onboarding/OnboardingHost.tsx`, `src/features/updater/UpdateBanner.tsx`,
`src/features/signing/signingNotice.ts`, `src/features/nutrition/search/PlateCard.tsx`, `public/theme-init.js`.
Tests qui figeaient un défaut, modifiés avec écart consigné : `SettingsPc.test.tsx` (liste des entrées de Plus, « Licences » ajoutée), `fileSaveFailure.test.tsx`
(texte « exporte les logs » renvoyait à un écran inexistant), `ExportImportScreen.test.tsx` (« remplacer » sans seconde confirmation), `signingNotice.test.ts`
(« lecture en échec retire le bandeau »), `signingBannerKeep.test.ts` (3e test, corrigé avec 21a78bd5), `SideStoreScreen.test.tsx` et `LicensesScreen.test.tsx` (ces écrans sont servis par le bloc à la demande de l'écran Plus : le test vérifie ce bloc au lieu d'un nom dans l'inventaire des écrans, pour n'ajouter aucun écran au départ),
`App.test.tsx` (retrait de `spaceFilter`), `prog01AfterMerge.test.tsx` (le remplacement qui supprime des lignes passe par la seconde confirmation).

## Passe qa-test (rouge → vert)

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| C-119, § 18.2 c | e692afec | 504790c4, 89ac38e4 (texte d'échec de fichier) |
| C-120 | 595f7ce7 | f59f9138 |
| C-121 | 908af46a | 2ab45cb1 |
| C-122 | cc5d9ea8 | 48fb324d |
| C-074, C-075, C-124 | 6e8e8dec | 09d2b9e6 |
| C-127 | be91cca8 | 7680dde3 |
| C-126, § 18.3 a | ebd605c3 | 71f8fcd1 |
| § 18.3 a (correctif : lien dans la ligne d'expiration, « Voir » vers Plus pour le e2e I-02) | 21a78bd5 | 7da772d4 |
| BL-143 | c44427f8 | 72edb6b3 |
| BL-164 | a633ab88 | 72edb6b3 |
| BL-033 | 859f4147 | 2a772e97 |
| Lint (setState hors effet, textes de test) | | 1f0066f1 |
| Bundle de départ (D-610) | | 10febe52 |

Chaque rouge a été lancé seul et vu rouge (module absent ou assertion) avant son vert. Verts locaux : `src/ui`, `src/features/app`, `src/features/settings`,
`src/features/signing`, `src/features/updater`, `src/features/onboarding`, `src/features/nutrition/search`, `src/i18n`, `npm run typecheck`, `npm run lint`,
`startBundle.test.ts` et les gardes documentaires. Les e2e (`I-04`, parcours Plus) et `visual` ne tournent qu'en CI : le sommaire PC compte une entrée de plus
(« Licences »), `tests/visual` n'est pas touché.

## Passe code-reviewer (relecture à froid du diff)

- Le bandeau « Annuler » et le message empilés : la région `role=status` de chaque `Toast` reste unique par message ; l'annonce du bouton par les lecteurs d'écran n'est pas traitée (reste C-120).
- `useFocusTrap` : le repli sur `<main>` suppose le `tabIndex={-1}` posé sur `AppShell` (fait) ; la lecture « Tab hors conteneur » ne filtre pas les éléments masqués (reste C-121).
- `ExportImportScreen` : le thème importé est posé sans importer `theme.ts` (bundle) : la barre de titre Windows suit au prochain démarrage (D-609).
- `signingNotice` : le bandeau gardé sur échec de lecture se recalcule chaque minute depuis la dernière échéance connue ; sans échéance connue, aucun bandeau.
- Relecture à froid distincte (PR #218) : verdict « à corriger » ; points : assertion facultative de prog01AfterMerge, avis d3-ease en paraphrase, fermeture de l'alerte de mise à jour jamais réarmée, commentaires périmés, double lecture d'Aujourd'hui.
- Corrigé (rouge f02f4000, vert : voir le commit « corrections de la relecture à froid ») : seconde confirmation exigée ou absente selon les suppressions ; texte intégral de `node_modules/d3-ease/LICENSE` affiché (catalogue à la demande, test qui le compare au fichier) ; une nouvelle vérification réarme l'alerte ; commentaires remis à jour.
- Noté, non corrigé : au retour un autre jour, Aujourd'hui lit deux fois (le jour du store, ancien, puis le nouveau) ; sans effet visible, la seconde lecture remplace la première.
- Verdict après corrections : approuvé, sous réserve de la CI.

## Mesure du bundle de départ

| Étape | Normalisé (octets) |
|---|---|
| main (origin/main 46b43594, build local du 25/11) | 180 734 (brut 180 750) |
| première version de la PR (48 blocs) | 182 122 (+1 388) |
| jour courant par `appStore.day`, état hérité retiré | 180 948 (+214) |
| `useLocalDay` hors du départ, table `MORE_SCREENS` | 180 774 (+40) |
| Licences et SideStore servis par `SettingsScreen` | **180 696** (brut 180 693, 45 blocs, bloc `main` −59 octets gzip) |

Causes des blocs de plus (D-604 déjà vue) : un module du départ importé par un écran à la demande devient un bloc partagé listé dans le préchargement (`ShellChrome` par Aujourd'hui, `theme.ts` par l'import, `settingsStore` par l'import à la demande). Aucun module ajouté à `tests/bundle/start-modules.json` ; `startBundle.test.ts` et `startModules.test.ts` verts. Comparaison bloc par bloc avec un build de main (`blocks` = somme gzip par bloc de la liste de départ).

## Statuts

C-119, C-122, C-124, C-126, BL-143, BL-164, BL-033, § 18.2 c : fait. C-120, C-121, C-074, C-075, C-127, C-131, § 18.3 a, § 18.1 e : fait en partie (cause écrite dans docs/backlog.md).
C-076, C-084, C-085 : à faire (non traités, cause écrite). Question ajoutée : Q-34. Constats ajoutés : docs/constats-ali.md section « 0.29.4 » (C-119, § 18.3 a, C-074).
