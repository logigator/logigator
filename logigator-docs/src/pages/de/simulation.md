# Simulation

„Simulation starten“ am rechten Ende der Werkzeugleiste setzt die Schaltung unter Strom: Leitungen unter Strom leuchten, LEDs und Anzeigen zeigen ihren Zustand, und Schalter und Taster reagieren auf Klicks. `Enter` tut dasselbe.

![Ein Taktgeber, der in einer laufenden Simulation eine LED ansteuert.](./images/simulation-showcase.webp)

## Starten und verlassen

Die Simulation läuft immer mit dem Hauptprojekt. Ist der Tab einer benutzerdefinierten Komponente offen, wechselt der Editor vorher zurück zum Hauptprojekt.

Während sie läuft, ist die Arbeitsfläche gesperrt. Du kannst die Ansicht verschieben und zoomen, Eingaben bedienen und ROMs, RAMs, Terminals und benutzerdefinierte Komponenten [inspizieren](docs:inspection), aber nichts platzieren, verschieben, verdrahten oder löschen. „Simulation verlassen“, `Enter` oder `Escape` führt mit dem Werkzeug Schwenken zurück zum Bearbeiten.

Ist „Simulation automatisch starten“ an (Standard), läuft die Schaltung los, sobald du die Simulation betrittst. Ist die Einstellung aus, wartet sie pausiert bei Tick 0, sodass du von Anfang an schrittweise vorgehen kannst.

## Steuerung

Während einer Simulation ersetzen vier Schaltflächen, die Geschwindigkeits-Schaltfläche und eine Anzeige die Werkzeugleiste.

| Schaltfläche  | Was sie tut                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Start         | Startet die Simulation oder setzt sie fort.                                                                   |
| Pause         | Hält beim aktuellen Tick an und behält den Zustand.                                                           |
| Einzelschritt | Geht einen Tick weiter. Nur im pausierten Zustand verfügbar.                                                  |
| Stopp         | Setzt die Schaltung auf Tick 0 zurück, schaltet alle Schalter aus und pausiert. Du bleibst in der Simulation. |

Die Anzeige zeigt die Ticks seit dem Start und, während die Simulation läuft, die tatsächlich erreichte Geschwindigkeit.

![Die Steuerung und die Geschwindigkeits-Schaltfläche.](./images/simulation-controls.webp)

## Geschwindigkeit

Die Geschwindigkeits-Schaltfläche zeigt die aktuelle Einstellung. Ein Klick darauf öffnet ein Feld mit drei Modi, zwischen denen du auch während des Laufs wechseln kannst:

- Jedes Bild, der Standard, geht pro Bildaufbau einen Tick weiter. Die Geschwindigkeit folgt also der Bildwiederholrate deines Bildschirms.
- Feste Geschwindigkeit tickt mit einer Rate, die du einstellst, anfangs 1 kHz. Der Regler reicht von 1 Hz bis 10 MHz. Im Feld daneben kannst du jede Rate ab 0,1 Hz eintippen, etwa `20`, `2,5k` oder `1M`. Ein rotes Feld heißt, dass die Eingabe keine Rate ist, und die letzte gültige gilt weiter. Kommt die Schaltung nicht mit, erscheint neben der Anzeige ein Warnzeichen.
- So schnell wie möglich läuft ohne Begrenzung. Der Bildschirm zeigt dann nur einen Teil der Ticks.

![Das Geschwindigkeitsfeld mit fester Geschwindigkeit von 10 Hz.](./images/simulation-speed.webp)

Unter den Modi listet „Taktgeber bei dieser Geschwindigkeit“ die Frequenz jeder Art von Taktgeber in der Schaltung. Ein Rechteck ist Verzögerung Ticks aus und dann ebenso lange an, ein Zyklus dauert also 2 × Verzögerung Ticks. Ein Puls ist nach Verzögerung Ticks aus einen Tick an, ein Zyklus dauert also Verzögerung + 1 Ticks. Bei 10 Hz läuft ein Rechteck mit Verzögerung 1 mit 5 Hz und eines mit Verzögerung 5 mit 1 Hz, ein Puls mit Verzögerung 4 mit 2 Hz. Bei fester Geschwindigkeit steht die Liste sofort da. In den beiden anderen Modi muss die Rate erst gemessen werden, daher erscheint die Liste etwa eine Sekunde, nachdem die Schaltung losgelaufen ist.

## Eingaben bedienen

- Ein Schalter wechselt mit jedem Klick und bleibt, wo du ihn lässt.
- Ein Taster ist an, solange du ihn gedrückt hältst. Er gibt weiter, was gerade gedrückt ist: Klickst du einer langsamen oder pausierten Simulation weit voraus, überspringt er ältere Klicks, dein letzter Klick kommt aber immer an.
- Ein Impulstaster sendet pro Klick einen Impuls von einem Tick, egal wie lange du ihn hältst. Er überspringt keinen Klick, egal wie weit du der Simulation voraus bist.
- Ein Gamepad öffnet seinen Controller, beschrieben im nächsten Abschnitt.
- Eine Tastatur öffnet ein Fenster zum Tippen, beschrieben nach dem Gamepad.

Ziehen an jeder anderen Stelle der Arbeitsfläche verschiebt die Ansicht.

## Ein Gamepad spielen

Ein Klick auf ein Gamepad öffnet ein Fenster mit einem gezeichneten Controller. Eine Taste, die du dort gedrückt hältst, setzt ihren Ausgang auf 1, bis du loslässt, und leuchtet auch auf der Arbeitsfläche. Wie ein Taster gibt das Gamepad weiter, was gerade gedrückt ist, und kann ältere Tastendrücke überspringen, wenn du einer langsamen oder pausierten Simulation weit voraus bist, während gleichzeitig gedrückte Tasten im selben Tick ankommen.

![Das Controller-Fenster eines Gamepads mit gedrücktem A und Rechts, neben dem Gamepad auf der Arbeitsfläche.](./images/gamepad-window.webp)

Das Fenster bekommt beim Öffnen die Tastatur, und die Zeile unten zeigt „Tastatur aktiv“. Klickst du auf die Arbeitsfläche oder ein anderes Fenster, steht dort „Hier klicken, um die Tastatur zu nutzen“, und Tastendrücke erreichen das Gamepad nicht mehr. Unter jeder Gamepad-Taste steht die Tastaturtaste dafür. Solange das Fenster die Tastatur hat, gehen die Tasten des Gamepads den Tastaturbefehlen vor: `Enter` drückt Start und verlässt die Simulation nicht. `Escape` schließt weiterhin das Fenster, und Tastaturbefehle mit `Ctrl` oder `Alt` funktionieren weiter. Die Standardtasten und wie du sie änderst, stehen unter [Tastaturbefehle](docs:shortcuts#tasten-des-gamepads).

Mit der Maus oder dem Finger bleibt eine Taste gedrückt, solange du sie hältst, und auf einem Touchscreen hält jeder Finger seine eigene Taste. Das Steuerkreuz hat acht Richtungen: Drückst du zwischen zwei Arme, sind beide gedrückt, und wenn du den Daumen weiterschiebst, wechselst du von einer Richtung zur nächsten, ohne abzusetzen. In der Mitte des Steuerkreuzes ist keine Richtung gedrückt.

Auch ein Gamecontroller, der mit deinem Computer verbunden ist, kann ein Gamepad spielen. Der Browser meldet einen Controller erst, nachdem du bei geöffnetem Editor eine seiner Tasten gedrückt hast. Tust du das bei offenem Gamepad-Fenster, wird der Controller mit diesem Fenster verbunden und erscheint unten im Controller-Menü. Ein Controller spielt sein Gamepad weiter, auch wenn ein anderes Fenster die Tastatur hat. So können zwei Controller zwei Gamepads gleichzeitig spielen, jeder in seinem eigenen Fenster ausgewählt. Die Tasten werden nach ihrer Lage zugeordnet, egal wie sie beschriftet sind: Die rechte Aktionstaste ist A, die untere B, die obere X und die linke Y. Steuerkreuz und linker Stick bedienen beide das Steuerkreuz, LB und LT sind L, RB und RT sind R, Back oder Share ist Select, und Start ist Start. Controller, die der Browser nicht mit der Standardbelegung meldet, stehen in der Liste, lassen sich aber nicht auswählen.

Schließt du das Fenster oder verlässt die Simulation, werden alle Tasten losgelassen. Ein Gamepad in einer benutzerdefinierten Komponente spielst du aus einer [Beobachtung](docs:inspection#beobachtungen) heraus. In der Touch-Ansicht öffnet sich der Controller in der Leiste am unteren Bildschirmrand; die Tastenbeschriftungen erscheinen dort, sobald du eine Taste auf einer Tastatur drückst, und das Controller-Menü, sobald ein Controller verbunden ist.

## In eine Tastatur tippen

Ein Klick auf eine Tastatur öffnet ein Fenster mit einem Eingabefeld oben. Solange das Feld den Fokus hat, gehen die Tasten, die du drückst, an die Schaltung. Eine Taste, die du drückst, legt ihren Code an D0 bis D7 an, gibt an STB einen Impuls von einem Tick aus und schaltet KD ein. KD bleibt an, solange du die Taste hältst, und geht aus, wenn du loslässt. D behält das Zeichen, bis die nächste Taste es ersetzt. Auf der Arbeitsfläche zeigt das Kästchen in der Tastatur das Zeichen an D und leuchtet, solange KD an ist.

![Das Fenster einer Tastatur mit getipptem hello und world und gedrücktem d, neben der Tastatur auf der Arbeitsfläche, die d zeigt.](./images/keyboard-window.webp)

Das Feld zeigt die letzten 64 gesendeten Zeichen, das neueste rechts, und hebt das Zeichen an D hervor, solange eine Taste gehalten wird. Darunter steht bei „An D“ der Code, den die Schaltung gerade bekommt: das Zeichen, sein Hex-Wert und seine 8 Bits. Die Zeile darunter lautet „Eingaben gehen an die Schaltung · Umschalt+Tab zum Verlassen“, solange das Feld den Fokus hat. Klickst du woanders hin, steht dort „Hier klicken, um zu tippen“, und Tasten erreichen die Tastatur erst wieder, wenn du ins Fenster klickst.

Eine gehaltene Taste wiederholt sich nicht, STB gibt also pro Tastendruck einen Impuls aus. An KD erkennt eine Schaltung, ob eine Taste gehalten wird: Soll sie eine gehaltene Taste wiederholen, kann sie einen Taktgeber laufen lassen, solange KD an ist, und zählt sie Tastendrücke, kann sie die Impulse an KD zählen. Drückst du eine zweite Taste, bevor du die erste loslässt, liegt der Code der zweiten an D an, mit einem neuen Impuls an STB, und KD bleibt an, bis du beide losgelassen hast.

Der Code ist Latin-1: ASCII und dazu die Buchstaben mit Akzent und die Symbole westeuropäischer Sprachen. Druckbare Zeichen, vom Leerzeichen bis `~` und von `0xA0` bis ÿ, werden unverändert gesendet, ä kommt also als `0xE4` an. Das geschützte Leerzeichen (`0xA0`) und der weiche Trennstrich (`0xAD`) erscheinen als NBS und SHY, weil man sie nicht sieht. Diese Tasten senden Steuerzeichen, die auf der Arbeitsfläche und bei „An D“ mit ihrem Namen erscheinen:

| Taste       | Code   | Angezeigt als |
| ----------- | ------ | ------------- |
| `Enter`     | `0x0A` | LF            |
| `Backspace` | `0x08` | BS            |
| `Tab`       | `0x09` | TAB           |
| `Escape`    | `0x1B` | ESC           |
| `Delete`    | `0x7F` | DEL           |
| `→`         | `0x1C` | RT            |
| `←`         | `0x1D` | LT            |
| `↑`         | `0x1E` | UP            |
| `↓`         | `0x1F` | DN            |
| `Home`      | `0x0B` | HOM           |

Ein [Terminal](#auf-einem-terminal-ausgeben) versteht jedes dieser Steuerzeichen außer ESC. An eine Tastatur angeschlossen, gibt es also aus, was du tippst.

Die Funktionstasten, `End`, `Page Up`, `Page Down` und `Insert` senden nichts, ebenso die Pfeiltasten und `Home`, solange du `Shift` hältst. Typografische Anführungszeichen und lange Striche werden als `'`, `"` und `-` gesendet, … als drei Punkte. Jedes andere Zeichen außerhalb von Latin-1, etwa € oder ein Emoji, wird übersprungen, und die Zeile unten weist ein paar Sekunden lang darauf hin. Zeichen, die du mit `AltGr` tippst, etwa das @ auf einer deutschen Tastatur, werden gesendet. Tastenkombinationen mit `Ctrl`, `Alt` oder `⌘` bleiben dem Browser überlassen. Welche Tasten an die Schaltung gehen statt an den Editor, steht unter [Tastaturbefehle](docs:shortcuts#tasten-im-fenster-einer-tastatur).

Eingefügter Text wird Zeichen für Zeichen gesendet. „Text eingeben…“ unten im Fenster öffnet einen Dialog, in dem du einen längeren Text schreiben oder einfügen kannst, etwa ein Programm. Er zeigt vor dem Senden, wie viele Zeichen übersprungen werden. Zeilenumbrüche werden als LF gesendet und Tabulatoren als TAB, andere Steuerzeichen fallen weg, und ein Einfügen oder ein „Senden“ nimmt bis zu 10.000 Zeichen. Jedes Zeichen kommt an wie eine Taste, die gedrückt und losgelassen wird: KD ist drei Ticks an, STB geht einen Tick nach dem Code auf 1 und einen Tick, bevor KD ausgeht, zurück auf 0. So liest eine Schaltung, die D bei steigendem STB speichert, jedes Zeichen richtig, auch wenn auf dem Weg von D ein Gatter mehr liegt als auf dem von STB oder umgekehrt. Nach jedem Zeichen ist KD einen Tick aus, sodass auch ein doppelter Buchstabe als zwei Impulse an KD ankommt. Solange Zeichen warten, zeigt das Fenster „Sende“ mit der Zahl der übrigen und ein ✕, das den Rest verwirft. Ein Zeichen, dessen Impuls an STB schon begonnen hat, kommt trotzdem noch an, und KD geht aus. Das kommt auch vor, wenn du schneller tippst, als die Simulation läuft, etwa bei einer niedrigen festen Geschwindigkeit. Höchstens 21.845 Zeichen können gleichzeitig warten, und ein Einfügen oder „Senden“, das nicht mehr dahinter passt, wird gar nicht gesendet, auch nicht teilweise: Das Fenster oder der Dialog bittet dich stattdessen, auf sie zu warten.

Ist die Simulation pausiert, warten Tasten auf „Einzelschritt“. Eine Taste, die du drückst und loslässt, liegt nach dem nächsten Schritt an D an, und KD ist an. Nach dem zweiten ist STB 1, nach dem dritten wieder 0, und nach dem vierten ist KD aus, während das Zeichen an D bleibt. Das nächste Zeichen folgt nach dem fünften, ein eingefügter Text braucht also vier Schritte pro Zeichen.

Schließt du das Fenster, klickst daneben oder wechselst in einen anderen Tab, werden alle gehaltenen Tasten losgelassen. „Stopp“ leert die Zeichen im Feld. In eine Tastatur in einer benutzerdefinierten Komponente tippst du aus einer [Beobachtung](docs:inspection#beobachtungen) heraus. Auf einem Smartphone oder Tablet öffnet sich das Fenster in der Leiste am unteren Bildschirmrand (siehe [Smartphones und Tablets](docs:phones-and-tablets#simulation-und-inspektion)).

## Auf einem Terminal ausgeben

Ein Terminal gibt jedes Mal ein Zeichen aus, wenn sein Eingang CLK steigt: das Zeichen, dessen Code in diesem Tick an D0 bis D7 anliegt. Mit einem Negationskreis an CLK gibt es stattdessen bei der fallenden Flanke aus. Das nächste Zeichen erscheint dort, wo der Block-Cursor steht, den der Bildschirm nur während einer Simulation zeigt.

Um zu sehen, was du tippst, verbinde D0 bis D7 einer Tastatur mit D0 bis D7 des Terminals und ihren Ausgang STB mit CLK. `Enter` beginnt dann eine neue Zeile, `Backspace` löscht das Zeichen vor dem Cursor, und die Pfeiltasten und `Home` bewegen den Cursor.

Die Codes sind Latin-1, wie bei der Tastatur. Codes vom Leerzeichen bis `~` und von `0xA0` bis ÿ erscheinen als ihr Zeichen, `0x41` gibt also A aus und `0xE4` ä. Das geschützte Leerzeichen erscheint als Leerzeichen und der weiche Trennstrich als Bindestrich. Diese Steuerzeichen bewegen den Cursor oder löschen:

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

Ein Zeichen in der letzten Spalte lässt den Cursor dort stehen, und das nächste Zeichen kommt an den Anfang der nächsten Zeile. Stand der Cursor in der untersten Zeile, rollt der Bildschirm dafür. Eine volle Zeile mit einem LF danach hinterlässt deshalb keine leere Zeile. Ein Code, der den Cursor bewegt, hebt diesen Umbruch auf, sodass ein BS direkt nach der letzten Spalte das Zeichen löscht, das dort steht.

Eine Zeile, die oben aus dem Bildschirm rollt, kommt so in den Verlauf, wie sie war, und die Cursor-Codes können sie nicht mehr ändern. Der Verlauf behält die letzten 10.000 Zeilen und erscheint im [Fenster](docs:inspection#terminal-ausgabe) des Terminals. „Pause“ behält den Text auf dem Bildschirm und im Verlauf. „Stopp“ leert beides, ebenso das Verlassen der Simulation.

## Widersprüchliche Signale

Eine orange gezeichnete Leitung hat einen Konflikt. Dafür gibt es zwei Ursachen:

- Zwei oder mehr Ausgänge sind an dieselbe Leitung angeschlossen, und in diesem Moment gibt einer 1 aus und ein anderer 0. Ausgänge, die übereinstimmen, werden nicht markiert, das Orange kann also kommen und gehen, wenn sich die Werte ändern.
- Ein SR-Flip-Flop wurde mit S und R gleichzeitig auf 1 getaktet. Q geht auf 1 und !Q auf 0, und beide bleiben orange, bis eine Taktflanke kommt, bei der nur S oder nur R auf 1 ist.

Die Simulation läuft unverändert weiter: Eine Leitung mit mehreren Ausgängen ist 1, sobald einer davon 1 ist. Das Orange ist ein Hinweis auf deine Schaltung. In echter Hardware wäre der erste Fall ein Kurzschluss, und der zweite ist eine Eingangsbelegung, die ein SR-Flip-Flop nicht erlaubt.

Für den ersten Fall schließt du an jede Leitung nur einen Ausgang an. Willst du mehrere Quellen zusammenführen, leite sie durch ein ODER-Gatter, und um eine davon auszuwählen, nimm einen Multiplexer. Beim SR-Flip-Flop setzt du S und R nicht gleichzeitig auf 1, oder du nimmst stattdessen ein D- oder JK-Flip-Flop.

Ein Konflikt in einer benutzerdefinierten Komponente erscheint nicht auf der Arbeitsfläche. Klicke auf die Komponente, um eine [Beobachtung](docs:inspection#beobachtungen) zu öffnen, in der ihre Leitungen ihn zeigen.

Die Einstellung „Konflikte hervorheben“, standardmäßig an, schaltet das Orange ab. Siehe [Einstellungen](docs:settings).

## Wenn die Simulation nicht startet

Der Editor startet nicht und zeigt eine Meldung mit der betroffenen Komponente, wenn

- eine benutzerdefinierte Komponente sich selbst enthält, direkt oder über eine andere,
- eine benutzerdefinierte Komponente keine Schaltung enthält,
- die Anschlüsse einer benutzerdefinierten Komponente nicht mehr zu den Eingangs- und Ausgangssteckern in ihrer Schaltung passen.

Behebe das bei der genannten Komponente und starte erneut. Sagt die Meldung, dass die Simulations-Engine nicht starten konnte, unterstützt dein Browser kein WebAssembly.

## Siehe auch

- [Inspektion und Beobachtungen](docs:inspection): ROM- und RAM-Inhalte, Terminal-Ausgabe und Beobachtungen
- [Komponenten und Optionen](docs:components-and-options): was jede Eingabe und Anzeige tut
- [Einstellungen](docs:settings): „Simulation automatisch starten“ und „Konflikte hervorheben“
- [Smartphones und Tablets](docs:phones-and-tablets): die Steuerung in der Touch-Ansicht
