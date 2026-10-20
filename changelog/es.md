# Registro de cambios

Todos los cambios notables de Logigator se registran aquí. La versión más
reciente se muestra primero.

## [Unreleased]

**Toda la web se ha reconstruido** a juego con el editor, y la documentación
está ahora directamente en la web. En el editor, los cables muestran las señales
en conflicto en cuanto aparecen, y con un mando, un teclado y un terminal tus
circuitos reciben entradas y muestran texto mientras se simulan.

### ✨ Añadido

- **🌐 Un logigator.com reconstruido.** Una página de inicio nueva y páginas
  rediseñadas por todas partes, la documentación y el registro de cambios
  directamente en la web, y todos los ejemplos rehechos, cinco de ellos nuevos,
  para que cada componente integrado aparezca en al menos uno.
- **🟠 Conflictos resaltados.** Durante la simulación, un cable cuyas salidas no
  coinciden se vuelve ahora naranja, para que un cortocircuito se vea en cuanto
  ocurre. El cable sigue contando como 1 mientras al menos una salida le dé 1.
  Está activado por defecto, un consejo lo explica la primera vez, y el
  ajuste «Resaltar conflictos» lo desactiva.
- **🎮 Mando, teclado y terminal.** Juega con un circuito en un mando en
  pantalla, con tus propias teclas o con un mando de verdad, incluso entre dos.
  Escribe en él en directo o pega un texto entero, y míralo escribir en un
  terminal mientras se simula.
- **🔗 Páginas para los enlaces compartidos.** Un enlace compartido abre una
  página con el circuito, su autor y sus estrellas, lista para abrirlo en el
  editor o guardar tu propia copia. Pegado en un chat, se muestra como una
  tarjeta con tu circuito, y puedes insertarlo en otras páginas.
- **🔒 Proyectos y componentes privados.** Además de «Cualquiera con el enlace»
  y «Todo el mundo», «Solo tú» guarda un documento para ti. Su enlace sigue
  siendo el mismo elijas lo que elijas, así que puedes volver a compartirlo más
  tarde.
- **Más por descubrir en la comunidad.** Explora por tendencia, ahora el orden
  por defecto, busca mientras escribes y encuentra en el perfil de un miembro
  una presentación, una web y enlaces, junto con las estrellas que han reunido
  sus trabajos. Un proyecto o componente publicado sin contenido queda fuera de
  las listas.
- **Descripciones con formato.** Negrita, listas, enlaces y más en las
  descripciones y los perfiles, editados directamente en su sitio. Las
  descripciones de los componentes integrados del editor también lo usan.
- **Una vista en directo de la RAM.** Toca una RAM durante la simulación para
  seguir su contenido en una vista hexadecimal que sigue la dirección leída.
- **Ayuda justo donde la necesitas.** Ventanas y diálogos tienen un botón de
  ayuda que abre la sección adecuada, cada ajuste se explica junto a su
  interruptor, y la documentación reescrita describe cada componente y tiene
  una página para móviles y tabletas.
- **Un botón que sigue encendido mientras lo mantienes pulsado.** El botón que
  envía un solo pulso se llama ahora botón de pulso.
- **Exportación de imágenes en WebP sin pérdida**, donde tu navegador lo admite.
  WebP solo se ofrece donde tu navegador puede escribirlo.
- «Registrarse» junto a «Iniciar sesión» en el menú de cuenta del editor.
- Un aviso cuando tu navegador es más antiguo que aquellos con los que se prueba
  el editor.

### 🔄 Cambiado

- **Componentes más cercanos a los reales.** Un reloj nuevo da una onda
  cuadrada, a 1 tanto tiempo como a 0, así que un ciclo dura el doble de su
  retardo. Una RAM nueva muestra la palabra direccionada al instante. El pulso y
  la lectura con el reloj siguen disponibles como opciones. Un demultiplexor
  nuevo toma primero sus líneas de selección y un codificador nuevo indica si
  hay alguna entrada activa. Los circuitos guardados antes siguen funcionando
  como siempre.
- **⚡ Los circuitos grandes se abren antes y se desplazan con fluidez.** Las
  partes del tablero que no ves ya no se preparan de antemano, así que los
  circuitos grandes aparecen antes y siguen el ritmo de tu pantalla al
  desplazarlos, incluso con poco zoom.
- **Los circuitos grandes se guardan antes y ocupan mucho menos espacio**, en
  la nube y en tu navegador.
- **Un solo control de velocidad.** Un único botón elige «Cada fotograma», una
  velocidad fija de hasta 10 MHz o «Lo más rápido posible», y muestra la
  frecuencia de cada reloj del tablero.
- **Zoom fluido.** La rueda del ratón y el trackpad hacen zoom suave bajo el
  puntero, y el botón central del ratón desplaza el tablero igual que el
  derecho.
- **Una paleta agrupada por función**: puertas lógicas, entradas, salidas,
  sumadores y selectores, memoria y temporización. Las categorías que pliegas
  siguen plegadas.
- Un componente que estás colocando queda centrado bajo el puntero.
- El interruptor de los consejos está junto a los demás ajustes del editor, y
  al desactivarlo termina el tutorial en curso.
- Una cuenta cuya dirección de correo no se confirma en 90 días se elimina.
- **Novedades más claras.** En el diálogo de Novedades del editor, cada versión
  empieza ahora con su número y una fecha escrita en tu idioma.

### 🗑️ Eliminado

- Los enlaces al editor antiguo en el menú Ayuda y en el diálogo de informe de
  errores. El editor antiguo se retira con esta versión.
- La página de descarga de la antigua aplicación de escritorio.

### 🐛 Arreglado

- Una entrada negada en un LED o un display de segmentos ahora invierte lo que
  muestran, y las entradas, salidas y túneles ya no aceptan una negación que no
  tenía efecto.
- Deshacer o rehacer la negación de un puerto se ve al instante.
- Un texto se puede seleccionar con un clic sobre sus letras, y las
  exportaciones de imagen lo incluyen entero.
- Una entrada o salida recién colocada o pegada pasa a ser el último puerto de
  su tipo en lugar del primero.
- El primer Atrás después de abrir el editor sale de él en lugar de quedarse en
  la misma página.
- Copiar, pegar o simular un circuito muy grande ya no falla.
- «Editar contenido» funciona en una ROM que estás a punto de colocar, y lo que
  introduces se coloca con ella.
- Los componentes y los proyectos subidos desde tu navegador reciben una vista
  previa en lugar de una imagen genérica.
- Un consejo que aparece mientras otro está abierto espera su turno en lugar de
  saltarse.

### 🔒 Seguridad

- Cambiar tu dirección de correo pide tu contraseña, y una contraseña nueva
  cierra tu sesión en tus otros dispositivos.
- Pedir que se restablezca la contraseña ya no revela si una dirección tiene
  cuenta.

## [2.2.0] - 2026-09-17

### ✨ Añadido

- **Selecciones que puedes ampliar.** Mantén Ctrl — ⌘ en un Mac — y un clic
  añade a la selección el componente o cable que está bajo el puntero, o lo
  quita, mientras que un marco de selección añade lo que cubre a lo que ya
  tenías. Puedes reasignar la tecla en los atajos, junto a «Cortar cables en el
  borde de la selección».
- **Selección dentro de la Herramienta de cable.** Un toque que no alcanza ni un
  puerto ni un cruce ahora selecciona el elemento más pequeño bajo el puntero,
  para que puedas borrarlo, copiarlo o moverlo sin cambiar de herramienta.
- **Movimiento de selecciones con Desplazar.** Arrastrar la selección actual la
  mueve en lugar de desplazar el lienzo; en cualquier otro sitio el toque
  desplaza como antes. El nuevo ajuste «Arrastrar la selección en modo
  Desplazar» lo desactiva.

### 🐛 Arreglado

- Un doble clic con la herramienta de cable retira el toque que repite: un doble
  clic sobre un puerto dibuja el cable que buscabas y no deja ninguna burbuja de
  negación suelta.
- Un clic en el hueco dentro de tu selección ya no la borra.
- Los menús largos y sus submenús se desplazan en vez de salirse por abajo de la
  ventana en una pantalla pequeña.
- En plataformas Apple con navegadores basados en Chromium, se reconoce ⌘ donde
  antes se mostraba Ctrl.

## [2.1.3] - 2026-09-16

### 🐛 Arreglado

- Una simulación ya no falla al iniciarse cuando el ajuste numérico de un
  componente tiene un decimal, como un retardo de reloj de 1,9, o es mayor de lo
  que la simulación acepta. Un circuito guardado así se carga con el valor
  redondeado y limitado, y a partir de ahí se guarda como número entero.
- Al colocar un componente personalizado ahora se mantienen la dirección y las
  opciones configuradas en el panel de ajustes, en lugar de colocarlo siempre en
  la misma orientación y descartarlas.
- Un componente que estás a punto de colocar se puede girar antes de soltarlo:
  pulsa R o Shift+R, o usa los botones de giro de la barra de herramientas. Un
  componente que ya estás arrastrando también gira, y el siguiente componente de
  ese tipo empieza en la dirección en la que giraste este.

## [2.1.2] - 2026-09-10

### 🐛 Arreglado

- Girar un teléfono o una tableta ya no hace que el editor se bloquee.
- Reparar cables mientras se ejecuta una simulación ya no bloquea el editor. La
  simulación se detiene antes.
- Un enlace para compartir un componente personalizado ahora lo abre igual que
  tus propios componentes: con su nombre en la barra de título y listo para
  clonarlo a tus componentes.
- Volver atrás con el botón del navegador ya no deja bloqueados los menús, las
  listas desplegables ni los avisos del tutorial.
- Los enlaces de la ayuda y del registro de cambios del editor ahora llevan al
  título correcto en todos los idiomas.
- Donde se juntan las puntas de dos puertos, tocar con la herramienta de cable
  ahora niega el puerto del lado en el que tocaste, y no el de enfrente.
- El editor sigue siendo utilizable cuando un movimiento o un pegado no se puede
  completar.

## [2.1.1] - 2026-08-31

### 🐛 Arreglado

- El editor ahora se abre en el idioma y el tema que usas en el resto de
  Logigator, y si cambias cualquiera de los dos dentro del editor, cambia en todo
  el sitio.
- En la primera visita, el editor elige su idioma entre todos los idiomas que pide
  tu navegador, y no solo el primero.

## [2.1.0] - 2026-08-06

### ✨ Añadido

- **Actualización en un paso de componentes desactualizados.** Pon al día todas
  las instancias colocadas de un componente personalizado desactualizado de una
  vez, desde el panel de ajustes. La paleta marca los componentes cuyas
  instancias colocadas están desactualizadas.
- **Un vistazo dentro de los componentes compartidos.** Abre los componentes
  personalizados incrustados en un circuito compartido, en modo de solo lectura.
  No se añade nada a tu biblioteca.

### 🔄 Cambiado

- Pegar ya no necesita una selección en móviles y tabletas, y los elementos pegados
  aparecen bajo el cursor en lugar de donde se copiaron.
- El panel Puertos ahora encabeza la barra lateral mientras se edita un componente
  personalizado.

### 🐛 Arreglado

- Hacer clic en un interruptor o un botón mientras la simulación aún se estaba
  iniciando provocaba el fallo de la simulación.
- Abrir otro proyecto mientras se ejecutaba una simulación provocaba el fallo de la
  simulación.
- Hacer clic dentro de un pegado flotante pero entre sus componentes cancelaba el
  pegado en lugar de agarrarlo.
- Las descripciones emergentes y los popovers cerca del borde de la pantalla
  apuntaban con su flecha más allá del elemento al que están anclados.

## [2.0.0] - 2026-08-04

Logigator se ha **reconstruido por completo**: un renderizador mejorado, una
canalización de renderizado mucho más eficiente, una interfaz moderna y
una oleada de funciones nuevas. Todo aquello en lo que confiabas sigue aquí, ahora
más rápido, más robusto y más fácil de usar, con algunas grandes capacidades nuevas
por encima.

### ✨ Añadido

- **📱 Soporte completo para móviles y tabletas.** El editor ahora es totalmente
  adaptable y compatible con el táctil, con desplazamiento y zoom multitáctil:
  construye circuitos en cualquier sitio, no solo en un escritorio.
- **⛔ Entradas y salidas negadas.** Invierte una señal justo en el puerto de un
  componente, sin una puerta NO aparte que colocar y cablear, para circuitos más
  limpios y compactos.
- **💾 Guardado local sin cuenta.** Conserva los proyectos y los componentes
  personalizados en tu propio dispositivo y retómalos cuando quieras. Cuando
  estés listo, súbelos a la nube con un solo clic y Logigator lleva consigo
  todos los componentes personalizados de los que dependen.
- **♾️ Un lienzo infinito en todas las direcciones.** Construye desde el origen
  hacia donde quieras: a la izquierda, a la derecha, arriba y abajo. El editor
  anterior solo tenía coordenadas positivas, así que el origen era un muro
  infranqueable más allá del cual no se podía colocar nada; ahora el lienzo
  simplemente crece con tu circuito.
- **🧩 Proyectos autocontenidos.** Cada proyecto lleva ahora su propia copia de
  los componentes personalizados que usa, de modo que siempre se abre, se
  representa y se simula, incluso sin conexión o si el componente original ya no
  existe. Un componente que falta se restaura en tu biblioteca en un solo paso.
- **🗺️ Minimapa.** Una vista general en directo de todo tu circuito te permite
  orientarte de un vistazo en diseños grandes.
- **Giro de selecciones enteras** —componentes y cables juntos— en pasos de 90°,
  en sentido horario o antihorario; una colocación con colisión se mantiene
  flotando hasta que la sueltas en un sitio válido.
- **Movimiento con las teclas de flecha** para las selecciones, una unidad de
  cuadrícula por pulsación.
- **Retroalimentación de colisión clara**: los componentes y los cables se vuelven
  rojos cuando una colocación, un arrastre o una rotación se solaparían con algo,
  para que las posiciones no válidas resulten obvias de un vistazo.
- **Un nuevo formato de archivo, con archivos `.lgix` comprimidos.** Los
  archivos de versiones anteriores se siguen abriendo y se actualizan al
  cargarlos.
- **Gestión de proyectos y componentes en el editor**: renombra y elimina tus
  proyectos y componentes personalizados guardados directamente desde el diálogo
  de apertura y la biblioteca, en lugar de ir al centro de cuenta del sitio web.
- **Atribución de bifurcaciones**: un circuito copiado recuerda de dónde viene,
  incluso tras descargarlo y volver a subirlo, de modo que los creadores
  originales siguen recibiendo crédito.
- Un **tutorial práctico** que te hace colocar y cablear componentes reales.
  Avanza en cuanto terminas un paso, se ejecuta en su propio tablero para que tu
  trabajo quede intacto y funciona en escritorio y en táctil.
- **Consejos justo a tiempo** que aparecen la primera vez que llegas a una situación
  relevante (cablear, simular, pegar y más), cada uno enlazado con la documentación.
- **Informe de errores dentro del editor** que adjunta automáticamente los
  detalles necesarios para localizar un problema, así que solo tienes que
  describir lo que pasó.
- Esta página de **Novedades**, accesible en cualquier momento desde **Ayuda →
  Novedades**, con un breve resumen que se abre automáticamente la primera vez que
  cargas una nueva versión.

### 🔄 Cambiado

- **⚡ Una base reconstruida.** La canalización de renderizado, el motor de
  simulación y el sistema de colisiones se han reconstruido desde cero: los
  gráficos acelerados por GPU mantienen fluidos los circuitos grandes, un nuevo
  núcleo de simulación impulsa la lógica y un sistema de colisiones más robusto
  hace que la edición sea mucho más estable y menos propensa a errores.
- Interfaz renovada y coherente en menús, diálogos, paneles y avisos, con una barra
  lateral de trabajo rediseñada.
- **Cambio instantáneo entre tema claro y oscuro**, sin recargar la página,
  donde el editor anterior aplicaba el cambio solo tras recargar.
- **Una cuadrícula que marca dónde se conecta**: los puntos de la cuadrícula
  ahora se sitúan justo donde terminan los cables, las puntas de los puertos y
  los cruces, de modo que los cables pasan por los puntos en lugar de entre
  ellos.
- Un **conjunto de herramientas más sencillo y unificado**: una sola herramienta
  de cable traza cables y, con un toque, une, divide o niega conexiones; la
  selección exacta forma parte de la herramienta de selección; y el
  desplazamiento tiene su propia herramienta.
- **Actualizaciones de componentes en tus términos.** Cuando hay disponible una
  versión más reciente de un componente personalizado, el editor lo señala y te
  permite actualizar las instancias colocadas cuando tú decidas, en lugar de que
  todas las copias cambien en cuanto se edita el componente.
- **Documentación integrada reestructurada**, por secciones enlazadas entre sí,
  mostrada en una ventana en el escritorio y a pantalla completa en el móvil.
