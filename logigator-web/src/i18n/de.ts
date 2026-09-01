import type { TranslationSchema } from '../app/translation/translation-schema.model';

const de: TranslationSchema = {
  common: {
    close: 'Schließen',
    back: 'Zurück',
    dismiss: 'Ausblenden',
    firstPage: 'Erste Seite',
    previousPage: 'Vorherige Seite',
    nextPage: 'Nächste Seite',
    lastPage: 'Letzte Seite'
  },
  site: {
    name: 'Logigator',
    description:
      'Erstelle und simuliere deine eigenen Logikschaltungen mit Logigator, einem einfachen und zugleich mächtigen Online-Werkzeug.'
  },
  header: {
    home: 'Logigator Startseite',
    features: 'Features',
    community: 'Community',
    myProjects: 'Meine Projekte',
    myComponents: 'Meine Komponenten',
    login: 'Anmelden',
    register: 'Registrieren',
    account: 'Account',
    logout: 'Abmelden',
    openNavigation: 'Navigation öffnen',
    navigation: 'Navigation',
    userMenu: 'Account-Menü',
    notSignedIn: 'Nicht angemeldet',
    theme: 'Design',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    language: 'Sprache',
    skipToContent: 'Zum Inhalt springen'
  },
  footer: {
    privacyPolicy: 'Datenschutzerklärung',
    imprint: 'Impressum',
    contributing: 'Mitwirken'
  },
  pages: {
    home: {
      title: 'Der Editor für Logikschaltungen',
      lead: 'Erstelle, simuliere und verwalte komplexe Logikschaltungen — kostenlos.',
      openEditor: 'Editor öffnen'
    },
    notFound: {
      title: 'Seite nicht gefunden',
      text: 'Die angegebene Seite konnte nicht gefunden werden.',
      back: 'Zur Startseite'
    }
  }
};

export default de;
