# Komponenten und Optionen

Komponenten sind die Bauteile, aus denen eine Schaltung besteht: Gatter, Speicher, Eingaben und Anzeigen. Du wählst sie in der Palette links aus und stellst ihre Optionen in der Einstellungskarte ein. Diese Seite listet jede eingebaute Komponente und verlinkt ihre Beschreibung.

![Die Komponentenpalette.](./images/component-palette.webp)

## Die Palette {#the-palette}

Das Suchfeld oben filtert die Palette nach Namen. Die Kategorien sind Logikgatter, Addierer und Selektoren, Speicher, Zeitsteuerung, Eingaben und Ausgaben, dazu Benutzerdefiniert, sobald du eine [benutzerdefinierte Komponente](docs:custom-components) gebaut hast. Ein Klick auf eine Kategorie klappt sie zu. Wie das Platzieren funktioniert, steht unter [Arbeitsfläche und Werkzeuge](docs:board-and-tools#placing-components).

Jede Komponente braucht einen Tick, um eine Änderung an ihren Ausgang weiterzugeben. Die Tabellen unten folgen der Reihenfolge der Palette.

### Logikgatter {#logic-gates}

| Komponente                                   | Was sie tut                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| [NICHT-Gatter](docs:logic-gates#not-gate)    | Invertiert seinen Eingang.                                                 |
| [UND-Gatter](docs:logic-gates#and-gate)      | Gibt 1 aus, wenn alle Eingänge 1 sind.                                     |
| [ODER-Gatter](docs:logic-gates#or-gate)      | Gibt 1 aus, wenn mindestens ein Eingang 1 ist.                             |
| [XOR-Gatter](docs:logic-gates#xor-gate)      | Gibt 1 aus, wenn eine ungerade Anzahl von Eingängen 1 ist.                 |
| [Tunnel](docs:wires-and-connections#tunnels) | Ist ohne Leitung mit jedem anderen Tunnel gleicher Beschriftung verbunden. |

### Addierer und Selektoren {#adders-and-selectors}

| Komponente                                               | Was sie tut                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Halbaddierer](docs:adders-and-selectors#half-adder)     | Addiert zwei Bits.                                                                |
| [Volladdierer](docs:adders-and-selectors#full-adder)     | Addiert zwei Bits und einen Übertrag.                                             |
| [Multiplexer](docs:adders-and-selectors#multiplexer)     | Gibt den Dateneingang, den die Auswahlleitungen wählen, an seinen Ausgang weiter. |
| [Demultiplexer](docs:adders-and-selectors#demultiplexer) | Gibt seinen Eingang an den Ausgang weiter, den die Auswahlleitungen wählen.       |
| [Dekodierer](docs:adders-and-selectors#decoder)          | Schaltet den einen Ausgang ein, dessen Nummer an den Eingängen anliegt.           |
| [Enkodierer](docs:adders-and-selectors#encoder)          | Gibt die Nummer des höchsten Eingangs aus, der 1 ist.                             |

### Speicher {#memory}

| Komponente                               | Was sie tut                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| [D-Flip-Flop](docs:memory#d-flip-flop)   | Speichert D bei der steigenden Flanke von CLK.                                       |
| [JK-Flip-Flop](docs:memory#jk-flip-flop) | Setzt, löscht oder kippt ein Bit bei der steigenden Flanke von CLK.                  |
| [SR-Flip-Flop](docs:memory#sr-flip-flop) | Setzt oder löscht ein Bit bei der steigenden Flanke von CLK.                         |
| [ROM](docs:memory#rom)                   | Gibt das gespeicherte Wort an der Adresse an seinen Eingängen aus.                   |
| [RAM](docs:memory#ram)                   | Speichert die Wörter, die die Schaltung schreibt, und gibt das an einer Adresse aus. |

### Zeitsteuerung {#timing}

| Komponente                                                        | Was sie tut                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Taktgeber](docs:clock-and-timing#clock)                          | Wechselt von selbst zwischen 0 und 1, als Rechteck oder als Puls.                   |
| [Durchpass](docs:clock-and-timing#delay)                          | Gibt seinen Eingang unverändert weiter, einen Tick später.                          |
| [Zufallsgenerator](docs:clock-and-timing#random-number-generator) | Legt bei jeder steigenden Flanke von CLK einen neuen Zufallswert an seine Ausgänge. |

### Eingaben {#inputs}

| Komponente                               | Was sie tut                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| [Schalter](docs:inputs#switch)           | Wechselt während einer Simulation mit jedem Klick zwischen 0 und 1.               |
| [Taster](docs:inputs#button)             | Gibt 1 aus, solange du ihn gedrückt hältst.                                       |
| [Impulstaster](docs:inputs#pulse-button) | Gibt pro Klick einen Impuls von einem Tick aus.                                   |
| [Gamepad](docs:inputs#gamepad)           | Ein Ausgang pro Taste eines Controllers, den du während einer Simulation spielst. |
| [Tastatur](docs:inputs#keyboard)         | Legt den Code jeder Taste, die du tippst, an ihre Ausgänge.                       |

### Ausgaben {#outputs}

| Komponente                                      | Was sie tut                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| [LED](docs:outputs#led)                         | Leuchtet, solange ihr Eingang 1 ist.                                             |
| [Segment Display](docs:outputs#segment-display) | Zeigt die Binärzahl an seinen Eingängen dezimal, hexadezimal oder oktal.         |
| [LED-Matrix](docs:outputs#led-matrix)           | Ein quadratisches LED-Raster, das Zeile für Zeile beschrieben wird.              |
| [Terminal](docs:outputs#terminal)               | Ein Textbildschirm, der bei jeder steigenden Flanke von CLK ein Zeichen ausgibt. |

## Die Einstellungskarte {#the-settings-card}

Wählst du genau eine Komponente aus oder nimmst eine zum Platzieren, erscheint neben der Arbeitsfläche ihre Einstellungskarte: Name, Beschreibung und Optionen. Während einer Simulation ist die Karte ausgeblendet.

![Die Einstellungskarte eines ausgewählten UND-Gatters.](./images/component-settings.webp)

- Richtung, die jede Komponente hat, hat vier Pfeil-Schaltflächen, die die Komponente drehen. Eine beim Platzieren gewählte Richtung bleibt für die nächste Komponente desselben Typs erhalten.
- Änderst du Eingänge, Ausgänge oder eine Größenoption, ändert sich die Zahl der Anschlüsse sofort.
- Die übrigen Optionen sind bei der jeweiligen Komponente beschrieben, etwa der Inhalt eines [ROM](docs:memory#rom), die Tastennamen eines [Gamepads](docs:inputs#gamepad) und die Bildschirmgröße eines [Terminals](docs:outputs#terminal).

## Einen Anschluss negieren {#negating-a-port}

Tippe mit dem Leitungswerkzeug auf einen Ein- oder Ausgang, um einen Negationskreis hinzuzufügen. Das Signal durch diesen Anschluss wird dann invertiert, ohne zusätzliche Verzögerung. Tippe erneut auf den Kreis, um ihn zu entfernen. Fährst du über einen Anschluss, zeigt das Leitungswerkzeug, was ein Tippen bewirken würde. Ein Kreis am CLK-Eingang eines [Flip-Flops](docs:memory) lässt es auf die fallende Flanke reagieren.

Tunnel, Eingangs- und Ausgangsstecker und die Anschlüsse einer platzierten benutzerdefinierten Komponente lassen sich nicht negieren.

![Ein ODER-Gatter mit negiertem Ausgang.](./images/negated-gate.webp)

## Textbeschriftungen {#text-labels}

Text steht nicht in der Palette. Klicke mit dem Werkzeug Text (`T`) auf die Arbeitsfläche, um eine Beschriftung „[insert text]“ zu setzen. „Text bearbeiten“ in ihrer Einstellungskarte öffnet einen Dialog für den Text, der über mehrere Zeilen gehen kann, und die Schriftgröße reicht von 2 bis 128. Leitungen laufen durch Beschriftungen, ohne sich mit ihnen zu verbinden. Ein Klick auf eine Leitung unter einer Beschriftung wählt die Leitung aus.

## Siehe auch {#see-also}

- [Logikgatter](docs:logic-gates): die erste der Seiten zu den Komponenten
- [Eingaben](docs:inputs): Schalter, Taster, das Gamepad und die Tastatur
- [Leitungen und Verbindungen](docs:wires-and-connections): Anschlüsse verbinden
- [Benutzerdefinierte Komponenten](docs:custom-components): eigene Bauteile bauen
- [Arbeitsfläche und Werkzeuge](docs:board-and-tools): platzieren, verschieben und drehen
