# Temporización

Estos componentes trabajan con el tiempo, contado en ticks de simulación. Un reloj enciende y apaga su salida por sí solo, un retardo pasa una señal un tick después, y un generador de números aleatorios pone bits aleatorios nuevos en sus salidas cuando recibe un flanco de reloj.

## Reloj {#clock}

![Un reloj con un interruptor apagado en STP y un LED en su salida, mostrado a un tick por fotograma. Con Retardo 1, el LED se enciende y se apaga cada tick.](./images/component-clock.webp)

Un reloj cambia su salida entre 0 y 1 una y otra vez, a un ritmo que fija su opción Retardo. Úsalo para hacer avanzar contadores y cualquier otra cosa que funcione por pasos.

| Puerto | Sentido | Significado                                  |
| ------ | ------- | -------------------------------------------- |
| STP    | entrada | Parada: mantiene el reloj en 0 mientras es 1 |
| CLK    | salida  | La señal de reloj                            |

| Opción        | Valores           | Predeterminado |
| ------------- | ----------------- | -------------- |
| Forma de onda | Cuadrada, Pulso   | Cuadrada       |
| Retardo       | 1 a 4 294 967 295 | 1              |

Cada ciclo empieza con la salida en 0 durante Retardo ticks. Lo que sigue depende de la forma de onda:

| Forma de onda | Salida a 0 durante | Luego salida a 1 durante | Un ciclo dura     |
| ------------- | ------------------ | ------------------------ | ----------------- |
| Cuadrada      | Retardo ticks      | Retardo ticks            | 2 × Retardo ticks |
| Pulso         | Retardo ticks      | 1 tick                   | Retardo + 1 ticks |

En cuanto STP vuelve a 0, el reloj empieza un ciclo nuevo desde el principio.

La velocidad del reloj en segundos depende de la velocidad de la simulación: divide los ticks por segundo entre los ticks por ciclo. A una velocidad fija de 10 Hz:

| Forma de onda | Retardo | Un ciclo dura | Frecuencia |
| ------------- | ------- | ------------- | ---------- |
| Cuadrada      | 1       | 2 ticks       | 5 Hz       |
| Cuadrada      | 5       | 10 ticks      | 1 Hz       |
| Pulso         | 4       | 5 ticks       | 2 Hz       |

El panel de velocidad lista estas frecuencias para cada reloj del circuito en «Relojes a esta velocidad». Consulta [Velocidad](docs:simulation#speed).

## Retardo {#delay}

![Un interruptor que controla un LED directamente y un segundo LED a través de un retardo, mostrado a un tick por fotograma. El LED que va detrás del retardo se enciende y se apaga un tick después que el otro.](./images/component-delay.webp)

Un retardo deja pasar su entrada sin cambios, un tick después. Como cualquier otro componente, tarda un tick en pasar un cambio, y ese tick es todo lo que añade. Una cadena de retardos retiene una señal un tick por cada uno, por ejemplo para que dos caminos de un circuito tengan la misma longitud.

| Puerto  | Sentido | Significado                     |
| ------- | ------- | ------------------------------- |
| Entrada | entrada | La señal que se pasa            |
| Salida  | salida  | La misma señal, un tick después |

No tiene más opciones que Dirección.

## Generador de números aleatorios {#random-number-generator}

![Un generador de números aleatorios con Salidas en 4, un botón de pulso en CLK y un display de segmentos en sus salidas, que muestra un número nuevo después de cada pulso.](./images/component-random-number-generator.webp)

Un generador de números aleatorios pone un valor aleatorio nuevo en sus salidas en cada flanco de subida de CLK. Entre dos flancos, las salidas conservan su valor.

| Puerto     | Sentido | Significado                                 |
| ---------- | ------- | ------------------------------------------- |
| CLK        | entrada | Cada flanco de subida genera un valor nuevo |
| 0, 1, 2, … | salida  | Los bits aleatorios, uno por salida         |

| Opción  | Valores | Predeterminado |
| ------- | ------- | -------------- |
| Salidas | 1 a 64  | 1              |

Con una [burbuja de negación](docs:components-and-options#negating-a-port) en CLK, genera un valor nuevo en el flanco de bajada.

## Ver también {#see-also}

- [Simulación](docs:simulation): ticks, controles y velocidad de la simulación
- [Entradas](docs:inputs): interruptores y botones para controlar STP o CLK a mano
- [Salidas](docs:outputs): LEDs y pantallas para mostrar una señal
- [Componentes y opciones](docs:components-and-options): la paleta y la tarjeta de ajustes
