# MEDIA-03 — Pictogrammes des exercices sans image (0.29.0)

Itération : lot 0.29.0 | Taille : L | Branche : `MEDIA-03` (depuis `origin/main` `b16e3747`) | Décision : D-413 (Ali, 19/11)
Rôles : content-data, ui-design-system. Chapitres : `docs/prd/14-*.md` § 14.1 (champ `media`), `docs/prd/18-*.md` § 18.4 (charte bronze).
Statut : voir « Fin de fiche » en bas.

## Passe 1 — product-owner

Énoncé : les exercices sans photo sous licence reçoivent un pictogramme SVG dessiné pour le projet (aucune image copiée), au même gabarit :
silhouette simple, position de départ puis position d'arrivée, muscle principal en accent bronze.

Critères (Given / When / Then) :

1. **Étant donné** le gabarit, **quand** un pictogramme est généré, **alors** il a le viewBox `0 0 220 120`, mêmes épaisseurs et proportions, et
   n'emploie que `currentColor` et `var(--ct-color-bronze)` (aucune couleur en dur).
2. **Étant donné** un exercice sans photo, **quand** son pictogramme existe, **alors** la fiche et la séance l'affichent avec la mention
   « pictogramme » et un texte alternatif ; **étant donné** une photo sous licence, **alors** la photo seule est affichée (priorité photo).
3. **Étant donné** un SVG du dossier `content/exercises/pictograms/`, **quand** `validate-content` tourne, **alors** il échoue sur : taille
   au-delà du plafond, `<script>`, attribut `on*`, `href` / adresse externe, `foreignObject`, `<style>`, couleur en dur, nom de fichier
   sans exercice, pictogramme d'un exercice qui a une photo.
4. **Étant donné** le bundle de départ, **quand** il est mesuré, **alors** les pictogrammes en sont absents (chargés à la demande) et la
   mesure normalisée n'augmente pas.

Périmètre : exercices sans média (`media.images` vide) ; ordre : les 8 de la routine d'Ali, puis le reste par lots complets.
Hors périmètre : animation, vidéo, photo.

## Passe 2 — content-data (gabarit)

- Moteur : `scripts/content/pictograms/skeleton.mjs` (cinématique directe : angles d'articulations → tracés), descriptions :
  `scripts/content/pictograms/specs.mjs`, génération : `node scripts/content/build-pictograms.mjs` (D-51, jamais fichier par fichier).
- Gabarit : 220 × 120, deux panneaux de 100 (départ à 50 % d'opacité, flèche, arrivée), tronc 7, membres 4,5, accessoires 2,5 ; segments
  longueur tronc 34, bras 18 / 17, cuisse et jambe 24 ; muscle principal (rôle `primary` de `exercises.json`) peint en
  `var(--ct-color-bronze)` sur la zone du corps correspondante.
- Essais (MEDIA-03a) dans `docs/maquettes/propositions/pictogrammes/` : Fente bulgare, Hip thrust à la barre, Tirage visage à la corde
  (routine d'Ali), Élévation latérale à la poulie, Squat gobelet (haltère), Relevé de jambes suspendu (poids du corps) ; planche
  `planche.html` (clair et sombre).
