# Simulación

«Iniciar simulación», en el extremo derecho de la barra de herramientas, pone el circuito en marcha: los cables con corriente se iluminan, los LEDs y las pantallas muestran su estado, y los interruptores y botones responden a los clics. `Enter` hace lo mismo.

![Un reloj que controla un LED en una simulación en marcha.](./images/simulation-showcase.webp)

## Entrar y salir

La simulación siempre ejecuta el proyecto principal. Si la pestaña de un componente personalizado está abierta, el editor vuelve antes al proyecto principal.

Mientras se ejecuta, el tablero está bloqueado. Puedes desplazar la vista y hacer zoom, usar las entradas e [inspeccionar](docs:inspection) ROMs y componentes personalizados, pero no colocar, mover, cablear ni eliminar nada. «Salir de la simulación», `Enter` o `Escape` vuelve a la edición con la herramienta Desplazar.

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

Bajo los modos, «Relojes a esta velocidad» lista la frecuencia que da cada retardo de reloj del circuito. Un reloj está activo un tick e inactivo durante Retardo ticks, así que un ciclo dura Retardo + 1 ticks: a 10 Hz, un reloj con retardo 1 funciona a 5 Hz y uno con retardo 4 a 2 Hz. Con velocidad fija, la lista aparece enseguida. En los otros dos modos hay que medir antes el ritmo, así que la lista aparece alrededor de un segundo después de que el circuito arranque.

## Usar las entradas

- Un interruptor cambia con cada clic y se queda donde lo dejas.
- Un botón está activo mientras lo mantienes pulsado.
- Un botón de pulso envía un pulso de un tick por clic, lo mantengas pulsado el tiempo que sea.

Arrastrar en cualquier otro punto del tablero desplaza la vista.

## Cuando la simulación no arranca

El editor no arranca y muestra un mensaje con el componente afectado cuando:

- un componente personalizado se contiene a sí mismo, directamente o a través de otro,
- un componente personalizado no tiene ningún circuito dentro,
- los puertos de un componente personalizado ya no coinciden con los conectores Entrada y Salida de su circuito.

Corrige el componente indicado y vuelve a empezar. Si el mensaje dice que el motor de simulación no pudo arrancar, tu navegador no admite WebAssembly.

## Ver también

- [Inspección y monitores](docs:inspection): contenido de ROMs y monitores
- [Componentes y opciones](docs:components-and-options): qué hace cada entrada y pantalla
- [Ajustes](docs:settings): el inicio automático de la simulación
- [Móviles y tabletas](docs:phones-and-tablets): los controles en la vista táctil
