# Gate I0 — dossier go / no-go (SPA-010)

État au 2026-11-06, version publiée 0.1.6 (clôture I0). Source : [PRD § 7](prd/07-gate-i0-aucun-travail-i1-avant-passage.md), preuves dans [docs/capability-matrix.md](capability-matrix.md). Les constats « d'Ali » sont datés du 2026-11-06, sur ses appareils, captures conservées par Ali hors dépôt (D-36). Rien n'est marqué `CONFIRMED` ici sans constat.

## Les 9 essais du § 7.1

| # | Essai | Statut | Preuve | Date |
| --- | --- | --- | --- | --- |
| 1 | Fork nettoyé : lint, typecheck, tests, « suite verte » ; l'app s'ouvre sur le PC | CONFIRMED pour lint, typecheck, tests et « suite verte » ; `npm run tauri dev` non lancé (D-54, il recréerait le conteneur de données) ; l'app installée s'ouvre sur le PC | Run `tests.yml` 42215709904 sur 6ec40539 (25 jobs verts) ; mises à jour du PC jusqu'à 0.1.5 | 2026-11-06 |
| 2 | `build-windows.yml` vert, smoke installeur, `v0.1.0` publiée, mise à jour par la bannière, données conservées | CONFIRMED | Job « smoke Windows » vert ; releases `v0.1.0` à `v0.1.5` sur spartiate-releases ; constat d'Ali : bannière de 0.1.0 à 0.1.5, données conservées | 2026-11-06 |
| 3 | `build-ios.yml` vert, IPA signée ad hoc, SideStore, mise à jour sans suppression, trois apps | CONFIRMED (l'entitlement HealthKit est dans l'IPA de la CI, SideStore le retire : voir l'essai 6) | Run `build-ios.yml` 42215752205 vert ; constat d'Ali : installée, ouverte, mise à jour de 0.1.0 à 0.1.5 sans suppression ; SideStore, l'ancienne app et Spartiate sur l'écran d'accueil à 13:13 | 2026-11-06 |
| 4 | Export / import JSON : export sur l'iPhone, import sur le PC, mêmes compteurs | CONFIRMED | Constat d'Ali sur la 0.1.6 : export sur l'iPhone puis import sur le PC, fait | 2026-11-06 |
| 5 | Synchro : poids iPhone → PC, profil PC → iPhone, aucun conflit parasite | CONFIRMED pour la pesée dans les deux sens ; modification du profil PC → iPhone et absence de conflit parasite non relevées explicitement | Pesée de 10:01 lue par le PC à 10:01 (0.1.3) ; pesée du PC apparue sur l'iPhone en moins d'une minute (0.1.4) ; « dernière modification lue » à jour dans les deux sens (0.1.4) | 2026-11-06 |
| 6 | HealthKit : permission, pas du jour, pesée de test | BLOCKED, fallback accepté : saisie manuelle du poids (D-69) | Capture d'Ali de 10:00 : code 4 « Missing com.apple.developer.healthkit entitlement » ; SideStore retire la capacité avec un compte Apple gratuit (H-3a, H-3b) | 2026-11-06 |
| 7 | Live Activity : compteur sur écran verrouillé et Dynamic Island, extension signalée, notification à l'heure | CONFIRMED (H-4), avec deux défauts d'affichage de l'écran verrouillé à corriger en I1-02 : texte noir sur fond sombre, activité figée à 0:00 au lieu de « Terminé » | Constat d'Ali sur la 0.1.6 : décompte sur l'écran verrouillé ; Dynamic Island compacte avec l'icône du minuteur et le décompte 0:57 (capture de 15:45) ; notification « Minuteur terminé » reçue à l'échéance, sans avance ; défauts relevés sur la capture de 15:41 ; extension signalée par SideStore sans App ID supplémentaire | 2026-11-06 |
| 8 | Diagnostic complet sur les deux appareils, journaux exportés et lus | CONFIRMED | Constat d'Ali sur la 0.1.6 : journaux exportés depuis Diagnostic sur l'iPhone et sur le PC | 2026-11-06 |
| 9 | Mesure : durées des jobs, minutes CI | CONFIRMED (mesure ci-dessous) | API GitHub Actions, runs ci-dessous | 2026-11-06 |

## Seuil de passage (§ 7.2)

- **Obligatoires** : 1, 2, 3, 4, 5 et 8. Tous acquis le 2026-11-06 ; pour 5, la pesée est constatée dans les deux sens, la modification du profil du PC vers l'iPhone n'a pas été relevée explicitement et n'a pas été exigée par Ali pour son go.
- **Conditionnels** : 6 et 7 peuvent être `BLOCKED` avec un fallback accepté. L'essai 6 est BLOCKED avec le fallback de saisie manuelle (D-69) ; I5 est repoussé pour la partie Santé. L'essai 7 est CONFIRMED (H-4) : le fallback (minuteur dans l'app sur date persistée plus notification locale) reste livré pour le minuteur de repos d'I1.
- HealthKit (D-59) : H-3a prouvée `BLOCKED` documenté, H-3b `BLOCKED` avec fallback : le gate l'accepte.

## Mesures CI (essai 9)

Durée de job = fin − début du job (API GitHub Actions) ; « somme » = somme des jobs (durée de calcul), « mur » = durée du run. Dernier run vert de chaque workflow, sur le commit fusionné 6ec40539 (#50).

| Workflow | Run | Mur | Somme des jobs | Job le plus long |
| --- | --- | --- | --- | --- |
| `tests.yml` | 42215709904 | 16 min 47 s | 57,3 min (25 jobs) | cargo test (Windows) 16,6 min ; smoke Windows 6,9 min ; Performance et bundle 2,7 min |
| `build-windows.yml` (tag `v0.1.5`) | 42215752524 | 11 min 29 s | 10,3 min | windows 10,2 min |
| `build-ios.yml` (tag `ios-v0.1.5`) | 42215752205 | 13 min 55 s | 12,9 min | ios 12,6 min (runner macOS) |

Le dépôt est public : les minutes standard ne sont pas décomptées ; la consommation macOS n'est pas relevée ici (l'API ne la donne pas par job).

## Ce qui restait à Ali

Les trois preuves attendues (essai 4, essai 8, Dynamic Island et heure de la notification) ont été constatées par Ali le 2026-11-06 sur la 0.1.6. Il ne reste rien à prouver pour sortir d'I0 ; les deux défauts d'affichage de la Live Activity sont repris en I1-02.

## Décisions avant I1 (D-71)

- Références logiques aux exercices, sans clé étrangère ; UUID pour les exercices personnalisés, collision refusée ; nom de l'exercice figé dans l'historique.
- Médias (H-9) : aucune image ni vidéo embarquée sans licence vérifiée ; fallback sans image.

## Conclusion

Go I1 accordé par Ali le 2026-11-06.
