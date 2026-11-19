/* eslint-disable -- Registre de lectures sémantiques, pas un scanner. */
import fs from 'node:fs';
const base = 'docs/audit-0.26.0/';
const lectures = JSON.parse(fs.readFileSync(base + 'preuves/lectures.json', 'utf8'));
const groups = [
  [['src/App.tsx', 'src/main.tsx', 'src/features/app/bootstrap.ts'], 'Composition, ordre des attentes, publication des erreurs et nettoyage lus ; réintégration/garde à approfondir en parties 2/3.'],
  [['src/features/app/container.ts', 'src/features/app/AppContainerContext.tsx', 'src/features/app/appStore.ts'], 'Injection, instance par conteneur, état transverse et diagnostics lus ; héritages identifiés.'],
  [['src/platform/index.ts', 'src/platform/runtime.ts', 'src/platform/database.ts', 'src/platform/tauri/sqlDriver.ts'], 'Façades, sélection runtime/OS, garde de démarrage et contrat du driver lus ; comportement natif réservé partie 8.'],
  [['src/db/driver.ts', 'src/db/repositories/index.ts', 'src/db/repositories/dataAccess.ts', 'src/db/repositories/storage.ts'], 'Contrats, fabrique liée à la transaction et association catalogue/repositories lus ; atomicité effective à vérifier partie 2.'],
  [['src/platform/backup/tauriBackup.ts'], 'Port, normalisation des erreurs et ordre check/prepare/close/restore lus ; garanties Rust réservées parties 2/8.'],
  [['src/features/app/startup.ts', 'src/features/app/startupSteps.ts', 'src/features/app/StartupWatchdog.tsx', 'src/features/app/DbFailureDetails.tsx', 'src/features/app/timeZoneWatcher.ts'], 'Démarrage différé, arrêt, suivi des étapes, diagnostics et erreurs absorbées lus ; relais partie-01.'],
  [['src/features/app/lazyScreens.tsx', 'src/features/app/idle.ts', 'src/features/app/SectionNotice.tsx'], 'Frontières Suspense/erreur, réessai, préchargement et composition des sections lus ; parcours complets réservés partie 7.'],
  [['eslint.config.js', 'vite.config.ts'], 'Gardes statiques, sideEffects, entrées et graphe du démarrage lus ; A-007 reproduit par sondes ESLint.'],
  [['public/theme-init.js', 'index.html', 'pairing.html', 'src/features/sync/pairing-window/main.tsx'], 'Entrées et initialisation du thème lues ; fenêtre pairing distincte sans StrictMode ; thème système à vérifier partie 7c.'],
  [['src/domain/goalRules.ts', 'src/domain/week.ts', 'src/domain/todayList.ts'], 'Lecture complète du cycle statique hérité : appels croisés dans des fonctions, pas pendant leur initialisation ; aucun plantage démontré.'],
  [['src/domain/training/confidence.ts', 'src/domain/recovery/sleepNeed.ts'], 'Lecture complète pour qualification du candidat window : variable locale ; revue des formules réservée parties 4/6.'],
  [['src/domain/eventTestKit.ts', 'src/domain/routineTestKit.ts'], 'Compteurs mutables propres aux fabriques de fixtures ; pas assimilés à un moteur métier avec état.'],
];
for (const [files, preuve] of groups) for (const fichier of files) {
  const row = { fichier, partie: 1, preuve };
  const at = lectures.findIndex(r => r.fichier === fichier);
  if (at < 0) lectures.push(row); else lectures[at] = row;
}
const inventory = JSON.parse(fs.readFileSync(base + 'preuves/inventaire.json', 'utf8'));
for (const row of lectures) if (!inventory.some(r => r.fichier === row.fichier)) throw new Error(row.fichier);
fs.writeFileSync(base + 'preuves/lectures.json', JSON.stringify(lectures, null, 2) + '\n');
console.log(JSON.stringify({ lectures: lectures.length }));
