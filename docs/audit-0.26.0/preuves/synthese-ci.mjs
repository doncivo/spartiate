/* eslint-disable -- Outillage isolé de l'audit, jamais importé par l'application. */
import fs from 'node:fs';
const base = 'C:/Dev/spartiate-codex/docs/audit-0.26.0/';
const read = file => { const b = fs.readFileSync(base + file); return b.toString(b[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''); };
const lines = read('preuves/resultats/ci-tests-log.log').replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
const summary = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/\b(?:Test Files|Tests)\s+\d+ passed|\b(?:Statements|Branches|Functions|Lines)\s+:|Z\s+\d+ (?:passed|skipped)|\b(?:flaky|fixme)\b/.test(line) && !line.includes('##[notice]')) summary.push({ ligneJournal: i + 1, texte: line });
}
fs.writeFileSync(base + 'preuves/ci-resume-tests.json', JSON.stringify(summary, null, 2));
const jobs = JSON.parse(read('preuves/ci-jobs.json'));
const report = [
  '# Partie 0 — vérifications automatiques (en cours)', '',
  'SHA : `8686a8fc2860f7a94eb193426cbcc640a33bac80`. Les commandes locales et leurs codes figurent dans `preuves/resultats/`. Aucun résultat CI ne vaut preuve sur un appareil réel.', '',
  '## CI de la version figée', '',
  'Tests est déclenché sur main au SHA du tag, pas par le tag. Les deux builds de publication utilisent les tags ; le prébuild iOS est un workflow_dispatch au même SHA. Le publish ignoré du prébuild est attendu, ce n’est pas un test désactivé.', '',
  '| Run | Workflow | Job | Conclusion | Durée (s) |', '| --- | --- | --- | --- | --- |',
  ...jobs.map(j => `| ${j.run} | ${j.workflow} | ${j.job} | ${j.conclusion} | ${j.secondes} |`), '',
  '## Comptes et limites', '',
  'CI fusionnée : 829 fichiers / 9 167 tests Vitest verts. Couverture globale : lignes 94,16 %, instructions 92,06 %, branches 86,44 %, fonctions 91,27 %. Ces taux ne décrivent pas chaque module ; le détail par module reste à établir en partie 11.',
  'Les tests e2e, visual, smoke et perf ne sont pas exécutés localement. Les résultats et compteurs extraits, dont les tests ignorés, sont dans `preuves/ci-resume-tests.json`. Les appels skip conditionnels sont inventoriés dans `preuves/tests-ignores-candidats.json` ; leur pertinence sera relue en partie 11.', '',
  '## Analyses statiques', '',
  'Atteignabilité depuis les racines : 31 fichiers src candidats non atteints. Analyse par symboles : 48 fichiers src candidats morts, 1 172 exports candidats inutilisés répartis dans 353 fichiers. Ces deux outils ne constituent pas une preuve de suppression sûre (racines natives, chargements dynamiques et tests à vérifier).',
  'Le scanner i18n historique signale 644 clés candidates sur 1 714 clés du catalogue fr.ts ; il ne couvre pas seul tous les catalogues à la demande. Le typage vérifie les clés statiquement typées ; les accès dynamiques restent à lire.',
  'Scanner complémentaire : 47 candidats couleur, 7 candidats texte JSX, 149 occurrences de marqueurs ou délais de tests, aucun doublon de fichier exact (> 100 caractères), aucune requête SQL candidate hors src/db, aucun import de couche interdit détecté par le motif domain. Les trois occurrences Date.now incluent deux commentaires et la fabrique d’horloge injectable : aucun défaut prouvé par ce scan.', '',
  '## Dépendances', '',
  'npm audit --omit=dev : 0 alerte. Audit complet : 11 paquets signalés, dont 2 élevés (undici, zod), exclusivement dans le graphe de développement ; les autres alertes proviennent notamment de minimatch via ESLint. Exposition exploitable dans cette application non démontrée.',
  'Les versions des manifestes peuvent être des plages, alors que package-lock.json et Cargo.lock figent les résolutions ; ces deux notions sont distinguées dans l’inventaire. Les identifiants de licences npm sont inventoriés, sans conclusion juridique automatique.', '',
  '## À terminer', '',
  'Suite unitaire locale avec couverture, bundle local, contrôles Cargo, audit Cargo, rapprochement des licences et consolidation des constats. Partie non terminée tant que ces résultats ne sont pas examinés.',
];
fs.writeFileSync(base + 'partie-00.md', report.join('\n') + '\n');
