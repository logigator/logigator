# Puertas lógicas

Las puertas lógicas trabajan con bits sueltos. La puerta NO invierte su única entrada, y las puertas Y, O y XOR combinan de 2 a 64 entradas en una salida. Las cuatro están en la categoría Puertas lógicas de la paleta. Sus puertos no tienen etiquetas; el símbolo del bloque las distingue. La categoría también incluye el túnel, descrito en [Túneles](docs:wires-and-connections#túneles).

## Puerta NO

![Una puerta NO con un interruptor en su entrada y un LED en su salida. El LED está encendido mientras el interruptor está apagado y se apaga cuando se enciende.](./images/component-not-gate.webp)

La puerta NO invierte su entrada. Su bloque lleva la marca `!`.

| Puerto  | Sentido | Significado               |
| ------- | ------- | ------------------------- |
| Entrada | entrada | El bit que se invierte.   |
| Salida  | salida  | El inverso de la entrada. |

No tiene más opciones que Dirección.

| Entrada | Salida |
| ------- | ------ |
| 0       | 1      |
| 1       | 0      |

Una burbuja de negación invierte la señal de un puerto sin retardo adicional, así que a menudo no hace falta una puerta NO delante de otro componente. Consulta [Negar un puerto](docs:components-and-options#negar-un-puerto).

## Puerta Y

![Una puerta Y con dos interruptores en sus entradas y un LED en su salida, recorriendo las cuatro combinaciones de entradas. El LED solo se enciende cuando los dos interruptores están encendidos.](./images/component-and-gate.webp)

La puerta Y da 1 cuando todas las entradas son 1. Su bloque lleva la marca `&`.

| Puerto   | Sentido | Significado                        |
| -------- | ------- | ---------------------------------- |
| Entradas | entrada | Los bits que se combinan.          |
| Salida   | salida  | 1 cuando todas las entradas son 1. |

| Opción   | Valores | Predeterminado |
| -------- | ------- | -------------- |
| Entradas | 2 a 64  | 2              |

| Entrada 1 | Entrada 2 | Salida |
| --------- | --------- | ------ |
| 0         | 0         | 0      |
| 0         | 1         | 0      |
| 1         | 0         | 0      |
| 1         | 1         | 1      |

Con más entradas, la salida solo es 1 mientras todas son 1. Basta un 0 para que sea 0.

Negar la salida convierte la puerta Y en una puerta NAND.

## Puerta O

![Una puerta O con dos interruptores en sus entradas y un LED en su salida, recorriendo las cuatro combinaciones de entradas. El LED se enciende cuando al menos un interruptor está encendido.](./images/component-or-gate.webp)

La puerta O da 1 cuando al menos una entrada es 1. Su bloque lleva la marca `≥1`.

| Puerto   | Sentido | Significado                         |
| -------- | ------- | ----------------------------------- |
| Entradas | entrada | Los bits que se combinan.           |
| Salida   | salida  | 1 cuando al menos una entrada es 1. |

| Opción   | Valores | Predeterminado |
| -------- | ------- | -------------- |
| Entradas | 2 a 64  | 2              |

| Entrada 1 | Entrada 2 | Salida |
| --------- | --------- | ------ |
| 0         | 0         | 0      |
| 0         | 1         | 1      |
| 1         | 0         | 1      |
| 1         | 1         | 1      |

Con más entradas, la salida solo es 0 mientras todas son 0. Basta un 1 para que sea 1.

Negar la salida convierte la puerta O en una puerta NOR. Para combinar varias salidas en un cable, pásalas por una puerta O en lugar de conectarlas directamente (consulta [Señales en conflicto](docs:simulation#señales-en-conflicto)).

## Puerta XOR

![Una puerta XOR con dos interruptores en sus entradas y un LED en su salida, recorriendo las cuatro combinaciones de entradas. El LED se enciende cuando exactamente un interruptor está encendido.](./images/component-xor-gate.webp)

La puerta XOR da 1 cuando un número impar de entradas es 1. Su bloque lleva la marca `=1`.

| Puerto   | Sentido | Significado                                |
| -------- | ------- | ------------------------------------------ |
| Entradas | entrada | Los bits que se combinan.                  |
| Salida   | salida  | 1 cuando un número impar de entradas es 1. |

| Opción   | Valores | Predeterminado |
| -------- | ------- | -------------- |
| Entradas | 2 a 64  | 2              |

| Entrada 1 | Entrada 2 | Salida |
| --------- | --------- | ------ |
| 0         | 0         | 0      |
| 0         | 1         | 1      |
| 1         | 0         | 1      |
| 1         | 1         | 0      |

Con más entradas, la puerta cuenta los 1: una o tres entradas a 1 dan 1, dos o cuatro dan 0. No da 1 solo cuando hay exactamente una entrada a 1.

Negar la salida convierte la puerta XOR en una puerta XNOR.

## Ver también

- [Componentes y opciones](docs:components-and-options): la paleta, la tarjeta de ajustes y negar un puerto
- [Memoria](docs:memory): biestables, ROM y RAM
- [Sumadores y selectores](docs:adders-and-selectors): semisumadores y sumadores completos en un solo componente
- [Simulación](docs:simulation): hacer funcionar un circuito
