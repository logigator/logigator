# Änderungsprotokoll

Alle nennenswerten Änderungen am Logigator-Editor werden hier festgehalten. Die
aktuellste Veröffentlichung steht ganz oben.

## 2.0.0 — 2026-07-13

Logigator wurde **komplett neu aufgebaut** — mit einem verbesserten,
WebGPU-fähigen Renderer, einer deutlich effizienteren Rendering-Pipeline, einer
modernen Oberfläche und einer Fülle neuer Funktionen. Alles, worauf du dich
verlassen hast, ist weiterhin da, jetzt schneller, robuster und einfacher zu
bedienen, dazu einige große neue Möglichkeiten.

### ✨ Höhepunkte

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
- **🧩 In sich geschlossene Projekte.** Jedes Projekt bettet nun eine
  eingefrorene Kopie der benutzerdefinierten Komponenten ein, die es verwendet,
  sodass es sich immer öffnen, darstellen und simulieren lässt — selbst offline
  oder wenn die ursprüngliche Komponente fehlt. Aktualisiere platzierte
  Komponenten auf die neueste Version, wann immer du möchtest, statt dass sich
  jede Kopie auf einmal ändert.
- **🗺️ Minimap.** Eine Live-Übersicht deiner gesamten Schaltung hilft dir, dich
  in großen Entwürfen mit einem Blick zurechtzufinden.
- **⚡ Ein neu gebautes Fundament.** Rendering-Pipeline, Simulations-Engine und
  Kollisionssystem wurden alle von Grund auf neu gebaut: WebGPU-beschleunigte
  Grafik hält große Schaltungen flüssig, ein neuer Simulationskern treibt die
  Logik an, und ein robusteres Kollisionssystem macht das Bearbeiten weit
  stabiler und weniger fehleranfällig.

### Unter der Haube

- Rendering auf **PixiJS 8** aktualisiert, das nun **WebGPU** bevorzugt
  (mit Rückfall auf WebGL, dann Canvas), eingebettet in eine weit effizientere
  Rendering-Pipeline — die Szene wird in GPU-Render-Gruppen aufgeteilt und über
  den Quad-Tree gecullt — sodass Schwenken, Zoomen und Bearbeiten auf großen
  Schaltungen flüssig bleiben.
- **Neu gebaute Simulations-Engine** — ein neuer, aus Rust kompilierter
  WebAssembly-Kern ersetzt die bisherige Simulations-Engine
  ([`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim)).
- **Neu geschriebenes Kollisionssystem** — räumliche Prüfungen laufen nun über
  einen Quad-Tree mit variabler Chunk-Größe, was Platzierung und
  Drag-Kollisionen stabiler und weit weniger fehleranfällig macht.

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
