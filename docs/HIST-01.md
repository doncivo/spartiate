# HIST-01 — réécriture de l'historique de `doncivo/spartiate` (lot 0.28.0, phase 0.2)

Statut : **fait le 20/11/2026** (push forcé à 12:39 UTC). Décisions : D-318 (5), D-319 (exception unique à l'interdit du push forcé), D-321 (4).
Objet : retirer de tout l'historique public les valeurs réelles d'Ali retirées des fichiers par DOC-PRIV (#156). La liste exacte des motifs
n'est jamais écrite dans le dépôt : elle est gardée hors dépôt (`C:\Dev\spartiate\.codex-tmp\hist01-motifs.txt`).

## Conditions (docs/LOT-0.28.0.md, 0.2)

- DOC-PRIV fusionné (#156) ; aucune PR ouverte hors #148 et #155 (PR #127 fermée sans fusion par décision d'Ali du 20/11, branche gardée) ;
  dernier push de Codex sur `audit-0.26.0` à 09:51 (plus de 3 h avant) ; aucun verrou ni fichier modifié depuis 2 h dans `C:\Dev\spartiate-codex`.

## Déroulé

1. Sauvegarde : `git clone --mirror` dans `C:\Dev\spartiate-backup-avant-hist01` (jamais poussée : adresse de push neutralisée), `git fsck` sans erreur, 250 références (branches et tags).
2. Workflows déclenchés par un push, désactivés AVANT tout push (`gh workflow disable`) : Build iOS (402646722, tags `ios-v*`), Build Windows (402646724, tags `v*`), Tests (402646725, push sur main et PR) ; réactivés exactement ces trois après le push.
3. Réécriture : `git filter-repo` et Python absents du poste (rien installé hors dépôt) ; équivalent de `--replace-text` par `git fast-export --signed-tags=strip --signed-commits=strip --tag-of-filtered-object=rewrite --reencode=no <branches et tags> | node filtre | git fast-import` (filtre sur le contenu des blobs texte seulement ; messages de commit inchangés, vérifiés sans motif). 17 507 blobs lus, 286 modifiés, 223 binaires laissés tels quels. Remplacements : texte → « [retiré] » ou formulation neutre ; nombres nus du code → valeurs synthétiques (D-321 (4)). Un motif d'horodatage a été écarté avant le push : il modifiait des dates de fixtures de tests.
4. Vérification : recherche de chaque motif dans TOUS les objets du nouvel historique : **0** (témoin, ancien historique : 924) ; `git fsck` sans erreur ; pointe de main : 3 fichiers seulement changent (un exemple de taille dans CHANGELOG, un témoin de `scripts/release/privacy.test.ts`, une estimation d'archive).
5. Push forcé de toutes les branches et de tous les tags (`git push --force … 'refs/heads/*' 'refs/tags/*'`) : 250 références, toutes égales au nouvel historique (`git ls-remote`).
6. Contrôles après push : aucun run de workflow créé après le push ; `doncivo/spartiate-releases` inchangé (même commit de `main`, mêmes 124 publications et dates) ; aucune protection de branche ni règle n'a eu à être levée (il n'y en a pas).

## Ce qu'Ali doit faire

1. **Recloner `C:\Dev\spartiate-codex`** (Codex) : ses branches locales portent l'ancien historique ; ne jamais repousser depuis ce clone avant de l'avoir recloné.
2. **Envoyer à GitHub Support** la demande de purge des vues en cache (les références de PR `refs/pull/*` et les pages de commits gardent l'ancien contenu) ; modèle ci-dessous, à envoyer par Ali depuis son compte (support.github.com › « Remove sensitive data »).

> Bonjour, j'ai réécrit l'historique du dépôt public `doncivo/spartiate` le 20/11/2026 pour en retirer des données personnelles (git fast-export / fast-import, équivalent de git filter-repo --replace-text). Toutes les branches et tous les tags ont été poussés en force. Pourriez-vous purger les vues en cache et les références de pull requests qui conservent les anciens commits (notamment les PR #1 à #157), et lancer le ramasse-miettes du dépôt ? Les anciens SHA de `main` et des tags sont listés dans `docs/HIST-01.md` du dépôt. Merci.

3. Les PR brouillons #148 (Codex) et #155 (audit Claude) restent ouvertes ; leurs branches sont réécrites comme les autres.

## Branches réécrites (126)

`AUDIT-USAGE`, `CLEAN-01-residus`, `CLEAN-02-second-nettoyage`, `DEP-01-libsqlite3-sys`, `DOC-D119-validation`, `DOC-D226-decisions`, `DOC-D38-usage-reel`, `DOC-FIX-0241-fiche`, `DOC-FIX0242`, `DOC-H21`, `DOC-PRIV`, `DOC-rapport-matin-2026-11-13`, `ERGO-01-ergonomie`, `ERGO-01b-regles-ecrans`, `ERGO-02-ecrans-restants`, `ERGO-02b`, `ERGO-03`, `FIX-0115-onglets-e2e`, `FIX-0116-ci-today`, `FIX-0171-bloquants-photos`, `FIX-0172-sommeil`, `FIX-0173-renpho-export-salle`, `FIX-0181-favoris-journee-rouge`, `FIX-0182-y-ios-02`, `FIX-0221-action-pris`, `FIX-0223-seance-du-jour`, `FIX-0241`, `FIX-0242`, `FIX-0243`, `FIX-0244`, `FIX-0271`, `FIX-0272`, `FIX-ABERR`, `FIX-ASSIST`, `I2-03-rampes-echauffement`, `I2-04`, `I3-01-generation`, `I3-07-onboarding`, `I4-01-domaine-nutrition`, `I6-01-recuperation`, `I6-02-corps`, `I6-03-circuits`, `I6-03b-circuits-routines-replay`, `I6-04-renpho`, `I6-05-complements`, `I6-06-cardio`, `I6-07-medias-exercice`, `MEDIA-02`, `PROG-01-mesocycle-jours-repos`, `PROG-01-reprise-publiee`, `PROG-01-verification`, `PROG-03`, `PROG-04`, `PROG-05`, `REL-0.25.0`, `REL-0.26.0`, `REL-0.27.0`, `RESET-01-repartir-de-zero`, `STR-01`, `SYNC-01`, `archive/agent-a0528c3a67af21a44`, `audit-0.26.0`, `audit-claude-0.27.0`, `cadrage-avant-spa-001`, `cloture-i0`, `correctifs-0-1-4`, `correctifs-0-2-3`, `correctifs-0-2-4`, `correctifs-0.7.1`, `decisions-i2`, `dep-01-garde-wal-decote-position`, `doc-reprise-0-2-4`, `fix-092-onglets-catalogue`, `gate-i0-go`, `i1-01`, `i1-01-contenu`, `i1-01-donnees`, `i1-01-rust`, `i1-01-ui`, `i1-02`, `i1-02-donnees`, `i1-02-live`, `i1-02-livraison`, `i1-02-ui`, `i1-03-livraison`, `i1-03-sync`, `i1-03-ui`, `i2-01-affichage`, `i2-01-moteur`, `i2-02-contraintes`, `i3-02-mesocycle`, `i4-02-catalogue-journal`, `i4-03-nutrition-ecrans`, `i4-05-open-food-facts`, `i4-06-favoris-menage`, `i4-07-recettes-journee-complete`, `i4-08-correctifs-moteur`, `i5-01-recuperation-raccourcis`, `i5-02-recuperation-ecrans`, `i5-03-import-auto-reglages`, `ios-demarrage`, `ios-identite`, `main`, `maquettes-i0`, `moteur-correctifs`, `moteur-correctifs-apres-i2-02`, `purge-i18n`, `raccourcis-sante`, `relecture-codex-2026-11-09`, `relecture-codex-2026-11-12`, `relecture-codex-2026-11-13`, `reprise-matin`, `reprise-nuit`, `rev-01-relecture-codex`, `spa-005`, `spa-006`, `spa-007`, `spa-009`, `version-0.3.2`, `version-0.3.3`, `version-0.3.4`, `version-0.4.0`, `version-0.5.0`, `version-0.6.0`, `version-0.7.0`, `windows-io-muet`

## SHA avant / après (main et chaque tag)

| Référence | Avant | Après |
|---|---|---|
| main | `7c185106b22b7269c5cc91d7ae4c9d2d4462b7f9` | `0e6a28e4ff94279a2df9d3f84b927a115e21aab4` |
| ios-v0.1.0 | `fbae6ba4434d` | `57c94fe9b089` |
| ios-v0.1.1 | `d1211771caf9` | `22b3a46b455a` |
| ios-v0.1.2 | `b9d1a54b2b0f` | `c76ab805f8a1` |
| ios-v0.1.3 | `6276665a5f31` | `28ca9afafb8e` |
| ios-v0.1.4 | `9559ee8645c5` | `512ee58db4e4` |
| ios-v0.1.5 | `6ec40539f37f` | `170febbb62c7` |
| ios-v0.1.6 | `cd89d4e6d1e6` | `6f2abb83ade9` |
| ios-v0.10.0 | `f6746d8aa611` | `304752bc1932` |
| ios-v0.11.0 | `5a555d643732` | `17041b3368e4` |
| ios-v0.11.1 | `39a396afbe1c` | `0e90e3b02498` |
| ios-v0.11.2 | `d8e5009c3602` | `2a89629cc133` |
| ios-v0.11.3 | `93e8ebbf57be` | `ffa79ad575aa` |
| ios-v0.11.4 | `514eae5cd63d` | `96d1cbe52860` |
| ios-v0.11.5 | `21f2744e4490` | `1d1abc489659` |
| ios-v0.12.0 | `0cab10e72fe0` | `15e92ce3efb1` |
| ios-v0.13.0 | `d16349b785db` | `f9c9d7b0d773` |
| ios-v0.14.0 | `714b3f918596` | `a237f7f33232` |
| ios-v0.15.0 | `090422facd09` | `15775ccbded0` |
| ios-v0.16.0 | `279a1be4c445` | `4361530f8204` |
| ios-v0.17.0 | `2e78f3dae885` | `e01667ab686a` |
| ios-v0.17.1 | `14bd677a095e` | `7eda05dcdf93` |
| ios-v0.17.2 | `7a81413f0f57` | `285df5ae81bc` |
| ios-v0.17.3 | `23a7ec1eafe1` | `6e889120cfde` |
| ios-v0.18.0 | `276c2fb6f9ad` | `ca8c78dc1ed5` |
| ios-v0.18.1 | `c6ae39002949` | `f1ad40035e6f` |
| ios-v0.18.2 | `f9b99c0f18b0` | `be211ce909ef` |
| ios-v0.18.3 | `c8f9b736708b` | `adb18efe90e6` |
| ios-v0.19.0 | `9f66347ed48e` | `5ca36e245a10` |
| ios-v0.19.1 | `f110ba5087ef` | `158500d40fcc` |
| ios-v0.2.0 | `b6be06e4c88f` | `7b3ce3f1574d` |
| ios-v0.2.1 | `ec2c0b28d915` | `c554cb7c0564` |
| ios-v0.2.2 | `1d333146cad7` | `8bf326bdc9e1` |
| ios-v0.2.3 | `8f2a0ef77309` | `3a84d2c7fbf1` |
| ios-v0.2.4 | `7e1d97fee552` | `c3f789422a90` |
| ios-v0.20.0 | `3b407666e4cf` | `258b44a43442` |
| ios-v0.21.0 | `0ca9e97c893c` | `ab1aade52cfc` |
| ios-v0.22.0 | `6ac3b8bbb608` | `781bc42a4839` |
| ios-v0.22.1 | `22c0bc52db13` | `f7d3769c6ef8` |
| ios-v0.22.2 | `2999e5a1612a` | `a0c6b21b5285` |
| ios-v0.22.3 | `cb1a1120eb75` | `115920433e8e` |
| ios-v0.23.0 | `c1df273eefd2` | `ac60cf9d4fe5` |
| ios-v0.24.0 | `7dcb6a88c56b` | `c620baa7b1ca` |
| ios-v0.25.0 | `734b6c4d285c` | `11688b7bdf02` |
| ios-v0.26.0 | `a3451c03995a` | `59710c2a106c` |
| ios-v0.27.0 | `d056640910db` | `9b319a29e78b` |
| ios-v0.3.0 | `5b43b6085fad` | `d59046728d8b` |
| ios-v0.3.1 | `6d38d560dde1` | `23b4f2316266` |
| ios-v0.3.2 | `59bf3305cc75` | `12cf0e5b1d12` |
| ios-v0.3.3 | `21c61bae4fce` | `a5efbd66496d` |
| ios-v0.3.4 | `07eff2cdef0a` | `bc004d61ddb0` |
| ios-v0.4.0 | `2d7f6a1e1d80` | `65f9083b36e2` |
| ios-v0.5.0 | `ae6626f899a5` | `c32007d0e69a` |
| ios-v0.6.0 | `cbc3f4b8fe55` | `9e5fc5745fad` |
| ios-v0.7.0 | `6119e2a25861` | `d6ab9e1b9b91` |
| ios-v0.7.1 | `fb1d999a2a38` | `5bc1d8987b2e` |
| ios-v0.8.0 | `89b73e305f22` | `5221a67109b4` |
| ios-v0.8.1 | `277c166b2267` | `580b2196f774` |
| ios-v0.9.0 | `7bb307ffbdf0` | `fb3bdfb6cc11` |
| ios-v0.9.1 | `903bef9a4d64` | `fc4feeeffaad` |
| ios-v0.9.2 | `be600ac598e8` | `3645ee6e6e9c` |
| ios-v0.9.3 | `a011e70df7d5` | `51e2be4613bb` |
| ios-v0.9.4 | `da6dda8c418b` | `c3ecbf31f538` |
| v0.1.0 | `e70fa3ec9ff6` | `0851c0f49d5b` |
| v0.1.1 | `d1211771caf9` | `22b3a46b455a` |
| v0.1.2 | `b9d1a54b2b0f` | `c76ab805f8a1` |
| v0.1.3 | `6276665a5f31` | `28ca9afafb8e` |
| v0.1.4 | `9559ee8645c5` | `512ee58db4e4` |
| v0.1.5 | `6ec40539f37f` | `170febbb62c7` |
| v0.1.6 | `cd89d4e6d1e6` | `6f2abb83ade9` |
| v0.10.0 | `f6746d8aa611` | `304752bc1932` |
| v0.11.0 | `5a555d643732` | `17041b3368e4` |
| v0.11.1 | `39a396afbe1c` | `0e90e3b02498` |
| v0.11.2 | `d8e5009c3602` | `2a89629cc133` |
| v0.11.3 | `93e8ebbf57be` | `ffa79ad575aa` |
| v0.11.4 | `514eae5cd63d` | `96d1cbe52860` |
| v0.11.5 | `21f2744e4490` | `1d1abc489659` |
| v0.12.0 | `0cab10e72fe0` | `15e92ce3efb1` |
| v0.13.0 | `d16349b785db` | `f9c9d7b0d773` |
| v0.14.0 | `714b3f918596` | `a237f7f33232` |
| v0.15.0 | `090422facd09` | `15775ccbded0` |
| v0.16.0 | `279a1be4c445` | `4361530f8204` |
| v0.17.0 | `2e78f3dae885` | `e01667ab686a` |
| v0.17.1 | `14bd677a095e` | `7eda05dcdf93` |
| v0.17.2 | `7a81413f0f57` | `285df5ae81bc` |
| v0.17.3 | `23a7ec1eafe1` | `6e889120cfde` |
| v0.18.0 | `276c2fb6f9ad` | `ca8c78dc1ed5` |
| v0.18.1 | `c6ae39002949` | `f1ad40035e6f` |
| v0.18.2 | `f9b99c0f18b0` | `be211ce909ef` |
| v0.18.3 | `c8f9b736708b` | `adb18efe90e6` |
| v0.19.0 | `9f66347ed48e` | `5ca36e245a10` |
| v0.19.1 | `f110ba5087ef` | `158500d40fcc` |
| v0.2.0 | `b6be06e4c88f` | `7b3ce3f1574d` |
| v0.2.1 | `ec2c0b28d915` | `c554cb7c0564` |
| v0.2.2 | `1d333146cad7` | `8bf326bdc9e1` |
| v0.2.3 | `8f2a0ef77309` | `3a84d2c7fbf1` |
| v0.2.4 | `7e1d97fee552` | `c3f789422a90` |
| v0.20.0 | `3b407666e4cf` | `258b44a43442` |
| v0.21.0 | `0ca9e97c893c` | `ab1aade52cfc` |
| v0.22.0 | `6ac3b8bbb608` | `781bc42a4839` |
| v0.22.1 | `22c0bc52db13` | `f7d3769c6ef8` |
| v0.22.2 | `2999e5a1612a` | `a0c6b21b5285` |
| v0.22.3 | `cb1a1120eb75` | `115920433e8e` |
| v0.23.0 | `c1df273eefd2` | `ac60cf9d4fe5` |
| v0.24.0 | `7dcb6a88c56b` | `c620baa7b1ca` |
| v0.25.0 | `9b19d9f877d2` | `55256a4e8665` |
| v0.26.0 | `6bbe23576def` | `ebab07ff5218` |
| v0.27.0 | `d056640910db` | `9b319a29e78b` |
| v0.3.0 | `5b43b6085fad` | `d59046728d8b` |
| v0.3.1 | `6d38d560dde1` | `23b4f2316266` |
| v0.3.2 | `59bf3305cc75` | `12cf0e5b1d12` |
| v0.3.3 | `21c61bae4fce` | `a5efbd66496d` |
| v0.3.4 | `07eff2cdef0a` | `bc004d61ddb0` |
| v0.4.0 | `2d7f6a1e1d80` | `65f9083b36e2` |
| v0.5.0 | `ae6626f899a5` | `c32007d0e69a` |
| v0.6.0 | `cbc3f4b8fe55` | `9e5fc5745fad` |
| v0.7.0 | `6119e2a25861` | `d6ab9e1b9b91` |
| v0.7.1 | `fb1d999a2a38` | `5bc1d8987b2e` |
| v0.8.0 | `89b73e305f22` | `5221a67109b4` |
| v0.8.1 | `277c166b2267` | `580b2196f774` |
| v0.9.0 | `7bb307ffbdf0` | `fb3bdfb6cc11` |
| v0.9.1 | `903bef9a4d64` | `fc4feeeffaad` |
| v0.9.2 | `be600ac598e8` | `3645ee6e6e9c` |
| v0.9.3 | `a011e70df7d5` | `51e2be4613bb` |
| v0.9.4 | `da6dda8c418b` | `c3ecbf31f538` |

## Passes

- product-owner : conditions et étapes de docs/LOT-0.28.0.md (0.2), toutes tenues (ci-dessus).
- agent du module (ci-release, security-privacy) : déroulé ci-dessus ; sauvegarde, workflows, réécriture, push, réactivation.
- qa-test : rouge/vert sans objet pour une opération sur l'historique ; preuve déterministe par script (motifs restants 0 sur tous les objets, témoin 924 sur l'ancien historique ; références distantes égales au nouvel historique ; releases inchangées ; aucun run).
- code-reviewer : relecture de cette fiche et de D-324 par l'orchestrateur ; aucune valeur réelle (garde `scripts/release/privacy.test.ts` verte).
