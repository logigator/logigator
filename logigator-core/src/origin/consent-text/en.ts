import type { ConsentText } from './consent-text';

/**
 * The English text. `as const` keeps every message a literal, which is what
 * the apps' typed translation keys read a message's placeholders from.
 */
export const consentEn = {
  title: 'Cookies and analytics',
  text: 'Logigator sets a few cookies it needs to work, such as the one that keeps you signed in. If you allow it, we also use PostHog to see how the website and the editor are used, including recordings of editor sessions, so we know what to improve.',
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
        'Keep you signed in, remember your language, theme and editor settings, keep your work in this browser, and store this choice. Always on, since Logigator cannot work without them.'
    },
    analytics: {
      title: 'Analytics',
      description:
        'PostHog records the pages you open, what you click, how quickly pages load and, in the editor, a recording of your session. The data is linked to a random ID rather than your account and stored in the EU. Nothing is collected unless you turn this on.'
    }
  }
} as const satisfies ConsentText;
