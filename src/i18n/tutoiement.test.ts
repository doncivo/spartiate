import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Finitions 0.1.2 (c) : l'app tutoie (Ali est l'unique utilisateur). Aucun texte de l'interface ne vouvoie ; seuls les textes système
 * imposés par iOS (Info.plist, hors de src) peuvent le faire. Le test lit les littéraux des catalogues et des composants.
 */
const VOUVOIEMENT = /\b(vous|votre|vos|veuillez)\b/i;
// Impératifs de la 2e personne du pluriel (forme vouvoyée) hérités de l'ancien projet.
const IMPERATIFS =
  /\b(Choisissez|Saisissez|Sélectionnez|Appuyez|Ouvrez|Autorisez|Activez|Désactivez|Vérifiez|Réessayez|Patientez|Touchez|Entrez|Indiquez|Renseignez|Connectez|Relancez|Redémarrez|Attendez|Contactez|Consultez|Essayez|Fermez|Installez|Utilisez|Terminez|Ajoutez|Retirez|Supprimez|Rouvrez|Restaurez|Recommencez|Reconnectez|Exportez|Importez|Lancez|Gardez|Conservez|Cliquez|Pensez|Notez|Parlez|Relisez|Créez|Validez|Confirmez|Annulez|Ne supprimez|Ne désinstallez)\b/;
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('tutoiement', () => {
  it('aucun texte de src ne vouvoie', () => {
    const offenders: string[] = [];
    for (const file of files(fileURLToPath(new URL('..', import.meta.url)))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(LITERAL)) {
        const text = match[1] ?? match[2] ?? match[3] ?? '';
        // Sans espace : clé ou identifiant, pas une phrase.
        if (!/\s/.test(text)) continue;
        if (VOUVOIEMENT.test(text) || IMPERATIFS.test(text)) offenders.push(`${file.split('src')[1] ?? file} : ${text.slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
