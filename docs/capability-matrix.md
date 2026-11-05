# Matrice des capacités — Spartiate

Créée par #13 le 3 novembre 2026 ; mise à jour par chaque ticket qui produit une preuve. Relevé documentaire du PRD v6.3, sans promotion de statut ni validation appareil. Les capacités des § 5–6, de l’annexe B et les hypothèses du § 26.2 sont réunies ci-dessous ; une même capacité citée plusieurs fois n’a qu’une ligne. Les usages distincts d’une infrastructure sont séparés.

Sources : [chaîne de livraison (§ 5)](prd/05-chaine-de-build-installation-et-mise-a-jour.md), [capacités (§ 6)](prd/06-matrice-de-capacites-etat-initial.md), [gate I0 (§ 7)](prd/07-gate-i0-aucun-travail-i1-avant-passage.md), [hypothèses (§ 26.2)](prd/26-registre-des-decisions-et-des-hypotheses.md), [annexe B](prd/29-annexe-b-docs-capability-matrix-md-etat-initial.md).

Statuts du [§ 0.3](prd/00-statut-et-conventions.md) : `CONFIRMED` exige une capture ou un log daté sur Spartiate via la chaîne réelle ; `INHERITED` est une preuve CircleTasks à rejouer ; `PROTOTYPED` atteste seulement une compilation CI ; `UNVERIFIED` reste à prouver ; `BLOCKED` porte une indisponibilité documentée ; `DEFERRED` porte un report. Aucun `CONFIRMED` ni `PROTOTYPED` n’est déclaré dans ce relevé. Depuis la fusion de #20, les scénarios e2e Y-IOS-01 et I-06 sont présents dans le dépôt (`tests/e2e/Y-IOS-01.spec.ts`, `tests/e2e/I-06.spec.ts`) ; leur présence ne vaut pas preuve native sur appareil. Les `BLOCKED` ci-dessous reproduisent les restrictions écrites dans le PRD, sans prétendre à un nouvel essai Spartiate (D-36).

La colonne « Preuve attendue » n’est pas une preuve acquise. Chaque ticket ajoutera le lien exact, la date, le commit/version, l’appareil et le verdict avant tout changement de statut. Les tickets futurs I1–I6 ne sont pas encore numérotés : l’itération du PRD est conservée, sans inventer d’identifiant. Aucune action destructive ni lecture des données CircleTasks n’est autorisée par cette matrice.

## Livraison, socle et synchronisation

| Capacité / référence PRD | Statut actuel du PRD | Preuve attendue sur Spartiate | Ticket producteur / réserve |
| --- | --- | --- | --- |
| Fork, renommage, purge du métier, base neuve et tests verts (§ 6) | UNVERIFIED | Migration `0001_spartiate_init` enregistrée dans `src/db/migrations/index.ts` et tests présents ; suite CI et recette native du démarrage restent à documenter | SPA-000, SPA-001a, SPA-001b (#20 fusionnée) |
| Build Windows NSIS et smoke installeur (§ 6, annexe B) | INHERITED | Artefact identifié ; smoke CI installe/lance/désinstalle sur runner, données témoins conservées | SPA-002 |
| Updater Windows signé avec la clé Spartiate (§ 5, annexe B) | UNVERIFIED (non configuré avant SPA-002, D-30) | Signature minisign Spartiate, manifeste et mise à jour par bannière ; données conservées | SPA-002, SPA-010 ; infrastructure updater INHERITED au § 6, configuration Spartiate non prouvée |
| Build IPA non signée en CI (§ 6, annexe B) | INHERITED | Run macOS vert, IPA arm64 et identité/version/hash contrôlés | SPA-003 |
| Signature ad hoc après --no-sign (§ 5–6) | UNVERIFIED | Signature et entitlements extraits de l’IPA finale ; ouverture après re-signature SideStore | SPA-003, réception SPA-004 |
| Publication spartiate-releases PC et source SideStore (§ 6) | INHERITED | Releases et manifestes concordant avec version, taille et SHA-256 des artefacts finaux | SPA-002/003, réception SPA-004 (ticket du § 6) |
| Installation, ouverture et renouvellement SideStore (§ 6, annexe B) | INHERITED | Captures datées de l’app installée, version et expiration avant/après renouvellement | SPA-004 ; observation sept jours SPA-010 |
| Tauri 2 / WebView sur iOS 18 (H-2) | INHERITED | Recette de l’IPA Spartiate re-signée sur iPhone, version iOS et absence de régression | SPA-004 |
| Trois apps SideStore + CircleTasks + Spartiate (H-16) | UNVERIFIED | Capture datée de coexistence et versions ; quota constaté sans supprimer une app | SPA-004 ; recontrôle SPA-007 si extension |
| Mise à jour SideStore N → N+1 sans perte de base ni Trousseau (H-5, I-06) | UNVERIFIED (scénario e2e rétabli ; preuve appareil ouverte) | `tests/e2e/I-06.spec.ts` et crochet de développement `__ctExtraMigrations` couvrent la migration simulée 1 → 2 ; 0.1.0 → 0.1.1 réel reste à éprouver : captures, hash métier et coffre sans réappairage | SPA-010 |
| Date d’expiration lisible et notification associée (H-7, I-02) | INHERITED | Date effective après re-signature ; notification reçue, refus explicite et renouvellement sans doublon | SPA-004 |
| Quota CI public et capacité macOS suffisante (H-6, § 6) | INHERITED (D-13) | Runs datés, disponibilité et consommation mesurées ; distinguer durée murale et somme des jobs | SPA-003, mesure SPA-010 |
| Protocole de synchro iCloud chiffrée PC ↔ iPhone (§ 6, annexe B) | INHERITED | `SYNC_CATALOGUE` I0 est injecté via `SYNC_STORAGE` ; vecteurs et deux bases (conflit, instantané, reset, oubli, reprise) et recette native dans les deux sens restent requis | SPA-008 |
| Synchro des tables profile / body_weight (§ 6, annexe B) | UNVERIFIED (catalogue, identités et repositories présents) | `SYNC_CATALOGUE` publie `profile` / `body_weight`; `0001_spartiate_init` contient leurs déclencheurs de capture ; prouver HLC, absence de settings, convergence et délai < 60 s sous D-56 | SPA-001b puis SPA-008 |
| Export / import JSON profil-poids (§ 6) | UNVERIFIED (non implémenté) | Aller-retour canonique, archive invalide refusée, import atomique et republication sur deux bases | SPA-005 |
| Parité SQLite Wasm / plugin SQL natif (H-18) | UNVERIFIED | Migration 0001 et tests de migration présents ; prouver les mêmes scénarios DDL, déclencheurs, transactions, pragmas et restauration dans Wasm et Rust CI ; smoke Windows | SPA-001b |
| Coquilles 440 / 1 440 px, rupture 1 024 px, zoom et texte agrandi (H-19a) | UNVERIFIED | Coquilles et écran « Profil et poids » présents ; paires visual relues, frontières 1 024 px, Dynamic Type Très grand et absence de débordement restent requis | SPA-009 |

## Capacités natives et Santé

| Capacité / référence PRD | Statut actuel du PRD | Preuve attendue sur Spartiate | Ticket producteur / réserve |
| --- | --- | --- | --- |
| Entitlement HealthKit dans l’artefact signé et après SideStore (H-3a) | UNVERIFIED — risque I0 | Sortie codesign sur IPA finale et preuve après re-signature ; limites explicites si indisponible | SPA-003 ; réception appareil SPA-004/006 (D-59 précise le relais SPA-006 de l’annexe B) |
| Autorisation Santé, lecture bodyMass et stepCount (H-3b) | UNVERIFIED — code seul, recette native requise | Captures de demande et lectures natives datées, unités/provenance ; résultat vide ne prouve pas un refus de lecture (limite HealthKit) | SPA-006 |
| Écriture puis suppression Santé d’un échantillon créé par Spartiate (H-3c) | UNVERIFIED | Échantillon créé, relu puis supprimé ; aucune suppression d’une autre source ; preuve native | I1 pour séance, I5 pour le reste ; hors gate I0 |
| Lecture HealthKit HRV / FC repos / sommeil / workouts (§ 6, annexe B) | UNVERIFIED (dépend H-3) | Lectures natives datées, unités, provenance, absence de données et fallback fatigue déclarée | I5 |
| Recovery HRV disponible ou dérivable de hrvSDNN (H-20) | UNVERIFIED | Types exposés et valeur lue sur iPhone ; sinon fallback HRV SDNN nocturne documenté | I5 |
| Observer queries HealthKit sans mode fond (H-13) | UNVERIFIED | Déclenchement observé sur iPhone sans UIBackgroundModes ; sinon lecture à l’ouverture | Extension de SPA-006 en I5 |
| Modes de fond HealthKit / GPS (§ 6) | UNVERIFIED (UIBackgroundModes interdit par choix sur CircleTasks) | Essai natif du comportement visé et revue explicite du contrat plist avant évolution ; fallback premier plan | I5 / I6 |
| Live Activity / Dynamic Island, extension WidgetKit (H-4) | UNVERIFIED — risque I0 | Injection reproductible, signatures app/extension, captures Island/verrouillage, fin et reprise ; fallback prouvé si blocage | SPA-007 |
| Minuteur in-app de secours (§ 6) | INHERITED (fallback Live Activity) | Date de fin persistée, reprise après verrouillage, absence de dérive et arrêt correct | SPA-007, intégration I1 |
| Notifications locales avec actions (§ 5–6, annexe B) | INHERITED | Notification réellement reçue, action exécutée, refus visible, absence de doublon et aucun envoi PC | SPA-004 pour signature, SPA-007 pour timer, I1 pour usages métier |
| Verrouillage / reprise de session (annexe B, ADR 0013) | INHERITED | Séance synthétique conservée après verrouillage et reprise sur iPhone | I1 |
| Face ID, capacité native (§ 5–6) | INHERITED | Essai d’authentification, annulation et indisponibilité sur Spartiate si activation autorisée | I1 / I4 selon § 6 ; activation distincte de H-17 |
| Trousseau / coffre (§ 5–6) | INHERITED | Secret synthétique utilisable après redémarrage et mise à jour, sans valeur dans les preuves | SPA-008/010 ; usages I1 / I4 |
| Haptique (§ 5–6, annexe B) | INHERITED | Retour constaté sur iPhone aux actions prévues ; comportement PC explicite | I1 |
| Fichiers et accès au dossier iCloud (§ 5–6, annexe B) | INHERITED | Sélection/partage d’une fixture, accès après reprise et refus explicites | SPA-005/008 ; usages I1 / I4 |
| Caméra (§ 5–6) | INHERITED | Permission, refus et capture native Spartiate ; pas d’accès photothèque ajouté | I4 ; appairage SPA-008 |
| Scanner QR (§ 5–6, annexe B) | INHERITED | Appairage natif QR réussi et format étranger refusé, sans clé dans les preuves | SPA-008 ; autres usages I1 |
| Scan de code-barres alimentaire (annexe B) | UNVERIFIED (scanner présent) | Lecture réelle d’un code alimentaire et résolution produit ; inconnu/refus gérés | I4 |
| Camera Control dans WebView / plugin (H-10) | UNVERIFIED | Spike sur iPhone ; scanner existant insuffisant ; fallback bouton | I4 |
| App Intents, Siri et Action button (§ 6) | UNVERIFIED (plugin Swift nécessaire) | Invocation native et résultat observé ; fallback démarrage depuis l’app | I6 |
| Widgets écran d’accueil lisant les données (§ 6, annexe B) | BLOCKED (App Groups) | Restriction documentée ; réouverture seulement après décision et essai natif | Aucun ticket ; fallback DEFERRED au § 6 |
| App Apple Watch (annexe B) | BLOCKED (équipe personnelle) | Restriction documentée ; aucune capacité Watch revendiquée | Aucun ticket |
| Push distant (annexe B) | BLOCKED (équipe personnelle) | Restriction documentée ; aucune livraison distante revendiquée | Aucun ticket |
| Activation du verrou local Face ID / Windows Hello (H-17, § 22) | DEFERRED (code conservé, entrée masquée, D-37) | Décision d’Ali Q-6 avant activation puis recette native ; le code ne prouve pas l’utilité | Aucun ticket avant décision d’Ali |

## Données, moteurs et services

| Capacité / référence PRD | Statut actuel du PRD | Preuve attendue sur Spartiate | Ticket producteur / réserve |
| --- | --- | --- | --- |
| Reproduction des algorithmes publiés par Gravl (H-1) | UNVERIFIED | Vecteurs comparés aux exemples publiés et limites documentées | I2 |
| Bibliothèque de 150 exercices et quatre programmes suffisants (H-8) | UNVERIFIED | Relecture d’Ali sur ses routines et programmes | I1 |
| Médias d’exercices sous licence compatible (H-9) | UNVERIFIED | Sources et licences vérifiées ; fallback sans image | I1 |
| Licence Ciqual permettant l’embarquement (H-11) | UNVERIFIED (très probable) | Licence lue et note d’attribution dans docs/licences.md | I4 |
| API Open Food Facts accessible sans clé (H-12, § 6) | UNVERIFIED | Appel de test sur l’usage prévu, résultat et limites ; fallback Ciqual + manuel | I4 |
| Appels API IA via Rust (annexe B, § 6) | UNVERIFIED (fournisseur Q-2, H-14) | Contrat fournisseur, requête synthétique, erreurs et plafond éprouvés ; aucune donnée corporelle envoyée | I4 |
| Fournisseur IA, coût mensuel et plafond acceptables (H-14) | UNVERIFIED | Décision d’Ali Q-2 et contrôle du plafond configurable | Avant I4, ticket IA I4 |
| Recharts : trois ans de séries en < 300 ms (H-15) | UNVERIFIED | Mesure test:perf sur fixture synthétique de trois ans, chemin réel des graphiques | I2 |
| Couverture des huit micronutriments épinglés par Ciqual (H-19b) | UNVERIFIED | Comptage des colonnes et de la couverture des aliments génériques au chargement | I6 |

Les qualifications du PRD restent conservées même si un lot de code est déjà fusionné. En particulier, l’annexe B distingue l’updater signé Spartiate du mécanisme hérité ; D-59 distingue H-3a / H-3b / H-3c et leurs tickets. Les mentions conditionnelles « si CONFIRMED » des écrans métier ne constituent jamais un statut acquis.
