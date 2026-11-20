Audit indépendant en lecture seule de **v0.26.0**, SHA `8686a8fc2860f7a94eb193426cbcc640a33bac80`.
Windows et iOS publiés ; branche figée au tag, aucune fusion depuis main.
**Partie 0 terminée ; audit global incomplet. Parties 1 à 12 à poursuivre.**
Typecheck, lint, contenu, gardes initiales, bundle, fmt et Clippy réussis.
Local : 9 143 / 9 167 tests unitaires verts, 24 échecs et 12 rejets non interceptés ; aucun nouvel essai.
Rust : 846 tests desktop verts ; SQL 30 tests + 1 doctest verts après préparation du dossier temporaire.
CI du SHA : 25 jobs Tests verts ; bundle 195 861 octets, plafond 358 400 octets.
Audits : npm production 0 alerte, développement 11 ; RSA absent du graphe compilé, 8 avertissements Rust à examiner.
Constats A-001 à A-006 : gravités, emplacements, preuves et corrections dans `docs/audit-0.26.0/rapport.md`.
Couverture de lecture : **14 / 1 658 fichiers (0,84 %)** ; inventaire exhaustif, 81 fichiers vendored exclus.
Écritures limitées à `docs/audit-0.26.0/` ; aucune donnée réelle ni modification de l'application.
Reprise exacte : `docs/audit-0.26.0/avancement.md`. **PR en brouillon, ne jamais fusionner.**
