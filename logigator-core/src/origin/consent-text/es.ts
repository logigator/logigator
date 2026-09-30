import type { ConsentText } from './consent-text';

export const consentEs: ConsentText = {
  title: 'Cookies y estadísticas',
  text: 'Logigator usa algunas cookies imprescindibles para funcionar, como la que mantiene tu sesión iniciada. Si lo permites, también usamos PostHog para ver cómo se usan el sitio web y el editor, incluidas grabaciones de sesiones del editor, y así saber qué mejorar.',
  privacy: 'Política de privacidad',
  acceptAll: 'Aceptar todo',
  rejectAll: 'Rechazar todo',
  customize: 'Personalizar',
  preferencesTitle: 'Ajustes de cookies',
  preferencesText:
    'Elige qué puede guardar Logigator en tu navegador. Puedes cambiar tu elección en cualquier momento desde el pie de página del sitio web o el menú Ayuda del editor.',
  save: 'Guardar selección',
  categories: {
    necessary: {
      title: 'Necesarias',
      description:
        'Mantienen tu sesión iniciada, recuerdan tu idioma, tu tema y los ajustes del editor, guardan tu trabajo en este navegador y almacenan esta elección. Siempre activas, porque Logigator no funciona sin ellas.'
    },
    analytics: {
      title: 'Estadísticas',
      description:
        'PostHog registra las páginas que abres, dónde haces clic, lo rápido que cargan las páginas y, en el editor, una grabación de tu sesión. Los datos se vinculan a un identificador aleatorio y no a tu cuenta, y se almacenan en la UE. No se recopila nada a menos que lo actives.'
    }
  }
};
