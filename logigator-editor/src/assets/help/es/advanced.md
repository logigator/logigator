# Puertas Avanzadas

## Sumador Medio

<div class="rows">

| A   | B   | Suma | Acarreo |
| --- | --- | ---- | ------- |
| 0   | 0   | 0    | 0       |
| 1   | 0   | 1    | 0       |
| 0   | 1   | 1    | 0       |
| 1   | 1   | 0    | 1       |

<div class="margin-left">

Suma dos dígitos binarios individuales. `Suma` es la suma de un solo dígito de la adición. `Acarreo` representa el desbordamiento.

</div>
</div>

## Sumador Completo

<div class="rows">

| A   | B   | Cin | Suma | Acarreo |
| --- | --- | --- | ---- | ------- |
| 0   | 0   | 0   | 0    | 0       |
| 0   | 0   | 1   | 1    | 0       |
| 0   | 1   | 0   | 1    | 0       |
| 0   | 1   | 1   | 0    | 1       |
| 1   | 0   | 0   | 1    | 0       |
| 1   | 0   | 1   | 0    | 1       |
| 1   | 1   | 0   | 0    | 1       |
| 1   | 1   | 1   | 1    | 1       |

<div class="margin-left">

Suma tres dígitos binarios individuales.

</div>
</div>

## ROM

<div class="rows">

![Edición de Datos de ROM](assets/help/rom-edit.jpg)

<div class="margin-left">

`Memoria de Solo Lectura` - Los datos pueden ser escritos en hexadecimal. Puede ser utilizado para código de programa, por ejemplo.

</div>
</div>

## Flip-Flop D

<div class="rows">

| D   | Q   | Q Inversa |
| --- | --- | --------- |
| 1   | 1   | 0         |
| 0   | 0   | 1         |

<div class="margin-left">

Flip-Flop de `Datos` o `Retardo` - Mantiene un estado. Cuando (CLK) se establece en alto, (Q) se establece en (D). (Q Inversa) siempre es la inversa de (Q).

</div>
</div>

## Flip-Flop JK

<div class="rows">

| J   | K   | Q          | Q Inversa  |
| --- | --- | ---------- | ---------- |
| 1   | 1   | Alternar   | Alternar   |
| 1   | 0   | 1          | 0          |
| 0   | 1   | 0          | 1          |
| 0   | 0   | Sin cambio | Sin cambio |

<div class="margin-left">

Mantiene un estado. (J) representa `establecer`, (K) representa `restablecer`. Tan pronto como (CLK) se establece en alto, (Q) se establece en alto si (J) está en alto y se establece en bajo si (K) está en alto. (Q) no cambia cuando tanto (J) como (K) están en bajo, se alterna cuando ambos se establecen en alto.

</div>
</div>

## Flip-Flop SR

<div class="rows">

| S   | R   | Q          | Q Inversa  |
| --- | --- | ---------- | ---------- |
| 0   | 0   | Sin cambio | Sin cambio |
| 1   | 0   | 1          | 0          |
| 0   | 1   | 0          | 1          |
| 1   | 1   | Inválido   | Inválido   |

<div class="margin-left">

Mantiene un estado. (S) representa `establecer`, (R) representa `restablecer`. Tan pronto como (CLK) se establece en alto, (Q) se establece en alto si (S) está en alto y se establece en bajo si (R) está en alto. (Q) no cambia cuando (J) y (K) son iguales.

</div>
</div>

## Generador de Números Aleatorios

Este componente generará un número aleatorio en el flanco de subida de su entrada CLK.

## RAM

Memoria de Acceso Aleatorio. Aplica la entrada en el flanco de subida de CLK.<br>
Establece WE en alto para escribir en la dirección actual y en bajo para leer desde la dirección actual.

## Decodificador

<div class="rows">

| I1  | I2  | 0   | 1   | 2   | 3   |
| --- | --- | --- | --- | --- | --- |
| 0   | 0   | 1   | 0   | 0   | 0   |
| 0   | 1   | 0   | 1   | 0   | 0   |
| 1   | 0   | 0   | 0   | 1   | 0   |
| 1   | 1   | 0   | 0   | 0   | 1   |

<div class="margin-left">

Decodificador de 1 de n</br>
Convierte la información binaria de n entradas codificadas en 2^n salidas únicas. Solo una salida está establecida en ALTO a la vez.

</div>
</div>

## Codificador

<div class="rows">

| I0  | I1  | I2  | I3  | 1   | 2   |
| --- | --- | --- | --- | --- | --- |
| 0   | 0   | 0   | 0   | 0   | 0   |
| 1   | 0   | 0   | 0   | 0   | 0   |
| X   | 1   | 0   | 0   | 0   | 1   |
| X   | X   | 1   | 0   | 1   | 0   |
| X   | X   | X   | 1   | 1   | 1   |

<div class="margin-left">

Codificador de 2^n a n</br>
Codifica binariamente 2^n entradas en n salidas. Solo una de las entradas debe estar en ALTO a la vez. De lo contrario, el bit más significativo se considerará como ALTO y todas las demás entradas se tratarán como "no importa".

</div>
</div>

## Multiplexor

<div class="rows">

| S0  | S1  | Salida     |
| --- | --- | ---------- |
| 0   | 0   | valor en 0 |
| 0   | 1   | valor en 1 |
| 1   | 0   | valor en 2 |
| 1   | 1   | valor en 3 |

<div class="margin-left">

Selecciona una entrada por una dirección dada y escribe el valor en la entrada seleccionada en su salida.

</div>
</div>

## Demultiplexor

<div class="rows">

| I   | S0  | S1  | 0   | 1   | 2   | 3   |
| --- | --- | --- | --- | --- | --- | --- |
| X   | 0   | 0   | I   | 0   | 0   | 0   |
| X   | 0   | 1   | 0   | I   | 0   | 0   |
| X   | 1   | 0   | 0   | 0   | I   | 0   |
| X   | 1   | 1   | 0   | 0   | 0   | I   |

<div class="margin-left">

Toma una entrada de datos y n entradas de dirección. El valor de la entrada de datos se escribe en la salida dada por las entradas de dirección.

</div>
</div>
