import type { ConsentText } from './consent-text';

export const consentDe: ConsentText = {
  title: 'Cookies',
  text: 'Logigator verwendet ein paar Cookies, die es zum Funktionieren braucht. Mit deiner Zustimmung erfassen wir außerdem Nutzungsstatistiken, um zu sehen, was wir verbessern können.',
  privacy: 'Datenschutzerklärung',
  acceptAll: 'Alle akzeptieren',
  rejectAll: 'Alle ablehnen',
  customize: 'Anpassen',
  preferencesTitle: 'Cookie-Einstellungen',
  preferencesText:
    'Wähle, was Logigator in deinem Browser speichern darf. Du kannst deine Wahl jederzeit über die Fußzeile der Website oder das Hilfe-Menü des Editors ändern.',
  save: 'Auswahl speichern',
  categories: {
    necessary: {
      title: 'Notwendig',
      description:
        'Damit bleibst du angemeldet und deine Einstellungen bleiben erhalten. Immer aktiv, da Logigator ohne sie nicht funktioniert.'
    },
    analytics: {
      title: 'Statistik',
      description:
        'Nutzungsstatistiken über PostHog, einschließlich Aufzeichnungen von Editor-Sitzungen, zeigen uns, was wir verbessern können. Sie werden in der EU gespeichert und nicht mit deinem Konto verknüpft.'
    }
  }
};
