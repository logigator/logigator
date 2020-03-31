# Grundlegende Gatter

## NICHT Gatter

<div class="rows">

| Input | Output |
| ------| ------ |
| 0     | 1      |
| 1     | 0      |

<div class="margin-left">

Der Ausgang ist HIGH, wenn der Eingang LOW ist.
</div>
</div>

## UND Gatter

<div class="rows">

| A   | B   | Output |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 0      |
| 1   | 0   | 0      |
| 1   | 1   | 1      |

<div class="margin-left">

Der Ausgang ist HIGH, wenn alle Eingänge HIGH sind.
</div>
</div>

## ODER Gate

<div class="rows">

| A   | B   | Output |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 1      |

<div class="margin-left">

Der Ausgang ist HIGH, wenn mindestens ein Eingang HIGH ist.
</div>
</div>

## XOR Gatter

<div class="rows">

| A   | B   | Output |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 0      |

<div class="margin-left">

Der Ausgang ist HIGH, wenn eine ungerade Anzahl an Eingängen HIGH sind.
</div>
</div>

## Durchpass

Das Ausgangssignal ist gleich dem Eingangssignal, jedoch um einen Simulationstick verzögert.

## Taktgeber

Dieser gibt regelmäßige, ein Tick lange, Signale aus. Der Abstand zwischen den Signalen kann konfiguriert werden.<br>
Wenn der STP Eingang HIGH ist, werden keine Ausgangssignale generiert. 

## Tunnel
Funktioniert wie eine Leitung, aber ohne Leitung. Jeder Tunnel ist mit allen anderen Tunneln verbunden, die die selbe Id haben.
