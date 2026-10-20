# Registro de cambios

Todos los cambios notables de Logigator se registran aquí. La versión más
reciente se muestra primero.

## [Unreleased]

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
