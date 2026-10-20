# Memoria

Un biestable guarda un bit. La ROM y la RAM guardan palabras de varios bits, cada una en una dirección numerada. Los cinco están en la categoría Memoria de la paleta.

Un biestable solo cambia su bit cuando su entrada CLK sube de 0 a 1; Q lleva el bit y !Q su inverso. Todos los biestables empiezan con Q a 0 y !Q a 1. Entre dos flancos de subida, los cambios en las demás entradas no tienen efecto. Una burbuja de negación en CLK hace que un biestable reaccione al flanco de bajada, cuando CLK pasa de 1 a 0 (consulta [Negar un puerto](docs:components-and-options#negating-a-port)). Lo habitual es que CLK venga de un [reloj](docs:clock-and-timing#clock).

Una ROM contiene lo que fijas al editar, y el circuito solo puede leerlo. Una RAM empieza vacía y el circuito escribe en ella. Durante una simulación, un clic en una ROM o una RAM abre una vista con su contenido (consulta [Inspección y monitores](docs:inspection)).

## Biestable D {#d-flip-flop}

![Un biestable D con interruptores en D y CLK y LEDs en Q y !Q. Q toma el valor de D cuando sube CLK y lo conserva cuando D cambia mientras CLK está a 0.](./images/component-d-flip-flop.webp)

El biestable D guarda el bit de D en cada flanco de subida de CLK.

| Puerto | Sentido | Significado                    |
| ------ | ------- | ------------------------------ |
| D      | entrada | El bit que se guarda.          |
| CLK    | entrada | Guarda D cuando sube de 0 a 1. |
| Q      | salida  | El bit guardado.               |
| !Q     | salida  | El inverso de Q.               |

No tiene más opciones que Dirección.

| D   | Q tras el flanco de subida |
| --- | -------------------------- |
| 0   | 0                          |
| 1   | 1                          |

## Biestable JK {#jk-flip-flop}

![Un biestable JK con interruptores en J, CLK y K y LEDs en Q y !Q. En flancos de subida sucesivos de CLK se pone a 1 con J encendido, se pone a 0 con K encendido y luego se invierte dos veces con J y K encendidos.](./images/component-jk-flip-flop.webp)

El biestable JK pone a 1, pone a 0 o invierte su bit en cada flanco de subida de CLK.

| Puerto | Sentido | Significado                        |
| ------ | ------- | ---------------------------------- |
| J      | entrada | Pone el bit a 1.                   |
| CLK    | entrada | Aplica J y K cuando sube de 0 a 1. |
| K      | entrada | Pone el bit a 0.                   |
| Q      | salida  | El bit guardado.                   |
| !Q     | salida  | El inverso de Q.                   |

No tiene más opciones que Dirección.

| J   | K   | Q tras el flanco de subida |
| --- | --- | -------------------------- |
| 0   | 0   | Sin cambios                |
| 1   | 0   | 1                          |
| 0   | 1   | 0                          |
| 1   | 1   | Invertido                  |

Con J y K a 1, Q cambia en cada flanco de subida, así que funciona a la mitad de la frecuencia de la señal de CLK.

## Biestable SR {#sr-flip-flop}

![Un biestable SR con interruptores en S, CLK y R y LEDs en Q y !Q. Un flanco de subida con S encendido pone Q a 1, y un flanco de subida con R encendido lo pone a 0.](./images/component-sr-flip-flop.webp)

El biestable SR pone a 1 o a 0 su bit en cada flanco de subida de CLK.

| Puerto | Sentido | Significado                        |
| ------ | ------- | ---------------------------------- |
| S      | entrada | Pone el bit a 1.                   |
| CLK    | entrada | Aplica S y R cuando sube de 0 a 1. |
| R      | entrada | Pone el bit a 0.                   |
| Q      | salida  | El bit guardado.                   |
| !Q     | salida  | El inverso de Q.                   |

No tiene más opciones que Dirección.

| S   | R   | Q tras el flanco de subida | !Q tras el flanco de subida |
| --- | --- | -------------------------- | --------------------------- |
| 0   | 0   | Sin cambios                | Sin cambios                 |
| 1   | 0   | 1                          | 0                           |
| 0   | 1   | 0                          | 1                           |
| 1   | 1   | 1, conflicto               | 0, conflicto                |

S y R a 1 a la vez es una combinación de entradas que un biestable SR no admite. La simulación pone Q a 1 y !Q a 0 y dibuja los dos cables de salida en naranja hasta un flanco de subida con solo S o solo R a 1. Consulta [Señales en conflicto](docs:simulation#conflicting-signals). Donde los dos puedan ser 1 a la vez, usa en su lugar un biestable D o JK.

## ROM {#rom}

![Una ROM con cuatro interruptores en sus entradas de dirección, puestos en la dirección 3, y cuatro LEDs en sus salidas que muestran la palabra guardada 0111.](./images/component-rom.webp)

La ROM da la palabra guardada en la dirección presente en sus entradas A. No tiene reloj: las salidas siguen a la dirección. El contenido no puede cambiar mientras la simulación se ejecuta.

| Puerto    | Sentido | Significado                                                    |
| --------- | ------- | -------------------------------------------------------------- |
| A1, A2, … | entrada | La dirección; A1 es el bit menos significativo.                |
| O1, O2, … | salida  | La palabra de esa dirección; O1 es el bit menos significativo. |

| Opción              | Valores                    | Predeterminado |
| ------------------- | -------------------------- | -------------- |
| Tamaño de palabra   | 1 a 64                     | 4              |
| Tamaño de dirección | 1 a 11                     | 4              |
| Editar contenido    | Abre el editor hexadecimal | Vacía          |

Tamaño de palabra fija cuántos bits tiene una palabra y, con ello, el número de salidas. Tamaño de dirección fija el número de entradas de dirección. Una ROM guarda 2ⁿ palabras con un tamaño de dirección n: 16 palabras de forma predeterminada, 2048 como máximo.

### Editar el contenido {#editing-the-contents}

«Editar contenido», en la tarjeta de ajustes, indica cuántas palabras están ocupadas, por ejemplo «3 de 16 palabras ocupadas», o «Vacía». Un clic abre «Editar contenido de la ROM», una tabla con una celda por palabra. Las palabras que no fijas valen 0.

- Palabras o Bytes elige si una celda es una palabra o un byte del contenido.
- Hex, Decimal, Octal o Binario elige la base en la que se muestran y se escriben los valores.
- El campo «Dirección…» salta a la dirección que escribas en hexadecimal.
- Pegar en una celda la rellena junto con las siguientes, un valor en cada una, así que puedes pegar una lista de valores separados por espacios o saltos de línea.
- «Copiar» pone toda la tabla en el portapapeles como texto.
- «Vaciar» pone todas las palabras a 0, tras preguntar.
- «Guardar» conserva los cambios y «Cancelar» los descarta.

El contenido se guarda con el circuito. Durante una simulación, la vista de la ROM resalta la palabra de la dirección actual (consulta [Contenido de una ROM](docs:inspection#rom-contents)).

## RAM {#ram}

![Una RAM con Tamaño de dirección 2, interruptores en A0, A1, D0 a D3, WE y CLK, y LEDs en sus salidas. 0101 se guarda en la dirección 0 cuando sube CLK con WE encendido, sigue en las salidas después de apagar los interruptores de datos, desaparece al seleccionar la dirección 1 y vuelve con la dirección 0.](./images/component-ram.webp)

La RAM da la palabra guardada en la dirección presente en sus entradas A. En el flanco de subida de CLK, guarda en esa dirección la palabra de sus entradas D mientras WE es 1.

| Puerto    | Sentido | Significado                                                                  |
| --------- | ------- | ---------------------------------------------------------------------------- |
| A0, A1, … | entrada | La dirección; A0 es el bit menos significativo.                              |
| D0, D1, … | entrada | La palabra que se guarda; D0 es el bit menos significativo.                  |
| WE        | entrada | Habilitación de escritura. Mientras es 1, un flanco de subida en CLK guarda. |
| CLK       | entrada | Guarda las entradas D cuando sube de 0 a 1 mientras WE es 1.                 |
| D0, D1, … | salida  | La palabra de esa dirección; D0 es el bit menos significativo.               |

Las entradas de datos y las salidas llevan las mismas etiquetas, en lados opuestos del componente.

| Opción              | Valores              | Predeterminado |
| ------------------- | -------------------- | -------------- |
| Tamaño de palabra   | 1 a 64               | 4              |
| Tamaño de dirección | 1 a 16               | 4              |
| Lectura             | Inmediata, Por reloj | Inmediata      |

Tamaño de palabra fija cuántos bits tiene una palabra y, con ello, el número de entradas de datos y de salidas. Una RAM guarda 2ⁿ palabras con un tamaño de dirección n: 16 palabras de forma predeterminada, 65 536 como máximo.

Lectura decide cuándo cambian las salidas:

| Lectura   | Las salidas cambian                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Inmediata | Cada vez que cambia la dirección o se guarda una palabra nueva en ella.                                   |
| Por reloj | Solo en el flanco de subida de CLK, que lee la palabra de la dirección o muestra la que acaba de guardar. |

Con una burbuja de negación en CLK, la RAM guarda, y lee con Por reloj, en el flanco de bajada (consulta [Negar un puerto](docs:components-and-options#negating-a-port)).

Cada palabra vale 0 al empezar la simulación, y «Detener» las vuelve a poner todas a 0. El contenido no se guarda con el circuito; para empezar con un contenido fijo, usa una ROM. Durante una simulación, la vista de la RAM muestra lo que el circuito ha guardado (consulta [Contenido de una RAM](docs:inspection#ram-contents)).

## Ver también {#see-also}

- [Componentes y opciones](docs:components-and-options): negar un puerto, como CLK
- [Temporización](docs:clock-and-timing): señales de reloj para CLK
- [Inspección y monitores](docs:inspection): ver el contenido de ROMs y RAMs durante una simulación
- [Sumadores y selectores](docs:adders-and-selectors): decodificadores y multiplexores para direccionar
- [Puertas lógicas](docs:logic-gates): combinar bits sin guardarlos
- [Simulación](docs:simulation): avanzar por un circuito tick a tick
