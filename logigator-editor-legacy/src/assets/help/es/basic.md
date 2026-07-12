# Puertas Básicas

## Puerta NOT

<div class="rows">

| Entrada | Salida |
| ------- | ------ |
| 0       | 1      |
| 1       | 0      |

<div class="margin-left">
La salida es alta si la entrada es baja.
</div>
</div>

## Puerta AND

<div class="rows">

| A   | B   | Salida |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 0      |
| 1   | 0   | 0      |
| 1   | 1   | 1      |

<div class="margin-left">
La salida es alta si todas las entradas son altas.
</div>
</div>

## Puerta OR

<div class="rows">

| A   | B   | Salida |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 1      |

<div class="margin-left">
La salida es alta si al menos una entrada es alta.
</div>
</div>

## Puerta XOR

<div class="rows">

| A   | B   | Salida |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 0      |

<div class="margin-left">
La salida es alta si un número impar de entradas es alta.
</div>
</div>

## Retraso

La salida es igual a la entrada, pero retrasada por un tick de simulación.

## Reloj

Envía periódicamente un pulso de un solo tick de duración. El retraso entre pulsos se puede configurar.<br>
Si la entrada STP es alta, no se producen pulsos de reloj.

## Túnel

Funciona como un cable, pero inalámbrico. Cada túnel está conectado a todos los demás con el mismo identificador.
