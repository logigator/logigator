import type { ConsentText } from './consent-text';

export const consentDe: ConsentText = {
  title: 'Cookies und Statistik',
  text: 'Logigator setzt ein paar Cookies, ohne die es nicht funktioniert, etwa das, mit dem du angemeldet bleibst. Wenn du zustimmst, nutzen wir außerdem PostHog, um zu sehen, wie die Website und der Editor genutzt werden, einschließlich Aufzeichnungen von Editor-Sitzungen, damit wir wissen, was wir verbessern sollten.',
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
        'Damit bleibst du angemeldet, Sprache, Design und Editor-Einstellungen bleiben erhalten, deine Arbeit wird in diesem Browser aufbewahrt und diese Wahl gespeichert. Immer aktiv, da Logigator ohne sie nicht funktioniert.'
    },
    analytics: {
      title: 'Statistik',
      description:
        'PostHog erfasst, welche Seiten du öffnest, was du anklickst, wie schnell Seiten laden und im Editor eine Aufzeichnung deiner Sitzung. Die Daten sind mit einer zufälligen ID statt mit deinem Konto verknüpft und werden in der EU gespeichert. Ohne deine Zustimmung wird nichts erfasst.'
    }
  }
};
