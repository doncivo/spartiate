# DOC-PRIV — aucune donnée réelle d'Ali ni consigne dangereuse dans le dépôt public (lot 0.28.0, phase 0.1)

Statut : **fusion après CI verte.** Budget S (security-privacy, docs-writer). Branche `DOC-PRIV` depuis `origin/main` `d0566409` (0.27.0, schéma 20).
Constats : C-165 (bloquant), C-110, C-181, C-182 (audit Claude 0.27.0) ; C-183 en partie (matrice H-33, H-34, H-36, scan). Décisions : D-318 à D-321.
Premier ticket du lot : porte aussi la fiche du lot (docs/LOT-0.28.0.md), les décisions d'Ali (D-318 à D-320) et le registre docs/backlog.md.

## Passes

- **product-owner.** Critères : (1) aucun fichier suivi (hors docs/archive, contenu embarqué, fichiers générés) ne contient une valeur
  réelle d'Ali : moyenne et nuits de sommeil, besoin affiché, poids, masse grasse, taille, cibles et macros, ni une forme qui en attribue une ;
  (2) aucun texte de l'app ni guide ne conseille de réinstaller, désinstaller ou supprimer l'app, ni de supprimer à la main les données ;
  (3) les guides d'installation n’ont plus de vestige de l’ancien projet (tâches, agendas, jours fériés, secrets Google, « Réglages › À propos ») ;
  (4) un test documentaire le garde ; (5) la liste exacte des valeurs retirées est gardée hors dépôt (`.codex-tmp/hist01-motifs.txt`, HIST-01).
- **security-privacy / docs-writer (agent du module).** Recherche par motifs (unités kg, kcal, ms, bpm, « h mm », formes « constat d'Ali »,
  « ta moyenne », « nuits d'Ali »), puis lecture de chaque occurrence. Retirées : moyenne de sommeil et besoin affiché (FIX-0115, FIX-0172,
  I5-05, I5-06, D-94, CHANGELOG), nuit du 13/11 (LOT-0.26.0, D-293, matrice), cibles importée et proposée et leurs macros (AUDIT-USAGE, ERGO-03,
  FIX-0244, LOT-0.25/0.26/0.27, D-291, D-295, D-296, CHANGELOG), poids et masse grasse cités comme formats (D-293, DOC-H21, matrice,
  guide des raccourcis), poids et taille d'exemple du journal des conflits (CHANGELOG, tests). Docs : « [retiré] » ou formulation neutre ;
  tests et capture visuelle : autres valeurs synthétiques. Vecteurs de sommeil décalés (452 min, nuits +2 à +3 min, attendus recalculés). Gardés (D-321) : nom de la salle, exercices.
  Guides : install-iphone.md (conservé, réglages, version, expiration, secrets Google retirés, « ne supprime aucune app »), install-pc.md
  (« Repartir de zéro » dans l'app au lieu de `Remove-Item`, libellés de Plus) ; textes : signature expirée et appairage incomplet
  (« actualise Spartiate dans SideStore »), oubli du dossier sans « désinstaller ».
- **qa-test.** Rouge : `aff897a1` (privacy.test.ts : 3 rouges ; attendus de 4 tests qui figeaient « réinstalle », C-168). Vert : commit de
  correctifs (ci-dessous). Ciblé en local : scripts/release, src/domain/recovery, tests nutrition, synchro et signature touchés.
- **code-reviewer.** Voir ci-dessous.

## Preuves

| Critère | Rouge | Vert |
|---|---|---|
| 1, 4 | `aff897a1` : 16 lignes portent une forme refusée | correctifs : 0 |
| 2 | `aff897a1` : 7 lignes (fr.ts, fr.syncPairing.ts, fr.syncFolder.ts, guides) | 0 |
| 3 | `aff897a1` : 9 lignes des deux guides | 0 |

## Passe code-reviewer

Revue 1 (à froid, sous-agent code-reviewer) : **à corriger**. (1, bloquant) privacy.test.ts rouge sur deux lignes de règle (fiche, registre) : exception élargie aux formes de « retirer », lignes reformulées ; (2) vecteurs de sommeil égaux à la valeur retirée (448 min) : décalés, D-321 (2) révisée ; (3) registre contraire à la matrice (H-33, H-36) : statuts « fait » ; (4) garde partiel : « réinstallation », suppression manuelle des dossiers et « efface le dossier » ajoutés, négation exigée dans la même proposition ; (5) guide iPhone : comment une place se libère ; (6) horodatage du constat retiré de l'exemple de poids. Conformes : écarts des vecteurs de cible conservés, purge.test.ts non affaibli, textes au tutoiement, aucun secret. Revue 2 : relecture du correctif par l'orchestrateur (tests scripts/release et src/domain/recovery : 394 verts, lint propre) : **approuvé sous réserve de la CI verte**.
