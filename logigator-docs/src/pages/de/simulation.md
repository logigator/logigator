# Simulation

„Simulation starten“ am rechten Ende der Werkzeugleiste setzt die Schaltung unter Strom: Leitungen unter Strom leuchten, LEDs und Anzeigen zeigen ihren Zustand, und Schalter und Taster reagieren auf Klicks. `Enter` tut dasselbe.

![Ein Taktgeber, der in einer laufenden Simulation eine LED ansteuert.](./images/simulation-showcase.webp)

## Starten und verlassen

Die Simulation läuft immer mit dem Hauptprojekt. Ist der Tab einer benutzerdefinierten Komponente offen, wechselt der Editor vorher zurück zum Hauptprojekt.

Während sie läuft, ist die Arbeitsfläche gesperrt. Du kannst die Ansicht verschieben und zoomen, Eingaben bedienen und ROMs und benutzerdefinierte Komponenten [inspizieren](docs:inspection), aber nichts platzieren, verschieben, verdrahten oder löschen. „Simulation verlassen“, `Enter` oder `Escape` führt mit dem Werkzeug Schwenken zurück zum Bearbeiten.

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

Ziehen an jeder anderen Stelle der Arbeitsfläche verschiebt die Ansicht.

## Wenn die Simulation nicht startet

Der Editor startet nicht und zeigt eine Meldung mit der betroffenen Komponente, wenn

- eine benutzerdefinierte Komponente sich selbst enthält, direkt oder über eine andere,
- eine benutzerdefinierte Komponente keine Schaltung enthält,
- die Anschlüsse einer benutzerdefinierten Komponente nicht mehr zu den Eingangs- und Ausgangssteckern in ihrer Schaltung passen.

Behebe das bei der genannten Komponente und starte erneut. Sagt die Meldung, dass die Simulations-Engine nicht starten konnte, unterstützt dein Browser kein WebAssembly.

## Siehe auch

- [Inspektion und Beobachtungen](docs:inspection): ROM-Inhalte und Beobachtungen
- [Komponenten und Optionen](docs:components-and-options): was jede Eingabe und Anzeige tut
- [Einstellungen](docs:settings): „Simulation automatisch starten“
- [Smartphones und Tablets](docs:phones-and-tablets): die Steuerung in der Touch-Ansicht
