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

![Rom Data Edit](../../assets/help/rom-edit.jpg)

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
