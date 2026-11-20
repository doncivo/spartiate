/**
 * Libellés d'annulation de l'import de tâches (seules clés encore lues : `undo.ts`, `importCsv.undoLabel`). Le reste du catalogue hérité
 * (écran d'import CSV, sans écran depuis SPA-001b) est retiré du bundle de départ (FIX-COQUILLE, C-132).
 */
export const importCsvFr = {
  undoLabel: '{count} tâches importées',
  undoLabelOne: '1 tâche importée',
};
