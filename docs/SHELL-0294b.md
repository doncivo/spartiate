# SHELL-0294b — iPhone : « +30 s » de la notification, Live Activity, Info.plist, écran de confidentialité (lot 0.29.4)

Lot 0.29.4 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « coquille, iOS et qualité », deuxième PR (après SHELL-0294a, #216). Chapitres :
13.3 (minuteur de repos), 19.1 (plugins Swift), 19.3 (contrat `Info.plist`), 19.4 (entitlements), 18.3 (états dégradés). Décision d'origine : D-541
(§ 13.3 b). Choix prudents : D-598 à D-604, « Claude (choix prudent) ; révisable par Ali ». Aucune migration, aucune synchro. Swift compilé en CI
seulement (pas de Mac) ; aucun CONFIRMED (D-36) : les gestes à faire sur l'iPhone sont dans docs/constats-ali.md, section « 0.29.4 ».

## Passe product-owner (critères Étant donné / quand / alors)

1. § 13.3 b, BL-108 : étant donné un repos en cours sur l'iPhone et sa notification de fin livrée, quand j'appuie sur « +30 s », alors l'app s'ouvre,
   le repos annoncé reprend pour 30 s (échéance persistée, notification et Live Activity republiées) et l'écran de séance ouvert l'affiche ; quand
   j'appuie sur « Passer », le repos est arrêté et la Live Activity fermée. Une action arrivée plus de cinq minutes après l'échéance, ou sans séance,
   n'est pas appliquée et un bandeau bref le dit ; une action sur un autre repos que celui annoncé est ignorée. Un seul lecteur du fichier d'actions :
   une action « Pris » d'un complément et une action de repos dans le même fichier sont toutes deux appliquées, aucune n'est perdue.
2. BL-108 (Live Activity) : étant donné la Live Activity du repos, quand je touche « +30 s » ou « Passer » DANS l'activité, alors le repos suit —
   **non fait** (D-599 (5)) : cause écrite, ligne laissée « fait en partie ».
3. BL-129, C-158 : étant donné les textes d'usage de `Info.ios.plist`, alors aucun ne parle de « tâches » ni ne vouvoie ; la caméra cite le code
   d'association, le code-barres d'un aliment et les photos ; les entitlements sont relus contre le § 19.4 et l'écart est une décision écrite.
4. C-159 : étant donné le bouclier activé, quand la scène se désactive (sélecteur d'apps), alors le cache est posé et dessiné dans le même passage ;
   étant donné une lecture Vision bloquée, alors l'état « occupé » est libéré à la garde de temps, jamais pour la vie de l'app.
5. C-156, C-146 : étant donné deux démarrages rapprochés, alors une seule Live Activity existe, avec le dernier libellé ; le texte d'état final
   vient toujours de `src/i18n` ; la date de fin est refusée au-delà de 8 h ou dans le passé ; les libellés du menu de la zone de notification du PC
   sont bornés à 64 caractères et jamais vides.
6. C-157 : étant donné une action de notification reçue, alors le fichier est écrit sur la file du plugin, jamais en bloquant le fil principal, et
   le gestionnaire de fin d'iOS n'est appelé qu'après l'écriture.
7. BL-162 : étant donné le bandeau de signature à 440 px, alors « Voir » n'est jamais coupé. BL-163 : étant donné les scènes
   « Entrainement-indisponible » et « Degrade-apprentissage », alors la capture attend l'état visé.

## Passe agent du module (ios-mobile, notifications, coquille)

Fichiers : `src/domain/restNotificationActions.ts` (règle pure), `src/features/notifications/{actionDispatcher,restActions}.ts`,
`src/features/notifications/supplementWake.ts` (câblage, bloc déjà à la demande), `src/features/training/session/restController.ts` (exporté par
`TrainingScreen.tsx`), `ActiveSession.tsx` (relecture du repos sur l'événement `ct-rest-changed`), `src/i18n/fr.restNotifications.ts` (catalogue à la demande), `src/platform/notifications/{actions,
tauriNotificationActions,fakeActions,timerNotification}.ts`, `src/platform/liveActivity/{types,tauriLiveActivity}.ts`, Swift des plugins
`notification-actions`, `live-activity`, `privacy-shield`, `vision`, `src-tauri/src/live_activity.rs`, `src-tauri/src/desktop.rs`,
`src-tauri/Info.ios.plist`, `src/ui/StatusBanner.css`, `tests/visual/capture.spec.ts`.

- Tests qui figeaient un défaut, réécrits dans le commit rouge qui le dit : `scripts/ios/capIos01.test.ts` (« liste de tâches », « vous dictez »),
  `src/platform/liveActivity/liveActivity.test.ts` (texte d'état final facultatif) ; dans le commit vert : `scripts/ios/yIos02.test.ts` (texte
  caméra hérité, oublié du rouge).
- Entitlements inchangés (D-598, Q-33) : la clé de synchro du Trousseau ne doit pas changer de groupe sur une app installée.

## Passe qa-test (rouge → vert)

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| BL-129, C-158 (textes d'usage, entitlements contre § 19.4) | b7124e65 | 9fd1d0e1 |
| C-159 (privacy-shield, Vision occupé) | 0adfeb14 | 6336e19e |
| C-156, C-146 (Live Activity : file unique, libellé, texte final, lastError, date de fin bornée) | 11abd80d | 988a5358 |
| C-157 (fichier d'actions hors du fil principal) | 761cbfdf | a1328fcc |
| § 13.3 b, BL-108 (répartiteur, « +30 s » et « Passer » de la notification) | 6a7579b1 | 0640f587 |
| BL-162, BL-163 (bandeau, scènes visuelles) | 83c455a4 | 087524d8 |
| Relecture à froid (acquittement impossible vu par les compléments) | 370bc5fd | fa2946f4 |
| C-146 (libellés du menu de la zone de notification) | 9e79f32f | c96cb874 |
| Bundle de départ (D-604 : signal par événement, aucun bloc partagé de plus) | d194dc74 | 766e3d64 |
| CI run 45611919752 (scène Degrade-apprentissage sans cadrans) et relecture (env.document, texte neutre, tolérance Swift de 2 s) | 1569ff4a | 9ead656b |

Preuves locales : chaque rouge lancé seul et vu rouge (échec d'assertion, module absent, ou erreur de compilation Rust pour C-146) ; verts :
`scripts/ios` (180 tests), `src/platform` (consistance Swift, Live Activity, notifications), `src/features/notifications`, `src/features/training/session`,
`src/i18n`, `src/ui/StatusBanner*`, `tests/unit/visualCoverage.test.ts`, `cargo test --test desktop` (logic, notification_actions, capture_ios), `cargo clippy -D warnings`,
`npm run typecheck`, `npm run lint`, gardes documentaires. Le Swift n'est compilé que par la CI (`build-ios.yml` en fin de lot, pas par ce ticket) ; les e2e et
`visual` ne tournent qu'en CI. `SessionReplace.test.tsx` a échoué une fois sur une série de 99 fichiers lancée d'un seul travailleur (attente de 3 s dépassée sous
charge) ; vert seul, puis vert dans la série complète `src/features/training` et `src/i18n` (109 fichiers, 653 tests) après le dernier commit de code ; aucun délai allongé.

## Passe security-privacy (lecture seule, textes d'usage de `src-tauri/Info.ios.plist`, lignes 10 à 15)

- Caméra : les quatre usages cités existent (appairage par QR, scan du code-barres en Nutrition, photos de progrès de Progrès › Corps, programme lu
  par Vision) ; aucun usage caché. « Les photos restent sur l'iPhone » : vrai pour les photos de progrès (table locale, jamais publiée ni exportée,
  seule la fiche datée est synchronisée, `BodyProgress.tsx`) et pour la photo d'un programme (lue sur l'appareil, copies temporaires supprimées par
  `cleanTemporaryUploads`, aucun fournisseur IA, D-294). Le numéro du code-barres, lui, est cherché dans Open Food Facts : ce n'est pas une photo et
  le texte ne promet rien d'autre. Aucune photothèque (clé interdite au contrat).
- Micro et reconnaissance vocale : « Rien n'est enregistré » et « sans rien envoyer » vérifiés dans le plugin speech
  (`requiresOnDeviceRecognition = true`, aucun fichier audio écrit).
- Tutoiement, français, trois phrases au plus, aucune donnée personnelle ni nom de lieu ; aucun entitlement ajouté (D-598, Q-33).
- Verdict : approuvé.

## Passe code-reviewer (relecture à froid du diff)

- Défaut trouvé : le répartiteur acquittait lui-même après le passage des compléments ; un acquittement impossible n'était plus vu par le processeur des
  compléments (statut « done », état durable des échecs non posé), régression par rapport à FIX-0242. Test rouge 370bc5fd, correction fa2946f4 : l'`ack` de
  la vue est le seul acquittement, fait aussitôt si les actions de repos sont réglées.
- Course connue, consignée (D-599 (4)) : si la reprise de l'écran de séance efface le repos échu juste après l'application de « +30 s », le repos est à
  refaire dans la séance ; la séance relit l'échéance à chaque signal.
- Swift relu contre les tests statiques existants (`notification_actions.rs`, `capture_ios.rs`, `liveActivitySources.test.ts`, `lotM.consistency.test.ts`) :
  formes attendues gardées (`visionQueue.async`, `ActionStore.shared.append(entry)` avant `completionHandler()`, `ActivityContent(state: state, staleDate: endDate)`).
- Verdict : approuvé, sous réserve de la CI (suite verte) et de la compilation iOS de fin de lot.

## Mesure du bundle de départ

| Étape | Normalisé (octets) |
|---|---|
| main (build local du 25/11, origin/main 30b2ebb9) | 180 733 (brut 180 728) |
| première version de la PR | 180 819 (+86) |
| signal par événement, identifiants de repos dans le domaine partagé | 180 781 |
| contrôleur du repos exporté par le bloc de l'Entraînement | 180 759 |
| erreur simple dans le répartiteur (plus de bloc `actions` dans la liste du départ) | **180 734** (brut 180 728, identique à main ; +1 de normalisation des empreintes) |

Aucun module ajouté à la liste blanche `tests/bundle/start-modules.json` : le répartiteur, le gestionnaire du repos et leur catalogue
(`fr.restNotifications.ts`) sont dans le bloc déjà à la demande de `supplementWake.ts` ; le contrôleur du repos est dans le bloc de l'Entraînement.
La première version ajoutait des blocs partagés aux listes de préchargement du départ (+86 octets) : compensée par D-604 (commits d194dc74 et
766e3d64), mesures locales comparées bloc par bloc avec un build de main (`node tests/bundle/measureStart.ts`).

## Statuts

| Ligne | Statut |
|---|---|
| § 13.3 b | fait en partie (D-599) : constat d'Ali sur l'iPhone |
| BL-108 | fait en partie (D-599 (5)) : boutons de la Live Activity non faits (App Intents dans l'app et l'extension, sans App Group, invérifiables sans Mac) ; constat d'Ali de la notification |
| BL-129 | fait (D-598) |
| C-158, § 19.3 a | fait (D-598) ; § 19.4 a à trancher par Ali (Q-33) |
| C-159, § 19.1 b | fait en partie (D-600) : constat d'Ali H-32 |
| C-156 | fait en partie (D-601) : constat d'Ali |
| C-146 | fait en partie (D-601) : WM_ENDSESSION reste |
| C-157 | fait (D-602) |
| BL-162, BL-163 | fait en partie (D-603) : relecture des paires au prochain run `visual` |

Question ajoutée : Q-33 (entitlements du § 19.4). Constats ajoutés : docs/constats-ali.md, section « 0.29.4 » (§ 13.3 b, BL-108, C-156, C-159).
