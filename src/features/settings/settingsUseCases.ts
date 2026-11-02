import type { ThemeChoice } from '../../domain/model';
import { DEFAULT_TIME_FORMAT, TIME_FORMATS, type TimeFormat } from '../../domain/timeFormat';
import { DEFAULT_FIRST_WEEKDAY, FIRST_WEEKDAYS, type FirstWeekday } from '../../domain/week';
import type { AppContainer } from '../app/container';
import { parseThemeChoice } from './theme';

/**
 * Cas d'usage des réglages : seul point d'écriture de la table `settings` pour les stores d'écran. Les stores gardent l'état affiché,
 * l'optimisme et le retour en arrière ; ces cas d'usage ne font que lire et écrire. Contrat : chaque méthode rejette si la base échoue
 * (l'appelant décide du message). `settings` reste entièrement local en I0 (S6, D-55).
 */
export interface SettingsUseCases {
  /** D-02 : miroir local `desktop.launchAtStartup` du choix « Démarrer avec Windows ». */
  setLaunchAtStartupMirror(value: boolean): Promise<void>;
  /** D-02 critère 6 : réaligne le miroir local sur l'état réel de l'entrée système (écrit seulement s'il diffère). */
  syncLaunchAtStartupMirror(actual: boolean): Promise<void>;
  /** P-03 : premier jour de semaine et format d'heure. */
  loadFormats(): Promise<FormatSettings>;
  setFirstWeekday(value: FirstWeekday): Promise<void>;
  setTimeFormat(value: TimeFormat): Promise<void>;
  /** P-02 : thème de cet appareil (`ui.theme`, local). */
  loadTheme(): Promise<ThemeChoice>;
  setTheme(value: ThemeChoice): Promise<void>;
}

/** P-03 : réglages d'affichage de la date et de l'heure. */
export interface FormatSettings {
  readonly firstWeekday: FirstWeekday;
  readonly timeFormat: TimeFormat;
}
export type SettingsDeps = Pick<AppContainer, 'data'>;

export function createSettingsUseCases(deps: SettingsDeps): SettingsUseCases {
  const settings = () => deps.data.repos.settings;
  return {
    async setLaunchAtStartupMirror(value) {
      await settings().set('desktop.launchAtStartup', value);
    },
    async syncLaunchAtStartupMirror(actual) {
      if (actual !== (await settings().get('desktop.launchAtStartup'))) await settings().set('desktop.launchAtStartup', actual);
    },
    async loadFormats() {
      const [firstWeekday, timeFormat] = await Promise.all([settings().get('general.firstWeekday'), settings().get('general.timeFormat')]);
      return {
        firstWeekday: FIRST_WEEKDAYS.includes(firstWeekday) ? firstWeekday : DEFAULT_FIRST_WEEKDAY,
        timeFormat: TIME_FORMATS.includes(timeFormat) ? timeFormat : DEFAULT_TIME_FORMAT,
      };
    },
    async setFirstWeekday(value) {
      await settings().set('general.firstWeekday', value);
    },
    async setTimeFormat(value) {
      await settings().set('general.timeFormat', value);
    },
    async loadTheme() {
      return parseThemeChoice(await settings().get('ui.theme'));
    },
    async setTheme(value) {
      await settings().set('ui.theme', value);
    },
  };
}
