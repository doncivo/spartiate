import { notificationPreviewsFr } from './fr.notificationPreviews';

export function tNotificationPreviews(key: keyof typeof notificationPreviewsFr): string {
  return notificationPreviewsFr[key];
}
