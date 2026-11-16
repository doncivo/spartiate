# DOC-H21 — Constats Raccourcis du 14/11, guide Santé, fournisseur IA (lot 0.26.0)

Statut : **fait.** Budget S. Branche `DOC-H21` depuis `origin/main` (`a35f9f70`, 0.25.0 publiée, schéma 19). Aucun code applicatif, aucune migration.
Origine : constats d'Ali du 14/11 sur l'iPhone (0.24.0), décisions d'Ali du 15/11 (nutrition saisie dans Spartiate ; aucun fournisseur IA) ; docs/LOT-0.26.0.md § 1.
Chapitres PRD : 16 (récupération, import Raccourcis), 15 (nutrition), 17 (IA), 26 et 27 (hypothèses, questions ; figés par prd-split.test.ts).

## Passe product-owner : critères

| # | Critère (Given / When / Then) | Preuve |
| --- | --- | --- |
| 1 | Matrice : H-21, H-22 à H-24, H-28 (avec correction), H-29 CONFIRMED ; H-25 UNVERIFIED ; H-30, H-31 sans objet ; IA (H-14, Q-2) sans fournisseur. | `healthShortcutsGuide.test.ts` (matrice) |
| 2 | Décisions : constats et décisions d'Ali consignés (D-293, D-294), usage réel commencé le 16/11 (D-292, complète D-38 et D-266) ; registre des hypothèses annoté. | relecture |
| 3 | Guide : « Indice de masse grasse » ; nutrition facultative ; automatisation « Lorsque Spartiate est ouverte » lançant les deux raccourcis, plus d'heure fixe ; filtre Source = Apple Watch sur HRV, FC repos, sommeil, jamais sur les pas ; avertissement « Grouper par » / « Date de début » ; exemples à la décimale au point. | `healthShortcutsGuide.test.ts` (guide) |
| 4 | PRD § 27 / Q-2 : aucun fournisseur, fonctions IA grisées avec leur cause. Le chapitre 27 est figé (seules les corrections D-47 à D-130 sont admises) : la décision fait foi au registre (D-294, choix prudent révisable). | `prd-split.test.ts` vert |

## Passes

**docs-writer (rouge puis vert).** Nouveau test `scripts/release/healthShortcutsGuide.test.ts` (7 cas). Rouge `204bbdd7` contre les documents d'origine : 7 échecs (type absent, filtre Source absent, automatisation horaire, avertissement absent, nutrition non marquée, `81,4`, matrice UNVERIFIED). Vert : commit suivant (guide, matrice, décisions). Choix prudents (D-293, D-294, révisables) : blocs de nutrition gardés et marqués « facultatifs, déconseillés » plutôt que retirés (l'import les lit toujours) ; PRD § 27 non modifié.

**qa-test.** Contrôles documentaires (`identity`, `agents`, `docs-paths`, `prd-split`, `healthShortcutsGuide`) et `src/i18n/healthPrivacy.test.ts` : 79 verts. Vérifié : aucune donnée d'Ali (valeurs d'exemple synthétiques ; `105.800000001` et `26.9` sont des formes citées par Ali, pas des mesures datées) ; aucun texte de l'app ne nommait « Pourcentage de graisse corporelle » (grep `src`) ; les quatorze noms de fichiers lus sont inchangés.

**code-reviewer.** Relecture du diff : approuvé. Cohérence vérifiée entre la partie A (plus d'automatisation à heure fixe, poids par le bloc 1 de la partie C ou le raccourci A, jamais les deux), B.3 (une automatisation, deux actions « Exécuter le raccourci », suppression des anciennes) et C.13 (renvoi à B.3). Mineur, laissé : « B.3 bis » garde l'explication de la relecture à 45 s, toujours valable.
