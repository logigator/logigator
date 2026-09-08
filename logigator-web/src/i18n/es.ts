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
    features: 'Características',
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
    privacyPolicy: 'Política de Datos',
    imprint: 'Aviso Legal',
    contributing: 'Contribuir'
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
      lead: 'Construye, simula y gestiona circuitos lógicos complejos de forma gratuita.',
      openEditor: 'Abrir el editor'
    },
    notFound: {
      title: 'Página no encontrada',
      text: 'No se pudo encontrar la página solicitada.',
      back: 'Volver a inicio'
    }
  }
};

export default es;
