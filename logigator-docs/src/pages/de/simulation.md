# Simulation

„Simulation starten“ am rechten Ende der Werkzeugleiste setzt die Schaltung unter Strom: Leitungen unter Strom leuchten, LEDs und Anzeigen zeigen ihren Zustand, und Schalter und Taster reagieren auf Klicks. `Enter` tut dasselbe.

![Ein Taktgeber, der in einer laufenden Simulation eine LED ansteuert.](./images/simulation-showcase.webp)

## Starten und verlassen

Die Simulation läuft immer mit dem Hauptprojekt. Ist der Tab einer benutzerdefinierten Komponente offen, wechselt der Editor vorher zurück zum Hauptprojekt.

Während sie läuft, ist die Arbeitsfläche gesperrt. Du kannst die Ansicht verschieben und zoomen, Eingaben bedienen und ROMs, RAMs und benutzerdefinierte Komponenten [inspizieren](docs:inspection), aber nichts platzieren, verschieben, verdrahten oder löschen. „Simulation verlassen“, `Enter` oder `Escape` führt mit dem Werkzeug Schwenken zurück zum Bearbeiten.

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

Unter den Modi listet „Taktgeber bei dieser Geschwindigkeit“ die Frequenz, die jede Verzögerung eines Taktgebers in der Schaltung ergibt. Ein Taktgeber ist einen Tick an und Verzögerung Ticks aus, ein Zyklus dauert also Verzögerung + 1 Ticks: Bei 10 Hz läuft ein Taktgeber mit Verzögerung 1 mit 5 Hz, einer mit Verzögerung 4 mit 2 Hz. Bei fester Geschwindigkeit steht die Liste sofort da. In den beiden anderen Modi muss die Rate erst gemessen werden, daher erscheint die Liste etwa eine Sekunde, nachdem die Schaltung losgelaufen ist.

## Eingaben bedienen

- Ein Schalter wechselt mit jedem Klick und bleibt, wo du ihn lässt.
- Ein Taster ist an, solange du ihn gedrückt hältst.
- Ein Impulstaster sendet pro Klick einen Impuls von einem Tick, egal wie lange du ihn hältst.
- Ein Gamepad öffnet seinen Controller, beschrieben im nächsten Abschnitt.
- Eine Tastatur öffnet ein Fenster zum Tippen, beschrieben nach dem Gamepad.

Ziehen an jeder anderen Stelle der Arbeitsfläche verschiebt die Ansicht.

## Ein Gamepad spielen

Ein Klick auf ein Gamepad öffnet ein Fenster mit einem gezeichneten Controller. Eine Taste, die du dort gedrückt hältst, setzt ihren Ausgang auf 1, bis du loslässt, und leuchtet auch auf der Arbeitsfläche.

![Das Controller-Fenster eines Gamepads mit gedrücktem A und Rechts, neben dem Gamepad auf der Arbeitsfläche.](./images/gamepad-window.webp)

Das Fenster bekommt beim Öffnen die Tastatur, und die Zeile unten zeigt „Tastatur aktiv“. Klickst du auf die Arbeitsfläche oder ein anderes Fenster, steht dort „Hier klicken, um die Tastatur zu nutzen“, und Tastendrücke erreichen das Gamepad nicht mehr. Unter jeder Gamepad-Taste steht die Tastaturtaste dafür. Solange das Fenster die Tastatur hat, gehen die Tasten des Gamepads den Tastaturbefehlen vor: `Enter` drückt Start und verlässt die Simulation nicht. `Escape` schließt weiterhin das Fenster, und Tastaturbefehle mit `Ctrl` oder `Alt` funktionieren weiter. Die Standardtasten und wie du sie änderst, stehen unter [Tastaturbefehle](docs:shortcuts#tasten-des-gamepads).

Mit der Maus oder dem Finger bleibt eine Taste gedrückt, solange du sie hältst, und auf einem Touchscreen hält jeder Finger seine eigene Taste. Das Steuerkreuz hat acht Richtungen: Drückst du zwischen zwei Arme, sind beide gedrückt, und wenn du den Daumen weiterschiebst, wechselst du von einer Richtung zur nächsten, ohne abzusetzen. In der Mitte des Steuerkreuzes ist keine Richtung gedrückt.

Auch ein Gamecontroller, der mit deinem Computer verbunden ist, kann ein Gamepad spielen. Der Browser meldet einen Controller erst, nachdem du bei geöffnetem Editor eine seiner Tasten gedrückt hast. Tust du das bei offenem Gamepad-Fenster, wird der Controller mit diesem Fenster verbunden und erscheint unten im Controller-Menü. Ein Controller spielt sein Gamepad weiter, auch wenn ein anderes Fenster die Tastatur hat. So können zwei Controller zwei Gamepads gleichzeitig spielen, jeder in seinem eigenen Fenster ausgewählt. Die Tasten werden nach ihrer Lage zugeordnet, egal wie sie beschriftet sind: Die rechte Aktionstaste ist A, die untere B, die obere X und die linke Y. Steuerkreuz und linker Stick bedienen beide das Steuerkreuz, LB und LT sind L, RB und RT sind R, Back oder Share ist Select, und Start ist Start. Controller, die der Browser nicht mit der Standardbelegung meldet, stehen in der Liste, lassen sich aber nicht auswählen.

Schließt du das Fenster oder verlässt die Simulation, werden alle Tasten losgelassen. Ein Gamepad in einer benutzerdefinierten Komponente spielst du aus einer [Beobachtung](docs:inspection#beobachtungen) heraus. In der Touch-Ansicht öffnet sich der Controller in der Leiste am unteren Bildschirmrand; die Tastenbeschriftungen erscheinen dort, sobald du eine Taste auf einer Tastatur drückst, und das Controller-Menü, sobald ein Controller verbunden ist.

## In eine Tastatur tippen

Ein Klick auf eine Tastatur öffnet ein Fenster mit einem Eingabefeld oben. Solange das Feld den Fokus hat, gehen die Tasten, die du drückst, an die Schaltung. Eine Taste, die du drückst, legt ihren ASCII-Code an D0 bis D6 an und gibt an STB einen Impuls von einem Tick aus. Der Code liegt an, solange du die Taste hältst, und D geht auf 0 zurück, wenn du loslässt. Auf der Arbeitsfläche zeigt das Kästchen in der Tastatur das Zeichen an D.

![Das Fenster einer Tastatur mit getipptem hello und world und gedrücktem d, neben der Tastatur auf der Arbeitsfläche, die d zeigt.](./images/keyboard-window.webp)

Das Feld zeigt die letzten 64 gesendeten Zeichen, das neueste rechts, und hebt das gehaltene hervor. Darunter steht bei „An D“ der Code, den die Schaltung gerade bekommt: das Zeichen, sein Hex-Wert und seine 7 Bits. Die Zeile darunter lautet „Eingaben gehen an die Schaltung · Umschalt+Tab zum Verlassen“, solange das Feld den Fokus hat. Klickst du woanders hin, steht dort „Hier klicken, um zu tippen“, und Tasten erreichen die Tastatur erst wieder, wenn du ins Fenster klickst.

Eine gehaltene Taste wiederholt sich nicht, STB gibt also pro Tastendruck einen Impuls aus. Soll eine Schaltung eine gehaltene Taste wiederholen, kann sie einen Taktgeber laufen lassen, solange D nicht 0 ist. Keine Taste sendet 0, also ist ein ODER über D0 bis D6 genau dann 1, wenn eine Taste gehalten wird. Drückst du eine zweite Taste, bevor du die erste loslässt, liegt der Code der zweiten an D an, mit einem neuen Impuls an STB. Lässt du die zweite los, geht D auf 0, auch wenn die erste noch gedrückt ist.

Druckbare ASCII-Zeichen, vom Leerzeichen bis `~`, werden unverändert gesendet. Diese Tasten senden Steuerzeichen, die auf der Arbeitsfläche und bei „An D“ mit ihrem Namen erscheinen:

| Taste       | Code   | Angezeigt als |
| ----------- | ------ | ------------- |
| `Enter`     | `0x0A` | LF            |
| `Backspace` | `0x08` | BS            |
| `Tab`       | `0x09` | TAB           |
| `Escape`    | `0x1B` | ESC           |
| `Delete`    | `0x7F` | DEL           |

Die Pfeiltasten, die Funktionstasten, `Home`, `End`, `Page Up`, `Page Down` und `Insert` senden nichts. Ein Zeichen außerhalb von ASCII, etwa ä oder €, wird übersprungen, und die Zeile unten weist ein paar Sekunden lang darauf hin. Zeichen, die du mit `AltGr` tippst, etwa das @ auf einer deutschen Tastatur, werden gesendet. Tastenkombinationen mit `Ctrl`, `Alt` oder `⌘` bleiben dem Browser überlassen. Welche Tasten an die Schaltung gehen statt an den Editor, steht unter [Tastaturbefehle](docs:shortcuts#tasten-im-fenster-einer-tastatur).

Eingefügter Text wird Zeichen für Zeichen gesendet. „Text eingeben…“ unten im Fenster öffnet einen Dialog, in dem du einen längeren Text schreiben oder einfügen kannst, etwa ein Programm. Er zeigt vor dem Senden, wie viele Zeichen übersprungen werden. Zeilenumbrüche werden als LF gesendet, und ein Einfügen oder ein „Senden“ nimmt bis zu 10.000 Zeichen. Jedes Zeichen liegt mindestens zwei Ticks an D an, und danach folgen mindestens zwei Ticks mit 0, sodass auch ein doppelter Buchstabe als zwei Tastendrücke ankommt. Solange Zeichen warten, zeigt das Fenster „Sende“ mit der Zahl der übrigen und ein ✕, das den Rest verwirft. Das kommt auch vor, wenn du schneller tippst, als die Simulation läuft, etwa bei einer niedrigen festen Geschwindigkeit. Höchstens 32.768 Zeichen können gleichzeitig warten, und ein Einfügen oder „Senden“, das nicht mehr dahinter passt, wird gar nicht gesendet, auch nicht teilweise: Das Fenster oder der Dialog bittet dich stattdessen, auf sie zu warten.

Ist die Simulation pausiert, warten Tasten auf „Einzelschritt“. Eine Taste, die du drückst und loslässt, liegt nach dem nächsten Schritt an D an, ist nach dem zweiten noch da und nach dem dritten wieder weg. Das nächste Zeichen folgt nach dem fünften, ein eingefügter Text braucht also vier Schritte pro Zeichen.

Schließt du das Fenster, klickst daneben oder wechselst in einen anderen Tab, wird die gehaltene Taste losgelassen. „Stopp“ leert die Zeichen im Feld. In eine Tastatur in einer benutzerdefinierten Komponente tippst du aus einer [Beobachtung](docs:inspection#beobachtungen) heraus. Auf einem Smartphone oder Tablet öffnet sich das Fenster in der Leiste am unteren Bildschirmrand (siehe [Smartphones und Tablets](docs:phones-and-tablets#simulation-und-inspektion)).

## Wenn die Simulation nicht startet

Der Editor startet nicht und zeigt eine Meldung mit der betroffenen Komponente, wenn

- eine benutzerdefinierte Komponente sich selbst enthält, direkt oder über eine andere,
- eine benutzerdefinierte Komponente keine Schaltung enthält,
- die Anschlüsse einer benutzerdefinierten Komponente nicht mehr zu den Eingangs- und Ausgangssteckern in ihrer Schaltung passen.

Behebe das bei der genannten Komponente und starte erneut. Sagt die Meldung, dass die Simulations-Engine nicht starten konnte, unterstützt dein Browser kein WebAssembly.

## Siehe auch

- [Inspektion und Beobachtungen](docs:inspection): ROM- und RAM-Inhalte und Beobachtungen
- [Komponenten und Optionen](docs:components-and-options): was jede Eingabe und Anzeige tut
- [Einstellungen](docs:settings): „Simulation automatisch starten“
- [Smartphones und Tablets](docs:phones-and-tablets): die Steuerung in der Touch-Ansicht
