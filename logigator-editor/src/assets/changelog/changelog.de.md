# Änderungsprotokoll

Alle nennenswerten Änderungen am Logigator-Editor werden hier festgehalten. Die
aktuellste Veröffentlichung steht ganz oben.

## 2.1.2 — 2026-09-10

### Korrekturen

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

## 2.1.1 — 2026-08-31

### Korrekturen

- Der Editor öffnet sich jetzt in der Sprache und dem Design, die du auf dem
  Rest von Logigator verwendest, und wenn du eines davon im Editor wechselst,
  ändert es sich auf der ganzen Seite.
- Beim ersten Besuch wählt der Editor seine Sprache anhand aller Sprachen, die
  dein Browser anfragt, statt nur der ersten.

## 2.1.0 — 2026-08-06

### Funktionen

- **Alle Instanzen aktualisieren** — bringe alle platzierten Instanzen einer
  veralteten benutzerdefinierten Komponente in einem Schritt auf den neuesten
  Stand, direkt im Einstellungsbereich. Die Palette markiert Komponenten, deren
  platzierte Instanzen veraltet sind.
- **Hineinsehen** in die benutzerdefinierten Komponenten, die in einer geteilten
  Schaltung eingebettet sind — schreibgeschützt. Deiner Bibliothek wird nichts
  hinzugefügt.
- Einfügen braucht auf Handys und Tablets keine Auswahl mehr, und eingefügte
  Elemente landen unter dem Mauszeiger statt dort, wo sie kopiert wurden.
- Der Anschlüsse-Bereich steht jetzt an erster Stelle in der Seitenleiste, während
  eine benutzerdefinierte Komponente bearbeitet wird.

### Korrekturen

- Ein Klick auf einen Schalter oder Taster, während die Simulation noch startete,
  brachte die Simulation zum Absturz.
- Das Öffnen eines anderen Projekts während einer laufenden Simulation brachte die
  Simulation zum Absturz.
- Ein Klick innerhalb eines schwebenden Einfügens, aber zwischen dessen
  Komponenten, brach das Einfügen ab, statt es zu greifen.
- Tooltips und Popovers am Bildschirmrand zeigten mit ihrer Spitze am Element
  vorbei, an dem sie hängen.

## 2.0.0 — 2026-08-04

Logigator wurde **komplett neu aufgebaut** — mit einem verbesserten Renderer,
einer deutlich effizienteren Rendering-Pipeline, einer modernen Oberfläche und
einer Fülle neuer Funktionen. Alles, worauf du dich
verlassen hast, ist weiterhin da, jetzt schneller, robuster und einfacher zu
bedienen, dazu einige große neue Möglichkeiten.

### ✨ Höhepunkte

- **⚡ Ein neu gebautes Fundament.** Rendering-Pipeline, Simulations-Engine und
  Kollisionssystem wurden alle von Grund auf neu gebaut: GPU-beschleunigte
  Grafik hält große Schaltungen flüssig, ein neuer Simulationskern treibt die
  Logik an, und ein robusteres Kollisionssystem macht das Bearbeiten weit
  stabiler und weniger fehleranfällig.
- **📱 Für Smartphones und Tablets gemacht.** Der Editor ist jetzt vollständig
  responsiv und touch-freundlich, mit Multitouch-Schwenken und -Zoomen — baue
  Schaltungen überall, nicht nur am Schreibtisch.
- **⛔ Negierte Ein- und Ausgänge.** Invertiere ein Signal direkt am Anschluss
  einer Komponente — kein separates NICHT-Gatter zum Platzieren und Verdrahten —
  für sauberere, kompaktere Schaltungen.
- **💾 Lokal speichern, direkt im Browser.** Behalte Projekte und
  benutzerdefinierte Komponenten auf deinem eigenen Gerät — ohne Account — und
  nimm sie jederzeit wieder auf. Wenn du bereit bist, lade sie mit einem Klick in
  die Cloud hoch, und Logigator bringt jede benutzerdefinierte Komponente mit,
  von der sie abhängen.
- **♾️ Eine unendliche Arbeitsfläche in alle Richtungen.** Baue vom Ursprung aus
  in jede Richtung — nach links, rechts, oben und unten. Der bisherige Editor
  kannte nur positive Koordinaten, sodass der Ursprung eine harte Wand war,
  hinter der sich nichts platzieren ließ; jetzt wächst die Arbeitsfläche einfach
  mit deiner Schaltung.
- **🧩 In sich geschlossene Projekte.** Jedes Projekt bettet nun eine
  eingefrorene Kopie der benutzerdefinierten Komponenten ein, die es verwendet,
  sodass es sich immer öffnen, darstellen und simulieren lässt — selbst offline
  oder wenn die ursprüngliche Komponente fehlt. Aktualisiere platzierte
  Komponenten auf die neueste Version, wann immer du möchtest, statt dass sich
  jede Kopie auf einmal ändert.
- **🗺️ Minimap.** Eine Live-Übersicht deiner gesamten Schaltung hilft dir, dich
  in großen Entwürfen mit einem Blick zurechtzufinden.

### Unter der Haube

- Rendering auf **PixiJS 8** aktualisiert, eingebettet in eine weit effizientere
  Rendering-Pipeline — die Szene wird in GPU-Render-Gruppen aufgeteilt und über
  den Quad-Tree gecullt — sodass Schwenken, Zoomen und Bearbeiten auf großen
  Schaltungen flüssig bleiben.
- **Neu gebaute Simulations-Engine** — ein neuer, aus Rust kompilierter
  WebAssembly-Kern ersetzt die bisherige Simulations-Engine
  ([`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim)).
- **Neu geschriebenes Kollisionssystem** — räumliche Prüfungen laufen nun über
  einen Quad-Tree mit variabler Chunk-Größe, was Platzierung und
  Drag-Kollisionen stabiler und weit weniger fehleranfällig macht.
- **Unbegrenzter Koordinatenraum** — derselbe Quad-Tree trägt die unendliche
  Arbeitsfläche: seine Wurzel verdoppelt sich in Richtung des platzierten
  Elements und wächst dabei genauso bereitwillig in den negativen wie in den
  positiven Bereich, sodass die Fläche keine Ursprungsecke und keine feste
  Ausdehnung hat. Der bisherige Editor hielt Elemente in einem positiv
  indizierten Chunk-Array und lehnte sowohl Chunks als auch Platzierungen bei
  negativen Koordinaten ab.

### Editor & Arbeitsfläche

- Aufgefrischte, konsistente Oberfläche über Menüs, Dialoge, Panels und Toasts
  hinweg, mit einer neu gestalteten Werkbank in der Seitenleiste.
- **Helles und dunkles Design wechseln sofort** — ohne Neuladen der Seite, wo der
  bisherige Editor die Änderung erst nach dem Neuladen übernahm.
- **Ganze Auswahlen drehen** — Komponenten und Leitungen gemeinsam — in
  90°-Schritten, im oder gegen den Uhrzeigersinn; eine kollidierende Platzierung
  bleibt schwebend, bis du sie an einer gültigen Stelle ablegst.
- **Auswahlen mit den Pfeiltasten verschieben**, eine Rastereinheit pro Druck.
- **Klares Kollisions-Feedback** — Komponenten und Leitungen färben sich rot,
  solange eine Platzierung, ein Ziehen oder eine Drehung etwas überlappen würde,
  sodass ungültige Positionen auf einen Blick offensichtlich sind.
- **Das Raster zeigt, wo verbunden wird** — die Rasterpunkte liegen jetzt genau
  auf den Punkten, an denen Leitungen, Anschluss-Spitzen und Kreuzungen enden,
  sodass Leitungen durch die Punkte statt zwischen ihnen verlaufen.
- Ein **einfacheres, vereinheitlichtes Werkzeugset**: Leitungsverlegung und
  Verbinden/Trennen wurden in ein einziges Leitungswerkzeug zusammengeführt
  (ziehen zum Verlegen, tippen zum Umschalten einer Kreuzung oder der Negation
  eines Anschlusses), die „exakte“ Schneide-Auswahl in das Auswahlwerkzeug
  integriert und das Schwenken zu einem eigenständigen Werkzeug erhoben.

### Dateien, Komponenten & Teilen

- **Lokaler Browser-Speicher** (IndexedDB) für Projekte und benutzerdefinierte
  Komponenten, mit Ein-Klick-Upload, der ein Dokument — und jede
  benutzerdefinierte Komponente, von der es abhängt, Kinder zuerst — in die Cloud
  befördert.
- Ein **natives, versioniertes Dateiformat** mit einer Migrationskette, die
  ältere Dateien beim Laden aktualisiert (nur die neueste Version wird je
  geschrieben), plus ein komprimierter **`.lgix`**-Container mit
  Magic-Byte-Rahmung.
- **Neu gebaute Einbettung benutzerdefinierter Komponenten.** Jedes Projekt und
  jede benutzerdefinierte Komponente bettet nun eine eingefrorene Kopie jeder
  verwendeten benutzerdefinierten Komponente ein — verschachtelte Abhängigkeiten
  eingeschlossen — sodass sich eine Schaltung immer öffnen, darstellen und
  simulieren lässt, selbst wenn die ursprüngliche Komponente fehlt oder du
  offline bist. Eine fehlende Komponente wird nur-bearbeitbar und lässt sich in
  einem Schritt in deiner Bibliothek wiederherstellen; die Schaltung ist nie
  kaputt.
- **Komponenten-Updates zu deinen Bedingungen.** Wenn eine neuere Version einer
  benutzerdefinierten Komponente verfügbar ist, kennzeichnet der Editor dies und
  lässt dich platzierte Instanzen auf die neueste aktualisieren — statt des alten
  Modells, bei dem das Bearbeiten einer Komponente jede Kopie auf einmal änderte.
- **Projekte und Komponenten im Editor verwalten** — benenne und lösche deine
  gespeicherten Projekte und benutzerdefinierten Komponenten direkt aus dem
  Öffnen-Dialog und der Bibliothek, statt dafür ins Account-Center auf der Website
  zu gehen.
- **Fork-Zuschreibung** — die Abstammung eines Forks wird in der exportierten
  Datei festgehalten und beim Upload neu aufgelöst, sodass die ursprünglichen
  Ersteller weiterhin genannt werden.

### Einstieg & Hilfe

- Ein **praktisches Tutorial**, das dich echte Komponenten platzieren und
  verdrahten lässt; die Schritte rücken automatisch vor, indem sie den
  Live-Projektzustand beobachten, laufen auf einer Übungsfläche, sodass deine
  Arbeit unangetastet bleibt, und passen sich an Desktop und Touch an.
- **Just-in-Time-Hinweise**, die beim ersten Erreichen einer passenden Situation
  erscheinen (Verdrahten, Simulieren, Einfügen und mehr) und jeweils in die
  Dokumentation verlinken.
- **Neu strukturierte In-App-Dokumentation** — eine in Abschnitte gegliederte,
  tief verlinkbare Referenz mit Querverweisen, auf dem Desktop als Dialog und auf
  kompakten Geräten als Vollbild angezeigt.
- **Fehlermeldungen im Editor**, die Umgebungsdetails und jüngste Editor-Logs
  automatisch erfassen.
- Diese **Neuigkeiten**-Seite, jederzeit über **Hilfe → Neuigkeiten**
  erreichbar, mit einer kurzen Zusammenfassung, die sich beim ersten Laden einer
  neuen Version automatisch öffnet.
