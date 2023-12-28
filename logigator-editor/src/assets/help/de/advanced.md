# Fortgeschrittene Gatter

## Halbaddierer

<div class="rows">

| A   | B   | Sum | Carry |
| --- | --- | --- | ----- |
| 0   | 0   | 0   | 0     |
| 1   | 0   | 1   | 0     |
| 0   | 1   | 1   | 0     |
| 1   | 1   | 0   | 1     |

<div class="margin-left">

Addiert zwei einstellige Binärzahlen. `Sum` ist das einstellige Ergebnis der Addition. `Carry` stellt den Overflow (die linke Stelle) dar.
</div>
</div>

## Volladdierer

<div class="rows">

| A   | B   | Cin | Sum | Carry |
| --- | --- | --- | --- | ----- |
| 0   | 0   | 0   | 0   | 0     |
| 0   | 0   | 1   | 1   | 0     |
| 0   | 1   | 0   | 1   | 0     |
| 0   | 1   | 1   | 0   | 1     |
| 1   | 0   | 0   | 1   | 0     |
| 1   | 0   | 1   | 0   | 1     |
| 1   | 1   | 0   | 0   | 1     |
| 1   | 1   | 1   | 1   | 1     |

<div class="margin-left">

Addiert drei einstellige Binärzahlen.
</div>
</div>

## ROM

<div class="rows">

![Rom Data Edit](assets/help/rom-edit.jpg)

<div class="margin-left">

`Read only Memory` - Daten können hexadezimal geschrieben und gespeichert werden.
Kann z.B. für Programmcode verwendet werden.
</div>
</div>

## D Flip-Flop

<div class="rows">

| D   | Q   | Q Inverse |
| --- | --- | --------- |
| 1   | 1   | 0         |
| 0   | 0   | 1         |

<div class="margin-left">

`Data` oder `Delay` Flip-Flop - Hält einen Zustand. Wenn (CLK) high ist, wird (Q) zu (D) gesetzt. (Q Inverse) ist immer (Q) invertiert.

</div>
</div>

## JK Flip-Flop

<div class="rows">

| J    | K    | Q         | Q Inverse |
| ---- | ---- | --------- | --------- |
| 1    | 1    | Toggle    | Toggle    |
| 1    | 0    | 1         | 0         |
| 0    | 1    | 0         | 1         |
| 0    | 0    | No change | No change |

<div class="margin-left">

Hält einen Zustand. (J) repräsentiert `set`, (K) repräsentiert `reset`. Sobald (CLK) high ist, wird (Q) high, falls (J) high ist, bzw. low, falls (K) high ist. (Q) ändert sich nicht, wenn sowohl (J), als auch (K) low sind. Es schaltet um (toogle), wenn (J) und (K) beide high sind.
</div>
</div>

## SR Flip-Flop

<div class="rows">

| S    | R    | Q         | Q Inverse |
| ---- | ---- | --------- | --------- |
| 0    | 0    | No change | No change |
| 1    | 0    | 1         | 0         |
| 0    | 1    | 0         | 1         |
| 1    | 1    | Invalid   | Invalid   |

<div class="margin-left">

Hält einen Zustand. (S) repräsentiert `set`, (R) repräsentiert `reset`. Sobald (CLK) high ist, wird (Q) high, falls (S) high ist, bzw. low, falls (R) high ist. (Q) ändert sich nicht, wenn (S) und (R) gleich sind.
</div>
</div>

## Zufallsgenerator

Diese Komponente generiert Zufallszahlen, immer wenn sich der CLK Eingang von Low auf High ändert.

## RAM

Random Access Memory. Speichert Eingänge, sobald CLK High ist.<br>
Um zu schreiben setzte WE auf High, um zu lesen, setze es auf Low.

## Dekodierer

<div class="rows">

| I1 | I2 | 0 | 1 | 2 | 3 |
|----|----|---|---|---|---|
| 0  | 0  | 1 | 0 | 0 | 0 |
| 0  | 1  | 0 | 1 | 0 | 0 |
| 1  | 0  | 0 | 0 | 1 | 0 |
| 1  | 1  | 0 | 0 | 0 | 1 |

<div class="margin-left">

1-of-n Dekodierer</br>
Konvertiert binäre Information von n kodierten Eingängen zu 2^n einzigartigen Ausgängen. Zu jedem Zeitpunkt ist nur ein Ausgang High.
</div>
</div>

## Enkodierer

<div class="rows">

| I0 | I1 | I2 | I3 | 1 | 2 |
|----|----|----|----|---|---|
| 0  | 0  | 0  | 0  | 0 | 0 |
| 1  | 0  | 0  | 0  | 0 | 0 |
| X  | 1  | 0  | 0  | 0 | 1 |
| X  | X  | 1  | 0  | 1 | 0 |
| X  | X  | X  | 1  | 1 | 1 |

<div class="margin-left">

2^n-to-n Enkodierer</br>
Kodiert 2^n Eingänge zu n Ausgängen. Nur einer der Eingänge sollte auf High gesetzt sein. Ansonsten wird das MSB als Eingang betrachtet und alle anderen Eingänge werden ignoriert.

</div>
</div>

## Multiplexer

<div class="rows">

| S0 | S1 | Out        |
|----|----|------------|
| 0  | 0  | Wert bei 0 |
| 0  | 1  | Wert bei 1 |
| 1  | 0  | Wert bei 2 |
| 1  | 1  | Wert bei 3 |

<div class="margin-left">

Wählt einen Eingang mit einer Adresse und gibt den gewählten Wert aus. 

</div>
</div>

## Demultiplexer

<div class="rows">

| I | S0 | S1 | 0 | 1 | 2 | 3 |
|---|----|----|---|---|---|---|
| X | 0  | 0  | I | 0 | 0 | 0 |
| X | 0  | 1  | 0 | I | 0 | 0 |
| X | 1  | 0  | 0 | 0 | I | 0 |
| X | 1  | 1  | 0 | 0 | 0 | I |

<div class="margin-left">

Hat einen Dateneingang und n Adresseingänge. Der Wert des Dateneingangs wird wird am gewählten Ausgang ausgegeben.
</div>
</div>
