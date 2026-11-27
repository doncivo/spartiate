# EQUIP-0302 — poids du gilet lesté au profil de matériel (lot 0.30.2)

Budget M (≈ 150 k ; entraînement, data-model, sync-icloud). Registre : BL-175 (et BL-113). Décisions lues : D-674 (Ali, 26/11, Q-28 option A),
D-383 (moteur poids du corps), D-785 (pas de défaut SQL sur une colonne publiée) ; proposées : D-791 à D-795 (choix prudents, ci-dessous).
Chapitres : 11.3 (« Sans charge »), 14.3 (profils de matériel), 9.1 (synchro), 23.1 (bundle de départ). Migration 0025 (schéma 25). Branche
créée depuis SESS-0302 (migration 0024, PR #251 non fusionnée) : à rebaser sur `main` après sa fusion (aucun conflit attendu hors versions).

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
  passée, la 0025 suit) ; `equipmentVest.equip0302.test.tsx` part d'une copie de « Poids de corps » et non de « Salle complète » (voir
  points non tranchés : plafond de 64 matériels). Valeurs inventées seulement.
- **Relectures** — sync-icloud et code-reviewer : à faire (passe distincte, diff à froid).

## Périmètre écrit des fichiers de synchro touchés (D-26)

- `src/domain/sync/syncTables.ts` : une colonne publiée ajoutée à `equipment_profile` (`vest_kg`, réel, facultatif). Rien d'autre : ordre des
  tables, colonnes locales, `titleSource` inchangés.
- `src/domain/sync/schemaRepublish.ts` : entrée `25: ['equipment_profile']`.
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

## Points non tranchés

- Plafond de 64 matériels par liste (`src/db/parse/equipmentJson.ts`, `MAX_LIST`) alors que le catalogue en compte 77 : une copie de
  « Salle complète » (64 déjà disponibles) ne peut pas recevoir le gilet ; l'éditeur dit « Enregistrement impossible. Réessaie. » sans
  dire pourquoi. Hors ticket (rien n'est perdu, l'échec est affiché) : ticket à ouvrir (relever le plafond au-delà du catalogue, message
  nommé).
- Gilet réglable (plusieurs crans) ou gilet additionné à un autre lest : hors D-674 (D-791).
- Relecture sync-icloud et avis de data-model (D-674) : à faire avant fusion.
