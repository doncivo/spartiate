# SHELL-0299 — « Journaux » partout, plus aucun « Logs » visible (lot 0.29.9)

Statut : **fait en partie** (reste D-686), branche `SHELL-0299` depuis `origin/main` `89d2a5da`. Registre « coquille, iOS et qualité » : BL-168, C-131.
Décision d'origine : D-649 (Ali, 26/11, Q-34). Chapitre PRD : 18 (navigation, textes, § 18.2 et § 18.4). Choix prudents : D-686, D-687, « Claude (choix prudent) ; révisable par Ali ». Aucune question.
Aucune migration, aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src-tauri/**`, Swift, `src/features/training`, `src/features/nutrition`, `src/domain/training` ni du module santé touché ; aucun test désactivé, allongé ni retardé. Bundle de départ inchangé (`fr.logs.ts` est chargé avec les Réglages ; aucune entrée ajoutée à `tests/bundle/start-modules.json`).

## Passe product-owner : critères (étant donné / quand / alors)

1. Étant donné Plus sur l'iPhone (groupe APP) et sur le PC, quand Ali regarde la ligne du journal technique, alors elle dit « Journaux » ; le bouton s'annonce « Ouvrir l'écran des journaux ».
2. Étant donné l'écran du journal, alors son titre (h1) est « Journaux » ; après un export réussi, le message est « Journaux exportés » ; la confirmation d'effacement est « Effacer les journaux ? ».
3. Étant donné un export, alors le fichier proposé s'appelle `spartiate-journaux-AAAAMMJJ-HHMM.txt` (D-687).
4. Étant donné tous les catalogues de `src/i18n` (hors tests), quand la garde lit leurs littéraux (commentaires retirés), alors aucun texte ne contient « log » ou « logs », sauf l'exception nommée `fr.health.ts` (D-686), qui ne peut que se réduire.
5. Les e2e `I-04`, `lot-f-qa`, `lot-f-screens` et les tests unitaires qui nomment ces textes suivent ; les e2e sont prouvés par la CI de la PR. Les chemins « Plus › APP › Logs » de `docs/constats-ali.md` (dont la section « CSP stricte (D-650) ») deviennent « Plus › APP › Journaux ».

Hors périmètre : noms techniques invisibles (dossier `logs/`, `tLogs`, écran interne `logs`, `__ctLogs`) ; commentaires de code ; CHANGELOG.

## Passe agent du module (coquille ; settings-personalization pour l'écran du journal)

- `src/i18n/fr.logs.ts` : `rowLabel`, `title` → « Journaux » ; `rowOpenLabel`, `exportDone`, `clearTitle` suivent.
- `src/i18n/fr.nutrition.ts` (`offTls`, catalogue de `src/i18n`, pas `src/features/nutrition`) : « exporte les journaux depuis Plus › Journaux ».
- `src/features/settings/logs/logExport.ts` : nom de fichier `spartiate-journaux-…` (D-687).
- Le PC disait déjà « Journaux » dans la liste de Plus (`plusText.ts`, `navLogs`) ; le panneau ouvert reprend le titre de l'écran.
- `docs/constats-ali.md` : 5 chemins mis à jour (remplacement exact par sed).

## Passe qa-test : rouge puis vert

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| BL-168 | d859ca3b (garde `src/i18n/noLogsWord.test.ts` : 5 textes de `fr.logs.ts`, 1 de `fr.nutrition.ts`, titre et ligne pas encore « Journaux ») | 427d1fa7 |

Tests unitaires mis à jour par remplacement exact (`name: 'Logs'`, « Logs exportés », « Ouvrir l'écran des logs », `spartiate-logs-`) : `ErgoP5`, `PlusErgo02`, `SettingsScreen`, `LogsScreen`, `logsQa`, `logsRow`, et les trois e2e. Local : 14 fichiers, 226 tests verts ; `vitest related` sur les fichiers changés, typecheck et lint (résultats dans la PR). Les captures visuelles (`tests/visual/capture.spec.ts`) ne comparent pas d'image de référence : rien à refaire.

## Passe code-reviewer (relecture à froid)

Voir la PR.

## Constats à faire par Ali

Déjà au registre des constats (`docs/constats-ali.md`, section « CSP stricte (D-650) ») : iPhone, Plus › APP › Journaux s'ouvre et s'appelle « Journaux » ; PC, Plus › Journaux.
