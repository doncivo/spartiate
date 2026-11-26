# CLEAN-0296 — `--check` des icônes par la suite, traducteurs typés par `catalogText` (lot 0.29.6)

Statut : **en cours**, branche `CLEAN-0296` depuis `origin/main` `7f1885f2`. Module « coquille, iOS et qualité ». Budget annoncé : M (150 k).
Lignes du registre : § 18.4 b, C-085 ; BL-044 (lecture de la couverture par module, si lisible). Chapitres PRD : 18 (§ 18.4, textes et
icône), 23 (qualité et tests). Choix prudents : D-643 et suivantes, « Claude (choix prudent) ; révisable par Ali ». Aucune question.
Aucun fichier de `src/sync/**`, `src/domain/sync/**`, `src-tauri/src/sync/**` ni `src/platform/sync/**` touché ; aucune migration ;
aucun test désactivé, allongé ni retardé. Fixtures synthétiques uniquement (D-292).

## Passe product-owner : critères (étant donné / quand / alors)

1. **§ 18.4 b** : étant donné les icônes suivies de `src-tauri/icons`, quand la suite Vitest node tourne (CI comprise), alors
   `node scripts/release/generate-icons.mjs --check` est lancé et réussit ; étant donné une copie de ces icônes dont une est retouchée à
   la main (fichier temporaire sous `.codex-tmp/`, désigné par `--target`), alors `--check` échoue (code 1) et nomme le fichier.
2. **C-085** : étant donné les traducteurs `*Text.ts` de `src/` aux paramètres libres (`Record<string, …>`), quand un module passe à
   `catalogText`, alors ses paramètres `{x}` sont typés depuis le texte français, tout appel mal paramétré est corrigé (tsc) et le texte
   affiché ne change pas (tests existants inchangés) ; une garde relève les traducteurs restants et refuse toute hausse : la liste figée
   est exacte dans les deux sens et ne peut que décroître.
3. **Bundle** : le départ ne grossit pas ; `tests/bundle/start-modules.json` inchangé (ou retrait seulement).
4. **Périmètre** : aucun fichier des dossiers de synchro ; un traducteur dont la migration en exigerait un reste nommé dans la liste.
