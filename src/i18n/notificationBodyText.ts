import { notificationBodyFr } from './fr.notificationBody';

export function tNotificationBody(key: keyof typeof notificationBodyFr, args: Readonly<Record<string, string>>): string {
  return notificationBodyFr[key].replace(/\{(\w+)\}/g, (_, name: string) => args[name] ?? '');
}
