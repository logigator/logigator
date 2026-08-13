import type { WorkMode } from '../app/work-mode/work-mode.enum';
import type { ShortcutActionEnum } from '../app/shortcuts/shortcut-action.enum';
import type { ComponentCategory } from '@logigator/core';
import type { TranslationSchema } from '../app/translation/translation-schema.model';

const fr: TranslationSchema = {
  common: {
    save: 'Enregistrer',
    cancel: 'Annuler',
    untitled: 'Sans titre',
    close: 'Fermer',
    back: 'Retour',
    dismiss: 'Masquer',
    firstPage: 'Première page',
    previousPage: 'Page précédente',
    nextPage: 'Page suivante',
    lastPage: 'Dernière page',
    moved: 'Déplacé en position {{position}} sur {{total}}'
  },
  user: {
    loadFailed:
      'Impossible de charger les données utilisateur. Veuillez vous reconnecter.'
  },
  userSettings: {
    notSignedIn: 'Non connecté',
    theme: 'Thème',
    language: 'Langue',
    editorSettings: "Paramètres de l'éditeur",
    account: 'Compte',
    logOut: 'Se déconnecter',
    logIn: 'Se connecter'
  },
  theming: {
    light: 'Clair',
    dark: 'Sombre'
  },
  hexEditor: {
    wordView: 'Mots',
    byteView: 'Octets',
    hex: 'Hex',
    decimal: 'Décimal',
    octal: 'Octal',
    binary: 'Binaire',
    address: 'Adr',
    goto: "Aller à l'adresse",
    gotoPlaceholder: 'Adresse…',
    activeAddress: 'Adresse',
    value: 'Valeur',
    noActiveCell: 'Aucune cellule sélectionnée',
    clear: 'Effacer',
    copy: 'Copier',
    follow: 'Suivre',
    clearConfirm: 'Effacer tout le contenu de la mémoire ?',
    copyFailed: 'Impossible de copier dans le presse-papiers.',
    viewLabel: 'Regroupement de cellules',
    radixLabel: 'Base numérique'
  },
  settings: {
    options: {
      fpsCounter: 'Compteur FPS',
      showGrid: 'Afficher la grille',
      autoStartSimulation: 'Démarrage automatique de la simulation'
    }
  },
  minimap: {
    expand: 'Afficher la minicarte',
    collapse: 'Masquer la minicarte'
  },
  components: {
    category: {
      hidden: 'Masqué',
      basic: 'Basique',
      advanced: 'Avancé',
      io: 'Entrées / Sorties',
      port: 'Ports',
      user: 'Composants utilisateur'
    } satisfies Record<ComponentCategory, string>,
    def: {
      NOT: {
        name: 'Porte NON',
        description:
          "Une porte NON est une porte logique numérique qui réalise la négation logique. Elle se comporte selon la table de vérité affichée à droite. Une sortie HIGH (1) est produite si les entrées ne sont pas égales. Si l'entrée est LOW (0), alors la sortie sera HIGH (1)."
      },
      AND: {
        name: 'Porte ET',
        description:
          "Une porte ET est une porte logique numérique qui réalise la conjonction logique. Elle se comporte selon la table de vérité affichée à droite. Une sortie HIGH (1) n'est produite que si les deux entrées de la porte ET sont HIGH (1). Si aucune entrée, ou une seule, de la porte ET est HIGH, la sortie est LOW."
      },
      OR: {
        name: 'Porte OU',
        description:
          "Une porte OU est une porte logique numérique qui réalise la disjonction logique. Une sortie HIGH (1) est produite si au moins une entrée de la porte OU est HIGH (1). La sortie n'est LOW (0) que si toutes les entrées sont LOW (0)."
      },
      XOR: {
        name: 'Porte XOR',
        description:
          "Une porte XOR est une porte logique numérique qui réalise la disjonction exclusive. Une sortie HIGH (1) est produite si un nombre impair d'entrées de la porte XOR sont HIGH (1)."
      },
      DELAY: {
        name: 'Retard',
        description:
          'Un tampon qui transmet son entrée inchangée, en ajoutant un tick de retard de simulation au signal.'
      },
      CLOCK: {
        name: 'Horloge',
        description:
          "Émet périodiquement une impulsion d'un tick sur sa sortie. Le délai entre les impulsions est configurable ; mettre l'entrée STP à HIGH met l'horloge en pause.",
        options: {
          speed: 'Retard'
        }
      },
      TUNNEL: {
        name: 'Tunnel',
        description:
          'Fonctionne comme un fil, mais sans fil : tous les tunnels portant la même étiquette sont électriquement connectés.'
      },
      HALF_ADDER: {
        name: 'Demi-additionneur',
        description:
          'Additionne deux nombres de 1 bit. S porte le bit de somme et C le bit de retenue.'
      },
      FULL_ADDER: {
        name: 'Additionneur complet',
        description:
          'Additionne trois nombres de 1 bit (deux opérandes et une retenue entrante). S porte le bit de somme et C le bit de retenue.'
      },
      ROM: {
        name: 'ROM',
        description:
          'Une mémoire morte (ROM) est un type de mémoire non volatile utilisée dans les ordinateurs et autres appareils électroniques. Les données stockées en ROM ne peuvent pas être modifiées électroniquement après la fabrication du dispositif de mémoire.',
        options: {
          wordSize: 'Taille de mot',
          addressSize: "Taille d'adresse",
          data: 'Modifier le contenu',
          dataEditorTitle: 'Modifier le contenu de la ROM'
        }
      },
      D_FF: {
        name: 'Bascule D',
        description:
          "Conserve un bit d'état. L'état présent sur D est enregistré sur le front montant de CLK ; Q porte l'état et !Q son inverse."
      },
      JK_FF: {
        name: 'Bascule JK',
        description:
          "Conserve un bit d'état. Sur le front montant de CLK, un J à HIGH met l'état à 1 et un K à HIGH le remet à 0 ; les deux à HIGH le basculent. Q porte l'état et !Q son inverse."
      },
      SR_FF: {
        name: 'Bascule SR',
        description:
          "Conserve un bit d'état. Sur le front montant de CLK, un S à HIGH met l'état à 1 et un R à HIGH le remet à 0. Q porte l'état et !Q son inverse."
      },
      RNG: {
        name: 'Générateur de nombres aléatoires',
        description:
          'Génère des données aléatoires sur ses sorties à chaque front montant de CLK.'
      },
      RAM: {
        name: 'RAM',
        description:
          "Mémoire vive. Sur le front montant de CLK, elle lit le mot adressé sur les sorties — ou, tant que WE est à HIGH, stocke à la place le mot présent sur les entrées de données à l'adresse courante.",
        options: {
          wordSize: 'Taille de mot',
          addressSize: "Taille d'adresse"
        }
      },
      DECODER: {
        name: 'Décodeur',
        description:
          "Décodeur binaire 1 parmi n. Active exactement la sortie dont l'index est égal à la valeur binaire présente sur les entrées."
      },
      ENCODER: {
        name: 'Encodeur',
        description:
          "Encodeur binaire 2^n vers n. Produit l'index binaire de l'entrée active la plus élevée."
      },
      MUX: {
        name: 'Multiplexeur',
        description:
          "Achemine vers l'unique sortie l'entrée de données désignée par les lignes de sélection.",
        options: {
          selectLines: 'Lignes de sélection'
        }
      },
      DEMUX: {
        name: 'Démultiplexeur',
        description:
          "Achemine l'entrée de données I vers la sortie désignée par les lignes de sélection.",
        options: {
          selectLines: 'Lignes de sélection'
        }
      },
      TEXT: {
        name: 'Texte',
        description:
          "Une annotation textuelle placée sur le canevas. Le point marque le point d'ancrage de l'étiquette.",
        options: {
          text: 'Modifier le texte',
          placeholder: 'Saisissez du texte...',
          fontSize: 'Taille de police'
        }
      },
      INPUT: {
        name: 'Entrée',
        description:
          "Une fiche d'entrée. Définit l'un des ports d'entrée d'un composant personnalisé ; son étiquette nomme le port et son ordre en détermine la position."
      },
      OUTPUT: {
        name: 'Sortie',
        description:
          "Une fiche de sortie. Définit l'un des ports de sortie d'un composant personnalisé ; son étiquette nomme le port et son ordre en détermine la position."
      },
      BUTTON: {
        name: 'Bouton',
        description:
          'Un bouton-poussoir momentané. Pendant que la simulation tourne, cliquer dessus émet une seule impulsion sur sa sortie.'
      },
      SWITCH: {
        name: 'Interrupteur',
        description:
          'Un interrupteur à verrouillage. Pendant que la simulation tourne, cliquer dessus bascule sa sortie entre activé et désactivé.'
      },
      LED: {
        name: 'LED',
        description:
          "S'allume tant que le fil connecté à son entrée est alimenté."
      },
      SEGMENT_DISPLAY: {
        name: 'Affichage à segments',
        description:
          "Affiche la valeur binaire présente sur ses entrées (l'entrée 0 est le bit de poids faible) sous forme de nombre dans la base configurée.",
        options: {
          base: 'Base'
        }
      },
      LED_MATRIX: {
        name: 'Matrice de LED',
        description:
          "Une grille carrée de LED qui affiche une image. Sur le front montant de CLK, les entrées de données sont verrouillées dans la ligne désignée par les entrées d'adresse.",
        options: {
          size: 'Largeur/Hauteur'
        }
      }
    },
    options: {
      direction: 'Direction',
      inputs: 'Entrées',
      outputs: 'Sorties',
      label: 'Étiquette',
      index: 'Index'
    }
  },
  sideBar: {
    title: 'Composants',
    search: 'Rechercher..',
    outdatedInstances:
      '{{count}} instance(s) placée(s) de ce composant ne sont plus à jour'
  },
  board: {
    panel: 'Plan de circuit'
  },
  tabBar: {
    mainProject: 'Projet principal',
    close: 'Fermer',
    landmark: 'Projets ouverts'
  },
  portsPanel: {
    title: 'Ports',
    badge: 'composant',
    inputs: 'Entrées',
    outputs: 'Sorties',
    noInputs: "Aucune fiche d'entrée",
    noOutputs: 'Aucune fiche de sortie',
    inputName: 'Entrée {{index}}',
    outputName: 'Sortie {{index}}',
    nameLabel: 'Nom de {{name}}, port {{position}}'
  },
  statusBar: {
    modes: {
      pan: 'Déplacement : faites glisser pour déplacer le plan de travail · molette ou pincement pour zoomer',
      wireTool:
        "Outil fil : faites glisser pour tracer · touchez un port pour l'inverser · touchez une jonction pour connecter/déconnecter",
      sel: 'Sélection : faites glisser un cadre pour sélectionner · faites glisser la sélection pour la déplacer · maintenez {{scissorKey}} pour couper les fils',
      selExact:
        'Sélection coupante : faites glisser un cadre pour sélectionner · les fils sont coupés à son bord',
      erase:
        'Gomme : cliquez ou faites glisser sur les éléments pour les supprimer',
      placeComp:
        'Placement de {{componentName}} : faites glisser pour positionner · Échap pour annuler',
      simulation:
        'Simulation : cliquez sur les boutons et interrupteurs · faites glisser pour vous déplacer'
    } satisfies Record<WorkMode, string>,
    saved: 'Enregistré',
    unsaved: 'Modifications non enregistrées',
    selected: 'Sélectionnés'
  },
  titleBar: {
    menuBar: {
      file: {
        label: 'Fichier',
        items: {
          newProject: {
            label: 'Nouveau projet'
          },
          newComponent: {
            label: 'Nouveau composant'
          },
          open: {
            label: 'Ouvrir'
          },
          save: {
            label: 'Enregistrer'
          },
          uploadCloud: {
            label: 'Téléverser vers le cloud'
          },
          share: {
            label: 'Partager'
          },
          cloneShare: {
            label: 'Cloner vers mes projets'
          },
          exportFile: {
            label: 'Exporter vers un fichier'
          },
          generateImage: {
            label: 'Générer une image'
          }
        }
      },
      edit: {
        label: 'Édition',
        items: {
          undo: {
            label: 'Annuler'
          },
          redo: {
            label: 'Rétablir'
          },
          cut: {
            label: 'Couper'
          },
          copy: {
            label: 'Copier'
          },
          paste: {
            label: 'Coller'
          },
          delete: {
            label: 'Supprimer'
          },
          repairWires: {
            label: 'Réparer les fils'
          }
        }
      },
      view: {
        label: 'Affichage',
        items: {
          zoomIn: {
            label: 'Zoom avant'
          },
          zoomOut: {
            label: 'Zoom arrière'
          },
          zoom100: {
            label: 'Zoom 100 %'
          }
        }
      },
      help: {
        label: 'Aide',
        items: {
          documentation: {
            label: 'Documentation'
          },
          changelog: {
            label: 'Nouveautés'
          },
          legacyEditor: {
            label: "Ouvrir l'ancien éditeur"
          },
          cookieSettings: {
            label: 'Paramètres des cookies'
          },
          about: {
            label: 'À propos'
          }
        }
      }
    },
    rename: {
      label: 'Renommer le projet',
      cancel: 'Annuler',
      error: 'Impossible de renommer le projet.'
    },
    fork: {
      label: 'Fork',
      title: 'Forké depuis {{lineage}}',
      lineageEntry: '{{name}} par {{author}}'
    }
  },
  discardChanges: {
    header: 'Abandonner les modifications ?',
    message:
      'Le projet actuel comporte des modifications non enregistrées qui seront perdues. Continuer quand même ?',
    accept: 'Abandonner',
    reject: 'Annuler'
  },
  changelogDialog: {
    header: 'Nouveautés',
    loading: 'Chargement des nouveautés…',
    loadError: 'Impossible de charger les nouveautés.',
    close: 'Fermer'
  },
  documentation: {
    header: 'Documentation',
    loading: 'Chargement de la page…',
    loadError: 'Impossible de charger cette page.',
    back: 'Tous les sujets',
    learnMore: 'En savoir plus',
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
  aboutDialog: {
    header: 'À propos de Logigator',
    tagline:
      'Un éditeur et simulateur de circuits logiques numériques open source.',
    version: 'Version',
    commit: 'Commit',
    buildDate: 'Date de compilation',
    license: 'Licence',
    licenseName: 'GNU AGPL v3',
    copyright: '© 2019–{{year}} Logigator',
    repository: 'Dépôt',
    privacyPolicy: 'Politique de confidentialité',
    imprint: 'Mentions légales',
    close: 'Fermer'
  },
  openProjectDialog: {
    title: 'Ouvrir un projet',
    localProjects: 'Projets locaux',
    cloudProjects: 'Projets cloud',
    fromFile: "À partir d'un fichier",
    notLoggedIn: 'Connectez-vous pour voir vos projets cloud',
    close: 'Fermer',
    loading: 'Chargement...',
    uploadPrompt: 'Ouvrez un fichier de circuit enregistré sur votre appareil.',
    chooseFile: 'Choisir un fichier',
    deleteProject: 'Supprimer le projet',
    renameProject: 'Renommer le projet',
    uploadProject: 'Téléverser vers le cloud',
    shareProject: 'Partager',
    cancelRename: 'Annuler',
    deleteConfirmMessage:
      'Voulez-vous vraiment supprimer « {{name}} » ? Cette action est irréversible.',
    deleteAccept: 'Supprimer',
    deleteReject: 'Annuler',
    searchPlaceholder: 'Rechercher des projets...',
    searchButton: 'Rechercher',
    noSearchResults: 'Aucun projet trouvé',
    lastEdited: 'Dernière modification',
    errors: {
      listLocal: 'Impossible de charger vos projets locaux.',
      openLocal: "Impossible d'ouvrir le projet local.",
      deleteLocal: 'Impossible de supprimer le projet local.',
      renameLocal: 'Impossible de renommer le projet local.',
      listCloud: 'Impossible de charger vos projets cloud.',
      openCloud: "Impossible d'ouvrir le projet cloud.",
      deleteCloud: 'Impossible de supprimer le projet cloud.',
      renameCloud: 'Impossible de renommer le projet cloud.',
      importFailed: "Impossible d'importer le fichier : {{detail}}",
      readFailed: 'Impossible de lire le fichier sélectionné.'
    }
  },
  saveProjectDialog: {
    name: 'Nom',
    destination: 'Destination',
    destinationCloud: 'Cloud',
    destinationLocal: 'Local',
    notLoggedIn:
      'Vous devez être connecté pour enregistrer des projets dans le cloud.',
    public: 'Public',
    publicInfo:
      'Les projets publics sont publiés sur votre profil et accessibles à tous via un lien de partage. Les projets privés ne sont visibles que par vous.',
    localWarning:
      "Les projets locaux ne sont pas conservés d'un appareil à l'autre et peuvent être perdus."
  },
  newComponentDialog: {
    name: 'Nom',
    symbol: 'Symbole',
    description: 'Description',
    store: 'Stockage',
    storeCloud: 'Cloud',
    storeLocal: 'Local',
    notLoggedIn:
      'Vous devez être connecté pour enregistrer des composants dans le cloud.',
    public: 'Public',
    publicInfo:
      'Les composants publics sont publiés sur votre profil et accessibles à tous via un lien de partage. Les composants privés ne sont visibles que par vous.',
    localWarning:
      "Les composants locaux ne sont pas conservés d'un appareil à l'autre et peuvent être perdus.",
    create: 'Créer'
  },
  uploadComponent: {
    button: 'Téléverser vers le cloud',
    signInTooltip: 'Connectez-vous pour téléverser vers le cloud'
  },
  shareDialog: {
    header: 'Partager le projet',
    headerComponent: 'Partager le composant',
    intro:
      'Toute personne disposant de ce lien peut ouvrir « {{name}} » en lecture seule et le cloner dans sa propre bibliothèque.',
    linkLabel: 'Lien de partage',
    copy: 'Copier le lien',
    linkCopied: 'Lien de partage copié dans le presse-papiers.',
    copyFailed: 'Impossible de copier le lien dans le presse-papiers.',
    regenerate: 'Régénérer le lien',
    regenerateWarning:
      "La régénération crée un nouveau lien et invalide définitivement le lien actuel — toute personne utilisant l'ancien lien perdra l'accès.",
    linkRegenerated: 'Un nouveau lien de partage a été généré.',
    regenerateFailed: 'Impossible de régénérer le lien de partage.',
    public: 'Public',
    publicInfoProject:
      'Les projets publics sont publiés sur votre profil et visibles par tous. Les projets privés ne sont accessibles que via le lien de partage.',
    publicInfoComponent:
      'Les composants publics sont publiés sur votre profil et visibles par tous. Les composants privés ne sont accessibles que via le lien de partage.',
    visibilityUpdated: 'Visibilité mise à jour.',
    visibilityFailed: 'Impossible de mettre à jour la visibilité.',
    close: 'Fermer'
  },
  shareComponent: {
    button: 'Partager'
  },
  deleteComponent: {
    button: 'Supprimer',
    confirmMessageLocal:
      'Supprimer « {{name}} » de votre bibliothèque ? Cette action est définitive. Les instances déjà placées restent sous forme de copies intégrées que vous pourrez restaurer plus tard.',
    confirmMessageCloud:
      'Supprimer « {{name}} » de votre bibliothèque cloud ? Cette action est définitive et son lien de partage cessera de fonctionner. Les instances déjà placées restent sous forme de copies intégrées que vous pourrez restaurer plus tard.',
    confirmAccept: 'Supprimer',
    confirmReject: 'Annuler',
    deleted: '« {{name}} » a été supprimé de votre bibliothèque.',
    deleteFailed: 'Impossible de supprimer le composant.'
  },
  uploadDialog: {
    header: 'Téléverser vers le cloud',
    introProject:
      "« {{name}} » est déplacé du stockage local vers votre bibliothèque cloud, afin que vous puissiez y accéder depuis n'importe quel appareil.",
    introComponent:
      "« {{name}} » est déplacé de votre bibliothèque locale vers votre bibliothèque cloud, afin que vous puissiez l'utiliser depuis n'importe quel appareil.",
    introDraft:
      '« {{name}} » intègre ces composants locaux. Ils seront téléversés dans votre bibliothèque cloud en même temps que lui.',
    depsTitle: 'Ces composants locaux seront également publiés',
    depsHint:
      "Un projet cloud ne peut contenir que des composants cloud ; chacun de ceux-ci est donc d'abord téléversé dans votre bibliothèque cloud puis référencé.",
    unresolvableWarning:
      '{{count}} composant(s) intégré(s) ne peuvent plus être publiés (leur entrée de bibliothèque a disparu) et resteront de simples copies intégrées.',
    public: 'Public',
    publicInfoProject:
      'Les projets publics sont publiés sur votre profil et accessibles à tous via un lien de partage. Les projets privés ne sont visibles que par vous.',
    publicInfoComponent:
      'Les composants publics sont publiés sur votre profil et accessibles à tous via un lien de partage. Les composants privés ne sont visibles que par vous.',
    notLoggedIn: 'Vous devez être connecté pour téléverser vers le cloud.',
    cancel: 'Annuler',
    upload: 'Téléverser',
    analyzeFailed:
      'Impossible de lire le circuit pour préparer le téléversement.',
    dependencyFailed:
      "Impossible de téléverser le composant « {{name}} ». Rien d'autre n'a été téléversé — réessayez.",
    uploadFailed: 'Impossible de téléverser « {{name}} » vers le cloud.'
  },
  closeTab: {
    header: 'Modifications non enregistrées',
    message:
      '« {{name}} » comporte des modifications non enregistrées. Les enregistrer avant de fermer ?',
    promotionWarning:
      "L'enregistrement publiera également {{count}} composant(s) local(aux) dans votre bibliothèque cloud.",
    save: 'Enregistrer',
    discard: 'Abandonner',
    cancel: 'Annuler'
  },
  sourceIndicator: {
    cloudTitle: 'Enregistré dans votre bibliothèque cloud',
    localTitle: 'Enregistré uniquement dans ce navigateur',
    draftTitle:
      'Pas encore enregistré — enregistrez-le dans le cloud ou localement',
    shareTitle: 'Ouvert depuis un lien de partage — lecture seule',
    label: {
      server: 'Cloud',
      browser: 'Local',
      draft: 'Brouillon',
      share: 'Partagé',
      embedded: 'Intégré'
    },
    title: {
      server: 'Enregistré dans votre bibliothèque cloud',
      browser: 'Enregistré uniquement dans ce navigateur',
      draft: 'Pas encore enregistré',
      share: 'Ouvert depuis un lien de partage',
      embedded:
        "Copie intégrée — son composant de bibliothèque n'est plus disponible"
    }
  },
  toolBar: {
    save: 'Enregistrer',
    open: 'Ouvrir',
    newComp: 'Nouveau composant',
    copy: 'Copier',
    cut: 'Couper',
    paste: 'Coller',
    delete: 'Supprimer',
    rotateCw: 'Rotation horaire',
    rotateCcw: 'Rotation antihoraire',
    undo: 'Annuler',
    redo: 'Rétablir',
    zoomOut: 'Zoom arrière',
    zoomIn: 'Zoom avant',
    pan: 'Déplacement',
    parts: 'Pièces',
    placeComponent: 'Placement du composant',

    wireTool: 'Outil fil',
    select: 'Sélectionner',
    selExact:
      'Couper les fils au bord de la sélection (maintenir pour activer)',
    selExactShort: 'Couper les fils',
    eraser: 'Gomme',
    text: 'Texte',
    startSim: 'Démarrer la simulation',
    exitSim: 'Quitter la simulation',
    play: 'Exécuter',
    pause: 'Pause',
    step: 'Pas à pas',
    stopSim: 'Arrêter',
    targetSpeed: 'Vitesse cible',
    targetUnit: 'Unité de vitesse cible',
    targetMode: 'Limiter à la vitesse cible',
    syncToFrame: "Synchroniser à l'image",
    measuredHz: '{{hz}} Hz',
    ticks: '{{ticks}} ticks'
  },
  mobile: {
    account: 'Compte',
    palette: 'Composants',
    settings: 'Paramètres',
    ports: 'Ports'
  },
  logging: {
    error: 'Erreur',
    warn: 'Avertissement',
    success: 'Succès',
    info: 'Info',
    debug: 'Débogage',
    unexpectedError:
      "Une erreur s'est produite. Certaines actions n'ont peut-être pas abouti — consultez la console du navigateur pour plus de détails."
  },
  clipboard: {
    clear: 'Vider le presse-papiers',
    pastePartial:
      "Certains éléments n'ont pas pu être collés — leur type de composant n'est plus disponible.",
    pastePlugsSkipped:
      "Les fiches d'entrée et de sortie n'ont pas été collées — elles ne sont prises en charge qu'à l'intérieur des composants personnalisés."
  },
  wireRepair: {
    repaired:
      "{{count}} problème(s) de fils réparé(s). Vérifiez que votre circuit fonctionne toujours comme prévu avant de l'enregistrer.",
    loadDetected:
      'Ce circuit comporte {{count}} problème(s) de fils, ce qui peut faire réagir les connexions de façon inattendue.',
    repairAction: 'Réparer les fils',
    clean: 'Aucun problème de fils détecté.'
  },
  bugReport: {
    title: 'Signaler un problème',
    badgeTooltip: 'Signaler un bug',
    intro:
      "Vous avez trouvé un bug ? Décrivez ce que vous faisiez au moment où il s'est produit — plus il y a de détails, plus il est facile à corriger.",
    errorIntro:
      "Une erreur inattendue s'est produite. Dites-nous ce que vous faisiez pour que nous puissions la localiser.",
    errorDetails: "Détails de l'erreur",
    legacyEditorNotice: 'Cela vous bloque ?',
    legacyEditorLink: "Ouvrir l'ancien éditeur",
    placeholder: "Que s'est-il passé ?",
    dataNotice:
      'Votre projet actuel, les détails de votre navigateur et votre activité récente sont joints pour nous aider à reproduire le problème.',
    send: 'Envoyer le rapport',
    cancel: 'Annuler',
    sent: 'Merci — votre rapport a été envoyé.',
    failed: "Impossible d'envoyer le rapport. Veuillez réessayer."
  },
  persistence: {
    projectSaved: 'Projet enregistré.',
    projectSavedLocal: 'Projet enregistré dans le stockage local.',
    componentSaved: 'Composant enregistré.',
    componentSavedLocal: 'Composant enregistré dans le stockage local.',
    componentUploaded: 'Composant téléversé dans votre bibliothèque cloud.',
    projectUploaded: 'Projet téléversé dans votre bibliothèque cloud.',
    projectCreated: 'Projet créé.',
    projectExported: 'Projet exporté vers un fichier.',
    exportFailed: "Impossible d'exporter le projet vers un fichier.",
    localSaveFailed:
      "Impossible d'enregistrer le projet dans le stockage local.",
    localComponentSaveFailed:
      "Impossible d'enregistrer le composant dans le stockage local.",
    saveFailed: "Impossible d'enregistrer : {{detail}}",
    saveFailedGeneric: "Impossible d'enregistrer le projet.",
    createFailed: 'Impossible de créer le projet : {{detail}}',
    versionMismatch:
      "Ce projet a changé ailleurs — rechargez-le avant de l'enregistrer à nouveau.",
    loadFailed: 'Impossible de charger le projet.',
    componentLoadFailed: 'Impossible de charger le composant.',
    shareLoadFailed: 'Impossible de charger le projet partagé.',
    shareAuthRequired:
      'Connectez-vous pour ajouter ce projet partagé à votre bibliothèque cloud.',
    shareCloned: 'Projet partagé cloné dans vos projets cloud.',
    shareCloneFailed: 'Impossible de cloner le projet partagé.',
    dumpElementCountChanged:
      "Le nombre d'éléments du vidage de projet a changé au chargement — les identifiants et l'historique des actions n'ont pas été restaurés.",
    skippedCustomOne:
      "Un composant personnalisé n'a pas pu être chargé — sa définition est manquante — et a été ignoré.",
    skippedCustomMany:
      "{{count}} composants personnalisés n'ont pas pu être chargés — leurs définitions sont manquantes — et ont été ignorés."
  },
  editor: {
    rendererInitFailed:
      "Impossible de démarrer le moteur de rendu graphique. Votre navigateur ou votre GPU n'est peut-être pas pris en charge.",
    fontLoadFailed:
      "Échec du chargement des polices de l'éditeur — certaines étiquettes peuvent s'afficher incorrectement.",
    eraseRestoreFailed:
      "Certains composants effacés n'ont pas pu être restaurés.",
    circularDependency:
      'Impossible de placer ce composant ici — cela créerait une dépendance circulaire.'
  },
  simulation: {
    workerMessageUnreadable:
      'Le worker de simulation a envoyé un message illisible. Simulation arrêtée.',
    engineInitFailed:
      'Impossible de démarrer le moteur de simulation. Votre navigateur ne prend peut-être pas en charge WebAssembly.',
    workerCrashed: "La simulation s'est arrêtée de façon inattendue.",
    unsupportedComponent:
      "Le composant « {{symbol}} » n'est pas pris en charge par le simulateur.",
    recursiveComponent:
      'Le composant personnalisé « {{name}} » se place lui-même de manière récursive.',
    componentNoCircuit:
      "Le composant personnalisé « {{name}} » n'a aucun circuit à simuler.",
    plugMismatch:
      'Le composant personnalisé « {{name}} » déclare {{declaredInputs}}/{{declaredOutputs}} ports mais son circuit possède {{actualInputs}}/{{actualOutputs}} fiches.'
  },
  watch: {
    rendererFailed:
      "Impossible d'ouvrir la vue de surveillance — le moteur de rendu n'a pas pu démarrer.",
    noInnerCircuit: "Ce composant n'a aucun circuit interne à inspecter.",
    circuitMismatch:
      "Le circuit interne ne correspond pas à la simulation compilée — redémarrez la simulation pour l'inspecter."
  },
  componentActions: {
    edit: 'Modifier le circuit',
    update: 'Mettre à jour vers la dernière version',
    updateAll: 'Mettre à jour toutes les instances ({{count}})',
    createFailed: 'Impossible de créer le composant.',
    openFailed: "Impossible d'ouvrir le composant.",
    cloudLoadFailed: 'Impossible de charger le composant depuis le cloud.',
    view: 'Voir le contenu',
    viewTooltip:
      "Ouvre ce composant en lecture seule. Il appartient au circuit partagé : rien n'est ajouté à votre bibliothèque — clonez le partage pour en garder une copie.",
    restore: 'Restaurer et modifier',
    restoreTooltip:
      'Le composant maître de ce composant dans la bibliothèque a disparu, mais son circuit est intégré. Restaurez-le dans votre bibliothèque locale pour le modifier.',
    restored: 'Composant restauré dans votre bibliothèque locale.',
    restoreFailed: 'Impossible de restaurer ce composant.',
    signInToEdit: 'Connectez-vous pour modifier',
    signInTooltip:
      'Ce composant se trouve dans votre bibliothèque cloud. Connectez-vous pour le charger et le modifier.'
  },
  editComponentDetails: {
    button: 'Modifier les détails',
    header: 'Modifier les détails du composant',
    name: 'Nom',
    symbol: 'Symbole',
    description: 'Description',
    frozenInstancesHint:
      'Les instances déjà placées conservent leurs détails actuels ; utilisez « Mettre à jour vers la dernière version » sur une instance sélectionnée pour les appliquer.',
    save: 'Enregistrer',
    saved: 'Détails du composant mis à jour.',
    saveFailed: 'Impossible de mettre à jour les détails du composant.'
  },
  library: {
    loadFailed: "Certains composants enregistrés n'ont pas pu être chargés."
  },
  logoutDialog: {
    header: 'Modifications non enregistrées',
    message:
      'Ces documents cloud comportent des modifications non enregistrées. Les enregistrer avant de vous déconnecter ?',
    promotionWarning:
      "L'enregistrement publiera également {{count}} composant(s) local(aux) dans votre bibliothèque cloud.",
    save: 'Enregistrer et se déconnecter',
    discard: 'Se déconnecter sans enregistrer',
    cancel: 'Annuler',
    edited: 'Modifié {{relative}}'
  },
  session: {
    loggedOut: 'Déconnecté.',
    logoutFailed: 'La déconnexion a échoué. Veuillez réessayer.',
    saveLoggedOut:
      'Vous êtes déconnecté. Reconnectez-vous pour enregistrer dans le cloud.',
    saveForeign:
      '« {{name}} » appartient à un autre compte et ne peut pas être enregistré.'
  },
  routing: {
    notFound: "Ce lien n'a pas pu être ouvert."
  },
  imageExport: {
    title: 'Exporter une image',
    project: 'Projet',
    format: 'Format',
    resolution: 'Résolution',
    background: 'Arrière-plan',
    backgroundHint: 'Couleur du thème et grille',
    quality: 'Qualité',
    dimensions: '{{width}} × {{height}} px',
    clampedHint: "(réduit pour respecter les limites de l'appareil)",
    export: 'Exporter',
    cancel: 'Annuler',
    success: 'Image exportée.',
    error: {
      unavailable:
        "L'éditeur n'est pas encore prêt. Réessayez dans un instant.",
      failed: "Échec de l'export de l'image."
    },
    warn: {
      clamped:
        "Résolution réduite pour respecter les limites de l'appareil ; exportée en {{width}} × {{height}} px."
    }
  },
  shortcuts: {
    title: 'Raccourcis clavier',
    actions: {
      save: 'Enregistrer',
      open: 'Ouvrir',
      newComponent: 'Nouveau composant',
      undo: 'Annuler',
      redo: 'Rétablir',
      copy: 'Copier',
      cut: 'Couper',
      paste: 'Coller',
      delete: 'Supprimer',
      rotateSelection: 'Rotation horaire',
      rotateSelectionCcw: 'Rotation antihoraire',
      moveSelectionUp: 'Déplacer la sélection vers le haut',
      moveSelectionDown: 'Déplacer la sélection vers le bas',
      moveSelectionLeft: 'Déplacer la sélection vers la gauche',
      moveSelectionRight: 'Déplacer la sélection vers la droite',
      zoomIn: 'Zoom avant',
      zoomOut: 'Zoom arrière',
      zoom100: 'Zoom 100 %',
      toolPan: 'Déplacement',
      toolWire: 'Outil fil',
      toolSelect: 'Sélectionner',
      selectScissor: 'Couper les fils au bord de la sélection (maintenir)',
      toolErase: 'Effacer',
      toolPlaceText: 'Placer du texte',
      toggleSimulation: 'Démarrer/Arrêter la simulation',
      cancel: 'Annuler'
    } satisfies Record<ShortcutActionEnum, string>,
    groups: {
      fileOps: 'Fichier',
      editOps: 'Édition',
      viewOps: 'Affichage',
      tools: 'Outils',
      interaction: 'Interaction'
    },
    manager: {
      resetAll: 'Tout réinitialiser',
      reset: 'Réinitialiser',
      unassign: 'Désassigner',
      edit: 'Modifier le raccourci',
      cancelRecording: 'Annuler l’enregistrement',
      recordPrompt: 'Appuyez sur des touches…'
    },
    toast: {
      reassignedFrom: 'Raccourci désassigné de « {{action}} »',
      loadFailed:
        'Impossible de charger les raccourcis configurés, retour aux valeurs par défaut.'
    }
  },
  onboarding: {
    settings: {
      showTips: "Afficher les conseils d'intégration"
    },
    menu: {
      showTipsAgain: 'Afficher à nouveau les conseils'
    },
    nudge: {
      text: 'Nouveau ici ? Construisez votre premier circuit dans un tutoriel rapide.',
      start: 'Démarrer le tutoriel',
      dismiss: 'Ignorer'
    },
    toast: {
      tipsReset: "Les conseils d'intégration sont réactivés."
    },
    bubble: {
      next: 'Suivant',
      finish: 'Terminer',
      skip: 'Ignorer le tutoriel',
      turnOff: 'Désactiver tous les conseils'
    },
    hints: {
      dismiss: 'Ignorer',
      wireTapActions:
        "Faites glisser pour tracer des fils. <strong>Touchez un port</strong> pour ajouter ou retirer une bulle d'inversion, ou touchez un croisement pour connecter ou séparer les fils.",
      scissorSelectDesktop:
        "La sélection coupante coupe les fils au bord du cadre. Maintenez <strong>Alt</strong> pour l'activer pendant une sélection par cadre.",
      scissorSelectCompact:
        'La sélection coupante coupe les fils au bord du cadre.',
      eraser: "Faites glisser sur n'importe quel élément pour le supprimer.",
      simControls:
        "L'édition est verrouillée pendant l'exécution. Utilisez ces contrôles pour mettre en pause, avancer pas à pas et régler la vitesse — les boutons et interrupteurs restent cliquables.",
      selectionActions:
        'Faites pivoter la sélection avec ces boutons — ou appuyez sur <strong>R</strong> / <strong>Shift+R</strong>. Déplacez-la avec les <strong>touches fléchées</strong>.',
      pastePlacementDesktop:
        'Les éléments collés apparaissent comme un fantôme — faites-les glisser vers un emplacement libre et relâchez pour les déposer, ou appuyez sur Échap pour annuler.',
      pastePlacementCompact:
        'Les éléments collés apparaissent comme un fantôme — faites-les glisser vers un emplacement libre et levez le doigt pour les déposer, ou touchez ailleurs pour annuler.',
      portsPanelDesktop:
        "Les fiches de ce composant vivent ici : placez <strong>Entrée</strong> et <strong>Sortie</strong> depuis ce panneau, puis faites glisser les lignes pour définir l'ordre des ports et saisissez leurs noms.",
      portsPanelCompact:
        "Les fiches de ce composant vivent là-dedans : placez <strong>Entrée</strong> et <strong>Sortie</strong> depuis ce panneau, puis faites glisser les lignes pour définir l'ordre des ports et saisissez leurs noms.",
      panZoomCompact:
        "Faites glisser avec deux doigts pour vous déplacer, pincez pour zoomer. Un seul doigt ne déplace la vue qu'en mode déplacement."
    },
    tutorials: {
      gettingStarted: {
        steps: {
          welcome: {
            title: 'Bienvenue sur Logigator',
            text: 'Construisons un circuit fonctionnel en une minute environ. Vous pouvez ignorer à tout moment.'
          },
          moveAround: {
            title: 'Se déplacer',
            textDesktop:
              'Faites défiler pour zoomer, faites glisser avec le bouton droit pour vous déplacer.',
            textCompact:
              'Pincez pour zoomer, faites glisser avec deux doigts pour vous déplacer.'
          },
          placeAnd: {
            title: 'Placer une porte ET',
            textDesktop:
              'Trouvez <strong>ET</strong> dans la liste des composants à gauche, puis cliquez sur le canevas pour la déposer.',
            textCompact:
              'Touchez <strong>+</strong> pour ouvrir vos blocs de construction, choisissez <strong>ET</strong>, puis touchez le canevas pour la déposer.',
            nudge:
              "Ce n'est pas une porte ET — choisissez <strong>ET</strong> pour celle-ci (vous pouvez retirer des pièces avec la gomme)."
          },
          addSwitches: {
            title: 'Ajouter deux interrupteurs',
            textDesktop:
              'Placez maintenant deux entrées <strong>interrupteur</strong> à gauche de la porte. ({{placed}} sur {{total}} placés)',
            textCompact:
              'Touchez <strong>+</strong>, choisissez un <strong>interrupteur</strong>, puis touchez le canevas — placez-en deux à gauche de la porte. ({{placed}} sur {{total}} placés)'
          },
          addLed: {
            title: 'Ajouter une LED',
            textDesktop:
              "Placez une <strong>LED</strong> à droite — c'est votre sortie.",
            textCompact:
              "Touchez <strong>+</strong>, choisissez la <strong>LED</strong>, puis touchez à droite de la porte — c'est votre sortie."
          },
          wireUp: {
            title: 'Câbler le circuit',
            text: "Passez à l'<strong>outil fil</strong> et faites glisser de chaque interrupteur vers les entrées de la porte, puis de la sortie de la porte vers la LED."
          },
          startSim: {
            title: 'Démarrer la simulation',
            text: "Appuyez sur <strong>Démarrer</strong> pour alimenter votre circuit. L'édition est verrouillée pendant l'exécution."
          },
          flipSwitch: {
            title: 'Actionner un interrupteur',
            textDesktop:
              "Cliquez sur un interrupteur pour le basculer. Activez-les <strong>tous les deux</strong> et regardez la LED s'allumer.",
            textCompact:
              "Touchez un interrupteur pour le basculer. Activez-les <strong>tous les deux</strong> et regardez la LED s'allumer."
          },
          complete: {
            title: 'Tout est prêt !',
            textDesktop:
              "Vous avez construit une porte ET fonctionnelle et allumé la LED — bien joué !<br>À partir d'ici, personnalisez : ajoutez d'autres composants, câblez des circuits plus grands, et enregistrez votre travail quand il vous plaît.<br><br>Besoin d'aide plus tard ? Le menu <strong>Aide</strong> propose à nouveau ce tutoriel, les Nouveautés, et bien plus. Amusez-vous bien !",
            textCompact:
              "Vous avez construit une porte ET fonctionnelle et allumé la LED — bien joué !<br>À partir d'ici, personnalisez : ajoutez d'autres composants, câblez des circuits plus grands, et enregistrez votre travail quand il vous plaît.<br><br>Besoin d'aide plus tard ? Ouvrez le <strong>menu</strong> pour retrouver ce tutoriel, les Nouveautés, et bien plus. Amusez-vous bien !"
          }
        }
      }
    }
  }
};

export default fr;
