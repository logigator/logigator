import type { ConsentText } from './consent-text';

/**
 * The English text. `as const` keeps every message a literal, which is what
 * the apps' typed translation keys read a message's placeholders from.
 */
export const consentEn = {
  title: 'Cookies',
  text: 'Logigator uses a few cookies it needs to work. With your permission, we also collect usage statistics to see what to improve.',
  privacy: 'Privacy policy',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  customize: 'Customize',
  preferencesTitle: 'Cookie settings',
  preferencesText:
    "Choose what Logigator may store in your browser. You can change your choice at any time from the website's footer or the editor's Help menu.",
  save: 'Save choices',
  categories: {
    necessary: {
      title: 'Necessary',
      description:
        'Keep you signed in and remember your settings. Always on, since Logigator cannot work without them.'
    },
    analytics: {
      title: 'Analytics',
      description:
        'Usage statistics collected with PostHog, including recordings of editor sessions, show us what to improve. They are stored in the EU and not linked to your account.'
    }
  }
} as const satisfies ConsentText;
