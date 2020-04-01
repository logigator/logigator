# IO Gates

## Button
<div class="rows">

![Button](../../assets/help/button.jpg)

<div class="margin-left">

Can be clicked to emit a pulse signal. Lasts one simulation tick.
</div>
</div>

## Switch
<div class="rows">

![Switch](../../assets/help/switch.jpg)

<div class="margin-left">

Can be switched on and off during simulation.
</div>
</div>

## LED

<div class="rows">

![LED](../../assets/help/led.jpg)

<div class="margin-left">

Switches on or off depending on the applied input.
</div>
</div>

## Segment Display

<div class="rows">

![Segment Display](../../assets/help/segment-display.jpg)

<div class="margin-left">

Seven segment display with a binary input, that displays the input as decimal number. 
</div>
</div>

## LED Matrix

<div class="rows">

![LED Matrix](../../assets/help/led-matrix.PNG)

<div class="margin-left">

Displays up to 256 single LEDs. It is possible to choose between the following sizes: 4x4, 8x8 and 16x16. 

 - **Address Inputs**<br>
   With the address inputs, the single rows of the matrix can be controlled. When using a 16x16 Matrix, each row is spilt into two addresses (the first 8 LED, the last 8 LEDs).
 
 - **Data Inputs**<br>
   The Matrix has between 4 and 8 data Inputs (D0-D7). D0 is the first LED of the row and D7 is the last LED of the row. A 16x16 Matrix also has only 8 Data Inputs. Because of that, every row consists of two addresses. 

 - **Clock**<br>
   When CLK is HIGH, the data is written to the Matrix. 
</div>
</div>
