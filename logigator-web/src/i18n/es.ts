import type { TranslationSchema } from '../app/translation/translation-schema.model';

const es: TranslationSchema = {
  common: {
    close: 'Cerrar',
    back: 'Volver',
    dismiss: 'Descartar',
    firstPage: 'Primera página',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    lastPage: 'Última página'
  },
  site: {
    name: 'Logigator',
    description:
      'Construye y simula tus propios circuitos lógicos con Logigator, una herramienta en línea sencilla y potente.'
  },
  header: {
    home: 'Inicio de Logigator',
    docs: 'Documentación',
    examples: 'Ejemplos',
    community: 'Comunidad',
    myProjects: 'Mis Proyectos',
    myComponents: 'Mis Componentes',
    login: 'Iniciar Sesión',
    register: 'Registrarse',
    account: 'Cuenta',
    logout: 'Cerrar Sesión',
    openNavigation: 'Abrir navegación',
    navigation: 'Navegación',
    userMenu: 'Menú de cuenta',
    notSignedIn: 'Sesión no iniciada',
    theme: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    language: 'Idioma',
    skipToContent: 'Ir al contenido'
  },
  footer: {
    changelog: 'Registro de cambios',
    privacyPolicy: 'Política de Privacidad',
    imprint: 'Aviso Legal',
    contributing: 'Contribuir'
  },
  documents: {
    stars: 'estrellas'
  },
  errors: {
    retry: 'Reintentar'
  },
  forms: {
    errors: {
      required: 'Este campo es obligatorio.',
      invalid: 'Este valor no se aceptó.',
      emailInvalid: 'Introduce una dirección de correo válida.',
      usernameTooShort: 'Usa al menos 2 caracteres.',
      usernameTooLong: 'Usa como máximo 20 caracteres.',
      usernamePattern: 'Solo se permiten letras, dígitos, «_» y «-».',
      passwordTooShort: 'Usa al menos 8 caracteres.',
      passwordTooLong: 'Usa como máximo 200 caracteres.',
      passwordComplexity: 'Usa al menos una letra y un dígito.',
      passwordMismatch: 'Las dos contraseñas no coinciden.',
      rateLimited:
        'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
      serviceUnavailable:
        'El servicio no está disponible temporalmente. Inténtalo de nuevo en un momento.',
      validationFailed: 'Revisa lo que has introducido e inténtalo de nuevo.',
      network:
        'Sin conexión con el servidor. Comprueba tu red e inténtalo de nuevo.',
      unknown: 'Algo ha salido mal. Inténtalo de nuevo.'
    }
  },
  auth: {
    email: 'Correo electrónico',
    password: 'Contraseña',
    passwordRepeat: 'Repetir contraseña',
    passwordRules: 'Al menos 8 caracteres, con una letra y un dígito.',
    username: 'Nombre de usuario',
    or: 'o',
    continueWithGoogle: 'Continuar con Google',
    googleErrors: {
      failed:
        'El inicio de sesión con Google no ha funcionado. Inténtalo de nuevo.',
      stateInvalid:
        'Ese intento de inicio de sesión ha caducado. Empieza de nuevo.',
      emailTaken:
        'Ya hay una cuenta con esa dirección de correo. Inicia sesión con tu contraseña y luego vincula Google desde tu cuenta.',
      alreadyLinked:
        'Esa cuenta de Google pertenece a otra cuenta de Logigator.'
    }
  },
  pages: {
    login: {
      title: 'Iniciar sesión',
      heading: 'Bienvenido de nuevo',
      submit: 'Iniciar sesión',
      forgotPassword: '¿Has olvidado tu contraseña?',
      noAccount: '¿Aún no tienes cuenta?',
      registerLink: 'Registrarse',
      invalidCredentials: 'El correo o la contraseña no son correctos.',
      notVerified: 'Confirma tu dirección de correo antes de iniciar sesión.',
      resend: 'Volver a enviar el correo de confirmación',
      resent: 'Correo de confirmación enviado. Revisa tu bandeja de entrada.'
    },
    register: {
      title: 'Registrarse',
      heading: 'Crea tu cuenta',
      submit: 'Registrarse',
      emailTaken: 'Ya hay una cuenta con esa dirección de correo.',
      mailFailed:
        'Tu cuenta se ha creado, pero no se pudo enviar el correo de confirmación. Inicia sesión para pedirlo de nuevo.',
      privacyNoticeBefore: 'Al registrarte confirmas que has leído nuestra ',
      privacyNoticeLink: 'política de privacidad',
      privacyNoticeAfter: ' y que la aceptas.',
      haveAccount: '¿Ya tienes una cuenta?',
      loginLink: 'Iniciar sesión',
      confirmHeading: 'Confirma tu dirección de correo',
      confirmLead:
        'Hemos enviado un enlace de confirmación a {{email}}. Ábrelo para terminar el registro.',
      toLogin: 'Ir a iniciar sesión'
    },
    resetPassword: {
      title: 'Restablecer contraseña',
      requestHeading: 'Restablece tu contraseña',
      requestLead:
        'Introduce la dirección con la que te registraste y te enviaremos un enlace.',
      requestSubmit: 'Enviar enlace',
      requestSent:
        'Si esa dirección tiene una cuenta, el enlace está en camino. Es válido durante una hora.',
      backToLogin: 'Volver a iniciar sesión',
      applyHeading: 'Elige una contraseña nueva',
      applySubmit: 'Guardar contraseña',
      applied: 'Tu contraseña se ha cambiado. Ya puedes iniciar sesión.',
      tokenInvalid: 'Este enlace ya no es válido. Pide uno nuevo.',
      requestNew: 'Pedir un enlace nuevo'
    },
    verifyEmail: {
      title: 'Confirmación de correo',
      pending: 'Confirmando tu dirección de correo',
      pendingLead: 'Un momento, por favor.',
      success: 'Tu dirección de correo está confirmada',
      successLead: 'Ya puedes iniciar sesión.',
      error: 'Este enlace no ha funcionado',
      errorLead:
        'Los enlaces de confirmación caducan al cabo de una hora. Puedes pedir uno nuevo desde la página de inicio de sesión.',
      toLogin: 'Ir a iniciar sesión'
    },
    home: {
      title: 'Construye y Simula Circuitos Lógicos',
      hero: {
        headline:
          'Construye, simula y gestiona circuitos lógicos complejos de forma gratuita.',
        lede: 'Compuertas, cables y subcircuitos reutilizables, en el navegador. La simulación corre sobre un motor WebAssembly y la placa se dibuja en la GPU, así que un circuito sigue funcionando a medida que crece.',
        cta: 'Comenzar a Construir Ahora',
        ctaSecondary: 'Ver ejemplos'
      },
      features: {
        title: 'Características',
        description:
          'Construye y simula tus propios circuitos con Logigator, una herramienta en línea simple pero poderosa.',
        performance: {
          title: 'Rendimiento',
          body: 'El editor de Logigator puede manejar incluso los proyectos más grandes con facilidad gracias a WebAssembly y WebGL.'
        },
        subcircuits: {
          title: 'Subcircuitos',
          body: 'Crea subcircuitos y úsalos en todos tus proyectos para ayudar a mantenerlos organizados.'
        },
        share: {
          title: 'Compartir Proyectos',
          body: 'Comparte tus circuitos con otros usuarios para que puedan aprender de tu trabajo.'
        },
        images: {
          title: 'Exportar Imágenes',
          body: 'Con Logigator puedes exportar imágenes de alta resolución en tres formatos diferentes (SVG, PNG, JPG) para usarlas en cualquier lugar.'
        }
      },
      examples: {
        title: 'Circuitos de Ejemplo',
        description:
          'Aprende a diseñar circuitos simples y más complejos a partir de nuestros ejemplos.',
        more: 'Ver Más Ejemplos',
        emptyHeading: 'Todavía no hay ejemplos',
        emptyBody: 'Aún no se ha publicado nada para esta instalación.',
        failed: 'No se pudieron cargar los ejemplos'
      },
      video: {
        title: '¿Qué son los circuitos lógicos?',
        description:
          'Si no sabes qué son las compuertas lógicas o los circuitos lógicos, hemos animado una breve explicación para que la veas.',
        play: 'Reproducir el vídeo «{{title}}» en YouTube'
      },
      community: {
        projectsTitle: 'Proyectos de la Comunidad',
        projectsDescription:
          'Explora otros proyectos creados por nuestra comunidad. Tu proyecto podría ser el próximo en esta lista.',
        moreProjects: 'Ver Más Proyectos',
        projectsEmptyHeading: 'Todavía no hay proyectos públicos',
        projectsEmptyBody:
          'Hasta ahora no se ha compartido nada con la comunidad.',
        projectsFailed: 'No se pudieron cargar los proyectos',
        componentsTitle: 'Componentes de la Comunidad',
        componentsDescription:
          'Explora otros componentes creados por nuestra comunidad. Pueden ser útiles para ti.',
        moreComponents: 'Ver Más Componentes',
        componentsEmptyHeading: 'Todavía no hay componentes públicos',
        componentsEmptyBody:
          'Hasta ahora no se ha compartido nada con la comunidad.',
        componentsFailed: 'No se pudieron cargar los componentes'
      }
    },
    examples: {
      title: 'Circuitos de Ejemplo',
      lede: 'Aprende a diseñar circuitos simples y más complejos a partir de nuestros ejemplos. Todos se abren en el editor, listos para simular.',
      open: 'Abrir en el editor',
      openNamed: 'Abrir «{{name}}» en el editor',
      emptyHeading: 'Todavía no hay ejemplos',
      emptyBody: 'Aún no se ha publicado nada para esta instalación.',
      failed: 'No se pudieron cargar los ejemplos'
    },
    docs: {
      title: 'Documentación',
      lede: 'Cada parte del editor de Logigator, explicada: el tablero y sus herramientas, la construcción de circuitos, la simulación y cómo guardar tu trabajo.',
      search: {
        label: 'Buscar en la documentación',
        placeholder: 'Buscar..',
        empty: 'Nada coincide con «{{query}}».'
      },
      navLabel: 'Páginas de documentación',
      allTopics: 'Todos los temas',
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
    changelog: {
      title: 'Registro de cambios',
      lede: 'Cada versión del editor de Logigator, la más reciente primero: qué se añadió, qué cambió y qué se corrigió.',
      feed: 'Suscribirse mediante Atom'
    },
    imprint: {
      title: 'Aviso Legal',
      lede: 'Quién gestiona Logigator y cómo contactar con nosotros.'
    },
    privacyPolicy: {
      title: 'Política de Privacidad',
      lede: 'Qué datos procesa Logigator, por qué los procesa y qué derechos tienes sobre ellos.'
    },
    notFound: {
      title: 'Página no encontrada',
      text: 'No se pudo encontrar la página solicitada.',
      back: 'Volver a inicio'
    }
  }
};

export default es;
