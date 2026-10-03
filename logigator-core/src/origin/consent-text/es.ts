import type { ConsentText } from './consent-text';

export const consentEs: ConsentText = {
  title: 'Cookies',
  text: 'Logigator usa algunas cookies imprescindibles para funcionar. Si lo permites, también recopilamos estadísticas de uso para saber qué mejorar.',
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
        'Mantienen tu sesión iniciada y recuerdan tus ajustes. Siempre activas, porque Logigator no funciona sin ellas.'
    },
    analytics: {
      title: 'Estadísticas',
      description:
        'Las estadísticas de uso que recopilamos con PostHog, incluidas grabaciones de sesiones del editor, nos muestran qué mejorar. Se almacenan en la UE y no se vinculan a tu cuenta.'
    }
  }
};
