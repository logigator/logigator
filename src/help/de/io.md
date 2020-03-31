# IO Gatter

## Knopf
<div class="rows">

![Button](../../assets/help/button.jpg)

<div class="margin-left">

Kann gedrückt werden, um einen Puls zu senden. Dieser dauert einen Simulationstick.
</div>
</div>

## Switch
<div class="rows">

![Switch](../../assets/help/switch.jpg)

<div class="margin-left">

Kann an- und ausgeschalten werden.
</div>
</div>

## LED

<div class="rows">

![LED](../../assets/help/led.jpg)

<div class="margin-left">

Schaltet sich abhängig vom Eingang aus oder ein.
</div>
</div>

## Segment Display

<div class="rows">

![Segment Display](../../assets/help/segment-display.jpg)

<div class="margin-left">

Stellt die binären Eingänge als Dezimalzahlen dar.
</div>
</div>

## LED Matrix

<div class="rows">

![LED Matrix](../../assets/help/led-matrix.PNG)

<div class="margin-left">

Stellt bis zu 256 einzelne LEDs dar. Es ist dabei möglich zwischen den Grö0en 4x4, 8x8 und 16x16 zu wählen.
Die Ansteuerung funktioniert folgendermaßen:
 - **Addresseingänge**<br>
   Mit den Addresseingängen können die einzelenen Reihen der Matrix angesteuert werden. Bei der 16x16 Matrix ist es jedoch so, dass einer Reihe aus zwei Addressen besteht(die ersten 8 LEDs, die zweiten 8 LEDs)
 
 - **Dateneingänge**<br>
   Die Matrix hat zwischen 4 und 8 Dateneingänge(D0-D7). D0 ist dabei immer die erste LED von links und und D7 die achte LED. Sind bei einer 16x16 Matrix, die linken LEDs addresiert, setzt man mit D0 die neunte LED und mit D7 die letzte LED der Reihe.

 - **Takteingang**
   Wenn dieser Eingang HIGH ist werden die Daten auf die Matrix geschrieben.

</div>
</div>
