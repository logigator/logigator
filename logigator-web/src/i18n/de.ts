import type { TranslationSchema } from '../app/translation/translation-schema.model';
import { consentDe } from '@logigator/core/consent-text/de';

const de: TranslationSchema = {
  common: {
    close: 'Schließen',
    back: 'Zurück',
    dismiss: 'Ausblenden',
    firstPage: 'Erste Seite',
    previousPage: 'Vorherige Seite',
    nextPage: 'Nächste Seite',
    lastPage: 'Letzte Seite',
    formatting: 'Formatierung',
    heading1: 'Überschrift 1',
    heading2: 'Überschrift 2',
    heading3: 'Überschrift 3',
    bold: 'Fett',
    italic: 'Kursiv',
    code: 'Code',
    link: 'Link',
    bulletedList: 'Aufzählung',
    numberedList: 'Nummerierte Liste',
    quote: 'Zitat',
    codeBlock: 'Codeblock',
    divider: 'Trennlinie',
    table: 'Tabelle',
    linkTools: 'Link',
    linkText: 'Link',
    linkUrl: 'Linkadresse',
    removeLink: 'Link entfernen',
    tableTools: 'Tabelle',
    insertRowAbove: 'Zeile oberhalb einfügen',
    insertRowBelow: 'Zeile unterhalb einfügen',
    insertColumnBefore: 'Spalte links einfügen',
    insertColumnAfter: 'Spalte rechts einfügen',
    deleteRow: 'Zeile löschen',
    deleteColumn: 'Spalte löschen',
    deleteTable: 'Tabelle löschen',
    alignLeft: 'Linksbündig',
    alignCenter: 'Zentriert',
    alignRight: 'Rechtsbündig',
    viewMode: 'Ansicht',
    richText: 'Formatiert',
    markdownSource: 'Markdown'
  },
  site: {
    name: 'Logigator',
    description:
      'Baue Logikschaltungen aus Gattern und Leitungen im Browser, simuliere sie live und verwandle jede Schaltung in eine wiederverwendbare Komponente. Kostenlos und Open Source.'
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
    account: 'Konto',
    logout: 'Abmelden',
    openNavigation: 'Navigation öffnen',
    navigation: 'Navigation',
    userMenu: 'Benutzermenü',
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
    contributing: 'Mitwirken',
    cookieSettings: 'Cookie-Einstellungen'
  },
  consent: consentDe,
  documents: {
    stars: 'Sterne',
    enlargePreview: 'Vorschau von „{{name}}“ vergrößern'
  },
  share: {
    /** Sent with the link by a share sheet, and the embed's alt text. */
    caption: '„{{name}}“ auf Logigator',
    label: 'Teilen',
    copyLabel: 'Link kopieren',
    copied: 'Link kopiert.',
    copyFailed: 'Der Link konnte nicht kopiert werden.',
    embedLabel: 'Einbetten',
    embedHide: 'Einbettung ausblenden',
    embedCopy: 'Code kopieren',
    embedCopied: 'Einbettungscode kopiert.',
    embedCopyFailed: 'Der Einbettungscode konnte nicht kopiert werden.',
    embedHint:
      'Zum Einfügen in einen Forenbeitrag, eine Wiki-Seite oder eine Unterrichtsstunde.',
    formatLabel: 'Format',
    formatMarkdown: 'Markdown',
    formatHtml: 'HTML',
    formatBbcode: 'BBCode'
  },
  visibility: {
    private: {
      label: 'Nur du',
      hint: 'Nur du kannst sie öffnen, auch mit dem Link.'
    },
    unlisted: {
      label: 'Alle mit dem Link',
      hint: 'Alle mit dem Link können sie öffnen, aber nicht bearbeiten. Sie wird weder in der Community gelistet noch von Suchmaschinen indexiert.'
    },
    public: {
      label: 'Alle',
      hint: 'In der Community gelistet, für alle offen und von Suchmaschinen indexiert.'
    }
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
      usernameTooLong: 'Verwende höchstens 32 Zeichen.',
      usernamePattern:
        "Erlaubt sind Buchstaben von A bis Z (auch mit Akzent), Ziffern, Leerzeichen und „. _ - ' ( )“.",
      passwordTooShort: 'Verwende mindestens 8 Zeichen.',
      passwordTooLong: 'Verwende höchstens 200 Zeichen.',
      passwordComplexity:
        'Verwende mindestens einen Buchstaben und eine Ziffer.',
      passwordMismatch: 'Die beiden Passwörter stimmen nicht überein.',
      nameRequired: 'Gib einen Namen ein.',
      nameTooLong: 'Verwende höchstens 20 Zeichen.',
      symbolRequired: 'Gib ein Symbol ein.',
      symbolTooLong: 'Verwende höchstens 5 Zeichen.',
      descriptionTooLong: 'Verwende höchstens 2048 Zeichen.',
      bioTooLong: 'Verwende höchstens 1024 Zeichen.',
      urlInvalid:
        'Gib einen vollständigen Link ein, beginnend mit http:// oder https://.',
      urlTooLong: 'Verwende höchstens 2048 Zeichen.',
      rateLimited:
        'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.',
      serviceUnavailable:
        'Der Dienst ist vorübergehend nicht verfügbar. Bitte versuche es gleich noch einmal.',
      validationFailed:
        'Bitte überprüfe deine Eingaben und versuche es erneut.',
      storageFull:
        'Dein Cloud-Speicher ist voll. Lösche Projekte oder Komponenten, die du nicht mehr brauchst, um Platz zu schaffen.',
      network:
        'Keine Verbindung zum Server. Überprüfe deine Verbindung und versuche es erneut.',
      unknown: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'
    },
    /** Asked before leaving a page whose form has edits not yet saved. */
    unsavedChanges: {
      header: 'Änderungen verwerfen?',
      message:
        'Du hast ungespeicherte Änderungen auf dieser Seite. Wenn du sie verlässt, gehen sie verloren.',
      accept: 'Verwerfen',
      reject: 'Weiter bearbeiten'
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
        'Dieses Google-Konto gehört bereits zu einem anderen Logigator-Konto.',
      accountMismatch:
        'Das ist nicht das Google-Konto, das mit diesem Logigator-Konto verknüpft ist.',
      reauthenticationRequired:
        'Deine letzte Anmeldung ist zu lange her, um Google zu verknüpfen. Melde dich zuerst noch einmal an.'
    }
  },
  pages: {
    login: {
      title: 'Anmelden',
      heading: 'Willkommen zurück',
      submit: 'Anmelden',
      metaDescription:
        'Melde dich bei Logigator an, um deine gespeicherten Schaltungen, deine Komponentenbibliothek und die Projekte, denen du einen Stern gegeben hast, zu öffnen.',
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
      metaDescription:
        'Erstelle ein kostenloses Logigator-Konto, um deine Schaltungen in der Cloud zu speichern, eine Komponentenbibliothek aufzubauen und deine Arbeit zu teilen.',
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
      title: 'Logikschaltungen online bauen und simulieren',
      hero: {
        headline: 'Baue, simuliere und teile Logikschaltungen kostenlos.',
        lede: 'Beginne mit einem einzelnen Gatter und einer LED und arbeite dich bis zu deiner eigenen CPU vor.',
        cta: 'Zum Editor',
        ctaSecondary: 'Beispiele ansehen',
        boardLink: 'Schau dir diese Schaltung an'
      },
      features: {
        title: 'Features',
        learnMore: 'Mehr erfahren',
        learnMoreLabel: 'Mehr erfahren: {{feature}}',
        stepping: {
          title: 'Folge jedem Signal',
          body: 'Leitungen, auf denen ein Signal anliegt, leuchten auf. Halte die Simulation an und gehe Tick für Tick weiter.'
        },
        inspection: {
          title: 'Schau in deine Komponenten',
          body: 'Klicke während der Simulation auf eine eigene Komponente, um ihre innere Schaltung zu sehen, oder verfolge, was ein ROM oder RAM liest und schreibt.'
        },
        components: {
          title: 'Baue eigene Komponenten',
          body: 'Verwandle eine Schaltung in eine Komponente und verwende sie in größeren Schaltungen wieder. Einen Volladdierer baust du einmal und setzt ihn dann achtmal ein.'
        },
        io: {
          title: 'Jede Menge zum Ausprobieren',
          body: 'Steuere deine Schaltung mit Schaltern, Tastern, Tastatur oder Gamepad und sieh das Ergebnis auf LEDs, Segmentanzeigen, einer LED-Matrix und mehr.'
        },
        share: {
          title: 'Teile, was du baust',
          body: 'Teile einen Link oder veröffentliche deine Schaltung in der Community. Ein Projekt kannst du auch als Datei exportieren, die Arbeitsfläche als Bild für Präsentationen und Arbeitsblätter.'
        },
        browser: {
          title: 'Nichts zu installieren',
          body: 'Ein Konto brauchst du nur, wenn du in der Cloud speichern möchtest. Der Editor läuft im Browser, auch auf Tablets und Handys.'
        }
      },
      examples: {
        title: 'Beispielschaltungen',
        description:
          'Lerne anhand unserer Beispiele, wie du einfache und komplexere Schaltungen baust.',
        more: 'Alle Beispiele',
        emptyHeading: 'Noch keine Beispiele',
        emptyBody: 'Für diese Installation wurde noch nichts veröffentlicht.',
        failed: 'Beispiele konnten nicht geladen werden'
      },
      video: {
        title: 'Was sind Logikschaltungen?',
        description:
          'Wenn du nicht weißt, was Logikschaltungen oder Logikgatter sind, findest du hier eine kurze animierte Erklärung.',
        play: 'Video „{{title}}“ auf YouTube abspielen'
      },
      stats: {
        projects: 'öffentliche Schaltungen',
        components: 'öffentliche Komponenten',
        examples: 'erklärte Beispiele'
      },
      community: {
        projectsTitle: 'Projekte aus der Community',
        projectsDescription:
          'Die Schaltungen mit den meisten Sternen. Öffne eine, um zu sehen, wie sie funktioniert, oder erstelle eine Kopie und entwickle sie weiter.',
        moreProjects: 'Alle Community-Projekte',
        projectsEmptyHeading: 'Noch keine öffentlichen Projekte',
        projectsEmptyBody: 'Bisher wurde nichts mit der Community geteilt.',
        projectsFailed: 'Projekte konnten nicht geladen werden',
        componentsTitle: 'Komponenten aus der Community',
        componentsDescription:
          'Fertige Bausteine von anderen. Kopiere einen in deine Bibliothek und setze ihn in deine eigenen Schaltungen ein.',
        moreComponents: 'Alle Community-Komponenten',
        componentsEmptyHeading: 'Noch keine öffentlichen Komponenten',
        componentsEmptyBody: 'Bisher wurde nichts mit der Community geteilt.',
        componentsFailed: 'Komponenten konnten nicht geladen werden'
      }
    },
    examples: {
      title: 'Beispielschaltungen',
      lede: 'Lerne anhand unserer Beispiele, wie du einfache und komplexere Schaltungen baust. Jedes lässt sich direkt im Editor öffnen und sofort simulieren.',
      open: 'Im Editor öffnen',
      openNamed: '„{{name}}“ im Editor öffnen',
      emptyHeading: 'Noch keine Beispiele',
      emptyBody: 'Für diese Installation wurde noch nichts veröffentlicht.',
      failed: 'Beispiele konnten nicht geladen werden'
    },
    community: {
      nav: {
        projects: 'Projekte',
        components: 'Komponenten'
      },
      browse: {
        projectsTitle: 'Community-Projekte',
        projectsLede:
          'Alle Schaltungen, die die Community veröffentlicht hat. Öffne eine im Editor oder erstelle eine Kopie und entwickle sie weiter.',
        componentsTitle: 'Community-Komponenten',
        componentsLede:
          'Wiederverwendbare Bausteine aus der Community. Platziere einen davon in einer eigenen Schaltung.',
        orderLabel: 'Sortieren nach',
        orderTrending: 'Im Trend',
        orderStars: 'Meiste Sterne',
        orderLatest: 'Neueste',
        searchLabel: 'Nach Namen suchen',
        searchPlaceholder: 'Suchen …',
        count: '{{count}} Ergebnisse',
        clearSearch: 'Suche zurücksetzen',
        noMatchHeading: 'Nichts gefunden',
        noMatchBody:
          'Keine veröffentlichte Schaltung trägt den Namen „{{search}}“.',
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
        inputs: 'Eingänge',
        outputs: 'Ausgänge',
        components: 'Komponenten',
        wires: 'Leitungen',
        edited: 'bearbeitet',
        about: 'Über diese Schaltung',
        noDescription: 'Es wurde keine Beschreibung angegeben.',
        emptyNotice:
          'Diese Schaltung ist leer und wird deshalb noch nicht in der Community gelistet. Sie erscheint dort, sobald sie eine Komponente oder eine Leitung enthält.',
        awaitingCheckNotice:
          'Diese Schaltung wird geprüft, bevor sie in der Community erscheint. Das dauert meist nur ein paar Minuten; ihren Link kannst du schon jetzt teilen.',
        forkedFrom: 'Abgeleitet von',
        forkedFromBy: 'von {{author}}',
        errorHeading: 'Die Schaltung konnte nicht geladen werden',
        translate: 'Übersetzen',
        machineTranslatedFrom:
          'Maschinell übersetzt, Original auf {{language}}',
        machineTranslated: 'Maschinell übersetzt',
        showOriginal: 'Original anzeigen',
        report: 'Melden',
        hiddenNotice:
          'Diese Schaltung wurde von der Moderation ausgeblendet. Nur du kannst sie sehen, und sie erscheint in keiner Community-Liste. Grund: {{reason}}',
        hiddenNoticeAutomatic:
          'Diese Schaltung wurde automatisch ausgeblendet. Nur du kannst sie sehen, und sie erscheint in keiner Community-Liste. Grund: {{category}}. Eine Person prüft diese Entscheidung noch.'
      },
      report: {
        heading: 'Schaltung melden',
        lede: 'Teile uns mit, was mit dieser Schaltung nicht stimmt. Jede Meldung wird von einem Menschen gelesen.',
        reasonLabel: 'Grund',
        reasons: {
          illegal: 'Rechtswidriger Inhalt',
          copyright: 'Urheberrechtsverletzung',
          personal_data: 'Personenbezogene Daten',
          harassment: 'Belästigung oder Hass',
          spam: 'Spam',
          other: 'Etwas anderes'
        },
        explanationLabel: 'Was stimmt nicht',
        explanationHint:
          'Beschreibe, was du gefunden hast und wo. Nenne bei einer Urheberrechtsverletzung das Originalwerk.',
        emailLabel: 'E-Mail',
        emailHint:
          'Optional. Wird nur genutzt, um dir zu dieser Meldung zu antworten.',
        cancel: 'Abbrechen',
        submit: 'Meldung senden',
        done: 'Danke. Deine Meldung wurde gesendet und wird geprüft.'
      },
      stargazers: {
        title: 'Wer einen Stern gegeben hat',
        count: '{{count}} Sterne',
        seeAll: 'Alle anzeigen, die einen Stern gegeben haben',
        emptyHeading: 'Noch keine Sterne',
        emptyBody: 'Dieser Schaltung hat noch niemand einen Stern gegeben.',
        errorHeading: 'Die Liste konnte nicht geladen werden'
      },
      profile: {
        title: 'Mitglied',
        about: 'Über dieses Mitglied',
        tabTitle: '{{username}} – {{section}}',
        metaDescription:
          'Die Schaltungen und Komponenten, die {{username}} auf Logigator veröffentlicht hat.',
        sections: 'Die Listen dieses Mitglieds',
        memberSince: 'Mitglied seit',
        projects: 'Projekte',
        components: 'Komponenten',
        stars: 'Sterne',
        starredProjects: 'Mit Stern markierte Projekte',
        starredComponents: 'Mit Stern markierte Komponenten',
        emptyProjects: 'Keine öffentlichen Projekte',
        emptyComponents: 'Keine öffentlichen Komponenten',
        emptyStarredProjects: 'Noch keinem Projekt einen Stern gegeben',
        emptyStarredComponents: 'Noch keiner Komponente einen Stern gegeben',
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
        create: 'Neue Komponente',
        count: '{{count}} Komponenten',
        emptyHeading: 'Noch keine Komponenten',
        emptyBody:
          'Erstelle hier eine neue oder wandle im Editor eine deiner Schaltungen in eine Komponente um.'
      },
      create: {
        headingProject: 'Neues Projekt',
        headingComponent: 'Neue Komponente',
        nameLabel: 'Name',
        symbolLabel: 'Symbol',
        symbolHint: 'Steht auf der Komponente, wo immer sie platziert wird.',
        descriptionLabel: 'Beschreibung',
        submit: 'Erstellen',
        cancel: 'Abbrechen',
        done: '„{{name}}“ wurde erstellt.'
      },
      list: {
        searchLabel: 'Nach Namen suchen',
        searchPlaceholder: 'Suchen …',
        clearSearch: 'Suche zurücksetzen',
        noMatchHeading: 'Nichts gefunden',
        noMatchBody: 'Nichts von dir trägt den Namen „{{search}}“.',
        errorHeading: 'Die Liste konnte nicht geladen werden',
        openInEditor: '„{{name}}“ im Editor öffnen',
        actionsFor: 'Aktionen für „{{name}}“',
        edit: 'Name & Beschreibung',
        share: 'Teilen…',
        communityPage: 'Community-Seite',
        emptyNotListed: 'Nicht gelistet',
        emptyNotListedHint:
          'Diese Schaltung ist leer und wird deshalb noch nicht in der Community gelistet.',
        awaitingCheck: 'Wird geprüft',
        awaitingCheckHint:
          'Diese Schaltung wird geprüft, bevor sie in der Community erscheint. Das dauert meist nur ein paar Minuten.',
        hidden: 'Ausgeblendet',
        hiddenHint: 'Von der Moderation ausgeblendet: {{reason}}',
        hiddenHintAutomatic:
          'Automatisch ausgeblendet: {{category}}. Eine Person prüft das noch.',
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
        intro: 'Wähle, wer „{{name}}“ öffnen kann.',
        visibilityLabel: 'Wer kann sie öffnen',
        linkLabel: 'Link zum Teilen',
        noLink:
          'Solange die Schaltung privat ist, kannst nur du sie öffnen. Der Link selbst bleibt gleich. Wähle „Alle mit dem Link“, um ihn erneut zu teilen oder einen neuen Link zu erstellen.',
        viewPublicPage: 'Community-Seite ansehen',
        regenerateWarning:
          'Der alte Link hört sofort auf zu funktionieren – für alle, die ihn haben. Die Schaltung selbst bleibt unverändert.',
        regenerate: 'Neuen Link erstellen',
        linkPublished:
          'Der Link wurde nicht ersetzt: Die Schaltung ist veröffentlicht, und ihre Community-Seite ist unter diesem Link erreichbar.',
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
        title: 'Konto',
        lede: 'Dein Name und Bild, die Adresse für die Anmeldung und wie du dich anmeldest.',
        memberSince: 'Mitglied seit {{date}}',
        currentPassword: 'Aktuelles Passwort',
        passwordIncorrect: 'Dieses Passwort ist nicht richtig.',
        profile: {
          heading: 'Profil',
          description:
            'Dein Name, dein Profilbild und dein Profil werden neben allem angezeigt, was du veröffentlichst.',
          changePicture: 'Bild ändern',
          removePicture: 'Entfernen',
          pictureHint:
            'PNG, JPEG, WebP oder GIF. Es wird quadratisch zugeschnitten und neu kodiert.',
          bioLabel: 'Über mich',
          bioHint:
            'Wird in deinem öffentlichen Profil angezeigt. Markdown wird unterstützt.',
          websiteLabel: 'Webseite',
          linkLabel: 'Link {{n}}',
          save: 'Speichern',
          viewProfile: 'Öffentliches Profil ansehen',
          saved: 'Dein Profil wurde gespeichert.',
          stale:
            'Dein Profil wurde in einem anderen Tab oder Fenster geändert. Deshalb wurden deine Änderungen nicht gespeichert. Wenn du das gespeicherte Profil lädst, gehen deine Eingaben hier verloren.',
          loadSaved: 'Gespeichertes Profil laden',
          avatarRejected:
            'Dieses Bild konnte nicht verwendet werden. Versuche ein kleineres PNG, JPEG, WebP oder GIF.'
        },
        email: {
          heading: 'E-Mail-Adresse',
          description:
            'Die E-Mail-Adresse, mit der du dich anmeldest und an die Bestätigungen gesendet werden.',
          current: 'Aktuell:',
          unverified: 'nicht bestätigt',
          newLabel: 'Neue E-Mail-Adresse',
          passwordHint: 'Dein Passwort bestätigt, dass du es bist.',
          submit: 'Bestätigung senden',
          pending:
            'Ein Bestätigungslink wurde an {{email}} gesendet. Deine E-Mail-Adresse wird geändert, sobald du den Link öffnest.',
          taken: 'Zu dieser E-Mail-Adresse gibt es schon ein Konto.',
          unchanged: 'Das ist bereits deine Adresse.',
          mailFailed:
            'Die Bestätigungsmail konnte nicht gesendet werden. Es hat sich nichts geändert – bitte versuche es erneut.',
          reauthenticate:
            'Melde dich noch einmal mit Google an, um deine Adresse zu ändern. Anschließend kehrst du hierher zurück, um den Vorgang abzuschließen.'
        },
        password: {
          heading: 'Passwort',
          description:
            'Wenn du dein Passwort änderst, wirst du überall sonst abgemeldet.',
          setHeading: 'Passwort festlegen',
          setDescription:
            'Du hast dich mit Google registriert und hast noch kein Passwort. Mit einem Passwort kannst du dich auch ohne Google anmelden.',
          newLabel: 'Neues Passwort',
          submit: 'Passwort ändern',
          setSubmit: 'Passwort festlegen',
          saved: 'Dein Passwort wurde geändert.',
          sessionsNotice:
            'Alle anderen Sitzungen werden abgemeldet. Diese Sitzung bleibt angemeldet.',
          reauthenticate:
            'Melde dich noch einmal mit Google an, um ein Passwort festzulegen. Anschließend kehrst du hierher zurück, um den Vorgang abzuschließen.'
        },
        google: {
          heading: 'Google',
          description:
            'Melde dich zusätzlich zu deinem Passwort mit deinem Google-Konto an.',
          linked: 'Dein Google-Konto ist verknüpft.',
          link: 'Google-Konto verknüpfen',
          unlink: 'Verknüpfung lösen',
          unlinkConfirm:
            'Die Anmeldung mit Google funktioniert dann nicht mehr. Du kannst sie jederzeit wieder verknüpfen.',
          needsPassword:
            'Lege zuerst ein Passwort fest – Google ist gerade der einzige Weg in dieses Konto.',
          reauthenticate:
            'Deine letzte Anmeldung ist schon eine Weile her. Gib dein Passwort ein, um Google weiter zu verknüpfen.'
        },
        delete: {
          heading: 'Konto löschen',
          description:
            'Dein Konto und alle dazugehörigen Projekte, Komponenten und Sterne werden gelöscht. Das lässt sich nicht rückgängig machen.',
          submit: 'Mein Konto löschen',
          confirm:
            'Alles, was du auf Logigator gemacht hast, wird endgültig gelöscht.',
          done: 'Dein Konto wurde gelöscht.',
          reauthenticate:
            'Melde dich noch einmal mit Google an, um dein Konto zu löschen. Anschließend kehrst du hierher zurück, um den Vorgang abzuschließen.'
        }
      }
    },
    docs: {
      title: 'Dokumentation',
      lede: 'Hier wird jeder Teil des Logigator-Editors erklärt: die Arbeitsfläche und ihre Werkzeuge, das Bauen von Schaltungen, alle Komponenten, die Simulation und das Speichern deiner Arbeit.',
      search: {
        label: 'Dokumentation durchsuchen',
        placeholder: 'Suchen …',
        empty: 'Nichts passt zu „{{query}}“.'
      },
      navLabel: 'Dokumentationsseiten',
      allTopics: 'Alle Themen',
      sections: {
        basics: 'Grundlagen',
        building: 'Schaltungen bauen',
        components: 'Komponenten',
        simulation: 'Simulation',
        projects: 'Projekte und Cloud'
      },
      pages: {
        gettingStarted: 'Einstieg',
        boardAndTools: 'Arbeitsfläche und Werkzeuge',
        phonesAndTablets: 'Smartphones und Tablets',
        shortcuts: 'Tastaturbefehle',
        settings: 'Einstellungen',
        wiresAndConnections: 'Leitungen und Verbindungen',
        customComponents: 'Benutzerdefinierte Komponenten',
        componentsAndOptions: 'Komponenten und Optionen',
        logicGates: 'Logikgatter',
        addersAndSelectors: 'Addierer und Selektoren',
        memory: 'Speicher',
        clockAndTiming: 'Zeitsteuerung',
        inputs: 'Eingaben',
        outputs: 'Ausgaben',
        simulation: 'Simulation',
        inspection: 'Inspektion und Beobachtungen',
        savingAndFiles: 'Speichern und Dateien',
        cloud: 'Cloud und Teilen'
      }
    },
    changelog: {
      title: 'Änderungsprotokoll',
      lede: 'Alle Versionen von Logigator, die neueste zuerst: was hinzugekommen ist, was sich geändert hat und was behoben wurde.',
      feed: 'Per Atom abonnieren'
    },
    imprint: {
      title: 'Impressum',
      lede: 'Wer Logigator betreibt und wie du uns erreichst.'
    },
    privacyPolicy: {
      title: 'Datenschutzerklärung',
      lede: 'Welche Daten Logigator verarbeitet, warum das geschieht und welche Rechte dir in Bezug auf diese Daten zustehen.'
    },
    notFound: {
      title: 'Seite nicht gefunden',
      text: 'Die angegebene Seite konnte nicht gefunden werden.',
      back: 'Zur Startseite'
    }
  }
};

export default de;
