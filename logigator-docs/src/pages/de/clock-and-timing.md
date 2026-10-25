# Zeitsteuerung

Diese Komponenten arbeiten mit der Zeit, gezählt in Simulations-Ticks. Ein Taktgeber schaltet seinen Ausgang von selbst ein und aus, ein Durchpass gibt ein Signal einen Tick später weiter, und ein Zufallsgenerator legt bei jedem Takt neue Zufallsbits an seine Ausgänge.

## Taktgeber {#clock}

![Ein Taktgeber mit einem ausgeschalteten Schalter an STP und einer LED am Ausgang, ein Tick pro Bild. Mit Verzögerung 1 geht die LED jeden Tick an und aus.](./images/component-clock.webp)

Ein Taktgeber schaltet seinen Ausgang immer wieder zwischen 0 und 1 um, in einem Rhythmus, den seine Option Verzögerung festlegt. Damit treibst du Zähler und alles andere an, was sich schrittweise bewegt.

| Anschluss | Richtung | Bedeutung                                         |
| --------- | -------- | ------------------------------------------------- |
| STP       | ein      | Stopp: hält den Taktgeber auf 0, solange er 1 ist |
| CLK       | aus      | Das Taktsignal                                    |

| Option      | Werte               | Standard |
| ----------- | ------------------- | -------- |
| Signalform  | Rechteck, Puls      | Rechteck |
| Verzögerung | 1 bis 4.294.967.295 | 1        |

Jeder Zyklus beginnt mit dem Ausgang für Verzögerung Ticks auf 0. Was folgt, hängt von der Signalform ab:

| Signalform | Ausgang 0 für     | Dann Ausgang 1 für | Ein Zyklus dauert     |
| ---------- | ----------------- | ------------------ | --------------------- |
| Rechteck   | Verzögerung Ticks | Verzögerung Ticks  | 2 × Verzögerung Ticks |
| Puls       | Verzögerung Ticks | 1 Tick             | Verzögerung + 1 Ticks |

Sobald STP wieder 0 ist, beginnt der Taktgeber einen neuen Zyklus von vorn.

Wie schnell der Taktgeber in Sekunden läuft, hängt von der Simulationsgeschwindigkeit ab: Teile die Ticks pro Sekunde durch die Ticks pro Zyklus. Bei einer festen Geschwindigkeit von 10 Hz:

| Signalform | Verzögerung | Ein Zyklus dauert | Frequenz |
| ---------- | ----------- | ----------------- | -------- |
| Rechteck   | 1           | 2 Ticks           | 5 Hz     |
| Rechteck   | 5           | 10 Ticks          | 1 Hz     |
| Puls       | 4           | 5 Ticks           | 2 Hz     |

Das Geschwindigkeitsfeld listet diese Frequenzen für jeden Taktgeber der Schaltung unter „Taktgeber bei dieser Geschwindigkeit“. Siehe [Geschwindigkeit](docs:simulation#speed).

## Durchpass {#delay}

![Ein Schalter, der eine LED direkt und eine zweite LED über einen Durchpass ansteuert, ein Tick pro Bild. Die LED hinter dem Durchpass geht einen Tick nach der anderen an und aus.](./images/component-delay.webp)

Ein Durchpass gibt seinen Eingang unverändert weiter, einen Tick später. Wie jede andere Komponente braucht er einen Tick, um eine Änderung weiterzugeben, und mehr fügt er nicht hinzu. Eine Kette davon hält ein Signal um je einen Tick zurück, etwa um zwei Wege durch eine Schaltung gleich lang zu machen.

| Anschluss | Richtung | Bedeutung                          |
| --------- | -------- | ---------------------------------- |
| Eingang   | ein      | Das weiterzugebende Signal         |
| Ausgang   | aus      | Dasselbe Signal, einen Tick später |

Außer Richtung hat er keine Optionen.

## Zufallsgenerator {#random-number-generator}

![Ein Zufallsgenerator mit der Option Ausgänge auf 4, einem Impulstaster an CLK und einem Segment Display an seinen Ausgängen, das nach jedem Impuls eine neue Zahl zeigt.](./images/component-random-number-generator.webp)

Ein Zufallsgenerator legt bei jeder steigenden Flanke von CLK einen neuen Zufallswert an seine Ausgänge. Zwischen den Flanken behalten die Ausgänge ihren Wert.

| Anschluss  | Richtung | Bedeutung                                      |
| ---------- | -------- | ---------------------------------------------- |
| CLK        | ein      | Jede steigende Flanke erzeugt einen neuen Wert |
| 0, 1, 2, … | aus      | Die Zufallsbits, eines pro Ausgang             |

| Option   | Werte    | Standard |
| -------- | -------- | -------- |
| Ausgänge | 1 bis 64 | 1        |

Mit einem [Negationskreis](docs:components-and-options#negating-a-port) an CLK erzeugt er stattdessen bei der fallenden Flanke einen neuen Wert.

## Siehe auch {#see-also}

- [Simulation](docs:simulation): Ticks, Steuerung und die Simulationsgeschwindigkeit
- [Eingaben](docs:inputs): Schalter und Taster, um STP oder CLK von Hand zu steuern
- [Ausgaben](docs:outputs): LEDs und Anzeigen, um ein Signal zu zeigen
- [Komponenten und Optionen](docs:components-and-options): die Palette und die Einstellungskarte
