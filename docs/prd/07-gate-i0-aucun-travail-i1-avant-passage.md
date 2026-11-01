## 7. Gate I0 — aucun travail I1 avant passage

### 7.1 Essais

1. Fork nettoyé : `npm run lint`, `npm run typecheck`, `npm run test` verts avec le métier CircleTasks retiré et une base neuve (migration `0001_spartiate_init`) ; `tests.yml` « suite verte » ; `npm run tauri dev` ouvre Spartiate sur le PC avec l'écran Diagnostic.
2. `build-windows.yml` vert sur une branche ; smoke CI : installeur NSIS installé, lancé, désinstallé sur le runner, donnée témoin conservée ; tag `v0.1.0` publié sur `spartiate-releases` (N = 0.1.0, aucun tag 0.0.x ; `RELEASES_TOKEN` disponible avant SPA-002, D-58) ; tu installes quand tu le décides ; `v0.1.1` reçue par la bannière de mise à jour, données conservées (D-39).
3. `build-ios.yml` vert : IPA signée ad hoc, `codesign -d --entitlements` montre HealthKit ; tag `ios-v0.1.0` publié ; source ajoutée dans SideStore ; Spartiate installée et ouverte ; `ios-v0.1.1` appliquée par « Mettre à jour » sans suppression ; données conservées ; les trois apps coexistent.
4. Export / import JSON : export sur l'iPhone, import sur le PC (base vide) → mêmes compteurs et identifiants.
5. Synchro : dossier `iCloud Drive/Spartiate` choisi sur le PC, appairage de l'iPhone par QR, un poids saisi sur l'iPhone apparaît sur le PC, une modification du profil sur le PC revient sur l'iPhone, aucun conflit parasite. Aucune séance n'est exigée avant I1 (D-43).
6. HealthKit (plugin) : permission affichée ; pas du jour lus ; pesée de test écrite, lue, supprimée ; entitlements de l'app installée inspectés depuis Diagnostic.
7. Live Activity (plugin + extension) : compteur visible sur l'écran verrouillé et dans la Dynamic Island ; extension signalée par SideStore ; notification locale à la date programmée.
8. Diagnostic complet sur les deux appareils ; journaux exportés et lus.
9. Mesure : durées des jobs, minutes CI.

### 7.2 Seuil de passage

**Obligatoire :** 1 à 5 et 8. **Conditionnel :** 6 et 7 peuvent être `BLOCKED` avec fallback accepté ; dans ce cas I5 est repoussé et le timer utilise le fallback. I0 prouve profil et poids synchronisés, navigation minimale, diagnostics et chaîne de livraison ; la coquille 001b est fonctionnelle et sobre, la mise en page fidèle aux maquettes est SPA-009 (D-43). **HealthKit (D-59)** : le gate I0 exige H-3a (entitlement présent dans l’artefact signé, SPA-003) prouvée ou `BLOCKED` documenté, et H-3b (autorisation, lecture `bodyMass` et `stepCount`, SPA-006) `CONFIRMED` ou `BLOCKED` avec fallback saisie manuelle ; H-3c (écriture puis suppression d’un échantillon **créé par Spartiate** : I1 pour la séance, I5 pour le reste) n’est pas un critère I0 ; jamais de suppression d’un échantillon d’une autre source.

### 7.3 Fallbacks

| Situation | Fallback |
| --- | --- |
| HealthKit indisponible | Poids, sommeil (durée) et fatigue saisis à la main sur l'iPhone ou le PC ; aucune prétention HRV / FC |
| Live Activity indisponible | Timer in-app sur date de fin persistée + notification locale (prouvée) |
| Synchro en échec | Export / import manuel entre appareils ; bandeau d'état (A-09) |
| Mise à jour destructive | Export, réinstallation, import ; jamais de suppression automatique |
| Installation iPhone impossible | Diagnostiquer entitlements et signature ad hoc ; retirer la signature ad hoc pour isoler ; reconsidérer le canal (§ 26.1, D-5) |
