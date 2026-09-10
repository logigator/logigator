# Registro de cambios

Todos los cambios notables del editor de Logigator se registran aquí. La versión
más reciente se muestra primero.

## 2.1.2 — 2026-09-10

### Correcciones

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

## 2.1.1 — 2026-08-31

### Correcciones

- El editor ahora se abre en el idioma y el tema que usas en el resto de
  Logigator, y si cambias cualquiera de los dos dentro del editor, cambia en todo
  el sitio.
- En la primera visita, el editor elige su idioma entre todos los idiomas que pide
  tu navegador, y no solo el primero.

## 2.1.0 — 2026-08-06

### Funciones

- **Actualizar todas las instancias** de un componente personalizado
  desactualizado en un solo paso, desde el panel de ajustes. La paleta marca los
  componentes cuyas instancias colocadas están desactualizadas.
- **Ver por dentro** los componentes personalizados incrustados en un circuito
  compartido, en modo de solo lectura. No se añade nada a tu biblioteca.
- Pegar ya no necesita una selección en móviles y tabletas, y los elementos pegados
  aparecen bajo el cursor en lugar de donde se copiaron.
- El panel Puertos ahora encabeza la barra lateral mientras se edita un componente
  personalizado.

### Correcciones

- Hacer clic en un interruptor o un botón mientras la simulación aún se estaba
  iniciando provocaba el fallo de la simulación.
- Abrir otro proyecto mientras se ejecutaba una simulación provocaba el fallo de la
  simulación.
- Hacer clic dentro de un pegado flotante pero entre sus componentes cancelaba el
  pegado en lugar de agarrarlo.
- Las descripciones emergentes y los popovers cerca del borde de la pantalla
  apuntaban con su flecha más allá del elemento al que están anclados.

## 2.0.0 — 2026-08-04

Logigator se ha **reconstruido por completo**: un renderizador mejorado, una
canalización de renderizado mucho más eficiente, una interfaz moderna y
una oleada de funciones nuevas. Todo aquello en lo que confiabas sigue aquí, ahora
más rápido, más robusto y más fácil de usar, con algunas grandes capacidades nuevas
por encima.

### ✨ Lo más destacado

- **⚡ Una base reconstruida.** La canalización de renderizado, el motor de
  simulación y el sistema de colisiones se han reconstruido desde cero: los
  gráficos acelerados por GPU mantienen fluidos los circuitos grandes, un nuevo
  núcleo de simulación impulsa la lógica y un sistema de colisiones más robusto
  hace que la edición sea mucho más estable y menos propensa a errores.
- **📱 Pensado para móviles y tabletas.** El editor ahora es totalmente adaptable
  y compatible con el táctil, con desplazamiento y zoom multitáctil: construye
  circuitos en cualquier sitio, no solo en un escritorio.
- **⛔ Entradas y salidas negadas.** Invierte una señal justo en el puerto de un
  componente, sin una puerta NO aparte que colocar y cablear, para circuitos más
  limpios y compactos.
- **💾 Guarda localmente, directamente en tu navegador.** Conserva los proyectos y
  los componentes personalizados en tu propio dispositivo, sin necesidad de cuenta,
  y retómalos cuando quieras. Cuando estés listo, súbelos a la nube con un solo
  clic y Logigator lleva consigo todos los componentes personalizados de los que
  dependen.
- **♾️ Un lienzo infinito en todas las direcciones.** Construye desde el origen
  hacia donde quieras: a la izquierda, a la derecha, arriba y abajo. El editor
  anterior solo tenía coordenadas positivas, así que el origen era un muro
  infranqueable más allá del cual no se podía colocar nada; ahora el lienzo
  simplemente crece con tu circuito.
- **🧩 Proyectos autocontenidos.** Cada proyecto ahora incrusta una copia congelada
  de los componentes personalizados que usa, de modo que siempre se abre, se
  representa y se simula, incluso sin conexión o si el componente original ya no
  existe. Actualiza los componentes colocados a la última versión cuando tú decidas,
  en lugar de que todas las copias cambien de golpe.
- **🗺️ Minimapa.** Una vista general en directo de todo tu circuito te permite
  orientarte de un vistazo en diseños grandes.

### Por dentro

- Renderizado actualizado a **PixiJS 8**, envuelto en una canalización de
  renderizado mucho más eficiente: la escena se divide en grupos de renderizado
  de GPU y se descarta mediante el quad tree, de modo que el desplazamiento, el
  zoom y la edición se mantienen fluidos en circuitos grandes.
- **Motor de simulación reconstruido**: un nuevo núcleo WebAssembly, compilado
  desde Rust, sustituye al motor de simulación anterior
  ([`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim)).
- **Sistema de colisiones reescrito**: las comprobaciones espaciales ahora se
  ejecutan sobre un quad tree con tamaño de fragmento variable, lo que hace que la
  colocación y la colisión al arrastrar sean más estables y mucho menos propensas
  a errores.
- **Espacio de coordenadas sin límites**: ese mismo quad tree sostiene el lienzo
  infinito; su raíz se duplica hacia el elemento que colocas y se expande hacia el
  espacio negativo con la misma facilidad que hacia el positivo, de modo que el
  lienzo no tiene esquina de origen ni extensión fija. El editor anterior guardaba
  los elementos en un arreglo de fragmentos indexado en positivo y rechazaba tanto
  los fragmentos como las colocaciones en coordenadas negativas.

### Editor y lienzo

- Interfaz renovada y coherente en menús, diálogos, paneles y avisos, con una barra
  lateral de trabajo rediseñada.
- **Los temas claro y oscuro cambian al instante**, sin recargar la página, donde el
  editor anterior aplicaba el cambio solo tras recargar.
- **Gira selecciones enteras** —componentes y cables juntos— en pasos de 90°, en
  sentido horario o antihorario; una colocación con colisión se mantiene flotando
  hasta que la sueltas en un sitio válido.
- **Mueve las selecciones con las teclas de flecha**, una unidad de cuadrícula por
  pulsación.
- **Retroalimentación de colisión clara**: los componentes y los cables se vuelven
  rojos cuando una colocación, un arrastre o una rotación se solaparían con algo,
  para que las posiciones no válidas resulten obvias de un vistazo.
- **La cuadrícula marca dónde se conecta**: los puntos de la cuadrícula ahora se
  sitúan justo donde terminan los cables, las puntas de los puertos y los cruces,
  de modo que los cables pasan por los puntos en lugar de entre ellos.
- Un **conjunto de herramientas más sencillo y unificado**: el trazado de cables y la
  conexión/división de cruces se fusionaron en una sola herramienta de cable
  (arrastra para trazar, toca para alternar un cruce o la negación de un puerto), la
  selección de tijera «exacta» se integró en la herramienta de selección y el
  desplazamiento se ascendió a herramienta de primera clase.

### Archivos, componentes y compartición

- **Almacenamiento local en el navegador** (IndexedDB) para proyectos y componentes
  personalizados, con una subida de un solo clic que promociona un documento —y
  todos los componentes personalizados de los que depende, primero los hijos— a la
  nube.
- Un **formato de archivo nativo y versionado** con una cadena de migración que
  actualiza los archivos antiguos al cargarlos (solo se escribe la versión más
  reciente), además de un contenedor **`.lgix`** comprimido con encuadre por bytes
  mágicos.
- **Incrustación de componentes personalizados reconstruida.** Cada proyecto y
  componente personalizado ahora incrusta una copia congelada de cada componente
  personalizado que usa —incluidas las dependencias anidadas—, de modo que un
  circuito siempre se abre, se representa y se simula aunque el componente original
  falte o estés sin conexión. Un componente que falta pasa a ser solo editable y se
  puede restaurar en tu biblioteca en un solo paso; el circuito nunca queda roto.
- **Actualizaciones de componentes en tus términos.** Cuando hay disponible una
  versión más reciente de un componente personalizado, el editor lo señala y te
  permite actualizar las instancias colocadas a la última, sustituyendo al modelo
  antiguo en el que editar un componente cambiaba todas las copias de golpe.
- **Gestiona proyectos y componentes en el editor**: renombra y elimina tus
  proyectos y componentes personalizados guardados directamente desde el diálogo de
  apertura y la biblioteca, en lugar de ir al centro de cuenta del sitio web.
- **Atribución de bifurcaciones**: el linaje de una bifurcación se registra en el
  archivo exportado y se vuelve a resolver al subirlo, de modo que los creadores
  originales siguen recibiendo crédito.

### Primeros pasos y ayuda

- Un **tutorial práctico** que te hace colocar y cablear componentes reales; los
  pasos avanzan automáticamente observando el estado del proyecto en directo, se
  ejecutan en un tablero de borrador para que tu trabajo quede intacto y se adaptan
  al escritorio y al táctil.
- **Consejos justo a tiempo** que aparecen la primera vez que llegas a una situación
  relevante (cablear, simular, pegar y más), cada uno enlazado con la documentación.
- **Documentación integrada reestructurada**: una referencia por secciones, con
  enlaces profundos y referencias cruzadas, mostrada como diálogo en el escritorio y
  a pantalla completa en pantallas compactas.
- **Informe de errores dentro del editor** que captura automáticamente los detalles
  del entorno y los registros recientes del editor.
- Esta página de **Novedades**, accesible en cualquier momento desde **Ayuda →
  Novedades**, con un breve resumen que se abre automáticamente la primera vez que
  cargas una nueva versión.
