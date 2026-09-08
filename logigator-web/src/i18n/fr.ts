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
  forms: {
    errors: {
      required: 'Ce champ est obligatoire.',
      invalid: 'Cette valeur n’a pas été acceptée.',
      emailInvalid: 'Saisis une adresse e-mail valide.',
      usernameTooShort: 'Utilise au moins 2 caractères.',
      usernameTooLong: 'Utilise au plus 20 caractères.',
      usernamePattern:
        'Seuls les lettres, les chiffres, « _ » et « - » sont autorisés.',
      passwordTooShort: 'Utilise au moins 8 caractères.',
      passwordTooLong: 'Utilise au plus 200 caractères.',
      passwordComplexity: 'Utilise au moins une lettre et un chiffre.',
      passwordMismatch: 'Les deux mots de passe ne correspondent pas.',
      rateLimited: 'Trop de tentatives. Patiente un instant puis réessaie.',
      serviceUnavailable:
        'Le service est momentanément indisponible. Réessaie dans un instant.',
      validationFailed: 'Vérifie tes saisies puis réessaie.',
      network: 'Aucune connexion au serveur. Vérifie ton réseau puis réessaie.',
      unknown: 'Une erreur est survenue. Réessaie.'
    }
  },
  auth: {
    email: 'E-mail',
    password: 'Mot de passe',
    passwordRepeat: 'Répéter le mot de passe',
    passwordRules: 'Au moins 8 caractères, dont une lettre et un chiffre.',
    username: 'Nom d’utilisateur',
    or: 'ou',
    continueWithGoogle: 'Continuer avec Google',
    googleErrors: {
      failed: 'La connexion avec Google a échoué. Réessaie.',
      stateInvalid: 'Cette tentative de connexion a expiré. Recommence.',
      emailTaken:
        'Un compte utilise déjà cette adresse e-mail. Connecte-toi avec ton mot de passe, puis associe Google depuis ton compte.',
      alreadyLinked: 'Ce compte Google appartient à un autre compte Logigator.'
    }
  },
  pages: {
    login: {
      title: 'Connexion',
      heading: 'Content de te revoir',
      submit: 'Se connecter',
      forgotPassword: 'Mot de passe oublié ?',
      noAccount: 'Pas encore de compte ?',
      registerLink: 'S’inscrire',
      invalidCredentials: 'L’adresse e-mail ou le mot de passe est incorrect.',
      notVerified: 'Confirme ton adresse e-mail avant de te connecter.',
      resend: 'Renvoyer l’e-mail de confirmation',
      resent: 'E-mail de confirmation envoyé. Consulte ta boîte de réception.'
    },
    register: {
      title: 'Inscription',
      heading: 'Crée ton compte',
      submit: 'S’inscrire',
      emailTaken: 'Un compte utilise déjà cette adresse e-mail.',
      mailFailed:
        'Ton compte a été créé, mais l’e-mail de confirmation n’a pas pu être envoyé. Connecte-toi pour le demander à nouveau.',
      privacyNoticeBefore: 'En t’inscrivant, tu confirmes avoir lu notre ',
      privacyNoticeLink: 'politique de confidentialité',
      privacyNoticeAfter: ' et l’accepter.',
      haveAccount: 'Tu as déjà un compte ?',
      loginLink: 'Se connecter',
      confirmHeading: 'Confirme ton adresse e-mail',
      confirmLead:
        'Nous avons envoyé un lien de confirmation à {{email}}. Ouvre-le pour terminer ton inscription.',
      toLogin: 'Aller à la connexion'
    },
    resetPassword: {
      title: 'Réinitialiser le mot de passe',
      requestHeading: 'Réinitialise ton mot de passe',
      requestLead:
        'Indique l’adresse avec laquelle tu t’es inscrit et nous t’enverrons un lien.',
      requestSubmit: 'Envoyer le lien',
      requestSent:
        'Si un compte existe pour cette adresse, le lien est en route. Il est valable une heure.',
      backToLogin: 'Retour à la connexion',
      applyHeading: 'Choisis un nouveau mot de passe',
      applySubmit: 'Enregistrer le mot de passe',
      applied: 'Ton mot de passe a été modifié. Tu peux te connecter.',
      tokenInvalid: 'Ce lien n’est plus valable. Demandes-en un nouveau.',
      requestNew: 'Demander un nouveau lien'
    },
    verifyEmail: {
      title: 'Confirmation de l’e-mail',
      pending: 'Confirmation de ton adresse e-mail',
      pendingLead: 'Un instant.',
      success: 'Ton adresse e-mail est confirmée',
      successLead: 'Tu peux te connecter.',
      error: 'Ce lien n’a pas fonctionné',
      errorLead:
        'Les liens de confirmation expirent au bout d’une heure. Tu peux en demander un nouveau depuis la page de connexion.',
      toLogin: 'Aller à la connexion'
    },
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
