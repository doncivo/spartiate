import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { measureStart, readBuildFiles, startChunks as startChunksOf, type BuildFiles, type Manifest, type ManifestChunk } from './bundleMeasure';
import { compareStartModules, describeComparison, initialList, normalizeSource, START_MODULES_FILE, updatedList, validateList, type StartModulesList } from './startModules';

/**
 * Taille du bundle de départ (PRD 8, démarrage rapide) : `npm run build` vers un dossier temporaire avec le manifeste de Vite, puis somme
 * gzip du JavaScript chargé AVANT toute interaction, c'est-à-dire le bloc d'entrée de `index.html` et tous ses imports STATIQUES,
 * récursivement. Les blocs sont repérés par le graphe du manifeste, jamais par leur nom (Rollup nomme automatiquement les blocs partagés,
 * par exemple « tokens », et ces noms peuvent changer). Les imports dynamiques (Recharts du rapport, tesseract.js, etc.) et les
 * ressources copiées telles quelles (/ocr/) n'en font pas partie. Seuil : 350 Ko gzip.
 *
 * BUNDLE-01 : la mesure jugée est la mesure NORMALISÉE (`bundleMeasure.ts`) : les noms hachés des blocs, qui changent à chaque retouche CSS
 * et faisaient bouger le gzip de quelques dizaines d'octets sans aucune ligne de code changée, sont remplacés dans le contenu mesuré par un
 * pseudo-hachage déterministe de même longueur et de même alphabet. L'écart avec la mesure brute est borné (critère 4), le plafond ne bouge
 * pas, le build livré n'est pas touché. Relevé entre deux commits : `node tests/bundle/measureStart.ts <dossier de sortie>`.
 *
 * Hors de `npm run test` : lancé par `npm run test:bundle` (configuration vitest.bundle.config.ts).
 */
const LIMIT_BYTES = 350 * 1024;
/**
 * BUNDLE-01 critère 4, borne asymétrique (décision d'Ali du 2026-10-28, UI-REFONTE-09) : les deux erreurs ne coûtent pas la même chose.
 * Une mesure normalisée plus PETITE que le build réel ferait croire qu'on est sous le plafond alors qu'on l'a dépassé : un dépassement
 * silencieux, exactement ce que la garde doit éliminer ; borne serrée (100 octets, inchangée depuis le 2026-10-18).
 */
const NORMALIZATION_UNDERSHOOT_BYTES = 100;
/**
 * Une mesure normalisée plus GRANDE que le build réel ne fait qu'inquiéter à tort ; borne large (300 octets), qui reste une borne de bon sens
 * contre un modèle des hachages périmé. Mesuré le 2026-10-28 avec 85 blocs à la demande dans le départ : +143 octets (normalisé 337 914,
 * brut 337 771) ; le bruit de compression des pseudo-hachages croît avec le nombre de blocs. Dette inscrite au backlog : modèle de
 * normalisation sans bruit, quand le plafond redeviendra serré.
 */
const NORMALIZATION_OVERSHOOT_BYTES = 300;

describe('bundle de départ (index.html)', () => {
  let outDir = '';
  let manifest: Manifest = {};
  let files: BuildFiles = new Map();

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), 'ct-bundle-'));
    // NODE_ENV forcé : sinon le build hérite de NODE_ENV=test posé par Vitest et embarque React en mode développement, ce qui mesure
    // un bundle sans rapport avec l'app livrée.
    // VITE_CT_E2E_HOOKS vidé : le build livré n'a jamais les accroches de test des mesures @perf (playwright.config.ts le pose pour dist-perf seulement).
    const env = { ...process.env, NODE_ENV: 'production', TAURI_ENV_DEBUG: '', VITE_CT_E2E_HOOKS: '' };
    const build = spawnSync('npm', ['run', 'build', '--', '--outDir', outDir, '--emptyOutDir', '--manifest'], { encoding: 'utf8', shell: true, env });
    if (build.status !== 0) throw new Error(`npm run build a échoué (code ${String(build.status)}) :\n${build.stdout}\n${build.stderr}`);
    manifest = JSON.parse(readFileSync(join(outDir, '.vite', 'manifest.json'), 'utf8')) as Manifest;
    files = readBuildFiles(outDir);
  });

  afterAll(() => {
    if (outDir) rmSync(outDir, { recursive: true, force: true });
  });

  /** Blocs statiques atteints depuis l'entrée de `index.html`, entrée comprise. */
  function startChunks(): ManifestChunk[] {
    return startChunksOf(manifest);
  }

  it('le JavaScript de départ pèse moins de 350 Ko en gzip (mesure normalisée), bloc par bloc affiché', () => {
    const chunks = startChunks()
      .map((chunk) => chunk.file)
      .filter((file) => file.endsWith('.js'));
    const normalized = measureStart(files, chunks, { normalizeHashes: true });
    const raw = measureStart(files, chunks);
    const detail = [...normalized.chunks]
      .sort((a, b) => b.gzip - a.gzip)
      .map((item) => `  ${(item.gzip / 1024).toFixed(1).padStart(7)} Ko  ${item.file}`)
      .join('\n');
    // eslint-disable-next-line no-console -- détail relevé à la main : taille gzip de chaque bloc du bundle de départ, octets exacts des deux mesures
    console.info(
      `[bundle] ${String(normalized.chunks.length)} blocs de départ, total ${(normalized.total / 1024).toFixed(1)} Ko gzip (seuil ${String(LIMIT_BYTES / 1024)} Ko) ; normalisé ${String(normalized.total)} octets, brut ${String(raw.total)} octets, marge ${String(LIMIT_BYTES - normalized.total)}\n${detail}`,
    );
    expect(normalized.chunks.length).toBeGreaterThan(0);
    expect(normalized.total).toBeLessThan(LIMIT_BYTES);
    // Critère 4 : la normalisation ne relève pas le plafond de fait (borne serrée dans le sens qui ment) et le modèle des hachages n'est pas périmé.
    const label = `normalisé ${String(normalized.total)}, brut ${String(raw.total)}`;
    expect(raw.total - normalized.total, `${label} : la mesure jugée est plus petite que le build réel (dépassement silencieux possible)`).toBeLessThanOrEqual(NORMALIZATION_UNDERSHOOT_BYTES);
    expect(normalized.total - raw.total, `${label} : écart de normalisation anormal`).toBeLessThanOrEqual(NORMALIZATION_OVERSHOOT_BYTES);
  });

  // BUNDLE-01 (critères 19 à 25) : garde par liste blanche des modules du départ, mécanisme principal ; le plafond reste le dernier juge. Les
  // cartes de source des blocs de départ (`sourcemap` actif sans TAURI_ENV_PLATFORM) donnent l'ensemble exact des modules ; il est comparé à
  // tests/bundle/start-modules.json, dans les deux sens. `UPDATE_START_MODULES=1` réécrit la liste (jamais en CI) ; un module entré y arrive
  // dans `ajouts` avec une story et une raison vides, donc le test reste rouge jusqu'à leur saisie.
  it('aucun module nouveau dans le départ : liste blanche tests/bundle/start-modules.json exacte dans les deux sens', () => {
    const root = join(import.meta.dirname, '..', '..');
    const actual = new Set<string>();
    let maps = 0;
    for (const chunk of startChunks()) {
      if (!chunk.file.endsWith('.js')) continue;
      const mapPath = join(outDir, `${chunk.file}.map`);
      // Le bloc d'aide de Rolldown (`rolldown-runtime`) est émis sans carte : aucun module source.
      if (!existsSync(mapPath)) continue;
      maps += 1;
      const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { readonly sources: readonly string[] };
      for (const source of map.sources) actual.add(normalizeSource(mapPath, source, root));
    }
    expect(maps).toBeGreaterThan(0);
    expect(actual.size).toBeGreaterThan(100);
    const listPath = join(root, START_MODULES_FILE);
    const readList = (): StartModulesList => JSON.parse(readFileSync(listPath, 'utf8')) as StartModulesList;
    if (process.env['UPDATE_START_MODULES'] === '1') {
      if (process.env['CI']) throw new Error(`UPDATE_START_MODULES=1 est refusée en CI : ${START_MODULES_FILE} se met à jour en local, dans un commit qui justifie chaque ajout.`);
      writeFileSync(listPath, `${JSON.stringify(existsSync(listPath) ? updatedList(readList(), actual) : initialList(actual), null, 2)}\n`);
    }
    const list = readList();
    const problems = validateList(list, (file) => existsSync(join(root, file)));
    expect(problems, problems.join('\n')).toEqual([]);
    const sizeOf = (file: string): number | null => (existsSync(join(root, file)) ? statSync(join(root, file)).size : null);
    const messages = describeComparison(compareStartModules(actual, list), sizeOf);
    expect(messages, messages.join('\n')).toEqual([]);
    // Critère 23 : aucun des modules sortis par les paliers 1 et 2 (ni leurs feuilles) n'est dans le départ ni dans la liste.
    for (const gone of ['src/i18n/notificationPreviewsText.ts', 'src/i18n/fr.notificationPreviews.ts', 'src/i18n/en.notificationPreviews.ts', 'src/domain/notificationBody.ts', 'src/i18n/notificationBodyText.ts', 'src/i18n/fr.notificationBody.ts', 'src/i18n/en.notificationBody.ts', 'src/features/reminders/replanNotifications.ts', 'src/domain/notificationPlan.ts', 'src/features/reminders/notificationTexts.ts', 'src/features/reminders/recapText.ts', 'src/domain/recap.ts', 'src/domain/notificationActions.ts', 'src/sync/publishRotation.ts', 'src/domain/sync/publishRotation.ts', 'src/sync/ownDeletion.ts', 'src/domain/sync/ownDeletion.ts', 'src/i18n/fr.syncOwnDeletion.ts', 'src/i18n/en.syncOwnDeletion.ts', 'src/features/sync/SyncDetailsOwnDeletionHost.tsx', 'src/features/tasks/TaskDetail.tsx', 'src/features/tasks/TaskDetail.css', 'src/features/settings/OnboardingHost.tsx', 'src/features/settings/OnboardingHost.css', 'src/features/search/SearchOverlay.tsx', 'src/features/focus/FocusHost.tsx', 'src/features/shortcuts/ShortcutsHelp.tsx', 'src/features/shortcuts/ShortcutsHelp.css', 'src/features/updater/UpdateBanner.tsx', 'src/features/updater/UpdateBanner.css', 'src/features/events/HolidayDetailHost.tsx', 'src/features/events/HolidayDetail.css', 'src/features/settings/recoveryImport/index.ts', 'src/features/settings/recoveryImport/service.ts', 'src/features/settings/RecoveryImportSection.tsx', 'src/domain/recovery/shortcutFiles.ts', 'src/domain/recovery/daySummary.ts', 'src/domain/recovery/bedtimeProposal.ts', 'src/features/recovery/RecoveryToday.tsx', 'src/features/recovery/display.ts', 'src/i18n/fr.recovery.ts', 'src/i18n/recoveryText.ts', 'src/features/training/session/RecoverySession.tsx', 'src/features/training/session/redDayState.ts', 'src/i18n/fr.trainingRecovery.ts', 'src/i18n/fr.recoveryNotifications.ts', 'src/features/settings/RecoveryNotificationsSection.tsx', 'src/features/notifications/recoveryNotifications.ts']) {
      expect(actual.has(gone), gone).toBe(false);
      expect(list.groupes.some((group) => group.fichiers?.includes(gone)) || list.ajouts.some((addition) => addition.fichier === gone), gone).toBe(false);
    }
  });

  // PERF-02 (ADR 0001, avenant) : chrono-node, le catalogue anglais et les écrans à la demande ne reviennent pas dans le départ par un
  // import statique oublié, un barrel ou un effet de bord ajouté (retrait de « sideEffects » dans package.json compris).
  // BUNDLE-01 : fiche de tâche (palier 1) et les six hôtes de la coquille (palier 2), blocs à la demande importés dynamiquement par lazyScreens.tsx.
  it.each(['src/features/shortcuts/ShortcutsHelp.tsx', 'src/features/updater/UpdateBanner.tsx', 'src/features/settings/SettingsScreen.tsx', 'src/features/sync/RestoreChoiceDialog.tsx', 'src/db/repositories/sql/epochCarryReports.ts', 'src/features/sync/SyncDetailsCarryReport.tsx', 'src/features/sync/carryReportBannerLine.ts', 'src/sync/epochCarryReportBanner.ts', 'src/sync/epochCarryReportAck.ts', 'src/sync/orphanEpoch.ts', 'src/sync/publishRotation.ts', 'src/features/sync/SyncDetailsOwnDeletion.tsx', 'src/db/repositories/sql/occurrenceDedup.ts'])('%s est un bloc à la demande, hors du départ', (source) => {
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  // Y-FIX-04 : les textes de la fenêtre de choix après restauration ne sont dans aucun bloc de départ (catalogue à part, chargé avec elle).
  it('les textes de la fenêtre de choix après restauration sont hors du départ', () => {
    const marker = 'Restauration : que faire de la synchronisation ?';
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // Y-TECH-05 : constitution du compte rendu du report d'époque (règles, écriture, dépôt) : jamais dans un bloc de départ.
  it('le compte rendu du report d’époque est hors du départ', () => {
    const markers = ['epoch-carry-report-failed', 'UPDATE epoch_carry_report SET acknowledged_at'];
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) for (const marker of markers) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), `${chunk.file} : ${marker}`).toBe(false);
    for (const marker of markers) expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker)), marker).toBe(true);
  });

  // Y-TECH-05 (phase 2) : écran de détail du compte rendu, ligne de Détails, composant du bandeau et catalogue `syncCarryReport` : blocs à la
  // demande (règle d'Ali du 2026-10-18), aucun octet dans un bloc de départ. Le départ ne porte que le code d'avertissement et la lecture de
  // l'état du bandeau (`carryLines`).
  it('l’écran du compte rendu, son bandeau et leurs textes sont hors du départ', () => {
    // `CarryReportSheet.tsx` et `fr.syncCarryReport.ts` sont importés statiquement par des blocs à la demande : ils n'ont pas d'entrée propre dans le
    // manifeste, ils sont donc suivis par leurs marqueurs (classes du composant ; textes du catalogue, y compris ceux ajoutés par la revue).
    const markers = ['Rétablis alors que tu les avais supprimés', 'Aucune écriture à reporter', 'Afficher 50 de plus', 'ct-carry__item', 'ct-carry__summary', 'ct-carry__overflow', 'Autres éléments : ', 'stockage plein ou illisible', 'éléments rétablis : '];
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) for (const marker of markers) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), `${chunk.file} : ${marker}`).toBe(false);
    for (const marker of markers) expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker)), marker).toBe(true);
  });

  it.each(["Les fichiers de l'ancienne époque de cet appareil", 'ct-sync__ownDeletion'])('Y-IOS-02-FIX-01 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I1-01 (critère 6) : écrans de l'entraînement (bibliothèque, matériel, routines), leurs textes et le contenu embarqué (150 exercices,
  // programmes, profils) : blocs à la demande, aucun octet dans le départ.
  it('l’écran Entraînement est un bloc à la demande, hors du départ', () => {
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest['src/features/training/TrainingScreen.tsx'];
    if (!chunk) throw new Error('bloc src/features/training/TrainingScreen.tsx absent du manifeste');
    expect(start.has(chunk.file)).toBe(false);
  });

  it.each(['Ajouter un programme de départ', 'Compatibles avec mon matériel', 'Développé couché à la barre', 'fitness-park-antony', 'Full Body 3 j'])('I1-01 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I1-02 : séance active, minuteur de repos et carte « Séance » d'Aujourd'hui (bloc à la demande) : aucun octet dans le départ.
  it('I1-02 : la carte « Séance » d’Aujourd’hui est un bloc à la demande, hors du départ', () => {
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest['src/features/training/session/TodaySessionCard.tsx'];
    if (!chunk) throw new Error('bloc src/features/training/session/TodaySessionCard.tsx absent du manifeste');
    expect(start.has(chunk.file)).toBe(false);
  });

  it.each(['Reprendre la séance', 'Valider la série', 'Repos par défaut', 'Passe à la série suivante.'])('I1-02 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I1-03 : journal des séances et résumé de fin, blocs à la demande importés dynamiquement ; leurs textes ne sont dans aucun bloc de départ.
  it.each(['src/features/training/history/HistoryView.tsx', 'src/features/training/session/WorkoutSummary.tsx'])('I1-03 : %s est un bloc à la demande, hors du départ', (source) => {
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  it.each(['Mettre à jour la routine ?', 'Cette fois seulement', 'Séances terminées', 'Enregistrer la correction', 'Terminer la séance'])('I1-03 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I2-01 (PR 2/2, critère 15) : prescription et ressenti dans la séance active (composant, catalogue fr.progression, moteur, repository) :
  // bloc à la demande importé dynamiquement par la séance ; aucun de leurs textes dans un bloc de départ.
  it('I2-01 : src/features/training/session/ExerciseProgression.tsx est un bloc à la demande, hors du départ', () => {
    const source = 'src/features/training/session/ExerciseProgression.tsx';
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  it.each(['atteint la dernière fois', 'Proposition refusée : tu saisis toi-même.', 'Ressenti de l’exercice', 'hard-blocks-increase'])('I2-01 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I3-01 : séance proposée (composant, catalogue fr.trainingGeneration, générateur) : bloc à la demande importé par « Nouvelle séance ».
  it('I3-01 : src/features/training/session/GeneratedSession.tsx est un bloc à la demande, hors du départ', () => {
    const source = 'src/features/training/session/GeneratedSession.tsx';
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  it.each(['Commencer cette séance', 'retiré pour tenir le temps', 'off-split-in-routine'])('I3-01 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I4-02 : catalogue Ciqual (content/food/ciqual.json, 537 Ko) et son chargeur : jamais dans le départ, import dynamique seulement.
  it.each(['10.57745/RDMHWY', 'Licence Ouverte Etalab 2.0', 'catalogue Ciqual illisible'])('I4-02 : « %s » (catalogue Ciqual et chargeur) hors du départ', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
  });

  it('I4-02 : aucun module de content/food ni le chargeur Ciqual dans le graphe du départ', () => {
    const startFiles = new Set(startChunks().map((chunk) => chunk.file));
    for (const [source, chunk] of Object.entries(manifest)) {
      if (startFiles.has(chunk.file)) expect(/content\/food\/|ciqualCatalogue/.test(source), source).toBe(false);
    }
  });

  // I3-02 : section Cycle (composant, catalogue fr.trainingCycle, règles du mésocycle, repository) : bloc à la demande importé par l'onglet.
  it('I3-02 : src/features/training/cycle/CycleView.tsx est un bloc à la demande, hors du départ', () => {
    const source = 'src/features/training/cycle/CycleView.tsx';
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  it.each(['Mettre le programme en pause', 'Anticiper le deload', 'Semaine de deload du cycle', 'cycleSetsMinus'])('I3-02 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I5-01 point 1.7 : section « Raccourcis » (écran Apple Santé, catalogue fr.health) et import à l'ouverture : hors du départ, présents dans le build.
  it.each(['Récupération depuis Raccourcis', 'Fichier absent : rien n’a été lu pour ce type.', 'date sans fuseau horaire', 'recovery-import-file-absent'])('I5-01 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I6-01 : carte « valeurs inhabituelles », journal de facteurs et Progrès › Récupération (catalogue fr.recoveryFactors) : hors du départ, présents dans le build.
  it.each(['Valeurs inhabituelles : repos conseillé', 'Rien de particulier', 'Association observée, pas une cause'])('I6-01 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I6-02 : Progrès › Corps (catalogue fr.bodyProgress) et sélecteur de photo : hors du départ, présents dans le build.
  it.each(['Photos de progression', 'Les photos restent sur cet appareil', 'Mensurations'])('I6-02 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I3-07 : onboarding en 8 écrans (hôte, écrans, catalogue fr.onboarding, domaine, dépense de départ) : blocs à la demande importés par
  // lazyScreens.tsx ; l'assistant hérité et son catalogue ont quitté le départ.
  it.each(['src/features/onboarding/OnboardingHost.tsx', 'src/features/onboarding/OnboardingFlow.tsx'])('I3-07 : %s est un bloc à la demande, hors du départ', (source) => {
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  it.each(['Configuration · étape', 'Rétablir l’estimation', 'Choisis au moins autant de jours que de séances par semaine.', 'recalculé après 2 semaines de données'])('I3-07 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  it('I3-07 : aucun module du domaine de l’onboarding ni de l’assistant hérité dans le graphe du départ', () => {
    const startFiles = new Set(startChunks().map((chunk) => chunk.file));
    for (const [source, chunk] of Object.entries(manifest)) {
      if (startFiles.has(chunk.file)) expect(/src\/(domain|features)\/onboarding|src\/i18n\/(fr\.onboarding|onboardingText)/.test(source), source).toBe(false);
    }
  });

  // I4-03 : onglet Nutrition (écrans, catalogue fr.nutrition, domaine) et carte « nutrition restante » d'Aujourd'hui : blocs à la demande.
  it.each(['src/features/nutrition/NutritionScreen.tsx', 'src/features/nutrition/NutritionRemainingCard.tsx'])('I4-03 : %s est un bloc à la demande, hors du départ', (source) => {
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  it.each(['Rien de saisi aujourd’hui', 'Check-in suspendu', 'Aucune cible définie', 'Balance 7 jours', 'Chercher en ligne', 'Place le code-barres dans le cadre.', 'Aucune recette. Crée la première.', 'Les repas déjà enregistrés dans le journal ne changent pas.'])('I4-03 / I4-05 / I4-07 : « %s » hors du départ et présent dans le build', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // I4-05 : écran de scan et client Open Food Facts (front) : blocs à la demande, hors du départ, importés dynamiquement.
  it.each(['src/features/nutrition/scan/BarcodeScanView.tsx', 'src/platform/off/index.ts', 'src/features/nutrition/recipes/RecipesView.tsx', 'src/features/nutrition/recipes/RecipeHits.tsx', 'src/features/nutrition/recipes/RecipeQuantityStep.tsx'])('I4-05 / I4-07 : %s est un bloc à la demande, hors du départ', (source) => {
    const start = new Set(startChunks().map((chunk) => chunk.file));
    const chunk = manifest[source];
    if (!chunk) throw new Error(`bloc ${source} absent du manifeste`);
    expect(start.has(chunk.file)).toBe(false);
    expect(Object.values(manifest).some((other) => other.dynamicImports?.includes(source))).toBe(true);
  });

  it('I4-03 : aucun module du domaine ni des écrans de nutrition dans le graphe du départ', () => {
    const startFiles = new Set(startChunks().map((chunk) => chunk.file));
    for (const [source, chunk] of Object.entries(manifest)) {
      if (startFiles.has(chunk.file)) expect(/src\/(domain|features)\/nutrition\/|features\/today\/Nutrition|src\/platform\/(off|barcode)\//.test(source), source).toBe(false);
    }
  });

  // Y-FIX-02 (revue I1) : causes nommées de `publish-blocked` (catalogue `syncPublishCause`, chargé avec Détails) : aucun bloc de départ ne les porte.
  it.each(['Première publication interrompue', 'Fichier inconnu dans le dossier'])('le texte de cause « %s » est hors du départ', (marker) => {
    const start = startChunks().filter((chunk) => chunk.file.endsWith('.js'));
    for (const chunk of start) expect(readFileSync(join(outDir, chunk.file), 'utf8').includes(marker), chunk.file).toBe(false);
    expect(Object.values(manifest).some((chunk) => chunk.file.endsWith('.js') && readFileSync(join(outDir, chunk.file), 'utf8').includes(marker))).toBe(true);
  });

  // Y-04 critère 12, revue 7 : le client du simulateur de dossier (`__ctSyncSim`, route `/rpc`, codage `__ctMap`) n'est installé
  // qu'en développement (`import.meta.env.DEV`) ; aucun fichier JavaScript du build n'en contient la moindre trace.
  it('aucune trace du simulateur de synchro dans le JavaScript de production', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : name.endsWith('.js') ? [path] : [];
      });
    const scripts = files(outDir);
    expect(scripts.length).toBeGreaterThan(0);
    for (const marker of ['__ctSyncSim', '/rpc', '__ctMap', '__ctTest', '__ctSigning', '__ctHaptics', '__ctBiometric', '__ctNotifications', '__ctPrivacyShield']) {
      expect(scripts.filter((file) => readFileSync(file, 'utf8').includes(marker)), marker).toEqual([]);
    }
  });

  it('le drapeau VITE_CT_E2E_HOOKS n’existe que dans la configuration Playwright et vite.config.ts : jamais dans un workflow ni un script de livraison', () => {
    const root = join(import.meta.dirname, '..', '..');
    const workflows = join(root, '.github', 'workflows');
    for (const name of readdirSync(workflows)) expect(readFileSync(join(workflows, name), 'utf8'), name).not.toContain('VITE_CT_E2E_HOOKS');
    const pkg = readFileSync(join(root, 'package.json'), 'utf8');
    expect(pkg).not.toContain('VITE_CT_E2E_HOOKS');
    expect(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8')).not.toContain('VITE_CT_E2E_HOOKS');
    expect(readFileSync(join(root, 'playwright.config.ts'), 'utf8')).toContain("VITE_CT_E2E_HOOKS: '1'");
  });
});
