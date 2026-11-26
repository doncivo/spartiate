# NUTRI-0299 — BL-172 (saut de ligne final des fichiers du raccourci récupération) et BL-173 (Stratégie lit l'objectif du profil)

Lot 0.29.9, module « nutrition et récupération ». Sources : docs/backlog.md (BL-172, BL-173, C-056, C-106), D-649, D-664, D-669, D-680.
Chapitres : 15 (nutrition, Stratégie et check-in), 16 (récupération, fichiers Raccourcis), 18 (Plus › Apple Santé). Décisions : D-690 à D-692.
Aucune migration, aucune table publiée changée, rien dans src/sync, src/domain/sync, src-tauri/src/sync ni src/platform/sync (pas de relecture
sync-icloud). Hors périmètre : src/features/training, src/domain/training, textes des journaux.

## Statut

**Livré :** BL-172 (refus du fichier sans saut de ligne final, message dans Plus › Apple Santé, guide B.1 étape 3 bis) ; BL-173 (objectif lu du
profil en lecture seule, rythme en Stratégie, même objectif pour le check-in) ; ajout du coordinateur : 5 textes de Santé sans « Logs » (D-649).
**Reste :** constat iPhone d'Ali (docs/constats-ali.md, « Décisions du 26/11 », D-664) : modifier le raccourci, puis importer.

## Passe product-owner

BL-172 (D-664, D-680, C-056)
1. Étant donné `hrv.csv`, `fc-repos.csv`, `sommeil.csv` ou `pas.csv` sans saut de ligne final, quand l'import le lit, alors le fichier est
   refusé en entier (aucun échantillon, aucune date de dernier import) et les autres fichiers sont importés.
2. Étant donné un tel refus, quand Ali regarde Plus › Apple Santé, alors la ligne du type et la phrase de l'appui disent quoi modifier dans
   le raccourci « Spartiate — récupération » (action Texte après Combiner le texte) ; textes dans src/i18n.
3. Étant donné un fichier vide ou blanc, ou terminé par LF, CRLF, ou suivi d'espaces, alors il n'est jamais refusé pour ce motif.
4. `poids.csv` et les fichiers « Spartiate — corps et nutrition » ne passent pas par cette règle (D-680).
5. Le guide (docs/guide-raccourcis-sante.md, B.1) décrit l'étape ; la garde healthShortcutsGuide la vérifie.

BL-173 (D-669, C-106)
1. Étant donné un objectif au profil (Réglages › Corps), quand Ali ouvre Stratégie, alors il est affiché en lecture seule (« Objectif du
   profil : Perte »), sans second réglage « Objectif », avec un renvoi « Modifier dans Réglages › Corps ».
2. Étant donné un objectif de perte ou de prise, alors la ligne « Rythme » se règle en Stratégie et s'enregistre dans `nutrition.prefs`, même
   forme JSON ; objectif « maintien », pas de rythme.
3. Étant donné un profil sans objectif, alors l'ancien choix des préférences est gardé et dit (« non renseigné, « Prise » gardé »).
4. Le check-in reçoit le même objectif que Stratégie (`snapshot.goal`). Aucune migration ; si une table publiée devait changer : arrêt (non).

## Avis data-model (BL-173, outil Agent, subagent_type data-model)

- Le snapshot nutrition lit déjà le profil (`loadNutritionSnapshot`, src/features/nutrition/useCases.ts) : aucune requête ni schéma nouveau.
- `nutrition.prefs` est un réglage local (`scope: 'local'`, src/domain/model/settings.ts) ; `settings` n'est pas publié, `profile` l'est et
  n'est que lu. La forme JSON gardée ne pose aucun risque (`parseNutritionPrefs` tolérante).
- Recommandations, suivies (D-691) : profil sans objectif, repli sur les préférences, puis maintien ; rythme repris seulement pour la même
  sorte, sinon 0,25 kg ; `prefs.goal.kind` gardé (repli, et l'onboarding l'écrit encore) ; rythme local, il peut différer entre appareils.
- Confirmation : aucune migration, aucune table publiée changée.

## Passe agent du module (nutrition et récupération)

- `lacksFinalNewline` (src/domain/recovery/shortcutFiles.ts) ; état `unterminated` et événement `recovery-import-file-unterminated`
  (src/features/settings/recoveryImport/service.ts) ; phrases `recUnterminated`, `recDoneUnterminated` (src/i18n/fr.health.ts).
  La règle est dans l'import, pas dans `readRows`, partagé avec la partie C (D-690).
- `effectiveGoal`, `DEFAULT_GOAL_RATE_KG` (src/domain/nutrition/prefs.ts) ; `NutritionSnapshot.goal` ; CheckInView et StrategyView
  l'utilisent ; ligne `ct-strategy__static` (NutritionScreen.css, tokens seulement) ; `goalDefaultHint`, `goalValueRate` retirés.
- Ajout du coordinateur (D-649, D-692) : `recFailed`, `recDoneFailed`, `technicalShare`, `bodyFailedLast`, `bodyFailed` donnent
  « journal technique (Plus › Journaux sur le PC, Plus › APP › Journaux sur l'iPhone) ». src/i18n/noLogsWord.test.ts non touché (SHELL-0299).
- Fixtures de tests réécrites par script (D-51) : textes de fichiers terminés par un saut de ligne (service.test, service.c058.test,
  service.fixRecup.test), compte `unterminated` du journal « done ».

## Passe qa-test

- BL-172 : rouge `92bd1672` (attente de shortcutFiles.steps.test.ts changée, plus service, phrase et section), vert `b4d7b0cc`.
- BL-173 : rouge `f17fb2f9` (effectiveGoal.test, Strategy0299.test ; attentes de StrategyErgo03, NutritionScreen, Strategy0292), vert
  `8e1e5b2d`.
- D-649 : rouge `21361722` (healthPrivacy.test), vert `56b3555c`.
- En local : src/domain/recovery, src/features/settings/recoveryImport, RecoveryImportSection, src/domain/health, src/domain/nutrition,
  écrans Nutrition et check-in, `vitest related` des sources de BL-173, healthShortcutsGuide ; typecheck et lint verts.
- Instabilité locale connue, sans lien : « importé : date du dernier import… » (RecoveryImportSection) échoue parfois sous charge
  (plusieurs fichiers en parallèle), vert seul.

## Relecture à froid (code-reviewer)

À compléter.
