# Komponenten & Optionen

Komponenten sind die Bausteine einer Schaltung — Gatter, Speicher, Eingänge, Anzeigen und mehr. Diese Seite behandelt, wo du sie findest, wie du sie platzierst und wie du die gerade ausgewählte konfigurierst.

![Die Komponentenpalette links geöffnet, ihre Kategorien ausgeklappt, neben einer kleinen Schaltung auf der Arbeitsfläche.](images/components-and-options/palette-and-board.png)

## Die Komponentenpalette

Die Palette ist das Panel links. Sie listet jede Komponente auf, die du platzieren kannst, in Kategorien gruppiert. Nutze das Suchfeld oben, um nach Namen zu filtern, und klicke eine Kategorieüberschrift an, um sie aus- oder einzuklappen.

- **Grundlegend** — die alltäglichen Logik-Bausteine: **NICHT-Gatter**, **UND-Gatter**, **ODER-Gatter**, **XOR-Gatter**, **Durchpass**, **Taktgeber** und **Tunnel**.
- **Fortgeschritten** — größere Bausteine: Addierer, Speicher, Flip-Flops und Routing-Bauteile (siehe die Tabelle unten).
- **Ein- / Ausgänge** — die Hardware, mit der du während einer laufenden Simulation interagierst: **Taster**, **Schalter**, **LED**, **Segment Display** und **LED-Matrix**.
- **Benutzerdefiniert** — deine eigenen wiederverwendbaren Bauteile. Dieser Bereich ist leer, bis du eines baust; siehe [Benutzerdefinierte Komponenten](docs:custom-components).

Eine Kategorie **Anschlüsse** erscheint nur, während du eine benutzerdefinierte Komponente bearbeitest. Sie enthält die Stecker **Eingang** und **Ausgang**, mit denen du die Anschlüsse dieser Komponente definierst — siehe [Benutzerdefinierte Komponenten](docs:custom-components).

Um eine Komponente zu platzieren, klicke sie in der Palette an, und sie folgt deinem Cursor als Vorschau; bewege sie an die gewünschte Stelle und drücke, um sie abzulegen. Das Platzieren bleibt scharfgeschaltet, sodass du mehrere nacheinander ablegen kannst — drücke `Escape` oder wähle ein anderes Werkzeug, um aufzuhören. Siehe [Arbeitsfläche & Werkzeuge](docs:board-and-tools) für mehr zum Platzieren, Verschieben und Drehen.

### Grundlegend

| Komponente       | Was sie tut                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NICHT-Gatter** | Invertiert seinen Eingang: HIGH hinein ergibt LOW heraus, und umgekehrt.                                                                                    |
| **UND-Gatter**   | Der Ausgang ist HIGH, nur wenn jeder Eingang HIGH ist.                                                                                                      |
| **ODER-Gatter**  | Der Ausgang ist HIGH, wenn mindestens ein Eingang HIGH ist.                                                                                                 |
| **XOR-Gatter**   | Der Ausgang ist HIGH, wenn eine ungerade Anzahl an Eingängen HIGH ist.                                                                                      |
| **Durchpass**    | Reicht seinen Eingang unverändert durch und fügt einen Simulations-Tick Verzögerung hinzu.                                                                  |
| **Taktgeber**    | Gibt einen sich wiederholenden, ein Tick langen Puls aus; die Verzögerung zwischen den Pulsen ist einstellbar, und ein HIGH am STP-Eingang pausiert ihn.    |
| **Tunnel**       | Eine drahtlose Verbindung — alle Tunnel mit derselben Beschriftung sind elektrisch verbunden. Siehe [Leitungen & Verbindungen](docs:wires-and-connections). |

### Fortgeschritten

| Komponente           | Was sie tut                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Halbaddierer**     | Addiert zwei 1-Bit-Zahlen; S ist das Summenbit, C der Übertrag.                                                             |
| **Volladdierer**     | Addiert zwei Summanden plus einen Übertrag-Eingang; S ist das Summenbit, C der Übertrag.                                    |
| **ROM**              | Festwertspeicher, dessen gespeicherten Inhalt du von Hand bearbeitest.                                                      |
| **RAM**              | Speicher mit wahlfreiem Zugriff: liest das adressierte Wort bei einer Taktflanke oder speichert eines, solange WE HIGH ist. |
| **D-Flip-Flop**      | Speichert ein Bit; erfasst D bei der steigenden Flanke von CLK.                                                             |
| **JK-Flip-Flop**     | Speichert ein Bit; J setzt, K setzt zurück, beide schalten um, bei der steigenden Flanke von CLK.                           |
| **SR-Flip-Flop**     | Speichert ein Bit; S setzt und R setzt zurück bei der steigenden Flanke von CLK.                                            |
| **Zufallsgenerator** | Erzeugt bei jeder steigenden Flanke von CLK zufällige Daten an seinen Ausgängen.                                            |
| **Dekodierer**       | Treibt den einen Ausgang, dessen Index dem Binärwert an seinen Eingängen entspricht.                                        |
| **Enkodierer**       | Gibt den Binärindex seines höchsten aktiven Eingangs aus.                                                                   |
| **Multiplexer**      | Leitet den durch die Auswahlleitungen gewählten Dateneingang an den einzelnen Ausgang.                                      |
| **Demultiplexer**    | Leitet den einzelnen Dateneingang an den durch die Auswahlleitungen gewählten Ausgang.                                      |

### Ein- / Ausgänge

| Komponente          | Was sie tut                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Taster**          | Ein Momentschalter — klicke ihn während der Simulation, um einen einzelnen Puls auszusenden.                            |
| **Schalter**        | Ein rastender Schalter — klicke ihn während der Simulation, um seinen Ausgang an- und auszuschalten.                    |
| **LED**             | Leuchtet, solange die Leitung, die ihren Eingang speist, unter Strom steht.                                             |
| **Segment Display** | Zeigt den Binärwert an seinen Eingängen als Zahl in einer gewählten Basis.                                              |
| **LED-Matrix**      | Ein quadratisches Raster aus LEDs, das ein Bild anzeigt, Zeile für Zeile bei der steigenden Flanke von CLK geschrieben. |

## Eine Komponente konfigurieren

Wenn du eine einzelne platzierte Komponente auswählst — oder während du eine platzierst — erscheint eine kleine **Einstellungskarte** neben der Arbeitsfläche, die den Namen dieser Komponente, eine kurze Beschreibung und ihre einstellbaren Optionen zeigt. Auf einem Touch-Gerät öffnen sich dieselben Optionen stattdessen in der Schublade **Einstellungen**.

![Die Einstellungskarte neben der Arbeitsfläche, die Namen, Beschreibung, die Richtungspfeile und einen Eingänge-Regler eines ausgewählten UND-Gatters zeigt.](images/components-and-options/settings-card.png)

### Richtung — bei jeder Komponente

Jede Komponente hat eine **Richtung**-Steuerung: vier Pfeile für Osten, Süden, Westen und Norden. Sie dreht die Komponente in die gewünschte Blickrichtung, was demselben Drehen entspricht. (Du kannst eine Auswahl auf der Arbeitsfläche auch mit `R` und `Shift+R` drehen — siehe [Arbeitsfläche & Werkzeuge](docs:board-and-tools).)

### Typspezifische Optionen

Alles über die Richtung hinaus hängt von der Komponente ab. Viele Komponenten haben gar keine (ein NICHT-Gatter etwa). Die, die welche haben:

| Komponente                                    | Optionen                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **UND- / ODER- / XOR-Gatter**, **Dekodierer** | **Eingänge** — wie viele Eingangsanschlüsse.                                                             |
| **Enkodierer**, **Zufallsgenerator**          | **Ausgänge** — wie viele Ausgangsanschlüsse.                                                             |
| **Taktgeber**                                 | **Verzögerung** — die Anzahl der Ticks zwischen den Pulsen.                                              |
| **Tunnel**                                    | **Beschriftung** — der Name, der ihn mit anderen Tunneln paart.                                          |
| **ROM**                                       | **Wortbreite**, **Adressgröße** und **Inhalt bearbeiten** (siehe unten).                                 |
| **RAM**                                       | **Wortbreite** und **Adressgröße**.                                                                      |
| **Multiplexer / Demultiplexer**               | **Auswahlleitungen** — wie viele Auswahleingänge, was die Anzahl der Datenleitungen festlegt.            |
| **Segment Display**                           | **Eingänge** — wie viele Eingangsbits — und **Basis** — die Zahlenbasis, in der der Wert angezeigt wird. |
| **LED-Matrix**                                | **Breite/Höhe** — die Größe des LED-Rasters.                                                             |

### ROM-Inhalt bearbeiten

Wählst du ein **ROM** aus, erscheint eine Schaltfläche **Inhalt bearbeiten**. Sie öffnet einen Hex-Editor, in dem du die gespeicherten Wörter des Speichers eintippst; die Optionen **Wortbreite** und **Adressgröße** legen fest, wie breit jedes Wort ist und wie viele Wörter es gibt. Deine Änderungen werden mit der Schaltung gespeichert. Dieselbe schreibgeschützte Hex-Ansicht ist verfügbar, während eine Simulation läuft — siehe [Inspektion & Beobachtungen](docs:inspection).

## Einen Anschluss negieren

Jeder Eingangs- oder Ausgangsanschluss kann **negiert** werden, sodass das Signal, das ihn durchläuft, invertiert wird, ohne ein separates NICHT-Gatter hinzuzufügen. Wähle das Werkzeug **Leitung** und tippe direkt auf einen Anschluss: Eine kleine **Negationsblase** erscheint darauf, und der Anschluss ist nun invertiert. Tippe erneut darauf, um die Blase zu entfernen.

Solange das Leitungswerkzeug aktiv ist, zeigt das Bewegen nahe eines Anschlusses eine Vorschau der Blase, die ein Tippen hinzufügen würde, sodass du genau siehst, welchen Anschluss du gerade negieren wirst.

![Nahaufnahme eines Gatter-Eingangs mit einer Negationsblase darauf, gezeichnet dort, wo der Anschluss auf den Körper trifft.](images/components-and-options/port-negation.png)

## Text platzieren

Die Palette enthält keinen Text — Beschriftungen werden mit dem Werkzeug **Text** in der Werkzeugleiste platziert. Wähle es, klicke auf die Arbeitsfläche und tippe deine Notiz; die Einstellungskarte der Beschriftung lässt dich den **Text bearbeiten** und ihre **Schriftgröße** ändern. Leitungen dürfen durch eine Textbeschriftung verlaufen, ohne sich mit ihr zu verbinden.

## Siehe auch

- [Leitungen & Verbindungen](docs:wires-and-connections) — Anschlüsse zu funktionierenden Schaltungen verbinden
- [Benutzerdefinierte Komponenten](docs:custom-components) — eine Schaltung in dein eigenes wiederverwendbares Bauteil verpacken
- [Simulation](docs:simulation) — die Schaltung laufen lassen und mit Tastern, Schaltern und Anzeigen interagieren
- [Arbeitsfläche & Werkzeuge](docs:board-and-tools) — platzieren, auswählen, verschieben und drehen
