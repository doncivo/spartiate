import type { Messages } from './types';

/** App update (I-06): English texts, same keys as fr.appUpdate.ts. */
export const appUpdateEn: Messages['app']['update'] = {
  schemaNewer: 'This version of Spartiate is older than your data. Install the latest version from SideStore. Your data has not been modified.',
  schemaNewerPc: 'This version of Spartiate is older than your data. Install the latest PC version from the Spartiate releases page (spartiate-releases). Your data has not been modified.',
  migrationIntact: 'Your data is intact. Do not delete Spartiate. Send the details to get a fix.',
  appVersionLine: 'App version: {version}',
  schemaLine: 'Database schema: {database} (latest known to the app: {app})',
  backupLine: 'Pre-update backup: {name}',
};
