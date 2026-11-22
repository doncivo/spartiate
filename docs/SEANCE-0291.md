# SEANCE-0291 — Séance et moteur : restes de FIX-ASSIST et FIX-ABERR, charge hors grille

Lot 0.29.1 (docs/LOT-0.29.1.md), registre « séance et moteur » : BL-090, BL-091, BL-092, BL-106. Chapitres : 11 (moteur), 13 (séance), 13.8
(historique). Agents : product-owner, training / domain-logic, qa-test, code-reviewer. Aucune migration, aucun fichier de synchro ;
`ENGINE_VERSION` inchangée (aucune valeur de configuration modifiée ; une raison ajoutée, ignorée par une version antérieure).
Reportés à la PR suivante : BL-108, BL-110, BL-111, BL-112 (taille M), BL-121 (lit les gênes, dont la source change avec SYNC-0291).

## Passe product-owner (critères)

1. BL-090 : étant donné un exercice personnalisé avec la machine d'assistance (supprimé ou non), alors le volume d'une séance dans le
   journal l'exclut, comme le résumé de fin (FIX-ASSIST (d)).
2. BL-091 : étant donné un assisté dont l'assistance est maintenue (inactivité, Recovery basse), alors aucune alerte secondaire ne dit
   « charge réduite de x % » ; l'assistance maintenue est dite.
3. BL-092 : étant donné les séances closes antérieures, alors le résumé de fin les ordonne par leur fin réelle (`ended_at`) et une séance
   de décharge retenue ne confirme pas une aberrante (D-323 (2), comme le moteur).
4. BL-106 : étant donné une charge d'historique absente de la grille du profil courant (autre salle, maximum dépassé), alors la
   prescription n'est pas changée en silence et la phrase demande de vérifier ; aucun arrondi sans décision d'Ali.

## Décisions (à reporter dans docs/decisions.md à la fusion)

- **D-470** (BL-092) : le dépôt donne au résumé de fin la fin réelle des séances closes et les exercices en décharge retenue, lus avec
  la règle du moteur (`isRetainedDeload`, `isRevertRow` de progressionRepository, désormais exportées) ; sans ces données (appelant
  ancien), repli sur la dernière série validée, comme avant.
- **D-471** (BL-106, D-365 non tranchée par Ali le 21/11) : la référence reste disponible (elle a été soulevée : paire d'haltères en plus,
  choix d'origine) ; si la grille du profil courant ne la contient pas, raison `reference-off-grid` et note « la charge de ta dernière
  séance (n kg) n'est pas dans le matériel de ce profil : vérifie qu'elle existe ici, sinon modifie la charge ». Arrondi vers le bas à la
  grille et plafond du matériel : à trancher par Ali (BL-106 reste « à trancher » pour ce point). Révisable par Ali.

## Passe agent du module

- `src/features/training/history/HistoryView.tsx` (BL-090) : ensemble des assistés (catalogue et personnalisés, supprimés compris).
- `src/domain/training/explain.ts`, `src/i18n/fr.progression.ts` (BL-091) : `alertInactivityAssistHeld`, `alertRecoveryAssistHeld`.
- `src/domain/training/closure.ts`, `src/db/repositories/sql/workoutRepository.ts`, `progressionRepository.ts` (BL-092) : `PastSessionMeta`.
- `src/domain/training/prescribe.ts`, `explain.ts`, `config.ts`, `types.ts`, `fr.progression.ts` (BL-106) : raison et note.

## Passe qa-test

- Rouge → vert : BL-090 `e318e26a` → `caaa3e47` ; BL-091 `4cc5e11f` → `586e0315` ; BL-092 `1373bf53` → `8cf176db` : vecteur du domaine
  rouge puis vert, test de dépôt rouge contre le dépôt d'avant (vérifié en remettant `workoutRepository.ts` de HEAD) puis vert ;
  BL-106 rouge puis `e1a48365`.
- Changement d'attente assumé : `prescribe.test.ts`, paire d'haltères hors grille (9 kg) : la raison `reference-off-grid` s'ajoute (D-471).
- Lancés en local (`--maxWorkers=1`) : src/domain/training, src/features/training/session et history, src/i18n, workoutClosure,
  progressionRepository (verts ; un dépassement de délai isolé de programImport.qa.test.ts sous charge, vert seul) ; tsc et eslint propres.

## Passe code-reviewer (à froid)

Relecture 1 (agent code-reviewer distinct, lecture seule) : **à corriger**. (1, bloquant) note de BL-106 : charge écrite à l'anglaise
(« 22.5 ») et sans « 2 × » pour une paire d'haltères : `progressionNoteText` (src/i18n/progressionText.ts) formate le paramètre `load`
comme la phrase principale ; test à 22,5 kg. (2, important) BL-091 : journée rouge acceptée d'un assisté en alerte secondaire, la journée
rouge n'était plus dite : `alertRedDayAssistHeld` (« estimation, pas un avis médical » conservé) ; mineur traité : série retirée d'un
assisté d'isolation dite (`alertRecoveryAssistHeldSet`). Mineurs traités : note hors grille seulement si la proposition reste à la charge
de la référence et si celle-ci est positive (lest nul). Rouge `bb475e7f` → vert `ee53edf7` puis correctif de type. Mineur consigné : le
journal (BL-090) lit le matériel par `parseEquipmentIds`, plus strict que `equipmentOf` du résumé ; écart théorique.
