# Simulación

«Iniciar simulación», en el extremo derecho de la barra de herramientas, pone el circuito en marcha: los cables con corriente se iluminan, los LEDs y las pantallas muestran su estado, y los interruptores y botones responden a los clics. `Enter` hace lo mismo.

![Un reloj que controla un LED en una simulación en marcha.](./images/simulation-showcase.webp)

## Entrar y salir

La simulación siempre ejecuta el proyecto principal. Si la pestaña de un componente personalizado está abierta, el editor vuelve antes al proyecto principal.

Mientras se ejecuta, el tablero está bloqueado. Puedes desplazar la vista y hacer zoom, usar las entradas e [inspeccionar](docs:inspection) ROMs, RAMs, terminales y componentes personalizados, pero no colocar, mover, cablear ni eliminar nada. «Salir de la simulación», `Enter` o `Escape` vuelve a la edición con la herramienta Desplazar.

Con «Iniciar la simulación automáticamente» activado (lo predeterminado), el circuito arranca en cuanto entras. Desactivado, la simulación espera en pausa en el tick 0 para que avances paso a paso desde el principio.

## Controles

Durante una simulación, la barra de herramientas se sustituye por cuatro botones, el botón de velocidad y un contador.

| Botón    | Qué hace                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------- |
| Ejecutar | Inicia o reanuda la simulación.                                                                 |
| Pausar   | Se detiene en el tick actual y conserva el estado.                                              |
| Paso     | Avanza un tick. Solo disponible en pausa.                                                       |
| Detener  | Devuelve el circuito al tick 0, apaga todos los interruptores y pausa. Sigues en la simulación. |

El contador muestra los ticks desde el inicio y, mientras se ejecuta, la velocidad alcanzada realmente.

![Los controles de simulación y el botón de velocidad.](./images/simulation-controls.webp)

## Velocidad

El botón de velocidad muestra el ajuste actual. Un clic abre un panel con tres modos, entre los que puedes cambiar mientras el circuito se ejecuta:

- Cada fotograma, lo predeterminado, avanza un tick por cada refresco de pantalla, así que la velocidad sigue la frecuencia de tu pantalla.
- Velocidad fija avanza al ritmo que elijas, 1 kHz al principio. El control deslizante va de 1 Hz a 10 MHz. En el campo de al lado puedes escribir cualquier ritmo desde 0,1 Hz, como `20`, `2,5k` o `1M`. Un campo rojo significa que lo escrito no es un ritmo, y sigue valiendo el último válido. Si el circuito no puede seguir el ritmo, aparece un signo de advertencia junto al contador.
- Lo más rápido posible funciona sin límite. La pantalla muestra entonces solo una parte de los ticks.

![El panel de velocidad con una velocidad fija de 10 Hz.](./images/simulation-speed.webp)

Bajo los modos, «Relojes a esta velocidad» lista la frecuencia de cada tipo de reloj del circuito. Una onda cuadrada está inactiva durante Retardo ticks y luego activa otros tantos, así que un ciclo dura 2 × Retardo ticks. Un pulso está activo un tick tras Retardo ticks inactivo, así que un ciclo dura Retardo + 1 ticks. A 10 Hz, una onda cuadrada con retardo 1 funciona a 5 Hz y una con retardo 5 a 1 Hz, y un pulso con retardo 4 a 2 Hz. Con velocidad fija, la lista aparece enseguida. En los otros dos modos hay que medir antes el ritmo, así que la lista aparece alrededor de un segundo después de que el circuito arranque.

## Usar las entradas

- Un interruptor cambia con cada clic y se queda donde lo dejas.
- Un botón está activo mientras lo mantienes pulsado. Transmite lo que está pulsado ahora: si haces clic muy por delante de una simulación lenta o en pausa, se salta las pulsaciones más antiguas, pero tu último clic siempre llega.
- Un botón de pulso envía un pulso de un tick por clic, lo mantengas pulsado el tiempo que sea. Es el que nunca se salta ningún clic, por mucha ventaja que le lleves a la simulación.
- Un mando abre su ventana de juego, descrita en la sección siguiente.
- Un teclado abre una ventana para escribir, descrita después del mando.

Arrastrar en cualquier otro punto del tablero desplaza la vista.

## Jugar con un mando

Un clic en un mando abre una ventana con el mando dibujado. Un botón que mantienes pulsado ahí pone su salida a 1 hasta que lo sueltas, y se ilumina también en el tablero. Como un botón, el mando transmite lo que está pulsado ahora y puede saltarse pulsaciones antiguas cuando le llevas mucha ventaja a una simulación lenta o en pausa, mientras que los botones pulsados a la vez llegan en el mismo tick.

![La ventana de un mando con A y Derecha pulsados, junto al mando en el tablero.](./images/gamepad-window.webp)

La ventana toma el teclado al abrirse, y la línea de abajo dice «Teclado activo». Después de un clic en el tablero o en otra ventana dice «Haz clic aquí para usar el teclado», y las teclas ya no llegan al mando. Bajo cada botón aparece su tecla. Mientras la ventana tiene el teclado, las teclas del mando van antes que los atajos: `Enter` pulsa Start en lugar de salir de la simulación. `Escape` sigue cerrando la ventana, y los atajos con `Ctrl` o `Alt` siguen funcionando. Las teclas predeterminadas y cómo cambiarlas están en [Atajos de teclado](docs:shortcuts#teclas-del-mando).

Con el ratón o con el dedo, un botón sigue pulsado mientras lo mantienes, y en una pantalla táctil cada dedo sostiene su propio botón. La cruceta tiene ocho direcciones: al pulsar entre dos brazos se pulsan los dos, y al deslizar el pulgar pasas de una dirección a la siguiente sin levantarlo. El centro de la cruceta no pulsa ninguna dirección.

Un mando físico conectado al ordenador también puede jugar. El navegador solo informa de un mando después de que pulses uno de sus botones con el editor abierto. Si lo haces con una ventana de mando abierta, el mando físico se conecta a esa ventana y aparece en el menú Mando de abajo. Un mando físico sigue jugando cuando otra ventana tiene el teclado, así que dos mandos físicos pueden manejar dos mandos a la vez, cada uno elegido en su propia ventana. Los botones se asignan por posición, digan lo que digan sus etiquetas: el botón de acción de la derecha es A, el de abajo B, el de arriba X y el de la izquierda Y. La cruceta y el stick izquierdo manejan los dos la cruceta, LB y LT son L, RB y RT son R, Back o Share es Select, y Start es Start. Los mandos de los que el navegador no informa con la disposición estándar aparecen en la lista, pero no se pueden elegir.

Al cerrar la ventana o salir de la simulación se sueltan todos los botones. Un mando dentro de un componente personalizado se juega desde un [monitor](docs:inspection#monitores). En la vista táctil, el mando se abre en el panel de la parte inferior de la pantalla; las teclas aparecen ahí en cuanto pulsas una tecla de un teclado, y el menú Mando en cuanto hay un mando físico conectado.

## Escribir en un teclado

Un clic en un teclado abre una ventana con un campo de escritura arriba. Mientras el campo tiene el foco, las teclas que pulsas van al circuito. Al pulsar una tecla, su código pasa a D0 a D7, STB envía un pulso de un tick y KD se enciende. KD sigue encendido mientras sostienes la tecla y se apaga cuando la sueltas, y D conserva el carácter hasta que la siguiente tecla lo sustituye. En el tablero, el recuadro del teclado muestra el carácter que hay en D y se ilumina mientras KD está encendido.

![La ventana de un teclado con hello y world escritos y la d pulsada, junto al teclado del tablero, que muestra la d.](./images/keyboard-window.webp)

El campo muestra los últimos 64 caracteres enviados, el más reciente a la derecha, y resalta el que hay en D mientras hay una tecla pulsada. Debajo, «En D» indica el código que recibe el circuito en ese momento: el carácter, su valor hexadecimal y sus 8 bits. La línea siguiente dice «Escribiendo en el circuito · Mayús+Tab para salir» mientras el campo tiene el foco. Después de un clic en otro sitio dice «Haz clic aquí para escribir», y las teclas no llegan al teclado hasta que vuelves a hacer clic en la ventana.

Una tecla sostenida no se repite, así que STB envía un pulso por pulsación. KD le dice al circuito si hay una tecla pulsada: uno que deba repetir una tecla sostenida puede hacer funcionar un reloj mientras KD esté encendido, y uno que cuente pulsaciones puede contar los pulsos de KD. Si pulsas una segunda tecla antes de soltar la primera, el código de la segunda pasa a D, con un nuevo pulso en STB, y KD sigue encendido hasta que sueltas las dos.

El código es Latin-1: ASCII más las letras con acento y los símbolos de las lenguas de Europa occidental. Los caracteres imprimibles, del espacio a `~` y de `0xA0` a ÿ, se envían tal cual, así que ñ llega como `0xF1`. El espacio de no separación (`0xA0`) y el guion blando (`0xAD`) se muestran como NBS y SHY, porque no se ven. Estas teclas envían códigos de control, que el tablero y «En D» muestran por su nombre:

| Tecla       | Código | Se muestra como |
| ----------- | ------ | --------------- |
| `Enter`     | `0x0A` | LF              |
| `Backspace` | `0x08` | BS              |
| `Tab`       | `0x09` | TAB             |
| `Escape`    | `0x1B` | ESC             |
| `Delete`    | `0x7F` | DEL             |
| `→`         | `0x1C` | RT              |
| `←`         | `0x1D` | LT              |
| `↑`         | `0x1E` | UP              |
| `↓`         | `0x1F` | DN              |
| `Home`      | `0x0B` | HOM             |

Un [terminal](#mostrar-texto-en-un-terminal) entiende todos estos códigos salvo ESC, así que, conectado a un teclado, muestra lo que escribes.

Las teclas de función, `End`, `Page Up`, `Page Down` e `Insert` no envían nada, y tampoco las flechas y `Home` mientras mantienes `Shift`. Las comillas tipográficas y las rayas se envían como `'`, `"` y `-`, y … como tres puntos. Cualquier otro carácter fuera de Latin-1, como € o un emoji, se omite, y la línea de abajo lo indica durante unos segundos. Los caracteres que escribes con `AltGr`, como @ en un teclado español, se envían. Las combinaciones con `Ctrl`, `Alt` o `⌘` quedan para el navegador. Qué teclas van al circuito en lugar de al editor está en [Atajos de teclado](docs:shortcuts#teclas-en-la-ventana-de-un-teclado).

Pegar envía el texto pegado carácter a carácter. «Escribir texto…», en la parte inferior de la ventana, abre un diálogo donde puedes escribir o pegar un texto más largo, un programa por ejemplo. Antes de enviarlo, el diálogo indica cuántos caracteres se omitirán. Los saltos de línea se envían como LF y los tabuladores como TAB, los demás caracteres de control se descartan, y cada pegado o cada envío desde el diálogo admite hasta 10 000 caracteres. Cada carácter llega como una tecla pulsada y soltada: KD está encendido tres ticks, y STB sube un tick después de que llegue el código y baja un tick antes de que KD se apague, así que un circuito que guarda D cuando sube STB lee cada carácter, aunque haya una puerta más en el camino de D que en el de STB, o al revés. Después de cada carácter KD está apagado un tick, así que una letra doble llega como dos pulsos en KD. Mientras hay caracteres esperando, la ventana muestra «Enviando» con el número que queda y una ✕ que descarta el resto. Un carácter cuyo pulso en STB ya ha empezado llega igualmente, y KD se apaga. También pasa cuando escribes más rápido de lo que avanza la simulación, por ejemplo a una velocidad fija baja. Como mucho pueden esperar 21 845 caracteres a la vez, y un pegado o un envío que no quepa detrás de ellos no se envía en absoluto, ni siquiera en parte: la ventana o el diálogo te pide que esperes a que salgan.

Con la simulación en pausa, las teclas esperan a «Paso». Una tecla que pulsas y sueltas está en D, con KD encendido, después del siguiente paso; STB está a 1 después del segundo y vuelve a 0 después del tercero, y KD se apaga después del cuarto, mientras el carácter sigue en D. El siguiente carácter llega después del quinto, así que un texto pegado necesita cuatro pasos por carácter.

Al cerrar la ventana, hacer clic fuera de ella o cambiar a otra pestaña se sueltan todas las teclas pulsadas. «Detener» borra los caracteres del campo. En un teclado dentro de un componente personalizado se escribe desde un [monitor](docs:inspection#monitores). En un móvil o una tableta, la ventana se abre en el panel de la parte inferior de la pantalla (consulta [Móviles y tabletas](docs:phones-and-tablets#simulación-e-inspección)).

## Mostrar texto en un terminal

Un terminal muestra un carácter cada vez que sube su entrada CLK: el que tiene su código en D0 a D7 en ese tick. Con una burbuja de negación en CLK, lo muestra en el flanco de bajada. El siguiente carácter va donde está el cursor de bloque, que la pantalla solo muestra durante una simulación.

Para ver lo que escribes, conecta D0 a D7 de un teclado a D0 a D7 del terminal, y su salida STB a CLK. `Enter` empieza entonces una línea nueva, `Backspace` borra el carácter anterior al cursor, y las flechas y `Home` mueven el cursor.

Los códigos son Latin-1, como en el teclado. Los códigos del espacio a `~` y de `0xA0` a ÿ se muestran como su carácter, así que `0x41` muestra A y `0xF1` muestra ñ. El espacio de no separación se muestra como un espacio y el guion blando como un guion. Estos códigos de control mueven el cursor o borran:

| Código | Nombre | Qué hace                                                                                           |
| ------ | ------ | -------------------------------------------------------------------------------------------------- |
| `0x08` | BS     | Retrocede una columna y borra el carácter que hay ahí. En la primera columna no hace nada.         |
| `0x09` | TAB    | Avanza hasta la siguiente tabulación, una cada 8 columnas, o hasta la última columna.              |
| `0x0A` | LF     | Pasa al principio de la fila siguiente. En la última fila, la pantalla sube una fila en su lugar.  |
| `0x0B` | HOM    | Va a la esquina superior izquierda.                                                                |
| `0x0C` | FF     | Borra la pantalla y va a la esquina superior izquierda. Las líneas borradas no pasan al historial. |
| `0x0D` | CR     | Vuelve al principio de la fila.                                                                    |
| `0x1C` | RT     | Avanza una columna a la derecha.                                                                   |
| `0x1D` | LT     | Retrocede una columna a la izquierda.                                                              |
| `0x1E` | UP     | Sube una fila.                                                                                     |
| `0x1F` | DN     | Baja una fila.                                                                                     |
| `0x7F` | DEL    | Borra el carácter bajo el cursor. El cursor no se mueve.                                           |

RT, LT, UP y DN se detienen en los bordes de la pantalla; solo LF la desplaza. Cualquier otro código, ESC y de `0x80` a `0x9F` incluidos, se ignora.

Un carácter mostrado en la última columna deja ahí el cursor, y el siguiente carácter va al principio de la fila siguiente, desplazando la pantalla si el cursor estaba en la última fila. Por eso una línea llena seguida de LF no deja una línea vacía. Un código que mueve el cursor anula ese salto, así que un BS justo después de la última columna borra el carácter que hay en ella.

Una línea que sale de la pantalla por arriba pasa al historial tal como estaba, y los códigos del cursor ya no pueden cambiarla. El historial guarda las últimas 10 000 líneas y se muestra en la [ventana](docs:inspection#salida-de-un-terminal) del terminal. «Pausar» conserva el texto en la pantalla y en el historial. «Detener» borra ambos, igual que salir de la simulación.

## Señales en conflicto

Un cable dibujado en naranja tiene un conflicto. Hay dos causas:

- Dos o más salidas controlan el mismo cable y, en ese momento, una está a 1 y otra a 0. Las salidas que coinciden no se marcan, así que el naranja puede aparecer y desaparecer según cambian los valores.
- Un biestable SR recibió un flanco de reloj con S y R a 1 a la vez. Q pasa a 1 y !Q a 0, y ambas siguen en naranja hasta un flanco de reloj con solo S o solo R a 1.

La simulación sigue igual: un cable con varias salidas está a 1 en cuanto una de ellas está a 1. El naranja es un aviso sobre tu circuito. En hardware real, el primer caso sería un cortocircuito, y el segundo es una combinación de entradas que un biestable SR no admite.

Para el primer caso, conecta una sola salida a cada cable. Para combinar varias fuentes, pásalas por una puerta O, y para elegir una de ellas, usa un multiplexor. En un biestable SR, no pongas S y R a 1 a la vez, o usa un biestable D o JK en su lugar.

Un conflicto dentro de un componente personalizado no se muestra en el tablero. Haz clic en el componente para abrir un [monitor](docs:inspection#monitores), donde sus cables lo muestran.

El ajuste «Resaltar conflictos», activado de forma predeterminada, quita el naranja. Consulta [Ajustes](docs:settings).

## Cuando la simulación no arranca

El editor no arranca y muestra un mensaje con el componente afectado cuando:

- un componente personalizado se contiene a sí mismo, directamente o a través de otro,
- un componente personalizado no tiene ningún circuito dentro,
- los puertos de un componente personalizado ya no coinciden con los conectores Entrada y Salida de su circuito.

Corrige el componente indicado y vuelve a empezar. Si el mensaje dice que el motor de simulación no pudo arrancar, tu navegador no admite WebAssembly.

## Ver también

- [Inspección y monitores](docs:inspection): contenido de ROMs y RAMs, salida de terminales, y monitores
- [Componentes y opciones](docs:components-and-options): qué hace cada entrada y pantalla
- [Ajustes](docs:settings): el inicio automático de la simulación y el resaltado de conflictos
- [Móviles y tabletas](docs:phones-and-tablets): los controles en la vista táctil
