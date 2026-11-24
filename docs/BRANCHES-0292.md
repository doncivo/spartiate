# BRANCHES-0292 — branches distantes fusionnées supprimées (BL-151, D-495)

Relevé du 24/11 (git ls-remote --heads origin, gh pr list --state all) avant suppression. Supprimée : branche dont toutes les PR sont MERGED, hors main, audit-0.26.0 et audit-claude-0.27.0. Aucun tag touché, aucun worktree local supprimé (D-495).

## Gardées

| Branche | PR et état |
|---|---|
| audit-0.26.0 | OPEN/draft#148 |
| audit-claude-0.27.0 | OPEN/draft#155 |
| cadrage-avant-spa-001 | CLOSED#8 |
| i1-01-contenu | aucune PR |
| i1-01-donnees | aucune PR |
| i1-01-rust | aucune PR |
| i1-01-ui | aucune PR |
| i1-02 | aucune PR |
| i1-02-donnees | aucune PR |
| i1-02-live | aucune PR |
| i1-02-ui | aucune PR |
| i1-03-sync | aucune PR |
| i1-03-ui | aucune PR |
| main | aucune PR |
| moteur-correctifs | CLOSED#63 |
| relecture-codex-2026-11-13 | CLOSED#127 |

## Supprimées

| Branche | PR et état |
|---|---|
| A11Y | MERGED#174 |
| AUDIT-0292 | MERGED#207 |
| AUDIT-USAGE | MERGED#149 |
| BILAN-029 | MERGED#186 |
| BLESSURES | MERGED#182 |
| CI-0292 | MERGED#205 |
| CI-PUB | MERGED#169 |
| CLEAN-01-residus | MERGED#106 |
| CLEAN-02-second-nettoyage | MERGED#118 |
| COQUILLE-0291 | MERGED#198 |
| COQUILLE-PC | MERGED#181 |
| DEC-0290 | MERGED#185 |
| DEP-01-libsqlite3-sys | MERGED#113 |
| DOC-D119-validation | MERGED#108 |
| DOC-D226-decisions | MERGED#123 |
| DOC-D38-usage-reel | MERGED#129 |
| DOC-FIX-0241-fiche | MERGED#130 |
| DOC-FIX0242 | MERGED#144 |
| DOC-H21 | MERGED#141 |
| DOC-PRIV | MERGED#156 |
| DOC-rapport-matin-2026-11-13 | MERGED#122 |
| ERGO-01-ergonomie | MERGED#116 |
| ERGO-01b-regles-ecrans | MERGED#125 |
| ERGO-02-ecrans-restants | MERGED#128 |
| ERGO-02b | MERGED#137 |
| ERGO-03 | MERGED#143 |
| FIX-0115-onglets-e2e | MERGED#100 |
| FIX-0116-ci-today | MERGED#104 |
| FIX-0171-bloquants-photos | MERGED#110 |
| FIX-0172-sommeil | MERGED#109 |
| FIX-0173-renpho-export-salle | MERGED#111 |
| FIX-0181-favoris-journee-rouge | MERGED#115 |
| FIX-0182-y-ios-02 | MERGED#114 |
| FIX-0221-action-pris | MERGED#124 |
| FIX-0223-seance-du-jour | MERGED#126 |
| FIX-0241 | MERGED#135 |
| FIX-0242 | MERGED#134 |
| FIX-0243 | MERGED#136 |
| FIX-0244 | MERGED#139 |
| FIX-0271 | MERGED#150 |
| FIX-0272 | MERGED#153 |
| FIX-A008 | MERGED#160 |
| FIX-A009 | MERGED#161 |
| FIX-A009b | MERGED#162 |
| FIX-ABERR | MERGED#159 |
| FIX-ASSIST | MERGED#157 |
| FIX-CONFID-IOS | MERGED#163 |
| FIX-COQUILLE | MERGED#170 |
| FIX-EXPORT | MERGED#164 |
| FIX-PLANCHER | MERGED#165 |
| FIX-PROGRAMME | MERGED#167 |
| FIX-RECUP | MERGED#166 |
| FIX-SAISIE-NUTRI | MERGED#168 |
| HIST-01 | MERGED#158 |
| I2-03-rampes-echauffement | MERGED#70 |
| I2-04 | MERGED#68 |
| I3-01-generation | MERGED#72 |
| I3-07-onboarding | MERGED#103 |
| I4-01-domaine-nutrition | MERGED#77 |
| I6-01-recuperation | MERGED#99 |
| I6-02-corps | MERGED#101 |
| I6-03-circuits | MERGED#102 |
| I6-03b-circuits-routines-replay | MERGED#112 |
| I6-04-renpho | MERGED#105 |
| I6-05-complements | MERGED#119 |
| I6-06-cardio | MERGED#121 |
| I6-07-medias-exercice | MERGED#120 |
| IMPORT-029 | MERGED#187 |
| IOS-029 | MERGED#190 |
| LOT-0291 | MERGED#196 |
| LOT-0292 | MERGED#204 |
| MATRICE-DOC | MERGED#171 |
| MEDIA-02 | MERGED#142 |
| MEDIA-03 | MERGED#191 |
| MOTEUR-0281 | MERGED#178 |
| NETTOYAGE | MERGED#176 |
| NUTRI | MERGED#180 |
| NUTRI-0291 | MERGED#201 |
| PROG-01-mesocycle-jours-repos | MERGED#131 |
| PROG-01-reprise-publiee | MERGED#133 |
| PROG-01-verification | MERGED#132 |
| PROG-03 | MERGED#145 |
| PROG-04 | MERGED#152 |
| PROG-05 | MERGED#151 |
| PROGRES | MERGED#179 |
| PROGRES-0291 | MERGED#197 |
| REL-0.25.0 | MERGED#140 |
| REL-0.26.0 | MERGED#147 |
| REL-0.27.0 | MERGED#154 |
| REL-0.28.0 | MERGED#175 |
| REL-0.28.1 | MERGED#184 |
| REL-0.29.0 | MERGED#193 |
| REL-0.29.1 | MERGED#202 |
| REPAS-029 | MERGED#188 |
| REPRISE-0290 | MERGED#194 |
| REPRISE-0291 | MERGED#203 |
| RESET-01-repartir-de-zero | MERGED#117 |
| SAUV-RUST | MERGED#173 |
| SEANCE-0291 | MERGED#199 |
| SEANCE-0292 | MERGED#206 |
| SESS-01 | MERGED#177 |
| STR-01 | MERGED#146 |
| SUIVIS-029 | MERGED#189 |
| SYNC-01 | MERGED#138 |
| SYNC-0281 | MERGED#183 |
| SYNC-0291 | MERGED#200 |
| TECH-01 | MERGED#192 |
| TECH-0291 | MERGED#195 |
| TESTS-FIGES | MERGED#172 |
| cloture-i0 | MERGED#51 |
| correctifs-0-1-4 | MERGED#49 |
| correctifs-0-2-3 | MERGED#56 |
| correctifs-0-2-4 | MERGED#57 |
| correctifs-0.7.1 | MERGED#84 |
| decisions-i2 | MERGED#58 |
| dep-01-garde-wal-decote-position | MERGED#92 |
| doc-reprise-0-2-4 | MERGED#59 |
| fix-092-onglets-catalogue | MERGED#89 |
| gate-i0-go | MERGED#52 |
| i1-01 | MERGED#53 |
| i1-02-livraison | MERGED#54 |
| i1-03-livraison | MERGED#55 |
| i2-01-affichage | MERGED#61 |
| i2-01-moteur | MERGED#60 |
| i2-02-contraintes | MERGED#64 |
| i3-02-mesocycle | MERGED#75 |
| i4-02-catalogue-journal | MERGED#79 |
| i4-03-nutrition-ecrans | MERGED#81 |
| i4-05-open-food-facts | MERGED#85 |
| i4-06-favoris-menage | MERGED#86 |
| i4-07-recettes-journee-complete | MERGED#87 |
| i4-08-correctifs-moteur | MERGED#88 |
| i5-01-recuperation-raccourcis | MERGED#93 |
| i5-02-recuperation-ecrans | MERGED#94 |
| i5-03-import-auto-reglages | MERGED#95 |
| ios-demarrage | MERGED#40 |
| ios-identite | MERGED#43 |
| maquettes-i0 | MERGED#41 |
| moteur-correctifs-apres-i2-02 | MERGED#66 |
| purge-i18n | MERGED#74 |
| raccourcis-sante | MERGED#65 |
| relecture-codex-2026-11-09 | MERGED#90 |
| relecture-codex-2026-11-12 | MERGED#107 |
| reprise-matin | MERGED#83 |
| reprise-nuit | MERGED#78 |
| rev-01-relecture-codex | MERGED#91 |
| spa-005 | MERGED#37 |
| spa-006 | MERGED#45 |
| spa-007 | MERGED#50 |
| spa-009 | MERGED#38 |
| version-0.3.2 | MERGED#67 |
| version-0.3.3 | MERGED#69 |
| version-0.3.4 | MERGED#71 |
| version-0.4.0 | MERGED#73 |
| version-0.5.0 | MERGED#76 |
| version-0.6.0 | MERGED#80 |
| version-0.7.0 | MERGED#82 |
| windows-io-muet | MERGED#62 |
