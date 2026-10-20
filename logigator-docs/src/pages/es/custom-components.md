# Componentes personalizados

Un componente personalizado convierte un circuito en una sola pieza con su propio símbolo y puertos con nombre. Construye un contador una vez, y cada copia en el tablero es un bloque en lugar de una docena de puertas.

![Un circuito de puertas y el componente personalizado hecho con él, funcionando uno junto al otro.](./images/custom-component-showcase.webp)

## Crear un componente

1. Elige Archivo → Nuevo componente (`Alt+N`), o el botón «Nuevo componente» de la barra de herramientas. Se abre un diálogo.
2. Rellena el diálogo:
   - Nombre, hasta 20 caracteres, es como aparece en la paleta.
   - Símbolo, hasta 5 caracteres, se dibuja en el bloque.
   - Descripción es opcional.
   - Almacenar decide dónde se guarda el componente. Local lo guarda en este navegador. Nube lo guarda en tu cuenta, requiere haber iniciado sesión y pregunta además quién puede abrirlo, con Todo el mundo preseleccionado (consulta [Nube y compartir](docs:cloud#compartir)).
3. Haz clic en «Crear». El componente se abre en una pestaña nueva con el tablero vacío.
4. Construye su circuito y dale [puertos](#puertos).
5. Guarda (`Ctrl+S`) en esa pestaña para guardar el componente.

## Puertos

Mientras la pestaña de un componente está activa, hay un panel Puertos encima de la paleta. Coloca desde él conectores Entrada y Salida y conéctalos al circuito. Cada conector se convierte en un puerto del componente terminado.

El panel lista los conectores. Escribe en una fila para dar nombre al puerto, con hasta 5 caracteres; el nombre aparece junto al puerto en el bloque. Arrastra las filas para cambiar el orden de los puertos; la posición de los conectores en el tablero no importa.

![La pestaña de un componente con sus conectores Entrada y Salida.](./images/custom-component-tab.webp)

## Colocar y actualizar

Los componentes guardados aparecen en la paleta en Componentes del usuario, el último editado primero. Se colocan como cualquier otra pieza. Cada copia en el tablero es un bloque con el símbolo y un puerto por conector.

Una copia colocada conserva el circuito que tenía el componente cuando la colocaste. Editar el componente después no cambia ninguna copia hasta que la actualices. La casilla de la paleta lleva una flecha mientras haya copias desactualizadas.

La tarjeta de ajustes de una copia colocada, o de la casilla de la paleta, tiene estas acciones:

| Acción                          | Qué hace                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Actualizar a la última versión  | Actualiza esta copia. Solo en una copia desactualizada.                                                                         |
| Actualizar todas las instancias | Actualiza todas las copias desactualizadas del circuito abierto. El número va entre paréntesis.                                 |
| Editar circuito                 | Abre el circuito del componente para cambiarlo.                                                                                 |
| Editar detalles                 | Cambia el nombre, el símbolo y la descripción. Las copias colocadas conservan los detalles anteriores hasta que las actualices. |
| Subir a la nube                 | Mueve un componente local a tu cuenta. Consulta [Nube y compartir](docs:cloud#subir-a-la-nube).                                 |
| Compartir                       | Abre el diálogo de compartir de un componente de la nube. Consulta [Nube y compartir](docs:cloud#compartir).                    |
| Eliminar                        | Quita el componente de tu biblioteca. Consulta [Eliminar](#eliminar).                                                           |
| Restaurar y editar              | Solo en una copia cuyo componente se eliminó. Lo devuelve a tu biblioteca local.                                                |

Las dos actualizaciones se pueden deshacer.

## Anidar

Los componentes pueden contener otros componentes. Un componente nunca puede contenerse a sí mismo, ni directamente ni a través de otro; por eso, mientras editas uno, la paleta oculta todos los componentes que crearían ese bucle.

Cuando guardas, compartes o exportas un circuito, los componentes que usa van incluidos, así que se abre completo en cualquier sitio.

## Eliminar

«Eliminar» en la tarjeta de ajustes quita el componente de tu biblioteca. Las copias ya colocadas siguen en sus circuitos y muestran la etiqueta Incrustado. «Restaurar y editar» en una de esas copias la devuelve a tu biblioteca local. Al eliminar un componente de la nube, su enlace para compartir también deja de funcionar.

## Ver también

- [Componentes y opciones](docs:components-and-options): las piezas integradas
- [Inspección y monitores](docs:inspection): mirar dentro de una copia en marcha
- [Nube y compartir](docs:cloud): subir y compartir componentes
- [Guardar y archivos](docs:saving-and-files): cómo viajan los componentes en los archivos
