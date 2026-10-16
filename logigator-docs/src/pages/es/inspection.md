# Inspección y monitores

Durante una [simulación](docs:simulation), en marcha o en pausa, tres tipos de componente se pueden abrir para ver su interior. Un clic en una ROM muestra su contenido, con la palabra que está leyendo resaltada, y un clic en una RAM muestra lo que guarda a medida que el circuito escribe en ella. Un clic en un componente personalizado abre un monitor, una vista en directo de su circuito interno.

![Una ventana de monitor junto al circuito en marcha al que pertenece.](./images/inspection-showcase.webp)

En el escritorio, cada vista se abre en una ventana que puedes mover y cambiar de tamaño. Otro clic en el componente trae su ventana al frente. En la [vista táctil](docs:phones-and-tablets), las vistas de ROM y de RAM comparten un panel en la parte inferior de la pantalla, y un monitor ocupa toda la pantalla. Al salir de la simulación se cierran todas.

## Contenido de una ROM

![La vista de la ROM siguiendo la dirección mientras cambia.](./images/rom-inspection.webp)

La vista es de solo lectura; el contenido se cambia al editar, en los ajustes de la ROM. La palabra de la dirección actual está resaltada, y con «Seguir» (activado por defecto) la tabla se desplaza a medida que cambia la dirección. La línea de abajo muestra la dirección y el valor de la celda resaltada. Un clic en otra celda muestra esa hasta el siguiente cambio de dirección.

Los botones sobre la tabla eligen Palabras o Bytes y la base: Hex, Decimal, Octal o Binario. Para ir a una dirección, escríbela en hexadecimal en el campo «Dirección…». «Copiar» pone toda la tabla en el portapapeles como texto, en la vista y la base elegidas.

## Contenido de una RAM

La vista de una RAM tiene la misma tabla, los mismos botones y el mismo «Seguir» que la de una ROM, con la palabra de la dirección presente en sus entradas resaltada. Muestra lo que el circuito ha guardado y cambia a medida que escribe, en marcha o paso a paso. También es de solo lectura: solo el circuito escribe en una RAM. Cada palabra vale 0 al empezar la simulación, y «Detener» las vuelve a poner todas a 0.

Una RAM grande solo se lee alrededor de las filas en pantalla. Una fila que entra en pantalla muestra puntos hasta que se ha leído, lo que tarda un momento, y la línea de abajo indica «Sin cargar» para una celda mostrada así. «Copiar» pone la tabla en el portapapeles tal como la ves, puntos incluidos.

## Monitores

![Un monitor que ha bajado de Outer a Inner, con la ruta en el título.](./images/inspection-window-multilayer.webp)

Un monitor dibuja el circuito interno del componente con los mismos cables iluminados que el tablero. Dentro puedes desplazar la vista, hacer zoom y usar los interruptores y botones que contiene. Controlan la simulación real, así que el resto del circuito reacciona.

Un clic en un componente personalizado dentro de un monitor abre su circuito en la misma ventana, y el título muestra la ruta, por ejemplo Outer › Inner. Haz clic en un nombre anterior para volver a subir. Una ROM o una RAM dentro de un monitor abre su propia vista.

Un clic en un mando o un teclado dentro de un monitor abre su ventana, con la ruta en el título, por ejemplo Outer › Inner › Mando. Funciona como en el tablero (consulta [Jugar con un mando](docs:simulation#jugar-con-un-mando) y [Escribir en un teclado](docs:simulation#escribir-en-un-teclado)), y lo que pulsas ahí llega al componente dentro del monitor. Al subir por encima de su nivel o cerrar el monitor, también se cierra esa ventana.

Si el monitor avisa de que el circuito interno no coincide con la simulación compilada, el componente se cambió después de iniciar la simulación. Sal de la simulación y vuelve a iniciarla.

## Ver también

- [Simulación](docs:simulation): hacer funcionar un circuito
- [Componentes personalizados](docs:custom-components): construir los componentes que observas
- [Componentes y opciones](docs:components-and-options): opciones de ROM y RAM, contenido de una ROM
