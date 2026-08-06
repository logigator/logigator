# Componentes personalizados

Un componente personalizado empaqueta todo un circuito en una única pieza reutilizable con su propio símbolo y puertos con nombre. Construye un contador o una ALU una vez y luego colócalo en circuitos más grandes como un bloque ordenado.

![Un componente personalizado junto al circuito de puertas al que sustituye.](./images/custom-component-showcase.gif)

## Crear un componente

Elige **Archivo → Nuevo componente** para abrir el diálogo de nuevo componente. Rellena:

- **Nombre**: cómo se llama el componente en tu biblioteca y paleta.
- **Símbolo**: una etiqueta corta dibujada en la caja del componente.
- **Descripción**: una nota opcional sobre lo que hace.
- **Almacenar**: dónde reside: **Nube** (tu cuenta de Logigator, accesible desde cualquier dispositivo) o **Local** (solo este navegador). El almacenamiento en la nube requiere que hayas iniciado sesión; los componentes locales no se sincronizan entre dispositivos y pueden perderse.

Elegir **Crear** abre el nuevo componente en su propia pestaña, con un tablero vacío listo para que construyas su circuito.

## Definir entradas y salidas

Dentro del editor de un componente, la paleta gana una categoría **Puertos** que contiene dos conectores:

- **Entrada**: define un puerto de entrada en el componente terminado.
- **Salida**: define un puerto de salida.

Coloca un conector de Entrada o Salida por cada puerto que quieras, luego cablealo en tu circuito como cualquier otro componente. Selecciona un conector y fija su **Etiqueta** en la tarjeta de ajustes: esa etiqueta nombra el puerto y se muestra en la caja del componente cuando se coloca. El orden de los conectores fija el orden de los puertos.

Un panel dedicado de **Puertos** lista las entradas y salidas que has definido hasta ahora, para que puedas llevar la cuenta a medida que el componente toma forma.

![Una pestaña de editor de componente con conectores de Entrada y Salida.](./images/custom-component-tab.png)

## Colocar tus componentes

Los componentes personalizados guardados aparecen en la paleta bajo **Componentes del usuario**. Coloca uno exactamente como una pieza integrada: haz clic en él y suéltalo en el tablero. Aparece como una única caja que lleva tu símbolo, con un puerto por cada conector de Entrada y Salida que definiste.

Un componente colocado es una copia autocontenida del circuito tal como estaba cuando lo colocaste, así que tus circuitos siguen funcionando aunque más tarde cambies o elimines el original.

## Editar un componente y actualizar instancias

Para cambiar el circuito de un componente personalizado, ábrelo en su propia pestaña: elige **Editar circuito** en su tarjeta de ajustes mientras una instancia está seleccionada, o ábrelo desde tu biblioteca. Para cambiar en su lugar su nombre, símbolo o descripción, elige **Editar detalles**. Editar el componente **no** cambia automáticamente las piezas que ya colocaste: cada instancia colocada permanece tal como estaba.

Cuando una instancia colocada va por detrás de la última versión de su componente, su tarjeta de ajustes ofrece **Actualizar a la última versión**. Elegirla cambia esa instancia por la versión actual, conservando su posición y dirección. La actualización es por instancia y se puede deshacer, así que tú decides exactamente qué copias avanzan. Para actualizar todas las copias a la vez, usa **Actualizar todas las instancias**: aparece en la tarjeta de ajustes (con una instancia seleccionada o con el componente elegido en la paleta) mientras el circuito actual conserve una copia desactualizada, y el número de su etiqueta indica cuántas abarca. Todo el lote es un solo paso de deshacer. Además, la casilla de la paleta muestra una pequeña marca de flecha mientras alguna de sus copias colocadas esté desactualizada.

## Anidamiento y dependencias

Un componente personalizado puede contener otros componentes personalizados, así que puedes construir desde piezas pequeñas hasta grandes. Logigator evita los bucles: un componente nunca puede contenerse a sí mismo, directa o indirectamente, así que mientras editas uno, los componentes que crearían tal bucle no están disponibles en la paleta.

Cuando guardas o compartes un componente, las piezas que usa viajan con él, de modo que siempre se abre completo en otro dispositivo o en la biblioteca de otra persona.

## Compartir y mirar dentro

- Para trasladar un componente local a tu cuenta, o para compartirlo con un enlace, consulta [Nube y compartir](docs:cloud). Guardar un componente de la nube que usa piezas locales publica primero esas piezas en tu biblioteca en la nube.
- Para asomarte dentro de una instancia en ejecución y ver sus señales internas, consulta [Inspección y monitores](docs:inspection).
- Para quitar un componente de tu biblioteca, usa **Eliminar** en su tarjeta de ajustes. Las copias que ya colocaste permanecen como piezas incrustadas que puedes restaurar más adelante.

## Consulta también

- [Componentes y opciones](docs:components-and-options): las piezas integradas de las que están hechos tus componentes
- [Cables y conexiones](docs:wires-and-connections): cablear los conectores en el circuito de tu componente
- [Inspección y monitores](docs:inspection): observar una instancia en ejecución desde dentro
- [Nube y compartir](docs:cloud): publicar y compartir tus componentes
- [Guardar y archivos](docs:saving-and-files): cómo se almacenan los circuitos y sus componentes
