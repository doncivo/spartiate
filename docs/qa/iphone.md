# Recette iPhone — exécution par Ali

Recette à remplir par Ali sur l’iPhone 16 Pro Max. Chaque essai reste ouvert tant que la capture et son verdict ne sont pas consignés. Les captures doivent être datées, limitées au résultat utile et expurgées des données personnelles.

## État connu au 4 novembre 2026

- Les trois apps présentes sont SideStore, CircleTasks et Spartiate. IronCoach a été retirée ; ne pas la réinstaller.
- La signature SideStore expire le **11 novembre 2026** : la rafraîchir avant cette date, puis continuer le rythme de renouvellement de SPA-010. Ne pas attendre l’expiration.
- SideStore conserve l’entitlement HealthKit après re-signature. Cela ne prouve ni l’autorisation Santé ni la lecture de données (SPA-006).
- Spartiate 0.1.0 est bloquée au démarrage ; le correctif est en cours pour 0.1.1. Ne pas traiter une nouvelle tentative de lancement de 0.1.0 comme une preuve de réussite, ni considérer 0.1.1 disponible avant sa publication confirmée.

## Règles de sécurité

- Ne jamais supprimer une app, réinstaller une app par-dessus une installation existante, ni retirer une app pour libérer une place.
- L’unique exception est la mise à jour normale N → N+1 explicitement prévue en SPA-010 : utiliser « Mettre à jour » dans SideStore, sans supprimer l’app et seulement quand 0.1.1 est publiée.
- Ne jamais ouvrir, lire, exporter, copier ou utiliser les données de CircleTasks. Ne pas capturer de QR, clé, profil brut ou donnée personnelle.
- N’utiliser que des valeurs synthétiques lorsqu’une donnée de profil ou de poids est nécessaire. Ne transmettre aucune valeur Santé réelle ; les captures Santé doivent masquer les valeurs.
- Si un écran ou une mise à jour échoue, arrêter l’essai, garder les apps en place et noter le résultat. Ne pas tenter de réparation par désinstallation ou réinstallation.

## SPA-004 — Installation, signature et coexistence

**Prérequis**

- IPA publiée et identification de la version/build confirmées ; la réussite de l’ouverture reste à reprendre après correction du blocage de démarrage 0.1.0.
- SideStore disponible ; signature à renouveler avant le 11 novembre 2026.
- Les trois apps SideStore, CircleTasks et Spartiate sont présentes.

**Étapes sur l’iPhone**

1. Capturer l’écran d’accueil où apparaissent les trois apps, sans ouvrir CircleTasks.
2. Ouvrir SideStore et relever la date d’expiration de la signature.
3. Rafraîchir la signature avant le 11 novembre, puis relever la nouvelle date.
4. Quand une version corrigée est publiée, vérifier dans SideStore sa version et son build avant de l’ouvrir. Si seule 0.1.0 est proposée, constater le blocage connu et arrêter.
5. Après publication de 0.1.1, ouvrir Spartiate et relever la version/build dans l’écran de diagnostic prévu par la version testée.

**Résultat attendu**

La signature est renouvelée avant expiration ; les trois apps coexistent sans retrait. Le démarrage de 0.1.0 est actuellement bloqué : SPA-004 ne passe pas sur cette version. Réévaluer l’ouverture avec la version corrigée et consigner exactement la version testée, sans faire passer cette preuve pour une ouverture de 0.1.0.

**Captures à prendre**

- Écran d’accueil montrant les trois icônes.
- SideStore avec l’état avant/après renouvellement et la date d’expiration.
- Après publication du correctif seulement : version/build Spartiate et résultat d’ouverture.

**Verdict / date / version**

- Verdict : ☐ réussi ☐ échoué ☐ bloqué ☐ non exécuté
- Date : ____________________
- Version/build Spartiate : ____________________
- Version iOS / SideStore : ____________________
- Observé / lien de capture expurgée : ____________________

**À ne jamais faire**

Ne supprimer aucune des trois apps, ne pas réinstaller Spartiate par-dessus une installation existante, ne pas réinstaller IronCoach et ne pas lire les données CircleTasks.

## SPA-006 — Autorisation et lectures HealthKit

**Prérequis**

- Build iPhone identifiée avec l’entitlement HealthKit conservé après re-signature SideStore.
- Spartiate corrigée et ouvrable ; Santé disponible sur l’iPhone.
- Prévoir de masquer toute valeur personnelle sur les captures et de ne communiquer que le résultat de chaque lecture.

**Étapes sur l’iPhone**

1. Ouvrir le diagnostic Santé de Spartiate et capturer l’état de disponibilité avant autorisation.
2. Déclencher la demande d’autorisation en lecture pour masse corporelle (`bodyMass`) et pas (`stepCount`).
3. Choisir le scénario autorisé, puis relever séparément l’état de l’autorisation et le résultat de chaque lecture ; distinguer une valeur, un résultat vide et une erreur.
4. Si possible, reprendre l’essai avec autorisation refusée, puis rouvrir l’app et vérifier que l’état et le recours à la saisie manuelle restent explicites.
5. Ne pas créer, modifier ni supprimer d’échantillon Santé.

**Résultat attendu**

L’autorisation et les deux lectures sont rapportées séparément. L’entitlement préservé ne suffit pas à confirmer H-3b. Un résultat vide n’est ni un zéro ni, à lui seul, la preuve d’un refus. En cas de refus, d’indisponibilité ou d’erreur, l’état reste explicite et la saisie manuelle demeure disponible.

**Captures à prendre**

- Demande d’autorisation sans valeur corporelle visible.
- Résultat distinct pour `bodyMass` et `stepCount`, après masquage des valeurs.
- Refus/indisponibilité et recours manuel, si ce scénario est exécuté.

**Verdict / date / version**

- Verdict H-3b : ☐ confirmé ☐ bloqué (motif/fallback) ☐ ouvert ☐ non exécuté
- Date : ____________________
- Version/build Spartiate : ____________________
- Résultats (valeurs non requises) : bodyMass __________ stepCount __________
- Observé / lien de capture expurgée : ____________________

**À ne jamais faire**

Ne jamais écrire ou supprimer un échantillon Santé, en particulier un échantillon d’une autre source. Ne pas noter ni transmettre de valeur corporelle réelle. Ne pas supprimer/réinstaller une app et ne pas consulter les données CircleTasks.

## SPA-007 — Live Activity et minuteur de secours

**Prérequis**

- Version du lot SPA-007 publiée et installée par mise à jour normale, sans supprimer l’app.
- SideStore rafraîchie avant le 11 novembre 2026 ; les trois apps restent présentes.
- Autoriser les notifications pour le scénario nominal, puis prévoir un essai distinct de refus si demandé.

**Étapes sur l’iPhone**

1. Lancer le minuteur synthétique de 60 secondes dans Spartiate.
2. Capturer la Live Activity dans la Dynamic Island et sur l’écran verrouillé.
3. Verrouiller l’iPhone, attendre une partie du délai, le déverrouiller et rouvrir Spartiate ; comparer le temps restant à l’heure de fin persistée.
4. Laisser finir le minuteur, constater l’arrêt de l’activité et la réception de la notification ; vérifier qu’aucune activité ne reste orpheline.
5. Si prévu au lot, relancer avec notifications refusées ou Live Activity indisponible et constater le fallback dans l’app.

**Résultat attendu**

L’activité apparaît puis se termine sans doublon ; le temps restant est recalculé après verrouillage et reprise. Si Live Activity ou notification est indisponible/refusée, le fallback est explicite. Une compilation ou un statut de code seul ne confirme pas H-4.

**Captures à prendre**

- Dynamic Island, écran verrouillé et notification reçue.
- Reprise avec temps restant, puis état après fin/arrêt.
- Fallback et refus, si testés. Ne pas inclure de profil ni de QR.

**Verdict / date / version**

- Verdict H-4 : ☐ confirmé ☐ bloqué (motif/fallback) ☐ ouvert ☐ non exécuté
- Date : ____________________
- Version/build Spartiate : ____________________
- Version iOS / SideStore : ____________________
- Observé / lien de capture expurgée : ____________________

**À ne jamais faire**

Ne pas supprimer d’app pour libérer une place d’extension, ne pas réinstaller par-dessus l’app existante, ne pas retirer CircleTasks et ne pas consulter ses données.

## SPA-008 — Synchronisation profil-poids PC ↔ iPhone

**Prérequis**

- PC et iPhone avec le lot SPA-008, appairage Spartiate configuré et iCloud joignable.
- Une donnée synthétique clairement fictive ; aucune vraie pesée ni donnée personnelle.
- Les deux apps doivent rester au premier plan pour mesurer le délai promis.

**Étapes sur le PC et l’iPhone**

1. Sur le PC, ouvrir l’appareil/synchronisation Spartiate et afficher le QR d’appairage. Ne pas le capturer ni le transmettre.
2. Sur l’iPhone, scanner ce QR dans Spartiate et vérifier l’état d’appairage.
3. Garder les deux apps au premier plan. Saisir une pesée fictive sur le PC et chronométrer de la validation à son affichage sur l’iPhone, sans action de rafraîchissement côté récepteur.
4. Recommencer dans l’autre sens avec une autre valeur explicitement synthétique.
5. Modifier une donnée de profil fictive sur le PC et constater son retour sur l’iPhone.
6. Si le test hors ligne est prévu, constater l’état de panne, rétablir iCloud et vérifier la reprise sans doublon. Ne pas lancer de reset ou d’oubli d’appareil sur les conteneurs d’Ali.

**Résultat attendu**

Les valeurs synthétiques convergent dans les deux sens en moins de 60 secondes, uniquement avec les deux apps au premier plan et iCloud joignable. Noter les horaires, conditions et tout échec ; aucun délai n’est promis hors de ces conditions. Le QR et les clés ne figurent pas dans les preuves.

**Captures à prendre**

- État d’appairage sans QR, clé ou identifiant sensible.
- Valeur synthétique et état synchronisé sur chaque appareil, avec horaires de validation/arrivée.
- État de reprise après coupure, si testé.

**Verdict / date / version**

- Verdict : ☐ réussi (< 60 s dans les conditions) ☐ échoué ☐ bloqué ☐ non exécuté
- Date : ____________________
- Version/build PC : ____________________ — iPhone : ____________________
- PC → iPhone : ______ s — iPhone → PC : ______ s
- Réseau / premier plan / observé / lien de capture expurgée : ____________________

**À ne jamais faire**

Ne pas ouvrir ni lire le dossier ou la base CircleTasks, ne pas utiliser de données réelles de poids/profil, ne pas capturer ou transmettre le QR/la clé, et ne pas effacer, réinitialiser ou oublier un appareil réel.

## SPA-010 — Mise à jour 0.1.0 → 0.1.1 et suivi sur sept jours

**Prérequis**

- 0.1.0 identifiée comme N et 0.1.1 publiée comme N+1 ; à la date de cette recette, le démarrage de 0.1.0 est bloqué et la correction 0.1.1 est en cours.
- Avant tout changement de schéma, Ali vérifie une sauvegarde iCloud récente et note sa date ; cette vérification n’est pas une preuve de restauration.
- Signature SideStore rafraîchie avant le 11 novembre 2026. Aucune réinstallation sur PC : l’updater Windows relève de la procédure de l’app.

**Étapes sur l’iPhone**

1. Tant que 0.1.1 n’est pas publiée, ne pas démarrer une mise à jour et laisser l’essai ouvert. Relever les versions disponibles sans supprimer Spartiate.
2. Une fois 0.1.1 publiée, vérifier que SideStore propose bien la mise à jour 0.1.0 → 0.1.1.
3. Avant de mettre à jour, relever uniquement des compteurs, identifiants et une empreinte canonique de données synthétiques, sans exporter de données personnelles ; noter la date de sauvegarde iCloud récente.
4. Dans SideStore, choisir « Mettre à jour ». Ne pas supprimer Spartiate et ne pas installer manuellement une IPA par-dessus.
5. Après mise à jour, relever version/build, comparer les données synthétiques et vérifier que la synchronisation reprend sans nouvel appairage ni ressaisie de clé.
6. Pendant sept jours, noter les dates avant/après des rafraîchissements SideStore au rythme de 5–6 jours et confirmer que SideStore, CircleTasks et Spartiate restent présentes.

**Résultat attendu**

0.1.1 s’ouvre et la mise à jour conserve les données synthétiques et l’usage du coffre sans réappairage. Une capture de version seule ne prouve pas la conservation. Toute perte ou coffre inaccessible arrête l’essai et entraîne un no-go. Le suivi de sept jours reste ouvert jusqu’au terme ; aucune conclusion n’est déduite du code.

**Captures à prendre**

- État avant et après mise à jour : version/build, compteurs et résultat de comparaison synthétique.
- Date de la sauvegarde récente (sans contenu de sauvegarde), reprise de synchro et coexistence des trois apps.
- Relevé daté des rafraîchissements pendant les sept jours, sans profil, valeurs personnelles, clé ou QR.

**Verdict / date / version**

- Verdict I-06 : ☐ réussi ☐ échoué/no-go ☐ bloqué ☐ ouvert ☐ non exécuté
- Date de début / fin des sept jours : ____________________ / ____________________
- Version N / version N+1 : ____________________ / ____________________
- Date de sauvegarde vérifiée : ____________________
- Données synthétiques conservées / coffre utilisable / synchro reprise : ____________________
- Observé / lien de capture expurgée : ____________________

**À ne jamais faire**

Ne jamais supprimer Spartiate, réinstaller l’IPA par-dessus une installation existante, supprimer une autre app, demander/lancer un installeur PC manuellement ou consulter les données CircleTasks. La seule opération autorisée ici est la mise à jour normale proposée par SideStore, après publication de 0.1.1.
