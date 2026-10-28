# Änderungsprotokoll

Alle nennenswerten Änderungen an Logigator werden hier festgehalten. Die
aktuellste Veröffentlichung steht ganz oben.

## [Unreleased]

Die **ganze Website ist neu gebaut**, passend zum Editor, und die Dokumentation
steht jetzt direkt auf der Website. Im Editor zeigen Leitungen widersprüchliche
Signale sofort an, und mit Gamepad, Tastatur und Terminal nehmen deine
Schaltungen während der Simulation Eingaben an und geben Text aus.

### ✨ Hinzugefügt

- **🌐 Ein neu gebautes logigator.com.** Eine frische Startseite und
  überarbeitete Seiten überall, die Dokumentation und das Änderungsprotokoll
  direkt auf der Website, und alle Beispiele neu gemacht, mit fünf neuen, sodass
  jede eingebaute Komponente in mindestens einem vorkommt.
- **🟠 Hervorgehobene Konflikte.** Während der Simulation wird eine Leitung,
  deren Ausgänge sich widersprechen, jetzt orange, sodass sich ein Kurzschluss
  sofort zeigt. Die Leitung zählt weiter als 1, solange mindestens ein Ausgang an
  ihr 1 ist. Das ist standardmäßig an, ein Tipp erklärt es beim ersten Mal,
  und die Einstellung „Konflikte hervorheben“ schaltet es ab.
- **🎮 Gamepad, Tastatur und Terminal.** Spiel eine Schaltung auf einem
  Controller am Bildschirm, mit deinen eigenen Tasten oder einem echten Gamepad,
  auch zu zweit. Tippe live hinein oder füge einen ganzen Text ein, und sieh zu,
  wie sie während der Simulation auf ein Terminal schreibt.
- **🔗 Seiten für geteilte Links.** Ein geteilter Link öffnet eine Seite mit der
  Schaltung, ihrem Autor und ihren Sternen, bereit zum Öffnen im Editor oder als
  eigene Kopie. In einen Chat eingefügt, erscheint er als Karte mit deiner
  Schaltung, und du kannst ihn in andere Seiten einbetten.
- **🔒 Private Projekte und Komponenten.** Neben „Alle mit dem Link“ und „Alle“
  behält „Nur du“ ein Dokument für dich. Sein Link bleibt bei jeder Wahl
  derselbe, sodass du ihn später wieder weitergeben kannst.
- **Mehr zu entdecken in der Community.** Stöbere nach Trend, jetzt die
  Voreinstellung, suche schon beim Tippen, und finde im Profil eines Mitglieds
  eine Beschreibung, eine Website und Links, dazu die Sterne, die seine Arbeiten
  gesammelt haben. Ein veröffentlichtes Projekt oder eine Komponente ohne Inhalt
  bleibt aus den Listen heraus. Namen und Beschreibungen in einer anderen
  Sprache übersetzt du mit einem Klick, und alle Beispiele gibt es in deiner
  Sprache.
- **Beschreibungen mit Formatierung.** Fett, Listen, Links und mehr in
  Beschreibungen und Profilen, direkt an Ort und Stelle bearbeitet. Auch die
  Beschreibungen der eingebauten Komponenten im Editor nutzen sie.
- **Eine Live-Ansicht des RAM.** Tippe während der Simulation auf ein RAM, um
  seinen Inhalt in einer Hex-Ansicht zu verfolgen, die der gelesenen Adresse
  folgt.
- **Hilfe genau dort, wo du sie brauchst.** Fenster und Dialoge haben einen
  Hilfe-Knopf, der den passenden Abschnitt öffnet, jede Einstellung erklärt sich
  neben ihrem Schalter, und die neu geschriebene Dokumentation beschreibt jede
  Komponente und hat eine Seite für Smartphones und Tablets.
- **Ein Taster, der an bleibt, solange du ihn hältst.** Der Taster, der einen
  einzelnen Impuls sendet, heißt jetzt Impulstaster.
- **Bildexport als verlustfreies WebP**, wo dein Browser es unterstützt. WebP
  wird nur noch angeboten, wo dein Browser es schreiben kann.
- „Registrieren“ neben „Anmelden“ im Kontomenü des Editors.
- Ein Hinweis, wenn dein Browser älter ist als die, mit denen der Editor getestet
  wird.

### 🔄 Geändert

- **Komponenten näher an echten Bauteilen.** Ein neuer Taktgeber gibt ein
  Rechtecksignal aus, so lange an wie aus, sodass ein Zyklus doppelt so lange
  dauert wie seine Verzögerung. Ein neues RAM zeigt das adressierte Wort sofort.
  Der Impuls und das Lesen beim Takt bleiben als Optionen erhalten. Ein neuer
  Demultiplexer nimmt seine Auswahlleitungen zuerst, und ein neuer Enkodierer
  zeigt, ob überhaupt ein Eingang an ist. Früher gespeicherte Schaltungen
  arbeiten weiter wie bisher.
- **⚡ Große Schaltungen öffnen schneller und lassen sich flüssig verschieben.**
  Teile der Arbeitsfläche, die du nicht siehst, werden nicht mehr vorab
  vorbereitet, sodass große Schaltungen früher erscheinen und beim Schwenken mit
  deinem Bildschirm mithalten, auch weit herausgezoomt.
- **Große Schaltungen speichern schneller und brauchen viel weniger Platz**, in
  der Cloud und in deinem Browser.
- **Eine Geschwindigkeitssteuerung.** Ein einziger Knopf wählt „Jedes Bild“,
  eine feste Geschwindigkeit bis 10 MHz oder „So schnell wie möglich“ und zeigt,
  mit welcher Frequenz jeder Taktgeber auf der Arbeitsfläche läuft.
- **Flüssiges Zoomen.** Mausrad und Trackpad zoomen stufenlos am Zeiger, und die
  mittlere Maustaste schwenkt die Arbeitsfläche genauso wie die rechte.
- **Eine nach Funktion gruppierte Palette**: Logikgatter, Eingaben, Ausgaben,
  Addierer und Selektoren, Speicher und Zeitsteuerung. Zugeklappte Kategorien
  bleiben zugeklappt.
- Eine Komponente, die du platzierst, sitzt mittig unter dem Zeiger.
- Text-Komponenten fassen bis zu 1.000 Zeichen, doppelt so viele wie bisher.
- Der Schalter für die Tipps steht bei den anderen Editor-Einstellungen, und
  wenn du ihn ausschaltest, endet ein laufendes Tutorial.
- Ein Konto, dessen E-Mail-Adresse nicht innerhalb von 90 Tagen bestätigt wird,
  wird gelöscht.
- **Übersichtlichere Neuigkeiten.** Im Neuigkeiten-Dialog des Editors beginnt
  jede Version jetzt mit ihrer Nummer und einem ausgeschriebenen Datum in deiner
  Sprache.

### 🗑️ Entfernt

- Die Links zum alten Editor im Hilfe-Menü und im Fehlerbericht-Dialog. Der alte
  Editor geht mit dieser Version in den Ruhestand.
- Die Download-Seite der alten Desktop-App.

### 🐛 Behoben

- Ein negierter Eingang an einer LED oder einem Segment Display kehrt jetzt um,
  was sie anzeigen, und Ein- und Ausgänge sowie Tunnel nehmen keine Negation
  mehr an, die nichts bewirkt hat.
- Das Rückgängigmachen oder Wiederholen einer Anschlussnegation ist sofort zu
  sehen.
- Ein Text lässt sich durch einen Klick auf seine Schrift auswählen, und
  Bildexporte zeigen ihn vollständig.
- Ein neu platzierter oder eingefügter Eingang oder Ausgang wird zum letzten
  Anschluss seiner Art statt zum ersten.
- Das erste Zurück nach dem Öffnen des Editors verlässt ihn, statt auf derselben
  Seite zu bleiben.
- Kopieren, Einfügen oder Simulieren einer sehr großen Schaltung schlägt nicht
  mehr fehl.
- „Inhalt bearbeiten“ funktioniert bei einem ROM, das du gerade platzierst, und
  was du eingibst, wird mit ihm platziert.
- Komponenten und aus deinem Browser hochgeladene Projekte bekommen ein
  Vorschaubild statt eines Platzhalters.
- Ein Tipp, der erscheint, während ein anderer offen ist, wartet, bis er dran
  ist, statt übersprungen zu werden.
- Eine LED-Matrix in einer benutzerdefinierten Komponente leuchtet jetzt in
  deren Beobachtung.
- Editor-Links mit angehängten Parametern, etwa von Facebook oder einer
  Kampagne, öffnen die geteilte oder gespeicherte Schaltung, statt nicht zu laden.

### 🔒 Sicherheit

- Eine neue E-Mail-Adresse verlangt dein Passwort, und ein neues Passwort meldet
  dich auf deinen anderen Geräten ab.
- Eine Anfrage zum Zurücksetzen des Passworts verrät nicht mehr, ob es zu einer
  Adresse ein Konto gibt.

## [2.2.0] - 2026-09-17

### ✨ Hinzugefügt

- **Auswahlen, die du erweitern kannst.** Halte Ctrl — auf einem Mac ⌘ — und ein
  Klick fügt die Komponente oder Leitung unter dem Zeiger der Auswahl hinzu oder
  nimmt sie wieder heraus, während ein Auswahlrahmen aufnimmt, was er überdeckt.
  Die Taste lässt sich in den Tastenkürzeln neu belegen, neben „Leitungen an der
  Auswahlkante schneiden“.
- **Auswahl im Leitungswerkzeug.** Ein Tippen, das weder einen Anschluss noch
  eine Kreuzung trifft, wählt jetzt das kleinste Element unter dem Zeiger aus,
  sodass du es löschen, kopieren oder verschieben kannst.
- **Verschieben von Auswahlen im Schwenkmodus.** Ziehst du die aktuelle Auswahl,
  wird sie verschoben statt die Arbeitsfläche; überall sonst schwenkt der Druck
  wie bisher. Die neue Einstellung „Auswahl im Schwenkmodus verschieben“
  schaltet das wieder ab.

### 🐛 Behoben

- Ein Doppelklick mit dem Leitungswerkzeug nimmt das Tippen zurück, das er
  wiederholt: Ein Doppelklick auf einen Anschluss zeichnet die Leitung, die du
  erreichen wolltest, und lässt keine überflüssige Negationsblase zurück.
- Ein Klick in die Lücke innerhalb deiner Auswahl hebt sie nicht mehr auf.
- Lange Menüs und ihre Untermenüs scrollen, statt auf einem kleinen Bildschirm
  unten aus dem Fenster zu laufen.
- Auf Apple-Plattformen in Chromium-basierten Browsern wird ⌘ erkannt, wo bisher
  Ctrl angezeigt wurde.

## [2.1.3] - 2026-09-16

### 🐛 Behoben

- Eine Simulation startet nicht mehr fehl, wenn die Zahlen-Einstellung einer
  Komponente einen Nachkommawert hat, etwa eine Verzögerung von 1,9 beim
  Taktgeber, oder größer ist, als die Simulation annimmt. Eine so gespeicherte
  Schaltung lädt mit gerundetem und begrenztem Wert und wird von da an als ganze
  Zahl gespeichert.
- Beim Platzieren einer benutzerdefinierten Komponente bleiben jetzt die Richtung
  und die Optionen aus dem Einstellungsbereich erhalten, statt sie immer gleich
  ausgerichtet und ohne sie abzulegen.
- Eine Komponente, die du gerade platzieren willst, lässt sich vor dem Ablegen
  drehen: mit R oder Shift+R oder über die Dreh-Buttons in der Werkzeugleiste.
  Auch eine Platzierung, die du bereits ziehst, dreht sich damit, und die nächste
  Komponente dieser Art startet in der Richtung, in die du diese gedreht hast.

## [2.1.2] - 2026-09-10

### 🐛 Behoben

- Das Drehen eines Handys oder Tablets bringt den Editor nicht mehr zum Absturz.
- Leitungen zu reparieren, während eine Simulation läuft, führt nicht mehr zum
  Absturz. Die Simulation wird vorher beendet.
- Ein Freigabelink zu einer benutzerdefinierten Komponente öffnet sie jetzt so
  wie deine eigenen Komponenten: mit ihrem Namen in der Titelleiste und bereit,
  in deine Komponenten geklont zu werden.
- Wenn du mit dem Zurück-Button des Browsers zurückgehst, bleiben Menüs,
  Auswahllisten und Tutorial-Hinweise nicht mehr hängen.
- Links in der Hilfe und im Änderungsprotokoll des Editors springen jetzt in
  jeder Sprache zur richtigen Überschrift.
- Wo zwei Anschlussspitzen aufeinandertreffen, negiert ein Tippen mit dem
  Leitungswerkzeug jetzt den Anschluss auf der Seite, auf die du getippt hast,
  statt den gegenüberliegenden.
- Der Editor lässt sich weiter bedienen, wenn ein Verschieben oder Einfügen
  nicht abgeschlossen werden kann.

## [2.1.1] - 2026-08-31

### 🐛 Behoben

- Der Editor öffnet sich jetzt in der Sprache und dem Design, die du auf dem
  Rest von Logigator verwendest, und wenn du eines davon im Editor wechselst,
  ändert es sich auf der ganzen Seite.
- Beim ersten Besuch wählt der Editor seine Sprache anhand aller Sprachen, die
  dein Browser anfragt, statt nur der ersten.

## [2.1.0] - 2026-08-06

### ✨ Hinzugefügt

- **Aktualisierung veralteter Komponenten in einem Schritt.** Bringe alle
  platzierten Instanzen einer veralteten benutzerdefinierten Komponente auf
  einmal auf den neuesten Stand, direkt im Einstellungsbereich. Die Palette
  markiert Komponenten, deren platzierte Instanzen veraltet sind.
- **Ein Blick in geteilte Komponenten.** Öffne die benutzerdefinierten
  Komponenten, die in einer geteilten Schaltung eingebettet sind,
  schreibgeschützt. Deiner Bibliothek wird nichts hinzugefügt.

### 🔄 Geändert

- Einfügen braucht auf Handys und Tablets keine Auswahl mehr, und eingefügte
  Elemente landen unter dem Mauszeiger statt dort, wo sie kopiert wurden.
- Der Anschlüsse-Bereich steht jetzt an erster Stelle in der Seitenleiste, während
  eine benutzerdefinierte Komponente bearbeitet wird.

### 🐛 Behoben

- Ein Klick auf einen Schalter oder Taster, während die Simulation noch startete,
  brachte die Simulation zum Absturz.
- Das Öffnen eines anderen Projekts während einer laufenden Simulation brachte die
  Simulation zum Absturz.
- Ein Klick innerhalb eines schwebenden Einfügens, aber zwischen dessen
  Komponenten, brach das Einfügen ab, statt es zu greifen.
- Tooltips und Popovers am Bildschirmrand zeigten mit ihrer Spitze am Element
  vorbei, an dem sie hängen.

## [2.0.0] - 2026-08-04

Logigator wurde **komplett neu aufgebaut** — mit einem verbesserten Renderer,
einer deutlich effizienteren Rendering-Pipeline, einer modernen Oberfläche und
einer Fülle neuer Funktionen. Alles, worauf du dich
verlassen hast, ist weiterhin da, jetzt schneller, robuster und einfacher zu
bedienen, dazu einige große neue Möglichkeiten.

### ✨ Hinzugefügt

- **📱 Volle Unterstützung für Smartphones und Tablets.** Der Editor ist jetzt
  vollständig responsiv und touch-freundlich, mit Multitouch-Schwenken und
  -Zoomen — baue Schaltungen überall, nicht nur am Schreibtisch.
- **⛔ Negierte Ein- und Ausgänge.** Invertiere ein Signal direkt am Anschluss
  einer Komponente — kein separates NICHT-Gatter zum Platzieren und Verdrahten —
  für sauberere, kompaktere Schaltungen.
- **💾 Lokales Speichern ohne Account.** Behalte Projekte und benutzerdefinierte
  Komponenten auf deinem eigenen Gerät und nimm sie jederzeit wieder auf. Wenn
  du bereit bist, lade sie mit einem Klick in die Cloud hoch, und Logigator
  bringt jede benutzerdefinierte Komponente mit, von der sie abhängen.
- **♾️ Eine unendliche Arbeitsfläche in alle Richtungen.** Baue vom Ursprung aus
  in jede Richtung — nach links, rechts, oben und unten. Der bisherige Editor
  kannte nur positive Koordinaten, sodass der Ursprung eine harte Wand war,
  hinter der sich nichts platzieren ließ; jetzt wächst die Arbeitsfläche einfach
  mit deiner Schaltung.
- **🧩 In sich geschlossene Projekte.** Jedes Projekt bringt jetzt eine eigene
  Kopie der benutzerdefinierten Komponenten mit, die es verwendet, sodass es
  sich immer öffnen, darstellen und simulieren lässt — auch offline oder wenn
  die ursprüngliche Komponente fehlt. Eine fehlende Komponente stellst du in
  einem Schritt in deiner Bibliothek wieder her.
- **🗺️ Minimap.** Eine Live-Übersicht deiner gesamten Schaltung hilft dir, dich
  in großen Entwürfen mit einem Blick zurechtzufinden.
- **Drehen ganzer Auswahlen** — Komponenten und Leitungen gemeinsam — in
  90°-Schritten, im oder gegen den Uhrzeigersinn; eine kollidierende Platzierung
  bleibt schwebend, bis du sie an einer gültigen Stelle ablegst.
- **Verschieben mit den Pfeiltasten** für Auswahlen, eine Rastereinheit pro
  Druck.
- **Klares Kollisions-Feedback** — Komponenten und Leitungen färben sich rot,
  solange eine Platzierung, ein Ziehen oder eine Drehung etwas überlappen würde,
  sodass ungültige Positionen auf einen Blick offensichtlich sind.
- **Ein neues Dateiformat, mit komprimierten `.lgix`-Dateien.** Dateien aus
  früheren Versionen lassen sich weiterhin öffnen und werden beim Laden
  aktualisiert.
- **Verwaltung von Projekten und Komponenten im Editor** — benenne und lösche
  deine gespeicherten Projekte und benutzerdefinierten Komponenten direkt aus
  dem Öffnen-Dialog und der Bibliothek, statt dafür ins Account-Center auf der
  Website zu gehen.
- **Fork-Zuschreibung** — eine kopierte Schaltung merkt sich, woher sie stammt,
  auch nach dem Herunterladen und erneuten Hochladen, sodass die ursprünglichen
  Ersteller genannt bleiben.
- Ein **praktisches Tutorial**, das dich echte Komponenten platzieren und
  verdrahten lässt. Es geht weiter, sobald du einen Schritt erledigt hast, läuft
  auf einer eigenen Fläche, sodass deine Arbeit unangetastet bleibt, und
  funktioniert auf Desktop und Touch.
- **Just-in-Time-Hinweise**, die beim ersten Erreichen einer passenden Situation
  erscheinen (Verdrahten, Simulieren, Einfügen und mehr) und jeweils in die
  Dokumentation verlinken.
- **Fehlermeldungen im Editor**, die automatisch die Details mitschicken, die
  zum Aufspüren eines Problems nötig sind, sodass du nur beschreiben musst, was
  passiert ist.
- Diese **Neuigkeiten**-Seite, jederzeit über **Hilfe → Neuigkeiten**
  erreichbar, mit einer kurzen Zusammenfassung, die sich beim ersten Laden einer
  neuen Version automatisch öffnet.

### 🔄 Geändert

- **⚡ Ein neu gebautes Fundament.** Rendering-Pipeline, Simulations-Engine und
  Kollisionssystem wurden alle von Grund auf neu gebaut: GPU-beschleunigte
  Grafik hält große Schaltungen flüssig, ein neuer Simulationskern treibt die
  Logik an, und ein robusteres Kollisionssystem macht das Bearbeiten weit
  stabiler und weniger fehleranfällig.
- Aufgefrischte, konsistente Oberfläche über Menüs, Dialoge, Panels und Toasts
  hinweg, mit einer neu gestalteten Werkbank in der Seitenleiste.
- **Sofortiger Wechsel zwischen hellem und dunklem Design** — ohne Neuladen der
  Seite, wo der bisherige Editor die Änderung erst nach dem Neuladen übernahm.
- **Ein Raster, das zeigt, wo verbunden wird** — die Rasterpunkte liegen jetzt
  genau auf den Punkten, an denen Leitungen, Anschluss-Spitzen und Kreuzungen
  enden, sodass Leitungen durch die Punkte statt zwischen ihnen verlaufen.
- Ein **einfacheres, vereinheitlichtes Werkzeugset**: Ein Leitungswerkzeug
  verlegt Leitungen und verbindet, trennt oder negiert Verbindungen mit einem
  Tippen; die exakte Auswahl gehört jetzt zum Auswahlwerkzeug; und das Schwenken
  hat ein eigenes Werkzeug.
- **Komponenten-Updates zu deinen Bedingungen.** Wenn eine neuere Version einer
  benutzerdefinierten Komponente verfügbar ist, kennzeichnet der Editor dies und
  lässt dich platzierte Instanzen aktualisieren, wann du willst, statt dass sich
  jede Kopie ändert, sobald die Komponente bearbeitet wird.
- **Neu strukturierte In-App-Dokumentation**, in Abschnitten, die aufeinander
  verweisen, auf dem Desktop als Fenster und auf dem Smartphone im Vollbild.
