import type { TranslationSchema } from '../app/translation/translation-schema.model';

const fr: TranslationSchema = {
  common: {
    close: 'Fermer',
    back: 'Retour',
    dismiss: 'Masquer',
    firstPage: 'Première page',
    previousPage: 'Page précédente',
    nextPage: 'Page suivante',
    lastPage: 'Dernière page'
  },
  site: {
    name: 'Logigator',
    description:
      'Construisez et simulez vos propres circuits logiques avec Logigator, un outil en ligne simple et puissant.'
  },
  header: {
    home: 'Accueil de Logigator',
    features: 'Fonctionnalités',
    community: 'Communauté',
    myProjects: 'Mes Projets',
    myComponents: 'Mes Composants',
    login: 'Connexion',
    register: "S'inscrire",
    account: 'Compte',
    logout: 'Déconnexion',
    openNavigation: 'Ouvrir la navigation',
    navigation: 'Navigation',
    userMenu: 'Menu du compte',
    notSignedIn: 'Non connecté',
    theme: 'Thème',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    language: 'Langue',
    skipToContent: 'Aller au contenu'
  },
  footer: {
    privacyPolicy: 'Politique de données',
    imprint: 'Mentions légales',
    contributing: 'Contributions'
  },
  pages: {
    home: {
      title: 'Construisez et simulez des circuits logiques',
      lead: 'Construisez, simulez et gérez gratuitement des circuits logiques complexes.',
      openEditor: "Ouvrir l'éditeur"
    },
    notFound: {
      title: 'Page introuvable',
      text: 'La page demandée est introuvable.',
      back: "Retour à l'accueil"
    }
  }
};

export default fr;
