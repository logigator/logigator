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
    docs: 'Dokumentation',
    examples: 'Beispiele',
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
    changelog: 'Änderungsprotokoll',
    privacyPolicy: 'Datenschutzerklärung',
    imprint: 'Impressum',
    contributing: 'Mitwirken'
  },
  documents: {
    stars: 'Sterne'
  },
  errors: {
    retry: 'Erneut laden'
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
      nameRequired: 'Gib einen Namen ein.',
      nameTooLong: 'Verwende höchstens 20 Zeichen.',
      descriptionTooLong: 'Verwende höchstens 2048 Zeichen.',
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
      hero: {
        headline: 'Baue, simuliere und verwalte komplexe Logikschaltungen.',
        lede: 'Gatter, Leitungen und wiederverwendbare Unterschaltungen, direkt im Browser. Die Simulation läuft auf einer WebAssembly-Engine, das Board rendert die GPU — die Schaltung läuft also weiter, während sie wächst.',
        cta: 'Zum Editor',
        ctaSecondary: 'Beispiele ansehen'
      },
      features: {
        title: 'Features',
        description:
          'Baue und simuliere deine eigenen Schaltungen mit Logigator, einem einfachen aber mächtigen online Tool.',
        performance: {
          title: 'Performance',
          body: "Logigators' Editor kann dank WebAssembly und WebGL auch mit den größten Projekten umgehen."
        },
        subcircuits: {
          title: 'Unterschaltungen',
          body: 'Erstelle deine eigenen Komponenten und verwende sie in all deinen Projekten. Somit können deine Projekte übersichtlich und einfach gehalten werden.'
        },
        share: {
          title: 'Projekte teilen',
          body: 'Teile deine Schaltungen mit anderen Benutzern, damit sie von deiner Arbeit lernen können.'
        },
        images: {
          title: 'Bilder exportieren',
          body: 'Mit Logigator kannst du hochauflösende Bilder in verschieden Formaten (SVG, PNG, JPG) generieren, um sie überall zu verwenden.'
        }
      },
      examples: {
        title: 'Beispielschaltungen',
        description:
          'Lerne mit unseren Beispielen einfache, als auch komplexere Schaltungen zu bauen.',
        more: 'Weitere Beispielschaltungen',
        emptyHeading: 'Noch keine Beispiele',
        emptyBody: 'Für diese Installation wurde noch nichts veröffentlicht.',
        failed: 'Beispiele konnten nicht geladen werden'
      },
      video: {
        title: 'Was sind Logikschaltungen?',
        description:
          'Wenn du nicht weißt, was Logikschaltungen oder Logikgatter sind, haben wir eine kurze Erklärung für dich gemacht.',
        play: 'Video „{{title}}“ auf YouTube abspielen'
      },
      stats: {
        projects: 'öffentliche Schaltungen',
        components: 'öffentliche Bausteine',
        examples: 'erklärte Beispiele'
      },
      community: {
        projectsTitle: 'Community erstellte Projekte',
        projectsDescription:
          'Erkunde andere Projekte unserer User. Dein Projekt könnte das nächste auf dieser Liste sein.',
        moreProjects: 'Weitere Projekte',
        projectsEmptyHeading: 'Noch keine öffentlichen Projekte',
        projectsEmptyBody: 'Bisher wurde nichts mit der Community geteilt.',
        projectsFailed: 'Projekte konnten nicht geladen werden',
        componentsTitle: 'Community erstellte Komponenten',
        componentsDescription:
          'Erkunde andere Komponenten unserer User. Sie sind vielleicht hilfreich für dich.',
        moreComponents: 'Weitere Komponenten',
        componentsEmptyHeading: 'Noch keine öffentlichen Komponenten',
        componentsEmptyBody: 'Bisher wurde nichts mit der Community geteilt.',
        componentsFailed: 'Komponenten konnten nicht geladen werden'
      }
    },
    examples: {
      title: 'Beispielschaltungen',
      lede: 'Lerne mit unseren Beispielen einfache, als auch komplexere Schaltungen zu bauen. Jede davon öffnet sich startklar im Editor.',
      open: 'Im Editor öffnen',
      openNamed: '„{{name}}“ im Editor öffnen',
      emptyHeading: 'Noch keine Beispiele',
      emptyBody: 'Für diese Installation wurde noch nichts veröffentlicht.',
      failed: 'Beispiele konnten nicht geladen werden'
    },
    community: {
      nav: {
        projects: 'Projekte',
        components: 'Bausteine'
      },
      browse: {
        projectsTitle: 'Community-Projekte',
        projectsLede:
          'Alle Schaltungen, die die Community veröffentlicht hat. Öffne eine im Editor oder speichere eine Kopie und baue darauf auf.',
        componentsTitle: 'Community-Bausteine',
        componentsLede:
          'Wiederverwendbare Bausteine aus der Community. Platziere einen davon in einer eigenen Schaltung.',
        orderLabel: 'Sortieren nach',
        orderTrending: 'Im Trend',
        orderStars: 'Meiste Sterne',
        orderLatest: 'Neueste',
        searchLabel: 'Nach Namen suchen',
        searchPlaceholder: 'Suchen..',
        count: '{{count}} Ergebnisse',
        clearSearch: 'Suche zurücksetzen',
        noMatchHeading: 'Nichts gefunden',
        noMatchBody: 'Keine veröffentlichte Schaltung heißt „{{search}}“.',
        emptyHeading: 'Noch nichts vorhanden',
        emptyBody: 'Bisher wurde nichts mit der Community geteilt.',
        errorHeading: 'Die Liste konnte nicht geladen werden'
      },
      document: {
        open: 'Im Editor öffnen',
        clone: 'Kopie speichern',
        star: 'Stern geben',
        unstar: 'Stern gegeben',
        symbol: 'Symbol',
        inputs: 'Ein',
        outputs: 'Aus',
        components: 'Bausteine',
        wires: 'Leitungen',
        edited: 'bearbeitet',
        about: 'Über diese Schaltung',
        noDescription: 'Es wurde keine Beschreibung angegeben.',
        forkedFrom: 'Abgeleitet von',
        forkedFromBy: 'von {{author}}',
        errorHeading: 'Die Schaltung konnte nicht geladen werden'
      },
      stargazers: {
        title: 'Sterne',
        count: '{{count}} Sterne',
        seeAll: 'Alle ansehen, die einen Stern gegeben haben',
        emptyHeading: 'Noch keine Sterne',
        emptyBody: 'Diese Schaltung hat noch niemand mit einem Stern versehen.',
        errorHeading: 'Die Sterne konnten nicht geladen werden'
      },
      profile: {
        title: 'Mitglied',
        tabTitle: '{{username}} – {{section}}',
        metaDescription:
          'Die Schaltungen und Bausteine, die {{username}} auf Logigator veröffentlicht hat.',
        sections: 'Die Listen dieses Mitglieds',
        memberSince: 'Mitglied seit',
        projects: 'Projekte',
        components: 'Bausteine',
        starredProjects: 'Projekte mit Stern',
        starredComponents: 'Bausteine mit Stern',
        emptyProjects: 'Keine öffentlichen Projekte',
        emptyComponents: 'Keine öffentlichen Bausteine',
        emptyStarredProjects: 'Keine Projekte mit Stern',
        emptyStarredComponents: 'Keine Bausteine mit Stern',
        emptyBody: 'In dieser Kategorie gibt es nichts zu zeigen.',
        errorHeading: 'Das Profil konnte nicht geladen werden',
        listErrorHeading: 'Die Liste konnte nicht geladen werden'
      }
    },
    my: {
      nav: {
        label: 'Meine Arbeit',
        projects: 'Projekte',
        components: 'Komponenten'
      },
      projects: {
        title: 'Meine Projekte',
        lede: 'Alle Schaltungen, die du in der Cloud gespeichert hast. Öffne eine zum Weiterbauen oder veröffentliche sie in der Community.',
        create: 'Neues Projekt',
        count: '{{count}} Projekte',
        emptyHeading: 'Noch keine Projekte',
        emptyBody:
          'Schaltungen, die du im Editor in der Cloud speicherst, erscheinen hier.'
      },
      components: {
        title: 'Meine Komponenten',
        lede: 'Die wiederverwendbaren Bausteine deiner Bibliothek. Platziere sie in jeder Schaltung, die du baust.',
        count: '{{count}} Komponenten',
        emptyHeading: 'Noch keine Komponenten',
        emptyBody:
          'Eine Komponente entsteht im Editor, aus einer Schaltung, die du gebaut hast.'
      },
      list: {
        searchLabel: 'Nach Namen suchen',
        searchPlaceholder: 'Suchen..',
        clearSearch: 'Suche zurücksetzen',
        noMatchHeading: 'Nichts gefunden',
        noMatchBody: 'Nichts von dir heißt „{{search}}“.',
        errorHeading: 'Die Liste konnte nicht geladen werden',
        openInEditor: '„{{name}}“ im Editor öffnen',
        actionsFor: 'Aktionen für „{{name}}“',
        public: 'Öffentlich',
        private: 'Privat',
        edit: 'Name & Beschreibung',
        share: 'Teilen…',
        delete: 'Löschen'
      },
      edit: {
        heading: 'Name & Beschreibung',
        nameLabel: 'Name',
        descriptionLabel: 'Beschreibung',
        descriptionHint:
          'Wird auf der Community-Seite gezeigt, wenn die Schaltung veröffentlicht ist.',
        save: 'Speichern',
        cancel: 'Abbrechen'
      },
      share: {
        heading: 'Teilen',
        intro:
          'Wer den Link unten hat, kann „{{name}}“ im Editor öffnen – veröffentlicht oder nicht.',
        linkLabel: 'Link zum Teilen',
        linkHint:
          'Der Link öffnet eine schreibgeschützte Kopie. Deine Schaltung kann darüber niemand ändern.',
        copy: 'Kopieren',
        copied: 'Link kopiert.',
        copyFailed:
          'Der Link konnte nicht kopiert werden. Markiere ihn und kopiere ihn von Hand.',
        publicLabel: 'In der Community veröffentlichen',
        publicHintProject:
          'Ein veröffentlichtes Projekt erscheint in den Community-Listen und kann markiert und kopiert werden.',
        publicHintComponent:
          'Eine veröffentlichte Komponente erscheint in den Community-Listen und kann von allen platziert werden.',
        viewPublicPage: 'Community-Seite ansehen',
        regenerateLabel: 'Link zurückziehen',
        regenerateHint:
          'Es wird ein neuer Link vergeben und der alte hört auf zu funktionieren – auch die Community-Seite, die unter dieser Adresse liegt.',
        regenerate: 'Neuen Link vergeben',
        close: 'Schließen'
      },
      delete: {
        heading: 'Endgültig löschen?',
        messageProject:
          '„{{name}}“ und die Schaltung darin werden gelöscht. Das lässt sich nicht rückgängig machen.',
        messageComponent:
          '„{{name}}“ wird gelöscht. Schaltungen, die sie schon verwenden, laufen mit der darin gespeicherten Kopie weiter.',
        confirm: 'Löschen',
        cancel: 'Abbrechen',
        done: '„{{name}}“ wurde gelöscht.',
        failed: '„{{name}}“ konnte nicht gelöscht werden.'
      },
      account: {
        title: 'Account',
        lede: 'Dein Name und Bild, die Adresse für die Anmeldung und wie du dich anmeldest.',
        memberSince: 'Mitglied seit {{date}}',
        currentPassword: 'Aktuelles Passwort',
        passwordIncorrect: 'Dieses Passwort ist nicht richtig.',
        profile: {
          heading: 'Profil',
          description:
            'Name und Bild, die neben allem stehen, was du veröffentlichst.',
          changePicture: 'Bild ändern',
          removePicture: 'Entfernen',
          pictureHint:
            'PNG, JPEG, WebP oder GIF. Es wird quadratisch zugeschnitten und neu kodiert.',
          save: 'Speichern',
          saved: 'Dein Profil wurde gespeichert.',
          avatarRejected:
            'Dieses Bild konnte nicht verwendet werden. Versuche ein kleineres PNG, JPEG oder WebP.'
        },
        email: {
          heading: 'E-Mail-Adresse',
          description:
            'Die Adresse für deine Anmeldung, und wohin Bestätigungen gehen.',
          current: 'Aktuell:',
          unverified: 'nicht bestätigt',
          newLabel: 'Neue E-Mail-Adresse',
          passwordHint: 'Dein Passwort bestätigt, dass du es bist.',
          submit: 'Bestätigung senden',
          pending:
            'Ein Bestätigungslink ist an {{email}} unterwegs. Deine Adresse wechselt, sobald du ihn öffnest.',
          taken: 'Zu dieser E-Mail-Adresse gibt es schon einen Account.',
          unchanged: 'Das ist bereits deine Adresse.',
          mailFailed:
            'Die Bestätigungsmail konnte nicht gesendet werden. Es hat sich nichts geändert – bitte versuche es erneut.'
        },
        password: {
          heading: 'Passwort',
          description:
            'Zum Ändern gehört, dass du überall sonst abgemeldet wirst.',
          setHeading: 'Passwort festlegen',
          setDescription:
            'Du hast dich mit Google registriert und hast noch kein Passwort. Mit einem hast du einen zweiten Weg hinein.',
          newLabel: 'Neues Passwort',
          submit: 'Passwort ändern',
          setSubmit: 'Passwort festlegen',
          saved: 'Dein Passwort wurde geändert.',
          sessionsNotice:
            'Deine anderen Sitzungen werden abgemeldet. Diese bleibt.'
        },
        google: {
          heading: 'Google',
          description:
            'Anmelden mit deinem Google-Konto, zusätzlich zum Passwort.',
          linked: 'Dein Google-Konto ist verknüpft.',
          link: 'Google-Konto verknüpfen',
          unlink: 'Verknüpfung lösen',
          unlinkConfirm:
            'Die Anmeldung mit Google funktioniert dann nicht mehr. Du kannst sie jederzeit wieder verknüpfen.',
          needsPassword:
            'Lege zuerst ein Passwort fest – Google ist gerade der einzige Weg in diesen Account.'
        },
        delete: {
          heading: 'Account löschen',
          description:
            'Dein Account und alle Projekte, Komponenten und Markierungen darin werden gelöscht. Das lässt sich nicht rückgängig machen.',
          submit: 'Meinen Account löschen',
          confirm:
            'Alles, was du auf Logigator gemacht hast, wird endgültig gelöscht.',
          done: 'Dein Account wurde gelöscht.'
        }
      }
    },
    docs: {
      title: 'Dokumentation',
      lede: 'Jeder Teil des Logigator-Editors, erklärt: die Arbeitsfläche und ihre Werkzeuge, das Bauen von Schaltungen, das Simulieren und das Aufbewahren deiner Arbeit.',
      search: {
        label: 'Dokumentation durchsuchen',
        placeholder: 'Suchen..',
        empty: 'Nichts passt zu „{{query}}“.'
      },
      navLabel: 'Dokumentationsseiten',
      allTopics: 'Alle Themen',
      sections: {
        basics: 'Grundlagen',
        building: 'Schaltungen bauen',
        simulation: 'Simulation',
        projects: 'Projekte & Cloud'
      },
      pages: {
        gettingStarted: 'Einstieg',
        boardAndTools: 'Arbeitsfläche & Werkzeuge',
        shortcuts: 'Tastaturbefehle',
        settings: 'Einstellungen & Darstellung',
        componentsAndOptions: 'Komponenten & Optionen',
        wiresAndConnections: 'Leitungen & Verbindungen',
        customComponents: 'Benutzerdefinierte Komponenten',
        simulation: 'Simulation',
        inspection: 'Inspektion & Beobachtungen',
        savingAndFiles: 'Speichern & Dateien',
        cloud: 'Cloud & Teilen'
      }
    },
    changelog: {
      title: 'Änderungsprotokoll',
      lede: 'Jede Version des Logigator-Editors, die neueste zuerst: was hinzugekommen ist, was sich geändert hat und was behoben wurde.',
      feed: 'Per Atom abonnieren'
    },
    imprint: {
      title: 'Impressum',
      lede: 'Wer Logigator betreibt und wie du uns erreichst.'
    },
    privacyPolicy: {
      title: 'Datenschutzerklärung',
      lede: 'Welche Daten Logigator verarbeitet, warum das geschieht und welche Rechte du daran hast.'
    },
    notFound: {
      title: 'Seite nicht gefunden',
      text: 'Die angegebene Seite konnte nicht gefunden werden.',
      back: 'Zur Startseite'
    }
  }
};

export default de;
