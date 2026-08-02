# Cables y conexiones

Los cables llevan señales entre los puertos de los componentes. Esta página explica cómo dibujarlos, cómo controlar dónde se conectan y cómo unir partes sin cables mediante túneles.

![Cables trazados entre componentes, con puntos de conexión.](./images/wire-circuit-display.png)

## Dibujar cables

Elige la herramienta **Cable** de la barra de herramientas (atajo `W`) y luego arrastra sobre el tablero. Los cables son siempre rectos, discurriendo horizontal o verticalmente a lo largo de la cuadrícula. Arrastra en diagonal y el cable se traza en **forma de L**: la dirección en la que te muevas primero fija el primer tramo, y el codo sigue a tu cursor.

Suelta para colocar el cable. Un extremo de cable que caiga sobre el puerto de un componente se conecta a él automáticamente. Mientras arrastras, un segmento que discurriría a través del cuerpo de un componente se vuelve rojo y no se colocará: rodéalo en su lugar.

Para extender un tramo, simplemente dibuja otro cable partiendo del final de uno existente. Los cables que se encuentran extremo con extremo se unen en un único camino conectado.

## Cruces: cuándo se conectan los cables

Donde los cables se encuentran, Logigator sigue una regla sencilla para que mantengas el control de tu circuito:

- Un cable que **termina sobre** otro cable se conecta a él. Un pequeño **punto de conexión** marca la unión.
- Dos cables que simplemente se **cruzan** —sin que ninguno termine en el cruce— pasan uno sobre el otro **sin** conectarse. No hay punto, y no fluye ninguna señal entre ellos.

Esto te permite trazar cables cruzándolos libremente sin crear conexiones accidentales.

![Dos cruces: uno sin punto y otro unido por un punto de conexión.](./images/wire-junction.png)

### Alternar un cruce

Para conectar dos cables que solo se cruzan, elige la herramienta **Cable** y toca el punto de cruce: aparece un punto de conexión y los cables quedan ahora unidos. Toca el mismo punto de nuevo para volver a separarlos. Al pasar el cursor sobre el cruce con la herramienta Cable se previsualiza lo que hará un toque: el punto que añadiría, o el punto existente que quitaría.

También verás aparecer puntos de conexión por sí solos allí donde se juntan tres o más extremos de cable (o un extremo de cable y el puerto de un componente). Estos puntos son solo una señal visual que muestra dónde las cosas están conectadas eléctricamente; no los colocas ni los seleccionas.

## Negar un puerto

Con la herramienta **Cable** también puedes tocar directamente sobre el puerto de un componente para invertir la señal ahí: una pequeña **burbuja de negación** aparece en el puerto. Esto se explica en detalle en la página [Componentes y opciones](docs:components-and-options).

## Túneles: conexiones sin cables

Un **Túnel** conecta puntos de tu tablero sin un cable que discurra entre ellos. Todos los túneles que llevan la misma **etiqueta** están unidos eléctricamente, como si un cable los enlazara. Esto mantiene ordenados los tableros cargados; por ejemplo, para llevar un reloj o un bus compartido por el circuito sin dibujar cables largos.

Para usar túneles:

1. Coloca un **Túnel** desde la categoría **Básicos** de la paleta y cablealo a la señal que quieras llevar.
2. Coloca otro Túnel dondequiera que quieras que esa señal reaparezca.
3. Selecciona cada Túnel y dales la **misma Etiqueta** en la tarjeta de ajustes.

Todos los túneles con etiquetas coincidentes se comportan como una sola red conectada; los túneles con etiquetas distintas permanecen independientes.

![Dos túneles con la misma etiqueta, sin cable entre ellos.](./images/tunnel.gif)

## Cortar y reorganizar cables

La herramienta **Seleccionar** mueve y elimina cables junto con cualquier otra cosa que selecciones, y su modo tijera recorta un cable exactamente en el borde de tu recuadro de selección, útil para extraer un cable de un haz. La herramienta **Borrar** elimina los cables sobre los que haces clic o arrastras. Ambas se explican en [Tablero y herramientas](docs:board-and-tools).

## Consulta también

- [Componentes y opciones](docs:components-and-options): las piezas que conectan estos cables, y la negación de puertos
- [Simulación](docs:simulation): ejecutar el circuito y ver iluminarse los cables alimentados
- [Tablero y herramientas](docs:board-and-tools): la herramienta Cable, seleccionar, cortar y borrar
