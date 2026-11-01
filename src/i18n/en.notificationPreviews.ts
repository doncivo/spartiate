import type { notificationPreviewsFr } from './fr.notificationPreviews';

export const notificationPreviewsEn: { readonly [K in keyof typeof notificationPreviewsFr]: string } = {
  task: 'Spartiate reminder: unlock to see the task',
  routine: 'Spartiate reminder: unlock to see the routine',
  event: 'Spartiate reminder: unlock to see the event',
  previewsHelp: 'On the lock screen, iOS hides the content of reminders until the iPhone is unlocked. To see the reminder title: iOS Settings › Notifications › Spartiate › Show Previews › Always.',
};
