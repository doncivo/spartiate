# MEDIA-02 — Images d'exercices, suite (0.26.0)

Itération : lot 0.26.0 | Taille : M | Budget : 150 k tokens | Branche : `MEDIA-02` (depuis `origin/main` `a35f9f70`) | Décisions : D-300 à D-304
Rôle : content-data (fiche `.claude/agents/content-data.md`). Modèle : `docs/I6-07.md`. Statut : code prêt, en CI ; H-9 reste UNVERIFIED (D-36).

## Passe 1 — product-owner

Références : `docs/prd/14-*.md` § 14.1 (champ `media`, licence et source obligatoires), § 26.2 (H-8, H-9), D-71 (4), D-231 à D-237 (I6-07).
Énoncé d'Ali : d'abord les 12 exercices de sa routine encore sans image, puis le reste des 109, tant que des images sous licence vérifiée
existent (wger image par image, Everkinetic) ; règles de I6-07 inchangées ; budget 153 600 octets par image, 8 388 608 au total.

Critères (Given / When / Then) :

1. **Étant donné** une image candidate, **quand** sa licence n'est pas CC0, CC BY ou CC BY-SA vérifiée pour cette image, ou est NC / ND,
   absente, ambiguë, ou l'image est générée, **alors** elle n'est pas embarquée (repli sans image, D-71).
2. **Étant donné** les 12 exercices de la routine, **quand** le test de contenu tourne, **alors** chacun a soit une image, soit une exclusion
   motivée dans `scripts/content/media-map.json` ; la liste des illustrés est fixée par le test.
3. **Étant donné** une image adaptée (réduite), **quand** elle est affichée, **alors** l'attribution signale la modification
   (CC BY-SA 4.0 § 3(a)(1)(B)) ; le registre garde l'empreinte et la taille d'origine.
4. **Étant donné** le build, **quand** la garde du bundle tourne, **alors** aucune image n'entre dans le départ, `start-modules.json` est inchangé.

Hypothèses : H-9 (UNVERIFIED), H-8 (correspondance exercice → image à relire par Ali).

## Passe 2 — content-data

Sources (consultées le 2026-11-16, requêtes anonymes, aucune donnée personnelle envoyée ; fichiers téléchargés chacun dans son dossier sous
`.codex-tmp/tmp-MEDIA-02/dl/`, jamais exécutés) :

- **wger** (API `exerciseimage`, `license`, `exerciseinfo`) : 394 images ; filtre mécanique (licence 1 à 4 = CC BY-SA 3 / 4, CC BY 4, CC0 ;
  auteur renseigné ; `is_ai_generated` faux ; PNG/JPEG/WebP), puis relecture visuelle des candidates : **aucune retenue** (D-300).
  Refus par motif : rendus 3D ou photos d'origine commerciale (filigrane « Ginasio Virtual », style d'éditeur) sous une licence déclarée
  non crédible — Franpol (383, 395, 403), AlucardEvil40 (590), barry (598), prevail90 (427), lion (426), nishant0712 (651), philip (328),
  technofer (521) ; allure générée — Settebello (545), Tierrasverdes (604) ; source externe sans licence vérifiable — carlos3c (459, 514),
  roneydya (592) ; capture vidéo — Rottekongen (576) ; auteur douteux d'un dessin au style Everkinetic — cshep442 (211). Seule plausible :
  gainage de utkb (346), reportée (l'app n'affiche pas encore un auteur par image). Les copies wger de dessins Everkinetic (CC BY-SA 3
  sur wger) ne sont pas prises : leur original est au dépôt Everkinetic (CC BY-SA 4.0).
- **Everkinetic** (`everkinetic/data`, commit `446bb9a3`, CC BY-SA 4.0) : le dossier `images-web/` (dossier source du dépôt Everkinetic) couvre des exercices sans PNG dans
  `dist/png` (cause des exclusions de I6-07). Source `everkinetic-web` (D-301) ; `images-ai` et `images-png-unknown` écartés.
  40 fichiers téléchargés, 26 relus visuellement ; `t-bar-rows` est un exercice au ballon (mal nommé), écarté.

Réduction (D-302) : `scripts/content/png-reduce.mjs` (Node + zlib, aucune dépendance), gris 8 bits, hauteur ≤ 640 px, appelé par
`build-media.mjs` pour les sources qui déclarent `reduceMaxHeight`. 87 images de I6-07 inchangées (octet pour octet).

Résultat (D-303) : **14 images ajoutées, 101 exercices sur 196**, catalogue **4 495 435 octets** (était 3 667 859 ; plafond 8 388 608), plus
lourde ajoutée 91 629 octets (`row-barbell.png`).

| Exercice | Fichier d'origine (`images-web/` (dossier source du dépôt Everkinetic)) |
| --- | --- |
| overhead-press-dumbbell (routine) | dumbbell-shoulder-press-2 |
| row-barbell (routine) | rear-deltoid-row-barbell-2 |
| lat-pulldown (routine) | wide-grip-lat-pull-down-2 |
| cable-pullover (routine) | straight-arm-push-down-1 |
| overhead-press-barbell | barbell-shoulder-press-2 (assis, comme le choix de I6-07) |
| shoulder-press-machine | seated-shoulder-press-machine-1 |
| arnold-press | arnold-press-2 |
| pec-deck | butterfly-machine-2 |
| chin-up | chin-ups-1 |
| lat-pulldown-close | v-bar-pull-down-2 |
| cable-hip-extension | one-legged-cable-kickback-2 |
| hip-adduction-cable | hip-adduction-2 |
| reverse-crunch | bent-knee-hip-raise-2 |
| overhead-triceps-extension-dumbbell-one-arm | one-arm-triceps-extension-with-dumbbell-2 |

**Routine d'Ali : 4 sur 12 illustrés.** Restent sans image (motif complet dans `media-map.json`, `excluded`) :

- Enroulement du tronc à la poulie : seul dessin Everkinetic assis, la fiche est à genoux (déjà écarté par I6-07) ; rien sur wger.
- Extension triceps au-dessus de la tête à la poulie : Everkinetic n'a que des variantes à genoux / allongé ; wger : Franpol (refusé).
- Fente bulgare : rien chez Everkinetic ; wger : Franpol, AlucardEvil40 (refusés).
- Hip thrust à la barre : rien chez Everkinetic ; wger : seulement aux haltères (AlucardEvil40, refusé).
- Relevé de jambes suspendu : rien chez Everkinetic ; wger : image marquée générée par IA.
- Rowing à la machine avec appui poitrine : rien chez Everkinetic ; wger : barry (rendu commercial), carlos3c (haltères, source externe).
- Tirage visage à la corde : rien chez Everkinetic ; wger : variantes élastique, anneaux, haltères seulement.
- Élévation latérale à la poulie : rien chez Everkinetic ; wger : photo à l'élastique (autre matériel), auteur réel externe.

## Passe 3 — affichage (training, une ligne)

`exerciseMediaFiles.ts` : la source `everkinetic-web` a sa clé d'attribution `attributionEverkineticWeb` (`src/i18n/fr.trainingMedia.ts`,
catalogue chargé avec le bloc à la demande `ExerciseMedia`). Aucun autre changement d'écran ; aucune adresse réseau ; CSP inchangée.
Écart au périmètre de la fiche content-data (« ne touche jamais `src/features/**` ») : une ligne de table, nécessaire à l'exigence
d'attribution ; consigné ici.

## Passe 4 — qa-test

| Fonction | Rouge | Vert |
| --- | --- | --- |
| Contenu réel (routine, compte, registre `everkinetic-web`), réduction PNG, attribution modifiée | `8b431537` : 3 tests de contenu rouges (87 ≠ 102, routine [], registre vide), `png-reduce.test.ts` en échec (module absent), attribution `null` | `3e47465f` (87 / 87 ciblés) |

- Le test rouge visait 5 exercices de la routine (102 au total) ; ramené à 4 (101) avant le vert, par cohérence avec I6-07 (D-304).
- Cas limites ajoutés : PNG entrelacé ou non PNG refusé, image plus petite que le plafond non agrandie, sortie déterministe.
- Suites ciblées (`scripts/content`, `src/features/training/media`, `src/domain/training/media`, `--maxWorkers=1`) : 87 / 87 ; validate-content :
  OK (196 exercices) ; `npm run typecheck`, `npm run lint` : verts.
- Mutation : retrait de la clé `everkinetic-web` de la table d'attribution → 2 tests rouges (`ExerciseMedia.test.tsx`), annulée.
- `npm run test:bundle` : 166 / 168 ; les 2 échecs sont dans `pairingBundle.test.ts` (liste blanche de pairing.html) et viennent du
  worktree (`node_modules` en jonction, chemins `../../node_modules/…`), sans lien avec ce ticket ; le départ et la garde des médias sont verts.
  À confirmer par la CI.

## Bundle de départ

Mesure `node tests/bundle/measureStart.ts` sur un build avec manifeste : **avant** (sources de `a35f9f70`) normalisée **195 861** octets
(brute 195 866) ; **après** normalisée **195 861** octets (brute 195 886, écart de hachage) ; plafond 358 400, marge 162 539. Les images sont des fichiers émis par Vite, référencés seulement par le bloc à la
demande `ExerciseMedia` ; `tests/bundle/start-modules.json` inchangé.

## Constats à faire par Ali

- Relire les 14 correspondances (H-8), notamment arnold-press (dessin en position haute, proche du développé haltères), cable-pullover
  (barre droite), overhead-press-barbell (assis).
- Lisibilité des images réduites (640 px de haut, niveaux de gris) en thème clair et sombre.

## Passe 5 — code-reviewer

(à remplir par la relecture à froid de l'orchestrateur)
