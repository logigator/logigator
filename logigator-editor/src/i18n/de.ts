import type { WorkMode } from '../app/work-mode/work-mode.enum';
import type { ShortcutActionEnum } from '../app/shortcuts/shortcut-action.enum';
import type { ComponentCategory } from '../app/components/component-category.enum';
import type { TranslationSchema } from '../app/translation/translation-schema.model';

const de: TranslationSchema = {
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    untitled: 'Unbenannt'
  },
  user: {
    loadFailed:
      'Benutzerdaten konnten nicht geladen werden. Bitte melde dich erneut an.'
  },
  userSettings: {
    notSignedIn: 'Nicht angemeldet',
    theme: 'Design',
    language: 'Sprache',
    editorSettings: 'Editor-Einstellungen',
    account: 'Account',
    logOut: 'Abmelden',
    logIn: 'Anmelden'
  },
  theming: {
    light: 'Hell',
    dark: 'Dunkel'
  },
  hexEditor: {
    wordView: 'Wörter',
    byteView: 'Bytes',
    hex: 'Hex',
    decimal: 'Dezimal',
    octal: 'Oktal',
    binary: 'Binär',
    address: 'Adr',
    goto: 'Zu Adresse springen',
    gotoPlaceholder: 'Adresse…',
    activeAddress: 'Adresse',
    value: 'Wert',
    noActiveCell: 'Keine Zelle ausgewählt',
    clear: 'Leeren',
    copy: 'Kopieren',
    follow: 'Folgen',
    clearConfirm: 'Gesamten Speicherinhalt leeren?',
    copyFailed: 'Konnte nicht in die Zwischenablage kopieren.'
  },
  settings: {
    options: {
      fpsCounter: 'FPS-Anzeige',
      showGrid: 'Raster anzeigen',
      autoStartSimulation: 'Simulation automatisch starten'
    }
  },
  minimap: {
    expand: 'Minimap anzeigen',
    collapse: 'Minimap ausblenden'
  },
  components: {
    category: {
      hidden: 'Versteckt',
      basic: 'Grundlegend',
      advanced: 'Fortgeschritten',
      io: 'Ein- / Ausgänge',
      port: 'Anschlüsse',
      user: 'Benutzerdefiniert'
    } satisfies Record<ComponentCategory, string>,
    def: {
      NOT: {
        name: 'NICHT-Gatter',
        description:
          'Ein NICHT-Gatter ist ein digitales Logikgatter, das die logische Negation umsetzt. Es verhält sich gemäß der rechts gezeigten Wahrheitstabelle. Ein HIGH-Ausgang (1) ergibt sich, wenn die Eingänge nicht gleich sind. Ist der Eingang LOW (0), ist der Ausgang HIGH (1).'
      },
      AND: {
        name: 'UND-Gatter',
        description:
          'Ein UND-Gatter ist ein digitales Logikgatter, das die logische Konjunktion umsetzt. Es verhält sich gemäß der rechts gezeigten Wahrheitstabelle. Ein HIGH-Ausgang (1) ergibt sich nur, wenn beide Eingänge des UND-Gatters HIGH (1) sind. Ist keiner oder nur einer der Eingänge HIGH, ergibt sich ein LOW-Ausgang.'
      },
      OR: {
        name: 'ODER-Gatter',
        description:
          'Ein ODER-Gatter ist ein digitales Logikgatter, das die logische Disjunktion umsetzt. Ein HIGH-Ausgang (1) ergibt sich, wenn mindestens ein Eingang des ODER-Gatters HIGH (1) ist. Nur wenn jeder Eingang LOW (0) ist, ergibt sich ein LOW-Ausgang.'
      },
      XOR: {
        name: 'XOR-Gatter',
        description:
          'Ein XOR-Gatter ist ein digitales Logikgatter, das die exklusive Disjunktion umsetzt. Ein HIGH-Ausgang (1) ergibt sich, wenn eine ungerade Anzahl an Eingängen des XOR-Gatters HIGH (1) ist.'
      },
      DELAY: {
        name: 'Durchpass',
        description:
          'Ein Puffer, der seinen Eingang unverändert durchreicht und dem Signal einen Simulations-Tick Verzögerung hinzufügt.'
      },
      CLOCK: {
        name: 'Taktgeber',
        description:
          'Gibt periodisch einen ein Tick langen Puls an seinem Ausgang aus. Die Verzögerung zwischen den Pulsen ist einstellbar; ein HIGH am STP-Eingang pausiert den Taktgeber.',
        options: {
          speed: 'Verzögerung'
        }
      },
      TUNNEL: {
        name: 'Tunnel',
        description:
          'Funktioniert wie eine Leitung, aber drahtlos: Alle Tunnel mit derselben Beschriftung sind elektrisch verbunden.'
      },
      HALF_ADDER: {
        name: 'Halbaddierer',
        description:
          'Addiert zwei 1-Bit-Zahlen. S führt das Summenbit und C das Übertragsbit.'
      },
      FULL_ADDER: {
        name: 'Volladdierer',
        description:
          'Addiert drei 1-Bit-Zahlen (zwei Summanden und einen Übertrag-Eingang). S führt das Summenbit und C das Übertragsbit.'
      },
      ROM: {
        name: 'ROM',
        description:
          'Ein Festwertspeicher (ROM) ist eine Art nichtflüchtiger Speicher, der in Computern und anderen elektronischen Geräten verwendet wird. Im ROM gespeicherte Daten können nach der Herstellung des Speicherbausteins nicht mehr elektronisch verändert werden.',
        options: {
          wordSize: 'Wortbreite',
          addressSize: 'Adressgröße',
          data: 'Inhalt bearbeiten',
          dataEditorTitle: 'ROM-Inhalt bearbeiten'
        }
      },
      D_FF: {
        name: 'D-Flip-Flop',
        description:
          'Speichert ein Bit Zustand. Der Zustand an D wird bei der steigenden Flanke von CLK gespeichert; Q führt den Zustand und !Q dessen Inverses.'
      },
      JK_FF: {
        name: 'JK-Flip-Flop',
        description:
          'Speichert ein Bit Zustand. Bei der steigenden Flanke von CLK setzt ein HIGH an J den Zustand und ein HIGH an K setzt ihn zurück; sind beide HIGH, wird umgeschaltet. Q führt den Zustand und !Q dessen Inverses.'
      },
      SR_FF: {
        name: 'SR-Flip-Flop',
        description:
          'Speichert ein Bit Zustand. Bei der steigenden Flanke von CLK setzt ein HIGH an S den Zustand und ein HIGH an R setzt ihn zurück. Q führt den Zustand und !Q dessen Inverses.'
      },
      RNG: {
        name: 'Zufallsgenerator',
        description:
          'Erzeugt bei jeder steigenden Flanke von CLK zufällige Daten an seinen Ausgängen.'
      },
      RAM: {
        name: 'RAM',
        description:
          'Speicher mit wahlfreiem Zugriff. Bei der steigenden Flanke von CLK liest er das adressierte Wort an die Ausgänge — oder speichert, solange WE HIGH ist, stattdessen das an den Dateneingängen anliegende Wort an der aktuellen Adresse.',
        options: {
          wordSize: 'Wortbreite',
          addressSize: 'Adressgröße'
        }
      },
      DECODER: {
        name: 'Dekodierer',
        description:
          '1-aus-n-Binärdekodierer. Treibt genau den einen Ausgang, dessen Index dem Binärwert an den Eingängen entspricht.'
      },
      ENCODER: {
        name: 'Enkodierer',
        description:
          '2^n-auf-n-Binärenkodierer. Gibt den Binärindex des höchsten aktiven Eingangs aus.'
      },
      MUX: {
        name: 'Multiplexer',
        description:
          'Leitet den durch die Auswahlleitungen adressierten Dateneingang an den einzelnen Ausgang.',
        options: {
          selectLines: 'Auswahlleitungen'
        }
      },
      DEMUX: {
        name: 'Demultiplexer',
        description:
          'Leitet den Dateneingang I an den durch die Auswahlleitungen adressierten Ausgang.',
        options: {
          selectLines: 'Auswahlleitungen'
        }
      },
      TEXT: {
        name: 'Text',
        description:
          'Eine Textnotiz, die auf der Arbeitsfläche platziert wird. Der Punkt markiert den Ankerpunkt der Beschriftung.',
        options: {
          text: 'Text bearbeiten',
          placeholder: 'Text eingeben...',
          fontSize: 'Schriftgröße'
        }
      },
      INPUT: {
        name: 'Eingang',
        description:
          'Ein Eingangsstecker. Definiert einen der Eingangsanschlüsse einer benutzerdefinierten Komponente; seine Beschriftung benennt den Anschluss und seine Reihenfolge bestimmt die Anschlussposition.'
      },
      OUTPUT: {
        name: 'Ausgang',
        description:
          'Ein Ausgangsstecker. Definiert einen der Ausgangsanschlüsse einer benutzerdefinierten Komponente; seine Beschriftung benennt den Anschluss und seine Reihenfolge bestimmt die Anschlussposition.'
      },
      BUTTON: {
        name: 'Taster',
        description:
          'Ein Taster (Momentschalter). Während die Simulation läuft, sendet ein Klick einen einzelnen Puls an seinem Ausgang.'
      },
      SWITCH: {
        name: 'Schalter',
        description:
          'Ein rastender Schalter. Während die Simulation läuft, schaltet ein Klick seinen Ausgang zwischen an und aus um.'
      },
      LED: {
        name: 'LED',
        description:
          'Leuchtet, solange die an seinen Eingang angeschlossene Leitung unter Strom steht.'
      },
      SEGMENT_DISPLAY: {
        name: 'Segment Display',
        description:
          'Stellt den Binärwert an seinen Eingängen (Eingang 0 ist das niederwertigste Bit) als Zahl in der eingestellten Basis dar.',
        options: {
          base: 'Basis'
        }
      },
      LED_MATRIX: {
        name: 'LED-Matrix',
        description:
          'Ein quadratisches Raster aus LEDs, das ein Bild anzeigt. Bei der steigenden Flanke von CLK werden die Dateneingänge in die durch die Adresseingänge adressierte Zeile übernommen.',
        options: {
          size: 'Breite/Höhe'
        }
      }
    },
    options: {
      direction: 'Richtung',
      inputs: 'Eingänge',
      outputs: 'Ausgänge',
      label: 'Beschriftung',
      index: 'Index'
    }
  },
  sideBar: {
    title: 'Komponenten',
    search: 'Suchen..'
  },
  tabBar: {
    mainProject: 'Hauptprojekt',
    close: 'Schließen'
  },
  portsPanel: {
    title: 'Anschlüsse',
    badge: 'Komponente',
    inputs: 'Eingänge',
    outputs: 'Ausgänge',
    noInputs: 'Keine Eingangsstecker',
    noOutputs: 'Keine Ausgangsstecker'
  },
  statusBar: {
    modes: {
      pan: 'Schwenken: ziehen, um die Arbeitsfläche zu verschieben · scrollen oder mit zwei Fingern zoomen',
      wireTool:
        'Leitungswerkzeug: ziehen zum Zeichnen · auf einen Anschluss tippen zum Negieren · auf eine Kreuzung tippen zum Verbinden/Trennen',
      sel: 'Auswählen: Auswahlrahmen ziehen zum Selektieren · Auswahl ziehen zum Verschieben · {{scissorKey}} halten zum Schneiden von Leitungen',
      selExact:
        'Schneide-Auswahl: Auswahlrahmen ziehen zum Selektieren · Leitungen werden an seiner Kante geschnitten',
      erase:
        'Radiergummi: auf Elemente klicken oder darüberziehen, um sie zu löschen',
      placeComp:
        '{{componentName}} platzieren: ziehen zum Positionieren · Esc zum Abbrechen',
      simulation:
        'Simulation: auf Taster und Schalter klicken · ziehen zum Schwenken'
    } satisfies Record<WorkMode, string>,
    saved: 'Gespeichert',
    unsaved: 'Ungespeicherte Änderungen',
    selected: 'Ausgewählt'
  },
  titleBar: {
    menuBar: {
      file: {
        label: 'Datei',
        items: {
          newProject: {
            label: 'Neues Projekt'
          },
          newComponent: {
            label: 'Neue Komponente'
          },
          open: {
            label: 'Öffnen'
          },
          save: {
            label: 'Speichern'
          },
          uploadCloud: {
            label: 'In die Cloud hochladen'
          },
          share: {
            label: 'Teilen'
          },
          cloneShare: {
            label: 'In meine Projekte klonen'
          },
          exportFile: {
            label: 'Als Datei exportieren'
          },
          generateImage: {
            label: 'Bild generieren'
          }
        }
      },
      edit: {
        label: 'Bearbeiten',
        items: {
          undo: {
            label: 'Rückgängig'
          },
          redo: {
            label: 'Wiederholen'
          },
          cut: {
            label: 'Ausschneiden'
          },
          copy: {
            label: 'Kopieren'
          },
          paste: {
            label: 'Einfügen'
          },
          delete: {
            label: 'Löschen'
          },
          repairWires: {
            label: 'Leitungen reparieren'
          }
        }
      },
      view: {
        label: 'Ansicht',
        items: {
          zoomIn: {
            label: 'Einzoomen'
          },
          zoomOut: {
            label: 'Auszoomen'
          },
          zoom100: {
            label: 'Zoom 100%'
          }
        }
      },
      help: {
        label: 'Hilfe',
        items: {
          documentation: {
            label: 'Dokumentation'
          },
          changelog: {
            label: 'Neuigkeiten'
          },
          cookieSettings: {
            label: 'Cookie-Einstellungen'
          },
          about: {
            label: 'Über'
          }
        }
      }
    },
    rename: {
      label: 'Projekt umbenennen',
      cancel: 'Abbrechen',
      error: 'Das Projekt konnte nicht umbenannt werden.'
    },
    fork: {
      label: 'Fork',
      title: 'Fork von {{lineage}}',
      lineageEntry: '{{name}} von {{author}}'
    }
  },
  discardChanges: {
    header: 'Änderungen verwerfen?',
    message:
      'Das aktuelle Projekt hat ungespeicherte Änderungen, die verloren gehen. Trotzdem fortfahren?',
    accept: 'Verwerfen',
    reject: 'Abbrechen'
  },
  changelogDialog: {
    header: 'Neuigkeiten',
    loading: 'Änderungsprotokoll wird geladen…',
    loadError: 'Das Änderungsprotokoll konnte nicht geladen werden.',
    close: 'Schließen'
  },
  documentation: {
    header: 'Dokumentation',
    loading: 'Seite wird geladen…',
    loadError: 'Diese Seite konnte nicht geladen werden.',
    back: 'Alle Themen',
    learnMore: 'Mehr erfahren',
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
  aboutDialog: {
    header: 'Über Logigator',
    tagline:
      'Ein Open-Source-Editor und -Simulator für digitale Logikschaltungen.',
    version: 'Version',
    commit: 'Commit',
    buildDate: 'Build-Datum',
    license: 'Lizenz',
    licenseName: 'GNU AGPL v3',
    copyright: '© 2019–{{year}} Logigator',
    repository: 'Repository',
    privacyPolicy: 'Datenschutzerklärung',
    imprint: 'Impressum',
    close: 'Schließen'
  },
  openProjectDialog: {
    title: 'Projekt öffnen',
    localProjects: 'Lokale Projekte',
    cloudProjects: 'Cloud-Projekte',
    fromFile: 'Aus Datei',
    notLoggedIn: 'Melde dich an, um deine Cloud-Projekte zu sehen',
    close: 'Schließen',
    loading: 'Wird geladen...',
    uploadPrompt: 'Öffne eine auf deinem Gerät gespeicherte Schaltungsdatei.',
    chooseFile: 'Datei auswählen',
    deleteProject: 'Projekt löschen',
    renameProject: 'Projekt umbenennen',
    uploadProject: 'In die Cloud hochladen',
    shareProject: 'Teilen',
    cancelRename: 'Abbrechen',
    deleteConfirmMessage:
      'Möchtest du "{{name}}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.',
    deleteAccept: 'Löschen',
    deleteReject: 'Abbrechen',
    searchPlaceholder: 'Projekte suchen...',
    searchButton: 'Suchen',
    noSearchResults: 'Keine Projekte gefunden',
    lastEdited: 'Zuletzt bearbeitet',
    errors: {
      listLocal: 'Deine lokalen Projekte konnten nicht geladen werden.',
      openLocal: 'Das lokale Projekt konnte nicht geöffnet werden.',
      deleteLocal: 'Das lokale Projekt konnte nicht gelöscht werden.',
      renameLocal: 'Das lokale Projekt konnte nicht umbenannt werden.',
      listCloud: 'Deine Cloud-Projekte konnten nicht geladen werden.',
      openCloud: 'Das Cloud-Projekt konnte nicht geöffnet werden.',
      deleteCloud: 'Das Cloud-Projekt konnte nicht gelöscht werden.',
      renameCloud: 'Das Cloud-Projekt konnte nicht umbenannt werden.',
      importFailed: 'Die Datei konnte nicht importiert werden: {{detail}}',
      readFailed: 'Die ausgewählte Datei konnte nicht gelesen werden.'
    }
  },
  saveProjectDialog: {
    name: 'Name',
    destination: 'Speicherort',
    destinationCloud: 'Cloud',
    destinationLocal: 'Lokal',
    notLoggedIn:
      'Du musst angemeldet sein, um Projekte in der Cloud zu speichern.',
    public: 'Öffentlich',
    publicInfo:
      'Öffentliche Projekte werden auf deinem Profil veröffentlicht und sind über einen Freigabelink für alle zugänglich. Private Projekte sind nur für dich sichtbar.',
    localWarning:
      'Lokale Projekte werden nicht geräteübergreifend gespeichert und können verloren gehen.'
  },
  newComponentDialog: {
    name: 'Name',
    symbol: 'Symbol',
    description: 'Beschreibung',
    store: 'Speicherort',
    storeCloud: 'Cloud',
    storeLocal: 'Lokal',
    notLoggedIn:
      'Du musst angemeldet sein, um Komponenten in der Cloud zu speichern.',
    public: 'Öffentlich',
    publicInfo:
      'Öffentliche Komponenten werden auf deinem Profil veröffentlicht und sind über einen Freigabelink für alle zugänglich. Private Komponenten sind nur für dich sichtbar.',
    localWarning:
      'Lokale Komponenten werden nicht geräteübergreifend gespeichert und können verloren gehen.',
    create: 'Erstellen'
  },
  uploadComponent: {
    button: 'In die Cloud hochladen',
    signInTooltip: 'Melde dich an, um in die Cloud hochzuladen'
  },
  shareDialog: {
    header: 'Projekt teilen',
    headerComponent: 'Komponente teilen',
    intro:
      'Jeder mit diesem Link kann „{{name}}“ schreibgeschützt öffnen und in seine eigene Bibliothek klonen.',
    linkLabel: 'Freigabelink',
    copy: 'Link kopieren',
    linkCopied: 'Freigabelink in die Zwischenablage kopiert.',
    copyFailed: 'Der Link konnte nicht in die Zwischenablage kopiert werden.',
    regenerate: 'Link neu generieren',
    regenerateWarning:
      'Beim Neu-Generieren entsteht ein neuer Link und der aktuelle wird dauerhaft ungültig — wer den alten Link nutzt, verliert den Zugriff.',
    linkRegenerated: 'Ein neuer Freigabelink wurde generiert.',
    regenerateFailed: 'Der Freigabelink konnte nicht neu generiert werden.',
    public: 'Öffentlich',
    publicInfoProject:
      'Öffentliche Projekte werden auf deinem Profil veröffentlicht und sind für alle auffindbar. Private Projekte sind nur über den Freigabelink erreichbar.',
    publicInfoComponent:
      'Öffentliche Komponenten werden auf deinem Profil veröffentlicht und sind für alle auffindbar. Private Komponenten sind nur über den Freigabelink erreichbar.',
    visibilityUpdated: 'Sichtbarkeit aktualisiert.',
    visibilityFailed: 'Die Sichtbarkeit konnte nicht aktualisiert werden.',
    close: 'Schließen'
  },
  shareComponent: {
    button: 'Teilen'
  },
  deleteComponent: {
    button: 'Löschen',
    confirmMessageLocal:
      'Möchtest du „{{name}}“ aus deiner Bibliothek löschen? Das ist endgültig. Bereits platzierte Instanzen bleiben als eingebettete Kopien erhalten, die du später wiederherstellen kannst.',
    confirmMessageCloud:
      'Möchtest du „{{name}}“ aus deiner Cloud-Bibliothek löschen? Das ist endgültig und ihr Freigabelink funktioniert nicht mehr. Bereits platzierte Instanzen bleiben als eingebettete Kopien erhalten, die du später wiederherstellen kannst.',
    confirmAccept: 'Löschen',
    confirmReject: 'Abbrechen',
    deleted: '„{{name}}“ wurde aus deiner Bibliothek gelöscht.',
    deleteFailed: 'Die Komponente konnte nicht gelöscht werden.'
  },
  uploadDialog: {
    header: 'In die Cloud hochladen',
    introProject:
      '„{{name}}“ wird aus dem lokalen Speicher in deine Cloud-Bibliothek verschoben, sodass du von jedem Gerät darauf zugreifen kannst.',
    introComponent:
      '„{{name}}“ wird aus deiner lokalen Bibliothek in deine Cloud-Bibliothek verschoben, sodass du sie von jedem Gerät nutzen kannst.',
    introDraft:
      '„{{name}}“ bettet diese lokalen Komponenten ein. Sie werden gemeinsam damit in deine Cloud-Bibliothek hochgeladen.',
    depsTitle: 'Diese lokalen Komponenten werden ebenfalls veröffentlicht',
    depsHint:
      'Ein Cloud-Projekt kann nur Cloud-Komponenten enthalten, daher wird jede davon zuerst in deine Cloud-Bibliothek hochgeladen und dann referenziert.',
    unresolvableWarning:
      '{{count}} eingebettete Komponente(n) können nicht mehr veröffentlicht werden (ihr Bibliothekseintrag fehlt) und bleiben einfache eingebettete Kopien.',
    public: 'Öffentlich',
    publicInfoProject:
      'Öffentliche Projekte werden auf deinem Profil veröffentlicht und sind über einen Freigabelink für alle zugänglich. Private Projekte sind nur für dich sichtbar.',
    publicInfoComponent:
      'Öffentliche Komponenten werden auf deinem Profil veröffentlicht und sind über einen Freigabelink für alle zugänglich. Private Komponenten sind nur für dich sichtbar.',
    notLoggedIn: 'Du musst angemeldet sein, um in die Cloud hochzuladen.',
    cancel: 'Abbrechen',
    upload: 'Hochladen',
    analyzeFailed: 'Die Schaltung konnte für den Upload nicht gelesen werden.',
    dependencyFailed:
      'Die Komponente „{{name}}“ konnte nicht hochgeladen werden. Es wurde nichts weiter hochgeladen — versuche es erneut.',
    uploadFailed: '„{{name}}“ konnte nicht in die Cloud hochgeladen werden.'
  },
  closeTab: {
    header: 'Ungespeicherte Änderungen',
    message:
      '„{{name}}“ hat ungespeicherte Änderungen. Vor dem Schließen speichern?',
    promotionWarning:
      'Beim Speichern werden außerdem {{count}} lokale Komponente(n) in deine Cloud-Bibliothek veröffentlicht.',
    save: 'Speichern',
    discard: 'Verwerfen',
    cancel: 'Abbrechen'
  },
  sourceIndicator: {
    cloudTitle: 'In deiner Cloud-Bibliothek gespeichert',
    localTitle: 'Nur in diesem Browser gespeichert',
    draftTitle: 'Noch nicht gespeichert — speichere es in der Cloud oder lokal',
    shareTitle: 'Über einen Freigabelink geöffnet — schreibgeschützt',
    label: {
      server: 'Cloud',
      browser: 'Lokal',
      draft: 'Entwurf',
      share: 'Geteilt',
      embedded: 'Eingebettet'
    },
    title: {
      server: 'In deiner Cloud-Bibliothek gespeichert',
      browser: 'Nur in diesem Browser gespeichert',
      draft: 'Noch nicht gespeichert',
      share: 'Über einen Freigabelink geöffnet',
      embedded:
        'Eingebettete Kopie — ihre Bibliothekskomponente ist nicht mehr verfügbar'
    }
  },
  toolBar: {
    save: 'Speichern',
    open: 'Öffnen',
    newComp: 'Neue Komponente',
    copy: 'Kopieren',
    cut: 'Ausschneiden',
    paste: 'Einfügen',
    delete: 'Löschen',
    rotateCw: 'Im Uhrzeigersinn drehen',
    rotateCcw: 'Gegen den Uhrzeigersinn drehen',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    zoomOut: 'Auszoomen',
    zoomIn: 'Einzoomen',
    pan: 'Schwenken',
    parts: 'Bauteile',
    placeComponent: 'Komponente platzieren',

    wireTool: 'Leitungswerkzeug',
    select: 'Auswählen',
    selExact: 'Leitungen an der Auswahlkante schneiden (zum Aktivieren halten)',
    selExactShort: 'Leitungen schneiden',
    eraser: 'Radiergummi',
    text: 'Text',
    startSim: 'Simulation starten',
    exitSim: 'Simulation verlassen',
    play: 'Start',
    pause: 'Pause',
    step: 'Einzelschritt',
    stopSim: 'Stopp',
    targetSpeed: 'Zielfrequenz',
    targetUnit: 'Einheit der Zielfrequenz',
    targetMode: 'Auf Zielfrequenz begrenzen',
    syncToFrame: 'Mit Bildrate synchronisieren',
    measuredHz: '{{hz}}Hz',
    ticks: '{{ticks}} Ticks'
  },
  mobile: {
    account: 'Account',
    palette: 'Komponenten',
    settings: 'Einstellungen',
    ports: 'Anschlüsse'
  },
  logging: {
    error: 'Fehler',
    warn: 'Warnung',
    success: 'Erfolg',
    info: 'Info',
    debug: 'Debug',
    unexpectedError:
      'Etwas ist schiefgelaufen. Einige Aktionen wurden möglicherweise nicht abgeschlossen — Details findest du in der Browser-Konsole.'
  },
  clipboard: {
    pastePartial:
      'Einige Elemente konnten nicht eingefügt werden — ihr Komponententyp ist nicht mehr verfügbar.',
    pastePlugsSkipped:
      'Ein- und Ausgangsstecker wurden nicht eingefügt — sie werden nur innerhalb benutzerdefinierter Komponenten unterstützt.'
  },
  wireRepair: {
    repaired: '{{count}} Leitungsproblem(e) behoben.',
    loadRepaired:
      'Diese Schaltung hatte {{count}} Leitungsproblem(e) — sie wurden automatisch behoben.',
    clean: 'Keine Leitungsprobleme gefunden.'
  },
  bugReport: {
    title: 'Problem melden',
    badgeTooltip: 'Fehler melden',
    intro:
      'Einen Fehler gefunden? Beschreibe, was du getan hast, als er auftrat — je mehr Details, desto einfacher lässt er sich beheben.',
    errorIntro:
      'Ein unerwarteter Fehler ist aufgetreten. Sag uns, was du getan hast, damit wir ihn eingrenzen können.',
    errorDetails: 'Fehlerdetails',
    placeholder: 'Was ist passiert?',
    dataNotice:
      'Dein aktuelles Projekt, Browser-Details und die jüngste Aktivität werden angehängt, damit wir das Problem nachvollziehen können.',
    send: 'Bericht senden',
    cancel: 'Abbrechen',
    sent: 'Danke — dein Bericht wurde gesendet.',
    failed:
      'Der Bericht konnte nicht gesendet werden. Bitte versuche es erneut.'
  },
  persistence: {
    legacyProjectWarning:
      'Dieses Projekt wurde mit dem alten Editor erstellt. Beim Speichern hier wird es in das neue Format umgewandelt — wird es danach wieder im alten Editor geöffnet, können benutzerdefinierte Komponenten fehlen oder falsch dargestellt werden.',
    projectSaved: 'Projekt gespeichert.',
    projectSavedLocal: 'Projekt im lokalen Speicher gespeichert.',
    componentSaved: 'Komponente gespeichert.',
    componentSavedLocal: 'Komponente im lokalen Speicher gespeichert.',
    componentUploaded: 'Komponente in deine Cloud-Bibliothek hochgeladen.',
    projectUploaded: 'Projekt in deine Cloud-Bibliothek hochgeladen.',
    projectCreated: 'Projekt erstellt.',
    projectExported: 'Projekt als Datei exportiert.',
    exportFailed: 'Das Projekt konnte nicht als Datei exportiert werden.',
    localSaveFailed:
      'Das Projekt konnte nicht im lokalen Speicher gespeichert werden.',
    localComponentSaveFailed:
      'Die Komponente konnte nicht im lokalen Speicher gespeichert werden.',
    saveFailed: 'Speichern fehlgeschlagen: {{detail}}',
    saveFailedGeneric: 'Das Projekt konnte nicht gespeichert werden.',
    createFailed: 'Das Projekt konnte nicht erstellt werden: {{detail}}',
    versionMismatch:
      'Dieses Projekt wurde anderswo geändert — lade neu, bevor du erneut speicherst.',
    loadFailed: 'Das Projekt konnte nicht geladen werden.',
    componentLoadFailed: 'Die Komponente konnte nicht geladen werden.',
    shareLoadFailed: 'Das geteilte Projekt konnte nicht geladen werden.',
    shareAuthRequired:
      'Melde dich an, um dieses geteilte Projekt zu deiner Cloud-Bibliothek hinzuzufügen.',
    shareCloned: 'Geteiltes Projekt in deine Cloud-Projekte geklont.',
    shareCloneFailed: 'Das geteilte Projekt konnte nicht geklont werden.',
    dumpElementCountChanged:
      'Die Elementanzahl des Projekt-Dumps hat sich beim Laden geändert — IDs und Aktionsverlauf wurden nicht wiederhergestellt.',
    skippedCustomOne:
      'Eine benutzerdefinierte Komponente konnte nicht geladen werden — ihre Definition fehlt — und wurde übersprungen.',
    skippedCustomMany:
      '{{count}} benutzerdefinierte Komponenten konnten nicht geladen werden — ihre Definitionen fehlen — und wurden übersprungen.'
  },
  editor: {
    rendererInitFailed:
      'Der Grafik-Renderer konnte nicht gestartet werden. Dein Browser oder deine GPU wird möglicherweise nicht unterstützt.',
    fontLoadFailed:
      'Die Editor-Schriftarten konnten nicht geladen werden — einige Beschriftungen sehen möglicherweise falsch aus.',
    eraseRestoreFailed:
      'Einige gelöschte Komponenten konnten nicht wiederhergestellt werden.',
    circularDependency:
      'Diese Komponente kann hier nicht platziert werden — es würde eine zirkuläre Abhängigkeit entstehen.'
  },
  simulation: {
    workerMessageUnreadable:
      'Der Simulations-Worker hat eine unlesbare Nachricht gesendet. Simulation gestoppt.',
    engineInitFailed:
      'Die Simulations-Engine konnte nicht gestartet werden. Dein Browser unterstützt möglicherweise kein WebAssembly.',
    workerCrashed: 'Die Simulation wurde unerwartet beendet.',
    unsupportedComponent:
      'Die Komponente "{{symbol}}" wird vom Simulator nicht unterstützt.',
    recursiveComponent:
      'Die benutzerdefinierte Komponente "{{name}}" platziert sich rekursiv selbst.',
    componentNoCircuit:
      'Die benutzerdefinierte Komponente "{{name}}" hat keine Schaltung zum Simulieren.',
    plugMismatch:
      'Die benutzerdefinierte Komponente "{{name}}" deklariert {{declaredInputs}}/{{declaredOutputs}} Anschlüsse, aber ihre Schaltung hat {{actualInputs}}/{{actualOutputs}} Stecker.'
  },
  watch: {
    rendererFailed:
      'Die Beobachtungsansicht konnte nicht geöffnet werden — der Renderer ließ sich nicht starten.',
    noInnerCircuit:
      'Diese Komponente hat keine innere Schaltung zum Inspizieren.',
    circuitMismatch:
      'Die innere Schaltung stimmt nicht mit der kompilierten Simulation überein — starte die Simulation neu, um sie zu inspizieren.'
  },
  componentActions: {
    edit: 'Schaltung bearbeiten',
    update: 'Auf neueste Version aktualisieren',
    createFailed: 'Die Komponente konnte nicht erstellt werden.',
    openFailed: 'Die Komponente konnte nicht geöffnet werden.',
    cloudLoadFailed:
      'Die Komponente konnte nicht aus der Cloud geladen werden.',
    restore: 'Wiederherstellen & bearbeiten',
    restoreTooltip:
      'Das Bibliotheksoriginal dieser Komponente fehlt, aber ihre Schaltung ist eingebettet. Stelle sie in deiner lokalen Bibliothek wieder her, um sie zu bearbeiten.',
    restored: 'Komponente in deiner lokalen Bibliothek wiederhergestellt.',
    restoreFailed: 'Diese Komponente konnte nicht wiederhergestellt werden.',
    signInToEdit: 'Zum Bearbeiten anmelden',
    signInTooltip:
      'Diese Komponente liegt in deiner Cloud-Bibliothek. Melde dich an, um sie zu laden und zu bearbeiten.'
  },
  editComponentDetails: {
    button: 'Details bearbeiten',
    header: 'Komponentendetails bearbeiten',
    name: 'Name',
    symbol: 'Symbol',
    description: 'Beschreibung',
    frozenInstancesHint:
      'Bereits platzierte Instanzen behalten ihre aktuellen Details; nutze „Auf neueste Version aktualisieren“ bei einer ausgewählten Instanz, um sie zu übernehmen.',
    save: 'Speichern',
    saved: 'Komponentendetails aktualisiert.',
    saveFailed: 'Die Komponentendetails konnten nicht aktualisiert werden.'
  },
  library: {
    loadFailed: 'Einige gespeicherte Komponenten konnten nicht geladen werden.'
  },
  logoutDialog: {
    header: 'Ungespeicherte Änderungen',
    message:
      'Diese Cloud-Dokumente haben ungespeicherte Änderungen. Vor dem Abmelden speichern?',
    promotionWarning:
      'Beim Speichern werden außerdem {{count}} lokale Komponente(n) in deine Cloud-Bibliothek veröffentlicht.',
    save: 'Speichern & Abmelden',
    discard: 'Ohne Speichern abmelden',
    cancel: 'Abbrechen',
    edited: 'Bearbeitet {{relative}}'
  },
  session: {
    loggedOut: 'Abgemeldet.',
    logoutFailed: 'Abmelden fehlgeschlagen. Bitte versuche es erneut.',
    saveLoggedOut:
      'Du bist abgemeldet. Melde dich erneut an, um in der Cloud zu speichern.',
    saveForeign:
      '„{{name}}“ gehört zu einem anderen Account und kann nicht gespeichert werden.'
  },
  routing: {
    notFound: 'Dieser Link konnte nicht geöffnet werden.'
  },
  imageExport: {
    title: 'Bild exportieren',
    project: 'Projekt',
    format: 'Format',
    resolution: 'Auflösung',
    background: 'Hintergrund',
    backgroundHint: 'Design-Farbe und Raster',
    quality: 'Qualität',
    dimensions: '{{width}} × {{height}} px',
    clampedHint: '(reduziert, um Gerätegrenzen einzuhalten)',
    export: 'Exportieren',
    cancel: 'Abbrechen',
    success: 'Bild exportiert.',
    error: {
      unavailable:
        'Der Editor ist noch nicht bereit. Versuche es gleich noch einmal.',
      failed: 'Bildexport fehlgeschlagen.'
    },
    warn: {
      clamped:
        'Auflösung reduziert, um Gerätegrenzen einzuhalten; exportiert mit {{width}} × {{height}} px.'
    }
  },
  shortcuts: {
    title: 'Tastaturbefehle',
    actions: {
      save: 'Speichern',
      open: 'Öffnen',
      newComponent: 'Neue Komponente',
      undo: 'Rückgängig',
      redo: 'Wiederholen',
      copy: 'Kopieren',
      cut: 'Ausschneiden',
      paste: 'Einfügen',
      delete: 'Löschen',
      rotateSelection: 'Im Uhrzeigersinn drehen',
      rotateSelectionCcw: 'Gegen den Uhrzeigersinn drehen',
      moveSelectionUp: 'Auswahl nach oben verschieben',
      moveSelectionDown: 'Auswahl nach unten verschieben',
      moveSelectionLeft: 'Auswahl nach links verschieben',
      moveSelectionRight: 'Auswahl nach rechts verschieben',
      zoomIn: 'Einzoomen',
      zoomOut: 'Auszoomen',
      zoom100: 'Zoom 100%',
      toolPan: 'Schwenken',
      toolWire: 'Leitungswerkzeug',
      toolSelect: 'Auswählen',
      selectScissor: 'Leitungen an der Auswahlkante schneiden (halten)',
      toolErase: 'Radieren',
      toolPlaceText: 'Text platzieren',
      toggleSimulation: 'Simulation starten/stoppen',
      cancel: 'Abbrechen'
    } satisfies Record<ShortcutActionEnum, string>,
    groups: {
      fileOps: 'Datei',
      editOps: 'Bearbeiten',
      viewOps: 'Ansicht',
      tools: 'Werkzeuge',
      interaction: 'Interaktion'
    },
    manager: {
      resetAll: 'Alle zurücksetzen',
      reset: 'Zurücksetzen',
      unassign: 'Zuweisung aufheben',
      edit: 'Tastenkürzel bearbeiten',
      recordPrompt: 'Tasten drücken…'
    },
    toast: {
      reassignedFrom: 'Tastenkürzel von „{{action}}“ entfernt',
      loadFailed:
        'Konfigurierte Tastenkürzel konnten nicht geladen werden, es werden die Standardwerte verwendet.'
    }
  },
  onboarding: {
    settings: {
      showTips: 'Einführungstipps anzeigen'
    },
    menu: {
      showTipsAgain: 'Tipps erneut anzeigen'
    },
    nudge: {
      text: 'Neu hier? Bau deine erste Schaltung in einem kurzen Tutorial.',
      start: 'Tutorial starten',
      dismiss: 'Ausblenden'
    },
    toast: {
      tipsReset: 'Einführungstipps sind wieder aktiviert.'
    },
    bubble: {
      next: 'Weiter',
      finish: 'Abschließen',
      skip: 'Tutorial überspringen',
      turnOff: 'Alle Tipps deaktivieren'
    },
    hints: {
      dismiss: 'Ausblenden',
      wireTapActions:
        'Ziehen, um Leitungen zu zeichnen. <strong>Tippe auf einen Anschluss</strong>, um eine Negationsblase hinzuzufügen oder zu entfernen, oder tippe auf eine Kreuzung, um Leitungen zu verbinden oder zu trennen.',
      scissorSelectDesktop:
        'Die Schneide-Auswahl schneidet Leitungen an der Rahmenkante. Halte <strong>Alt</strong>, um sie während der Rahmenauswahl umzuschalten.',
      scissorSelectCompact:
        'Die Schneide-Auswahl schneidet Leitungen an der Rahmenkante.',
      eraser: 'Ziehe über etwas, um es zu löschen.',
      simControls:
        'Während des Laufens ist die Bearbeitung gesperrt. Damit kannst du pausieren, schrittweise gehen und die Geschwindigkeit einstellen — Taster und Schalter bleiben klickbar.',
      inspect:
        'Du kannst dies während des Laufens inspizieren — öffne es, um sein Innenleben live zu beobachten.',
      selectionActions:
        'Drehe die Auswahl mit diesen Schaltflächen — oder drücke <strong>R</strong> / <strong>Shift+R</strong>. Verschiebe sie mit den <strong>Pfeiltasten</strong>.',
      pastePlacementDesktop:
        'Die eingefügten Elemente erscheinen als Vorschau — ziehe sie an eine freie Stelle und lass los, um sie abzulegen, oder drücke Esc zum Abbrechen.',
      pastePlacementCompact:
        'Die eingefügten Elemente erscheinen als Vorschau — ziehe sie an eine freie Stelle und hebe den Finger, um sie abzulegen, oder tippe daneben zum Abbrechen.',
      panZoomCompact:
        'Ziehe mit zwei Fingern zum Schwenken, spreize sie zum Zoomen. Mit einem Finger wird nur im Schwenkmodus geschwenkt.'
    },
    tutorials: {
      gettingStarted: {
        steps: {
          welcome: {
            title: 'Willkommen bei Logigator',
            text: 'Lass uns in etwa einer Minute eine funktionierende Schaltung bauen. Du kannst jederzeit überspringen.'
          },
          moveAround: {
            title: 'Navigieren',
            textDesktop:
              'Scrollen zum Zoomen, mit rechter Maustaste ziehen zum Schwenken.',
            textCompact:
              'Spreizen zum Zoomen, mit zwei Fingern ziehen zum Schwenken.'
          },
          placeAnd: {
            title: 'Platziere ein UND-Gatter',
            textDesktop:
              'Finde <strong>UND</strong> in der Komponentenliste links und klicke dann auf die Arbeitsfläche, um es abzulegen.',
            textCompact:
              'Tippe auf <strong>+</strong>, um deine Bausteine zu öffnen, wähle <strong>UND</strong> und tippe dann auf die Arbeitsfläche, um es abzulegen.',
            nudge:
              'Das ist kein UND-Gatter — wähle hierfür <strong>UND</strong> (mit dem Radiergummi kannst du Bauteile entfernen).'
          },
          addSwitches: {
            title: 'Füge zwei Schalter hinzu',
            textDesktop:
              'Platziere nun zwei <strong>Schalter</strong> als Eingänge links vom Gatter. ({{placed}} von {{total}} platziert)',
            textCompact:
              'Tippe auf <strong>+</strong>, wähle einen <strong>Schalter</strong> und tippe dann auf die Arbeitsfläche — platziere zwei links vom Gatter. ({{placed}} von {{total}} platziert)'
          },
          addLed: {
            title: 'Füge eine LED hinzu',
            textDesktop:
              'Platziere eine <strong>LED</strong> rechts — das ist dein Ausgang.',
            textCompact:
              'Tippe auf <strong>+</strong>, wähle die <strong>LED</strong> und tippe dann rechts vom Gatter — das ist dein Ausgang.'
          },
          wireUp: {
            title: 'Verdrahte es',
            text: 'Wechsle zum <strong>Leitungswerkzeug</strong> und ziehe von jedem Schalter zu den Eingängen des Gatters und dann vom Ausgang des Gatters zur LED.'
          },
          startSim: {
            title: 'Starte die Simulation',
            text: 'Drücke <strong>Start</strong>, um deine Schaltung mit Strom zu versorgen. Während sie läuft, ist die Bearbeitung gesperrt.'
          },
          flipSwitch: {
            title: 'Betätige einen Schalter',
            textDesktop:
              'Klicke einen Schalter, um ihn umzuschalten. Schalte <strong>beide</strong> ein und beobachte, wie die LED aufleuchtet.',
            textCompact:
              'Tippe einen Schalter, um ihn umzuschalten. Schalte <strong>beide</strong> ein und beobachte, wie die LED aufleuchtet.'
          },
          complete: {
            title: 'Alles bereit!',
            textDesktop:
              'Du hast ein funktionierendes UND-Gatter gebaut und die LED zum Leuchten gebracht — gut gemacht!<br>Von hier aus kannst du es zu deinem eigenen machen: Füge weitere Komponenten hinzu, verdrahte größere Schaltungen und speichere deine Arbeit, wenn sie dir gefällt.<br><br>Später Hilfe nötig? Im <strong>Hilfe</strong>-Menü findest du dieses Tutorial erneut, die Neuigkeiten und mehr. Viel Spaß beim Bauen!',
            textCompact:
              'Du hast ein funktionierendes UND-Gatter gebaut und die LED zum Leuchten gebracht — gut gemacht!<br>Von hier aus kannst du es zu deinem eigenen machen: Füge weitere Komponenten hinzu, verdrahte größere Schaltungen und speichere deine Arbeit, wenn sie dir gefällt.<br><br>Später Hilfe nötig? Öffne das <strong>Menü</strong> für dieses Tutorial erneut, die Neuigkeiten und mehr. Viel Spaß beim Bauen!'
          }
        }
      }
    }
  }
};

export default de;
