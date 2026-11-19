# Partie 3 — synchronisation

Statut : **en cours**, tag `v0.26.0` (`8686a8fc`), budget L par partie. Aucun changement de production.

## Point de départ du 19/11

Le commit demandé `AUDIT-0.26.0 : partie 2` a réussi : `6e14fb85`, poussé sur `origin/audit-0.26.0`. Aucun verrou supprimé. Les documents présents décrivaient une partie 2 **en cours**, et non terminée : son reliquat reste dans `partie-02.md`. Partie 3 commencée sur instruction explicite d'Ali, sans fermer artificiellement la partie 2.

## Lectures et conclusions provisoires

- Horloge hybride : incrément logique et débordement du compteur ; la réception des journaux contrôle la dérive contre l'horloge physique avant d'avancer l'horloge locale.
- Fusion : maximum par champ, bases conservées et traitement distinct des conflits issus des instantanés ; refus des écritures antérieures à la remise à zéro. Les appelants et les reprises doivent encore être confrontés à ces règles.
- Application : noms SQL issus du catalogue, conservation des champs inconnus d'un schéma plus récent, recomposition des créations partielles, traitement des parents et des traces de purge. Les erreurs de contrainte sont isolées par savepoint ; les autres erreurs remontent. Les opérations refusées par contrainte alimentent un compteur durable.
- Lecture des journaux : valeurs, horloges et curseur dans une transaction gardée ; dernier groupe de même HLC non acquitté avant sa fin. Les conditions natives sur les positions et les têtes authentifiées restent à vérifier en partie 8b.
- Ancien schéma : ADR 0018 lu intégralement ; les créations incomplètes restent en attente, la republication des tables de migration 19 est transactionnelle et marquée. Les limites M2 à M4 sont déjà documentées dans cet ADR ; aucun nouveau défaut démontré ici.
- Rétention : âge et accusés pour les suppressions, couverture et époque pour les segments ; ordre total des oublis et éligibilité des instantanés lus. Ne constitue pas une preuve d'exécution native.
- La garantie des transactions gardées dépend du sérialiseur : **A-008**, déjà publié dans `bloquants.md`, s'applique aussi à cette infrastructure ; ne pas compter cette dépendance comme un nouveau constat.

Lectures intégrales consignées par `preuves/consigner-partie3.mjs`, puis `preuves/actualiser-couverture.mjs`. Aucun scan assimilé à une lecture. Aucun nouveau test lancé pour ce premier lot de lecture.

## Suite exacte

Moteur `engine.ts`, `status.ts`, `maintenance.ts` et `domain/syncBanners.ts` désormais lus intégralement. `statusFromFacts` conserve l'échec de réintégration quand sa relecture échoue ; les recherches localisent sa lecture dans `service.ts:164` et son bandeau dans `startSync.ts:292` (ces deux fichiers restent à lire entièrement). L'heure du dernier cycle peut avancer sans `allRead` : examiner son texte et les avertissements associés avant de qualifier ce comportement. La purge au plafond des champs inconnus ne relève ici que le journal technique ; suivre les autres compteurs et les décisions explicites de l'ADR avant tout constat.

Lire les contrats de l'ADR 0011 par sections, puis moteur, publication, instantanés, changement d'époque, oubli et reprise. Confronter les chemins à `format.ts`, `parse.ts`, au catalogue, aux repositories SQL et aux façades natives ; garder les preuves Rust/Swift pour 8b. Suivre l'affichage de `reintegrationFailure` jusqu'à l'interface. Vérifier aussi la filtration par horizon lors de la conservation/réintégration des champs inconnus et de la recomposition des opérations gardées, sans transformer une piste en constat.
