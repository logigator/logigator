# Puertas de E/S

## Botón

<div class="rows">

![Botón](assets/help/button.jpg)

<div class="margin-left">

Puede hacer clic para emitir una señal de pulso. Dura un tick de simulación.

</div>
</div>

## Interruptor

<div class="rows">

![Interruptor](assets/help/switch.jpg)

<div class="margin-left">

Se puede encender y apagar durante la simulación.

</div>
</div>

## LED

<div class="rows">

![LED](assets/help/led.jpg)

<div class="margin-left">

Se enciende o apaga dependiendo de la entrada aplicada.

</div>
</div>

## Display de Segmentos

<div class="rows">

![Display de Segmentos](assets/help/segment-display.jpg)

<div class="margin-left">

Display de siete segmentos con una entrada binaria, que muestra la entrada como número decimal, hexadecimal u octal.

</div>
</div>

## Matriz de LEDs

<div class="rows">

![Matriz de LEDs](assets/help/led-matrix.PNG)

<div class="margin-left">

Muestra hasta 256 LEDs individuales. Es posible elegir entre los siguientes tamaños: 4x4, 8x8 y 16x16.

- **Entradas de Dirección**<br>
  Con las entradas de dirección, se pueden controlar las filas individuales de la matriz. Cuando se usa una matriz 16x16, cada fila se divide en dos direcciones (los primeros 8 LEDs, los últimos 8 LEDs).

- **Entradas de Datos**<br>
  La matriz tiene entre 4 y 8 entradas de datos (D0-D7). D0 es el primer LED de la fila y D7 es el último LED de la fila. Una matriz 16x16 también tiene solo 8 entradas de datos. Debido a eso, cada fila consta de dos direcciones.

- **Reloj**<br>
Cuando CLK está en ALTO, los datos se escriben en la matriz.
</div>
</div>
