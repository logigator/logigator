# Simulación

Una vez construido tu circuito, ejecútalo para ver fluir las señales. En la simulación alimentas el circuito, accionas sus entradas y ves los resultados iluminarse en directo en el tablero.

![El editor en simulación, con cables y puertos alimentados iluminados, un LED encendido y los controles de ejecución en la barra de herramientas.](images/simulation/simulation-running.png)

## Iniciar y salir de una simulación

Pulsa el botón **Iniciar simulación** en el extremo derecho de la barra de herramientas para alimentar tu circuito. También puedes pulsar `Enter`.

Mientras se ejecuta una simulación, el tablero está **bloqueado para la edición**: no puedes colocar, mover, cablear ni eliminar nada. Aún puedes desplazarte y hacer zoom libremente, y puedes hacer clic en las entradas del circuito (consulta [Interactuar con un circuito en ejecución](#interactuar-con-un-circuito-en-ejecución)).

Para volver a la edición, pulsa **Salir de la simulación** (donde estaba el botón Iniciar), o pulsa `Enter` de nuevo o `Escape`.

Que la simulación comience **en ejecución** o comience **en pausa** depende del ajuste **Iniciar la simulación automáticamente**. Cuando está activado, el circuito empieza a ejecutarse en el momento en que entras; cuando está desactivado, entra en pausa para que lo inicies tú mismo. Consulta [Ajustes y apariencia](docs:settings).

## Los controles de ejecución

Cuando una simulación está activa, la barra de herramientas cambia sus herramientas de dibujo por los controles de ejecución.

| Control      | Qué hace                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ejecutar** | Inicia (o reanuda) la simulación.                                                                                                            |
| **Pausar**   | Congela la simulación donde está, conservando su estado actual para que puedas reanudar o avanzar paso a paso.                               |
| **Paso**     | Avanza el circuito un solo tick. Disponible en pausa, útil para rastrear una señal paso a paso.                                              |
| **Detener**  | Reinicia el circuito al comienzo y borra todos los cables encendidos. La simulación sigue activa y en pausa, lista para ejecutarse de nuevo. |

**Detener** y **Salir de la simulación** son diferentes: **Detener** rebobina el circuito en ejecución al principio pero te mantiene en la simulación, mientras que **Salir de la simulación** abandona la simulación por completo y te devuelve a la edición.

![Primer plano de los controles de ejecución en la barra de herramientas: Ejecutar, Pausar, Paso y Detener, seguidos de los controles de velocidad y la lectura de velocidad en directo.](images/simulation/run-controls.png)

## Velocidad de simulación

Junto a los controles de ejecución hay un conjunto de opciones de velocidad y una lectura en directo. Hay tres maneras de marcar el ritmo de la simulación:

- **Sincronizar con el fotograma**: el circuito avanza un tick por fotograma dibujado, así que su velocidad sigue la tasa de refresco de tu pantalla. Este es el valor predeterminado y mantiene fáciles de observar los circuitos que cambian rápido.
- **Limitar a la velocidad objetivo**: el circuito se marca a una frecuencia fija que eliges. Escribe un número en el cuadro de velocidad y elige su unidad (`Hz`, `kHz` o `MHz`) del desplegable. Activa el botón **Limitar a la velocidad objetivo** para usarlo.
- **Ejecución libre**: sin **Sincronizar con el fotograma** ni **Limitar a la velocidad objetivo** activados, el circuito se ejecuta tan rápido como es posible.

La lectura de la derecha muestra la **velocidad medida** que la simulación está alcanzando realmente (por ejemplo `1kHz`) junto al total de **ticks** transcurridos desde que se inició. La velocidad medida puede quedarse por debajo de un objetivo que fijes si el circuito es demasiado grande para seguir el ritmo.

## Interactuar con un circuito en ejecución

Solo las entradas del circuito responden a los clics mientras se ejecuta:

- **Interruptor**: una entrada con enclavamiento. Haz clic en él para alternar su salida entre encendido y apagado; permanece donde lo dejaste.
- **Botón**: una entrada momentánea. Haz clic en él para emitir un único pulso en su salida.

A medida que las señales se propagan, los cables y puertos alimentados **se iluminan**, y los componentes de salida muestran su estado: los LED se encienden, los displays de segmentos y las matrices de LEDs muestran sus patrones. Arrastra en cualquier punto del tablero para desplazarte; hacer clic en un espacio vacío no hace nada.

Para mirar dentro de un circuito en ejecución —leer el contenido de una memoria o ver en directo el circuito interno de un componente personalizado— consulta [Inspección y monitores](docs:inspection).

## Cuando una simulación no arranca

Algunos problemas impiden por completo que un circuito se simule. Si hay alguno presente, **Iniciar simulación** muestra un mensaje de error y permanece en modo de edición para que puedas corregirlos. Los más comunes:

- **Un componente no compatible**: un componente que el simulador no puede ejecutar. Quítalo o sustitúyelo.
- **Un componente personalizado que se coloca a sí mismo**: un [componente personalizado](docs:custom-components) cuyo circuito interno se contiene a sí mismo, directamente o a través de otro componente personalizado, lo que nunca puede resolverse. Rompe el bucle.
- **Un componente personalizado sin circuito**: un componente personalizado que no tiene nada dentro que simular. Dale un circuito interno, o quítalo.
- **Un desajuste de puertos**: un componente personalizado cuyos puertos de entrada/salida declarados no coinciden con los conectores de entrada y salida realmente dentro de su circuito. Alinea los conectores con los puertos.

Cada mensaje nombra el componente implicado para que puedas encontrarlo.

## Consulta también

- [Inspección y monitores](docs:inspection): leer memoria y ver circuitos internos en directo
- [Componentes y opciones](docs:components-and-options): interruptores, botones, LED y otros bloques de construcción
- [Componentes personalizados](docs:custom-components): empaquetar un circuito en una pieza reutilizable
- [Ajustes y apariencia](docs:settings): la opción Iniciar la simulación automáticamente
- [Atajos de teclado](docs:shortcuts): cada asignación y cómo cambiarla
