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
    settings: 'Ajustes',
    userMenu: 'Menú de cuenta',
    language: 'Idioma',
    darkMode: 'Modo Oscuro',
    skipToContent: 'Ir al contenido'
  },
  footer: {
    privacyPolicy: 'Política de Datos',
    imprint: 'Aviso Legal',
    contributing: 'Contribuir'
  },
  pages: {
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
