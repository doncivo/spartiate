# CONTENT-0293 — Import et contenu (lot 0.29.3)

Lot 0.29.3 (docs/LOT-0.29.2.md, docs/LOT-0.29.2-audit.md), registre « import et contenu ». Chapitres : 14.1 (exercices), 15.4 (Ciqual), 17.4 (import
de programme). Décisions d'Ali appliquées : D-477 (« traces » = 0 g), Q-20 B (tous les nutriments). Aucune migration, aucun changement de synchro :
le champ `media.author` et `source.responsesSha256` sont des champs de contenu embarqué (jamais publiés, `is_custom = 0`). Tous les choix prudents
ci-dessous : « Claude (choix prudent) ; révisable par Ali ».

## Passe product-owner (critères Given/When/Then)

1. C-042 : étant donné un constituant Ciqual écrit « traces », quand le catalogue est généré, alors il vaut 0 (kcal, protéines, lipides, glucides,
   fibres) et reste compté dans les décomptes ; une valeur absente (« - ») ou « < x » reste `null`, jamais 0.
2. BL-128 : étant donné deux exercices dont les noms ne diffèrent que par la casse, l'accent ou un pluriel, quand le contenu est validé, alors le
   validateur échoue (« nom proche de celui de … ») ; l'import ne rend plus aucun homonyme dans la bibliothèque.
3. BL-127 : étant donné « Planche 3 x 30 s » rapprochée d'un exercice chronométré, alors la routine porte 30 s comme cible ; étant donné une durée lue
   sur un exercice à répétitions, ou des répétitions lues sur un exercice chronométré, alors l'aperçu le signale avant la création.
4. BL-113 : étant donné le catalogue du matériel, alors « Gilet lesté » (`weighted-vest`, famille accessoire) y figure, sans être imposé aux profils.
5. BL-010 : étant donné une image d'une source à auteur par image (wger), alors son auteur est exigé dans le contenu et au registre, lu par le
   domaine et affiché sous l'image avec la licence et la modification ; la planche a son image.
6. C-180 : étant donné les normes FitnessVolt, alors le fichier porte le SHA-256 des 22 réponses et le validateur l'exige ; licences.md ne dit plus
   « non modifiées » des images réduites.
7. BL-126 : étant donné un PDF, alors l'app le refuse avec une consigne claire (capture puis photo) ; aucune dépendance n'est ajoutée sans architect.

## Passe agent du module (content-data ; training pour l'import)

Fichiers : `scripts/content/ciqual.mjs`, `build-ciqual.mjs`, `build-media.mjs`, `build-strength-standards.mjs`, `validate-content.mjs`, `media-map.json`,
`pictograms/specs.mjs` ; `content/food/ciqual.json` (régénéré), `content/exercises/{equipment,exercises}.json`, `media/{plank.png,sources.json}`,
`content/strength/standards.json` ; `src/domain/training/{programImport,media,types}.ts`, `src/features/training/{content.ts,import/ProgramImportView.tsx,
media/*}`, `src/i18n/{fr.programImport,fr.trainingMedia}.ts` ; docs/licences.md. `src/features/training/content02.originals.json` : nom figé du
pull-through mis à jour (fixture du test d'identifiants stables, les identifiants ne changent pas).

### Vérifications écrites (« à vérifier » et lignes à contrôler)

- **C-042** : la table Ciqual 2025 retéléchargée (MD5 vérifiés) et régénérée par `build-ciqual.mjs` : 3 484 aliments ; « traces » `{2, 4, 15, 134, 45}`
  désormais écrits 0 ; décomptes absents et « < x » inchangés ; `--check` OK. Côté journal, 0 g de lipides laissait déjà le total calculé (NUTRI-0292).
- **BL-127** : la routine n'a pas de colonne de durée (aucune migration n'en ajoute), mais SEANCE-0292 (D-472, D-506) lit la plage `repMin`–`repMax`
  d'un exercice chronométré comme des secondes (`generateSession.repRange`, `setDurationSec`). Donc « 3 x 30 s » sur un exercice chronométré est déjà
  correct : l'import l'écrivait en 30 et la séance le lit en 30 s. Le défaut restant était le silence sur les deux cas ambigus : corrigé (note d'aperçu).
- **BL-128** : `cable-pull-through` (charnière, composé) et `cable-kickback` (isolation unilatérale) ne sont PAS le même exercice : les fusionner
  ferait perdre un mouvement. Le défaut est un nom faux : « Extension de hanches à la poulie » pour un pull-through. Renommé sans toucher aux ids
  (aucun id retiré, aucune référence perdue). Le vrai quasi-doublon fonctionnel est `cable-kickback` / `cable-hip-extension` (Q-31).
- **C-180 chemins relatifs des scripts** : sans défaut ; preuve : `validate-content.mjs` et `build-ciqual.mjs --check` lancés depuis `/` rendent OK
  (chemins résolus depuis l'emplacement du script ; seuls les arguments donnés par l'utilisateur sont relatifs au dossier courant).
- **C-180 FitnessVolt** : 22 réponses retéléchargées le 2026-11-25 (requêtes publiques anonymes) : `standards.json` reconstruit identique, hors les
  empreintes ajoutées. **Droit de relicence** : non vérifiable ici (Q-29).
- **BL-126** : aucune bibliothèque PDF dans le dépôt (ni `pdfjs-dist` ni autre). Un extracteur maison ne lit que les PDF à police simple ; la plupart
  des PDF (Word, Google Docs) utilisent des polices à codage propre, donnant un texte faux sans erreur visible : refusé (rien en silence). Voir Q-30.

## Passe qa-test (rouge → vert)

| Ligne | SHA rouge | SHA vert |
|---|---|---|
| C-042 | 50933b6c | fde0ba4e |
| BL-128 | 91134204 | 6d0fcceb |
| BL-127 | 8486d3de | 43d90738 |
| BL-113 | 314c1ea4 | 4f91c91f |
| BL-010 | 28facbcd | 77d3025d |
| C-180 (empreintes) | e7b950af | d579d8fe |
| C-180 (chemins, licences.md) | — (vérification) | d579d8fe (docs) |
| BL-127 (relecture : distance, aperçu) | bca664ff | 821fae66 |
| BL-010 (relecture : auteur au registre) | bffc7f5f | (ce commit) |
| CI : `content.test.ts` (média avec auteur) | — | 413def83 |
| BL-126 | — (refus déjà figé par `PhotoReader.test.tsx`, `pdfLater`) | — |

Preuves : `node scripts/content/validate-content.mjs` OK (196 exercices, 4 programmes, 77 matériels) ; `build-ciqual.mjs --check` OK ; `tsc` et `eslint`
propres ; tests ciblés verts (`scripts/content`, `programImport*`, `media*`, `ExerciseMedia`, `content02`, treize fichiers qui lisent les JSON de contenu) ;
bundle de départ : 45 blocs, normalisé 182 931 octets, marge 175 469, liste blanche inchangée (aucun module touché n'est dans le départ).

## Statuts proposés

| Ligne | Statut proposé |
|---|---|
| C-042 | fait (CONTENT-0293, D-585) |
| BL-128 | fait (CONTENT-0293, D-586 ; quasi-doublon fonctionnel kickback / hip-extension : Q-31) |
| BL-127 | fait (CONTENT-0293, D-587) |
| BL-113 | fait en partie (D-588) : catalogue fait ; source de lest : Q-28 |
| BL-010 | fait (CONTENT-0293, D-589) |
| C-180 | fait en partie (D-590) : droit de relicence D-310 : Q-29 ; le reste fait |
| BL-126 | à trancher par Ali (Q-30) : aucune dépendance PDF ajoutée sans architect (D-591) |

## Décisions (D-)

- **D-585** (C-042) : « traces » Ciqual compte pour 0 g pour les cinq constituants (Q-20 B, D-477) ; contenu régénéré par `build-ciqual.mjs`. | Claude (choix prudent) ; révisable par Ali
- **D-586** (BL-128) : pas de fusion : le pull-through est renommé « Pull-through à la poulie » (id inchangé) ; le validateur refuse deux noms proches (casse, accent, pluriel simple). | Claude (choix prudent) ; révisable par Ali
- **D-587** (BL-127) : la durée d'un exercice chronométré d'une routine est sa plage `repMin`–`repMax` en secondes (D-472, D-506), sans colonne ; l'import signale durée sur exercice à répétitions et répétitions sur exercice chronométré, sans convertir. | Claude (choix prudent) ; révisable par Ali
- **D-588** (BL-113) : `weighted-vest` « Gilet lesté » au catalogue (accessoire), absent des trois profils de départ ; il n'alimente pas encore la progression de lest (poids du gilet inconnu). | Claude (choix prudent) ; révisable par Ali
- **D-589** (BL-010) : source `wger` « à auteur par image » (CC BY-SA 4.0), `media.author` obligatoire et égal au registre, attribution nommant l'auteur, image réduite comme everkinetic-web ; première image : planche (wger 346, auteur utkb, vérifiée à l'œil). Le pictogramme de la planche est retiré. | Claude (choix prudent) ; révisable par Ali
- **D-590** (C-180) : `source.responsesSha256` (22 empreintes) exigé au contenu et au validateur ; licences.md distingue images d'origine et réduites. | Claude (choix prudent) ; révisable par Ali
- **D-591** (BL-126) : aucune dépendance npm ajoutée ; le PDF reste refusé avec sa consigne ; la ligne est à trancher par Ali (Q-30, avec avis d'architect sur la dépendance). | Claude (choix prudent) ; révisable par Ali

## Questions (Q-)

### Q-28 — Gilet lesté comme source de lest (BL-113, D-383)
- A (recommandé) : champ optionnel « poids du gilet (kg) » au profil de matériel, lest = ce poids par crans choisis. Conséquences : l'inventaire du profil gagne un champ (table publiée `equipment_profile` : relecture sync-icloud, data-model) ; éditeur de profil à compléter.
- B : gilet à lest modulable : saisie des plaques de gilet comme les disques de ceinture. Conséquences : plus fin, plus de saisie.
- C : le gilet reste un simple matériel (disponibilité), sans lest proposé. Conséquences : aucun changement.

### Q-29 — Droit de relicence des normes FitnessVolt (C-180, D-310)
- A (recommandé) : garder la source, écrire la limite dans licences.md (fait) et écrire à FitnessVolt. Conséquences : app personnelle, risque faible ; réponse à consigner.
- B : retirer les normes tant que le droit n'est pas confirmé. Conséquences : Strength Score sans normes.
- C : remplacer par une source dont la licence est vérifiable. Conséquences : nouvelle étude de sources.

### Q-30 — Lecture du PDF d'un programme (BL-126, D-423)
- A (recommandé) : ajouter `pdfjs-dist`, chargé à la demande, texte extrait localement, aucun appel réseau. Conséquences : dépendance de plus (architect), poids hors départ, PDF scannés toujours refusés.
- B : rester sans PDF (capture puis photo). Conséquences : aucun changement.
- C : extracteur maison pour les PDF simples. Conséquences : texte faux possible sans signal.

### Q-31 — `cable-kickback` et `cable-hip-extension` (BL-128)
Constat : même mouvement, même matériel, deux ids publiés ; aucune redirection d'identifiant n'existe pour une fusion.
- A (recommandé) : garder les deux, aucune fusion. Conséquences : deux fiches voisines, aucune référence perdue.
- B : fusionner avec redirection d'id dans le chargeur (hors périmètre content-data : training et data-model). Conséquences : un mécanisme de plus, test d'identifiants stables à adapter.
