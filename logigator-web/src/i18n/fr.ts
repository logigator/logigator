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
    docs: 'Documentation',
    examples: 'Exemples',
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
    changelog: 'Journal des modifications',
    privacyPolicy: 'Politique de confidentialité',
    imprint: 'Mentions légales',
    contributing: 'Contributions'
  },
  documents: {
    stars: 'étoiles'
  },
  errors: {
    retry: 'Réessayer'
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
      nameRequired: 'Saisis un nom.',
      nameTooLong: 'Utilise 20 caractères au maximum.',
      descriptionTooLong: 'Utilise 2048 caractères au maximum.',
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
      metaDescription:
        'Connecte-toi à Logigator pour ouvrir tes circuits enregistrés, ta bibliothèque de composants et les projets que tu as étoilés.',
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
      metaDescription:
        'Crée un compte Logigator gratuit pour enregistrer tes circuits dans le cloud, constituer une bibliothèque de composants et partager tes créations.',
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
      hero: {
        headline:
          'Construisez, simulez et gérez des circuits logiques complexes gratuitement.',
        lede: "Portes, fils et sous-circuits réutilisables, directement dans le navigateur. La simulation tourne sur un moteur WebAssembly et la carte est rendue par le GPU : un circuit continue donc de tourner à mesure qu'il grandit.",
        cta: 'Commencez à construire maintenant',
        ctaSecondary: 'Voir les exemples'
      },
      features: {
        title: 'Fonctionnalités',
        description:
          'Construisez et simulez vos propres circuits avec Logigator, un outil en ligne simple mais puissant.',
        performance: {
          title: 'Performance',
          body: "L'éditeur de Logigator peut gérer même les plus grands projets facilement grâce à WebAssembly et WebGL."
        },
        subcircuits: {
          title: 'Sous-circuits',
          body: 'Créez des sous-circuits et utilisez-les partout dans vos projets pour les garder organisés.'
        },
        share: {
          title: 'Partager des Projets',
          body: "Partagez vos circuits avec d'autres utilisateurs, afin qu'ils puissent apprendre de votre travail."
        },
        images: {
          title: 'Exporter des Images',
          body: "Avec Logigator, vous pouvez exporter des images haute résolution dans trois formats différents (SVG, PNG, JPG) pour les utiliser n'importe où."
        }
      },
      examples: {
        title: 'Circuits Exemples',
        description:
          'Apprenez à concevoir des circuits simples et plus complexes à partir de nos exemples.',
        more: "Voir Plus d'Exemples",
        emptyHeading: 'Pas encore d’exemples',
        emptyBody: "Rien n'a encore été publié pour cette installation.",
        failed: "Les exemples n'ont pas pu être chargés"
      },
      video: {
        title: 'Quels sont les circuits logiques ?',
        description:
          'Si vous ne savez pas ce que sont les portes logiques ou les circuits logiques, nous avons animé une brève explication pour que vous puissiez regarder.',
        play: 'Lire la vidéo « {{title}} » sur YouTube'
      },
      stats: {
        projects: 'circuits publics',
        components: 'composants publics',
        examples: 'exemples expliqués'
      },
      community: {
        projectsTitle: 'Projets Communautaires',
        projectsDescription:
          "Explorez d'autres projets créés par notre communauté. Votre projet pourrait être le prochain sur cette liste.",
        moreProjects: 'Voir Plus de Projets',
        projectsEmptyHeading: 'Pas encore de projets publics',
        projectsEmptyBody: "Rien n'a encore été partagé avec la communauté.",
        projectsFailed: "Les projets n'ont pas pu être chargés",
        componentsTitle: 'Composants Communautaires',
        componentsDescription:
          "Explorez d'autres composants créés par notre communauté. Ils peuvent être utiles pour vous.",
        moreComponents: 'Voir Plus de Composants',
        componentsEmptyHeading: 'Pas encore de composants publics',
        componentsEmptyBody: "Rien n'a encore été partagé avec la communauté.",
        componentsFailed: "Les composants n'ont pas pu être chargés"
      }
    },
    examples: {
      title: 'Circuits Exemples',
      lede: 'Apprenez à concevoir des circuits simples et plus complexes à partir de nos exemples. Chacun s’ouvre dans l’éditeur, prêt à être simulé.',
      open: 'Ouvrir dans l’éditeur',
      openNamed: 'Ouvrir « {{name}} » dans l’éditeur',
      emptyHeading: 'Pas encore d’exemples',
      emptyBody: "Rien n'a encore été publié pour cette installation.",
      failed: "Les exemples n'ont pas pu être chargés"
    },
    community: {
      nav: {
        projects: 'Projets',
        components: 'Composants'
      },
      browse: {
        projectsTitle: 'Projets de la communauté',
        projectsLede:
          'Tous les circuits publiés par la communauté. Ouvrez-en un dans l’éditeur, ou enregistrez-en une copie pour continuer dessus.',
        componentsTitle: 'Composants de la communauté',
        componentsLede:
          'Des blocs réutilisables publiés par la communauté. Placez-en un dans votre propre circuit.',
        orderLabel: 'Trier par',
        orderTrending: 'Tendances',
        orderStars: 'Les plus étoilés',
        orderLatest: 'Les plus récents',
        searchLabel: 'Rechercher par nom',
        searchPlaceholder: 'Rechercher..',
        count: '{{count}} résultats',
        clearSearch: 'Effacer la recherche',
        noMatchHeading: 'Aucun résultat',
        noMatchBody: 'Aucun circuit publié ne s’appelle « {{search}} ».',
        emptyHeading: 'Rien pour le moment',
        emptyBody: 'Rien n’a encore été partagé avec la communauté.',
        errorHeading: 'La liste n’a pas pu être chargée'
      },
      document: {
        open: 'Ouvrir dans l’éditeur',
        clone: 'Enregistrer une copie',
        star: 'Ajouter une étoile',
        unstar: 'Étoile ajoutée',
        symbol: 'symbole',
        inputs: 'ent',
        outputs: 'sor',
        components: 'composants',
        wires: 'fils',
        edited: 'modifié',
        about: 'À propos de ce circuit',
        noDescription: 'Aucune description n’a été fournie.',
        forkedFrom: 'Dérivé de',
        forkedFromBy: 'par {{author}}',
        errorHeading: 'Le circuit n’a pas pu être chargé'
      },
      stargazers: {
        title: 'Étoiles',
        count: '{{count}} étoiles',
        seeAll: 'Voir tous ceux qui ont mis une étoile',
        emptyHeading: 'Aucune étoile',
        emptyBody: 'Personne n’a encore mis d’étoile à ce circuit.',
        errorHeading: 'Les étoiles n’ont pas pu être chargées'
      },
      profile: {
        title: 'Membre',
        tabTitle: '{{username}} – {{section}}',
        metaDescription:
          'Les circuits et composants que {{username}} a publiés sur Logigator.',
        sections: 'Les listes de ce membre',
        memberSince: 'Membre depuis',
        projects: 'Projets',
        components: 'Composants',
        starredProjects: 'Projets étoilés',
        starredComponents: 'Composants étoilés',
        emptyProjects: 'Aucun projet public',
        emptyComponents: 'Aucun composant public',
        emptyStarredProjects: 'Aucun projet étoilé',
        emptyStarredComponents: 'Aucun composant étoilé',
        emptyBody: 'Il n’y a rien à afficher dans cette catégorie.',
        errorHeading: 'Le profil n’a pas pu être chargé',
        listErrorHeading: 'La liste n’a pas pu être chargée'
      }
    },
    my: {
      nav: {
        label: 'Mon travail',
        projects: 'Projets',
        components: 'Composants'
      },
      projects: {
        title: 'Mes projets',
        lede: 'Tous les circuits que tu as enregistrés dans le cloud. Ouvre-en un pour continuer, ou publie-le auprès de la communauté.',
        create: 'Nouveau projet',
        count: '{{count}} projets',
        emptyHeading: 'Aucun projet pour l’instant',
        emptyBody:
          'Les circuits que tu enregistres dans le cloud depuis l’éditeur apparaissent ici.'
      },
      components: {
        title: 'Mes composants',
        lede: 'Les blocs réutilisables de ta bibliothèque. Place-les dans n’importe quel circuit que tu construis.',
        count: '{{count}} composants',
        emptyHeading: 'Aucun composant pour l’instant',
        emptyBody:
          'Un composant se crée dans l’éditeur, à partir d’un circuit que tu as construit.'
      },
      list: {
        searchLabel: 'Rechercher par nom',
        searchPlaceholder: 'Rechercher..',
        clearSearch: 'Effacer la recherche',
        noMatchHeading: 'Aucun résultat',
        noMatchBody: 'Rien chez toi ne s’appelle « {{search}} ».',
        errorHeading: 'La liste n’a pas pu être chargée',
        openInEditor: 'Ouvrir « {{name}} » dans l’éditeur',
        actionsFor: 'Actions pour « {{name}} »',
        public: 'Public',
        private: 'Privé',
        edit: 'Nom et description',
        share: 'Partager…',
        delete: 'Supprimer'
      },
      edit: {
        heading: 'Nom et description',
        nameLabel: 'Nom',
        descriptionLabel: 'Description',
        descriptionHint:
          'Affichée sur la page communautaire, si ce circuit est publié.',
        save: 'Enregistrer',
        cancel: 'Annuler'
      },
      share: {
        heading: 'Partager',
        intro:
          'Toute personne disposant du lien ci-dessous peut ouvrir « {{name}} » dans l’éditeur, qu’il soit publié ou non.',
        linkLabel: 'Lien de partage',
        linkHint:
          'Le lien ouvre une copie en lecture seule. Personne ne peut modifier ton circuit par ce biais.',
        copy: 'Copier',
        copied: 'Lien copié.',
        copyFailed:
          'Le lien n’a pas pu être copié. Sélectionne-le et copie-le à la main.',
        publicLabel: 'Publier auprès de la communauté',
        publicHintProject:
          'Un projet publié apparaît dans les listes communautaires et peut être mis en favori et copié.',
        publicHintComponent:
          'Un composant publié apparaît dans les listes communautaires et peut être placé par tout le monde.',
        viewPublicPage: 'Voir la page communautaire',
        regenerateLabel: 'Révoquer le lien',
        regenerateHint:
          'Un nouveau lien est émis et l’ancien cesse de fonctionner — y compris la page communautaire, qui vit à cette adresse.',
        regenerate: 'Émettre un nouveau lien',
        close: 'Fermer'
      },
      delete: {
        heading: 'Supprimer définitivement ?',
        messageProject:
          '« {{name}} » et son circuit seront supprimés. C’est irréversible.',
        messageComponent:
          '« {{name}} » sera supprimé. Les circuits qui l’utilisent déjà continuent avec la copie enregistrée à l’intérieur.',
        confirm: 'Supprimer',
        cancel: 'Annuler',
        done: '« {{name}} » a été supprimé.',
        failed: '« {{name}} » n’a pas pu être supprimé.'
      },
      account: {
        title: 'Compte',
        lede: 'Ton nom et ton image, l’adresse avec laquelle tu te connectes, et comment tu te connectes.',
        memberSince: 'Membre depuis le {{date}}',
        currentPassword: 'Mot de passe actuel',
        passwordIncorrect: 'Ce mot de passe n’est pas correct.',
        profile: {
          heading: 'Profil',
          description:
            'Le nom et l’image affichés à côté de tout ce que tu publies.',
          changePicture: 'Changer l’image',
          removePicture: 'Retirer',
          pictureHint:
            'PNG, JPEG, WebP ou GIF. Elle est recadrée en carré et ré-encodée.',
          save: 'Enregistrer',
          saved: 'Ton profil a été enregistré.',
          avatarRejected:
            'Cette image n’a pas pu être utilisée. Essaie un PNG, JPEG ou WebP plus petit.'
        },
        email: {
          heading: 'Adresse e-mail',
          description:
            'L’adresse avec laquelle tu te connectes, et où les confirmations sont envoyées.',
          current: 'Actuellement :',
          unverified: 'non confirmée',
          newLabel: 'Nouvelle adresse e-mail',
          passwordHint:
            'Ton mot de passe confirme que c’est bien toi qui demandes.',
          submit: 'Envoyer la confirmation',
          pending:
            'Un lien de confirmation est en route vers {{email}}. Ton adresse change dès que tu l’ouvres.',
          taken: 'Cette adresse e-mail a déjà un compte.',
          unchanged: 'C’est déjà ton adresse.',
          mailFailed:
            'L’e-mail de confirmation n’a pas pu être envoyé. Rien n’a changé — réessaie.'
        },
        password: {
          heading: 'Mot de passe',
          description: 'Le changer te déconnecte partout ailleurs.',
          setHeading: 'Définir un mot de passe',
          setDescription:
            'Tu t’es inscrit avec Google et n’as pas encore de mot de passe. En définir un te donne un second accès.',
          newLabel: 'Nouveau mot de passe',
          submit: 'Changer le mot de passe',
          setSubmit: 'Définir le mot de passe',
          saved: 'Ton mot de passe a été changé.',
          sessionsNotice:
            'Tes autres sessions sont déconnectées. Celle-ci reste.'
        },
        google: {
          heading: 'Google',
          description:
            'Se connecter avec ton compte Google, en plus du mot de passe.',
          linked: 'Ton compte Google est lié.',
          link: 'Lier le compte Google',
          unlink: 'Délier',
          unlinkConfirm:
            'La connexion avec Google cessera de fonctionner. Tu peux la relier à tout moment.',
          needsPassword:
            'Définis d’abord un mot de passe — Google est actuellement le seul accès à ce compte.'
        },
        delete: {
          heading: 'Supprimer le compte',
          description:
            'Ton compte et tous les projets, composants et favoris qu’il contient seront supprimés. C’est irréversible.',
          submit: 'Supprimer mon compte',
          confirm:
            'Tout ce que tu as créé sur Logigator sera supprimé, définitivement.',
          done: 'Ton compte a été supprimé.'
        }
      }
    },
    docs: {
      title: 'Documentation',
      lede: "Chaque partie de l'éditeur Logigator, expliquée : le plan de travail et ses outils, la construction de circuits, la simulation et la conservation de votre travail.",
      search: {
        label: 'Rechercher dans la documentation',
        placeholder: 'Rechercher..',
        empty: 'Aucun résultat pour « {{query}} ».'
      },
      navLabel: 'Pages de documentation',
      allTopics: 'Tous les sujets',
      sections: {
        basics: 'Bases',
        building: 'Construction de circuits',
        simulation: 'Simulation',
        projects: 'Projets et cloud'
      },
      pages: {
        gettingStarted: 'Prise en main',
        boardAndTools: 'Plan de travail et outils',
        shortcuts: 'Raccourcis clavier',
        settings: 'Paramètres et apparence',
        componentsAndOptions: 'Composants et options',
        wiresAndConnections: 'Fils et connexions',
        customComponents: 'Composants personnalisés',
        simulation: 'Simulation',
        inspection: 'Inspection et surveillances',
        savingAndFiles: 'Enregistrement et fichiers',
        cloud: 'Cloud et partage'
      }
    },
    changelog: {
      title: 'Journal des modifications',
      lede: 'Chaque version de l’éditeur Logigator, la plus récente en premier : les ajouts, les changements et les corrections.',
      feed: 'S’abonner via Atom'
    },
    imprint: {
      title: 'Mentions légales',
      lede: 'Qui exploite Logigator et comment nous joindre.'
    },
    privacyPolicy: {
      title: 'Politique de confidentialité',
      lede: 'Quelles données Logigator traite, pourquoi elles le sont et quels droits tu as sur elles.'
    },
    notFound: {
      title: 'Page introuvable',
      text: 'La page demandée est introuvable.',
      back: "Retour à l'accueil"
    }
  }
};

export default fr;
