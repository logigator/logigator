# Cables y conexiones

Los cables llevan las señales entre los puertos. Siguen la cuadrícula en horizontal y en vertical, y una señal se propaga por cada cable conectado a ella.

## Trazar cables

Elige la herramienta de cable (`W`) y arrastra. Un arrastre en diagonal traza una L: la dirección en la que te mueves primero se convierte en el primer tramo. Si cambias de idea, vuelve al punto de partida y arranca en la otra dirección.

Un cable puede empezar en un puerto, en una unión o en cualquier punto de otro cable, y se conecta allí donde termina sobre un puerto. Mientras arrastras, un tramo que atravesaría un componente se vuelve rojo. Si sueltas con un tramo rojo, no se coloca nada.

Un cable trazado encima de otro existente se funde con él, y dos cables que se encuentran extremo con extremo en línea recta pasan a ser uno.

## Dónde se conectan los cables

Un cable que termina sobre otro se conecta a él, y un cable que pasa por la punta de un puerto se conecta a ese puerto. Dos cables que solo se cruzan, sin que ninguno termine allí, siguen separados. Así puedes pasar cables unos sobre otros sin conectarlos.

Aparece un punto de conexión allí donde se juntan tres o más extremos de cable y puntas de puerto. Un cruce simple no tiene punto.

![Dos cruces: el de la izquierda separado, el de la derecha conectado.](./images/wire-junction.webp)

Para conectar un cruce, tócalo con la herramienta de cable. Aparece un punto y los cuatro tramos quedan conectados. Toca el punto otra vez para separarlos. Al pasar el puntero sobre un cruce, ves lo que haría un toque. Un punto donde un cable termina sobre otro no se quita así; elimina o mueve el cable.

## Túneles

Un túnel está conectado con todos los demás túneles del mismo tablero que llevan la misma etiqueta, como si un cable los uniera. Úsalos para llevar un reloj o un bus a través de un circuito grande. Cada túnel nuevo empieza con la etiqueta 0, así que dos túneles nuevos están conectados hasta que cambies uno de ellos. Las etiquetas distinguen mayúsculas de minúsculas y tienen como máximo 10 caracteres.

Los túneles solo se conectan dentro de un mismo circuito. Un túnel dentro de un componente personalizado nunca se conecta con uno de fuera.

![Un interruptor que enciende un LED a través de dos túneles con la misma etiqueta.](./images/tunnel.webp)

## Reparar cables

Editar → Reparar cables busca en el tablero fallos de cables, como tramos solapados, que hacen que las conexiones se comporten de forma inesperada, y los corrige. Cuando un circuito cargado tiene esos fallos, el editor ofrece la reparación con un botón «Reparar cables». Comprueba después que el circuito sigue haciendo lo que debe. Una reparación durante una simulación detiene primero la simulación.

## Ver también

- [Tablero y herramientas](docs:board-and-tools): seleccionar, cortar y borrar cables
- [Componentes y opciones](docs:components-and-options): negar un puerto
- [Simulación](docs:simulation): ver cómo se iluminan los cables con corriente
