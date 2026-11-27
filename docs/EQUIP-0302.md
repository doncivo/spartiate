# EQUIP-0302 — poids du gilet lesté au profil de matériel (lot 0.30.2)

Budget M (≈ 150 k ; entraînement, data-model, sync-icloud). Registre : BL-175 (et BL-113). Décisions lues : D-674 (Ali, 26/11, Q-28 option A),
D-383 (moteur poids du corps), D-785 (pas de défaut SQL sur une colonne publiée) ; proposées : D-791 à D-796 (choix prudents, ci-dessous).
Chapitres : 11.3 (« Sans charge »), 14.3 (profils de matériel), 9.1 (synchro), 23.1 (bundle de départ). Migration 0025 (schéma 25). Branche
créée depuis SESS-0302 ; #251 fusionnée, branche mise à jour par `git merge origin/main` (`360c249f`) : conflits des fichiers de SESS-0302 résolus par
leur version de `main` (seuls `docs/SESS-0302.md`, `docs/constats-ali.md`, `docs/decisions.md` et `src/i18n/fr.workoutReplay.ts` différaient de la
branche SESS-0302), différence avec `main` limitée aux fichiers de ce ticket.

## Passes

- **product-owner** — Périmètre : migration additive `equipment_profile.vest_kg`, catalogue de synchro, republication, export et import,
  domaine pur (grille de lest, validation), dépôt, éditeur du profil de matériel et sa fiche, Rust (version de schéma, déclencheurs de
  référence et par version, fixture régénérée), banc de synchro (`v24`). Hors périmètre : `src/sync/**` (aucun fichier touché), contenu
  (`content/**`), toute autre formule du moteur, CHANGELOG, version, decisions, backlog, reprise. Critères :
  1. Given une base au schéma 24 avec des profils, When la migration 0025 passe, Then chaque profil a `vest_kg` nul, rien n'est mis en file ;
     la colonne refuse 0, une valeur négative et plus de 60 kg ; aucune valeur par défaut SQL.
  2. Given le gilet lesté disponible ou forcé (jamais interdit) et un poids renseigné, When un exercice au poids du corps atteint le haut de
     sa plage, Then ce poids entre dans les lests utilisables (D-383 : plus petit cran parmi haltères, ceinture et gilet) ; au lest maximal,
     une répétition de plus. Given le gilet sans poids, Then aucun lest proposé par le gilet (comportement d'avant, prescription identique).
  3. Given l'éditeur, When le gilet est coché (disponible ou forcé), Then le champ « Poids du gilet (kg) » apparaît, décimale française, 0,5 à
     60 kg au dixième, aide reliée « Sans poids renseigné, le gilet n'est pas proposé comme lest. » ; une valeur fausse est refusée avec un
     message nommé, rien n'est écrit ; la fiche affiche le poids ou « Poids non renseigné : pas de lest proposé ».
  4. Given deux appareils au schéma 25, Then un profil avec poids est reçu, une modification du poids part champ par champ, sans conflit.
     Given un appareil au schéma 24, Then il garde le champ dans `sync_unknown` (son renommage ne l'efface pas) et le réintègre à sa mise
     à jour ; un profil qu'il crée est mis de côté chez l'appareil à jour puis reçu entier, poids nul, après sa mise à jour (`SCHEMA_REPUBLISH[25]`).
  5. Given une archive du schéma 24 (sans la clé), Then elle est lue avec un poids nul ; « Fusionner » garde le poids local ; une archive du 25
     rend le poids ; un poids hors bornes est refusé à la lecture. Given le bundle de départ, Then plafond inchangé.
- **training (agent du module) avec data-model et sync-icloud** — Migration `0025_equipment_vest.ts` (`ALTER TABLE ... ADD COLUMN vest_kg REAL
  CHECK (vest_kg IS NULL OR (vest_kg > 0 AND vest_kg <= 60))` et déclencheur propre `sync_equipment_profile_vest_au`, modèle de la 0020 :
  une création part entière par le `_ai` de la 0002) ; manifeste régénéré par son test ; catalogue : `vest_kg` (`real`, facultatif, visible
  au journal des conflits) ; `SCHEMA_REPUBLISH[25] = ['equipment_profile']`. Domaine : `WEIGHTED_VEST_ID` et une ligne dans `ballastLoads`
  (`prescribe.ts`) ; `VEST_KG_MIN`, `VEST_KG_MAX`, `isVestKg` et l'issue `vest` de `validateEquipmentProfile` (`equipment.ts`) ; type
  `vestKg?` à l'entrée, `vestKg` toujours lu. Dépôt : poids écrit seulement s'il est nommé (création renseignée, modification qui le nomme),
  lecture tolérante d'une base sans la colonne (banc `v24`). Export : `EXPORT_SV` 25, colonne tardive de `equipment_profile`, borne ]0, 60],
  `docs/export-complet.md`. Éditeur : champ et aide dans `EquipmentView.tsx`, textes dans `fr.training.ts` (chargé avec l'Entraînement, hors
  du départ). Rust : `APP_SCHEMA_VERSION` 25, `REFERENCE_TRIGGERS` 119 (déclencheur inséré par script depuis la migration), `(25,
  &["sync_equipment_profile_vest_au"])`, `LATEST_VERSION` 25, fixture `spartiate-migrations.json` régénérée par son script.
- **qa-test** — Rouge : `2391d095` (6 fichiers de tests neufs, 22 tests en échec sur 23 : module de migration absent, `WEIGHTED_VEST_ID`,
  `isVestKg`, champ de l'éditeur, colonne absente ; plus les attentes de version 25 : `EXPORT_SV`, `sv` publié, `APP_SCHEMA_VERSION`). Vert :
  `3d5a0987`. Suites locales (sans couverture, `--maxWorkers=2`) : `tsc --noEmit` et eslint des fichiers touchés sans erreur ; migrations, `src/domain/sync`,
  `src/domain/exportImport`, `src/platform/backup` : 68 fichiers, 715 tests verts ; `src/domain/training` : 956 verts (1 délai de 5 s sous charge,
  `programImport.qa`, vert seul) ; `src/features/training` : 458 tests, 41 premiers tests de fichier en échec par délai sous charge (`findBy`), tous verts
  relancés sur un seul processus sauf `FixAberr` (vert seul) ; `src/db` : 930 tests, 6 tests d'import en boucle au-delà de 5 s sous charge, verts
  relancés, sauf `exportImportBodyProgress` « ligne hors bornes » (6,6 s seul ; 5,4 s et en échec aussi sur la base SESS-0302 sur ce PC) ;
  `tests/unit/sync/versions` : 119 verts (dont la garde FIX-A009b) ; `tests/unit/sync/equip0302` : 4 verts ; `npm run test:bundle` : 201 verts,
  plafond inchangé ; `scripts/release` : 289 verts, 2 délais de 5 s (`privacy`, `purge`, connus sur `main` sur ce PC). Aucun e2e local. Rust non lancé (règle du poste) : version, déclencheurs de référence et par
  version, fixture régénérée par script, à confirmer par la CI. Tests changés dans le commit vert (rien d'affaibli) : comptes de
  déclencheurs 70 → 71 (`0004`, `0009`, `0012`, `triggers.test.ts`), dernière version lue par `0024_workout_pause.test.ts` (la 0024 est
  passée, la 0025 suit) ; `equipmentVest.equip0302.test.tsx` part d'une copie de « Poids de corps » et non de « Salle complète » (plafond
  de 64 matériels, corrigé ensuite par D-796, qui ajoute le cas « Salle complète »). Valeurs inventées seulement.
- **Correction D-796 (demande du coordinateur, même ticket)** — Défaut : `MAX_LIST` (64) de `src/db/parse/equipmentJson.ts` bornait les listes
  d'identifiants d'un profil sous la taille du catalogue (77) ; une copie de « Salle complète » (64 disponibles) ne recevait plus le gilet et
  l'éditeur disait « Enregistrement impossible. Réessaie. ». Rouge : `4e196811` (5 tests : borne, garde, domaine, copie de « Salle complète »,
  refus nommés). Vert : `8eefa695`. Borne fixe `EQUIPMENT_ID_LIST_MAX = 256` (domaine, `equipment.ts`), gardée par un test qui exige au moins
  le double du catalogue embarqué ; autres listes inchangées (64, `EQUIPMENT_LIST_MAX`) ; la validation du domaine refuse désormais tout ce
  que la lecture refuserait (longueurs, nom de barre, nombre de disques), et l'éditeur nomme chaque raison (une phrase par code, le matériel
  forcé et interdit nommé) ; un refus du dépôt dit « Profil refusé… » ou « Ce profil n'existe plus… », « Enregistrement impossible » ne reste
  que pour une écriture qui échoue. Borne cherchée ailleurs : aucune dans l'export (`archive.ts` ne lit pas l'inventaire) ni dans la synchro
  (colonne `json`, 64 Ko). **Format publié** : la borne s'applique à la lecture de la colonne publiée `inventory`. (Ce paragraphe disait à
  tort qu'une app antérieure refuse de modifier un profil qu'elle lit vide : corrigé par la relecture sync-icloud ci-dessous.)
- **qa-test après D-796 et mise à jour avec main** (`360c249f`, sans couverture, `--maxWorkers=2`) : `tsc --noEmit` sans erreur ; migrations 249 verts ;
  `src/domain/training` 956 ; `src/domain/sync`, `src/domain/exportImport`, `src/platform/backup`, `src/db/parse` 483 ; `src/features/training` 460 ;
  `src/db/repositories` 604 ; `tests/unit/sync/versions`, `equip0302`, `sess0302` 128 ; `npm run test:bundle` 201 (plafond inchangé) ; `scripts/release` 291 :
  tout vert, aucun délai cette fois. Rust non lancé (CI).
- **Relectures** — sync-icloud : **à corriger** (1 bloquant) ; code-reviewer : **à corriger** (1 bloquant, mineurs) ; data-model : favorable
  sur la migration 0025.
  - Bloquant sync-icloud (perte de données) : la garde DATA-0293 ne jouait que si la modification ne fournissait pas l'inventaire ; or l'éditeur
    d'une version antérieure envoie toujours un inventaire complet construit depuis l'inventaire lu VIDE. Scénario : iPhone encore en 0.30.1, PC
    en 0.30.2 avec une copie de « Salle complète » de plus de 64 matériels ; l'iPhone voit un profil vide, Ali coche et enregistre ; tout
    l'inventaire est écrasé partout, sans conflit (hlc plus récent), sans retour possible. Correction (règle d'application, aucun changement de
    protocole, `src/sync/**` non touché) : (a) `longListsBlocked()` du dépôt lit `sync_state` (version publiée par chaque appareil, même source
    que l'écran des versions) avec `olderActiveDevices` (`src/domain/sync/compat.ts`, mêmes inactifs que `newerDevices`) ; tant qu'un appareil
    actif publie un `sv` < 25 (ou inconnu), `create` et `update` refusent toute liste d'identifiants au-delà de 64, et l'éditeur dit « Un appareil
    utilise une version plus ancienne de Spartiate : mets-le à jour avant d'enregistrer plus de 64 matériels. » ; (b) un inventaire ou des
    incréments stockés illisibles ne sont jamais remplacés, même avec un inventaire fourni (`update` refuse) ; le profil est marqué `unreadable`
    et l'éditeur passe en lecture seule avec « Ce profil a été écrit par une version plus récente de Spartiate : mets l'app à jour pour le
    modifier. ». Rouge `6b0f811c` (7 tests), vert `f0f0fa3c`. Tests : `tests/unit/sync/equip0302/olderDevice.test.ts` (appareil au 24, lecture
    bornée à 64 par le crochet `setEquipmentJsonTestHooks` : profil de 65 lu vide, enregistrement refusé, inventaire intact des deux côtés ;
    écrivain au 25 refusant 65 tant que l'appareil au 24 est actif, acceptant après sa mise à jour), `olderDevices.equip0302.test.ts`, éditeur.
  - Bloquant code-reviewer : libellé `vest_kg: 'poids du gilet'` ajouté à `src/i18n/fr.syncField.ts` (`tests/unit/sync/conflicts/texts.test.ts`).
  - Mineurs : `WEIGHTED_VEST_ID` importé dans l'éditeur ; champ du poids masqué si le gilet est interdit ; borne des listes interpolée dans les
    messages (`{max}`) ; commentaire périmé du test d'éditeur corrigé ; cas de vrai conflit sur `vest_kg` ajouté à `vestSync.test.ts` (vert dès le
    rouge : comportement existant, test de couverture). Correction d'un test dans le commit vert : nom du profil cherché par `startsWith` (la
    parenthèse de l'expression régulière avait perdu son échappement).
  - Contre-relectures : sync-icloud **approuvé**, code-reviewer **approuvé**, avec deux retouches faites : rouge `cf697195`, vert `852c4611`.
    (1) `olderActiveDevices` n'écarte plus que les appareils `forgotten` et `foreign` : un appareil `expired`, `corrupt` ou `rollback` peut être
    resté en 0.30.1, mieux vaut bloquer à tort qu'écraser (`newerDevices` inchangé ; tests du domaine et du dépôt par statut). (2) Table des
    raisons de l'éditeur exhaustive (`Record` sur l'union des codes, sans conversion de type : un code ajouté sans texte ne compile pas) ;
    borne propre du nom des barres (`BARBELL_NAME_MAX`, 64, distincte de `EQUIPMENT_LIST_MAX`). Suites : `tsc --noEmit` et eslint sans erreur ; `tests/unit/sync/equip0302`, `src/domain/sync`, `src/db/parse`, éditeur et dépôt du matériel,
    libellés de conflit : 40 fichiers, 456 tests verts.
  - Risque restant **accepté par sync-icloud** : une app réellement en 0.30.1 que cet appareil ne connaît pas encore, ou inactive depuis
    180 jours (oubliée), ou un troisième appareil jamais associé ici, peut lire vide un profil de plus de 64 matériels et l'écraser. Phrase
    pour Ali : « mettre à jour les deux appareils avant d'enregistrer un profil de plus de 64 matériels ». Suite proposée, non faite : parade
    complète par une règle d'application dans `apply.ts` (refus d'un inventaire raccourci écrit par un appareil plus ancien), par ADR ou
    avenant à l'ADR 0011, avec architect et sync-icloud.
- **qa-test après relecture** (`f0f0fa3c`) : sans couverture, `--maxWorkers=2` : `tsc --noEmit` et eslint des fichiers touchés sans erreur ; `tests/unit/sync` entier 2 043 tests, 2 042
  verts, 1 délai de 5 s sous charge (`epochCarryReplacedParentRules`, vert seul) ; migrations 249 ; `src/domain/training` 956 (1 délai,
  `programImport.qa`, vert seul, hors ticket) ; `src/domain/sync`, `src/domain/exportImport`, `src/platform/backup`, `src/db/parse` 484 ;
  `src/features/training` 463 ; `src/db/repositories` 604 ; `npm run test:bundle` 201 (plafond inchangé). Rust non lancé (CI).

## Périmètre écrit des fichiers de synchro touchés (D-26)

- `src/domain/sync/syncTables.ts` : une colonne publiée ajoutée à `equipment_profile` (`vest_kg`, réel, facultatif). Rien d'autre : ordre des
  tables, colonnes locales, `titleSource` inchangés.
- `src/domain/sync/schemaRepublish.ts` : entrée `25: ['equipment_profile']`.
- `src/domain/sync/compat.ts` (relecture) : fonction pure `olderActiveDevices` ajoutée à côté de `newerDevices` (mêmes inactifs), lue par le dépôt des
  profils ; rien d'autre ne change (comparaisons, lecture, réintégration).
- `src/i18n/fr.syncField.ts` : libellé de conflit `vest_kg`.
- `tests/unit/sync/equip0302/olderDevice.test.ts` : banc d'un appareil au 24 à la lecture bornée à 64.
- `tests/sim/syncDevice.ts` : schéma `v24` et filtre `beforeEquip0302` en tête de la chaîne des catalogues anciens.
- Non touchés : `src/sync/**` (dont `engine.ts`, `apply.ts`, `snapshot.ts`), protocole, HLC, tombstones, reprise, reset, oubli.
- Non-régression : `tests/unit/sync/equip0302/vestSync.test.ts` (deux bases par le journal et par l'instantané, appareil au schéma 24 dans
  les deux sens), `tests/unit/sync/versions` (dont la garde FIX-A009b), `src/domain/sync`, migrations.

## Décisions proposées (choix prudents, à inscrire par Ali)

- **D-791** — Le poids du gilet est un lest SEUL : il rejoint la grille des lests (haltères, sommes de la ceinture) sans jamais s'additionner
  à un autre lest (gilet + haltère, gilet + disques) ; le moteur garde le plus petit cran (D-383). Un gilet réglable (plusieurs poids) n'est
  pas modélisé.
- **D-792** — Le gilet propose un lest seulement s'il est disponible ou forcé, jamais interdit (même règle que la ceinture et les haltères),
  et pour les mêmes exercices au poids du corps que la ceinture (aucune liste d'exercices « au gilet » dans le contenu).
- **D-793** — Bornes : 0,5 à 60 kg au dixième dans l'éditeur et le domaine ; la base et l'import acceptent ]0, 60] (aucune valeur saine
  refusée à la réception).
- **D-794** — Gilet décoché dans l'éditeur : le poids enregistré est gardé (non effacé), sans effet sur le moteur ; le champ réapparaît avec
  cette valeur quand le gilet est recoché. Champ vide, gilet coché : poids effacé (nul).
- **D-795** — Synchro : `vest_kg` publié, capturé par un déclencheur propre, republication de `equipment_profile` au schéma 25 (un profil
  créé par un appareil resté au 24 est mis de côté, « appareil plus ancien », ADR 0018, puis reçu entier, poids nul) ; aucune valeur par
  défaut SQL (D-785).
- **D-796** (réécrite après la relecture sync-icloud) — Listes d'identifiants d'un profil (disponible, forcé, interdit) lues jusqu'à 256 (fixe,
  au moins le double du catalogue embarqué, garde de test) ; autres listes à 64 ; le domaine valide les mêmes bornes que la lecture et
  l'éditeur nomme chaque refus. Règle d'écriture : tant qu'un appareil actif publie un `sv` < 25 (ou inconnu), aucune liste au-delà de 64
  n'est enregistrée (refus nommé) ; un inventaire ou des incréments stockés illisibles ne sont jamais remplacés (lecture seule). Risque
  restant : un profil de plus de 64 matériels enregistré alors qu'aucun appareil ancien n'était connu (avant son association, ou pendant qu'il
  était inactif), puis lu par une app réellement antérieure (0.30.1 ou avant, sans la garde durcie) : elle le lit vide et son éditeur
  l'écraserait. Parade : mettre à jour les deux appareils avant d'enregistrer plus de 64 matériels (le message le dit tant qu'un appareil
  ancien est actif).

## Points non tranchés

- Risque restant de D-796, accepté par sync-icloud : à dire à Ali avec le lot (« mettre à jour les deux appareils avant d'enregistrer un
  profil de plus de 64 matériels ») ; parade complète (règle dans `apply.ts`, ADR ou avenant 0011, architect) proposée comme suite, non faite.
- Gilet réglable (plusieurs crans) ou gilet additionné à un autre lest : hors D-674 (D-791).
- Relectures : sync-icloud et code-reviewer approuvées (contre-relecture), data-model favorable ; reste la CI (Rust compris).
