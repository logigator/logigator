import type { ConsentText } from './consent-text';

export const consentFr: ConsentText = {
  title: 'Cookies et statistiques',
  text: "Logigator dépose quelques cookies indispensables à son fonctionnement, comme celui qui vous garde connecté. Si vous l'acceptez, nous utilisons aussi PostHog pour voir comment le site et l'éditeur sont utilisés, y compris des enregistrements des sessions dans l'éditeur, afin de savoir quoi améliorer.",
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
        "Ils vous gardent connecté, retiennent votre langue, votre thème et vos réglages de l'éditeur, conservent votre travail dans ce navigateur et mémorisent ce choix. Toujours actifs, car Logigator ne fonctionne pas sans eux."
    },
    analytics: {
      title: 'Statistiques',
      description:
        "PostHog enregistre les pages que vous ouvrez, ce sur quoi vous cliquez, la vitesse de chargement des pages et, dans l'éditeur, un enregistrement de votre session. Les données sont liées à un identifiant aléatoire plutôt qu'à votre compte et stockées dans l'UE. Rien n'est collecté tant que vous n'activez pas cette option."
    }
  }
};
