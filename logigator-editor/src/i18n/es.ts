import type { WorkMode } from '../app/work-mode/work-mode.enum';
import type { ShortcutActionEnum } from '../app/shortcuts/shortcut-action.enum';
import type { ComponentCategory } from '../app/components/component-category.enum';
import type { TranslationSchema } from '../app/translation/translation-schema.model';

const es: TranslationSchema = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    untitled: 'Sin título',
    close: 'Cerrar',
    back: 'Atrás',
    dismiss: 'Descartar',
    firstPage: 'Primera página',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    lastPage: 'Última página',
    moved: 'Movido a la posición {{position}} de {{total}}'
  },
  user: {
    loadFailed:
      'No se pudieron cargar los datos del usuario. Inicia sesión de nuevo.'
  },
  userSettings: {
    notSignedIn: 'Sesión no iniciada',
    theme: 'Tema',
    language: 'Idioma',
    editorSettings: 'Ajustes del editor',
    account: 'Cuenta',
    logOut: 'Cerrar sesión',
    logIn: 'Iniciar sesión'
  },
  theming: {
    light: 'Claro',
    dark: 'Oscuro'
  },
  hexEditor: {
    wordView: 'Palabras',
    byteView: 'Bytes',
    hex: 'Hex',
    decimal: 'Decimal',
    octal: 'Octal',
    binary: 'Binario',
    address: 'Dir',
    goto: 'Ir a la dirección',
    gotoPlaceholder: 'Dirección…',
    activeAddress: 'Dirección',
    value: 'Valor',
    noActiveCell: 'Ninguna celda seleccionada',
    clear: 'Vaciar',
    copy: 'Copiar',
    follow: 'Seguir',
    clearConfirm: '¿Vaciar todo el contenido de la memoria?',
    copyFailed: 'No se pudo copiar al portapapeles.',
    viewLabel: 'Agrupación de celdas',
    radixLabel: 'Base numérica'
  },
  settings: {
    options: {
      fpsCounter: 'Contador de FPS',
      showGrid: 'Mostrar cuadrícula',
      autoStartSimulation: 'Iniciar la simulación automáticamente'
    }
  },
  minimap: {
    expand: 'Mostrar minimapa',
    collapse: 'Ocultar minimapa'
  },
  components: {
    category: {
      hidden: 'Ocultos',
      basic: 'Básicos',
      advanced: 'Avanzados',
      io: 'Entradas / Salidas',
      port: 'Puertos',
      user: 'Componentes del usuario'
    } satisfies Record<ComponentCategory, string>,
    def: {
      NOT: {
        name: 'Puerta NO',
        description:
          'Una puerta NO es una puerta lógica digital que implementa la negación lógica. Se comporta según la tabla de verdad mostrada a la derecha. La salida es ALTA (1) si la entrada es BAJA (0), y BAJA (0) si la entrada es ALTA (1).'
      },
      AND: {
        name: 'Puerta Y',
        description:
          'Una puerta Y es una puerta lógica digital que implementa la conjunción lógica. Se comporta según la tabla de verdad mostrada a la derecha. La salida es ALTA (1) solo si ambas entradas de la puerta Y son ALTAS (1). Si ninguna o solo una de las entradas es ALTA, la salida es BAJA.'
      },
      OR: {
        name: 'Puerta O',
        description:
          'Una puerta O es una puerta lógica digital que implementa la disyunción lógica. La salida es ALTA (1) si al menos una entrada de la puerta O es ALTA (1). La salida solo es BAJA (0) si todas las entradas son BAJAS (0).'
      },
      XOR: {
        name: 'Puerta XOR',
        description:
          'Una puerta XOR es una puerta lógica digital que implementa la disyunción exclusiva. La salida es ALTA (1) si un número impar de entradas de la puerta XOR son ALTAS (1).'
      },
      DELAY: {
        name: 'Retardo',
        description:
          'Un búfer que deja pasar su entrada sin cambios, añadiendo a la señal un tick de simulación de retardo.'
      },
      CLOCK: {
        name: 'Reloj',
        description:
          'Emite periódicamente un pulso de un tick en su salida. El retardo entre pulsos es configurable; poner la entrada STP en ALTO pausa el reloj.',
        options: {
          speed: 'Retardo'
        }
      },
      TUNNEL: {
        name: 'Túnel',
        description:
          'Funciona como un cable, pero sin cables: todos los túneles con la misma etiqueta están conectados eléctricamente.'
      },
      HALF_ADDER: {
        name: 'Semisumador',
        description:
          'Suma dos números de 1 bit. S lleva el bit de suma y C el bit de acarreo.'
      },
      FULL_ADDER: {
        name: 'Sumador completo',
        description:
          'Suma tres números de 1 bit (dos sumandos y un acarreo de entrada). S lleva el bit de suma y C el bit de acarreo.'
      },
      ROM: {
        name: 'ROM',
        description:
          'Una memoria de solo lectura (ROM) es un tipo de memoria no volátil usada en ordenadores y otros dispositivos electrónicos. Los datos almacenados en la ROM no se pueden modificar electrónicamente tras la fabricación del dispositivo de memoria.',
        options: {
          wordSize: 'Tamaño de palabra',
          addressSize: 'Tamaño de dirección',
          data: 'Editar contenido',
          dataEditorTitle: 'Editar contenido de la ROM'
        }
      },
      D_FF: {
        name: 'Biestable D',
        description:
          'Almacena un bit de estado. El estado en D se guarda en el flanco ascendente de CLK; Q lleva el estado y !Q su inverso.'
      },
      JK_FF: {
        name: 'Biestable JK',
        description:
          'Almacena un bit de estado. En el flanco ascendente de CLK, una J ALTA activa el estado y una K ALTA lo reinicia; ambas ALTAS lo conmutan. Q lleva el estado y !Q su inverso.'
      },
      SR_FF: {
        name: 'Biestable SR',
        description:
          'Almacena un bit de estado. En el flanco ascendente de CLK, una S ALTA activa el estado y una R ALTA lo reinicia. Q lleva el estado y !Q su inverso.'
      },
      RNG: {
        name: 'Generador de números aleatorios',
        description:
          'Genera datos aleatorios en sus salidas en cada flanco ascendente de CLK.'
      },
      RAM: {
        name: 'RAM',
        description:
          'Memoria de acceso aleatorio. En el flanco ascendente de CLK lee la palabra direccionada hacia las salidas o, mientras WE está en ALTO, almacena en la dirección actual la palabra presente en las entradas de datos.',
        options: {
          wordSize: 'Tamaño de palabra',
          addressSize: 'Tamaño de dirección'
        }
      },
      DECODER: {
        name: 'Decodificador',
        description:
          'Decodificador binario de 1 entre n. Activa exactamente la salida cuyo índice coincide con el valor binario presente en las entradas.'
      },
      ENCODER: {
        name: 'Codificador',
        description:
          'Codificador binario de 2^n a n. Emite el índice binario de la entrada activa de mayor peso.'
      },
      MUX: {
        name: 'Multiplexor',
        description:
          'Encamina hacia la única salida la entrada de datos direccionada por las líneas de selección.',
        options: {
          selectLines: 'Líneas de selección'
        }
      },
      DEMUX: {
        name: 'Demultiplexor',
        description:
          'Encamina la entrada de datos I hacia la salida direccionada por las líneas de selección.',
        options: {
          selectLines: 'Líneas de selección'
        }
      },
      TEXT: {
        name: 'Texto',
        description:
          'Una anotación de texto colocada en el lienzo. El punto marca el punto de anclaje de la etiqueta.',
        options: {
          text: 'Editar texto',
          placeholder: 'Escribe el texto...',
          fontSize: 'Tamaño de fuente'
        }
      },
      INPUT: {
        name: 'Entrada',
        description:
          'Un conector de entrada. Define uno de los puertos de entrada de un componente personalizado; su etiqueta nombra el puerto y su orden determina la posición del puerto.'
      },
      OUTPUT: {
        name: 'Salida',
        description:
          'Un conector de salida. Define uno de los puertos de salida de un componente personalizado; su etiqueta nombra el puerto y su orden determina la posición del puerto.'
      },
      BUTTON: {
        name: 'Botón',
        description:
          'Un pulsador momentáneo. Mientras la simulación está en marcha, al hacer clic emite un único pulso en su salida.'
      },
      SWITCH: {
        name: 'Interruptor',
        description:
          'Un interruptor con enclavamiento. Mientras la simulación está en marcha, al hacer clic alterna su salida entre encendido y apagado.'
      },
      LED: {
        name: 'LED',
        description:
          'Se enciende mientras el cable conectado a su entrada está alimentado.'
      },
      SEGMENT_DISPLAY: {
        name: 'Display de segmentos',
        description:
          'Muestra el valor binario presente en sus entradas (la entrada 0 es el bit menos significativo) como un número en la base configurada.',
        options: {
          base: 'Base'
        }
      },
      LED_MATRIX: {
        name: 'Matriz de LEDs',
        description:
          'Una cuadrícula cuadrada de LEDs que muestra una imagen. En el flanco ascendente de CLK, las entradas de datos se enclavan en la fila direccionada por las entradas de dirección.',
        options: {
          size: 'Ancho/Alto'
        }
      }
    },
    options: {
      direction: 'Dirección',
      inputs: 'Entradas',
      outputs: 'Salidas',
      label: 'Etiqueta',
      index: 'Índice'
    }
  },
  sideBar: {
    title: 'Componentes',
    search: 'Buscar..',
    outdatedInstances:
      '{{count}} instancia(s) colocada(s) de este componente están desactualizadas'
  },
  board: {
    panel: 'Placa de circuito'
  },
  tabBar: {
    mainProject: 'Proyecto principal',
    close: 'Cerrar',
    landmark: 'Proyectos abiertos'
  },
  portsPanel: {
    title: 'Puertos',
    badge: 'componente',
    inputs: 'Entradas',
    outputs: 'Salidas',
    noInputs: 'Sin conectores de entrada',
    noOutputs: 'Sin conectores de salida',
    inputName: 'Entrada {{index}}',
    outputName: 'Salida {{index}}',
    nameLabel: 'Nombre de {{name}}, puerto {{position}}'
  },
  statusBar: {
    modes: {
      pan: 'Desplazar: arrastra para mover el tablero · desplaza o pellizca para hacer zoom',
      wireTool:
        'Herramienta de cable: arrastra para dibujar · toca un puerto para negarlo · toca un cruce para conectar/desconectar',
      sel: 'Seleccionar: arrastra un marco para seleccionar · arrastra la selección para moverla · mantén {{scissorKey}} para cortar cables',
      selExact:
        'Selección de corte: arrastra un marco para seleccionar · los cables se cortan en su borde',
      erase:
        'Borrador: haz clic o arrastra sobre los elementos para eliminarlos',
      placeComp:
        'Colocando {{componentName}}: arrastra para posicionar · Esc para cancelar',
      simulation:
        'Simulando: haz clic en botones e interruptores · arrastra para desplazar'
    } satisfies Record<WorkMode, string>,
    saved: 'Guardado',
    unsaved: 'Cambios sin guardar',
    selected: 'Seleccionado'
  },
  titleBar: {
    menuBar: {
      file: {
        label: 'Archivo',
        items: {
          newProject: {
            label: 'Nuevo proyecto'
          },
          newComponent: {
            label: 'Nuevo componente'
          },
          open: {
            label: 'Abrir'
          },
          save: {
            label: 'Guardar'
          },
          uploadCloud: {
            label: 'Subir a la nube'
          },
          share: {
            label: 'Compartir'
          },
          cloneShare: {
            label: 'Clonar a mis proyectos'
          },
          exportFile: {
            label: 'Exportar a archivo'
          },
          generateImage: {
            label: 'Generar imagen'
          }
        }
      },
      edit: {
        label: 'Editar',
        items: {
          undo: {
            label: 'Deshacer'
          },
          redo: {
            label: 'Rehacer'
          },
          cut: {
            label: 'Cortar'
          },
          copy: {
            label: 'Copiar'
          },
          paste: {
            label: 'Pegar'
          },
          delete: {
            label: 'Eliminar'
          },
          repairWires: {
            label: 'Reparar cables'
          }
        }
      },
      view: {
        label: 'Vista',
        items: {
          zoomIn: {
            label: 'Acercar'
          },
          zoomOut: {
            label: 'Alejar'
          },
          zoom100: {
            label: 'Zoom 100%'
          }
        }
      },
      help: {
        label: 'Ayuda',
        items: {
          documentation: {
            label: 'Documentación'
          },
          changelog: {
            label: 'Novedades'
          },
          legacyEditor: {
            label: 'Abrir el editor antiguo'
          },
          cookieSettings: {
            label: 'Ajustes de cookies'
          },
          about: {
            label: 'Acerca de'
          }
        }
      }
    },
    rename: {
      label: 'Renombrar proyecto',
      cancel: 'Cancelar',
      error: 'No se pudo renombrar el proyecto.'
    },
    fork: {
      label: 'Bifurcar',
      title: 'Bifurcado desde {{lineage}}',
      lineageEntry: '{{name}} de {{author}}'
    }
  },
  discardChanges: {
    header: '¿Descartar cambios?',
    message:
      'El proyecto actual tiene cambios sin guardar que se perderán. ¿Continuar de todos modos?',
    accept: 'Descartar',
    reject: 'Cancelar'
  },
  changelogDialog: {
    header: 'Novedades',
    loading: 'Cargando el registro de cambios…',
    loadError: 'No se pudo cargar el registro de cambios.',
    close: 'Cerrar'
  },
  documentation: {
    header: 'Documentación',
    loading: 'Cargando la página…',
    loadError: 'No se pudo cargar esta página.',
    back: 'Todos los temas',
    learnMore: 'Más información',
    sections: {
      basics: 'Conceptos básicos',
      building: 'Construir circuitos',
      simulation: 'Simulación',
      projects: 'Proyectos y nube'
    },
    pages: {
      gettingStarted: 'Primeros pasos',
      boardAndTools: 'Tablero y herramientas',
      shortcuts: 'Atajos de teclado',
      settings: 'Ajustes y apariencia',
      componentsAndOptions: 'Componentes y opciones',
      wiresAndConnections: 'Cables y conexiones',
      customComponents: 'Componentes personalizados',
      simulation: 'Simulación',
      inspection: 'Inspección y monitores',
      savingAndFiles: 'Guardar y archivos',
      cloud: 'Nube y compartir'
    }
  },
  aboutDialog: {
    header: 'Acerca de Logigator',
    tagline:
      'Un editor y simulador open source de circuitos lógicos digitales.',
    version: 'Versión',
    commit: 'Commit',
    buildDate: 'Fecha de compilación',
    license: 'Licencia',
    licenseName: 'GNU AGPL v3',
    copyright: '© 2019–{{year}} Logigator',
    repository: 'Repositorio',
    privacyPolicy: 'Política de privacidad',
    imprint: 'Pie de imprenta',
    close: 'Cerrar'
  },
  openProjectDialog: {
    title: 'Abrir proyecto',
    localProjects: 'Proyectos locales',
    cloudProjects: 'Proyectos en la nube',
    fromFile: 'Desde archivo',
    notLoggedIn: 'Inicia sesión para ver tus proyectos en la nube',
    close: 'Cerrar',
    loading: 'Cargando...',
    uploadPrompt: 'Abre un archivo de circuito guardado en tu dispositivo.',
    chooseFile: 'Elegir archivo',
    deleteProject: 'Eliminar proyecto',
    renameProject: 'Renombrar proyecto',
    uploadProject: 'Subir a la nube',
    shareProject: 'Compartir',
    cancelRename: 'Cancelar',
    deleteConfirmMessage:
      '¿Seguro que quieres eliminar "{{name}}"? Esto no se puede deshacer.',
    deleteAccept: 'Eliminar',
    deleteReject: 'Cancelar',
    searchPlaceholder: 'Buscar proyectos...',
    searchButton: 'Buscar',
    noSearchResults: 'No se encontraron proyectos',
    lastEdited: 'Última edición',
    errors: {
      listLocal: 'No se pudieron cargar tus proyectos locales.',
      openLocal: 'No se pudo abrir el proyecto local.',
      deleteLocal: 'No se pudo eliminar el proyecto local.',
      renameLocal: 'No se pudo renombrar el proyecto local.',
      listCloud: 'No se pudieron cargar tus proyectos en la nube.',
      openCloud: 'No se pudo abrir el proyecto de la nube.',
      deleteCloud: 'No se pudo eliminar el proyecto de la nube.',
      renameCloud: 'No se pudo renombrar el proyecto de la nube.',
      importFailed: 'No se pudo importar el archivo: {{detail}}',
      readFailed: 'No se pudo leer el archivo seleccionado.'
    }
  },
  saveProjectDialog: {
    name: 'Nombre',
    destination: 'Destino',
    destinationCloud: 'Nube',
    destinationLocal: 'Local',
    notLoggedIn:
      'Debes haber iniciado sesión para guardar proyectos en la nube.',
    public: 'Público',
    publicInfo:
      'Los proyectos públicos se publican en tu perfil y son accesibles para cualquiera mediante un enlace para compartir. Los proyectos privados solo son visibles para ti.',
    localWarning:
      'Los proyectos locales no se conservan entre dispositivos y pueden perderse.'
  },
  newComponentDialog: {
    name: 'Nombre',
    symbol: 'Símbolo',
    description: 'Descripción',
    store: 'Almacenar',
    storeCloud: 'Nube',
    storeLocal: 'Local',
    notLoggedIn:
      'Debes haber iniciado sesión para guardar componentes en la nube.',
    public: 'Público',
    publicInfo:
      'Los componentes públicos se publican en tu perfil y son accesibles para cualquiera mediante un enlace para compartir. Los componentes privados solo son visibles para ti.',
    localWarning:
      'Los componentes locales no se conservan entre dispositivos y pueden perderse.',
    create: 'Crear'
  },
  uploadComponent: {
    button: 'Subir a la nube',
    signInTooltip: 'Inicia sesión para subir a la nube'
  },
  shareDialog: {
    header: 'Compartir proyecto',
    headerComponent: 'Compartir componente',
    intro:
      'Cualquiera que tenga este enlace puede abrir “{{name}}” en modo de solo lectura y clonarlo en su propia biblioteca.',
    linkLabel: 'Enlace para compartir',
    copy: 'Copiar enlace',
    linkCopied: 'Enlace para compartir copiado al portapapeles.',
    copyFailed: 'No se pudo copiar el enlace al portapapeles.',
    regenerate: 'Regenerar enlace',
    regenerateWarning:
      'Regenerar crea un enlace nuevo e invalida permanentemente el actual: cualquiera que use el enlace antiguo perderá el acceso.',
    linkRegenerated: 'Se generó un nuevo enlace para compartir.',
    regenerateFailed: 'No se pudo regenerar el enlace para compartir.',
    public: 'Público',
    publicInfoProject:
      'Los proyectos públicos se publican en tu perfil y cualquiera puede descubrirlos. Los proyectos privados solo son accesibles mediante el enlace para compartir.',
    publicInfoComponent:
      'Los componentes públicos se publican en tu perfil y cualquiera puede descubrirlos. Los componentes privados solo son accesibles mediante el enlace para compartir.',
    visibilityUpdated: 'Visibilidad actualizada.',
    visibilityFailed: 'No se pudo actualizar la visibilidad.',
    close: 'Cerrar'
  },
  shareComponent: {
    button: 'Compartir'
  },
  deleteComponent: {
    button: 'Eliminar',
    confirmMessageLocal:
      '¿Eliminar “{{name}}” de tu biblioteca? Esto es permanente. Las instancias ya colocadas permanecen como copias incrustadas que podrás restaurar más adelante.',
    confirmMessageCloud:
      '¿Eliminar “{{name}}” de tu biblioteca en la nube? Esto es permanente y su enlace para compartir dejará de funcionar. Las instancias ya colocadas permanecen como copias incrustadas que podrás restaurar más adelante.',
    confirmAccept: 'Eliminar',
    confirmReject: 'Cancelar',
    deleted: '“{{name}}” se eliminó de tu biblioteca.',
    deleteFailed: 'No se pudo eliminar el componente.'
  },
  uploadDialog: {
    header: 'Subir a la nube',
    introProject:
      '“{{name}}” se traslada del almacenamiento local a tu biblioteca en la nube, para que puedas acceder a él desde cualquier dispositivo.',
    introComponent:
      '“{{name}}” se traslada de tu biblioteca local a tu biblioteca en la nube, para que puedas usarlo desde cualquier dispositivo.',
    introDraft:
      '“{{name}}” incrusta estos componentes locales. Se subirán a tu biblioteca en la nube junto con él.',
    depsTitle: 'Estos componentes locales también se publicarán',
    depsHint:
      'Un proyecto en la nube solo puede contener componentes en la nube, así que cada uno de estos se sube primero a tu biblioteca en la nube y luego se referencia.',
    unresolvableWarning:
      '{{count}} componente(s) incrustado(s) ya no se pueden publicar (su entrada en la biblioteca ya no existe) y permanecerán como simples copias incrustadas.',
    public: 'Público',
    publicInfoProject:
      'Los proyectos públicos se publican en tu perfil y son accesibles para cualquiera mediante un enlace para compartir. Los proyectos privados solo son visibles para ti.',
    publicInfoComponent:
      'Los componentes públicos se publican en tu perfil y son accesibles para cualquiera mediante un enlace para compartir. Los componentes privados solo son visibles para ti.',
    notLoggedIn: 'Debes haber iniciado sesión para subir a la nube.',
    cancel: 'Cancelar',
    upload: 'Subir',
    analyzeFailed: 'No se pudo leer el circuito para preparar la subida.',
    dependencyFailed:
      'No se pudo subir el componente “{{name}}”. No se subió nada más: inténtalo de nuevo.',
    uploadFailed: 'No se pudo subir “{{name}}” a la nube.'
  },
  closeTab: {
    header: 'Cambios sin guardar',
    message:
      '“{{name}}” tiene cambios sin guardar. ¿Guardarlos antes de cerrar?',
    promotionWarning:
      'Al guardar también se publicarán {{count}} componente(s) local(es) en tu biblioteca en la nube.',
    save: 'Guardar',
    discard: 'Descartar',
    cancel: 'Cancelar'
  },
  sourceIndicator: {
    cloudTitle: 'Guardado en tu biblioteca en la nube',
    localTitle: 'Guardado solo en este navegador',
    draftTitle: 'Aún sin guardar: guárdalo en la nube o localmente',
    shareTitle: 'Abierto desde un enlace para compartir: solo lectura',
    label: {
      server: 'Nube',
      browser: 'Local',
      draft: 'Borrador',
      share: 'Compartido',
      embedded: 'Incrustado'
    },
    title: {
      server: 'Guardado en tu biblioteca en la nube',
      browser: 'Guardado solo en este navegador',
      draft: 'Aún sin guardar',
      share: 'Abierto desde un enlace para compartir',
      embedded:
        'Copia incrustada: su componente de la biblioteca ya no está disponible'
    }
  },
  toolBar: {
    save: 'Guardar',
    open: 'Abrir',
    newComp: 'Nuevo componente',
    copy: 'Copiar',
    cut: 'Cortar',
    paste: 'Pegar',
    delete: 'Eliminar',
    rotateCw: 'Girar en sentido horario',
    rotateCcw: 'Girar en sentido antihorario',
    undo: 'Deshacer',
    redo: 'Rehacer',
    zoomOut: 'Alejar',
    zoomIn: 'Acercar',
    pan: 'Desplazar',
    parts: 'Piezas',
    placeComponent: 'Colocando componente',

    wireTool: 'Herramienta de cable',
    select: 'Seleccionar',
    selExact: 'Cortar cables en el borde de la selección (mantén para activar)',
    selExactShort: 'Cortar cables',
    eraser: 'Borrador',
    text: 'Texto',
    startSim: 'Iniciar simulación',
    exitSim: 'Salir de la simulación',
    play: 'Ejecutar',
    pause: 'Pausar',
    step: 'Paso',
    stopSim: 'Detener',
    targetSpeed: 'Velocidad objetivo',
    targetUnit: 'Unidad de velocidad objetivo',
    targetMode: 'Limitar a la velocidad objetivo',
    syncToFrame: 'Sincronizar con el fotograma',
    measuredHz: '{{hz}}Hz',
    ticks: '{{ticks}} ticks'
  },
  mobile: {
    account: 'Cuenta',
    palette: 'Componentes',
    settings: 'Ajustes',
    ports: 'Puertos'
  },
  logging: {
    error: 'Error',
    warn: 'Advertencia',
    success: 'Éxito',
    info: 'Información',
    debug: 'Depuración',
    unexpectedError:
      'Algo salió mal. Es posible que algunas acciones no se hayan completado: consulta la consola del navegador para más detalles.'
  },
  clipboard: {
    clear: 'Vaciar portapapeles',
    pastePartial:
      'Algunos elementos no se pudieron pegar: su tipo de componente ya no está disponible.',
    pastePlugsSkipped:
      'Los conectores de entrada y salida no se pegaron: solo se admiten dentro de componentes personalizados.'
  },
  wireRepair: {
    repaired: 'Se repararon {{count}} problema(s) de cables.',
    loadDetected:
      'Este circuito tiene {{count}} problema(s) de cables, lo que puede hacer que las conexiones se comporten de forma inesperada.',
    repairAction: 'Reparar cables',
    clean: 'No se encontraron problemas de cables.'
  },
  bugReport: {
    title: 'Informar de un problema',
    badgeTooltip: 'Informar de un error',
    intro:
      '¿Has encontrado un error? Describe qué estabas haciendo cuando ocurrió: cuanto más detalle, más fácil será corregirlo.',
    errorIntro:
      'Se ha producido un error inesperado. Cuéntanos qué estabas haciendo para que podamos localizarlo.',
    errorDetails: 'Detalles del error',
    legacyEditorNotice: '¿Esto te bloquea?',
    legacyEditorLink: 'Abrir el editor antiguo',
    placeholder: '¿Qué ha ocurrido?',
    dataNotice:
      'Tu proyecto actual, los detalles del navegador y la actividad reciente se adjuntan para ayudarnos a reproducir el problema.',
    send: 'Enviar informe',
    cancel: 'Cancelar',
    sent: 'Gracias: tu informe se ha enviado.',
    failed: 'No se pudo enviar el informe. Inténtalo de nuevo.'
  },
  persistence: {
    projectSaved: 'Proyecto guardado.',
    projectSavedLocal: 'Proyecto guardado en el almacenamiento local.',
    componentSaved: 'Componente guardado.',
    componentSavedLocal: 'Componente guardado en el almacenamiento local.',
    componentUploaded: 'Componente subido a tu biblioteca en la nube.',
    projectUploaded: 'Proyecto subido a tu biblioteca en la nube.',
    projectCreated: 'Proyecto creado.',
    projectExported: 'Proyecto exportado a archivo.',
    exportFailed: 'No se pudo exportar el proyecto a un archivo.',
    localSaveFailed:
      'No se pudo guardar el proyecto en el almacenamiento local.',
    localComponentSaveFailed:
      'No se pudo guardar el componente en el almacenamiento local.',
    saveFailed: 'No se pudo guardar: {{detail}}',
    saveFailedGeneric: 'No se pudo guardar el proyecto.',
    createFailed: 'No se pudo crear el proyecto: {{detail}}',
    versionMismatch:
      'Este proyecto cambió en otro sitio: recárgalo antes de volver a guardarlo.',
    loadFailed: 'No se pudo cargar el proyecto.',
    componentLoadFailed: 'No se pudo cargar el componente.',
    shareLoadFailed: 'No se pudo cargar el proyecto compartido.',
    shareAuthRequired:
      'Inicia sesión para añadir este proyecto compartido a tu biblioteca en la nube.',
    shareCloned: 'Proyecto compartido clonado a tus proyectos en la nube.',
    shareCloneFailed: 'No se pudo clonar el proyecto compartido.',
    dumpElementCountChanged:
      'El número de elementos del volcado del proyecto cambió al cargar: los identificadores y el historial de acciones no se restauraron.',
    skippedCustomOne:
      'No se pudo cargar un componente personalizado (falta su definición) y se omitió.',
    skippedCustomMany:
      'No se pudieron cargar {{count}} componentes personalizados (faltan sus definiciones) y se omitieron.'
  },
  editor: {
    rendererInitFailed:
      'No se pudo iniciar el renderizador de gráficos. Puede que tu navegador o GPU no sean compatibles.',
    fontLoadFailed:
      'No se pudieron cargar las fuentes del editor: algunas etiquetas pueden verse mal.',
    eraseRestoreFailed:
      'Algunos componentes borrados no se pudieron restaurar.',
    circularDependency:
      'No se puede colocar este componente aquí: crearía una dependencia circular.'
  },
  simulation: {
    workerMessageUnreadable:
      'El worker de simulación envió un mensaje ilegible. La simulación se detuvo.',
    engineInitFailed:
      'No se pudo iniciar el motor de simulación. Puede que tu navegador no admita WebAssembly.',
    workerCrashed: 'La simulación se detuvo inesperadamente.',
    unsupportedComponent:
      'El componente "{{symbol}}" no es compatible con el simulador.',
    recursiveComponent:
      'El componente personalizado "{{name}}" se coloca a sí mismo de forma recursiva.',
    componentNoCircuit:
      'El componente personalizado "{{name}}" no tiene circuito para simular.',
    plugMismatch:
      'El componente personalizado "{{name}}" declara {{declaredInputs}}/{{declaredOutputs}} puertos, pero su circuito tiene {{actualInputs}}/{{actualOutputs}} conectores.'
  },
  watch: {
    rendererFailed:
      'No se pudo abrir la vista de monitor: el renderizador no se pudo iniciar.',
    noInnerCircuit:
      'Este componente no tiene circuito interno para inspeccionar.',
    circuitMismatch:
      'El circuito interno no coincide con la simulación compilada: reinicia la simulación para inspeccionarlo.'
  },
  componentActions: {
    edit: 'Editar circuito',
    update: 'Actualizar a la última versión',
    updateAll: 'Actualizar todas las instancias ({{count}})',
    createFailed: 'No se pudo crear el componente.',
    openFailed: 'No se pudo abrir el componente.',
    cloudLoadFailed: 'No se pudo cargar el componente desde la nube.',
    restore: 'Restaurar y editar',
    restoreTooltip:
      'El maestro de este componente en la biblioteca ya no existe, pero su circuito está incrustado. Restáuralo en tu biblioteca local para editarlo.',
    restored: 'Componente restaurado en tu biblioteca local.',
    restoreFailed: 'No se pudo restaurar este componente.',
    signInToEdit: 'Inicia sesión para editar',
    signInTooltip:
      'Este componente reside en tu biblioteca en la nube. Inicia sesión para cargarlo y editarlo.'
  },
  editComponentDetails: {
    button: 'Editar detalles',
    header: 'Editar detalles del componente',
    name: 'Nombre',
    symbol: 'Símbolo',
    description: 'Descripción',
    frozenInstancesHint:
      'Las instancias ya colocadas conservan sus detalles actuales; usa "Actualizar a la última versión" en una instancia seleccionada para aplicarlos.',
    save: 'Guardar',
    saved: 'Detalles del componente actualizados.',
    saveFailed: 'No se pudieron actualizar los detalles del componente.'
  },
  library: {
    loadFailed: 'Algunos componentes guardados no se pudieron cargar.'
  },
  logoutDialog: {
    header: 'Cambios sin guardar',
    message:
      'Estos documentos en la nube tienen cambios sin guardar. ¿Guardarlos antes de cerrar sesión?',
    promotionWarning:
      'Al guardar también se publicarán {{count}} componente(s) local(es) en tu biblioteca en la nube.',
    save: 'Guardar y cerrar sesión',
    discard: 'Cerrar sesión sin guardar',
    cancel: 'Cancelar',
    edited: 'Editado {{relative}}'
  },
  session: {
    loggedOut: 'Sesión cerrada.',
    logoutFailed: 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
    saveLoggedOut:
      'Has cerrado sesión. Inicia sesión de nuevo para guardar en la nube.',
    saveForeign: '“{{name}}” pertenece a otra cuenta y no se puede guardar.'
  },
  routing: {
    notFound: 'No se pudo abrir ese enlace.'
  },
  imageExport: {
    title: 'Exportar imagen',
    project: 'Proyecto',
    format: 'Formato',
    resolution: 'Resolución',
    background: 'Fondo',
    backgroundHint: 'Color del tema y cuadrícula',
    quality: 'Calidad',
    dimensions: '{{width}} × {{height}} px',
    clampedHint: '(reducido para ajustarse a los límites del dispositivo)',
    export: 'Exportar',
    cancel: 'Cancelar',
    success: 'Imagen exportada.',
    error: {
      unavailable:
        'El editor aún no está listo. Inténtalo de nuevo en un momento.',
      failed: 'Falló la exportación de la imagen.'
    },
    warn: {
      clamped:
        'Resolución reducida para ajustarse a los límites del dispositivo; exportada a {{width}} × {{height}} px.'
    }
  },
  shortcuts: {
    title: 'Atajos de teclado',
    actions: {
      save: 'Guardar',
      open: 'Abrir',
      newComponent: 'Nuevo componente',
      undo: 'Deshacer',
      redo: 'Rehacer',
      copy: 'Copiar',
      cut: 'Cortar',
      paste: 'Pegar',
      delete: 'Eliminar',
      rotateSelection: 'Girar en sentido horario',
      rotateSelectionCcw: 'Girar en sentido antihorario',
      moveSelectionUp: 'Mover la selección hacia arriba',
      moveSelectionDown: 'Mover la selección hacia abajo',
      moveSelectionLeft: 'Mover la selección hacia la izquierda',
      moveSelectionRight: 'Mover la selección hacia la derecha',
      zoomIn: 'Acercar',
      zoomOut: 'Alejar',
      zoom100: 'Zoom 100%',
      toolPan: 'Desplazar',
      toolWire: 'Herramienta de cable',
      toolSelect: 'Seleccionar',
      selectScissor: 'Cortar cables en el borde de la selección (mantener)',
      toolErase: 'Borrar',
      toolPlaceText: 'Colocar texto',
      toggleSimulation: 'Iniciar/detener simulación',
      cancel: 'Cancelar'
    } satisfies Record<ShortcutActionEnum, string>,
    groups: {
      fileOps: 'Archivo',
      editOps: 'Editar',
      viewOps: 'Vista',
      tools: 'Herramientas',
      interaction: 'Interacción'
    },
    manager: {
      resetAll: 'Restablecer todo',
      reset: 'Restablecer',
      unassign: 'Desasignar',
      edit: 'Editar atajo',
      cancelRecording: 'Cancelar la grabación',
      recordPrompt: 'Pulsa las teclas…'
    },
    toast: {
      reassignedFrom: 'Atajo desasignado de "{{action}}"',
      loadFailed:
        'No se pudieron cargar los atajos configurados; se usarán los predeterminados.'
    }
  },
  onboarding: {
    settings: {
      showTips: 'Mostrar consejos de introducción'
    },
    menu: {
      showTipsAgain: 'Mostrar los consejos de nuevo'
    },
    nudge: {
      text: '¿Eres nuevo aquí? Construye tu primer circuito en un tutorial rápido.',
      start: 'Empezar el tutorial',
      dismiss: 'Descartar'
    },
    toast: {
      tipsReset: 'Los consejos de introducción están activados de nuevo.'
    },
    bubble: {
      next: 'Siguiente',
      finish: 'Finalizar',
      skip: 'Omitir el tutorial',
      turnOff: 'Desactivar todos los consejos'
    },
    hints: {
      dismiss: 'Descartar',
      wireTapActions:
        'Arrastra para dibujar cables. <strong>Toca un puerto</strong> para añadir o quitar una burbuja de negación, o toca un cruce para conectar o dividir cables.',
      scissorSelectDesktop:
        'La selección de tijera corta los cables en el borde del recuadro. Mantén <strong>Alt</strong> para activarla mientras seleccionas con el recuadro.',
      scissorSelectCompact:
        'La selección de tijera corta los cables en el borde del recuadro.',
      eraser: 'Arrastra sobre cualquier cosa para eliminarla.',
      simControls:
        'La edición está bloqueada mientras se ejecuta. Usa estos controles para pausar, avanzar paso a paso y fijar la velocidad; los botones e interruptores siguen siendo clicables.',
      selectionActions:
        'Gira la selección con estos botones, o pulsa <strong>R</strong> / <strong>Shift+R</strong>. Muévela con las <strong>teclas de flecha</strong>.',
      pastePlacementDesktop:
        'Los elementos pegados aparecen como un fantasma: arrástralos a un sitio libre y suelta para colocarlos, o pulsa Esc para cancelar.',
      pastePlacementCompact:
        'Los elementos pegados aparecen como un fantasma: arrástralos a un sitio libre y levanta el dedo para colocarlos, o toca fuera para cancelar.',
      portsPanelDesktop:
        'Aquí viven los conectores de este componente: coloca <strong>Entrada</strong> y <strong>Salida</strong> desde este panel, luego arrastra las filas para fijar el orden de los puertos y escribe sus nombres.',
      portsPanelCompact:
        'Aquí dentro viven los conectores de este componente: coloca <strong>Entrada</strong> y <strong>Salida</strong> desde este panel, luego arrastra las filas para fijar el orden de los puertos y escribe sus nombres.',
      panZoomCompact:
        'Arrastra con dos dedos para desplazar, pellizca para hacer zoom. Con un solo dedo solo se desplaza en el modo de desplazamiento.'
    },
    tutorials: {
      gettingStarted: {
        steps: {
          welcome: {
            title: 'Bienvenido a Logigator',
            text: 'Vamos a construir un circuito funcional en aproximadamente un minuto. Puedes omitirlo en cualquier momento.'
          },
          moveAround: {
            title: 'Moverse',
            textDesktop:
              'Desplaza para hacer zoom, arrastra con el botón derecho para desplazarte.',
            textCompact:
              'Pellizca para hacer zoom, arrastra con dos dedos para desplazarte.'
          },
          placeAnd: {
            title: 'Coloca una puerta Y',
            textDesktop:
              'Busca <strong>Y</strong> en la lista de componentes de la izquierda y luego haz clic en el lienzo para colocarla.',
            textCompact:
              'Toca <strong>+</strong> para abrir tus bloques de construcción, elige <strong>Y</strong> y luego toca el lienzo para colocarla.',
            nudge:
              'Eso no es una puerta Y: elige <strong>Y</strong> para esta (puedes quitar piezas con el borrador).'
          },
          addSwitches: {
            title: 'Añade dos interruptores',
            textDesktop:
              'Ahora coloca dos entradas de <strong>interruptor</strong> a la izquierda de la puerta. ({{placed}} de {{total}} colocados)',
            textCompact:
              'Toca <strong>+</strong>, elige un <strong>interruptor</strong> y luego toca el lienzo: coloca dos a la izquierda de la puerta. ({{placed}} de {{total}} colocados)'
          },
          addLed: {
            title: 'Añade un LED',
            textDesktop:
              'Coloca un <strong>LED</strong> a la derecha: esa es tu salida.',
            textCompact:
              'Toca <strong>+</strong>, elige el <strong>LED</strong> y luego toca a la derecha de la puerta: esa es tu salida.'
          },
          wireUp: {
            title: 'Conéctalo con cables',
            text: 'Cambia a la <strong>herramienta de cable</strong> y arrastra desde cada interruptor hasta las entradas de la puerta, y luego desde la salida de la puerta hasta el LED.'
          },
          startSim: {
            title: 'Inicia la simulación',
            text: 'Pulsa <strong>Iniciar</strong> para alimentar tu circuito. La edición se bloquea mientras se ejecuta.'
          },
          flipSwitch: {
            title: 'Acciona un interruptor',
            textDesktop:
              'Haz clic en un interruptor para alternarlo. Enciende <strong>ambos</strong> y observa cómo se ilumina el LED.',
            textCompact:
              'Toca un interruptor para alternarlo. Enciende <strong>ambos</strong> y observa cómo se ilumina el LED.'
          },
          complete: {
            title: '¡Todo listo!',
            textDesktop:
              'Has construido una puerta Y funcional y has encendido el LED: ¡bien hecho!<br>A partir de aquí, hazlo tuyo: añade más componentes, conecta circuitos más grandes y guarda tu trabajo cuando te guste.<br><br>¿Necesitas ayuda más adelante? El menú <strong>Ayuda</strong> tiene de nuevo este tutorial, las Novedades y más. ¡Diviértete construyendo!',
            textCompact:
              'Has construido una puerta Y funcional y has encendido el LED: ¡bien hecho!<br>A partir de aquí, hazlo tuyo: añade más componentes, conecta circuitos más grandes y guarda tu trabajo cuando te guste.<br><br>¿Necesitas ayuda más adelante? Abre el <strong>menú</strong> para ver de nuevo este tutorial, las Novedades y más. ¡Diviértete construyendo!'
          }
        }
      }
    }
  }
};

export default es;
