# Ausgaben

Ausgaben zeigen, was eine Schaltung tut: eine LED ein einzelnes Signal, ein Segment Display eine Zahl, eine LED-Matrix ein Bild und ein Terminal Text. Sie haben nur Eingänge und ändern sich, während die Simulation läuft.

## LED

![Zwei Schalter, jeder mit einer LED verbunden. Der obere Schalter ist an und seine LED leuchtet; der untere ist aus und seine LED dunkel.](./images/component-led.webp)

Eine LED leuchtet, solange ihr Eingang 1 ist.

| Anschluss | Richtung | Bedeutung                |
| --------- | -------- | ------------------------ |
| Eingang   | ein      | 1 lässt die LED leuchten |

Außer Richtung hat sie keine Optionen.

## Segment Display

![Ein Segment Display mit vier Schaltern an seinen Eingängen, das 00, 05, 10 und 15 zeigt, während sich die Schalter ändern.](./images/component-segment-display.webp)

Ein Segment Display zeigt die Binärzahl an seinen Eingängen als Zahl in dezimaler, hexadezimaler oder oktaler Schreibweise.

| Anschluss  | Richtung | Bedeutung                                       |
| ---------- | -------- | ----------------------------------------------- |
| 0, 1, 2, … | ein      | Die Bits der Zahl, Eingang 0 ist das niedrigste |

| Option   | Werte         | Standard |
| -------- | ------------- | -------- |
| Eingänge | 1 bis 16      | 2        |
| Basis    | DEC, HEX, OCT | DEC      |

Die Zahl wird mit Nullen auf so viele Stellen aufgefüllt, wie der größte Wert an den Eingängen braucht. Eine kleine 10, 16 oder 8 daneben zeigt die Basis.

| Eingänge | DEC         | HEX       | OCT         |
| -------- | ----------- | --------- | ----------- |
| 4        | 00 bis 15   | 0 bis f   | 00 bis 17   |
| 8        | 000 bis 255 | 00 bis ff | 000 bis 377 |

## LED-Matrix

![Eine 4 × 4 LED-Matrix mit Schaltern an A0, A1 und D0 bis D3 und einem Impulstaster an CLK, die ein X zeichnet, eine Zeile pro Impuls.](./images/component-led-matrix.webp)

Eine LED-Matrix ist ein quadratisches LED-Raster. Bei der steigenden Flanke von CLK werden die Dateneingänge in die Zeile geschrieben, die die Adresseingänge wählen. Jede Zeile behält, was in sie geschrieben wurde, bis zum nächsten Schreiben.

| Anschluss | Richtung | Bedeutung                                     |
| --------- | -------- | --------------------------------------------- |
| A0, A1, … | ein      | Die Adresse der zu schreibenden Zeile         |
| D0, D1, … | ein      | Die LEDs, die in dieser Zeile leuchten sollen |
| CLK       | ein      | Eine steigende Flanke schreibt D in die Zeile |

| Option      | Werte    | Standard |
| ----------- | -------- | -------- |
| Breite/Höhe | 4, 8, 16 | 4        |

Die Größe legt fest, wie viele Adress- und Dateneingänge es gibt:

| Breite/Höhe | Adresseingänge | Dateneingänge | Eine Adresse deckt ab |
| ----------- | -------------- | ------------- | --------------------- |
| 4           | A0 bis A1      | D0 bis D3     | eine Zeile            |
| 8           | A0 bis A2      | D0 bis D7     | eine Zeile            |
| 16          | A0 bis A4      | D0 bis D7     | eine halbe Zeile      |

Bei 16 × 16 ist Adresse 0 die linke Hälfte von Zeile 0, Adresse 1 ihre rechte Hälfte, Adresse 2 die linke Hälfte von Zeile 1 und so weiter. D0 ist die LED ganz links in der Zeile oder halben Zeile. Zeile 0 liegt oben, und drehst du die Matrix, bleibt das Raster aufrecht, und nur die Anschlüsse wandern.

Mit einem [Negationskreis](docs:components-and-options#einen-anschluss-negieren) an CLK schreibt die Matrix stattdessen bei der fallenden Flanke.

## Terminal

![Ein Terminal in seiner Standardgröße, gespeist von einer Tastatur, mit drei ausgegebenen Textzeilen.](./images/component-terminal.webp)

Ein Terminal ist ein Textbildschirm. Es gibt jedes Mal ein Zeichen aus, wenn sein Eingang CLK steigt: das Zeichen, dessen Code in diesem Tick an D0 bis D7 anliegt. Zeilenvorschub, Rückschritt und die anderen Steuerzeichen bewegen stattdessen den Cursor.

| Anschluss | Richtung | Bedeutung                                                      |
| --------- | -------- | -------------------------------------------------------------- |
| D0 bis D7 | ein      | Der auszugebende 8-Bit-Latin-1-Code, D0 ist das niedrigste Bit |
| CLK       | ein      | Eine steigende Flanke gibt den Code an D0 bis D7 aus           |

| Option    | Werte       | Standard |
| --------- | ----------- | -------- |
| Spalten   | 8 bis 80    | 40       |
| Zeilen    | 1 bis 24    | 12       |
| Textgröße | Klein, Groß | Klein    |

Spalten und Zeilen legen fest, wie viele Zeichen breit und wie viele Zeilen hoch der Bildschirm ist, und die Komponente wächst mit. Groß zeichnet jedes Zeichen anderthalbmal so groß wie Klein. Drehst du ein Terminal, bleibt sein Bildschirm aufrecht, und nur die Anschlüsse wandern.

Das nächste Zeichen erscheint dort, wo der Block-Cursor steht, den der Bildschirm nur während einer Simulation zeigt. Mit einem [Negationskreis](docs:components-and-options#einen-anschluss-negieren) an CLK gibt das Terminal stattdessen bei der fallenden Flanke aus.

Um zu sehen, was du tippst, verbinde D0 bis D7 einer [Tastatur](docs:inputs#tastatur) mit D0 bis D7 des Terminals und ihren Ausgang STB mit CLK. `Enter` beginnt dann eine neue Zeile, `Backspace` löscht das Zeichen vor dem Cursor, und die Pfeiltasten und `Home` bewegen den Cursor.

Während einer Simulation öffnet ein Klick auf ein Terminal ein Fenster mit allem, was es ausgegeben hat. Das Fenster ist unter [Inspektion und Beobachtungen](docs:inspection#terminal-ausgabe) beschrieben.

![Das Fenster eines Terminals mit hello und world im Verlauf über dem Bildschirm, neben einer Tastatur, die mit dem Terminal auf der Arbeitsfläche verbunden ist.](./images/terminal-window.webp)

### Ausgegebene Zeichen

Die Codes sind Latin-1, wie bei der Tastatur. Codes vom Leerzeichen bis `~` und von `0xA0` bis ÿ erscheinen als ihr Zeichen, `0x41` gibt also A aus und `0xE4` ä. Das geschützte Leerzeichen erscheint als Leerzeichen und der weiche Trennstrich als Bindestrich.

### Steuerzeichen

Diese Codes bewegen den Cursor oder löschen:

| Code   | Name | Wirkung                                                                                                                 |
| ------ | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| `0x08` | BS   | Geht eine Spalte nach links und löscht das Zeichen dort. In der ersten Spalte passiert nichts.                          |
| `0x09` | TAB  | Geht nach rechts zum nächsten Tabstopp, einer alle 8 Spalten, oder zur letzten Spalte.                                  |
| `0x0A` | LF   | Geht an den Anfang der nächsten Zeile. In der untersten Zeile rollt stattdessen der Bildschirm um eine Zeile nach oben. |
| `0x0B` | HOM  | Geht in die linke obere Ecke.                                                                                           |
| `0x0C` | FF   | Leert den Bildschirm und geht in die linke obere Ecke. Die geleerten Zeilen kommen nicht in den Verlauf.                |
| `0x0D` | CR   | Geht an den Anfang der Zeile.                                                                                           |
| `0x1C` | RT   | Geht eine Spalte nach rechts.                                                                                           |
| `0x1D` | LT   | Geht eine Spalte nach links.                                                                                            |
| `0x1E` | UP   | Geht eine Zeile nach oben.                                                                                              |
| `0x1F` | DN   | Geht eine Zeile nach unten.                                                                                             |
| `0x7F` | DEL  | Löscht das Zeichen unter dem Cursor. Der Cursor bleibt stehen.                                                          |

RT, LT, UP und DN halten an den Rändern des Bildschirms an, nur LF rollt. Jeder andere Code, darunter ESC und `0x80` bis `0x9F`, wird ignoriert.

### Zeilenumbruch

- Ein Zeichen in der letzten Spalte lässt den Cursor dort stehen.
- Das nächste Zeichen kommt an den Anfang der nächsten Zeile. Stand der Cursor in der untersten Zeile, rollt der Bildschirm dafür.
- Eine volle Zeile mit einem LF danach hinterlässt deshalb keine leere Zeile.
- Ein Code, der den Cursor bewegt, hebt diesen Umbruch auf, sodass ein BS direkt nach der letzten Spalte das Zeichen löscht, das dort steht.

### Verlauf

Eine Zeile, die oben aus dem Bildschirm rollt, kommt so in den Verlauf, wie sie war, und die Cursor-Codes können sie nicht mehr ändern. Der Verlauf behält die letzten 10.000 Zeilen und erscheint im [Fenster](docs:inspection#terminal-ausgabe) des Terminals.

| Aktion                   | Bildschirm | Verlauf |
| ------------------------ | ---------- | ------- |
| Pause                    | bleibt     | bleibt  |
| Stopp                    | geleert    | geleert |
| Verlassen der Simulation | geleert    | geleert |

## Siehe auch

- [Eingaben](docs:inputs): Schalter, Taster und die Tastatur, die diese Ausgaben steuern
- [Inspektion und Beobachtungen](docs:inspection): das Fenster des Terminals und Beobachtungen
- [Simulation](docs:simulation): eine Schaltung laufen lassen, pausieren und stoppen
- [Komponenten und Optionen](docs:components-and-options): die Palette und die Einstellungskarte
