import type { ConsentText } from './consent-text';

export const consentFr: ConsentText = {
  title: 'Cookies',
  text: "Logigator utilise quelques cookies indispensables à son fonctionnement. Avec votre accord, nous collectons aussi des statistiques d'utilisation pour savoir quoi améliorer.",
  privacy: 'Politique de confidentialité',
  acceptAll: 'Tout accepter',
  rejectAll: 'Tout refuser',
  customize: 'Personnaliser',
  preferencesTitle: 'Paramètres des cookies',
  preferencesText:
    "Choisissez ce que Logigator peut enregistrer dans votre navigateur. Vous pouvez modifier votre choix à tout moment depuis le pied de page du site ou le menu Aide de l'éditeur.",
  save: 'Enregistrer mes choix',
  categories: {
    necessary: {
      title: 'Nécessaires',
      description:
        'Ils vous gardent connecté et retiennent vos réglages. Toujours actifs, car Logigator ne fonctionne pas sans eux.'
    },
    analytics: {
      title: 'Statistiques',
      description:
        "Des statistiques d'utilisation recueillies avec PostHog, y compris des enregistrements des sessions dans l'éditeur, nous montrent quoi améliorer. Elles sont stockées dans l'UE et ne sont pas liées à votre compte."
    }
  }
};
