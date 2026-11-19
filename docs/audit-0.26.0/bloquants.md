# AUDIT-0.26.0 — bloquants établis

Tag audité : `v0.26.0` (`8686a8fc2860f7a94eb193426cbcc640a33bac80`).

Au terme de la partie 1, aucun nouveau bloquant démontré. **Partie 2 en cours : A-008 établi sous injection de panne le 19/11.** L'audit global reste incomplet.

Les constats d’usage connus du lot 0.27.0 seront vérifiés dans les parties 4 et 5. Les risques non reproduits de démarrage/réintégration restent des pistes, listées dans `partie-01.md`.

## A-008 — perte d'une écriture acquittée après un rollback en échec

- **Ce qu'Ali peut voir dans ce scénario** : une première opération affiche une erreur ; une saisie suivante semble enregistrée et reste lisible, puis disparaît au redémarrage.
- Fichier : `src/db/serializedDriver.ts:156-169`. Le rejet de `ROLLBACK` est transformé en booléen ; sauf le texte « no transaction is active », il n'entraîne ni invalidation de la connexion ni arrêt de la file. `inTransaction` repasse à faux même si SQLite conserve la transaction ouverte. Une écriture suivante est alors exécutée et acquittée dans cette transaction non validée.
- Preuve minimale : vrai `createSerializedDriver` et vrai `DbError` du tag, transpilés en mémoire ; SQLite Node dans un fichier **synthétique** sous `preuves/.runtime/`. Injection d'un rejet de transport avant l'exécution de `ROLLBACK`. Une transaction écrit puis rejette ; l'écriture suivante retourne `rowsAffected = 1` et est relue ; fermer puis rouvrir la base ne retrouve que la ligne antérieure aux opérations. Témoin sans panne : l'écriture suivante persiste.
- Résultat : **un témoin vert, un test rouge** ; `preuves/partie2-rollback.test.mjs`, `preuves/partie2-rollback.json`, `preuves/resultats/partie2-rollback.json` et `.log`. Durée du fichier inférieure à une seconde selon le runner Node, aucune suite complète.
- **Limite de preuve** : panne de transport injectée, pas de panne native observée Windows/iPhone ; aucune donnée réelle lue. L'absence de confinement de la connexion et la perte qui en découle sont reproduites, pas la fréquence de cette panne en usage réel. Aucun scénario de mauvaise prescription ni de fuite n'est déduit de ce test.
- Correction proposée, hors audit : si l'annulation ne peut être établie, mettre la connexion en échec fermé, refuser les opérations suivantes et rendre un état durable explicite ; fermer/récupérer la connexion par une voie sûre avant de reprendre. Garder l'erreur initiale **et** la cause du rollback dans le diagnostic. Couvrir aussi l'échec du nettoyage de `sync_guard` après perte de transaction.
- Publication immédiate demandée par Ali ; aucune correction de production dans cette branche.
