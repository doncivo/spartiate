## 1. Décision produit, mission, principes

### 1.1 Décision

Spartiate est une application **personnelle** de musculation, nutrition et récupération, en français, sans compte, sans abonnement, sans serveur propriétaire, sans commercialisation. Une seule base de code React exécutée dans Tauri 2 sur **PC Windows** (WebView2) et sur **iPhone 16 Pro Max** (WKWebView), livrée en une fois, comme CircleTasks. Données locales en SQLite sur chaque appareil, **synchronisées de bout en bout chiffrées par un dossier iCloud Drive**, sans serveur. L'iPhone lit l'Apple Watch Series 11 via Apple Santé et publie les résultats vers le PC. Appels IA facultatifs, explicites, avec ta clé.

### 1.2 Mission

**Savoir chaque jour quoi soulever, à quelle charge et pourquoi ; quoi manger et combien ; quand lever le pied — à partir de tes séries, de ton poids, de ton sommeil et de ta fréquence cardiaque, sur le PC comme sur l'iPhone, sans jamais perdre le contrôle de tes données.**

### 1.3 Ce que Spartiate assemble

| Brique | Référence | Repris |
| --- | --- | --- |
| Moteur de progression | Gravl | 1RM estimé, double progression, arrondi au matériel, « pourquoi cette charge » |
| Programmation | Alpha Progression | Wizard, mésocycle, deload |
| Écran de séance | Hevy | Un écran, démarrage < 10 s |
| Timer et intégration iOS | Reboot Plan | Dynamic Island, Live Activity, Apple Santé |
| Nutrition | MacroFactor | Dépense mesurée, check-in hebdo |
| Récupération | Athlytic, WHOOP, Gravl | Recovery / Exertion / sommeil, récupération par muscle |
| Pile, chaîne, synchro, scaffold | **CircleTasks** | Tauri 2, SideStore, synchro iCloud, agents, conventions |

### 1.4 Principes

1. **Explicable** : chaque charge affiche la règle qui l'a produite, par template, jamais par IA.
2. **Tu as toujours le dernier mot** : toute proposition est modifiable ; la modification est conservée et tracée.
3. **Local-first sur chaque appareil, synchro sans serveur** : rien ne quitte tes appareils et ton iCloud Drive, sauf les appels IA que tu déclenches.
4. **Règles métier dans `src/domain` uniquement**, testées par Vitest ; accès base par `src/db/repositories` uniquement (règle CircleTasks).
5. **Installation répétable avant tout** : I0 prouve PC et iPhone, mise à jour sans perte, synchro.
6. **Fiabilité avant IA** : l'IA n'est jamais dans la boucle critique d'une séance.
7. **Aucune affirmation non vérifiée** : `UNVERIFIED` ou `INHERITED` tant que ce n'est pas rejoué sur Spartiate.
8. **Aucune prétention médicale** ; l'app propose, n'interdit jamais.
9. **Aucune défaillance silencieuse** : toute erreur durable est visible dans l'app (règle CircleTasks).
