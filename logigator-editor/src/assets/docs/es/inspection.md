# Inspección y monitores

Algunos componentes te permiten mirar dentro de ellos mientras tu circuito se ejecuta. Puedes leer el contenido de una memoria en la dirección que está leyendo actualmente, o abrir una vista interactiva y en directo del circuito interno de un componente personalizado.

![Una ventana de monitor abierta sobre un circuito en ejecución.](../images/inspection-showcase.png)

La inspección solo está disponible **mientras se ejecuta una [simulación](docs:simulation)**. Entra primero en la simulación y luego toca un componente que admita inspección para abrir su vista. Tocarlo de nuevo trae la misma vista de vuelta al frente, y salir de la simulación lo cierra todo.

En el escritorio, estas vistas se abren como ventanas flotantes que puedes arrastrar y apilar sobre el tablero. En teléfonos y pantallas estrechas aparecen en su lugar como un panel que se desliza hacia arriba desde abajo, y los monitores ocupan toda la pantalla: el circuito en ejecución permanece visible e interactivo detrás de ellos.

## Inspeccionar el contenido de una memoria

Toca una **ROM** mientras la simulación se ejecuta para abrir un visor de solo lectura de sus datos almacenados. La palabra que el circuito está **direccionando actualmente** se resalta y se actualiza en directo a medida que cambia la dirección, para que puedas seguir exactamente qué está devolviendo la memoria al circuito.

![La ventana de inspección de memoria con la palabra direccionada resaltada.](../images/rom-inspection.gif)

El visor es solo para leer: aquí no puedes cambiar el contenido. Sus controles te permiten elegir cómo se muestran los datos:

- **Palabras / Bytes**: muestra cada valor almacenado entero, o dividido en bytes individuales.
- **Hex / Decimal / Octal / Binario**: la base numérica en que se muestra cada valor.
- **Ir a la dirección**: salta directamente a una dirección específica.
- **Seguir**: mantiene la palabra direccionada actualmente desplazada a la vista a medida que la dirección se mueve.

Una lectura de **Dirección** y **Valor** muestra la dirección de la palabra resaltada y su contenido.

## Monitorizar el circuito interno de un componente personalizado

Toca un [componente personalizado](docs:custom-components) colocado mientras la simulación se ejecuta para abrir un **monitor**: una vista en directo del circuito que hay dentro de él. Los cables y puertos internos se iluminan exactamente como los alimenta el circuito en ejecución, para que puedas ver qué está ocurriendo un nivel más abajo sin desempaquetar el componente.

![Una ventana de monitor con un rastro de migas de pan hacia un componente anidado.](../images/inspection-window-multilayer.png)

Un monitor es interactivo:

- **Acciona sus entradas**: haz clic en un **interruptor** o **botón** dentro del circuito monitorizado para operarlo, igual que en el tablero principal. Acciona la simulación real en ejecución, así que el efecto se propaga al resto de tu circuito.
- **Profundiza en componentes anidados**: toca un componente personalizado dentro del monitor para descender a _su_ circuito interno. Un rastro de **migas de pan** en la parte superior muestra a qué profundidad estás; haz clic en un paso anterior para volver a salir.
- **Desplázate y haz zoom**: arrastra para moverte por la vista interna y desplaza o pellizca para hacer zoom, igual que en el tablero.

Si un componente no se puede monitorizar, verás un breve mensaje: puede que no tenga **circuito interno** para inspeccionar, o que su circuito interno ya no coincida con la simulación en ejecución; en ese caso, **reinicia la simulación** e inténtalo de nuevo.

> **Pantallas compactas:** los monitores se abren como una vista a pantalla completa con un botón de retroceso en lugar del botón de cerrar de la ventana; las migas de pan aún te permiten retroceder por los niveles anidados.

## Consulta también

- [Simulación](docs:simulation): ejecutar tu circuito e interactuar con él
- [Componentes personalizados](docs:custom-components): construir y usar componentes reutilizables
- [Componentes y opciones](docs:components-and-options): memorias, interruptores, botones y otros bloques de construcción
