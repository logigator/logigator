import { ILanguage } from './index';

export const fr: ILanguage = {
	'COOKIE_CONSENT': {
		'MESSAGE': 'Ce site web utilise des cookies pour garantir la meilleure expérience utilisateur possible.',
		'DISMISS': 'J\'ai compris !',
		'LINK': 'En savoir plus'
	},
	'TITLE': {
		'HOME': 'Logigator - Construisez et simulez des circuits logiques',
		'PRIVACY_POLICY': 'Logigator - Politique de confidentialité',
		'IMPRINT': 'Logigator - Mentions légales',
		'FEATURES': 'Logigator - Fonctionnalités',
		'DOWNLOAD': 'Logigator - Télécharger',
		'VERIFY_EMAIL': 'Logigator - Vérifier l\'email',
		'PROJECTS': 'Logigator - Projets',
		'COMPONENTS': 'Logigator - Composants',
		'ACCOUNT': 'Logigator - Compte',
		'ACCOUNT_PROFILE': 'Logigator - Profil',
		'ACCOUNT_SECURITY': 'Logigator - Sécurité',
		'ACCOUNT_DELETE': 'Logigator - Supprimer le compte',
		'LOGIN': 'Logigator - Connexion',
		'REGISTER': 'Logigator - S\'inscrire',
		'EXAMPLES': 'Logigator - Exemples',
		'COMMUNITY': 'Logigator - Communauté',
		'RESET_PASSWORD': 'Logigator - Réinitialiser le mot de passe'
	},
	'SITE_HEADER': {
		'DOWNLOAD': 'Télécharger',
		'FEATURES': 'Fonctionnalités',
		'PROJECTS': 'Mes Projets',
		'COMPONENTS': 'Mes Composants',
		'COMMUNITY': 'Communauté',
		'LOGIN': 'Connexion',
		'REGISTER': 'S\'inscrire'
	},
	'SETTINGS_DROPDOWN': {
		'DARK_MODE': 'Mode Sombre',
		'LANGUAGE': 'Langue',
		'PROJECTS': 'Projets',
		'COMPONENTS': 'Composants',
		'ACCOUNT': 'Compte',
		'LOGOUT': 'Déconnexion'
	},
	'FOOTER': {
		'DATA_POLICY': 'Politique de données',
		'IMPRINT': 'Mentions légales',
		'CONTRIBUTING': 'Contributions'
	},
	'HOME': {
		'INTRO': {
			'DESCRIPTION': 'Construisez, simulez et gérez des circuits logiques complexes gratuitement.',
			'BUTTON': 'Commencez à construire maintenant'
		},
		'FEATURES': {
			'TITLE': 'Fonctionnalités',
			'DESCRIPTION': 'Construisez et simulez vos propres circuits avec Logigator, un outil en ligne simple mais puissant.',
			'PERFORMANCE': 'Performance',
			'PERFORMANCE_DES': "L'éditeur de Logigator peut gérer même les plus grands projets facilement grâce à WebAssembly et WebGL.",
			'SUBCIRCUITS': 'Sous-circuits',
			'SUBCIRCUITS_DES': 'Créez des sous-circuits et utilisez-les partout dans vos projets pour les garder organisés.',
			'SHARE': 'Partager des Projets',
			'SHARE_DES': 'Partagez vos circuits avec d\'autres utilisateurs, afin qu\'ils puissent apprendre de votre travail.',
			'IMAGES': 'Exporter des Images',
			'IMAGES_DES': 'Avec Logigator, vous pouvez exporter des images haute résolution dans trois formats différents (SVG, PNG, JPG) pour les utiliser n\'importe où.'
		},
		'EXAMPLES': {
			'TITLE': 'Circuits Exemples',
			'DESCRIPTION': 'Apprenez à concevoir des circuits simples et plus complexes à partir de nos exemples.',
			'MORE': 'Voir Plus d\'Exemples'
		},
		'VIDEO': {
			'TITLE': 'Quels sont les circuits logiques ?',
			'DESCRIPTION': 'Si vous ne savez pas ce que sont les portes logiques ou les circuits logiques, nous avons animé une brève explication pour que vous puissiez regarder.'
		},
		'SHARES': {
			'PROJECTS_TITLE': 'Projets Communautaires',
			'PROJECTS_DESCRIPTION': 'Explorez d\'autres projets créés par notre communauté. Votre projet pourrait être le prochain sur cette liste.',
			'COMPS_TITLE': 'Composants Communautaires',
			'COMPS_DESCRIPTION': 'Explorez d\'autres composants créés par notre communauté. Ils peuvent être utiles pour vous.',
			'MORE_PROJECTS': 'Voir Plus de Projets',
			'MORE_COMPONENTS': 'Voir Plus de Composants'
		},
		'PROJECT_TEASERS': {
			'VIEW': 'Voir'
		}
	},
	'EXAMPLES': {
		'VIEW': 'Voir l\'Exemple',
		'CLONE': 'Cloner l\'Exemple'
	},
	'FEATURES': {
		'WHAT_IS': {
			'TITLE': 'Qu\'est-ce que Logigator',
			'VIDEO': 'weTeJLMGq_Q',
			'TEXT': 'Logigator est un simulateur en ligne de portes logiques qui permet à l\'utilisateur de construire et de simuler des circuits avec des portes logiques. Par exemple, on peut construire des demi-additionneurs et des additonneurs complets qui peuvent être utilisés pour apprendre. Que l\'on veuille expérimenter et explorer les fonctions booléennes ou concevoir de nouveaux circuits complexes, Logigator est l\'outil idéal. <br> De plus, Logigator offre des performances élevées même avec des projets à grande échelle. En utilisant "WebAssembly" (https://webassembly.org/), le site web peut atteindre des vitesses de simulation qui ne seraient pas possibles dans un navigateur autrement.'
		},
		'GENERAL': {
			'TITLE': 'Général',
			'VIDEO': 'tX7HT_0MZRo',
			'TEXT': "L'éditeur est accessible sous https://logigator.com/editor et peut être utilisé pour concevoir et simuler des circuits. <br> Pour placer un élément, il suffit de sélectionner l'élément souhaité dans le kit de construction situé sur le côté gauche de la fenêtre. Les portes de base sont: AND, OR, XOR, NOT ainsi qu'un retard qui ne change pas le signal d'entrée et une horloge, qui émet un signal à intervalles périodiques. Naturellement, il existe également des éléments plus complexes qui ne sont pas mentionnés ici. Après avoir sélectionné un élément, il peut être placé en cliquant n'importe où sur le canevas. En utilisant l'outil de sélection, on peut sélectionner un élément et modifier les paramètres dans la boîte située dans le coin inférieur droit. Ces paramètres varient d'un composant à l'autre. L'outil de câblage peut ensuite être utilisé pour connecter les éléments."
		},
		'CUSTOM_COMPS': {
			'TITLE': 'Composants Personnalisés',
			'VIDEO': 'fSErH93I-Wg',
			'TEXT': 'On peut vouloir utiliser une partie d\'un circuit plusieurs fois. Pour simplifier ce processus, il est possible de définir des composants personnalisés, qui peuvent facilement être placés plusieurs fois et peuvent même être utilisés dans d\'autres projets. <br> Il existe deux types de composants de fiche: entrées et sorties. En plaçant ces composants, on peut marquer les entrées et les sorties d\'un composant personnalisé. De plus, des parties de circuits peuvent être étiquetées pour une meilleure vue d\'ensemble.'
		},
		'SIMULATION': {
			'TITLE': 'Mode Simulation',
			'VIDEO': 'WjpChcxn18k',
			'TEXT': "Le mode simulation peut être utilisé pour tester et simuler des circuits. Pour passer en mode simulation, il suffit de cliquer sur le bouton «Démarrer la simulation». Pour démarrer la simulation, appuyez simplement sur le bouton de lecture. Vous pouvez maintenant interagir avec le circuit. Au cas où vous voudriez voir ce que le circuit fait, vous pouvez mettre la simulation en pause et la tester pas à pas. Pour revenir à l'état initial, appuyez simplement sur le bouton d'arrêt. Par défaut, la simulation fonctionnera aussi rapidement que possible. Cependant, la vitesse d'horloge peut être modifiée en entrant simplement la vitesse souhaitée ou en la verrouillant à la fréquence d'affichage. La composition des composants personnalisés peut être observée en cliquant simplement dessus."
		},
		'SAVING': {
			'TITLE': 'Enregistrement des Projets',
			'VIDEO': 'VtS4E0L2MyU',
			'TEXT': 'Les Projets et les Composants peuvent être enregistrés localement sous forme de fichier ou dans le cloud, ce qui permet de les modifier sur plusieurs appareils. Pour enregistrer des projets en ligne, l\'utilisateur doit être connecté, ce qui permet également de partager des projets avec d\'autres utilisateurs.'
		}
	},
	'LOGIN_FORM': {
		'HEADLINE': 'Connectez-vous ici',
		'EMAIL': 'Email',
		'EMAIL_ERR_REQUIRED': 'L\'email est requis.',
		'EMAIL_ERR_INVALID': 'Veuillez saisir une adresse email valide.',
		'EMAIL_ERR_NO_USER': 'L\'email n\'existe pas.',
		'EMAIL_ERR_NOT_VERIFIED': 'L\'adresse email n\'est pas vérifiée.',
		'PASSWORD': 'Mot de passe',
		'PASSWORD_ERR_REQUIRED': 'Le mot de passe est requis.',
		'PASSWORD_ERR_INVALID': 'Le mot de passe est invalide.',
		'ERR_EMAIL_TAKEN': 'L\'email est déjà enregistré',
		'ERR_VERIFICATION_MAIL': 'Le mail de vérification n\'a pas pu être envoyé.',
		'ERR_UNKNOWN': 'Une erreur inconnue s\'est produite.',
		'LOGIN_BUTTON': 'CONNEXION',
		'RESEND_BUTTON': 'Renvoyer le mail de vérification',
		'OR': 'ou',
		'FORGOT_PASSWORD': 'Mot de passe oublié ?'
	},
	'RESET_PASSWORD_FORM': {
		'HEADLINE': 'Réinitialisez votre mot de passe',
		'PASSWORD': 'Mot de passe',
		'PASSWORD_ERR_REQUIRED': 'Le mot de passe est requis.',
		'PASSWORD_ERR_MIN': 'Le mot de passe doit contenir un minimum de huit caractères.',
		'PASSWORD_ERR_COMPLEXITY': 'Le mot de passe doit contenir des lettres et des chiffres.',
		'PASSWORD_REPEAT': 'Répéter le mot de passe',
		'PASSWORD_REPEAT_ERR_REQUIRED': 'Le mot de passe doit être répété.',
		'PASSWORD_REPEAT_ERR': 'Les mots de passe ne correspondent pas.',
		'SUBMIT': 'RÉINITIALISER LE MOT DE PASSE',
		'ERR_TOKEN_INVALID': 'Le jeton de réinitialisation du mot de passe est invalide ou a expiré.',
		'ERR_UNKNOWN': 'Une erreur inconnue s\'est produite.'
	},
	'REQUEST_PASSWORD_RESET_FORM': {
		'HEADLINE': 'Réinitialiser le mot de passe',
		'EMAIL': 'Email',
		'EMAIL_ERR_REQUIRED': 'L\'email est requis.',
		'EMAIL_ERR_INVALID': 'Veuillez saisir une adresse email valide.',
		'EMAIL_ERR_NO_USER': 'L\'email n\'existe pas.',
		'SUBMIT': 'RÉINITIALISER LE MOT DE PASSE',
		'ERR_RESET_MAIL': 'Le mail de réinitialisation n\'a pas pu être envoyé.',
		'ERR_UNKNOWN': 'Une erreur inconnue s\'est produite.'
	},
	'REGISTER_FORM': {
		'HEADLINE': 'Inscrivez-vous ici',
		'EMAIL': 'Email',
		'EMAIL_ERR_REQUIRED': 'L\'email est requis.',
		'EMAIL_ERR_INVALID': 'Veuillez saisir une adresse email valide.',
		'EMAIL_ERR_TAKEN': 'L\'email est déjà enregistré',
		'USERNAME': 'Nom d\'utilisateur',
		'USERNAME_ERR_REQUIRED': 'Le nom d\'utilisateur est requis.',
		'USERNAME_ERR_MIN': 'Le nom d\'utilisateur doit contenir un minimum de deux caractères.',
		'USERNAME_ERR_MAX': 'Le nom d\'utilisateur ne peut contenir qu\'un maximum de 20 caractères.',
		'USERNAME_ERR_PATTERN': 'Le nom d\'utilisateur ne peut contenir que a-z, A-Z, 0-9, _ ou -',
		'PASSWORD': 'Mot de passe',
		'PASSWORD_ERR_REQUIRED': 'Le mot de passe est requis.',
		'PASSWORD_ERR_MIN': 'Le mot de passe doit contenir un minimum de huit caractères.',
		'PASSWORD_ERR_COMPLEXITY': 'Le mot de passe doit contenir des lettres et des chiffres.',
		'PASSWORD_REPEAT': 'Répéter le mot de passe',
		'PASSWORD_REPEAT_ERR_REQUIRED': 'Le mot de passe doit être répété.',
		'PASSWORD_REPEAT_ERR': 'Les mots de passe ne correspondent pas.',
		'PRIVACY_POLICY': 'En cliquant sur "S\'INSCRIRE", vous acceptez d\'avoir lu et accepté notre politique de données.',
		'REGISTER_BUTTON': 'S\'INSCRIRE',
		'OR': 'ou',
		'ERR_EMAIL_TAKEN': 'L\'email est déjà enregistré',
		'ERR_VERIFICATION_MAIL': 'Le mail de vérification n\'a pas pu être envoyé, réessayez lors de la connexion.',
		'ERR_UNKNOWN': 'Une erreur inconnue s\'est produite.'
	},
	'COMMUNITY': {
		'NAV': {
			'PROJECTS': 'Projets',
			'COMPONENTS': 'Composants'
		},
		'LATEST': 'Derniers',
		'POPULARITY': 'Popularité',
		'SEARCH': 'Rechercher',
		'COMPONENTS': 'Composants Partagés',
		'PROJECTS': 'Projets Partagés',
		'VIEW': 'Voir Détails',
		'OPEN': 'Ouvrir dans l\'éditeur',
		'CLONE': 'Cloner',
		'NO_DESCRIPTION': 'Aucune description n\'a été fournie.',
		'USER': {
			'MEMBER_SINCE': 'Membre depuis',
			'COMPONENTS': 'Composants',
			'PROJECTS': 'Projets',
			'STARED_COMPONENTS': 'Composants Favoris',
			'STARED_PROJECTS': 'Projets Favoris',
			'NO_ITEMS': 'Rien à afficher dans cette catégorie.'
		}
	},
	'USERSPACE': {
		'NAV': {
			'PROJECTS': 'Projets',
			'COMPONENTS': 'Composants',
			'ACCOUNT': 'Compte'
		},
		'LIST': {
			'SEARCH': 'Rechercher',
			'LAST_EDITED': 'Dernière modification: '
		},
		'PROJECTS': {
			'TITLE': 'Mes projets',
			'ERROR': "Vous n'avez pas encore défini de projets."
		},
		'COMPONENTS': {
			'TITLE': 'Mes composants',
			'ERROR': "Vous n'avez pas encore défini de composants."
		},
		'ACCOUNT': {
			'NAV': {
				'PROFILE': 'Profil',
				'SECURITY': 'Sécurité',
				'DELETE': 'Supprimer le compte'
			},
			'PROFILE': {
				'DELETE_IMAGE': 'Supprimer l\'image',
				'CHANGE_IMAGE': 'Changer l\'image',
				'EMAIL': 'Email',
				'EMAIL_ERR_REQUIRED': 'L\'email est requis.',
				'EMAIL_ERR_INVALID': 'Veuillez saisir une adresse email valide.',
				'EMAIL_ERR_TAKEN': 'L\'email a déjà été pris.',
				'EMAIL_ERR_CHANGE': 'C\'est votre email actuel.',
				'USERNAME': 'Nom d\'utilisateur',
				'USERNAME_ERR_REQUIRED': 'Le nom d\'utilisateur est requis.',
				'USERNAME_ERR_MIN': 'Le nom d\'utilisateur doit contenir un minimum de deux caractères.',
				'USERNAME_ERR_MAX': 'Le nom d\'utilisateur peut contenir un maximum de 20 caractères.',
				'USERNAME_ERR_CHANGE': 'C\'est votre Nom d\'utilisateur actuel.',
				'SAVE': 'Sauvegarder'
			},
			'SECURITY': {
				'CONNECTED_ACCOUNTS': 'Comptes Connectés',
				'CONNECT_NOW': 'Connectez-vous maintenant',
				'CONNECTED': 'Connecté',
				'PASSWORD_EXPLANATION': 'Vous pouvez ajouter un mot de passe à votre compte pour pouvoir l\'utiliser pour vous connecter. Votre compte restera connecté à tous les autres comptes de médias sociaux.',
				'CURRENT_PASSWORD': 'Mot de passe actuel',
				'CURRENT_PASSWORD_ERR_REQUIRED': 'Le mot de passe actuel est requis.',
				'CURRENT_PASSWORD_ERR_INVALID': 'Le mot de passe est invalide.',
				'PASSWORD': 'Mot de passe',
				'PASSWORD_ERR_REQUIRED': 'Le mot de passe est requis.',
				'PASSWORD_ERR_MIN': 'Le mot de passe doit contenir un minimum de huit caractères.',
				'PASSWORD_ERR_COMPLEXITY': 'Le mot de passe doit contenir des lettres et des chiffres.',
				'PASSWORD_REPEAT': 'Répéter le mot de passe',
				'PASSWORD_REPEAT_ERR_REQUIRED': 'Le mot de passe doit être répété.',
				'PASSWORD_REPEAT_ERR': 'Les mots de passe ne correspondent pas.',
				'ERR_UNKNOWN': 'Une erreur inconnue s\'est produite',
				'SAVE': 'Sauvegarder'
			},
			'DELETE': {
				'HEADLINE': 'Supprimer le compte',
				'MESSAGE': 'Si vous supprimez votre compte, tous vos projets et composants seront supprimés. Il n\'est pas possible de récupérer des données après la suppression.',
				'BUTTON': 'Supprimer le compte'
			}
		}
	},
	'YOUTUBE_OVERLAY': {
		'CTA': 'Cliquez pour regarder la vidéo'
	},
	'POPUP': {
		'LOGIN': {
			'TITLE': 'Connexion'
		},
		'REGISTER': {
			'TITLE': 'S\'inscrire'
		},
		'PROJECT_COMP_CREATE': {
			'COMP_TITLE': 'Nouveau composant',
			'PROJECT_TITLE': 'Nouveau projet',
			'NAME': 'Nom',
			'NAME_ERR_REQUIRED': 'Le nom est requis.',
			'NAME_ERR_MAX': 'Le nom peut contenir au maximum 20 caractères.',
			'DESCRIPTION': 'Description',
			'DESCRIPTION_ERR_MAX': 'La description est trop longue.',
			'SYMBOL': 'Symbole',
			'SYMBOL_ERR_REQUIRED': 'Le symbole est requis.',
			'SYMBOL_ERR_MAX': 'Le symbole peut contenir au maximum 5 caractères.',
			'CREATE': 'Créer',
			'PUBLIC': 'Partager publiquement',
			'PUBLIC_EXPLANATION': "Si 'Partager publiquement' est activé, le projet sera affiché dans toutes les listes publiques."
		},
		'PROJECT_COMP_EDIT': {
			'PROJECT_TITLE': 'Modifier le projet',
			'COMP_TITLE': 'Modifier le composant',
			'NAME': 'Nom',
			'NAME_ERR_REQUIRED': 'Le nom est requis',
			'NAME_ERR_MAX': 'Le nom est trop long',
			'DESCRIPTION': 'Description',
			'DESCRIPTION_ERR_MAX': 'La description est trop longue',
			'SYMBOL': 'Symbole',
			'SYMBOL_ERR_REQUIRED': 'Le symbole est requis',
			'SYMBOL_ERR_MAX': 'Le symbole est trop long',
			'SAVE': 'Enregistrer'
		},
		'PROJECT_COMP_INFO': {
			'TITLE': 'Informations',
			'NAME': 'Nom',
			'FORKED': 'Fourché de',
			'CREATED': 'Créé',
			'MODIFIED': 'Dernière modification',
			'INPUTS': 'Entrées',
			'OUTPUTS': 'Sorties',
			'SYMBOL': 'Symbole',
			'DEPENDENCIES': 'Dépendances',
			'DEPENDENT_PROJECTS': 'Projets dépendants',
			'DEPENDENT_COMPONENTS': 'Composants dépendants',
			'NO_DEPENDENCIES': 'N/A',
			'DESCRIPTION': 'Description',
			'COMMUNITY_PAGE': 'Aller à la page communautaire'
		},
		'PROJECT_COMP_DELETE': {
			'TITLE': 'Confirmer la suppression',
			'DELETE': 'Confirmer la suppression',
			'CANCEL': 'Annuler',
			'CONFIRM_PROJECT': 'Voulez-vous vraiment supprimer ce projet ?',
			'CONFIRM_COMP': 'Voulez-vous vraiment supprimer ce composant ?',
			'WARNING_COMP': 'Ce composant est utilisé dans les projets ou les composants suivants :',
			'WARNING_COMP_DELETE': 'Si le composant est supprimé, il sera retiré de ces projets et composants.',
			'PROJECTS': 'Projets',
			'COMPONENTS': 'Composants'
		},
		'PROJECT_COMP_SHARE': {
			'TITLE': 'Partager',
			'EXPLANATION': "Toute personne possédant le lien peut visualiser, cloner, mais ne peut pas modifier le projet. Si 'Partager publiquement' est activé, le projet sera affiché dans toutes les listes publiques.",
			'LINK': 'Lien à partager',
			'PUBLIC': 'Partager publiquement',
			'REGENERATE': 'Régénérer',
			'REGENERATE_WARN': 'La régénération du lien rendra l\'ancien lien invalide.',
			'COPY': 'Copier',
			'SAVE': 'Enregistrer',
			'CANCEL': 'Annuler'
		},
		'DELETE_IMAGE': {
			'TITLE': 'Supprimer l\'image',
			'DELETE': 'Confirmer la suppression',
			'CANCEL': 'Annuler',
			'CONFIRM': 'Voulez-vous vraiment supprimer votre image de profil ?'
		},
		'CHANGE_IMAGE': {
			'TITLE': 'Changer l\'image',
			'FILE': 'Déposez votre image ici.',
			'SAVE': 'Enregistrer',
			'SAVE_ERROR': 'Une erreur inconnue s\'est produite.'
		},
		'DELETE_ACCOUNT': {
			'TITLE': 'Supprimer le compte',
			'DELETE': 'Confirmer la suppression',
			'CANCEL': 'Annuler',
			'CONFIRM': 'Voulez-vous vraiment supprimer votre compte ? Cette action ne peut pas être annulée.'
		}
	},
	'INFO_POPUP': {
		'LOCAL_REGISTER': {
			'TITLE': 'Vérification de l\'email',
			'LINE_1': 'Bienvenue sur Logigator.',
			'LINE_2': 'Veuillez vérifier votre boîte de réception et confirmer votre email pour terminer le processus d\'inscription.',
			'OK_BUTTON': 'OK'
		},
		'EMAIL_UPDATED': {
			'TITLE': 'Vérification de l\'email',
			'LINE_1': 'Votre adresse e-mail a été modifiée.',
			'LINE_2': 'Veuillez vérifier votre boîte de réception et confirmer votre nouvel email.',
			'OK_BUTTON': 'OK'
		},
		'PASSWORD_CHANGED': {
			'TITLE': 'Mot de passe défini',
			'LINE_1': 'Le mot de passe a été changé ou défini avec succès.',
			'OK_BUTTON': 'OK'
		},
		'ACCOUNT_DELETED': {
			'TITLE': 'Compte supprimé',
			'LINE_1': 'Votre compte a été supprimé avec succès.',
			'OK_BUTTON': 'OK'
		},
		'PASSWORD_RESET_MAIL_SENT': {
			'TITLE': 'E-mail de réinitialisation envoyé',
			'HEADLINE': 'E-mail de réinitialisation envoyé',
			'BODY': 'Si un compte existe avec l\'adresse e-mail renseignée, un e-mail de réinitialisation du mot de passe a été envoyé à cette adresse. Veuillez vérifier votre boîte de réception.',
			'OK_BUTTON': 'OK'
		},
		'PASSWORD_RESET': {
			'TITLE': 'Mot de passe réinitialisé',
			'HEADLINE': 'Mot de passe réinitialisé',
			'BODY': 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
			'OK_BUTTON': 'OK'
		}
	},
	'IMPRINT': {
		'HEAD': 'Mentions légales',
		'INFORMATION_OBLIGATION': 'Obligation d\'information selon le §5 de la loi sur le commerce électronique, §14 du Code des sociétés, §63 de la loi sur le commerce et obligation de divulgation selon le §25 de la loi sur les médias.',
		'VIENNA': 'Vienne',
		'AUSTRIA': 'Autriche',
		'SOURCE_1': 'Source : Créé avec le générateur d\'empreintes de',
		'SOURCE_2': 'en collaboration avec',
		'CONTENTS_HEAD': 'Responsabilité pour le contenu de ce site Web',
		'CONTENTS_1': 'Nous développons constamment le contenu de ce site Web et nous nous efforçons de fournir des informations correctes et à jour. Malheureusement, nous ne pouvons pas garantir l\'exactitude de tout le contenu de ce site Web, en particulier pour ceux fournis par des tiers.',
		'CONTENTS_2': 'Si vous remarquez un contenu problématique ou illégal, veuillez nous contacter immédiatement, vous trouverez les coordonnées dans l\'empreinte.',
		'LINKS_HEAD': 'Responsabilité des liens sur ce site Web',
		'LINKS_1': 'Notre site Web contient des liens vers d\'autres sites Web dont nous ne sommes pas responsables du contenu. La responsabilité pour les sites Web liés n\'existe pas pour nous selon',
		'LINKS_1_1': ', car nous n\'avons pas eu connaissance d\'activités illégales et n\'avons pas remarqué une telle illégalité et nous supprimerions immédiatement les liens si nous prenions connaissance d\'illégalités.',
		'LINKS_2': 'Si vous remarquez des liens illégaux sur notre site Web, nous vous demandons de nous contacter, vous trouverez les coordonnées dans l\'empreinte.',
		'COPYRIGHT_HEAD': 'Avis de droits d\'auteur',
		'COPYRIGHT_1': 'Icônes réalisées par',
		'COPYRIGHT_1_1': 'de',
		'COPYRIGHT_2': 'Tous les contenus de ce site Web (images, photos, textes, vidéos) sont soumis au droit d\'auteur. Si nécessaire, nous poursuivrons en justice l\'utilisation non autorisée de parties du contenu de notre site.'
	},
	'PRIVACY_POLICY': '<h1>Protection des données</h1>\n' +
		'<h2>Table des matières</h2>\n' +
		'<ul>\n' +
		'<li>\n' +
		'<a href="#einleitung-ueberblick" target="_top">Introduction et aperçu</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#anwendungsbereich">champ d\'application</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#rechtsgrundlagen">Base légale</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#speicherdauer">Période de stockage</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#rechte-dsgvo">Droits au titre du Règlement Général sur la Protection des Données</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#datenuebertragung-drittlaender">Transfert de données vers des pays tiers</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#cookies">Biscuits</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#web-analytics-einleitung">Introduction à l\'analyse Web</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#content-delivery-networks-einleitung">Introduction aux réseaux de diffusion de contenu</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#single-sign-on-anmeldungen-einleitung">Introduction aux connexions à authentification unique</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#erklaerung-verwendeter-begriffe">Explication des termes utilisés</a>\n' +
		'</li>\n' +
		'</ul>\n' +
		'<h2 id="einleitung-ueberblick">Introduction et aperçu</h2>\n' +
		'<p>Nous avons rédigé cette déclaration de protection des données (version 09.03.2024-112741413) afin de vous expliquer, conformément aux exigences du <a href="https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679&amp;from=DE&amp;tid=112741413#d1e2269-1-1" target="_blank" rel="noopener">règlement général sur la protection des données (UE) 2016/679</a> et des lois nationales applicables, quelles données personnelles (données pour en bref) nous, en tant que responsables du traitement - et celui des sous-traitants mandatés par nous (par exemple les fournisseurs) - traitons, traiterons à l\'avenir et quelles sont les options juridiques dont vous disposez. Les termes utilisés doivent être compris comme non sexistes. <br>\n' +
		'<strong>En bref :</strong> nous vous informons de manière complète sur les données que nous traitons à votre sujet.</p>\n' +
		'<p>Les politiques de confidentialité semblent généralement très techniques et utilisent des termes juridiques. Cette déclaration de protection des données vise toutefois à décrire les éléments les plus importants pour vous de la manière la plus simple et transparente possible. Dans la mesure où cela favorise la transparence, <strong>les termes techniques sont expliqués de manière conviviale</strong> , des liens vers des informations complémentaires sont fournis et <strong>des graphiques</strong> sont utilisés. Nous vous informons ainsi dans un langage clair et simple que nous traitons les données personnelles dans le cadre de nos activités commerciales uniquement s\'il existe une base juridique correspondante. Cela n\'est certainement pas possible si vous faites des déclarations aussi brèves, peu claires et juridico-techniques que possible, comme c\'est souvent le cas sur Internet en matière de protection des données. J\'espère que vous trouverez les explications suivantes intéressantes et instructives et qu\'il y a peut-être une ou deux informations que vous ne connaissiez pas auparavant. <br>\n' +
		'Si vous avez encore des questions, nous vous invitons à contacter l\'organisme responsable mentionné ci-dessous ou dans les mentions légales, à suivre les liens existants et à consulter de plus amples informations sur des sites tiers. Vous pouvez bien entendu également retrouver nos coordonnées dans les mentions légales.</p>\n' +
		'<h2 id="anwendungsbereich">champ d\'application</h2>\n' +
		'<p>Cette déclaration de protection des données s\'applique à toutes les données personnelles que nous traitons dans l\'entreprise et à toutes les données personnelles que les entreprises mandatées par nous (sous-traitants) traitent. Par données personnelles, nous entendons des informations au sens de l\'article 4 n° 1 du RGPD telles que le nom, l\'adresse e-mail et l\'adresse postale d\'une personne. Le traitement des données personnelles garantit que nous pouvons proposer et facturer nos services et produits, que ce soit en ligne ou hors ligne. Le champ d\'application de cette déclaration de protection des données comprend&nbsp;:</p>\n' +
		'<ul>\n' +
		'<li>toutes les présences en ligne (sites Web, boutiques en ligne) que nous exploitons</li>\n' +
		'<li>Apparitions sur les réseaux sociaux et communication par courrier électronique</li>\n' +
		'<li>applications mobiles pour smartphones et autres appareils</li>\n' +
		'</ul>\n' +
		'<p>\n' +
		'<strong>En bref :</strong> la déclaration de protection des données s\'applique à tous les domaines dans lesquels les données personnelles sont traitées de manière structurée au sein de l\'entreprise via les canaux mentionnés. Si nous entamons des relations juridiques avec vous en dehors de ces canaux, nous vous en informerons séparément si nécessaire.</p>\n' +
		'<h2 id="rechtsgrundlagen">Base légale</h2>\n' +
		'<p>Dans la déclaration de protection des données suivante, nous vous fournissons des informations transparentes sur les principes et réglementations juridiques, c\'est-à-dire les bases juridiques du règlement général sur la protection des données, qui nous permettent de traiter des données personnelles. <br>\n' +
		'En ce qui concerne le droit de l\'UE, nous nous référons au RÈGLEMENT (UE) 2016/679 DU PARLEMENT EUROPÉEN ET DU CONSEIL du 27 avril 2016. Vous pouvez bien entendu accéder à ce règlement général de l\'UE sur la protection des données en ligne sur EUR-Lex, le accès au droit de l\'UE, à lire sur <a href="https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=celex%3A32016R0679">https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=celex%3A32016R0679</a> .</p>\n' +
		'<p>Nous traitons vos données uniquement si au moins une des conditions suivantes s\'applique :</p>\n' +
		'<ol>\n' +
		'<li>\n' +
		'<strong>Consentement</strong> (article 6, paragraphe 1, lit. a du RGPD)&nbsp;: Vous nous avez donné votre consentement au traitement des données dans un but spécifique. Un exemple serait de sauvegarder les données que vous avez saisies sur un formulaire de contact.</li>\n' +
		'<li>\n' +
		'<strong>Contrat</strong> (article 6, paragraphe 1, lettre b du RGPD) : Afin de remplir un contrat ou des obligations précontractuelles avec vous, nous traitons vos données. Par exemple, si nous concluons un contrat d’achat avec vous, nous avons besoin au préalable de données personnelles.</li>\n' +
		'<li>\n' +
		'<strong>Obligation légale</strong> (article 6, paragraphe 1, lit. c du RGPD)&nbsp;: Si nous sommes soumis à une obligation légale, nous traitons vos données. Par exemple, nous sommes légalement tenus de conserver les factures à des fins comptables. Ceux-ci contiennent généralement des données personnelles.</li>\n' +
		'<li>\n' +
		'<strong>Intérêts légitimes</strong> (article 6, paragraphe 1, lit. f du RGPD) : Dans le cas d\'intérêts légitimes qui ne limitent pas vos droits fondamentaux, nous nous réservons le droit de traiter les données personnelles. Par exemple, nous devons traiter certaines données afin d\'exploiter notre site Internet de manière sûre et économiquement efficace. Ce traitement constitue donc un intérêt légitime.</li>\n' +
		'</ol>\n' +
		'<p>D\'autres conditions telles que la perception des enregistrements dans l\'intérêt public et l\'exercice de l\'autorité publique ainsi que la protection des intérêts vitaux ne nous concernent généralement pas. Si une telle base juridique est pertinente, elle sera indiquée à l\'endroit approprié.</p>\n' +
		'<p>Outre la réglementation européenne, les lois nationales s\'appliquent également&nbsp;:</p>\n' +
		'<ul>\n' +
		'<li>En <strong>Autriche,</strong> il s\'agit de la loi fédérale sur la protection des personnes physiques à l\'égard du traitement des données personnelles ( <strong>loi sur la protection des données</strong> ), ou <strong>DSG</strong> en abrégé .</li>\n' +
		'<li>En <strong>Allemagne, la </strong><strong>loi fédérale sur la protection des données</strong> , <strong>ou BDSG</strong> en abrégé, s\'applique .</li>\n' +
		'</ul>\n' +
		'<p>Si d\'autres lois régionales ou nationales s\'appliquent, nous vous en informerons dans les sections suivantes.</p>\n' +
		'<h2 id="speicherdauer">Période de stockage</h2>\n' +
		'<p>Notre critère général est que nous conservons les données personnelles uniquement pendant la durée absolument nécessaire pour fournir nos services et produits. Cela signifie que nous supprimons les données personnelles dès que la raison du traitement des données n\'existe plus. Dans certains cas, nous sommes légalement tenus de conserver certaines données même après la fin de la finalité initiale, par exemple à des fins comptables.</p>\n' +
		'<p>Si vous souhaitez supprimer vos données ou révoquer votre consentement au traitement des données, les données seront supprimées le plus rapidement possible et sauf obligation de conservation.</p>\n' +
		'<p>Nous vous informerons ci-dessous de la durée concrète du traitement des données concerné, dans la mesure où nous disposons de plus amples informations.</p>\n' +
		'<h2 id="rechte-dsgvo">Droits au titre du Règlement Général sur la Protection des Données</h2>\n' +
		'<p>Conformément aux articles 13, 14 du RGPD, nous vous informons des droits suivants dont vous disposez afin que les données soient traitées de manière loyale et transparente :</p>\n' +
		'<ul>\n' +
		'<li>Conformément à l\'article 15 du RGPD, vous avez le droit de savoir si nous traitons vos données. Si tel est le cas, vous avez le droit de recevoir une copie des données et de connaître les informations suivantes :\n' +
		'<ul>\n' +
		'<li>dans quel but nous effectuons le traitement&nbsp;;</li>\n' +
		'<li>les catégories, c\'est-à-dire les types de données, qui sont traitées&nbsp;;</li>\n' +
		'<li>qui reçoit ces données et, si les données sont transférées vers des pays tiers, comment la sécurité peut être garantie&nbsp;;</li>\n' +
		'<li>combien de temps les données sont conservées&nbsp;;</li>\n' +
		'<li>l\'existence du droit de rectification, de suppression ou de limitation du traitement et du droit de s\'opposer au traitement ;</li>\n' +
		'<li>que vous pouvez porter plainte auprès d\'une autorité de contrôle (les liens vers ces autorités se trouvent ci-dessous)&nbsp;;</li>\n' +
		'<li>l\'origine des données si nous ne les avons pas collectées auprès de vous ;</li>\n' +
		'<li>si un profilage est effectué, c\'est-à-dire si les données sont automatiquement évaluées afin de créer un profil personnel pour vous.</li>\n' +
		'</ul>\n' +
		'</li>\n' +
		'<li>Conformément à l\'article 16 du RGPD, vous disposez d\'un droit de rectification des données, ce qui signifie que nous devons corriger les données si vous constatez des erreurs.</li>\n' +
		'<li>Conformément à l\'article 17 du RGPD, vous disposez d\'un droit à la suppression (« droit à l\'oubli »), ce qui signifie notamment que vous pouvez demander la suppression de vos données.</li>\n' +
		'<li>Conformément à l\'article 18 du RGPD, vous avez le droit de restreindre le traitement, ce qui signifie que nous sommes uniquement autorisés à stocker les données, mais pas à les utiliser davantage.</li>\n' +
		'<li>Conformément à l\'article 20 du RGPD, vous avez droit à la portabilité des données, ce qui signifie que sur demande, nous vous fournirons vos données dans un format commun.</li>\n' +
		'<li>Conformément à l\'article 21 du RGPD, vous disposez d\'un droit d\'opposition qui, une fois exercé, entraînera une modification du traitement.\n' +
		'<ul>\n' +
		'<li>Si le traitement de vos données est fondé sur l\'article 6, paragraphe 1, lettre e (intérêt public, exercice de l\'autorité publique) ou sur l\'article 6, paragraphe 1, lettre f (intérêt légitime), vous pouvez vous opposer au traitement. Nous vérifierons alors dans les plus brefs délais si nous pouvons légalement nous conformer à cette objection.</li>\n' +
		'<li>Si les données sont utilisées à des fins de publicité directe, vous pouvez à tout moment vous opposer à ce type de traitement des données. Nous ne pourrons alors plus utiliser vos données à des fins de marketing direct.</li>\n' +
		'<li>Si les données sont utilisées pour effectuer un profilage, vous pouvez à tout moment vous opposer à ce type de traitement des données. Nous ne sommes alors plus autorisés à utiliser vos données à des fins de profilage.</li>\n' +
		'</ul>\n' +
		'</li>\n' +
		'<li>Conformément à l\'article 22 du RGPD, vous pouvez avoir le droit de ne pas faire l\'objet d\'une décision basée uniquement sur un traitement automatisé (par exemple profilage).</li>\n' +
		'<li>Conformément à l\'article 77 du RGPD, vous avez le droit de déposer une plainte. Cela signifie que vous pouvez à tout moment porter plainte auprès de l\'autorité de protection des données si vous estimez que le traitement des données personnelles viole le RGPD.</li>\n' +
		'</ul>\n' +
		'<p>\n' +
		'<strong>En bref :</strong> vous avez des droits – n’hésitez pas à contacter l’organisme responsable indiqué ci-dessus !</p>\n' +
		'<p>Si vous pensez que le traitement de vos données viole la loi sur la protection des données ou que vos droits en matière de protection des données ont été violés d\'une autre manière, vous pouvez porter plainte auprès de l\'autorité de contrôle. Pour l\'Autriche, il s\'agit de l\'autorité de protection des données, dont vous trouverez le site Internet à l\'adresse <a href="https://www.dsb.gv.at/?tid=112741413" target="_blank" rel="noopener">https://www.dsb.gv.at/</a> . En Allemagne, il existe un délégué à la protection des données pour chaque État fédéral. Pour plus d\'informations, vous pouvez contacter le <a href="https://www.bfdi.bund.de/DE/Home/home_node.html" target="_blank" rel="noopener">Préposé fédéral à la protection des données et à la liberté d\'information (BfDI)</a> . L\'autorité locale de protection des données suivante est responsable de notre entreprise&nbsp;:</p>\n' +
		'<h2 id="datenuebertragung-drittlaender">Transfert de données vers des pays tiers</h2>\n' +
		'<p>Nous transférons ou traitons des données vers des pays hors du champ d\'application du RGPD (pays tiers) uniquement si vous consentez à ce traitement ou s\'il existe une autre autorisation légale. Cela s\'applique en particulier si le traitement est requis par la loi ou nécessaire à l\'exécution d\'une relation contractuelle et en tout cas uniquement dans la mesure où cela est généralement autorisé. Dans la plupart des cas, votre consentement est la raison la plus importante pour laquelle nous traitons des données dans des pays tiers. Le traitement des données personnelles dans des pays tiers tels que les États-Unis, où de nombreux fabricants de logiciels fournissent des services et ont leurs serveurs, peut signifier que les données personnelles sont traitées et stockées de manière inattendue.</p>\n' +
		'<p>Nous soulignons expressément que, selon l\'avis de la Cour de justice européenne, il n\'existe actuellement un niveau de protection adéquat pour le transfert de données vers les États-Unis que si une entreprise américaine qui traite les données personnelles de citoyens de l\'UE aux États-Unis participe activement à le cadre de confidentialité des données UE-États-Unis l’est. Vous pouvez trouver plus d\'informations à ce sujet sur&nbsp;: <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a>\n' +
		'</p>\n' +
		'<p>Le traitement des données par des services américains qui ne participent pas activement au cadre de confidentialité des données UE-États-Unis peut avoir pour conséquence que les données ne soient pas traitées et stockées de manière anonyme. En outre, les autorités gouvernementales américaines peuvent avoir accès à des données individuelles. Il peut également arriver que les données collectées soient liées à des données provenant d\'autres services du même fournisseur, à condition que vous disposiez d\'un compte utilisateur correspondant. Si possible, nous essayons d\'utiliser des emplacements de serveurs au sein de l\'UE, si cela est proposé. <br>\n' +
		'Nous vous informerons plus en détail sur le transfert de données vers des pays tiers aux endroits appropriés dans cette déclaration de protection des données, le cas échéant.</p>\n' +
		'<h2 id="cookies">Biscuits</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Résumé des cookies</strong>\n' +
		'<br>\n' +
		'👥 Personnes concernées : visiteurs du site Internet <br>\n' +
		'🤝 Finalité : en fonction du cookie respectif. Vous pouvez trouver plus de détails à ce sujet ci-dessous ou auprès du fabricant du logiciel qui installe le cookie. <br>\n' +
		'📓 Données traitées : En fonction du cookie utilisé. Vous pouvez trouver plus de détails à ce sujet ci-dessous ou auprès du fabricant du logiciel qui installe le cookie. <br>\n' +
		'📅 Durée de conservation : dépend du cookie concerné, peut varier de quelques heures à plusieurs années <br>\n' +
		'⚖️ Base juridique : article 6, paragraphe 1, point a du RGPD (consentement), article 6, paragraphe 1, point f du RGPD (intérêts légitimes)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Que sont les cookies ?</h3>\n' +
		'<p>Notre site Web utilise des cookies HTTP pour stocker des données spécifiques à l\'utilisateur. <br>\n' +
		'Nous expliquons ci-dessous ce que sont les cookies et pourquoi ils sont utilisés afin que vous puissiez mieux comprendre la politique de confidentialité suivante.</p>\n' +
		'<p>Chaque fois que vous surfez sur Internet, vous utilisez un navigateur. Les navigateurs les plus connus incluent Chrome, Safari, Firefox, Internet Explorer et Microsoft Edge. La plupart des sites Web stockent de petits fichiers texte dans votre navigateur. Ces fichiers sont appelés cookies.</p>\n' +
		'<p>Une chose est indéniable : les cookies sont de petites aides très utiles. Presque tous les sites Web utilisent des cookies. Plus précisément, il s\'agit de cookies HTTP, car il existe également d\'autres cookies destinés à d\'autres domaines d\'application. Les cookies HTTP sont de petits fichiers que notre site Web stocke sur votre ordinateur. Ces fichiers cookies sont automatiquement stockés dans le dossier cookies, le « cerveau » de votre navigateur. Un cookie est constitué d\'un nom et d\'une valeur. Lors de la définition d\'un cookie, un ou plusieurs attributs doivent également être précisés.</p>\n' +
		'<p>Les cookies stockent certaines données utilisateur vous concernant, telles que les paramètres de langue ou de page personnelle. Lorsque vous visitez à nouveau notre site, votre navigateur renvoie les informations « relatives à l\'utilisateur » à notre site. Grâce aux cookies, notre site Internet sait qui vous êtes et vous propose les paramètres auxquels vous êtes habitué. Dans certains navigateurs, chaque cookie possède son propre fichier, dans d\'autres, comme Firefox, tous les cookies sont stockés dans un seul fichier.</p>\n' +
		'<p>Il existe à la fois des cookies propriétaires et des cookies tiers. Les cookies de première partie sont créés directement par notre site, les cookies tiers sont créés par des sites Web partenaires (par exemple Google Analytics). Chaque cookie doit être évalué individuellement car chaque cookie stocke des données différentes. Le délai d\'expiration d\'un cookie varie également de quelques minutes à quelques années. Les cookies ne sont pas des programmes logiciels et ne contiennent pas de virus, chevaux de Troie ou autres éléments « malveillants ». Les cookies ne peuvent pas non plus accéder aux informations sur votre PC.</p>\n' +
		'<p>Par exemple, les données des cookies pourraient ressembler à ceci&nbsp;:</p>\n' +
		'<p>\n' +
		'<strong>Nom :</strong> _ga <br>\n' +
		'<strong>Valeur :</strong> &nbsp;GA1.2.1326744211.152112741413-9 <br>\n' +
		'<strong>Objet :</strong> Différenciation des visiteurs du site <br>\n' +
		'<strong>Date d\'expiration :</strong> &nbsp;après 2 ans</p>\n' +
		'<p>Un navigateur doit être capable de prendre en charge ces tailles minimales&nbsp;:</p>\n' +
		'<ul>\n' +
		'<li>Au moins 4096 octets par cookie</li>\n' +
		'<li>Au moins 50 cookies par domaine</li>\n' +
		'<li>Au moins 3000 cookies au total</li>\n' +
		'</ul>\n' +
		'<h3>Quels types de cookies existe-t-il ?</h3>\n' +
		'<p>La question de savoir quels cookies nous utilisons en particulier dépend des services utilisés et est clarifiée dans les sections suivantes de la déclaration de protection des données. À ce stade, nous aimerions aborder brièvement les différents types de cookies HTTP.</p>\n' +
		'<p>Il existe 4 types de cookies :</p>\n' +
		'<p>\n' +
		'<strong>Cookies essentiels<br>\n' +
		'</strong> Ces cookies sont nécessaires pour assurer les fonctions de base du site Internet. Par exemple, ces cookies sont nécessaires lorsqu\'un utilisateur place un produit dans son panier, puis continue de naviguer sur d\'autres pages et ne le finalise que plus tard. Ces cookies ne suppriment pas le panier, même si l\'utilisateur ferme la fenêtre de son navigateur.</p>\n' +
		'<p>\n' +
		'<strong>Cookies de finalité<br>\n' +
		'</strong> Ces cookies collectent des informations sur le comportement de l\'utilisateur et indiquent si l\'utilisateur reçoit des messages d\'erreur. Ces cookies sont également utilisés pour mesurer le temps de chargement et le comportement du site Internet sur différents navigateurs.</p>\n' +
		'<p>\n' +
		'<strong>Cookies ciblés<br>\n' +
		'</strong> Ces cookies garantissent une meilleure expérience utilisateur. Par exemple, les emplacements saisis, les tailles de police ou les données de formulaire sont enregistrés.</p>\n' +
		'<p>\n' +
		'<strong>Cookies publicitaires<br>\n' +
		'</strong> Ces cookies sont également appelés cookies de ciblage. Ils servent à proposer à l\'utilisateur une publicité personnalisée. Cela peut être très pratique, mais aussi très ennuyeux.</p>\n' +
		'<p>En règle générale, lorsque vous visitez un site Web pour la première fois, il vous sera demandé lequel de ces types de cookies vous souhaitez autoriser. Et bien entendu, cette décision est également enregistrée dans un cookie.</p>\n' +
		'<p>Si vous souhaitez en savoir plus sur les cookies et n\'avez pas peur de la documentation technique, nous vous recommandons <a href="https://datatracker.ietf.org/doc/html/rfc6265">https://datatracker.ietf.org/doc/html/rfc6265</a> , la demande de commentaires de l\'Internet Engineering Task Force (IETF) appelée « HTTP State Management Mécanisme » .</p>\n' +
		'<h3>Finalité du traitement via les cookies</h3>\n' +
		'<p>La finalité dépend en fin de compte du cookie concerné. Vous pouvez trouver plus de détails à ce sujet ci-dessous ou auprès du fabricant du logiciel qui installe le cookie.</p>\n' +
		'<h3>Quelles données sont traitées ?</h3>\n' +
		'<p>Les cookies sont de petites aides pour de nombreuses tâches différentes. Malheureusement, il n\'est pas possible de généraliser quelles données sont stockées dans les cookies, mais nous vous informerons des données traitées ou stockées dans la déclaration de protection des données suivante.</p>\n' +
		'<h3>Durée de conservation des cookies</h3>\n' +
		'<p>La durée de stockage dépend du cookie concerné et est précisée ci-dessous. Certains cookies sont supprimés au bout de moins d\'une heure, d\'autres peuvent rester sur un ordinateur pendant plusieurs années.</p>\n' +
		'<p>Vous avez également une influence sur la durée de stockage. Vous pouvez à tout moment supprimer manuellement tous les cookies via votre navigateur (voir également «&nbsp;Droit d\'opposition&nbsp;» ci-dessous). En outre, les cookies basés sur le consentement seront supprimés au plus tard après la révocation de votre consentement, la légalité de leur stockage n\'étant toutefois pas affectée d\'ici là.</p>\n' +
		'<h3>Droit d\'opposition – comment puis-je supprimer les cookies ?</h3>\n' +
		'<p>Vous décidez vous-même comment et si vous souhaitez utiliser des cookies. Quel que soit le service ou le site Web d\'où proviennent les cookies, vous avez toujours la possibilité de supprimer les cookies, de les désactiver ou de ne les autoriser que partiellement. Par exemple, vous pouvez bloquer les cookies tiers mais autoriser tous les autres cookies.</p>\n' +
		'<p>Si vous souhaitez savoir quels cookies ont été stockés dans votre navigateur, si vous souhaitez modifier ou supprimer les paramètres des cookies, vous pouvez le faire dans les paramètres de votre navigateur :</p>\n' +
		'<p>\n' +
		'<a href="https://support.google.com/chrome/answer/95647?tid=112741413" target="_blank" rel="noopener noreferrer">Chrome&nbsp;:&nbsp;supprimer, activer et gérer les cookies dans Chrome</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.apple.com/de-at/guide/safari/sfri11471/mac?tid=112741413" target="_blank" rel="noopener noreferrer">Safari&nbsp;: Gérer les cookies et les données du site avec Safari</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.mozilla.org/de/kb/cookies-und-website-daten-in-firefox-loschen?tid=112741413" target="_blank" rel="noopener noreferrer">Firefox&nbsp;: Supprimez les cookies pour supprimer les données que les sites Web ont placées sur votre ordinateur</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.microsoft.com/de-de/windows/l%C3%B6schen-und-verwalten-von-cookies-168dab11-0753-043d-7c16-ede5947fc64d?tid=112741413">Internet Explorer : Suppression et gestion des cookies</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.microsoft.com/de-de/microsoft-edge/cookies-in-microsoft-edge-l%C3%B6schen-63947406-40ac-c3b8-57b9-2a946a29ae09?tid=112741413">Microsoft Edge : Suppression et gestion des cookies</a>\n' +
		'</p>\n' +
		'<p>Si vous ne souhaitez généralement pas de cookies, vous pouvez configurer votre navigateur de manière à ce qu\'il vous informe toujours lorsqu\'un cookie doit être installé. Cela signifie que vous pouvez décider pour chaque cookie individuel si vous autorisez ou non le cookie. La procédure varie selon le navigateur. La meilleure chose à faire est de rechercher les instructions dans Google en utilisant le terme de recherche « supprimer les cookies Chrome » ou « désactiver les cookies Chrome » dans le cas d\'un navigateur Chrome.</p>\n' +
		'<h3>Base légale</h3>\n' +
		'<p>Les «&nbsp;Directives relatives aux cookies&nbsp;» existent depuis 2009. Celui-ci indique que le stockage de cookies nécessite votre <strong>consentement (article 6, paragraphe 1, lit. a du RGPD). </strong>Cependant, les réactions à ces lignes directrices restent très différentes au sein des pays de l’UE. En Autriche, cependant, cette directive a été mise en œuvre dans l\'article 165, paragraphe 3 de la loi sur les télécommunications (2021). En Allemagne, les directives relatives aux cookies n\'ont pas été mises en œuvre en tant que loi nationale. Au lieu de cela, cette directive a été largement mise en œuvre dans l\'article 15, paragraphe 3 de la loi sur les télémédias (TMG).</p>\n' +
		'<p>Pour les cookies absolument nécessaires, même si le consentement n\'est pas donné, il existe <strong>des intérêts légitimes</strong> (article 6, paragraphe 1, lit. f du RGPD), qui sont dans la plupart des cas de nature économique. Nous souhaitons offrir aux visiteurs du site Web une expérience d\'utilisation agréable et certains cookies sont souvent absolument nécessaires à cet effet.</p>\n' +
		'<p>Si des cookies non essentiels sont utilisés, cela ne se fera qu\'avec votre consentement. La base juridique à cet égard est l’article 6, paragraphe 1, lettre a du RGPD.</p>\n' +
		'<p>Dans les sections suivantes, vous serez informé plus en détail sur l\'utilisation des cookies si le logiciel utilisé utilise des cookies.</p>\n' +
		'<h2 id="web-analytics-einleitung">Introduction à l\'analyse Web</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Résumé de la déclaration de protection des données Web Analytics</strong>\n' +
		'<br>\n' +
		'👥 Concerné : Visiteurs du site Web <br>\n' +
		'🤝 Objectif : Évaluation des informations des visiteurs pour optimiser l\'offre Web. <br>\n' +
		'📓 Données traitées&nbsp;: statistiques d\'accès, qui incluent des données telles que les emplacements d\'accès, les données de l\'appareil, la durée et l\'heure d\'accès, le comportement de navigation, le comportement de clic et les adresses IP. Vous pouvez trouver plus de détails à ce sujet dans l’outil d’analyse Web utilisé. <br>\n' +
		'📅 Durée de conservation : dépend de l\'outil d\'analyse Web utilisé <br>\n' +
		'⚖️ Base juridique : article 6, paragraphe 1, lit. a du RGPD (consentement), article 6, paragraphe 1, lit. f du RGPD (intérêts légitimes)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Qu’est-ce que l’analyse Web&nbsp;?</h3>\n' +
		'<p>Nous utilisons un logiciel sur notre site Web pour évaluer le comportement des visiteurs du site Web, ce que l\'on appelle en abrégé l\'analyse Web. Des données sont collectées, que le fournisseur d\'outils d\'analyse respectif (également appelé outil de suivi) stocke, gère et traite. Les données sont utilisées pour réaliser des analyses du comportement des utilisateurs sur notre site Internet et les mettre à notre disposition en tant qu\'exploitant du site Internet. De plus, la plupart des outils proposent diverses options de test. Par exemple, nous pouvons tester quelles offres ou quels contenus sont les mieux reçus par nos visiteurs. Nous vous présenterons deux offres différentes pour une durée limitée. Après le test (appelé test A/B), nous savons quel produit ou contenu les visiteurs de notre site Web trouvent le plus intéressant. Pour ces procédures de test, ainsi que pour d\'autres procédures d\'analyse, des profils d\'utilisateurs peuvent également être créés et les données peuvent être stockées dans des cookies.</p>\n' +
		'<h3>Pourquoi faisons-nous de l\'analyse Web&nbsp;?</h3>\n' +
		'<p>Nous avons un objectif clair en tête avec notre site Web : nous voulons offrir la meilleure offre Web du marché pour notre industrie. Afin d\'atteindre cet objectif, nous voulons d\'une part vous proposer l\'offre la meilleure et la plus intéressante et, d\'autre part, faire en sorte que vous vous sentiez parfaitement à l\'aise sur notre site Internet. À l’aide d’outils d’analyse Web, nous pouvons examiner de plus près le comportement des visiteurs de notre site Web et ensuite améliorer notre site Web en conséquence pour vous et pour nous. Par exemple, nous pouvons voir quel âge ont en moyenne nos visiteurs, d\'où ils viennent, quand notre site Web est le plus visité ou quels contenus ou produits sont particulièrement populaires. Toutes ces informations nous aident à optimiser le site Internet et ainsi à l\'adapter au mieux à vos besoins, intérêts et souhaits.</p>\n' +
		'<h3>Quelles données sont traitées ?</h3>\n' +
		'<p>Bien entendu, les données exactes qui sont stockées dépendent des outils d’analyse utilisés. Cependant, sont généralement stockés, par exemple, le contenu que vous consultez sur notre site Internet, les boutons ou liens sur lesquels vous cliquez, le moment où vous accédez à une page, le navigateur que vous utilisez, l\'appareil (PC, tablette, smartphone, etc.) que vous utilisez. utiliser le site Web que vous visitez ou le système informatique que vous utilisez. Si vous avez accepté que des données de localisation soient également collectées, celles-ci peuvent également être traitées par le fournisseur de l\'outil d\'analyse Web.</p>\n' +
		'<p>Votre adresse IP est également stockée. Selon le Règlement Général sur la Protection des Données (RGPD), les adresses IP sont des données personnelles. Cependant, votre adresse IP est généralement stockée sous un pseudonyme (c\'est-à-dire sous une forme méconnaissable et abrégée). À des fins de test, d\'analyse Web et d\'optimisation Web, aucune donnée directe telle que votre nom, votre âge, votre adresse ou votre adresse e-mail n\'est stockée. Toutes ces données, si elles sont collectées, sont stockées de manière pseudonyme. Cela signifie que vous ne pouvez pas être identifié en tant que personne.</p>\n' +
		'<p>La durée de conservation des données respectives dépend toujours du fournisseur. Certains cookies ne stockent les données que pendant quelques minutes ou jusqu\'à ce que vous quittiez le site Web, d\'autres cookies peuvent stocker des données pendant plusieurs années.</p>\n' +
		'<h3>\n' +
		'<span data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Wo und wie lange werden Daten gespeichert?&quot;}" data-sheets-userformat="{&quot;2&quot;:769,&quot;3&quot;:{&quot;1&quot;:0},&quot;11&quot;:4,&quot;12&quot;:0}">Durée du traitement des données</span>\n' +
		'</h3>\n' +
		'<p>Nous vous informerons ci-dessous de la durée du traitement des données si nous disposons de plus amples informations. En général, nous traitons les données personnelles uniquement pendant la durée absolument nécessaire à la fourniture de nos services et produits. Si la loi l\'exige, par exemple dans le cas de la comptabilité, cette durée de conservation peut également être dépassée.</p>\n' +
		'<h3>Droit d\'opposition</h3>\n' +
		'<p>Vous avez également le droit et la possibilité de révoquer à tout moment votre consentement à l\'utilisation de cookies ou de fournisseurs tiers. Cela fonctionne soit via notre outil de gestion des cookies, soit via d\'autres fonctions de désinscription. Par exemple, vous pouvez également empêcher la collecte de données via les cookies en gérant, désactivant ou supprimant les cookies dans votre navigateur.</p>\n' +
		'<h3>Base légale</h3>\n' +
		'<p>L\'utilisation de l\'analyse Web nécessite votre consentement, que nous avons obtenu grâce à notre popup de cookies. Conformément à <strong>l\'article 6, paragraphe 1, lettre a du RGPD (consentement), ce</strong> consentement constitue la base juridique du traitement des données personnelles, comme cela peut se produire lors de leur collecte par des outils d\'analyse Web.</p>\n' +
		'<p>Outre le consentement, nous avons un intérêt légitime à analyser le comportement des visiteurs du site Web et à améliorer ainsi notre offre sur les plans technique et économique. À l\'aide de l\'analyse Web, nous détectons les erreurs du site Web, identifions les attaques et améliorons la rentabilité. La base juridique pour cela est <strong>l\'article 6, paragraphe 1, lettre f du RGPD (intérêts légitimes)</strong> . Toutefois, nous n\'utilisons les outils que si vous avez donné votre consentement.</p>\n' +
		'<p>Les cookies étant utilisés dans les outils d\'analyse Web, nous vous recommandons également de lire notre politique générale de confidentialité sur les cookies. Pour savoir exactement quelles données sont stockées et traitées, vous devez lire les déclarations de protection des données des outils respectifs.</p>\n' +
		'<p>Des informations sur les outils d\'analyse Web spéciaux, si disponibles, peuvent être trouvées dans les sections suivantes.</p>\n' +
		'<h2 id="google-analytics-datenschutzerklaerung">Politique de confidentialité de Google Analytics</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Résumé de la déclaration de protection des données de Google Analytics</strong>\n' +
		'<br>\n' +
		'👥 Concerné : Visiteurs du site Internet <br>\n' +
		'🤝 Objectif : Évaluation des informations des visiteurs pour optimiser le site Internet. <br>\n' +
		'📓 Données traitées&nbsp;: statistiques d\'accès, qui incluent des données telles que les emplacements d\'accès, les données de l\'appareil, la durée et l\'heure d\'accès, le comportement de navigation et le comportement de clic. Vous trouverez plus de détails à ce sujet plus bas dans cette déclaration de protection des données. <br>\n' +
		'📅 Durée de conservation : réglable individuellement, par défaut Google Analytics 4 stocke les données pendant 14 mois <br>\n' +
		'⚖️ Base juridique : article 6, paragraphe 1, lit. a du RGPD (consentement), article 6, paragraphe 1, lit. f du RGPD (intérêts légitimes)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Qu\'est-ce que Google Analytics ?</h3>\n' +
		'<p>Sur notre site Internet, nous utilisons l\'outil de suivi d\'analyse Google Analytics en version Google Analytics 4 (GA4) de la société américaine Google Inc. Pour la zone européenne, la société Google Ireland Limited (Gordon House, Barrow Street Dublin 4, Irlande) s\'adresse à tous. Responsable des services Google. Google Analytics collecte des données sur vos actions sur notre site Web. Grâce à la combinaison de différentes technologies telles que les cookies, les identifiants d\'appareil et les informations de connexion, vous, en tant qu\'utilisateur, pouvez être identifié sur différents appareils. Cela signifie que vos actions peuvent également être analysées sur toutes les plateformes.</p>\n' +
		'<p>Par exemple, si vous cliquez sur un lien, cet événement est stocké dans un cookie et envoyé à Google Analytics. Les rapports que nous recevons de Google Analytics nous permettent de mieux adapter notre site Web et nos services à vos besoins. Nous aborderons ci-dessous plus en détail l\'outil de suivi et, surtout, vous informerons des données traitées et de la manière dont vous pouvez empêcher cela.</p>\n' +
		'<p>Google Analytics est un outil de suivi utilisé pour analyser le trafic sur notre site Web. La base de ces mesures et analyses est un numéro d’identification d’utilisateur pseudonyme. Ce numéro ne contient aucune donnée personnelle telle que nom ou adresse, mais est utilisé pour attribuer des événements à un appareil. GA4 utilise un modèle basé sur des événements qui capture des informations détaillées sur les interactions des utilisateurs telles que les pages vues, les clics, le défilement et les événements de conversion. De plus, diverses fonctions de machine learning ont été intégrées à GA4 pour mieux comprendre le comportement des utilisateurs et certaines tendances. GA4 s\'appuie sur la modélisation à l\'aide de fonctions d\'apprentissage automatique. Cela signifie que sur la base des données collectées, les données manquantes peuvent également être extrapolées afin d\'optimiser l\'analyse et également de pouvoir faire des prévisions.</p>\n' +
		'<p>Pour que Google Analytics fonctionne, un code de suivi est intégré au code de notre site Web. Lorsque vous visitez notre site Internet, ce code enregistre divers événements que vous effectuez sur notre site Internet. Grâce au modèle de données basé sur les événements de GA4, nous, en tant qu\'opérateurs de sites Web, pouvons définir et suivre des événements spécifiques pour obtenir une analyse des interactions des utilisateurs. Outre les informations générales telles que les clics ou les pages vues, des événements spécifiques importants pour notre entreprise peuvent également être suivis. De tels événements spéciaux pourraient être, par exemple, l’envoi d’un formulaire de contact ou l’achat d’un produit.</p>\n' +
		'<p>Dès que vous quittez notre site Internet, ces données sont envoyées aux serveurs de Google Analytics et y sont stockées.</p>\n' +
		'<p>Google traite les données et nous recevons des rapports sur votre comportement d\'utilisateur. Ceux-ci peuvent inclure, entre autres, les rapports suivants&nbsp;:</p>\n' +
		'<ul>\n' +
		'<li>Rapports sur les groupes cibles&nbsp;: grâce aux rapports sur les groupes cibles, nous apprenons à mieux connaître nos utilisateurs et à savoir plus précisément qui est intéressé par notre service.</li>\n' +
		'<li>Rapports d\'affichage&nbsp;: les rapports d\'affichage nous permettent d\'analyser et d\'améliorer plus facilement notre publicité en ligne.</li>\n' +
		'<li>Rapports d\'acquisition&nbsp;: les rapports d\'acquisition nous fournissent des informations utiles sur la manière dont nous pouvons attirer davantage de personnes vers notre service.</li>\n' +
		'<li>Rapports comportementaux&nbsp;: c\'est ici que nous apprenons comment vous interagissez avec notre site Web. Nous pouvons suivre l\'itinéraire que vous empruntez sur notre site et les liens sur lesquels vous cliquez.</li>\n' +
		'<li>Rapports de conversion&nbsp;: la conversion est le processus dans lequel vous effectuez une action souhaitée en fonction d\'un message marketing. Par exemple, lorsque vous passez du statut de simple visiteur d’un site Web à celui d’acheteur ou d’abonné à la newsletter. Ces rapports nous aident à en savoir plus sur la façon dont vous recevez nos efforts marketing. C’est ainsi que nous souhaitons augmenter notre taux de conversion.</li>\n' +
		'<li>Rapports en temps réel : Ici, nous découvrons toujours immédiatement ce qui se passe sur notre site Internet. Par exemple, nous pouvons voir combien d’utilisateurs lisent actuellement ce texte.</li>\n' +
		'</ul>\n' +
		'<p>En plus des rapports d\'analyse mentionnés ci-dessus, Google Analytics 4 propose également, entre autres, les fonctions suivantes :</p>\n' +
		'<ul>\n' +
		'<li>Modèle de données basé sur les événements&nbsp;: ce modèle capture des événements très spécifiques qui peuvent se produire sur notre site Web. Par exemple, lire une vidéo, acheter un produit ou vous inscrire à notre newsletter.</li>\n' +
		'<li>Fonctionnalités d\'analyse avancées : Ces fonctionnalités nous permettent de mieux comprendre votre comportement sur notre site Web ou certaines tendances générales. Nous pouvons par exemple segmenter des groupes d\'utilisateurs, réaliser des analyses comparatives de groupes cibles ou suivre votre parcours sur notre site Internet.</li>\n' +
		'<li>Modélisation prédictive&nbsp;: sur la base des données collectées, l\'apprentissage automatique peut extrapoler les données manquantes qui prédisent les événements et les tendances futurs. Cela peut nous aider à développer de meilleures stratégies de marketing.</li>\n' +
		'<li>Analyse multiplateforme&nbsp;: la collecte et l\'analyse de données sont possibles à partir de sites Web et d\'applications. Cela nous donne la possibilité d\'analyser le comportement des utilisateurs sur toutes les plateformes, à condition bien sûr que vous ayez consenti au traitement des données.</li>\n' +
		'</ul>\n' +
		'<h3>Pourquoi utilisons-nous Google Analytics sur notre site Web ?</h3>\n' +
		'<p>Notre objectif avec ce site Internet est clair : nous voulons vous offrir le meilleur service possible. Les statistiques et les données de Google Analytics nous aident à atteindre cet objectif.</p>\n' +
		'<p>Les données évaluées statistiquement nous montrent une image claire des forces et des faiblesses de notre site Internet. D\'une part, nous pouvons optimiser notre site afin que les personnes intéressées puissent le trouver plus facilement sur Google. D’un autre côté, les données nous aident à mieux vous comprendre en tant que visiteur. Nous savons donc exactement ce que nous devons améliorer sur notre site Internet afin de vous offrir le meilleur service possible. Les données nous aident également à mettre en œuvre nos mesures de publicité et de marketing de manière plus personnalisée et plus rentable. Après tout, il est logique de montrer nos produits et services aux personnes qui s\'y intéressent.</p>\n' +
		'<h3>Quelles données Google Analytics stocke-t-il ?</h3>\n' +
		'<p>Google Analytics crée un identifiant aléatoire et unique associé au cookie de votre navigateur à l\'aide d\'un code de suivi. C\'est ainsi que Google Analytics vous reconnaît en tant que nouvel utilisateur et qu\'un identifiant d\'utilisateur vous est attribué. La prochaine fois que vous visiterez notre site, vous serez reconnu comme un utilisateur « récurrent ». Toutes les données collectées sont stockées avec cet identifiant utilisateur. Cela permet d\'évaluer des profils d\'utilisateurs pseudonymes.</p>\n' +
		'<p>Afin de pouvoir analyser notre site Web avec Google Analytics, un identifiant de propriété doit être inséré dans le code de suivi. Les données sont ensuite enregistrées dans la propriété correspondante. La propriété Google Analytics 4 est la propriété par défaut pour chaque propriété nouvellement créée. Selon la propriété utilisée, les données sont stockées pendant des durées différentes.</p>\n' +
		'<p>À l\'aide d\'identifiants tels que des cookies, des identifiants d\'instance d\'application, des identifiants d\'utilisateur ou des paramètres d\'événement personnalisés, vos interactions sont mesurées sur toutes les plateformes, à condition que vous y ayez consenti. Les interactions sont tous les types d’actions que vous effectuez sur notre site Web. Si vous utilisez également d\'autres systèmes Google (comme un compte Google), les données générées via Google Analytics peuvent être liées à des cookies tiers. Google ne transmet pas les données de Google Analytics, sauf si nous l\'autorisons en tant qu\'exploitants de sites Web. Des exceptions peuvent survenir si la loi l\'exige.</p>\n' +
		'<p>Selon Google, Google Analytics 4 n\'enregistre ni ne stocke les adresses IP. Cependant, Google utilise les données d\'adresse IP pour obtenir des données de localisation et les supprime immédiatement après. Toutes les adresses IP collectées auprès des utilisateurs dans l\'UE sont supprimées avant que les données ne soient stockées dans un centre de données ou sur un serveur.</p>\n' +
		'<p>Étant donné que Google Analytics 4 se concentre sur les données basées sur des événements, l\'outil utilise beaucoup moins de cookies que les versions précédentes (comme Google Universal Analytics). Cependant, certains cookies spécifiques sont utilisés par GA4. Ceux-ci incluent, par exemple :</p>\n' +
		'<p>\n' +
		'<strong>Nom&nbsp;:</strong> _ga <br>\n' +
		'<strong>Valeur&nbsp;:</strong> 2.1326744211.152112741413-5 <br>\n' +
		'<strong>Objectif&nbsp;:</strong> Par défaut, Analytics.js utilise le cookie _ga pour stocker l\'ID utilisateur. Fondamentalement, il est utilisé pour distinguer les visiteurs d’un site Web. <br>\n' +
		'<strong>Date de péremption :</strong> après 2 ans</p>\n' +
		'<p>\n' +
		'<strong>Nom :</strong> _gid <br>\n' +
		'<strong>Valeur :</strong> 2.1687193234.152112741413-1 <br>\n' +
		'<strong>Finalité :</strong> &nbsp;Le cookie est également utilisé pour distinguer les visiteurs du site Web <br>\n' +
		'<strong>Date d\'expiration :</strong> &nbsp;après 24 heures</p>\n' +
		'<p>\n' +
		'<strong>Nom :</strong> _gat_gtag_UA_&lt;property-id&gt; <br>\n' +
		'<strong>Valeur :</strong> 1 <br>\n' +
		'<strong>Objectif :</strong> utilisé pour réduire le taux de requêtes. Si Google Analytics est fourni via Google Tag Manager, ce cookie est nommé _dc_gtm_ &lt;property-id&gt;. <br>\n' +
		'<strong>Date d\'expiration :</strong> après 1 minute</p>\n' +
		'<p>\n' +
		'<strong>Remarque :</strong> &nbsp;Cette liste ne peut prétendre être exhaustive, Google modifiant continuellement son choix de cookies. GA4 vise également à améliorer la protection des données. Par conséquent, l\'outil offre certaines options pour contrôler la collecte de données. Par exemple, nous pouvons définir nous-mêmes la durée de conservation et également contrôler la collecte des données.</p>\n' +
		'<p>Nous vous présentons ici un aperçu des principaux types de données collectées avec Google Analytics&nbsp;:</p>\n' +
		'<p>\n' +
		'<strong>Heatmaps&nbsp;:</strong> Google crée des cartes thermiques. Les cartes thermiques montrent exactement les zones sur lesquelles vous cliquez. Cela nous donne des informations sur l\'endroit où vous vous trouvez sur notre site.</p>\n' +
		'<p>\n' +
		'<strong>Durée de la session :</strong> Google fait référence au temps que vous passez sur notre site sans quitter le site. Si vous êtes inactif pendant 20 minutes, la session se termine automatiquement.</p>\n' +
		'<p>\n' +
		'<strong>Taux</strong> de rebond : Un rebond se produit lorsque vous ne consultez qu\'une seule page de notre site Web, puis quittez à nouveau notre site Web.</p>\n' +
		'<p>\n' +
		'<strong>Création de compte :</strong> Si vous créez un compte ou passez une commande sur notre site Internet, Google Analytics collecte ces données.</p>\n' +
		'<p>\n' +
		'<strong>Localisation&nbsp;:</strong> les adresses IP ne sont ni enregistrées ni stockées dans Google Analytics. Cependant, peu de temps avant la suppression de l\'adresse IP, des dérivés des données de localisation sont utilisés.</p>\n' +
		'<p>\n' +
		'<strong>Informations techniques&nbsp;:</strong> les informations techniques peuvent inclure, sans s\'y limiter, votre type de navigateur, votre fournisseur de services Internet ou la résolution de votre écran.</p>\n' +
		'<p>\n' +
		'<strong>Source d\'origine :</strong> Google Analytics ou bien entendu, nous sommes également intéressés par le site Web ou la publicité à partir duquel vous êtes arrivé sur notre site.</p>\n' +
		'<p>Les autres données incluent les coordonnées, les éventuels avis, la lecture de médias (par exemple lorsque vous lisez une vidéo via notre site), le partage de contenu via les réseaux sociaux ou son ajout à vos favoris. La liste ne prétend pas être complète et sert uniquement de guide général sur le stockage des données par Google Analytics.</p>\n' +
		'<h3>Combien de temps et où sont stockées les données ?</h3>\n' +
		'<p>Google a ses serveurs répartis partout dans le monde. Vous pouvez lire exactement où se trouvent les centres de données Google ici&nbsp;: <a href="https://www.google.com/about/datacenters/locations/?hl=de">https://www.google.com/about/datacenters/locations/?hl=de</a>\n' +
		'</p>\n' +
		'<p>Vos données sont réparties sur différents supports de stockage physiques. Cela présente l\'avantage que les données sont accessibles plus rapidement et sont mieux protégées contre toute manipulation. Chaque centre de données Google dispose de programmes d\'urgence appropriés pour vos données. Par exemple, si le matériel de Google tombe en panne ou si des catastrophes naturelles paralysent les serveurs, le risque d\'interruption des services chez Google reste faible.</p>\n' +
		'<p>La durée de conservation des données dépend des propriétés utilisées. La durée de stockage est toujours déterminée spécifiquement pour chaque propriété individuelle. Google Analytics nous propose quatre options pour contrôler la durée de stockage :</p>\n' +
		'<ul>\n' +
		'<li>2 mois : c\'est la durée de stockage la plus courte.</li>\n' +
		'<li>14 mois&nbsp;: par défaut, les données sont stockées sur GA4 pendant 14&nbsp;mois.</li>\n' +
		'<li>26 mois : vous pouvez également conserver les données pendant 26 mois.</li>\n' +
		'<li>Les données ne seront pas supprimées tant que nous ne les supprimerons pas manuellement</li>\n' +
		'</ul>\n' +
		'<p>En outre, il est également possible que les données ne soient supprimées que si vous ne visitez plus notre site Web pendant la période que nous avons choisie. Dans ce cas, la période de conservation sera réinitialisée à chaque fois que vous visiterez à nouveau notre site Internet dans le délai imparti.</p>\n' +
		'<p>Une fois la période spécifiée expirée, les données seront supprimées une fois par mois. Cette durée de conservation s\'applique à vos données liées aux cookies, à la reconnaissance des utilisateurs et aux identifiants publicitaires (par exemple les cookies du domaine DoubleClick). Les résultats du rapport sont basés sur des données agrégées et sont stockés indépendamment des données utilisateur. Les données agrégées sont une fusion de données individuelles en une unité plus grande.</p>\n' +
		'<h3>Comment puis-je supprimer mes données ou empêcher le stockage des données ?</h3>\n' +
		'<p>Conformément à la loi sur la protection des données de l\'Union européenne, vous disposez d\'un droit d\'accès, de mise à jour, de suppression ou de restriction de vos données. Vous pouvez utiliser le module complémentaire du navigateur pour désactiver Google Analytics JavaScript (analytics.js, gtag.js) afin d\'empêcher Google Analytics 4 d\'utiliser vos données. Vous pouvez télécharger et installer le module complémentaire de navigateur sur <a href="https://tools.google.com/dlpage/gaoptout?hl=de">https://tools.google.com/dlpage/gaoptout?hl=de . </a>Veuillez noter que ce module complémentaire désactive uniquement la collecte de données par Google Analytics.</p>\n' +
		'<p>Si vous souhaitez généralement désactiver, supprimer ou gérer les cookies, vous trouverez les liens correspondants vers les instructions pertinentes pour les navigateurs les plus populaires dans la section « Cookies ».</p>\n' +
		'<h3>Base légale</h3>\n' +
		'<p>L\'utilisation de Google Analytics nécessite votre consentement, que nous avons obtenu grâce à notre popup cookie. Conformément à <strong>l\'article 6, paragraphe 1, lettre a du RGPD (consentement), ce</strong> consentement constitue la base juridique du traitement des données personnelles, comme cela peut se produire lors de leur collecte par des outils d\'analyse Web.</p>\n' +
		'<p>Outre le consentement, nous avons un intérêt légitime à analyser le comportement des visiteurs du site Web et à améliorer ainsi notre offre sur les plans technique et économique. Avec l\'aide de Google Analytics, nous détectons les erreurs sur le site Internet, identifions les attaques et améliorons la rentabilité. La base juridique pour cela est <strong>l\'article 6, paragraphe 1, lettre f du RGPD (intérêts légitimes)</strong> . Toutefois, nous n\'utilisons Google Analytics que si vous avez donné votre consentement.</p>\n' +
		'<p>Google traite également vos données aux États-Unis, entre autres. Google participe activement au cadre de protection des données UE-États-Unis, qui réglemente le transfert correct et sécurisé des données personnelles des citoyens de l\'UE vers les États-Unis. De plus amples informations peuvent être trouvées sur <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a> .</p>\n' +
		'<p>Google utilise également des clauses contractuelles dites types (= art. 46, paragraphes 2 et 3 du RGPD). Les clauses contractuelles types (CCT) sont des modèles fournis par la Commission européenne et visent à garantir que vos données sont conformes aux normes européennes en matière de protection des données, même si elles sont transférées vers des pays tiers (comme les États-Unis) et y sont stockées. Par le biais du cadre de protection des données UE-États-Unis et des clauses contractuelles types, Google s\'engage à respecter le niveau européen de protection des données lors du traitement de vos données pertinentes, même si les données sont stockées, traitées et gérées aux États-Unis. Ces clauses sont basées sur une décision d\'exécution de la Commission européenne. Vous pouvez trouver la résolution et les clauses contractuelles types correspondantes ici : <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a>\n' +
		'</p>\n' +
		'<p>Les conditions de traitement des données Google Ads, qui font référence aux clauses contractuelles types, sont disponibles à l\'adresse <a href="https://business.safety.google/intl/de/adsprocessorterms/" target="_blank" rel="follow noopener">https://business.safety.google/intl/de/adsprocessorterms/</a> .</p>\n' +
		'<p>Nous espérons avoir pu vous fournir les informations les plus importantes sur le traitement des données par Google Analytics. Si vous souhaitez en savoir plus sur le service de suivi, nous vous recommandons ces deux liens&nbsp;: <a href="https://marketingplatform.google.com/about/analytics/terms/de/" target="_blank" rel="follow noopener">https://marketingplatform.google.com/about/analytics/terms/de/</a> et <a href="https://support.google.com/analytics/answer/6004245?hl=de" target="_blank" rel="follow noopener">https://support.google.com/analytics/answer / 6004245?hl=de</a> .</p>\n' +
		'<p>Si vous souhaitez en savoir plus sur le traitement des données, veuillez utiliser la politique de confidentialité de Google sur <a href="https://policies.google.com/privacy?hl=de&amp;tid=112741413" target="_blank" rel="follow noopener">https://policies.google.com/privacy?hl=de</a> .</p>\n' +
		'<h2 id="google-analytics-berichte-zu-demografischen-merkmalen-und-interessen">Rapports Google Analytics sur les données démographiques et les intérêts</h2>\n' +
		'<p>Nous avons activé les fonctions de reporting publicitaire dans Google Analytics. Les rapports sur les données démographiques et les intérêts incluent des informations sur l’âge, le sexe et les intérêts. Cela nous permet d\'avoir une meilleure image de nos utilisateurs - sans pouvoir attribuer ces données à des personnes individuelles. Vous pouvez en savoir plus sur les fonctions publicitaires sur&nbsp; <a href="https://support.google.com/analytics/answer/3450482?hl=de_AT&amp;utm_id=ad">https://support.google.com/analytics/answer/3450482?hl=de_AT&amp;utm_id=ad</a> .</p>\n' +
		'<p>Vous pouvez arrêter l\'utilisation des activités et des informations de votre compte Google sous « Paramètres de publicité » sur <a href="https://adssettings.google.com/authenticated">https://adssettings.google.com/authenticated</a> en cochant la case.</p>\n' +
		'<h2 id="google-analytics-im-einwilligungsmodus">Google Analytics en mode consentement</h2>\n' +
		'<p>En fonction de votre consentement, vos données personnelles seront traitées par Google Analytics dans ce que l\'on appelle le mode consentement. Vous pouvez choisir d\'accepter ou non les cookies de Google Analytics. Cela vous permet également de choisir quelles données Google Analytics peut traiter vous concernant. Ces données collectées sont principalement utilisées pour mesurer le comportement des utilisateurs sur le site Web, diffuser des publicités ciblées et nous fournir des rapports d\'analyse Web. En règle générale, vous consentez au traitement des données par Google via un outil de consentement aux cookies. Si vous n\'acceptez pas le traitement des données, seules les données agrégées seront collectées et traitées. Cela signifie que les données ne peuvent pas être attribuées à des utilisateurs individuels et qu\'aucun profil d\'utilisateur n\'est créé pour vous. Vous pouvez également simplement accepter la mesure statistique. Aucune donnée personnelle n\'est traitée et donc utilisée à des fins publicitaires ou de campagnes publicitaires.</p>\n' +
		'<h2 id="content-delivery-networks-einleitung">Introduction aux réseaux de diffusion de contenu</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Résumé de la déclaration de protection des données des réseaux de diffusion de contenu</strong>\n' +
		'<br>\n' +
		'👥 Personnes concernées : visiteurs du site Web <br>\n' +
		'🤝 Objectif : optimisation de notre service (afin que le site Web puisse se charger plus rapidement) <br>\n' +
		'📓 Données traitées : données telles que votre adresse IP <br>\n' +
		'Vous pouvez trouver plus de détails ci-dessous et dans le textes individuels sur la protection des données. <br>\n' +
		'📅 Durée de conservation : La plupart des données sont conservées jusqu\'à ce qu\'elles ne soient plus nécessaires à la fourniture du service <br>\n' +
		'⚖️ Base juridique : article 6, paragraphe 1, lit. a du RGPD (consentement), article 6, paragraphe 1, lit. f du RGPD (consentement légitime). intérêts )</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Qu\'est-ce qu\'un réseau de diffusion de contenu&nbsp;?</h3>\n' +
		'<p>Nous utilisons ce que l\'on appelle un réseau de diffusion de contenu sur notre site Web. Le plus souvent, un tel réseau est simplement appelé CDN. Un CDN nous aide à charger notre site Web rapidement et facilement, quel que soit votre emplacement. Vos données personnelles sont également stockées, gérées et traitées sur les serveurs du fournisseur CDN utilisé. Ci-dessous, nous entrerons dans des détails plus généraux sur le service et son traitement des données. Vous trouverez des informations détaillées sur la manière dont vos données sont traitées dans la déclaration de protection des données respective du fournisseur.</p>\n' +
		'<p>Tout réseau de diffusion de contenu (CDN) est un réseau de serveurs répartis au niveau régional, tous connectés les uns aux autres via Internet. Le contenu du site Web (en particulier les fichiers très volumineux) peut être diffusé rapidement et facilement via ce réseau, même en cas de pics de charge importants. Le CDN crée une copie de notre site Web sur vos serveurs. Étant donné que ces serveurs sont répartis dans le monde entier, le site Web peut être livré rapidement. La transmission des données à votre navigateur est donc considérablement raccourcie par le CDN.</p>\n' +
		'<h3>Pourquoi utilisons-nous un réseau de diffusion de contenu pour notre site Web&nbsp;?</h3>\n' +
		'<p>Un site Web à chargement rapide fait partie de notre service. Bien sûr, nous savons à quel point il est ennuyeux qu\'un site Web se charge à la vitesse d\'un escargot. La plupart du temps, vous perdez même patience et vous vous enfuyez avant que le site Web ne soit complètement chargé. Bien sûr, nous voulons éviter cela. Par conséquent, un site Web à chargement rapide fait naturellement partie de notre offre de sites Web. Grâce à un réseau de diffusion de contenu, notre site Web se charge beaucoup plus rapidement dans votre navigateur. L\'utilisation du CDN est particulièrement utile si vous êtes à l\'étranger car le site Web est livré à partir d\'un serveur proche de chez vous.</p>\n' +
		'<h3>Quelles données sont traitées ?</h3>\n' +
		'<p>Lorsque vous demandez un site Web ou le contenu d\'un site Web et qu\'il est mis en cache dans un CDN, le CDN achemine la demande vers le serveur le plus proche de chez vous et ce serveur délivre le contenu. Les réseaux de diffusion de contenu sont conçus pour permettre aux bibliothèques JavaScript d\'être téléchargées et hébergées sur des serveurs npm et Github. Alternativement, la plupart des CDN peuvent également charger des plugins WordPress s\'ils sont hébergés sur <a href="https://wordpress.org/" target="_blank" rel="noopener">WordPress.org . </a>Votre navigateur peut envoyer des données personnelles au réseau de diffusion de contenu que nous utilisons. Cela inclut des données telles que l\'adresse IP, le type de navigateur, la version du navigateur, le site Web chargé ou l\'heure et la date de la visite de la page. Ces données sont collectées et stockées par le CDN. L\'utilisation ou non de cookies pour stocker des données dépend du réseau utilisé. Veuillez lire les textes de protection des données du service concerné.</p>\n' +
		'<h3>Droit d\'opposition</h3>\n' +
		'<p>Si vous souhaitez empêcher complètement ce transfert de données, vous pouvez installer un bloqueur JavaScript (voir par exemple <a href="https://noscript.net/" target="_blank" rel="noopener">https://noscript.net/</a> ) sur votre PC. Bien entendu, notre site Web ne peut plus offrir le service habituel (comme des vitesses de chargement rapides).</p>\n' +
		'<h3>Base légale</h3>\n' +
		'<p>Si vous avez consenti à l\'utilisation d\'un réseau de diffusion de contenu, la base juridique du traitement des données correspondant est ce consentement. Conformément à <strong>l\'article 6, paragraphe 1, lettre a du RGPD (consentement), ce</strong> consentement constitue la base juridique du traitement des données personnelles, comme cela peut se produire lors de leur collecte par un réseau de diffusion de contenu.</p>\n' +
		'<p>Nous avons également un intérêt légitime à utiliser un réseau de diffusion de contenu pour optimiser notre service en ligne et le rendre plus sécurisé. La base juridique correspondante est <strong>l\'article 6, paragraphe 1, lettre f du RGPD (intérêts légitimes)</strong> . Toutefois, nous n\'utilisons l\'outil que si vous avez donné votre consentement.</p>\n' +
		'<p>Des informations sur les réseaux de diffusion de contenu spéciaux - si disponibles - peuvent être trouvées dans les sections suivantes.</p>\n' +
		'<h2 id="cloudflare-datenschutzerklaerung">Politique de confidentialité de Cloudflare</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Résumé de la politique de confidentialité de Cloudflare</strong>\n' +
		'<br>\n' +
		'👥 Personnes concernées&nbsp;: visiteurs du site Web <br>\n' +
		'🤝 Objectif&nbsp;: optimiser les performances de notre service (pour accélérer le chargement du site Web) <br>\n' +
		'📓 Données traitées&nbsp;: données telles que l\'adresse IP, les informations de contact et de protocole, les empreintes digitales de sécurité et les données de performance des sites Web <br>\n' +
		'Vous trouverez plus de détails à ce sujet plus bas dans cette déclaration de protection des données. <br>\n' +
		'📅 Durée de conservation : la plupart des données sont conservées pendant moins de 24 heures <br>\n' +
		'⚖️ Base juridique : article 6, paragraphe 1, lit. a du RGPD (consentement), article 6, paragraphe 1, lit. f du RGPD (intérêts légitimes)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Qu’est-ce que Cloudflare ?</h3>\n' +
		'<p>Nous utilisons Cloudflare de Cloudflare, Inc. (101 Townsend St., San Francisco, CA 94107, USA) sur ce site Web pour rendre notre site Web plus rapide et plus sécurisé. Cloudflare utilise des cookies et traite les données des utilisateurs. Cloudflare, Inc. est une société américaine qui propose un réseau de diffusion de contenu et divers services de sécurité. Ces services sont conclus entre l\'utilisateur et notre hébergeur. Nous essaierons d’expliquer plus en détail ce que tout cela signifie ci-dessous.</p>\n' +
		'<p>Un réseau de diffusion de contenu (CDN), comme celui fourni par Cloudflare, n\'est rien de plus qu\'un réseau de serveurs connectés. Cloudflare dispose de serveurs comme celui-ci répartis dans le monde entier pour afficher plus rapidement les sites Web sur votre écran. Pour faire simple, Cloudflare crée des copies de notre site Web et les place sur ses propres serveurs. Lorsque vous visitez maintenant notre site Web, un système d\'équilibrage de charge garantit que la plus grande partie de notre site Web est fournie par le serveur qui peut vous afficher notre site Web le plus rapidement. Le chemin de transmission des données vers votre navigateur est considérablement raccourci par un CDN. Cela signifie que le contenu de notre site Web vous est fourni par Cloudflare non seulement depuis notre serveur d\'hébergement, mais depuis des serveurs du monde entier. L\'utilisation de Cloudflare est particulièrement utile pour les utilisateurs étrangers, car le site peut être mis à disposition à partir d\'un serveur à proximité. En plus de livrer rapidement des sites Web, Cloudflare propose également divers services de sécurité tels que la protection DDoS ou le pare-feu des applications Web.</p>\n' +
		'<h3>Pourquoi utilisons-nous Cloudflare sur notre site Web&nbsp;?</h3>\n' +
		'<p>Bien entendu, nous souhaitons vous offrir le meilleur service possible avec notre site Web. Cloudflare nous aide à rendre notre site Web plus rapide et plus sécurisé. Cloudflare nous propose à la fois des services d\'optimisation Web et de sécurité tels que la protection DDoS et le pare-feu Web. Cela inclut également un <a href="https://de.wikipedia.org/wiki/Reverse_Proxy" target="_blank" rel="noopener noreferrer">proxy inverse</a> et le réseau de distribution de contenu (CDN). Cloudflare bloque les menaces et limite les robots et robots d\'exploration abusifs qui gaspillent notre bande passante et les ressources de notre serveur. En stockant notre site Web dans des centres de données locaux et en bloquant les logiciels anti-spam, Cloudflare nous permet de réduire notre utilisation de la bande passante d\'environ 60 %. Servir du contenu à partir d\'un centre de données près de chez vous et y effectuer une optimisation Web réduit le temps de chargement moyen d\'une page Web d\'environ la moitié. Selon Cloudflare, le paramètre « Je suis en mode attaque » peut être utilisé pour atténuer d\'autres attaques en affichant une tâche de calcul JavaScript qui doit être résolue avant qu\'un utilisateur puisse accéder à un site Web. Dans l’ensemble, cela rend notre site Web nettement plus puissant et moins sensible au spam ou à d’autres attaques.</p>\n' +
		'<h3>Quelles données Cloudflare traite-t-il ?</h3>\n' +
		'<p>Cloudflare ne transmet généralement que les données contrôlées par les opérateurs de sites Web. Le contenu n\'est donc pas déterminé par Cloudflare, mais toujours par l\'exploitant du site Web lui-même. En outre, Cloudflare peut collecter certaines informations sur l\'utilisation de notre site Web et traiter les données que nous envoyons ou pour lesquelles Cloudflare a reçu des instructions correspondantes. Dans la plupart des cas, Cloudflare reçoit des données telles que l\'adresse IP, les informations de contact et de journal, les empreintes digitales de sécurité et les données de performances du site Web. Par exemple, les données des journaux aident Cloudflare à détecter de nouvelles menaces. Cela permet à Cloudflare d\'assurer un haut niveau de protection de sécurité pour notre site Web. Cloudflare traite ces données dans le cadre des Services conformément aux lois applicables. Bien entendu, cela inclut également le règlement général sur la protection des données (RGPD). Cloudflare travaille également avec des tiers. Ils ne peuvent traiter les données personnelles que sous les instructions de Cloudflare et conformément aux directives de protection des données et aux autres mesures de confidentialité et de sécurité. Cloudflare ne transmettra aucune donnée personnelle sans notre consentement explicite.</p>\n' +
		'<h3>Combien de temps et où sont stockées les données ?</h3>\n' +
		'<p>Cloudflare stocke vos informations principalement aux États-Unis et dans l\'Espace économique européen. Cloudflare peut transférer et accéder aux informations décrites ci-dessus depuis n\'importe où dans le monde. Généralement, Cloudflare stocke les données au niveau de l\'utilisateur pour les domaines Free, Pro et Business pendant moins de 24 heures. Pour les domaines d\'entreprise sur lesquels Cloudflare Logs (anciennement Enterprise LogShare ou ELS) est activé, les données peuvent être stockées jusqu\'à 7 jours. Cependant, si les adresses IP déclenchent des avertissements de sécurité chez Cloudflare, il peut y avoir des exceptions à la période de stockage indiquée ci-dessus.</p>\n' +
		'<h3>Comment puis-je supprimer mes données ou empêcher le stockage des données ?</h3>\n' +
		'<p>Cloudflare ne conserve les journaux de données que le temps nécessaire et, dans la plupart des cas, ces données sont supprimées dans les 24 heures. Cloudflare ne stocke pas non plus de données personnelles, telles que votre adresse IP. Cependant, Cloudflare stocke indéfiniment certaines informations dans ses journaux persistants pour améliorer les performances globales de Cloudflare Resolver et détecter tout risque de sécurité. Vous pouvez savoir exactement quels journaux permanents sont stockés sur <a href="https://www.cloudflare.com/application/privacypolicy/">https://www.cloudflare.com/application/privacypolicy/</a> . Toutes les données collectées par Cloudflare (temporaires ou permanentes) sont purgées de toute information personnelle. Tous les journaux permanents sont également anonymisés par Cloudflare.</p>\n' +
		'<p>Cloudflare déclare dans sa politique de confidentialité qu\'il n\'est pas responsable du contenu qu\'il reçoit. Par exemple, si vous demandez à Cloudflare s\'il peut mettre à jour ou supprimer votre contenu, Cloudflare nous désigne généralement comme l\'opérateur du site Web. Vous pouvez également empêcher complètement toute collecte et traitement de vos données par Cloudflare en désactivant l\'exécution de code de script dans votre navigateur ou en intégrant un bloqueur de script dans votre navigateur.</p>\n' +
		'<h3>Base légale</h3>\n' +
		'<p>Si vous avez consenti à l\'utilisation de Cloudflare, la base juridique du traitement des données correspondant est ce consentement. Conformément à <strong>l\'article 6, paragraphe 1, point a du RGPD (consentement), ce</strong> consentement constitue la base juridique du traitement des données personnelles, comme cela peut se produire lors de leur collecte par Cloudflare.</p>\n' +
		'<p>Nous avons également un intérêt légitime à utiliser Cloudflare pour optimiser notre service en ligne et le rendre plus sécurisé. La base juridique correspondante est <strong>l\'article 6, paragraphe 1, lettre f du RGPD (intérêts légitimes)</strong> . Cependant, nous n\'utilisons Cloudflare que si vous avez donné votre consentement.</p>\n' +
		'<p>Cloudflare traite également vos données aux États-Unis, entre autres. Cloudflare participe activement au cadre de confidentialité des données UE-États-Unis, qui réglemente le transfert correct et sécurisé des données personnelles des citoyens de l\'UE vers les États-Unis. De plus amples informations peuvent être trouvées sur <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a> .</p>\n' +
		'<p>Cloudflare utilise également des clauses contractuelles dites standards (= art. 46, paragraphes 2 et 3 du RGPD). Les clauses contractuelles types (CCT) sont des modèles fournis par la Commission européenne et visent à garantir que vos données sont conformes aux normes européennes en matière de protection des données, même si elles sont transférées vers des pays tiers (comme les États-Unis) et y sont stockées. Grâce au cadre de confidentialité des données UE-États-Unis et aux clauses contractuelles types, Cloudflare s\'engage à respecter les niveaux européens de protection des données lors du traitement de vos données pertinentes, même si les données sont stockées, traitées et gérées aux États-Unis. Ces clauses sont basées sur une décision d\'exécution de la Commission européenne. Vous pouvez trouver la résolution et les clauses contractuelles types correspondantes ici : <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a> .</p>\n' +
		'<p>Vous pouvez en savoir plus sur les clauses contractuelles types et les données traitées via l\'utilisation de Cloudflare dans la déclaration de protection des données sur <a href="https://www.cloudflare.com/de-de/privacypolicy/?tid=112741413" target="_blank" rel="noopener noreferrer">https://www.cloudflare.com/de-de/privacypolicy/</a> .</p>\n' +
		'<h2 id="single-sign-on-anmeldungen-einleitung">Introduction aux connexions à authentification unique</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Enregistrements par authentification unique Déclaration de protection des données Résumé</strong>\n' +
		'<br>\n' +
		'👥 Personnes concernées : visiteurs du site Web <br>\n' +
		'🤝 Objectif : simplifier le processus d\'authentification <br>\n' +
		'📓 Données traitées : dépendent fortement du fournisseur concerné, l\'adresse e-mail et le nom d\'utilisateur peuvent généralement être enregistrés. <br>\n' +
		'Vous pouvez trouver plus de détails à ce sujet dans l’outil correspondant utilisé. <br>\n' +
		'📅 Durée de conservation : dépend des outils utilisés <br>\n' +
		'⚖️ Base juridique : article 6, paragraphe 1, lit. a du RGPD (consentement), article 6, paragraphe 1, lit. )</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Que sont les connexions à authentification unique&nbsp;?</h3>\n' +
		'<p>Sur notre site Internet, vous avez la possibilité de vous inscrire rapidement et facilement à notre service en ligne en utilisant un compte utilisateur d\'un autre fournisseur (par exemple via Facebook). Cette procédure d\'authentification est appelée, entre autres, « enregistrement par authentification unique ». Bien entendu, cette procédure d\'inscription ne fonctionne que si vous êtes inscrit auprès d\'un autre fournisseur ou si vous disposez d\'un compte utilisateur et que vous saisissez les données d\'accès correspondantes dans le formulaire en ligne. Dans de nombreux cas, vous êtes déjà connecté, les données d\'accès sont automatiquement saisies dans le formulaire et il vous suffit de confirmer l\'inscription au Single Sign-On à l\'aide d\'un bouton. Dans le cadre de cette inscription, vos données personnelles pourront également être traitées et stockées. Dans ce texte sur la protection des données, nous abordons le traitement des données par le biais d\'enregistrements par authentification unique en général. De plus amples informations peuvent être trouvées dans les déclarations de protection des données des fournisseurs respectifs.</p>\n' +
		'<h3>Pourquoi utilisons-nous des connexions à authentification unique&nbsp;?</h3>\n' +
		'<p>Nous voulons rendre votre vie sur notre site Web aussi simple et agréable que possible. C\'est pourquoi nous proposons également des connexions à authentification unique. Cela vous fait gagner un temps précieux car vous n’avez besoin que d’une seule authentification. Comme vous ne devez mémoriser qu’un seul mot de passe et qu’il n’est transmis qu’une seule fois, la sécurité est également renforcée. Dans de nombreux cas, vous avez déjà enregistré automatiquement votre mot de passe à l\'aide de cookies et le processus de connexion sur notre site Web ne prend donc que quelques secondes.</p>\n' +
		'<h3>Quelles données sont stockées via les connexions à authentification unique&nbsp;?</h3>\n' +
		'<p>Bien que vous vous connectiez à notre site Web à l\'aide de ce processus de connexion spécial, l\'authentification proprement dite a lieu auprès du fournisseur d\'authentification unique concerné. En tant qu\'exploitants de sites Web, nous recevons un identifiant d\'utilisateur dans le cadre de l\'authentification. Cela enregistre que vous êtes enregistré auprès du fournisseur concerné sous cet identifiant. Cet identifiant ne peut être utilisé à aucune autre fin. D\'autres données peuvent également nous être transmises, mais cela dépend des fournisseurs d\'authentification unique utilisés. Cela dépend également des données que vous fournissez volontairement lors du processus d\'authentification et des données que vous divulguez généralement dans vos paramètres auprès du fournisseur. Il s’agit le plus souvent de données telles que votre adresse e-mail et votre nom d’utilisateur. Nous ne connaissons pas votre mot de passe, qui est nécessaire à l\'inscription, et ne sera pas enregistré par nous. Il est également important que vous sachiez que les données que nous stockons peuvent être automatiquement comparées aux données du compte utilisateur concerné lors du processus d\'inscription.</p>\n' +
		'<h3>Durée du traitement des données</h3>\n' +
		'<p>Nous vous informerons ci-dessous de la durée du traitement des données si nous disposons de plus amples informations. Par exemple, la plateforme de médias sociaux Facebook stocke les données jusqu\'à ce qu\'elles ne soient plus nécessaires à ses propres fins. Toutefois, les données client comparées à vos propres données utilisateur seront supprimées dans un délai de deux jours. En général, nous traitons les données personnelles uniquement pendant la durée absolument nécessaire à la fourniture de nos services et produits.</p>\n' +
		'<h3>Droit d\'opposition</h3>\n' +
		'<p>Vous avez également le droit et la possibilité de révoquer à tout moment votre consentement à l\'utilisation de connexions à authentification unique. Cela fonctionne généralement via les fonctions de désinscription du fournisseur. Si disponible, vous trouverez également des liens vers les fonctions de désinscription correspondantes dans nos textes sur la protection des données pour les différents outils.</p>\n' +
		'<h3>Base légale</h3>\n' +
		'<p>Si cela a été convenu avec vous et que cela a lieu dans le cadre de l\'exécution du contrat (article 6, paragraphe 1, lit. b du RGPD) et du consentement (article 6, paragraphe 1, lit. a du RGPD), nous pouvons utiliser la procédure d\'authentification unique sur encart leur base légale.</p>\n' +
		'<p>Outre le consentement, nous avons un intérêt légitime à vous proposer un processus d\'inscription simple et rapide. La base juridique est l\'article 6, paragraphe 1, lettre f du RGPD (intérêts légitimes). Cependant, nous n\'utilisons l\'enregistrement par authentification unique que si vous avez donné votre consentement.</p>\n' +
		'<p>Si vous ne souhaitez plus ce lien vers le fournisseur lors de l\'enregistrement de l\'authentification unique, veuillez l\'annuler dans votre compte utilisateur auprès du fournisseur concerné. Si vous souhaitez également supprimer des données nous concernant, vous devrez annuler votre inscription.</p>\n' +
		'<h2 id="google-single-sign-on-datenschutzerklaerung">Politique de confidentialité de l\'authentification unique de Google</h2>\n' +
		'<p>Nous utilisons également le service d\'authentification Google Single Sign-On pour nous connecter à notre site Web. Le fournisseur de services est la société américaine Facebook Inc. Pour l\'Europe, la société Google Ireland Limited (Gordon House, Barrow Street Dublin 4, Irlande) est responsable de tous les services Google.</p>\n' +
		'<p>Google traite également vos données aux États-Unis, entre autres. Google participe activement au cadre de protection des données UE-États-Unis, qui réglemente le transfert correct et sécurisé des données personnelles des citoyens de l\'UE vers les États-Unis. De plus amples informations peuvent être trouvées sur <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a> .</p>\n' +
		'<p>Google utilise également des clauses contractuelles dites types (= art. 46, paragraphes 2 et 3 du RGPD). Les clauses contractuelles types (CCT) sont des modèles fournis par la Commission européenne et visent à garantir que vos données sont conformes aux normes européennes en matière de protection des données, même si elles sont transférées vers des pays tiers (comme les États-Unis) et y sont stockées. Par le biais du cadre de protection des données UE-États-Unis et des clauses contractuelles types, Google s\'engage à respecter le niveau européen de protection des données lors du traitement de vos données pertinentes, même si les données sont stockées, traitées et gérées aux États-Unis. Ces clauses sont basées sur une décision d\'exécution de la Commission européenne. Vous pouvez trouver la résolution et les clauses contractuelles types correspondantes ici : <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a>\n' +
		'</p>\n' +
		'<p>Les conditions de traitement des données Google Ads, qui font référence aux clauses contractuelles types, sont disponibles à l\'adresse <a href="https://business.safety.google/intl/de/adsprocessorterms/" target="_blank" rel="follow noopener">https://business.safety.google/intl/de/adsprocessorterms/</a> .</p>\n' +
		'<p>Chez Google, vous pouvez révoquer votre consentement à l\'utilisation d\'enregistrements à authentification unique en utilisant la fonction de désinscription sur <a href="https://adssettings.google.com/authenticated" target="_blank" rel="follow noopener">https://adssettings.google.com/authenticated . </a>Vous pouvez en savoir plus sur les données traitées via l\'utilisation de Google Single Sign-On dans la politique de confidentialité sur <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="follow noopener">https://policies.google.com/privacy?hl=de</a> .</p>\n' +
		'<h2 id="erklaerung-verwendeter-begriffe">Explication des termes utilisés</h2>\n' +
		'<p>Nous nous efforçons toujours de rendre notre déclaration de protection des données aussi claire et compréhensible que possible. Cependant, cela n’est pas toujours facile, notamment lorsqu’il s’agit de questions techniques et juridiques. Il est souvent judicieux d\'utiliser des termes juridiques (tels que données personnelles) ou certains termes techniques (tels que cookies, adresse IP). Mais nous ne voulons pas les utiliser sans explication. Vous trouverez ci-dessous une liste alphabétique des termes importants utilisés que nous n\'avons peut-être pas suffisamment abordés dans la précédente déclaration de protection des données. Si ces termes sont tirés du RGPD et qu’il s’agit de définitions, nous citerons également ici les textes du RGPD et ajouterons nos propres explications si nécessaire.</p>\n' +
		'<h2 id="auftragsverarbeiter">Processeur</h2>\n' +
		'<p>\n' +
		'<strong>Définition selon l\'article 4 du RGPD</strong>\n' +
		'</p>\n' +
		'<p>Aux fins du présent règlement, le terme désigne :</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>« Sous-traitant » désigne</strong> une personne physique ou morale, une autorité publique, une agence ou un autre organisme qui traite des données personnelles pour le compte du responsable du traitement ;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explication :</strong> En tant que propriétaire d\'entreprise et de site Web, nous sommes responsables de toutes les données que nous traitons vous concernant. Outre les responsables, il peut également y avoir des sous-traitants. Cela inclut toute entreprise ou personne qui traite des données personnelles en notre nom. Outre les prestataires de services tels que les conseillers fiscaux, les sous-traitants peuvent également inclure des fournisseurs d\'hébergement ou de cloud, des fournisseurs de paiement ou de newsletter ou de grandes entreprises telles que Google ou Microsoft.</p>\n' +
		'<h2 id="einwilligung">consentement</h2>\n' +
		'<p>\n' +
		'<strong>Définition selon l\'article 4 du RGPD</strong>\n' +
		'</p>\n' +
		'<p>Aux fins du présent règlement, le terme désigne :</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>«&nbsp;Consentement&nbsp;»</strong> de la personne concernée désigne toute expression volontaire, éclairée et sans ambiguïté des souhaits de la personne concernée dans un cas spécifique, sous la forme d\'une déclaration ou d\'une autre action positive sans équivoque, par laquelle la personne concernée indique qu\'elle consent. au traitement des données personnelles le concernant accepte&nbsp;;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explication :</strong> En règle générale, ce consentement est donné sur les sites Web via un outil de consentement aux cookies. Vous le savez probablement. Chaque fois que vous visitez un site Internet pour la première fois, il vous sera généralement demandé via une bannière si vous acceptez le traitement des données. Vous pouvez généralement également effectuer des réglages individuels et décider vous-même quel traitement de données vous autorisez ou non. Si vous n’y consentez pas, aucune donnée personnelle vous concernant ne pourra être traitée. En principe, le consentement peut bien entendu également être donné par écrit, c\'est-à-dire pas via un outil.</p>\n' +
		'<h2 id="personenbezogene-daten">Données personnelles</h2>\n' +
		'<p>\n' +
		'<strong>Définition selon l\'article 4 du RGPD</strong>\n' +
		'</p>\n' +
		'<p>Aux fins du présent règlement, le terme désigne :</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<strong>\n' +
		'<em>« données personnelles »</em>\n' +
		'</strong>\n' +
		'<em> désigne toute information relative à une personne physique identifiée ou identifiable (ci-après « personne concernée ») ; Une personne physique est considérée comme identifiable si elle peut être identifiée directement ou indirectement, notamment par référence à un identifiant tel qu\'un nom, un numéro d\'identification, des données de localisation, un identifiant en ligne ou à une ou plusieurs caractéristiques particulières qui expriment l\'identité physique, physiologique, génétique, psychologique, économique, culturelle ou sociale de cette personne physique ;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explication :</strong> Les données personnelles sont toutes les données qui peuvent vous identifier en tant que personne. Il s\'agit généralement de données telles que&nbsp;:</p>\n' +
		'<ul>\n' +
		'<li>Nom de famille</li>\n' +
		'<li>adresse</li>\n' +
		'<li>Adresse e-mail</li>\n' +
		'<li>adresse postale</li>\n' +
		'<li>Numéro de téléphone</li>\n' +
		'<li>date de naissance</li>\n' +
		'<li>Numéros d\'identification tels que numéro de sécurité sociale, numéro d\'identification fiscale, numéro de carte d\'identité ou numéro d\'immatriculation</li>\n' +
		'<li>Coordonnées bancaires telles que le numéro de compte, les informations de crédit, les soldes des comptes et bien plus encore.</li>\n' +
		'</ul>\n' +
		'<p>Selon la Cour de Justice européenne (CJCE), votre <strong>adresse IP est également considérée comme une donnée personnelle</strong> . Grâce à votre adresse IP, les experts informatiques peuvent au moins déterminer l\'emplacement approximatif de votre appareil et par la suite vous en tant que propriétaire de la connexion. Par conséquent, le stockage d’une adresse IP nécessite également une base juridique au sens du RGPD. Il existe également des <strong>« catégories spéciales »</strong> de données personnelles qui méritent particulièrement d’être protégées. Ceux-ci inclus:</p>\n' +
		'<ul>\n' +
		'<li>origines raciales et ethniques</li>\n' +
		'<li>opinions politiques</li>\n' +
		'<li>croyances religieuses ou idéologiques</li>\n' +
		'<li>adhésion à un syndicat</li>\n' +
		'<li>données génétiques telles que les données collectées à partir d\'échantillons de sang ou de salive</li>\n' +
		'<li>données biométriques (il s\'agit d\'informations sur les caractéristiques psychologiques, physiques ou comportementales permettant d\'identifier une personne). <br>\n' +
		'Données de santé</li>\n' +
		'<li>Données sur l\'orientation sexuelle ou la vie sexuelle</li>\n' +
		'</ul>\n' +
		'<h2 id="profiling">Profilage</h2>\n' +
		'<p>\n' +
		'<strong>Définition selon l\'article 4 du RGPD</strong>\n' +
		'</p>\n' +
		'<p>Aux fins du présent règlement, le terme désigne :</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>«&nbsp;Profilage&nbsp;»</strong> désigne tout type de traitement automatisé de données personnelles, qui consiste à utiliser ces données personnelles pour évaluer certains aspects personnels relatifs à une personne physique, notamment des aspects liés au rendement au travail, à la situation économique, à la santé, aux données personnelles. Analyser ou prédire que des données personnelles les préférences, les intérêts, la fiabilité, le comportement, l\'emplacement ou les mouvements de la personne&nbsp;;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explication :</strong> Le profilage consiste à collecter diverses informations sur une personne afin d\'en savoir plus sur cette personne. Dans le secteur du Web, le profilage est souvent utilisé à des fins publicitaires ou pour des vérifications de solvabilité. Les programmes d’analyse Web ou publicitaires, par exemple, collectent des données sur votre comportement et vos intérêts sur un site Web. Il en résulte un profil d\'utilisateur spécial qui peut être utilisé pour cibler la publicité sur un groupe cible spécifique.</p>\n' +
		'<p>&nbsp;</p>\n' +
		'<h2 id="verantwortlicher">Responsable</h2>\n' +
		'<p>\n' +
		'<strong>Définition selon l\'article 4 du RGPD</strong>\n' +
		'</p>\n' +
		'<p>Aux fins du présent règlement, le terme désigne :</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>« Responsable du traitement » désigne</strong> la personne physique ou morale, l\'autorité publique, l\'agence ou tout autre organisme qui, seul ou conjointement avec d\'autres, décide des finalités et des moyens du traitement des données personnelles&nbsp;; lorsque les finalités et les moyens d\'un tel traitement sont déterminés par le droit de l\'Union ou d\'un État membre, le responsable du traitement ou les critères spécifiques pour sa nomination peuvent être prévus par le droit de l\'Union ou d\'un État membre&nbsp;;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explication :</strong> Dans notre cas, nous sommes responsables du traitement de vos données personnelles et donc le « responsable du traitement ». Si nous transmettons les données collectées à d\'autres prestataires de services pour traitement, ceux-ci sont des « sous-traitants ». Pour ce faire, une « convention de traitement des commandes (AVV) » doit être signée.</p>\n' +
		'<p>&nbsp;</p>\n' +
		'<h2 id="verarbeitung">traitement</h2>\n' +
		'<p>\n' +
		'<strong>Définition selon l\'article 4 du RGPD</strong>\n' +
		'</p>\n' +
		'<p>Aux fins du présent règlement, le terme désigne :</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<strong>\n' +
		'<em>«&nbsp;Traitement&nbsp;» désigne</em>\n' +
		'</strong>\n' +
		'<em> toute opération ou série d\'opérations réalisées avec ou sans l\'aide de procédures automatisées en relation avec des données personnelles, telles que la collecte, l\'enregistrement, l\'organisation, la structuration, le stockage, l\'adaptation ou la modification, la lecture, l\'interrogation, l\'utilisation, la communication. par transmission, distribution ou autre forme de mise à disposition, alignement ou combinaison, restriction, suppression ou destruction&nbsp;;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Remarque :</strong> Lorsque nous parlons de traitement dans notre politique de confidentialité, nous entendons tout type de traitement de données. Comme mentionné ci-dessus dans la déclaration originale du RGPD, cela inclut non seulement la collecte mais également le stockage et le traitement des données.</p>\n' +
		'<p>Tous les textes sont protégés par le droit d\'auteur.</p>\n' +
		'<p style="margin-top:15px">Source&nbsp;: Créé avec le générateur de protection des données d\'AdSimple <a href="https://www.adsimple.at/datenschutz-generator/" title="Générateur de protection des données Autriche d\'AdSimple">Autriche</a></p>\n',
	'VERIFY_MAIL': {
		'SUCCESS': 'Email vérifié avec succès.',
		'ERROR': 'Erreur de vérification de l\'email',
		'ERROR_HELP': 'Le courrier peut être renvoyé depuis l\'écran de connexion.',
		'BACK_HOME': 'Retour à l\'accueil'
	},
	'DOWNLOAD': {
		'HEADLINE': 'Télécharger l\'éditeur',
		'DESCRIPTION': 'L\'éditeur est également disponible sous forme d\'application de bureau. Cela présente l\'avantage, que la simulation est beaucoup plus rapide que sur Internet. L\'application peut être téléchargée ci-dessous.',
		'DOWNLOAD': 'Télécharger',
		'DATE': 'Date',
		'FILE_SIZE': 'Taille du fichier'
	},
	'NOT_FOUND': {
		'TEXT': 'La page demandée est introuvable.',
		'BACK': 'Retour à l\'accueil'
	},
	'MAILS': {
		'VERIFY_MAIL_REGISTER': {
			'SUBJECT': 'Bienvenue sur Logigator',
			'WELCOME': 'Bienvenue sur Logigator :',
			'PLEASE_VERIFY': 'Veuillez vérifier votre adresse e-mail.',
			'TO_DO_SO': 'Pour ce faire',
			'CLICK_HERE': 'cliquez ici',
			'HAVE_FUN': 'Amusez-vous bien à construire !'
		},
		'VERIFY_MAIL_EMAIL_UPDATE': {
			'SUBJECT': 'Vérifiez votre nouvel email',
			'CHANGED': 'Votre adresse e-mail a récemment été modifiée.',
			'PLEASE_VERIFY': 'Veuillez vérifier votre adresse e-mail.',
			'TO_DO_SO': 'Pour ce faire',
			'CLICK_HERE': 'cliquez ici',
			'HAVE_FUN': 'Amusez-vous bien à construire !'
		},
		'RESET_PASSWORD': {
			'SUBJECT': 'Réinitialiser le mot de passe',
			'TEXT': 'Vous avez demandé une réinitialisation du mot de passe pour votre compte Logigator. Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet e-mail.',
			'TO_DO_SO': 'Pour réinitialiser votre mot de passe',
			'CLICK_HERE': 'cliquez ici',
			'HAVE_FUN': 'Amusez-vous bien à construire !'
		}
	}
};
