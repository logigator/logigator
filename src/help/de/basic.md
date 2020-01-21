# Grundlegende Gatter

## NICHT Gatter

<div class="rows">

| Input | Output |
| ------| ------ |
| 0     | 1      |
| 1     | 0      |

<div class="margin-left">
Ausgang ist HIGH wenn Eingang LOW ist.
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
Ausgang ist HIGH wenn alle Eingänge HIGH sind.
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
Ausgang ist HIGH wenn mindestens ein Eingang HIGH ist.
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
Ausgang ist HIGH wenn eine ungerade Anzahl an Eingängen HIGH sind.
</div>
</div>

## Durchpass

Ausgangssignal ist gleich wie Eingangssignal, jedoch um einen Simalationstick verzögert.

## Taktgeber

Gibt regelmäßige ein Tick lange Signale aus. Abstand zwischen den Signal kann konfiguriert werden.<br>
wenn der STP Eingang HIGH ist, werden keine Ausgangssignale generiert. 
