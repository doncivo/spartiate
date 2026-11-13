# RESET-01 — Repartir de zéro (0.18.3)

Statut : **code prêt, en attente de la CI et de la fusion** (pas de tag, pas de build iOS). Budget M annoncé ; **dépassé** (voir « Point d'étape budget »). Branche `RESET-01-repartir-de-zero` depuis `origin/main` (`f9b99c0f`, 0.18.2, schéma 15). **Migration 0016, schéma 16.** Décisions D-180 à D-186 ; ADR 0011, avenant 36 ; hypothèse H-33.

Sources : brief d'Ali du 12/11/2026 (D-180 à D-182, non révisables). Chapitres PRD : 9 (synchronisation), 10 (onboarding), 18 (Plus), 20 (schéma), 21 (sauvegarde, export), 22 (journaux).

## Passe product-owner : périmètre et critères

| # | Critère (Given / When / Then) | Tests |
| --- | --- | --- |
| 1 | Plus › Données › « Repartir de zéro » (iPhone et PC) → l'écran dit ce qui est effacé, ce qui est gardé, irréversible, deux appareils. | `ResetDataScreen.test.tsx`, e2e `RESET-01-repartir-de-zero.spec.ts` |
| 2 | Bouton inactif tant que le champ ne contient pas exactement EFFACER ; « effacer » refusé ; rien d'effacé. | `dataReset.test.ts`, `ResetDataScreen.test.tsx`, e2e |
| 3 | Séance ouverte → refus avec message, rien n'est effacé ni mis en file. | `dataResetLocal.test.ts`, `ResetDataScreen.test.tsx` |
| 4 | Toutes les tables classées « effacée » sont vides après l'effacement ; une table nouvelle non classée fait échouer le test ; réglages de l'appareil et état de synchro gardés ; réglages de données remis au défaut. | `dataResetLocal.test.ts`, `dataReset.test.ts` |
| 5 | Après l'effacement : base vide, onboarding ouvert au redémarrage ; contenu embarqué et profil de matériel par défaut comme au premier lancement. | `dataResetLocal.test.ts`, `ResetDataScreen.test.tsx`, e2e |
| 6 | L'autre appareil efface aussi, en ligne ou hors ligne ; rien d'antérieur ne revient (journal ancien, appareil en retard, modification hors ligne d'une ancienne ligne) ; les saisies d'après circulent. | `tests/unit/sync/reset01/dataResetSync.test.ts` (a), (b), (c), (e) |
| 7 | Appareil resté en schéma 15 : ne casse pas, rien d'ancien réappliqué, efface après sa mise à jour. | `dataResetSync.test.ts` (d) |
| 8 | Sauvegarde locale antérieure → restauration refusée, texte explicite. | `dataResetLocal.test.ts` (heure mémorisée), `restoreFlow.ts` (refus `before-reset`), `updateFailureQa.test.tsx` (texte) |
| 9 | Journal : `data-reset`, comptes seulement. | `dataResetLocal.test.ts` |
| 10 | Écran, textes et effacement hors du départ ; seule la migration 0016 y entre (liste blanche, `RESET-01`). | `tests/bundle/startBundle.test.ts` (CI) |

Hors périmètre : archive automatique (D-182), suppression des sauvegardes (D-54), dossier Santé (I5-03). Compléments : aucune table en 0.18.3 (D-181).

## Preuves rouge → vert

| Point | Rouge | Vert |
| --- | --- | --- |
| 1-10 | `6afd7f6c` | `527d6c3b` |

Rouge (relancé sur une copie de `6afd7f6c` sans le code, `git archive` dans `.codex-tmp/red`) : 8 fichiers en échec sur 9 lancés — modules `src/domain/dataReset`, `0016_data_reset`, `ResetDataScreen`, `src/sync/dataReset` absents (5 fichiers), comptes figés (55 déclencheurs attendus, 53 trouvés ; 26 tables attendues, 25 trouvées ; ordre sans `data_reset`). Écarts consignés, sans affaiblissement : comptes et positions figés mis à jour d'une table (même test, valeur nouvelle) ; le test du registre de la 0015 vérifie ses 15 premières migrations (la 0016 la suit, comme la 0014 en FIX-0181) ; Rust : 103 déclencheurs de référence, version 16 admise, 17 refusée.

## Passe settings-personalization (agent du module)

Écran `src/features/settings/ResetDataScreen.tsx` (chargé à la demande, `lazyScreens.tsx`, nom `resetdatascreen`), entrée dans Plus › Données (iPhone, carte DONNÉES) et Synchro et données (PC, groupe EXPORT ET IMPORT, avec une aide « Efface toutes les données, sur tes deux appareils »). Textes `src/i18n/fr.dataReset.ts` (catalogue de l'écran) et deux clés de `plusText.ts`. Motifs de Plus (classes `ct-body`, aucune couleur nouvelle, bouton `danger` existant). Après l'effacement : demande de synchro (la ligne part vers l'autre appareil), puis rechargement. Réglages : tri clé par clé dans `RESET_SETTINGS` (D-181). Sauvegardes : refus `before-reset` dans `restoreFlow.ts`, texte dans `fr.backupRestore.ts`, aussi sur l'écran d'échec de démarrage (`updateRestore.ts`). Verdict : conforme à D-180 à D-182, D-185.

## Passe sync-icloud (D-26, obligatoire)

Périmètre écrit : `src/domain/sync/syncTables.ts` (26e table `data_reset`, sans parent, jamais purgée, rien au journal des conflits), `format.ts` (`SYNC_TABLE_ORDER`), `merge.ts` (`isBeforeReset`), `epochCarryReportView.ts` (libellé) ; `src/sync/apply.ts` (filtre d'horizon, relève par une ligne `data_reset` du lot), `snapshot.ts` (remplacement : aucune ligne d'avant l'horizon reprise, `data_reset` jamais vidée), `engine.ts` (effacement dû avant la lecture et avant la publication, module à la demande), `meta.ts` (trois clés), `dataReset.ts` (nouveau, à la demande) ; `src/features/sync/startSync.ts` (rechargement après un effacement reçu). Aucun fichier de `src-tauri/src/sync`. Mécanisme : ADR 0011 avenant 36 (D-183) ; l'époque n'est pas utilisée (le report option B ramènerait les écritures non lues). Invariants : protocole chiffré, `sm`, HLC par champ, tombstones, reprise, oubli, réinitialisation Y-11, positions : aucun code touché ; `sv` 16 lu par un appareil en 15 → `sync_unknown` puis réintégration (test (d)). Non-régression lancée : `tests/unit/sync/reset01`, `tests/unit/sync/reset` (Y-11), `fix0181`, `i6`, `apply`, `restore*`, `twoDevices`, `snapshotRules`, `epochConcurrent`, `service`, `src/sync`, `src/features/sync`. Simulateur : schéma `v15` ajouté. Points d'attention : (1) horizon fondé sur les horloges (limite (1) de l'avenant) ; (2) les instantanés d'avant restent jusqu'au suivant, l'effacement se rejoue à leur lecture ; (3) une ligne créée hors ligne APRÈS l'horizon est gardée (saisie postérieure). Verdict : **sans objection**.

## Passe data-model

Migration 0016 strictement additive (`data_reset` : `id`, `created_at`, `updated_at`, `deleted_at`, `device_id`, `hlc`), deux déclencheurs depuis `CAPTURE_TABLES_V16`, aucune donnée migrée. Dépôt `DataResetRepository` (à la demande) : `record` prend son tampon juste avant son `db.execute` (garde `stampBeforeWrite`) ; `wipe` construit son SQL depuis les noms du catalogue (audit H5), parents d'abord avec `defer_foreign_keys`, enfants orphelins retirés. Comptes figés mis à jour : 55 déclencheurs de capture, 26 tables publiées, `EXPORT_SV` 16, `data_reset` exclue de l'export complet. Rust : `APP_SCHEMA_VERSION` 16, 103 déclencheurs de référence, version 16 déclarée, `SPARTIATE_TABLES` 41, fixture régénérée (`node scripts/backup/export-migrations-fixture.mjs`), tests `training_schema.rs`, `restore_hardening.rs`, `backup_versions.rs`. Verdict : conforme.

## Passe security-privacy

Aucune clé, aucun appel réseau, aucune permission. Le journal ne porte que des nombres (test qui cherche valeurs, dates et identifiants). La clé de synchro, le coffre et l'appairage ne sont jamais lus ni écrits. Le dossier `iCloud Drive/Spartiate/sante` n'est pas ouvert. Refus de restauration en échec fermé. Limite : un détenteur de la clé peut forger une ligne `data_reset` et faire effacer les données des autres appareils (même pouvoir que forger des suppressions, ADR 0011 §14.1) ; la sauvegarde locale reste. Verdict : **sans objection**.

## Passe qa-test

QA_DETAIL

## Passe code-reviewer (relecture à froid du diff)

Verdict : **APPROUVÉ sous réserve de la CI verte**. Contrôles : `git diff origin/main` relu à froid ; aucun `fixme`, `.skip(`, `.only(`, `console.log`, secret, couleur ni texte en dur ; aucun seuil ni plafond touché ; `tests/bundle/start-modules.json` ne gagne que la ligne de la migration 0016 (`RESET-01`) ; couches respectées (règles dans `src/domain/dataReset.ts` et `merge.ts`, SQL dans `src/db/repositories/sql/dataResetRepository.ts`, enchaînement dans `src/sync/dataReset.ts`, écran dans `src/features/settings`) ; modules nouveaux du départ : aucun (le filtre tient dans `apply.ts`, `merge.ts`, `syncTables.ts`, déjà au départ ; l'effacement est importé à la demande par `engine.ts`). Corrigé pendant la revue : une mise de côté d'APRÈS l'horizon en attente de sa ligne n'est plus retirée par l'effacement (seules celles `<= H`) ; imports en double regroupés ; commentaire de `runCycle` remis au-dessus de sa fonction. Points relevés, acceptés : (1) l'horizon dépend des horloges (avenant 36, limite 1) ; (2) un appareil qui fusionne un instantané portant une ligne `data_reset` nouvelle recharge une fois ; (3) les instantanés d'avant restent chiffrés dans le dossier jusqu'au suivant ; (4) le refus de restauration est fait par l'app (`restoreFlow.ts`, feuille des sauvegardes), pas par Rust ; l'autre voie, l'écran d'échec d'une mise à jour (`updateRestore.ts`), ne propose que la copie prise juste avant cette mise à jour, donc après tout effacement fait dans une version précédente ; (5) un import d'archive d'avant, geste explicite, réécrit ses données (horodatées après l'horizon) : comportement voulu d'un import.

## Point d'étape budget

Budget M (150 k) dépassé : la table publiée impose la même chaîne que FIX-0181 (catalogue, comptes figés TS et Rust, fixture, export). Arrêt à un point de commit, rien d'engagé hors du ticket.

## Marche à suivre pour Ali le jour J

**Avant** : installe la 0.18.3 sur le PC (bannière de mise à jour) et sur l'iPhone (SideStore), le même jour ; ouvre chaque appareil une fois et vérifie dans Plus › Appareils et synchro qu'ils se voient « À jour ». Termine ou abandonne toute séance en cours. Si tu veux garder une trace des essais, fais un export avant (rien n'est archivé automatiquement).

**Ordre** : sur un seul appareil (le PC, par exemple) : Plus › Synchro et données › « Repartir de zéro », tape EFFACER, « Tout effacer ». L'app redémarre sur l'onboarding. Puis ouvre l'iPhone et laisse la synchro se faire (Plus › Synchroniser maintenant si besoin) : il efface à son tour et redémarre sur l'onboarding. Fais l'onboarding sur un seul appareil ; l'autre reçoit le profil par la synchro (ferme l'assistant sur l'autre).

**Ce que tu verras** : profil, séances, repas, pesées, photos, récupération : vides. Gardés : thème, notifications, verrouillage, appairage (pas de nouvelle clé à saisir). Exercices, programmes de départ et Ciqual sont là. Le prochain import Santé relit les fichiers du dossier. Une ancienne sauvegarde affiche « Cette sauvegarde date d'avant “Repartir de zéro” » et ne se restaure pas. Si l'iPhone était hors ligne, il efface à sa prochaine synchro, sans rien ramener.
