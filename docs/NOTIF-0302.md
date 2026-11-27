# NOTIF-0302 — chaque notification ouvre l'écran qu'elle concerne (lot 0.30.2)

Budget M (≈ 150 k ; notifications, ios-mobile, app-shell). Demande d'Ali du 27/11 (point 1, D-765, D-762 révisée). Registre : BL-184.
Décisions ajoutées : D-770 à D-773 ; hypothèse H-44 (UNVERIFIED, docs/capability-matrix.md). Chapitres : 18 (navigation et écrans), 13.3
(notification de fin de repos) ; ADR 0012 (planificateur, avenant N-03 : plugin notification-actions). Aucune migration, aucune table, aucun
fichier de synchro ; bundle de départ inchangé (aucun module nouveau dans le départ : le répartiteur est déjà à la demande).

## Inventaire (toutes les notifications émises et leur écran)

| Famille | Identifiant (`extra.sid`) | Émetteur | Écran ouvert par l'appui |
|---|---|---|---|
| Rappel des mesures | `measurement:AAAA-MM-JJ` | `measurementNotifications.ts` | Progrès › Corps › Mesures |
| Rappel de compléments | `supplement:AAAA-MM-JJTHH:MM` | `supplementNotifications.ts` | Nutrition › Compléments |
| Check-in des gênes | `injury:AAAA-MM-JJ` | `injuryNotifications.ts` | Aujourd'hui (carte de suivi) |
| Récupération du matin | `morning:AAAA-MM-JJ` | `recoveryNotifications.ts` | Aujourd'hui (cadrans) |
| Coucher conseillé | `bedtime:AAAA-MM-JJ` | `recoveryNotifications.ts` | Aujourd'hui (besoin de sommeil) |
| Fin de repos | `timer:rest` | `timerNotification.ts` | Entraînement › Séance |
| Minuteur de test (SPA-007) | `timer:test` | `timerNotification.ts` | Plus › Journaux |
| Expiration de la signature | `signing` | `tauriSigningAlert.ts` | Plus › SideStore |
| Tâche, routine, évènement, récapitulatif, répétition (héritées, plus émises) | `task:…`, `routine:…`, `event:…`, `recap:…`, `snooze:…` | aucun | Aujourd'hui |

Table pure : `src/domain/notificationTargets.ts` ; test : `src/features/notifications/notificationOpen.test.ts` (chaque `NotificationKind` a
une cible ; inventaire fermé ; tout fichier nouveau qui pose `extra: { sid … }` rend le test rouge tant qu'il n'est pas inscrit).

## Passes

- **product-owner** — Critères : 1. Given une notification de chaque famille, When Ali l'ouvre d'un appui simple (app ouverte, en arrière-plan
  ou fermée), Then l'app ouvre l'écran de l'inventaire ; le rappel des mesures ouvre Progrès › Corps › Mesures. 2. Given l'inventaire, Then
  chaque famille a une cible et tout émetteur nouveau est signalé par un test. 3. Given plusieurs appuis tirés ensemble, Then seul le plus
  récent est suivi ; un appui déjà suivi n'est pas rejoué ; un appui de plus de 10 minutes (fichier rejoué) ou sans cible ne bouge rien et
  laisse un code au journal. 4. Given un échec du gestionnaire d'ouverture, Then les actions « Pris », « +30 s » et « Passer » sont traitées
  comme avant et un code est journalisé. 5. Le PC n'émet aucune notification : rien ne change sur le PC.
- **notifications / ios-mobile / app-shell** — Swift (`NotificationActionsPlugin.swift`) : `UNNotificationDefaultActionIdentifier` écrit
  comme action « open » avec le `sid` (même fichier durable, même `fsync` avant le gestionnaire de fin, même réveil du JS) ; « open » ajouté à
  `knownActions` (relu au `drain`). Plateforme : `RawOpenAction`, `ActionDrain.opens` (analyse stricte, faux). Répartiteur : appuis passés à
  `open` avant les compléments, acquittés avec le reste. Coquille : `createNotificationOpener` (`notificationOpen.ts`) ouvre l'écran par le
  store de navigation. Choix : D-770 à D-773.
- **qa-test** — Rouge `c802a2f0` : 5 tests rouges (analyse, faux, Swift, répartiteur ×2) et `notificationOpen.test.ts` en échec (module
  absent). Vert `eec7dd1b` : src/features/notifications, src/platform/notifications, src/domain/notification* : 420 tests verts ;
  `npm run test:bundle` : 201 verts (plafond inchangé) ; `tsc --noEmit` et eslint verts. Test qui figeait la liste exacte `knownActions`
  (`restActions.test.ts`) réécrit dans le commit vert, qui le dit. Preuve native : H-44, constat d'Ali (docs/constats-ali.md, section 0.30.2).
- **code-reviewer** — Relecture à froid par un agent distinct : « à corriger », code sain ; bloquants : décisions, H-44, registre et fiche
  pas encore écrits (portés après la fusion de DEC-0302, qui crée BL-184 et D-765). Vérifié : inventaire complet (trois émetteurs seulement ;
  la Live Activity n'a pas de `widgetURL`, elle n'est pas une notification et reste hors mécanisme), Swift (appui converti avant la garde,
  même écriture puis gestionnaire de fin), démarrage à froid (store de navigation jamais réinitialisé, aucune restauration de route),
  acquittement, routes, couches, bundle. Mineurs traités : garde des émetteurs élargie (`bridge.show(`, `plugin:notification|`, `extra`
  avec `sid`), lecture du Swift par `__dirname`, `switch` exhaustif (`never`). Gardés : fin de repos sans séance active → écran de séance
  (il montre alors le départ) ; le plus récent d'un tirage est suivi même sans cible (D-772).
