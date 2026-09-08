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
  forms: {
    errors: {
      required: 'Dieses Feld ist erforderlich.',
      invalid: 'Dieser Wert wurde nicht akzeptiert.',
      emailInvalid: 'Gib eine gültige E-Mail-Adresse ein.',
      usernameTooShort: 'Verwende mindestens 2 Zeichen.',
      usernameTooLong: 'Verwende höchstens 20 Zeichen.',
      usernamePattern: 'Erlaubt sind nur Buchstaben, Ziffern, „_“ und „-“.',
      passwordTooShort: 'Verwende mindestens 8 Zeichen.',
      passwordTooLong: 'Verwende höchstens 200 Zeichen.',
      passwordComplexity:
        'Verwende mindestens einen Buchstaben und eine Ziffer.',
      passwordMismatch: 'Die beiden Passwörter stimmen nicht überein.',
      rateLimited:
        'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.',
      serviceUnavailable:
        'Der Dienst ist vorübergehend nicht verfügbar. Bitte versuche es gleich noch einmal.',
      validationFailed:
        'Bitte überprüfe deine Eingaben und versuche es erneut.',
      network:
        'Keine Verbindung zum Server. Überprüfe deine Verbindung und versuche es erneut.',
      unknown: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'
    }
  },
  auth: {
    email: 'E-Mail',
    password: 'Passwort',
    passwordRepeat: 'Passwort wiederholen',
    passwordRules:
      'Mindestens 8 Zeichen, mit einem Buchstaben und einer Ziffer.',
    username: 'Benutzername',
    or: 'oder',
    continueWithGoogle: 'Mit Google fortfahren',
    googleErrors: {
      failed:
        'Die Anmeldung mit Google hat nicht funktioniert. Bitte versuche es erneut.',
      stateInvalid:
        'Dieser Anmeldeversuch ist abgelaufen. Bitte beginne von vorn.',
      emailTaken:
        'Diese E-Mail-Adresse gehört bereits zu einem Konto. Melde dich mit deinem Passwort an und verknüpfe Google anschließend in deinem Konto.',
      alreadyLinked:
        'Dieses Google-Konto gehört bereits zu einem anderen Logigator-Konto.'
    }
  },
  pages: {
    login: {
      title: 'Anmelden',
      heading: 'Willkommen zurück',
      submit: 'Anmelden',
      forgotPassword: 'Passwort vergessen?',
      noAccount: 'Noch kein Konto?',
      registerLink: 'Registrieren',
      invalidCredentials: 'E-Mail-Adresse oder Passwort ist falsch.',
      notVerified: 'Bestätige deine E-Mail-Adresse, bevor du dich anmeldest.',
      resend: 'Bestätigungsmail erneut senden',
      resent: 'Bestätigungsmail gesendet. Sieh in deinem Posteingang nach.'
    },
    register: {
      title: 'Registrieren',
      heading: 'Konto erstellen',
      submit: 'Registrieren',
      emailTaken: 'Diese E-Mail-Adresse gehört bereits zu einem Konto.',
      mailFailed:
        'Dein Konto wurde erstellt, die Bestätigungsmail konnte aber nicht gesendet werden. Melde dich an, um sie erneut anzufordern.',
      privacyNoticeBefore:
        'Mit der Registrierung bestätigst du, dass du unsere ',
      privacyNoticeLink: 'Datenschutzerklärung',
      privacyNoticeAfter: ' gelesen hast und akzeptierst.',
      haveAccount: 'Du hast bereits ein Konto?',
      loginLink: 'Anmelden',
      confirmHeading: 'Bestätige deine E-Mail-Adresse',
      confirmLead:
        'Wir haben einen Bestätigungslink an {{email}} gesendet. Öffne ihn, um die Registrierung abzuschließen.',
      toLogin: 'Zur Anmeldung'
    },
    resetPassword: {
      title: 'Passwort zurücksetzen',
      requestHeading: 'Passwort zurücksetzen',
      requestLead:
        'Gib die Adresse an, mit der du dich registriert hast, und wir senden dir einen Link.',
      requestSubmit: 'Link senden',
      requestSent:
        'Falls es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er ist eine Stunde lang gültig.',
      backToLogin: 'Zurück zur Anmeldung',
      applyHeading: 'Neues Passwort wählen',
      applySubmit: 'Passwort speichern',
      applied: 'Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.',
      tokenInvalid:
        'Dieser Link ist nicht mehr gültig. Bitte fordere einen neuen an.',
      requestNew: 'Neuen Link anfordern'
    },
    verifyEmail: {
      title: 'E-Mail-Bestätigung',
      pending: 'E-Mail-Adresse wird bestätigt',
      pendingLead: 'Einen Moment bitte.',
      success: 'Deine E-Mail-Adresse ist bestätigt',
      successLead: 'Du kannst dich jetzt anmelden.',
      error: 'Dieser Link hat nicht funktioniert',
      errorLead:
        'Bestätigungslinks laufen nach einer Stunde ab. Auf der Anmeldeseite kannst du einen neuen anfordern.',
      toLogin: 'Zur Anmeldung'
    },
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
