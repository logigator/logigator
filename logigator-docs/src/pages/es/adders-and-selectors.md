# Sumadores y selectores

Los sumadores suman bits sueltos y dan un bit de suma y un acarreo. Los selectores encaminan señales según un número binario: un multiplexor elige una de varias entradas, un demultiplexor envía una entrada a una de varias salidas, un decodificador convierte un número en una sola salida a 1, y un codificador convierte la entrada más alta a 1 de nuevo en un número. Los seis están en la categoría Sumadores y selectores de la paleta.

## Semisumador {#half-adder}

![Un semisumador con interruptores en A y B y LEDs en S y C, recorriendo las cuatro combinaciones de entradas. Con los dos encendidos, S está apagado y C encendido.](./images/component-half-adder.webp)

El semisumador suma dos bits.

| Puerto | Sentido | Significado        |
| ------ | ------- | ------------------ |
| A      | entrada | El primer bit.     |
| B      | entrada | El segundo bit.    |
| S      | salida  | El bit de suma.    |
| C      | salida  | El bit de acarreo. |

No tiene más opciones que Dirección.

| A   | B   | S   | C   |
| --- | --- | --- | --- |
| 0   | 0   | 0   | 0   |
| 0   | 1   | 1   | 0   |
| 1   | 0   | 1   | 0   |
| 1   | 1   | 0   | 1   |

## Sumador completo {#full-adder}

![Un sumador completo con interruptores en A, B y Cin y LEDs en S y C, sumando ningún uno, uno, dos (C encendido) y tres (S y C encendidos).](./images/component-full-adder.webp)

El sumador completo suma dos bits y un acarreo de entrada.

| Puerto | Sentido | Significado                                        |
| ------ | ------- | -------------------------------------------------- |
| A      | entrada | El primer bit.                                     |
| B      | entrada | El segundo bit.                                    |
| Cin    | entrada | El acarreo de entrada, del bit inmediato inferior. |
| S      | salida  | El bit de suma.                                    |
| C      | salida  | El bit de acarreo, para el bit inmediato superior. |

No tiene más opciones que Dirección.

| A   | B   | Cin | S   | C   |
| --- | --- | --- | --- | --- |
| 0   | 0   | 0   | 0   | 0   |
| 0   | 0   | 1   | 1   | 0   |
| 0   | 1   | 0   | 1   | 0   |
| 0   | 1   | 1   | 0   | 1   |
| 1   | 0   | 0   | 1   | 0   |
| 1   | 0   | 1   | 0   | 1   |
| 1   | 1   | 0   | 0   | 1   |
| 1   | 1   | 1   | 1   | 1   |

Para sumar números de varios bits, usa un sumador por bit y conecta la C de cada sumador a la Cin del sumador del bit inmediato superior. El bit más bajo puede usar un semisumador, ya que no tiene acarreo de entrada.

## Multiplexor {#multiplexer}

![Un multiplexor con interruptores en S0 y en las entradas de datos 0 y 1, con la entrada 0 encendida, y un LED en su salida. El LED está encendido mientras S0 está apagado y se apaga cuando S0 selecciona la entrada 1.](./images/component-multiplexer.webp)

El multiplexor pasa a su salida la entrada de datos que eligen las líneas de selección. Con n líneas de selección hay 2ⁿ entradas de datos.

| Puerto     | Sentido | Significado                                                |
| ---------- | ------- | ---------------------------------------------------------- |
| S0, S1, …  | entrada | Las líneas de selección; S0 es el bit menos significativo. |
| 0, 1, 2, … | entrada | Las entradas de datos.                                     |
| Salida     | salida  | El valor de la entrada de datos elegida.                   |

La salida no tiene etiqueta.

| Opción              | Valores | Predeterminado |
| ------------------- | ------- | -------------- |
| Líneas de selección | 1 a 6   | 1              |

Con 2 líneas de selección:

| S1  | S0  | Salida    |
| --- | --- | --------- |
| 0   | 0   | Entrada 0 |
| 0   | 1   | Entrada 1 |
| 1   | 0   | Entrada 2 |
| 1   | 1   | Entrada 3 |

## Demultiplexor {#demultiplexer}

![Un demultiplexor con interruptores en S0 e I, con I encendido, y LEDs en las salidas 0 y 1. El LED encendido pasa de la salida 0 a la salida 1 cuando se enciende S0.](./images/component-demultiplexer.webp)

El demultiplexor pasa la entrada I a la salida que eligen las líneas de selección. Todas las demás salidas están a 0. Con n líneas de selección hay 2ⁿ salidas.

| Puerto     | Sentido | Significado                                                |
| ---------- | ------- | ---------------------------------------------------------- |
| S0, S1, …  | entrada | Las líneas de selección; S0 es el bit menos significativo. |
| I          | entrada | La entrada de datos.                                       |
| 0, 1, 2, … | salida  | Las salidas.                                               |

| Opción              | Valores | Predeterminado |
| ------------------- | ------- | -------------- |
| Líneas de selección | 1 a 6   | 1              |

Con 2 líneas de selección:

| S1  | S0  | Salida que lleva I |
| --- | --- | ------------------ |
| 0   | 0   | 0                  |
| 0   | 1   | 1                  |
| 1   | 0   | 2                  |
| 1   | 1   | 3                  |

Las líneas de selección van primero, como en el multiplexor. Un demultiplexor de un circuito más antiguo mantiene I primero, antes de las líneas de selección, y por lo demás funciona igual. Las etiquetas del componente muestran el orden.

## Decodificador {#decoder}

![Un decodificador con interruptores en sus entradas 1 y 2 y LEDs en sus cuatro salidas, contando de 0 a 3, de modo que el LED encendido avanza de la salida 0 a la salida 3.](./images/component-decoder.webp)

El decodificador pone a 1 la única salida cuyo número es el valor binario de sus entradas. Todas las demás salidas están a 0. Con n entradas hay 2ⁿ salidas.

| Puerto     | Sentido | Significado                                            |
| ---------- | ------- | ------------------------------------------------------ |
| 1, 2, 4, … | entrada | Los bits del número, cada uno etiquetado con su valor. |
| 0, 1, 2, … | salida  | Una salida por número.                                 |

| Opción   | Valores | Predeterminado |
| -------- | ------- | -------------- |
| Entradas | 1 a 6   | 2              |

Con 2 entradas:

| 2   | 1   | Salida a 1 |
| --- | --- | ---------- |
| 0   | 0   | 0          |
| 0   | 1   | 1          |
| 1   | 0   | 2          |
| 1   | 1   | 3          |

## Codificador {#encoder}

![Un codificador con Salidas en 2, interruptores en sus cuatro entradas y LEDs en las salidas 1, 2 y V. Sin ninguna entrada encendida, V está apagado. La entrada 0 sola enciende solo V, y las entradas 2 y luego 3 dan 2 y luego 3, la entrada más alta que está encendida.](./images/component-encoder.webp)

El codificador da el número de la entrada más alta que es 1. V vale 1 mientras alguna entrada lo valga, de modo que la entrada 0 se distingue de ninguna entrada. Con n salidas, sin contar V, hay 2ⁿ entradas.

| Puerto     | Sentido | Significado                                            |
| ---------- | ------- | ------------------------------------------------------ |
| 0, 1, 2, … | entrada | Una entrada por número.                                |
| 1, 2, 4, … | salida  | Los bits del número, cada uno etiquetado con su valor. |
| V          | salida  | 1 mientras alguna entrada es 1.                        |

| Opción  | Valores | Predeterminado |
| ------- | ------- | -------------- |
| Salidas | 1 a 6   | 1              |

Con 2 salidas, donde x significa que la entrada puede ser 0 o 1:

| 3   | 2   | 1   | 0   | Salida 2 | Salida 1 | V   |
| --- | --- | --- | --- | -------- | -------- | --- |
| 0   | 0   | 0   | 0   | 0        | 0        | 0   |
| 0   | 0   | 0   | 1   | 0        | 0        | 1   |
| 0   | 0   | 1   | x   | 0        | 1        | 1   |
| 0   | 1   | x   | x   | 1        | 0        | 1   |
| 1   | x   | x   | x   | 1        | 1        | 1   |

Un codificador de un circuito más antiguo no tiene V.

## Ver también {#see-also}

- [Componentes y opciones](docs:components-and-options): la paleta y la tarjeta de ajustes
- [Puertas lógicas](docs:logic-gates): NO, Y, O y XOR
- [Memoria](docs:memory): leer palabras en una dirección
- [Salidas](docs:outputs): mostrar un número binario en un display de segmentos
