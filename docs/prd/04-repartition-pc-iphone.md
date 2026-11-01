## 4. Répartition PC / iPhone

Le même front tourne sur les deux ; ce qui diffère, c'est l'accès au matériel. Le PC est le poste de pilotage (programme, nutrition au clavier, analyses, exports) ; l'iPhone est le poste de terrain (séance, timer, scan, photo, Watch). Rien n'est réservé au PC sauf par confort.

| Fonction | PC | iPhone | Note |
| --- | --- | --- | --- |
| Séance active, timer, Live Activity | Possible (saisie clavier, timer in-app) | **Principal** | Live Activity et haptique iPhone seulement |
| Programme, mésocycle, routines, bibliothèque, profils de matériel | **Principal** (édition confortable) | Oui | — |
| Journal alimentaire | Saisie clavier, recettes, stratégie | Scan, photo, saisie rapide | Photo et scan iPhone seulement (caméra) |
| Pesée | Saisie manuelle | Manuelle ou Apple Santé | — |
| Récupération (HRV, FC, sommeil, scores) | **Lecture seule** des résultats publiés par l'iPhone | **Calcul** via HealthKit | Le PC n'a jamais accès à Apple Santé |
| Cardio GPS | — | Oui (I6) | — |
| Progrès, graphiques, bilans IA, exports | **Principal** | Oui | — |
| Diagnostic, journaux | Oui | Oui | Export des journaux iPhone via Fichiers / iCloud Drive |
| Notifications | Non (choix CircleTasks : le PC n'envoie pas de rappels) | Oui | — |
| Verrou | Code / Windows | Face ID / code | Code repris de CircleTasks, entrée masquée, activation différée jusqu'à ta décision (D-37, H-17) |
| Mise à jour | Bannière updater | SideStore | — |

### 4.1 Règles

- **Un seul écrivain par appareil, fusion par champ** (ADR 0011) : une séance commencée sur l'iPhone et éditée sur le PC se fusionne champ par champ avec HLC ; la séance en cours (non terminée) n'est **pas publiée** tant qu'elle n'est pas terminée, pour éviter les conflits en direct. Cette publication à la clôture est une conception et un lot de tests I1 (§ 9.1, D-27), pas un acquis du catalogue hérité.
- Les scores de récupération et les mesures HealthKit sont publiés **par l'iPhone** sous forme de résumés quotidiens (table `recovery_day`), jamais les échantillons bruts.
- Les photos (repas, progression) restent sur l'appareil qui les a prises ; seules leurs métadonnées sont publiées (option « synchroniser les photos de progression » en I6 via le dossier iCloud).
- Les clés : clé de synchro dans le coffre de chaque appareil (ADR 0011 § 2) ; clé API IA dans le coffre de chaque appareil, saisie une fois par appareil, jamais synchronisée.
