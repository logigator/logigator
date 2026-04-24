import { ILanguage } from './index';

export const es: ILanguage = {
	'COOKIE_CONSENT': {
		'MESSAGE': 'Este sitio web utiliza cookies para garantizar la mejor experiencia de usuario posible.',
		'DISMISS': '¡Entendido!',
		'LINK': 'Más información'
	},
	'TITLE': {
		'HOME': 'Logigator - Construye y Simula Circuitos Lógicos',
		'PRIVACY_POLICY': 'Logigator - Política de Privacidad',
		'IMPRINT': 'Logigator - Pie de imprenta',
		'FEATURES': 'Logigator - Características',
		'DOWNLOAD': 'Logigator - Descargar',
		'VERIFY_EMAIL': 'Logigator - Verificar correo electrónico',
		'PROJECTS': 'Logigator - Proyectos',
		'COMPONENTS': 'Logigator - Componentes',
		'ACCOUNT': 'Logigator - Cuenta',
		'ACCOUNT_PROFILE': 'Logigator - Perfil',
		'ACCOUNT_SECURITY': 'Logigator - Seguridad',
		'ACCOUNT_DELETE': 'Logigator - Borrar Cuenta',
		'LOGIN': 'Logigator - Iniciar Sesión',
		'REGISTER': 'Logigator - Registrarse',
		'EXAMPLES': 'Logigator - Ejemplos',
		'COMMUNITY': 'Logigator - Comunidad',
		'RESET_PASSWORD': 'Logigator - Restablecer contraseña'
	},
	'SITE_HEADER': {
		'DOWNLOAD': 'Descargar',
		'FEATURES': 'Características',
		'PROJECTS': 'Mis Proyectos',
		'COMPONENTS': 'Mis Componentes',
		'COMMUNITY': 'Comunidad',
		'LOGIN': 'Iniciar Sesión',
		'REGISTER': 'Registrarse'
	},
	'SETTINGS_DROPDOWN': {
		'DARK_MODE': 'Modo Oscuro',
		'LANGUAGE': 'Idioma',
		'PROJECTS': 'Proyectos',
		'COMPONENTS': 'Componentes',
		'ACCOUNT': 'Cuenta',
		'LOGOUT': 'Cerrar Sesión'
	},
	'FOOTER': {
		'DATA_POLICY': 'Política de Datos',
		'IMPRINT': 'Imprimir',
		'CONTRIBUTING': 'Contribuyendo'
	},
	'HOME': {
		'INTRO': {
			'DESCRIPTION': 'Construye, simula y gestiona circuitos lógicos complejos de forma gratuita.',
			'BUTTON': 'Comenzar a Construir Ahora'
		},
		'FEATURES': {
			'TITLE': 'Características',
			'DESCRIPTION': 'Construye y simula tus propios circuitos con Logigator, una herramienta en línea simple pero poderosa.',
			'PERFORMANCE': 'Rendimiento',
			'PERFORMANCE_DES': 'El editor de Logigator puede manejar incluso los proyectos más grandes con facilidad gracias a WebAssembly y WebGL.',
			'SUBCIRCUITS': 'Subcircuitos',
			'SUBCIRCUITS_DES': 'Crea subcircuitos y úsalos en todos tus proyectos para ayudar a mantenerlos organizados.',
			'SHARE': 'Compartir Proyectos',
			'SHARE_DES': 'Comparte tus circuitos con otros usuarios para que puedan aprender de tu trabajo.',
			'IMAGES': 'Exportar Imágenes',
			'IMAGES_DES': 'Con Logigator puedes exportar imágenes de alta resolución en tres formatos diferentes (SVG, PNG, JPG) para usarlas en cualquier lugar.'
		},
		'EXAMPLES': {
			'TITLE': 'Circuitos de Ejemplo',
			'DESCRIPTION': 'Aprende a diseñar circuitos simples y más complejos a partir de nuestros ejemplos.',
			'MORE': 'Ver Más Ejemplos'
		},
		'VIDEO': {
			'TITLE': '¿Qué son los circuitos lógicos?',
			'DESCRIPTION': 'Si no sabes qué son las compuertas lógicas o los circuitos lógicos, hemos animado una breve explicación para que la veas.'
		},
		'SHARES': {
			'PROJECTS_TITLE': 'Proyectos de la Comunidad',
			'PROJECTS_DESCRIPTION': 'Explora otros proyectos creados por nuestra comunidad. Tu proyecto podría ser el próximo en esta lista.',
			'COMPS_TITLE': 'Componentes de la Comunidad',
			'COMPS_DESCRIPTION': 'Explora otros componentes creados por nuestra comunidad. Pueden ser útiles para ti.',
			'MORE_PROJECTS': 'Ver Más Proyectos',
			'MORE_COMPONENTS': 'Ver Más Componentes'
		},
		'PROJECT_TEASERS': {
			'VIEW': 'Ver'
		}
	},
	'EXAMPLES': {
		'VIEW': 'Ver Ejemplo',
		'CLONE': 'Clonar Ejemplo'
	},
	'FEATURES': {
		'WHAT_IS': {
			'TITLE': '¿Qué es Logigator',
			'VIDEO': 'weTeJLMGq_Q',
			'TEXT': "Logigator es un simulador en línea para compuertas lógicas que permite al usuario construir y simular circuitos con compuertas lógicas. Por ejemplo, se puede construir semisumadores y sumadores completos que pueden ser utilizados para el aprendizaje. Ya sea que uno quiera experimentar y explorar funciones booleanas o diseñar circuitos nuevos y complejos, Logigator es la herramienta adecuada. <br> Además, Logigator ofrece un alto rendimiento incluso con proyectos a gran escala. Al utilizar 'WebAssembly' (https://webassembly.org/), el sitio web puede alcanzar velocidades de simulación que no serían posibles en un navegador de otra manera."
		},
		'GENERAL': {
			'TITLE': 'General',
			'VIDEO': 'tX7HT_0MZRo',
			'TEXT': 'El editor se puede acceder en https://logigator.com/editor y se puede utilizar para diseñar y simular circuitos. <br> Para colocar un elemento, simplemente selecciona el elemento deseado del kit de construcción en el lado izquierdo de la ventana. Las compuertas básicas consisten en: AND, OR, XOR, NOT, así como un retardo que no cambia la señal de entrada y un reloj, que emite una señal en intervalos periódicos. Naturalmente, también hay elementos más complejos que no se mencionan aquí. Después de seleccionar un elemento, se puede colocar haciendo clic en cualquier lugar del lienzo. Utilizando la herramienta de selección se puede seleccionar un elemento y cambiar la configuración en el cuadro en la esquina inferior derecha. Estas configuraciones varían de un componente a otro. La herramienta de cableado se puede utilizar para conectar los elementos.'
		},
		'CUSTOM_COMPS': {
			'TITLE': 'Componentes Personalizados',
			'VIDEO': 'fSErH93I-Wg',
			'TEXT': 'Uno podría querer usar una parte de un circuito varias veces. Para simplificar este proceso, es posible definir componentes personalizados, que pueden colocarse fácilmente varias veces e incluso pueden usarse en otros proyectos. <br> Hay dos tipos de componentes de enchufe: entradas y salidas. Al colocar estos componentes, se pueden marcar las entradas y salidas de un componente personalizado. Además, partes de circuitos pueden ser etiquetadas para una mejor visión general.'
		},
		'SIMULATION': {
			'TITLE': 'Modo de Simulación',
			'VIDEO': 'WjpChcxn18k',
			'TEXT': "El modo de simulación se puede utilizar para probar y simular circuitos. Para cambiar al modo de simulación, simplemente presiona el botón 'Iniciar Simulación'. Para iniciar la simulación, simplemente presiona el botón de reproducción. Ahora puedes interactuar con el circuito. En caso de que quieras ver qué está haciendo el circuito, puedes pausar la simulación y probarlo paso a paso. Para volver al estado original, simplemente presiona el botón de parada. Por defecto, la simulación se ejecutará tan rápido como sea posible. Sin embargo, la velocidad del reloj puede ser cambiada simplemente ingresando la velocidad deseada o bloqueándola a la frecuencia de la pantalla. La composición de los componentes personalizados se puede observar simplemente haciendo clic en ellos."
		},
		'SAVING': {
			'TITLE': 'Guardando Proyectos',
			'VIDEO': 'VtS4E0L2MyU',
			'TEXT': 'Los proyectos y componentes pueden guardarse localmente como un archivo o en la nube, lo que permite la edición en múltiples dispositivos. Para guardar proyectos en línea, el usuario debe estar registrado, lo que también permite compartir proyectos con otros usuarios.'
		}
	},
	'LOGIN_FORM': {
		'HEADLINE': 'Inicia Sesión Aquí',
		'EMAIL': 'Correo Electrónico',
		'EMAIL_ERR_REQUIRED': 'Se requiere correo electrónico.',
		'EMAIL_ERR_INVALID': 'Por favor, introduce una dirección de correo electrónico válida.',
		'EMAIL_ERR_NO_USER': 'El correo electrónico no existe.',
		'EMAIL_ERR_NOT_VERIFIED': 'La dirección de correo electrónico no está verificada.',
		'PASSWORD': 'Contraseña',
		'PASSWORD_ERR_REQUIRED': 'Se requiere contraseña.',
		'PASSWORD_ERR_INVALID': 'La contraseña no es válida.',
		'ERR_EMAIL_TAKEN': 'El correo electrónico ya está registrado',
		'ERR_VERIFICATION_MAIL': 'No se pudo enviar el correo de verificación.',
		'ERR_UNKNOWN': 'Ha ocurrido un error desconocido.',
		'LOGIN_BUTTON': 'INICIAR SESIÓN',
		'RESEND_BUTTON': 'Reenviar correo de verificación',
		'OR': 'o',
		'FORGOT_PASSWORD': '¿Olvidaste tu contraseña?'
	},
	'REGISTER_FORM': {
		'HEADLINE': 'Regístrate Aquí',
		'EMAIL': 'Correo Electrónico',
		'EMAIL_ERR_REQUIRED': 'Se requiere correo electrónico.',
		'EMAIL_ERR_INVALID': 'Por favor, introduce una dirección de correo electrónico válida.',
		'EMAIL_ERR_TAKEN': 'El correo electrónico ya está registrado',
		'USERNAME': 'Nombre de Usuario',
		'USERNAME_ERR_REQUIRED': 'Se requiere nombre de usuario.',
		'USERNAME_ERR_MIN': 'El nombre de usuario debe contener un mínimo de dos caracteres.',
		'USERNAME_ERR_MAX': 'El nombre de usuario puede contener un máximo de 20 caracteres.',
		'USERNAME_ERR_PATTERN': 'El nombre de usuario solo puede contener a-z, A-Z, 0-9, _ o -',
		'PASSWORD': 'Contraseña',
		'PASSWORD_ERR_REQUIRED': 'Se requiere contraseña.',
		'PASSWORD_ERR_MIN': 'La contraseña debe contener un mínimo de ocho caracteres.',
		'PASSWORD_ERR_COMPLEXITY': 'La contraseña debe contener letras y dígitos.',
		'PASSWORD_REPEAT': 'Repetir Contraseña',
		'PASSWORD_REPEAT_ERR_REQUIRED': 'La contraseña debe repetirse.',
		'PASSWORD_REPEAT_ERR': 'Las contraseñas no coinciden.',
		'PRIVACY_POLICY': "Al hacer clic en 'REGISTRARSE', aceptas que has leído y aceptado nuestra política de datos.",
		'REGISTER_BUTTON': 'REGISTRARSE',
		'OR': 'o',
		'ERR_EMAIL_TAKEN': 'El correo electrónico ya está registrado',
		'ERR_VERIFICATION_MAIL': 'No se pudo enviar el correo de verificación, inténtalo nuevamente al iniciar sesión.',
		'ERR_UNKNOWN': 'Ha ocurrido un error desconocido.'
	},
	'RESET_PASSWORD_FORM': {
		'HEADLINE': 'Establece una nueva contraseña',
		'PASSWORD': 'Contraseña',
		'PASSWORD_ERR_REQUIRED': 'La contraseña es obligatoria.',
		'PASSWORD_ERR_MIN': 'La contraseña debe contener un mínimo de ocho caracteres.',
		'PASSWORD_ERR_COMPLEXITY': 'La contraseña debe contener letras y dígitos.',
		'PASSWORD_REPEAT': 'Repetir contraseña',
		'PASSWORD_REPEAT_ERR_REQUIRED': 'La contraseña debe repetirse.',
		'PASSWORD_REPEAT_ERR': 'Las contraseñas no coinciden.',
		'SUBMIT': 'RESTABLECER CONTRASEÑA',
		'ERR_TOKEN_INVALID': 'El token de restablecimiento de contraseña es inválido o ha expirado.',
		'ERR_UNKNOWN': 'Se ha producido un error desconocido.'
	},
	'REQUEST_PASSWORD_RESET_FORM': {
		'HEADLINE': 'Restablece tu contraseña',
		'EMAIL': 'Correo Electrónico',
		'EMAIL_ERR_REQUIRED': 'El correo electrónico es obligatorio.',
		'EMAIL_ERR_INVALID': 'Por favor, introduce una dirección de correo electrónico válida.',
		'EMAIL_ERR_NO_USER': 'El correo electrónico no existe.',
		'SUBMIT': 'RESTABLECER CONTRASEÑA',
		'ERR_RESET_MAIL': 'No se pudo enviar el correo de restablecimiento.',
		'ERR_UNKNOWN': 'Se ha producido un error desconocido.'
	},
	'COMMUNITY': {
		'NAV': {
			'PROJECTS': 'Proyectos',
			'COMPONENTS': 'Componentes'
		},
		'LATEST': 'Más Reciente',
		'POPULARITY': 'Popularidad',
		'SEARCH': 'Buscar',
		'COMPONENTS': 'Componentes Compartidos',
		'PROJECTS': 'Proyectos Compartidos',
		'VIEW': 'Ver Detalles',
		'OPEN': 'Abrir en Editor',
		'CLONE': 'Clonar',
		'NO_DESCRIPTION': 'No se proporcionó ninguna descripción.',
		'USER': {
			'MEMBER_SINCE': 'Miembro desde',
			'COMPONENTS': 'Componentes',
			'PROJECTS': 'Proyectos',
			'STARED_COMPONENTS': 'Componentes Favoritos',
			'STARED_PROJECTS': 'Proyectos Favoritos',
			'NO_ITEMS': 'Nada que mostrar en esta categoría.'
		}
	},
	'USERSPACE': {
		'NAV': {
			'PROJECTS': 'Proyectos',
			'COMPONENTS': 'Componentes',
			'ACCOUNT': 'Cuenta'
		},
		'LIST': {
			'SEARCH': 'Buscar',
			'LAST_EDITED': 'Última edición: '
		},
		'PROJECTS': {
			'TITLE': 'Mis proyectos',
			'ERROR': 'Aún no has definido ningún proyecto.'
		},
		'COMPONENTS': {
			'TITLE': 'Mis componentes',
			'ERROR': 'Aún no has definido ningún componente.'
		},
		'ACCOUNT': {
			'NAV': {
				'PROFILE': 'Perfil',
				'SECURITY': 'Seguridad',
				'DELETE': 'Eliminar cuenta'
			},
			'PROFILE': {
				'DELETE_IMAGE': 'Eliminar imagen',
				'CHANGE_IMAGE': 'Cambiar imagen',
				'EMAIL': 'Correo electrónico',
				'EMAIL_ERR_REQUIRED': 'El correo electrónico es obligatorio.',
				'EMAIL_ERR_INVALID': 'Por favor, introduce una dirección de correo electrónico válida.',
				'EMAIL_ERR_TAKEN': 'El correo electrónico ya está en uso.',
				'EMAIL_ERR_CHANGE': 'Este es tu correo electrónico actual.',
				'USERNAME': 'Nombre de usuario',
				'USERNAME_ERR_REQUIRED': 'El nombre de usuario es obligatorio.',
				'USERNAME_ERR_MIN': 'El nombre de usuario debe tener un mínimo de dos caracteres.',
				'USERNAME_ERR_MAX': 'El nombre de usuario puede contener un máximo de 20 caracteres.',
				'USERNAME_ERR_CHANGE': 'Este es tu nombre de usuario actual.',
				'SAVE': 'Guardar'
			},
			'SECURITY': {
				'CONNECTED_ACCOUNTS': 'Cuentas conectadas',
				'CONNECT_NOW': 'Conectar ahora',
				'CONNECTED': 'Conectado',
				'PASSWORD_EXPLANATION': 'Puedes añadir una contraseña a tu cuenta para poder usarla para iniciar sesión. Tu cuenta seguirá conectada a todas las demás cuentas de redes sociales.',
				'CURRENT_PASSWORD': 'Contraseña actual',
				'CURRENT_PASSWORD_ERR_REQUIRED': 'La contraseña actual es obligatoria.',
				'CURRENT_PASSWORD_ERR_INVALID': 'La contraseña no es válida.',
				'PASSWORD': 'Contraseña',
				'PASSWORD_ERR_REQUIRED': 'La contraseña es obligatoria.',
				'PASSWORD_ERR_MIN': 'La contraseña debe tener un mínimo de ocho caracteres.',
				'PASSWORD_ERR_COMPLEXITY': 'La contraseña debe contener letras y dígitos.',
				'PASSWORD_REPEAT': 'Repetir contraseña',
				'PASSWORD_REPEAT_ERR_REQUIRED': 'La contraseña debe repetirse.',
				'PASSWORD_REPEAT_ERR': 'Las contraseñas no coinciden.',
				'ERR_UNKNOWN': 'Se ha producido un error desconocido.',
				'SAVE': 'Guardar'
			},
			'DELETE': {
				'HEADLINE': 'Eliminar cuenta',
				'MESSAGE': 'Si eliminas tu cuenta, se eliminarán todos tus proyectos y componentes. No será posible recuperar ningún dato después de la eliminación.',
				'BUTTON': 'Eliminar cuenta'
			}
		}
	},
	'YOUTUBE_OVERLAY': {
		'CTA': 'Haz clic para ver el vídeo'
	},
	'POPUP': {
		'LOGIN': {
			'TITLE': 'Iniciar sesión'
		},
		'REGISTER': {
			'TITLE': 'Registrarse'
		},
		'PROJECT_COMP_CREATE': {
			'COMP_TITLE': 'Nuevo componente',
			'PROJECT_TITLE': 'Nuevo proyecto',
			'NAME': 'Nombre',
			'NAME_ERR_REQUIRED': 'El nombre es obligatorio.',
			'NAME_ERR_MAX': 'El nombre puede contener un máximo de 20 caracteres.',
			'DESCRIPTION': 'Descripción',
			'DESCRIPTION_ERR_MAX': 'La descripción es demasiado larga.',
			'SYMBOL': 'Símbolo',
			'SYMBOL_ERR_REQUIRED': 'El símbolo es obligatorio.',
			'SYMBOL_ERR_MAX': 'El símbolo puede contener un máximo de 5 caracteres.',
			'CREATE': 'Crear',
			'PUBLIC': 'Compartir públicamente',
			'PUBLIC_EXPLANATION': "Si se activa 'Compartir públicamente', el proyecto se mostrará en todas las listas públicas."
		},
		'PROJECT_COMP_EDIT': {
			'PROJECT_TITLE': 'Editar proyecto',
			'COMP_TITLE': 'Editar componente',
			'NAME': 'Nombre',
			'NAME_ERR_REQUIRED': 'El nombre es obligatorio',
			'NAME_ERR_MAX': 'El nombre es demasiado largo',
			'DESCRIPTION': 'Descripción',
			'DESCRIPTION_ERR_MAX': 'La descripción es demasiado larga',
			'SYMBOL': 'Símbolo',
			'SYMBOL_ERR_REQUIRED': 'El símbolo es obligatorio',
			'SYMBOL_ERR_MAX': 'El símbolo es demasiado largo',
			'SAVE': 'Guardar'
		},
		'PROJECT_COMP_INFO': {
			'TITLE': 'Información',
			'NAME': 'Nombre',
			'FORKED': 'Bifurcado desde',
			'CREATED': 'Creado',
			'MODIFIED': 'Última modificación',
			'INPUTS': 'Entradas',
			'OUTPUTS': 'Salidas',
			'SYMBOL': 'Símbolo',
			'DEPENDENCIES': 'Dependencias',
			'DEPENDENT_PROJECTS': 'Proyectos dependientes',
			'DEPENDENT_COMPONENTS': 'Componentes dependientes',
			'NO_DEPENDENCIES': 'N/D',
			'DESCRIPTION': 'Descripción',
			'COMMUNITY_PAGE': 'Ir a la página de la comunidad'
		},
		'PROJECT_COMP_DELETE': {
			'TITLE': 'Confirmar eliminación',
			'DELETE': 'Confirmar eliminación',
			'CANCEL': 'Cancelar',
			'CONFIRM_PROJECT': '¿Realmente quieres eliminar este proyecto?',
			'CONFIRM_COMP': '¿Realmente quieres eliminar este componente?',
			'WARNING_COMP': 'Este componente se utiliza en los siguientes proyectos o componentes:',
			'WARNING_COMP_DELETE': 'Si se elimina el componente, se eliminará de esos proyectos y componentes.',
			'PROJECTS': 'Proyectos',
			'COMPONENTS': 'Componentes'
		},
		'PROJECT_COMP_SHARE': {
			'TITLE': 'Compartir',
			'EXPLANATION': "Cualquiera que tenga el enlace podrá ver, clonar, pero no editar el proyecto. Si se activa 'Compartir públicamente', el proyecto se mostrará en todas las listas públicas.",
			'LINK': 'Enlace para compartir',
			'PUBLIC': 'Compartir públicamente',
			'REGENERATE': 'Regenerar',
			'REGENERATE_WARN': 'Regenerar el enlace invalida el enlace anterior.',
			'COPY': 'Copiar',
			'SAVE': 'Guardar',
			'CANCEL': 'Cancelar'
		},
		'DELETE_IMAGE': {
			'TITLE': 'Eliminar imagen',
			'DELETE': 'Confirmar eliminación',
			'CANCEL': 'Cancelar',
			'CONFIRM': '¿Realmente quieres eliminar tu imagen de perfil?'
		},
		'CHANGE_IMAGE': {
			'TITLE': 'Cambiar imagen',
			'FILE': 'Arrastra tu imagen aquí.',
			'SAVE': 'Guardar',
			'SAVE_ERROR': 'Se ha producido un error desconocido.'
		},
		'DELETE_ACCOUNT': {
			'TITLE': 'Eliminar cuenta',
			'DELETE': 'Confirmar eliminación',
			'CANCEL': 'Cancelar',
			'CONFIRM': '¿Realmente quieres eliminar tu cuenta? Esta acción no se puede revertir.'
		}
	},
	'INFO_POPUP': {
		'LOCAL_REGISTER': {
			'TITLE': 'Verificación de correo electrónico',
			'LINE_1': 'Bienvenido a Logigator.',
			'LINE_2': 'Por favor, revisa tu bandeja de entrada y verifica tu correo electrónico para completar el proceso de registro.',
			'OK_BUTTON': 'Aceptar'
		},
		'EMAIL_UPDATED': {
			'TITLE': 'Verificación de correo electrónico',
			'LINE_1': 'Tu correo electrónico fue cambiado.',
			'LINE_2': 'Por favor, revisa tu bandeja de entrada y verifica tu nuevo correo electrónico.',
			'OK_BUTTON': 'Aceptar'
		},
		'PASSWORD_CHANGED': {
			'TITLE': 'Contraseña establecida',
			'LINE_1': 'La contraseña se cambió o estableció correctamente.',
			'OK_BUTTON': 'Aceptar'
		},
		'ACCOUNT_DELETED': {
			'TITLE': 'Cuenta eliminada',
			'LINE_1': 'Tu cuenta ha sido eliminada correctamente.',
			'OK_BUTTON': 'Aceptar'
		},
		'PASSWORD_RESET_MAIL_SENT': {
			'TITLE': 'Correo de restablecimiento enviado',
			'HEADLINE': 'Correo de restablecimiento enviado',
			'BODY': 'Si existe una cuenta con el correo introducido, se ha enviado un correo para restablecer la contraseña. Por favor, revisa tu bandeja de entrada.',
			'OK_BUTTON': 'Aceptar'
		},
		'PASSWORD_RESET': {
			'TITLE': 'Contraseña restablecida',
			'HEADLINE': 'Contraseña restablecida',
			'BODY': 'Tu contraseña ha sido restablecida correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.',
			'OK_BUTTON': 'Aceptar'
		}
	},
	'IMPRINT': {
		'HEAD': 'Impresión',
		'INFORMATION_OBLIGATION': 'Obligación de información según el §5 de la Ley de Comercio Electrónico, el §14 del Código Corporativo, el §63 de las Normativas Comerciales y la Obligación de Divulgación según el §25 de la Ley de Medios de Comunicación.',
		'VIENNA': 'Viena',
		'AUSTRIA': 'Austria',
		'SOURCE_1': 'Fuente: Creado con el generador de impresiones de',
		'SOURCE_2': 'en colaboración con',
		'CONTENTS_HEAD': 'Responsabilidad por los contenidos de este sitio web',
		'CONTENTS_1': 'Estamos constantemente desarrollando los contenidos de este sitio web y nos esforzamos por proporcionar información correcta y actualizada. Desafortunadamente, no podemos asumir ninguna responsabilidad por la corrección de todos los contenidos de este sitio web, especialmente por aquellos proporcionados por terceros.',
		'CONTENTS_2': 'Si encuentras algún contenido problemático o ilegal, por favor contáctanos de inmediato, encontrarás los detalles de contacto en la impresión.',
		'LINKS_HEAD': 'Responsabilidad por enlaces en este sitio web',
		'LINKS_1': 'Nuestro sitio web contiene enlaces a otros sitios web cuyos contenidos no somos responsables. La responsabilidad por los sitios web vinculados no existe para nosotros según',
		'LINKS_1_1': ', porque no teníamos conocimiento de actividades ilegales y no hemos notado tal ilegalidad y eliminaríamos los enlaces inmediatamente si nos enteramos de alguna ilegalidad.',
		'LINKS_2': 'Si encuentras enlaces ilegales en nuestro sitio web, te pedimos que nos contactes, encontrarás los detalles de contacto en la impresión.',
		'COPYRIGHT_HEAD': 'Aviso de derechos de autor',
		'COPYRIGHT_1': 'Iconos creados por',
		'COPYRIGHT_1_1': 'de',
		'COPYRIGHT_2': 'Todos los contenidos de este sitio web (imágenes, fotos, textos, vídeos) están sujetos a derechos de autor. Si es necesario, perseguiremos legalmente el uso no autorizado de partes del contenido de nuestro sitio.'
	},
	'PRIVACY_POLICY': '<h1>Protección de Datos</h1>\n' +
		'<h2>Tabla de contenido</h2>\n' +
		'<ul>\n' +
		'<li>\n' +
		'<a href="#einleitung-ueberblick" target="_top">Intruducción y resumen general</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#anwendungsbereich">Ámbito de aplicación</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#rechtsgrundlagen">Base legal</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#speicherdauer">Periodo de almacenamiento</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#rechte-dsgvo">Derechos según el Reglamento General de Protección de Datos</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#datenuebertragung-drittlaender">Transferencia de datos a terceros países</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#cookies">Galletas</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#web-analytics-einleitung">Introducción a la analítica web</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#content-delivery-networks-einleitung">Introducción a las redes de entrega de contenido</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#single-sign-on-anmeldungen-einleitung">Introducción al inicio de sesión único</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#erklaerung-verwendeter-begriffe">Explicación de los términos utilizados.</a>\n' +
		'</li>\n' +
		'</ul>\n' +
		'<h2 id="einleitung-ueberblick">Intruducción y resumen general</h2>\n' +
		'<p>Hemos redactado esta declaración de protección de datos (versión 09.03.2024-112741413) para explicarle, de acuerdo con los requisitos del <a href="https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679&amp;from=DE&amp;tid=112741413#d1e2269-1-1" target="_blank" rel="noopener">Reglamento general de protección de datos (UE) 2016/679</a> y las leyes nacionales aplicables, qué datos personales (datos para En resumen, nosotros, como responsables del tratamiento, y los encargados del tratamiento encargados por nosotros (por ejemplo, proveedores), procesamos, procesaremos en el futuro y qué opciones legales tiene usted. Los términos utilizados deben entenderse como neutrales en cuanto al género. <br>\n' +
		'<strong>En resumen:</strong> Le informamos exhaustivamente sobre los datos que procesamos sobre usted.</p>\n' +
		'<p>Las políticas de privacidad suelen parecer muy técnicas y utilizan términos legales. Sin embargo, esta declaración de protección de datos pretende describir lo más importante para usted de la forma más sencilla y transparente posible. En la medida en que promueva la transparencia, <strong>los términos técnicos se explican de manera fácil de leer</strong> , se proporcionan enlaces a más información y se utilizan <strong>gráficos . </strong>Por lo tanto, le informamos de forma clara y sencilla que solo procesamos datos personales en el marco de nuestras actividades comerciales si existe una base legal correspondiente. Esto ciertamente no es posible si se hacen declaraciones lo más breves, poco claras y de carácter jurídico-técnico posible, como suele ser habitual en Internet en materia de protección de datos. Espero que las siguientes explicaciones le resulten interesantes e informativas y tal vez haya uno o dos datos que no conocía antes. <br>\n' +
		'Si aún tiene preguntas, le rogamos que se ponga en contacto con el organismo responsable que se menciona a continuación o en el aviso legal, siga los enlaces existentes y consulte más información en sitios de terceros. Por supuesto, también puede encontrar nuestros datos de contacto en el aviso legal.</p>\n' +
		'<h2 id="anwendungsbereich">Ámbito de aplicación</h2>\n' +
		'<p>Esta declaración de protección de datos se aplica a todos los datos personales procesados ​​por nosotros en la empresa y a todos los datos personales que procesan las empresas encargadas por nosotros (procesadores). Por datos personales nos referimos a información en el sentido del artículo 4, número 1 del RGPD, como el nombre de una persona, la dirección de correo electrónico y la dirección postal. El tratamiento de datos personales garantiza que podamos ofrecer y facturar nuestros servicios y productos, ya sea online u offline. El alcance de esta declaración de protección de datos incluye:</p>\n' +
		'<ul>\n' +
		'<li>todas las presencias en línea (sitios web, tiendas en línea) que operamos</li>\n' +
		'<li>Apariciones en redes sociales y comunicación por correo electrónico.</li>\n' +
		'<li>aplicaciones móviles para teléfonos inteligentes y otros dispositivos</li>\n' +
		'</ul>\n' +
		'<p>\n' +
		'<strong>En resumen:</strong> la declaración de protección de datos se aplica a todos los ámbitos en los que dentro de la empresa se procesan datos personales de forma estructurada a través de los canales mencionados. Si entablamos relaciones legales con usted fuera de estos canales, le informaremos por separado si es necesario.</p>\n' +
		'<h2 id="rechtsgrundlagen">Base legal</h2>\n' +
		'<p>En la siguiente declaración de protección de datos le proporcionamos información transparente sobre los principios y normas legales, es decir, las bases legales del Reglamento General de Protección de Datos, que nos permiten procesar datos personales. <br>\n' +
		'En lo que respecta al derecho de la UE, nos remitimos al REGLAMENTO (UE) 2016/679 DEL PARLAMENTO EUROPEO Y DEL CONSEJO de 27 de abril de 2016. Por supuesto, puede acceder a este Reglamento general de protección de datos de la UE en línea en EUR-Lex, el acceso a la legislación de la UE, leer en <a href="https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=celex%3A32016R0679">https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=celex%3A32016R0679</a> .</p>\n' +
		'<p>Solo procesamos sus datos si se aplica al menos una de las siguientes condiciones:</p>\n' +
		'<ol>\n' +
		'<li>\n' +
		'<strong>Consentimiento</strong> (artículo 6, apartado 1, letra a del RGPD): nos ha dado su consentimiento para procesar datos para un fin específico. Un ejemplo sería guardar los datos que ingresó en un formulario de contacto.</li>\n' +
		'<li>\n' +
		'<strong>Contrato</strong> (artículo 6, apartado 1, letra b del RGPD): Para cumplir con un contrato u obligaciones precontractuales con usted, procesamos sus datos. Por ejemplo, si celebramos un contrato de compra con usted, necesitamos información personal por adelantado.</li>\n' +
		'<li>\n' +
		'<strong>Obligación legal</strong> (artículo 6, apartado 1, letra c del RGPD): si estamos sujetos a una obligación legal, procesamos sus datos. Por ejemplo, estamos legalmente obligados a conservar las facturas a efectos contables. Suelen contener datos personales.</li>\n' +
		'<li>\n' +
		'<strong>Intereses legítimos</strong> (artículo 6, apartado 1, letra f del RGPD): en el caso de intereses legítimos que no limiten sus derechos fundamentales, nos reservamos el derecho de procesar datos personales. Por ejemplo, necesitamos procesar ciertos datos para poder operar nuestro sitio web de forma segura y económicamente eficiente. Por lo tanto, este procesamiento es un interés legítimo.</li>\n' +
		'</ol>\n' +
		'<p>Otras condiciones, como la percepción de las grabaciones como de interés público y el ejercicio de la autoridad pública, así como la protección de intereses vitales, generalmente no se aplican a nosotros. Si dicha base jurídica es relevante, se mostrará en el lugar correspondiente.</p>\n' +
		'<p>Además del reglamento de la UE, también se aplican las leyes nacionales:</p>\n' +
		'<ul>\n' +
		'<li>En <strong>Austria</strong> se trata de la Ley Federal de Protección de las Personas Físicas en relación con el Tratamiento de Datos Personales ( <strong>Ley de Protección de Datos</strong> ), o <strong>DSG</strong> para abreviar .</li>\n' +
		'<li>En <strong>Alemania</strong> se aplica la <strong>Ley Federal de Protección de Datos </strong><strong>(BDSG</strong> , por sus siglas en inglés) .</li>\n' +
		'</ul>\n' +
		'<p>Si se aplican otras leyes regionales o nacionales, le informaremos sobre ellas en las siguientes secciones.</p>\n' +
		'<h2 id="speicherdauer">Periodo de almacenamiento</h2>\n' +
		'<p>Nuestro criterio general es que solo almacenamos datos personales durante el tiempo que sea absolutamente necesario para proporcionar nuestros servicios y productos. Esto significa que eliminamos los datos personales tan pronto como el motivo del procesamiento de datos ya no existe. En algunos casos, estamos obligados legalmente a almacenar ciertos datos incluso después de que haya cesado el propósito original, por ejemplo, con fines contables.</p>\n' +
		'<p>Si desea que se eliminen sus datos o revocar su consentimiento al tratamiento de datos, los datos se eliminarán a la mayor brevedad posible y salvo que exista obligación de conservarlos.</p>\n' +
		'<p>Le informaremos a continuación sobre la duración específica del procesamiento de datos respectivo, siempre que tengamos más información.</p>\n' +
		'<h2 id="rechte-dsgvo">Derechos según el Reglamento General de Protección de Datos</h2>\n' +
		'<p>De conformidad con los artículos 13, 14 RGPD, le informamos de los siguientes derechos que le corresponden para que los datos sean tratados de forma leal y transparente:</p>\n' +
		'<ul>\n' +
		'<li>Según el artículo 15 del RGPD, usted tiene derecho a saber si estamos procesando sus datos. Si este es el caso, tiene derecho a recibir una copia de los datos y a conocer la siguiente información:\n' +
		'<ul>\n' +
		'<li>con qué finalidad llevamos a cabo el tratamiento;</li>\n' +
		'<li>las categorías, es decir, los tipos de datos que se procesan;</li>\n' +
		'<li>quién recibe estos datos y, si los datos se transfieren a terceros países, cómo se puede garantizar la seguridad;</li>\n' +
		'<li>durante cuánto tiempo se almacenan los datos;</li>\n' +
		'<li>la existencia del derecho de rectificación, supresión o limitación del tratamiento y del derecho a oponerse al tratamiento;</li>\n' +
		'<li>que puede presentar una queja ante una autoridad supervisora ​​(los enlaces a estas autoridades se pueden encontrar a continuación);</li>\n' +
		'<li>el origen de los datos si no los recopilamos de usted;</li>\n' +
		'<li>si se realiza una elaboración de perfiles, es decir, si los datos se evalúan automáticamente para crear un perfil personal para usted.</li>\n' +
		'</ul>\n' +
		'</li>\n' +
		'<li>Según el artículo 16 del RGPD, usted tiene derecho a rectificar sus datos, lo que significa que debemos corregirlos si encuentra errores.</li>\n' +
		'<li>Según el artículo 17 del RGPD, tienes derecho a la eliminación (“derecho al olvido”), lo que significa específicamente que puedes solicitar la eliminación de tus datos.</li>\n' +
		'<li>Según el artículo 18 del RGPD, usted tiene derecho a restringir el procesamiento, lo que significa que solo podemos almacenar los datos pero no utilizarlos más.</li>\n' +
		'<li>Según el artículo 20 del RGPD, usted tiene derecho a la portabilidad de sus datos, lo que significa que, previa solicitud, le proporcionaremos sus datos en un formato común.</li>\n' +
		'<li>Según el artículo 21 del RGPD, usted tiene derecho a oponerse y, una vez ejercido, supondrá un cambio en el tratamiento.\n' +
		'<ul>\n' +
		'<li>Si el procesamiento de sus datos se basa en el artículo 6, párrafo 1, letra e (interés público, ejercicio del poder público) o en el artículo 6, párrafo 1, letra f (interés legítimo), puede oponerse al procesamiento. Luego comprobaremos lo antes posible si podemos cumplir legalmente con esta objeción.</li>\n' +
		'<li>Si los datos se utilizan para realizar publicidad directa, usted puede oponerse a este tipo de procesamiento de datos en cualquier momento. Entonces ya no podremos utilizar sus datos para marketing directo.</li>\n' +
		'<li>Si los datos se utilizan para la elaboración de perfiles, usted puede oponerse a este tipo de procesamiento de datos en cualquier momento. Entonces ya no podremos utilizar sus datos para elaborar perfiles.</li>\n' +
		'</ul>\n' +
		'</li>\n' +
		'<li>Según el artículo 22 del RGPD, usted puede tener derecho a no estar sujeto a una decisión basada únicamente en un procesamiento automatizado (por ejemplo, elaboración de perfiles).</li>\n' +
		'<li>Según el artículo 77 del RGPD, usted tiene derecho a presentar una reclamación. Esto significa que puede presentar una queja ante la autoridad de protección de datos en cualquier momento si cree que el procesamiento de datos personales viola el RGPD.</li>\n' +
		'</ul>\n' +
		'<p>\n' +
		'<strong>En resumen:</strong> usted tiene derechos: ¡no dude en ponerse en contacto con el organismo responsable mencionado anteriormente!</p>\n' +
		'<p>Si cree que el procesamiento de sus datos viola la ley de protección de datos o sus derechos de protección de datos han sido violados de cualquier otra manera, puede presentar una queja ante la autoridad de control. En el caso de Austria, se trata de la autoridad de protección de datos, cuyo sitio web se encuentra en <a href="https://www.dsb.gv.at/?tid=112741413" target="_blank" rel="noopener">https://www.dsb.gv.at/</a> . En Alemania existe un delegado de protección de datos para cada estado federado. Para obtener más información, puede ponerse en contacto con el <a href="https://www.bfdi.bund.de/DE/Home/home_node.html" target="_blank" rel="noopener">Comisionado Federal para la Protección de Datos y la Libertad de Información (BfDI)</a> . La siguiente autoridad local de protección de datos es responsable de nuestra empresa:</p>\n' +
		'<h2 id="datenuebertragung-drittlaender">Transferencia de datos a terceros países</h2>\n' +
		'<p>Solo transferimos o procesamos datos a países fuera del alcance del RGPD (terceros países) si usted da su consentimiento para este procesamiento o existe otro permiso legal. Esto se aplica en particular si el procesamiento es requerido por ley o necesario para cumplir una relación contractual y, en cualquier caso, solo en la medida en que esté generalmente permitido. En la mayoría de los casos, su consentimiento es la razón más importante por la que procesamos datos en terceros países. El procesamiento de datos personales en terceros países, como los EE. UU., donde muchos fabricantes de software brindan servicios y tienen sus servidores, puede significar que los datos personales se procesen y almacenen de maneras inesperadas.</p>\n' +
		'<p>Señalamos expresamente que, según la opinión del Tribunal de Justicia de las Comunidades Europeas, actualmente solo existe un nivel adecuado de protección para la transferencia de datos a los EE. UU. si una empresa estadounidense que procesa datos personales de ciudadanos de la UE en los EE. UU. participa activamente en Los marcos de privacidad de datos UE-EE. UU. sí lo son. Puede encontrar más información al respecto en: <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a>\n' +
		'</p>\n' +
		'<p>El procesamiento de datos por parte de servicios de EE. UU. que no participan activamente en el Marco de Privacidad de Datos UE-EE.UU. puede dar lugar a que los datos no se procesen ni almacenen de forma anónima. Además, las autoridades del gobierno estadounidense pueden tener acceso a datos individuales. También puede ocurrir que los datos recopilados estén vinculados con datos de otros servicios del mismo proveedor, siempre que disponga de una cuenta de usuario correspondiente. Si es posible, intentamos utilizar ubicaciones de servidores dentro de la UE, si esto está disponible. <br>\n' +
		'Le informaremos con más detalle sobre la transferencia de datos a terceros países en los lugares correspondientes de esta declaración de protección de datos, si corresponde.</p>\n' +
		'<h2 id="cookies">Galletas</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Resumen de cookies</strong>\n' +
		'<br>\n' +
		'👥 Afectados: visitantes del sitio web <br>\n' +
		'🤝 Finalidad: en función de la respectiva cookie. Puede encontrar más detalles sobre esto a continuación o con el fabricante del software que configura la cookie. <br>\n' +
		'📓 Datos tratados: En función de la cookie utilizada. Puede encontrar más detalles sobre esto a continuación o con el fabricante del software que configura la cookie. <br>\n' +
		'📅 Periodo de almacenamiento: depende de la cookie respectiva, puede variar de horas a años <br>\n' +
		'⚖️ Base jurídica: Art. 6, párrafo 1, letra a del RGPD (consentimiento), Art. 6, párrafo 1, letra f del RGPD (intereses legítimos)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>¿Qué son las galletas?</h3>\n' +
		'<p>Nuestro sitio web utiliza cookies HTTP para almacenar datos específicos del usuario. <br>\n' +
		'A continuación te explicamos qué son las cookies y para qué se utilizan para que puedas comprender mejor la siguiente política de privacidad.</p>\n' +
		'<p>Cada vez que navega por Internet, utiliza un navegador. Los navegadores más conocidos incluyen Chrome, Safari, Firefox, Internet Explorer y Microsoft Edge. La mayoría de los sitios web almacenan pequeños archivos de texto en su navegador. Estos archivos se llaman cookies.</p>\n' +
		'<p>Una cosa no se puede negar: las cookies son pequeñas ayudas realmente útiles. Casi todos los sitios web utilizan cookies. Más concretamente, se trata de cookies HTTP, ya que también existen otras cookies para otros ámbitos de aplicación. Las cookies HTTP son pequeños archivos que nuestro sitio web almacena en su computadora. Estos archivos de cookies se almacenan automáticamente en la carpeta de cookies, el "cerebro" de su navegador. Una cookie consta de un nombre y un valor. Al definir una cookie, también se deben especificar uno o más atributos.</p>\n' +
		'<p>Las cookies almacenan ciertos datos del usuario sobre usted, como el idioma o la configuración de la página personal. Cuando visita nuestro sitio nuevamente, su navegador envía la información "relacionada con el usuario" a nuestro sitio. Gracias a las cookies, nuestro sitio web sabe quién es usted y le ofrece la configuración a la que está acostumbrado. En algunos navegadores cada cookie tiene su propio archivo, en otros, como Firefox, todas las cookies se almacenan en un único archivo.</p>\n' +
		'<p>Existen tanto cookies propias como cookies de terceros. Las cookies de origen son creadas directamente por nuestro sitio, las cookies de terceros son creadas por sitios web asociados (por ejemplo, Google Analytics). Cada cookie debe evaluarse individualmente porque cada cookie almacena datos diferentes. El tiempo de caducidad de una cookie también varía desde unos pocos minutos hasta algunos años. Las cookies no son programas de software y no contienen virus, troyanos u otras cosas "maliciosas". Las cookies tampoco pueden acceder a la información de su PC.</p>\n' +
		'<p>Por ejemplo, los datos de las cookies podrían verse así:</p>\n' +
		'<p>\n' +
		'<strong>Nombre:</strong> _ga <br>\n' +
		'<strong>Valor:</strong> &nbsp;GA1.2.1326744211.152112741413-9 <br>\n' +
		'<strong>Finalidad:</strong> Diferenciación de visitantes del sitio web <br>\n' +
		'<strong>Fecha de caducidad:</strong> &nbsp;después de 2 años</p>\n' +
		'<p>Un navegador debería poder admitir estos tamaños mínimos:</p>\n' +
		'<ul>\n' +
		'<li>Al menos 4096 bytes por cookie</li>\n' +
		'<li>Al menos 50 cookies por dominio</li>\n' +
		'<li>Al menos 3000 cookies en total</li>\n' +
		'</ul>\n' +
		'<h3>¿Qué tipos de cookies existen?</h3>\n' +
		'<p>La cuestión de qué cookies utilizamos en particular depende de los servicios utilizados y se aclara en las siguientes secciones de la declaración de protección de datos. En este punto nos gustaría comentar brevemente los diferentes tipos de cookies HTTP.</p>\n' +
		'<p>Existen 4 tipos de cookies:</p>\n' +
		'<p>\n' +
		'<strong>Cookies esenciales<br>\n' +
		'</strong> Estas cookies son necesarias para garantizar las funciones básicas del sitio web. Por ejemplo, estas cookies son necesarias cuando un usuario coloca un producto en el carrito de compras, luego continúa navegando en otras páginas y solo más tarde realiza la compra. Estas cookies no eliminan el carrito de la compra, incluso si el usuario cierra la ventana de su navegador.</p>\n' +
		'<p>\n' +
		'<strong>Cookies de finalidad<br>\n' +
		'</strong> Estas cookies recopilan información sobre el comportamiento del usuario y si el usuario recibe algún mensaje de error. Estas cookies también se utilizan para medir el tiempo de carga y el comportamiento del sitio web en diferentes navegadores.</p>\n' +
		'<p>\n' +
		'<strong>Cookies orientadas a objetivos<br>\n' +
		'</strong> Estas cookies garantizan una mejor experiencia de usuario. Por ejemplo, se guardan las ubicaciones ingresadas, los tamaños de fuente o los datos del formulario.</p>\n' +
		'<p>\n' +
		'<strong>Cookies publicitarias<br>\n' +
		'</strong> Estas cookies también se denominan cookies de orientación. Sirven para ofrecer al usuario publicidad personalizada. Esto puede resultar muy práctico, pero también muy molesto.</p>\n' +
		'<p>Normalmente, cuando visita un sitio web por primera vez, se le preguntará cuál de estos tipos de cookies desea permitir. Y por supuesto esta decisión también se guarda en una cookie.</p>\n' +
		'<p>Si desea saber más sobre las cookies y no le teme a la documentación técnica, le recomendamos <a href="https://datatracker.ietf.org/doc/html/rfc6265">https://datatracker.ietf.org/doc/html/rfc6265</a> , la Solicitud de comentarios del Grupo de trabajo de ingeniería de Internet (IETF) denominada “Gestión de estado HTTP”. Mecanismo”.</p>\n' +
		'<h3>Finalidad del tratamiento mediante cookies</h3>\n' +
		'<p>La finalidad depende en última instancia de la cookie correspondiente. Puede encontrar más detalles sobre esto a continuación o con el fabricante del software que configura la cookie.</p>\n' +
		'<h3>¿Qué datos se procesan?</h3>\n' +
		'<p>Las cookies son pequeñas ayudas para muchas tareas diferentes. Lamentablemente, no es posible generalizar qué datos se almacenan en las cookies, pero le informaremos sobre los datos procesados ​​o almacenados en la siguiente declaración de protección de datos.</p>\n' +
		'<h3>Periodo de almacenamiento de las cookies</h3>\n' +
		'<p>El período de almacenamiento depende de la cookie respectiva y se especifica con más detalle a continuación. Algunas cookies se eliminan al cabo de menos de una hora, otras pueden permanecer en el ordenador durante varios años.</p>\n' +
		'<p>También influye en el tiempo de almacenamiento. Puede eliminar todas las cookies manualmente en cualquier momento a través de su navegador (consulte también "Derecho de oposición" a continuación). Además, las cookies basadas en el consentimiento se eliminarán a más tardar después de que usted revoque su consentimiento, aunque hasta entonces la legalidad del almacenamiento no se verá afectada.</p>\n' +
		'<h3>Derecho de oposición: ¿cómo puedo eliminar las cookies?</h3>\n' +
		'<p>Usted decide por sí mismo cómo y si desea utilizar cookies. Independientemente de qué servicio o sitio web provengan, siempre tendrá la opción de eliminarlas, desactivarlas o permitirlas solo parcialmente. Por ejemplo, puede bloquear las cookies de terceros pero permitir todas las demás cookies.</p>\n' +
		'<p>Si desea saber qué cookies se han almacenado en su navegador, si desea cambiar o eliminar la configuración de las cookies, puede hacerlo en la configuración de su navegador:</p>\n' +
		'<p>\n' +
		'<a href="https://support.google.com/chrome/answer/95647?tid=112741413" target="_blank" rel="noopener noreferrer">Chrome: eliminar, habilitar y administrar cookies en Chrome</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.apple.com/de-at/guide/safari/sfri11471/mac?tid=112741413" target="_blank" rel="noopener noreferrer">Safari: administre cookies y datos del sitio con Safari</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.mozilla.org/de/kb/cookies-und-website-daten-in-firefox-loschen?tid=112741413" target="_blank" rel="noopener noreferrer">Firefox: elimine las cookies para eliminar los datos que los sitios web han colocado en su computadora</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.microsoft.com/de-de/windows/l%C3%B6schen-und-verwalten-von-cookies-168dab11-0753-043d-7c16-ede5947fc64d?tid=112741413">Internet Explorer: eliminación y gestión de cookies</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.microsoft.com/de-de/microsoft-edge/cookies-in-microsoft-edge-l%C3%B6schen-63947406-40ac-c3b8-57b9-2a946a29ae09?tid=112741413">Microsoft Edge: eliminar y administrar cookies</a>\n' +
		'</p>\n' +
		'<p>Si generalmente no desea cookies, puede configurar su navegador para que siempre le informe cuando se debe configurar una cookie. Esto significa que puede decidir para cada cookie individual si la permite o no. El procedimiento varía según el navegador. Lo mejor es buscar las instrucciones en Google utilizando el término de búsqueda “eliminar cookies Chrome” o “desactivar cookies Chrome” en el caso de un navegador Chrome.</p>\n' +
		'<h3>Base legal</h3>\n' +
		'<p>Las denominadas “Pautas sobre cookies” existen desde 2009. Aquí se indica que el almacenamiento de cookies requiere su <strong>consentimiento (artículo 6, apartado 1, letra a del RGPD). </strong>Sin embargo, todavía hay reacciones muy diferentes a estas directrices dentro de los países de la UE. En Austria, sin embargo, esta directiva se implementó en el artículo 165, párrafo 3 de la Ley de Telecomunicaciones (2021). En Alemania, las directrices sobre cookies no se han implementado como ley nacional. Más bien, esta directiva se aplicó en gran medida en el artículo 15, apartado 3 de la Ley de Telemedia (TMG).</p>\n' +
		'<p>Para las cookies absolutamente necesarias, incluso si no se da el consentimiento, existen <strong>intereses legítimos</strong> (artículo 6, apartado 1, letra f del RGPD), que en la mayoría de los casos son de naturaleza económica. Queremos ofrecer a los visitantes del sitio web una experiencia de usuario agradable y, a menudo, determinadas cookies son absolutamente necesarias para ello.</p>\n' +
		'<p>Si se utilizan cookies no esenciales, esto sólo sucederá con su consentimiento. La base jurídica a este respecto es el artículo 6, apartado 1, letra a del RGPD.</p>\n' +
		'<p>En las siguientes secciones se le informará con más detalle sobre el uso de cookies si el software utilizado las utiliza.</p>\n' +
		'<h2 id="web-analytics-einleitung">Introducción a la analítica web</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Resumen de Declaración de Protección de Datos de Web Analytics</strong>\n' +
		'<br>\n' +
		'👥 Afectados: Visitantes del sitio web <br>\n' +
		'🤝 Finalidad: Evaluación de la información del visitante para optimizar la oferta web. <br>\n' +
		'📓 Datos procesados: Estadísticas de acceso, que incluyen datos como ubicaciones de acceso, datos del dispositivo, duración y tiempo de acceso, comportamiento de navegación, comportamiento de clics y direcciones IP. Puede encontrar más detalles al respecto en la herramienta de analítica web utilizada. <br>\n' +
		'📅 Plazo de almacenamiento: depende de la herramienta de análisis web utilizada <br>\n' +
		'⚖️ Base jurídica: Art. 6, párrafo 1, letra a del RGPD (consentimiento), Art. 6, párrafo 1, letra f del RGPD (intereses legítimos)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>¿Qué es la analítica web?</h3>\n' +
		'<p>En nuestro sitio web utilizamos un software para evaluar el comportamiento de los visitantes del sitio web, lo que se conoce abreviadamente como análisis web. Se recopilan datos que el respectivo proveedor de la herramienta analítica (también llamada herramienta de seguimiento) almacena, gestiona y procesa. Los datos se utilizan para realizar análisis del comportamiento de los usuarios en nuestro sitio web y para ponerlos a nuestra disposición como operador del sitio web. Además, la mayoría de las herramientas ofrecen varias opciones de prueba. Por ejemplo, podemos probar qué ofertas o contenidos son mejor recibidos por nuestros visitantes. Te mostraremos dos ofertas diferentes por un periodo de tiempo limitado. Después de la prueba (la llamada prueba A/B), sabemos qué producto o contenido encuentran más interesante los visitantes de nuestro sitio web. Para dichos procedimientos de prueba, así como para otros procedimientos analíticos, también se pueden crear perfiles de usuario y los datos se pueden almacenar en cookies.</p>\n' +
		'<h3>¿Por qué hacemos analítica web?</h3>\n' +
		'<p>Tenemos un objetivo claro en mente con nuestro sitio web: queremos ofrecer la mejor oferta web del mercado para nuestra industria. Para lograr este objetivo queremos ofrecerte, por un lado, la mejor y más interesante oferta y, por otro, asegurarnos de que te sientas completamente cómodo en nuestra web. Con la ayuda de herramientas de análisis web, podemos observar más de cerca el comportamiento de los visitantes de nuestro sitio web y luego mejorarlo en consecuencia para usted y para nosotros. Por ejemplo, podemos ver la edad media de nuestros visitantes, de dónde vienen, cuándo es más visitado nuestro sitio web o qué contenidos o productos son especialmente populares. Toda esta información nos ayuda a optimizar el sitio web y así adaptarlo mejor a sus necesidades, intereses y deseos.</p>\n' +
		'<h3>¿Qué datos se procesan?</h3>\n' +
		'<p>Por supuesto, exactamente qué datos se almacenan depende de las herramientas de análisis utilizadas. Sin embargo, normalmente se almacena, por ejemplo, qué contenido ve en nuestro sitio web, en qué botones o enlaces hace clic, cuándo accede a una página, qué navegador utiliza, qué dispositivo (PC, tableta, teléfono inteligente, etc.) utiliza. utiliza el sitio web que visita o qué sistema informático utiliza. Si ha aceptado que también se puedan recopilar datos de ubicación, estos también podrán ser procesados ​​por el proveedor de la herramienta de análisis web.</p>\n' +
		'<p>Su dirección IP también se almacena. Según el Reglamento General de Protección de Datos (GDPR), las direcciones IP son datos personales. Sin embargo, su dirección IP normalmente se almacena de forma seudónima (es decir, de forma abreviada e irreconocible). Con fines de prueba, análisis web y optimización web, no se almacenan datos directos como su nombre, edad, dirección o dirección de correo electrónico. Todos estos datos, si se recopilan, se almacenan de forma seudónima. Esto significa que no puede ser identificado como persona.</p>\n' +
		'<p>El tiempo de almacenamiento de los datos respectivos depende siempre del proveedor. Algunas cookies solo almacenan datos durante unos minutos o hasta que abandone el sitio web, otras cookies pueden almacenar datos durante varios años.</p>\n' +
		'<h3>\n' +
		'<span data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Wo und wie lange werden Daten gespeichert?&quot;}" data-sheets-userformat="{&quot;2&quot;:769,&quot;3&quot;:{&quot;1&quot;:0},&quot;11&quot;:4,&quot;12&quot;:0}">Duración del procesamiento de datos</span>\n' +
		'</h3>\n' +
		'<p>Le informaremos a continuación sobre la duración del procesamiento de datos si tenemos más información. En general, solo procesamos datos personales durante el tiempo que sea absolutamente necesario para proporcionar nuestros servicios y productos. Si lo exige la ley, por ejemplo en el caso de la contabilidad, este período de almacenamiento también puede excederse.</p>\n' +
		'<h3>Derecho a oponerse</h3>\n' +
		'<p>También tiene el derecho y la oportunidad de revocar su consentimiento para el uso de cookies o de terceros proveedores en cualquier momento. Esto funciona a través de nuestra herramienta de gestión de cookies o mediante otras funciones de exclusión voluntaria. Por ejemplo, también puedes impedir la recogida de datos mediante cookies gestionando, desactivando o eliminando las cookies en tu navegador.</p>\n' +
		'<h3>Base legal</h3>\n' +
		'<p>El uso de análisis web requiere su consentimiento, que obtuvimos con nuestra ventana emergente de cookies. Según <strong>el artículo 6, apartado 1, letra a del RGPD (consentimiento), este</strong> consentimiento representa la base legal para el procesamiento de datos personales, como puede ocurrir cuando se recopilan mediante herramientas de análisis web.</p>\n' +
		'<p>Además del consentimiento, tenemos un interés legítimo en analizar el comportamiento de los visitantes del sitio web y así mejorar nuestra oferta desde el punto de vista técnico y económico. Con la ayuda de la analítica web, detectamos errores del sitio web, identificamos ataques y mejoramos la rentabilidad. La base jurídica para ello es <strong>el artículo 6, apartado 1, letra f del RGPD (intereses legítimos)</strong> . Sin embargo, solo utilizamos las herramientas si usted ha dado su consentimiento.</p>\n' +
		'<p>Dado que las cookies se utilizan en herramientas de analítica web, también le recomendamos leer nuestra política de privacidad general sobre cookies. Para saber exactamente cuáles de sus datos se almacenan y procesan, debe leer las declaraciones de protección de datos de las respectivas herramientas.</p>\n' +
		'<p>Puede encontrar información sobre herramientas especiales de análisis web, si están disponibles, en las siguientes secciones.</p>\n' +
		'<h2 id="google-analytics-datenschutzerklaerung">Política de privacidad de Google Analytics</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Resumen de la Declaración de Protección de Datos de Google Analytics</strong>\n' +
		'<br>\n' +
		'👥 Afectados: Visitantes del sitio web <br>\n' +
		'🤝 Finalidad: Evaluación de la información del visitante para optimizar el sitio web. <br>\n' +
		'📓 Datos procesados: Estadísticas de acceso, que incluyen datos como ubicaciones de acceso, datos del dispositivo, duración y tiempo de acceso, comportamiento de navegación y comportamiento de clics. Puede encontrar más detalles al respecto más abajo en esta declaración de protección de datos. <br>\n' +
		'📅 Periodo de almacenamiento: ajustable individualmente, por defecto Google Analytics 4 almacena los datos durante 14 meses <br>\n' +
		'⚖️ Base jurídica: Art. 6 Apartado 1 letra a del RGPD (consentimiento), Art. 6 Apartado 1 letra f del RGPD (intereses legítimos)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>¿Qué es Google Analytics?</h3>\n' +
		'<p>En nuestro sitio web utilizamos la herramienta de seguimiento de análisis Google Analytics en la versión Google Analytics 4 (GA4) de la empresa estadounidense Google Inc. Para el área europea, la empresa Google Ireland Limited (Gordon House, Barrow Street Dublin 4, Irlanda) es para todos. Responsable de los servicios de Google. Google Analytics recopila datos sobre sus acciones en nuestro sitio web. Mediante la combinación de diferentes tecnologías, como cookies, ID de dispositivos e información de inicio de sesión, usted, como usuario, puede ser identificado en diferentes dispositivos. Esto significa que sus acciones también se pueden analizar en todas las plataformas.</p>\n' +
		'<p>Por ejemplo, si hace clic en un enlace, este evento se almacena en una cookie y se envía a Google Analytics. Los informes que recibimos de Google Analytics nos permiten adaptar mejor nuestro sitio web y servicio a sus necesidades. A continuación profundizaremos en la herramienta de seguimiento y, sobre todo, te informaremos sobre qué datos se tratan y cómo puedes evitarlo.</p>\n' +
		'<p>Google Analytics es una herramienta de seguimiento que se utiliza para analizar el tráfico en nuestro sitio web. La base de estas mediciones y análisis es un número de identificación de usuario seudónimo. Este número no contiene ningún dato personal como nombre o dirección, pero se utiliza para asignar eventos a un dispositivo. GA4 utiliza un modelo basado en eventos que captura información detallada sobre las interacciones del usuario, como vistas de página, clics, desplazamiento y eventos de conversión. Además, se han integrado varias funciones de aprendizaje automático en GA4 para comprender mejor el comportamiento del usuario y ciertas tendencias. GA4 se basa en el modelado con la ayuda de funciones de aprendizaje automático. Esto significa que, a partir de los datos recopilados, también se pueden extrapolar los datos faltantes para optimizar el análisis y también poder realizar previsiones.</p>\n' +
		'<p>Para que Google Analytics funcione, se incorpora un código de seguimiento en el código de nuestro sitio web. Cuando visita nuestro sitio web, este código registra varios eventos que realiza en nuestro sitio web. Con el modelo de datos basado en eventos de GA4, nosotros, como operadores de sitios web, podemos definir y rastrear eventos específicos para obtener análisis de las interacciones de los usuarios. Además de información general como clics o visitas a páginas, también se puede realizar un seguimiento de eventos específicos que son importantes para nuestro negocio. Estos eventos especiales podrían ser, por ejemplo, enviar un formulario de contacto o comprar un producto.</p>\n' +
		'<p>Tan pronto como abandona nuestro sitio web, estos datos se envían a los servidores de Google Analytics y se almacenan allí.</p>\n' +
		'<p>Google procesa los datos y recibimos informes sobre su comportamiento de usuario. Estos podrán incluir, entre otros, los siguientes informes:</p>\n' +
		'<ul>\n' +
		'<li>Informes de grupos objetivo: a través de informes de grupos objetivo conocemos mejor a nuestros usuarios y sabemos con mayor precisión quién está interesado en nuestro servicio.</li>\n' +
		'<li>Informes de visualización: los informes de visualización nos facilitan el análisis y la mejora de nuestra publicidad en línea.</li>\n' +
		'<li>Informes de adquisición: los informes de adquisición nos brindan información útil sobre cómo podemos atraer más personas a nuestro servicio.</li>\n' +
		'<li>Informes de comportamiento: aquí es donde aprendemos cómo interactúa con nuestro sitio web. Podemos rastrear la ruta que toma en nuestro sitio y en qué enlaces hace clic.</li>\n' +
		'<li>Informes de conversión: la conversión es el proceso en el que se realiza una acción deseada en función de un mensaje de marketing. Por ejemplo, cuando pasas de ser simplemente un visitante de un sitio web a un comprador o suscriptor de un boletín. Estos informes nos ayudan a obtener más información sobre cómo usted recibe nuestros esfuerzos de marketing. Así es como queremos aumentar nuestra tasa de conversión.</li>\n' +
		'<li>Informes en tiempo real: Aquí siempre nos enteramos de inmediato de lo que sucede en nuestro sitio web. Por ejemplo, podemos ver cuántos usuarios están leyendo este texto actualmente.</li>\n' +
		'</ul>\n' +
		'<p>Además de los informes de análisis mencionados anteriormente, Google Analytics 4 también ofrece, entre otras, las siguientes funciones:</p>\n' +
		'<ul>\n' +
		'<li>Modelo de datos basado en eventos: este modelo captura eventos muy específicos que pueden ocurrir en nuestro sitio web. Por ejemplo, reproducir un vídeo, comprar un producto o suscribirse a nuestra newsletter.</li>\n' +
		'<li>Funciones de análisis avanzadas: estas funciones nos permiten comprender mejor su comportamiento en nuestro sitio web o ciertas tendencias generales. Por ejemplo, podemos segmentar grupos de usuarios, realizar análisis comparativos de grupos objetivo o seguir su recorrido en nuestro sitio web.</li>\n' +
		'<li>Modelado predictivo: basándose en los datos recopilados, el aprendizaje automático puede extrapolar datos faltantes que predicen eventos y tendencias futuros. Esto puede ayudarnos a desarrollar mejores estrategias de marketing.</li>\n' +
		'<li>Análisis multiplataforma: la recopilación y el análisis de datos es posible tanto desde sitios web como desde aplicaciones. Esto nos brinda la oportunidad de analizar el comportamiento del usuario en todas las plataformas, siempre que, por supuesto, haya dado su consentimiento para el procesamiento de datos.</li>\n' +
		'</ul>\n' +
		'<h3>¿Por qué utilizamos Google Analytics en nuestro sitio web?</h3>\n' +
		'<p>Nuestro objetivo con esta web es claro: queremos ofrecerte el mejor servicio posible. Las estadísticas y los datos de Google Analytics nos ayudan a lograr este objetivo.</p>\n' +
		'<p>Los datos evaluados estadísticamente nos muestran una imagen clara de los puntos fuertes y débiles de nuestro sitio web. Por un lado, podemos optimizar nuestro sitio para que las personas interesadas puedan encontrarlo más fácilmente en Google. Por otro lado, los datos nos ayudan a comprenderle mejor como visitante. Por lo tanto, sabemos exactamente qué debemos mejorar en nuestro sitio web para ofrecerle el mejor servicio posible. Los datos también nos ayudan a llevar a cabo nuestras medidas de publicidad y marketing de forma más personalizada y rentable. Después de todo, tiene sentido mostrar nuestros productos y servicios a personas interesadas en ellos.</p>\n' +
		'<h3>¿Qué datos almacena Google Analytics?</h3>\n' +
		'<p>Google Analytics crea una identificación única y aleatoria asociada con la cookie de su navegador mediante un código de seguimiento. Así es como Google Analytics lo reconoce como un nuevo usuario y se le asigna una identificación de usuario. La próxima vez que visite nuestro sitio, será reconocido como un usuario "recurrente". Todos los datos recopilados se almacenan junto con esta identificación de usuario. Esto permite evaluar perfiles de usuario seudónimos.</p>\n' +
		'<p>Para poder analizar nuestro sitio web con Google Analytics, se debe insertar un ID de propiedad en el código de seguimiento. Luego los datos se guardan en la propiedad correspondiente. La propiedad Google Analytics 4 es la predeterminada para cada propiedad recién creada. Dependiendo de la propiedad utilizada, los datos se almacenan durante diferentes períodos de tiempo.</p>\n' +
		'<p>Mediante identificadores como cookies, ID de instancia de aplicación, ID de usuario o parámetros de eventos personalizados, sus interacciones se miden en todas las plataformas, siempre que usted haya dado su consentimiento. Las interacciones son todo tipo de acciones que usted realiza en nuestro sitio web. Si también utiliza otros sistemas de Google (como una cuenta de Google), los datos generados a través de Google Analytics pueden vincularse a cookies de terceros. Google no transmite datos de Google Analytics a menos que nosotros, como operadores del sitio web, lo autoricemos, salvo que lo exija la ley.</p>\n' +
		'<p>Según Google, Google Analytics 4 no registra ni almacena direcciones IP. Sin embargo, Google utiliza los datos de la dirección IP para obtener datos de ubicación y los elimina inmediatamente después. Todas las direcciones IP recopiladas de los usuarios en la UE se eliminan antes de que los datos se almacenen en un centro de datos o en un servidor.</p>\n' +
		'<p>Dado que Google Analytics 4 se centra en datos basados ​​en eventos, la herramienta utiliza muchas menos cookies en comparación con versiones anteriores (como Google Universal Analytics). Sin embargo, existen algunas cookies específicas utilizadas por GA4. Estos incluyen, por ejemplo:</p>\n' +
		'<p>\n' +
		'<strong>Nombre:</strong> _ga <br>\n' +
		'<strong>Valor:</strong> 2.1326744211.152112741413-5 <br>\n' +
		'<strong>Propósito:</strong> De forma predeterminada, Analytics.js utiliza la cookie _ga para almacenar la identificación del usuario. Básicamente, se utiliza para distinguir a los visitantes del sitio web. <br>\n' +
		'<strong>Fecha de caducidad:</strong> después de 2 años.</p>\n' +
		'<p>\n' +
		'<strong>Nombre:</strong> _gid <br>\n' +
		'<strong>Valor:</strong> 2.1687193234.152112741413-1 <br>\n' +
		'<strong>Finalidad:</strong> &nbsp;La cookie también se utiliza para distinguir a los visitantes del sitio web <br>\n' +
		'<strong>Fecha de caducidad:</strong> &nbsp;después de 24 horas</p>\n' +
		'<p>\n' +
		'<strong>Nombre:</strong> _gat_gtag_UA_&lt;property-id&gt; <br>\n' +
		'<strong>Valor:</strong> 1 <br>\n' +
		'<strong>Propósito:</strong> Se utiliza para reducir la tasa de solicitudes. Si Google Analytics se proporciona a través de Google Tag Manager, esta cookie se denomina _dc_gtm_ &lt;property-id&gt;. <br>\n' +
		'<strong>Fecha de caducidad:</strong> después de 1 minuto</p>\n' +
		'<p>\n' +
		'<strong>Nota:</strong> &nbsp;Esta lista no puede pretender estar completa, ya que Google cambia continuamente su elección de cookies. GA4 también tiene como objetivo mejorar la protección de datos. Por tanto, la herramienta ofrece algunas opciones para controlar la recopilación de datos. Por ejemplo, podemos establecer nosotros mismos el período de almacenamiento y también controlar la recopilación de datos.</p>\n' +
		'<p>A continuación te mostramos un resumen de los principales tipos de datos recopilados con Google Analytics:</p>\n' +
		'<p>\n' +
		'<strong>Mapas de calor:</strong> Google crea los llamados mapas de calor. Los mapas de calor muestran exactamente las áreas en las que haces clic. Esto nos da información sobre dónde se encuentra en nuestro sitio.</p>\n' +
		'<p>\n' +
		'<strong>Duración de la sesión:</strong> Google se refiere al tiempo que pasa en nuestro sitio sin salir del mismo. Si has estado inactivo durante 20 minutos, la sesión finaliza automáticamente.</p>\n' +
		'<p>\n' +
		'<strong>Tasa</strong> de rebote : Un rebote es cuando solo ve una página en nuestro sitio web y luego abandona nuestro sitio web nuevamente.</p>\n' +
		'<p>\n' +
		'<strong>Creación de cuenta:</strong> si crea una cuenta o realiza un pedido en nuestro sitio web, Google Analytics recopila estos datos.</p>\n' +
		'<p>\n' +
		'<strong>Ubicación:</strong> las direcciones IP no se registran ni almacenan en Google Analytics. Sin embargo, poco antes de que se elimine la dirección IP, se utilizan derivados de los datos de ubicación.</p>\n' +
		'<p>\n' +
		'<strong>Información técnica:</strong> La información técnica puede incluir, entre otros, su tipo de navegador, su proveedor de servicios de Internet o la resolución de su pantalla.</p>\n' +
		'<p>\n' +
		'<strong>Fuente de origen:</strong> Google Analytics o, por supuesto, también nos interesa saber desde qué sitio web o publicidad llegó a nuestro sitio.</p>\n' +
		'<p>Otros datos incluyen detalles de contacto, reseñas, reproducción de medios (por ejemplo, cuando reproduce un video a través de nuestro sitio), compartir contenido a través de las redes sociales o agregarlo a sus favoritos. La lista no pretende ser completa y sólo sirve como guía general para el almacenamiento de datos por parte de Google Analytics.</p>\n' +
		'<h3>¿Cuánto tiempo y dónde se almacenan los datos?</h3>\n' +
		'<p>Google tiene sus servidores repartidos por todo el mundo. Puede leer exactamente dónde se encuentran los centros de datos de Google aquí: <a href="https://www.google.com/about/datacenters/locations/?hl=de">https://www.google.com/about/datacenters/locations/?hl=de</a>\n' +
		'</p>\n' +
		'<p>Sus datos se distribuyen en diferentes medios de almacenamiento físico. Esto tiene la ventaja de que se puede acceder a los datos más rápidamente y están mejor protegidos contra la manipulación. Cada centro de datos de Google dispone de programas de emergencia adecuados para sus datos. Por ejemplo, si el hardware de Google falla o los desastres naturales paralizan los servidores, el riesgo de interrupción del servicio en Google sigue siendo bajo.</p>\n' +
		'<p>El plazo de conservación de los datos depende de las propiedades utilizadas. El período de almacenamiento siempre se determina específicamente para cada propiedad individual. Google Analytics nos ofrece cuatro opciones para controlar la duración del almacenamiento:</p>\n' +
		'<ul>\n' +
		'<li>2 meses: este es el período de almacenamiento más corto.</li>\n' +
		'<li>14 meses: de forma predeterminada, los datos se almacenan en GA4 durante 14 meses.</li>\n' +
		'<li>26 meses: también puedes guardar los datos durante 26 meses.</li>\n' +
		'<li>Los datos no se eliminarán hasta que los eliminemos manualmente</li>\n' +
		'</ul>\n' +
		'<p>Además, también existe la opción de que los datos solo se eliminen si deja de visitar nuestro sitio web dentro del plazo elegido por nosotros. En este caso, el período de retención se restablecerá cada vez que visite nuestro sitio web nuevamente dentro del período especificado.</p>\n' +
		'<p>Una vez transcurrido el plazo indicado, los datos se eliminarán una vez al mes. Este período de retención se aplica a sus datos vinculados a cookies, reconocimiento de usuarios e ID de publicidad (por ejemplo, cookies del dominio de DoubleClick). Los resultados de los informes se basan en datos agregados y se almacenan independientemente de los datos del usuario. Los datos agregados son una fusión de datos individuales en una unidad más grande.</p>\n' +
		'<h3>¿Cómo puedo eliminar mis datos o evitar el almacenamiento de datos?</h3>\n' +
		'<p>Según la ley de protección de datos de la Unión Europea, usted tiene derecho a acceder, actualizar, eliminar o restringir sus datos. Puede utilizar el complemento del navegador para desactivar el JavaScript de Google Analytics (analytics.js, gtag.js) para evitar que Google Analytics 4 utilice sus datos. Puede descargar e instalar el complemento del navegador en <a href="https://tools.google.com/dlpage/gaoptout?hl=de">https://tools.google.com/dlpage/gaoptout?hl=de . </a>Tenga en cuenta que este complemento solo desactiva la recopilación de datos por parte de Google Analytics.</p>\n' +
		'<p>Si generalmente desea desactivar, eliminar o administrar las cookies, encontrará los enlaces pertinentes a las instrucciones pertinentes para los navegadores más populares en la sección "Cookies".</p>\n' +
		'<h3>Base legal</h3>\n' +
		'<p>El uso de Google Analytics requiere su consentimiento, que obtuvimos con nuestra ventana emergente de cookies. Según <strong>el artículo 6, apartado 1, letra a del RGPD (consentimiento), este</strong> consentimiento representa la base legal para el procesamiento de datos personales, como puede ocurrir cuando se recopilan mediante herramientas de análisis web.</p>\n' +
		'<p>Además del consentimiento, tenemos un interés legítimo en analizar el comportamiento de los visitantes del sitio web y así mejorar nuestra oferta desde el punto de vista técnico y económico. Con la ayuda de Google Analytics detectamos errores en el sitio web, identificamos ataques y mejoramos la rentabilidad. La base jurídica para ello es <strong>el artículo 6, apartado 1, letra f del RGPD (intereses legítimos)</strong> . Sin embargo, sólo utilizamos Google Analytics si usted ha dado su consentimiento.</p>\n' +
		'<p>Google también procesa sus datos, entre otros lugares, en EE.UU. Google participa activamente en el Marco de Privacidad de Datos UE-EE.UU., que regula la transferencia correcta y segura de datos personales de ciudadanos de la UE a EE.UU. Puede encontrarse más información en <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a> .</p>\n' +
		'<p>Google también utiliza las llamadas cláusulas contractuales tipo (= art. 46, apartados 2 y 3 del RGPD). Las Cláusulas Contractuales Estándar (SCC) son plantillas proporcionadas por la Comisión de la UE y tienen como objetivo garantizar que sus datos cumplan con los estándares europeos de protección de datos incluso si se transfieren a terceros países (como los EE. UU.) y se almacenan allí. A través del Marco de Privacidad de Datos UE-EE.UU. y las Cláusulas Contractuales Tipo, Google se compromete a cumplir con el nivel europeo de protección de datos al procesar sus datos relevantes, incluso si los datos se almacenan, procesan y administran en los EE. UU. Estas cláusulas se basan en una decisión de implementación de la Comisión de la UE. Puede encontrar la resolución y las cláusulas contractuales tipo correspondientes aquí: <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a>\n' +
		'</p>\n' +
		'<p>Las condiciones de procesamiento de datos de Google Ads, que hacen referencia a las cláusulas contractuales estándar, se pueden encontrar en <a href="https://business.safety.google/intl/de/adsprocessorterms/" target="_blank" rel="follow noopener">https://business.safety.google/intl/de/adsprocessorterms/</a> .</p>\n' +
		'<p>Esperamos haber podido brindarle la información más importante sobre el procesamiento de datos por parte de Google Analytics. Si desea obtener más información sobre el servicio de seguimiento, le recomendamos estos dos enlaces: <a href="https://marketingplatform.google.com/about/analytics/terms/de/" target="_blank" rel="follow noopener">https://marketingplatform.google.com/about/analytics/terms/de/</a> y <a href="https://support.google.com/analytics/answer/6004245?hl=de" target="_blank" rel="follow noopener">https://support.google.com/analytics/answer / 6004245?hl=de</a> .</p>\n' +
		'<p>Si desea obtener más información sobre el procesamiento de datos, utilice la política de privacidad de Google en <a href="https://policies.google.com/privacy?hl=de&amp;tid=112741413" target="_blank" rel="follow noopener">https://policies.google.com/privacy?hl=de</a> .</p>\n' +
		'<h2 id="google-analytics-berichte-zu-demografischen-merkmalen-und-interessen">Informes de Google Analytics sobre datos demográficos e intereses.</h2>\n' +
		'<p>Hemos activado las funciones de informes publicitarios en Google Analytics. Los informes demográficos y de intereses incluyen información sobre edad, sexo e intereses. Esto nos permite obtener una mejor imagen de nuestros usuarios, sin poder asignar estos datos a personas individuales. Puede obtener más información sobre las funciones publicitarias en&nbsp; <a href="https://support.google.com/analytics/answer/3450482?hl=de_AT&amp;utm_id=ad">https://support.google.com/analytics/answer/3450482?hl=de_AT&amp;utm_id=ad</a> .</p>\n' +
		'<p>Puede detener el uso de las actividades y la información de su cuenta de Google en "Configuración de publicidad" en <a href="https://adssettings.google.com/authenticated">https://adssettings.google.com/authenticated</a> marcando la casilla.</p>\n' +
		'<h2 id="google-analytics-im-einwilligungsmodus">Google Analytics en modo consentimiento</h2>\n' +
		'<p>Dependiendo de su consentimiento, sus datos personales serán procesados ​​por Google Analytics en el llamado modo de consentimiento. Puede elegir si acepta o no las cookies de Google Analytics. Esto también le permite elegir qué datos puede procesar Google Analytics sobre usted. Estos datos recopilados se utilizan principalmente para medir el comportamiento del usuario en el sitio web, ofrecer publicidad dirigida y proporcionarnos informes de análisis web. Como regla general, usted acepta el procesamiento de datos por parte de Google a través de una herramienta de consentimiento de cookies. Si no da su consentimiento para el procesamiento de datos, solo se recopilarán y procesarán datos agregados. Esto significa que no se pueden asignar datos a usuarios individuales y no se crea ningún perfil de usuario para usted. También puede simplemente aceptar la medición estadística. No se procesan datos personales y por tanto no se utilizan para publicidad o campañas publicitarias.</p>\n' +
		'<h2 id="content-delivery-networks-einleitung">Introducción a las redes de entrega de contenido</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Resumen de la declaración de protección de datos de Content Delivery Networks</strong>\n' +
		'<br>\n' +
		'👥 Afectados: Visitantes del sitio web <br>\n' +
		'🤝 Finalidad: Optimización de nuestro servicio (para que el sitio web pueda cargarse más rápido) <br>\n' +
		'📓 Datos procesados: Datos como su dirección IP <br>\n' +
		'Puede encontrar más detalles a continuación y en el Textos individuales de protección de datos. <br>\n' +
		'📅 Plazo de conservación: La mayoría de los datos se conservan hasta que ya no sean necesarios para la prestación del servicio <br>\n' +
		'⚖️ Base jurídica: Art. 6 Párr. 1 letra a del RGPD (consentimiento), Art. 6 Párr. 1 letra f del RGPD (consentimiento legítimo) intereses)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>¿Qué es una red de entrega de contenido?</h3>\n' +
		'<p>En nuestro sitio web utilizamos la llamada red de distribución de contenidos. La mayoría de las veces, esta red se denomina simplemente CDN. Una CDN nos ayuda a cargar nuestro sitio web de forma rápida y sencilla, independientemente de su ubicación. Sus datos personales también se almacenan, gestionan y procesan en los servidores del proveedor de CDN utilizado. A continuación entraremos en detalles más generales sobre el servicio y su tratamiento de datos. Puede encontrar información detallada sobre cómo se tratan sus datos en la respectiva declaración de protección de datos del proveedor.</p>\n' +
		'<p>Cualquier red de entrega de contenido (CDN) es una red de servidores distribuidos regionalmente, todos conectados entre sí a través de Internet. El contenido del sitio web (especialmente archivos muy grandes) se puede entregar de forma rápida y fluida a través de esta red, incluso durante grandes picos de carga. La CDN crea una copia de nuestro sitio web en sus servidores. Dado que estos servidores están distribuidos en todo el mundo, el sitio web se puede entregar rápidamente. De este modo, la CDN acorta considerablemente la transmisión de datos a su navegador.</p>\n' +
		'<h3>¿Por qué utilizamos una red de entrega de contenido para nuestro sitio web?</h3>\n' +
		'<p>Un sitio web de carga rápida es parte de nuestro servicio. Por supuesto, sabemos lo molesto que es cuando un sitio web se carga a paso de tortuga. La mayoría de las veces incluso pierdes la paciencia y huyes antes de que el sitio web esté completamente cargado. Por supuesto que queremos evitarlo. Por lo tanto, un sitio web de carga rápida es una parte natural de nuestra oferta de sitios web. Con una red de entrega de contenido, nuestro sitio web se carga significativamente más rápido en su navegador. Usar la CDN es particularmente útil si estás en el extranjero porque el sitio web se entrega desde un servidor cercano.</p>\n' +
		'<h3>¿Qué datos se procesan?</h3>\n' +
		'<p>Cuando solicita un sitio web o el contenido de un sitio web y se almacena en caché en una CDN, la CDN enruta la solicitud al servidor más cercano a usted y este servidor entrega el contenido. Las redes de entrega de contenido están diseñadas para permitir que las bibliotecas de JavaScript se descarguen y alojen en servidores npm y Github. Alternativamente, la mayoría de las CDN también pueden cargar complementos de WordPress si están alojados en <a href="https://wordpress.org/" target="_blank" rel="noopener">WordPress.org . </a>Su navegador puede enviar datos personales a la red de entrega de contenido que utilizamos. Esto incluye datos como la dirección IP, el tipo de navegador, la versión del navegador, qué sitio web está cargado o la hora y fecha de la visita a la página. Estos datos son recopilados y almacenados por la CDN. El uso de cookies para almacenar datos depende de la red utilizada. Lea los textos de protección de datos del servicio respectivo.</p>\n' +
		'<h3>Derecho a oponerse</h3>\n' +
		'<p>Si desea evitar por completo esta transferencia de datos, puede instalar un bloqueador de JavaScript (consulte, por ejemplo, <a href="https://noscript.net/" target="_blank" rel="noopener">https://noscript.net/</a> ) en su PC. Por supuesto, nuestro sitio web ya no puede ofrecer el servicio habitual (como velocidades de carga rápidas).</p>\n' +
		'<h3>Base legal</h3>\n' +
		'<p>Si ha dado su consentimiento para el uso de una red de distribución de contenidos, la base legal para el correspondiente tratamiento de datos es este consentimiento. Según <strong>el artículo 6, apartado 1, letra a del RGPD (consentimiento), este</strong> consentimiento representa la base legal para el procesamiento de datos personales, como puede ocurrir cuando son recopilados por una red de distribución de contenidos.</p>\n' +
		'<p>También tenemos un interés legítimo en utilizar una red de entrega de contenido para optimizar nuestro servicio en línea y hacerlo más seguro. La base jurídica correspondiente es <strong>el artículo 6, apartado 1, letra f del RGPD (intereses legítimos)</strong> . Sin embargo, solo utilizamos la herramienta si usted ha dado su consentimiento.</p>\n' +
		'<p>Puede encontrar información sobre redes de distribución de contenido especiales, si están disponibles, en las siguientes secciones.</p>\n' +
		'<h2 id="cloudflare-datenschutzerklaerung">Política de privacidad de Cloudflare</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Resumen de la política de privacidad de Cloudflare</strong>\n' +
		'<br>\n' +
		'👥 Sujetos de datos: visitantes del sitio web <br>\n' +
		'🤝 Propósito: optimizar el rendimiento de nuestro servicio (para que el sitio web se cargue más rápido) <br>\n' +
		'📓 Datos procesados: datos como dirección IP, información de contacto y protocolo, huellas digitales de seguridad y datos de rendimiento para sitios web <br>\n' +
		'Puede encontrar más detalles al respecto más abajo en esta declaración de protección de datos. <br>\n' +
		'📅 Plazo de almacenamiento: la mayoría de los datos se almacenan durante menos de 24 horas <br>\n' +
		'⚖️ Base jurídica: Art. 6, párrafo 1, letra a del RGPD (consentimiento), Art. 6, párrafo 1, letra f del RGPD (intereses legítimos)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>¿Qué es Cloudflare?</h3>\n' +
		'<p>Utilizamos Cloudflare de Cloudflare, Inc. (101 Townsend St., San Francisco, CA 94107, EE. UU.) en este sitio web para que nuestro sitio web sea más rápido y seguro. Cloudflare utiliza cookies y procesa datos de los usuarios. Cloudflare, Inc. es una empresa estadounidense que ofrece una red de entrega de contenidos y diversos servicios de seguridad. Estos servicios son entre el usuario y nuestro proveedor de hosting. Intentaremos explicar con más detalle qué significa todo esto a continuación.</p>\n' +
		'<p>Una red de entrega de contenidos (CDN), como la que proporciona Cloudflare, no es más que una red de servidores conectados. Cloudflare tiene servidores como este distribuidos por todo el mundo para que los sitios web lleguen a su pantalla más rápido. En pocas palabras, Cloudflare crea copias de nuestro sitio web y las coloca en sus propios servidores. Cuando visita nuestro sitio web, un sistema de equilibrio de carga garantiza que las partes más grandes de nuestro sitio web se entreguen desde el servidor que puede mostrarle nuestro sitio web más rápido. La ruta de transmisión de datos a su navegador se acorta considerablemente gracias a una CDN. Esto significa que Cloudflare le entrega el contenido de nuestro sitio web no solo desde nuestro servidor de alojamiento, sino también desde servidores de todo el mundo. El uso de Cloudflare es particularmente útil para usuarios extranjeros, ya que el sitio puede entregarse desde un servidor cercano. Además de entregar sitios web rápidamente, Cloudflare también ofrece varios servicios de seguridad, como protección DDoS o firewall de aplicaciones web.</p>\n' +
		'<h3>¿Por qué utilizamos Cloudflare en nuestro sitio web?</h3>\n' +
		'<p>Por supuesto queremos ofrecerle el mejor servicio posible con nuestro sitio web. Cloudflare nos ayuda a hacer que nuestro sitio web sea más rápido y seguro. Cloudflare nos ofrece tanto servicios de optimización web como de seguridad como protección DDoS y firewall web. Esto también incluye un <a href="https://de.wikipedia.org/wiki/Reverse_Proxy" target="_blank" rel="noopener noreferrer">proxy inverso</a> y la red de distribución de contenidos (CDN). Cloudflare bloquea las amenazas y limita los robots y rastreadores abusivos que desperdician nuestro ancho de banda y recursos del servidor. Al almacenar nuestro sitio web en centros de datos locales y bloquear el software no deseado, Cloudflare nos permite reducir nuestro uso de ancho de banda en aproximadamente un 60 %. Servir contenido desde un centro de datos cercano y realizar alguna optimización web allí reduce el tiempo de carga promedio de una página web a aproximadamente la mitad. Según Cloudflare, la configuración "Estoy bajo modo de ataque" se puede utilizar para mitigar futuros ataques mostrando una tarea de cálculo de JavaScript que debe resolverse antes de que un usuario pueda acceder a un sitio web. En general, esto hace que nuestro sitio web sea significativamente más potente y menos susceptible al spam u otros ataques.</p>\n' +
		'<h3>¿Qué datos procesa Cloudflare?</h3>\n' +
		'<p>Por lo general, Cloudflare solo reenvía datos controlados por los operadores de sitios web. Por lo tanto, el contenido no lo determina Cloudflare, sino siempre el propio operador del sitio web. Además, Cloudflare puede recopilar cierta información sobre el uso de nuestro sitio web y procesar datos que le enviamos nosotros o para los que Cloudflare ha recibido las instrucciones correspondientes. En la mayoría de los casos, Cloudflare recibe datos como dirección IP, información de contacto y registro, huellas digitales de seguridad y datos de rendimiento del sitio web. Por ejemplo, los datos de registro ayudan a Cloudflare a detectar nuevas amenazas. Esto permite a Cloudflare garantizar un alto nivel de protección de seguridad para nuestro sitio web. Cloudflare procesa estos datos como parte de los Servicios de conformidad con las leyes aplicables. Por supuesto, esto también incluye el Reglamento General de Protección de Datos (GDPR). Cloudflare también trabaja con terceros. Sólo podrán procesar datos personales bajo las instrucciones de Cloudflare y de acuerdo con las pautas de protección de datos y otras medidas de confidencialidad y seguridad. Cloudflare no transmitirá ningún dato personal sin nuestro consentimiento explícito.</p>\n' +
		'<h3>¿Cuánto tiempo y dónde se almacenan los datos?</h3>\n' +
		'<p>Cloudflare almacena su información principalmente en los Estados Unidos y el Espacio Económico Europeo. Cloudflare puede transferir y acceder a la información descrita anteriormente desde cualquier parte del mundo. Generalmente, Cloudflare almacena datos a nivel de usuario para los dominios Free, Pro y Business durante menos de 24 horas. Para los dominios empresariales que tienen habilitados Cloudflare Logs (anteriormente Enterprise LogShare o ELS), los datos se pueden almacenar por hasta 7 días. Sin embargo, si las direcciones IP activan advertencias de seguridad en Cloudflare, puede haber excepciones al período de almacenamiento mencionado anteriormente.</p>\n' +
		'<h3>¿Cómo puedo eliminar mis datos o evitar el almacenamiento de datos?</h3>\n' +
		'<p>Cloudflare solo conserva los registros de datos durante el tiempo necesario y, en la mayoría de los casos, estos datos se eliminan en un plazo de 24 horas. Cloudflare tampoco almacena ningún dato personal, como su dirección IP. Sin embargo, hay información que Cloudflare almacena indefinidamente como parte de sus registros persistentes para mejorar el rendimiento general de Cloudflare Resolver y detectar cualquier riesgo de seguridad. Puede averiguar exactamente qué registros permanentes se almacenan en <a href="https://www.cloudflare.com/application/privacypolicy/">https://www.cloudflare.com/application/privacypolicy/</a> . Todos los datos que recopila Cloudflare (temporales o permanentes) se eliminan de cualquier información personal. Cloudflare también anonimiza todos los registros permanentes.</p>\n' +
		'<p>Cloudflare afirma en su política de privacidad que no son responsables del contenido que reciben. Por ejemplo, si le pregunta a Cloudflare si pueden actualizar o eliminar su contenido, Cloudflare generalmente se refiere a nosotros como el operador del sitio web. También puede impedir por completo toda recopilación y procesamiento de sus datos por parte de Cloudflare desactivando la ejecución de código de secuencia de comandos en su navegador o integrando un bloqueador de secuencias de comandos en su navegador.</p>\n' +
		'<h3>Base legal</h3>\n' +
		'<p>Si ha dado su consentimiento para el uso de Cloudflare, la base legal para el correspondiente tratamiento de datos es este consentimiento. Según <strong>el artículo 6, apartado 1, letra a del RGPD (consentimiento), este</strong> consentimiento representa la base legal para el procesamiento de datos personales, como puede ocurrir cuando los recopila Cloudflare.</p>\n' +
		'<p>También tenemos un interés legítimo en utilizar Cloudflare para optimizar nuestro servicio en línea y hacerlo más seguro. La base jurídica correspondiente es <strong>el artículo 6, apartado 1, letra f del RGPD (intereses legítimos)</strong> . Sin embargo, solo utilizamos Cloudflare si usted ha dado su consentimiento.</p>\n' +
		'<p>Cloudflare también procesa sus datos en EE. UU., entre otros lugares. Cloudflare participa activamente en el Marco de Privacidad de Datos UE-EE.UU., que regula la transferencia correcta y segura de datos personales de ciudadanos de la UE a EE.UU. Puede encontrarse más información en <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a> .</p>\n' +
		'<p>Cloudflare también utiliza las denominadas cláusulas contractuales estándar (= artículo 46, apartados 2 y 3 del RGPD). Las Cláusulas Contractuales Estándar (SCC) son plantillas proporcionadas por la Comisión de la UE y tienen como objetivo garantizar que sus datos cumplan con los estándares europeos de protección de datos incluso si se transfieren a terceros países (como los EE. UU.) y se almacenan allí. A través del Marco de Privacidad de Datos UE-EE. UU. y las Cláusulas Contractuales Estándar, Cloudflare se compromete a cumplir con los niveles europeos de protección de datos al procesar sus datos relevantes, incluso si los datos se almacenan, procesan y administran en los EE. UU. Estas cláusulas se basan en una decisión de implementación de la Comisión de la UE. Puede encontrar la resolución y las cláusulas contractuales tipo correspondientes aquí: <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a> .</p>\n' +
		'<p>Puede obtener más información sobre las cláusulas contractuales estándar y los datos procesados ​​mediante el uso de Cloudflare en la declaración de protección de datos en <a href="https://www.cloudflare.com/de-de/privacypolicy/?tid=112741413" target="_blank" rel="noopener noreferrer">https://www.cloudflare.com/de-de/privacypolicy/</a> .</p>\n' +
		'<h2 id="single-sign-on-anmeldungen-einleitung">Introducción al inicio de sesión único</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Registros de inicio de sesión único Declaración de protección de datos Resumen</strong>\n' +
		'<br>\n' +
		'👥 Afectados: Visitantes del sitio web <br>\n' +
		'🤝 Finalidad: simplificar el proceso de autenticación <br>\n' +
		'📓 Datos procesados: Depende en gran medida del proveedor respectivo, normalmente se pueden guardar la dirección de correo electrónico y el nombre de usuario. <br>\n' +
		'Puede encontrar más detalles al respecto en la respectiva herramienta utilizada. <br>\n' +
		'📅 Plazo de almacenamiento: depende de las herramientas utilizadas <br>\n' +
		'⚖️ Base jurídica: Art. 6 Párr. 1 letra a del RGPD (consentimiento), Artículo 6 Párr. 1 lit. )</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>¿Qué son los inicios de sesión únicos?</h3>\n' +
		'<p>En nuestro sitio web tiene la posibilidad de registrarse rápida y fácilmente en nuestro servicio en línea utilizando una cuenta de usuario de otro proveedor (por ejemplo, a través de Facebook). Este procedimiento de autenticación se denomina, entre otras cosas, "registro de inicio de sesión único". Por supuesto, este proceso de registro sólo funciona si estás registrado en el otro proveedor o tienes una cuenta de usuario e introduces los datos de acceso pertinentes en el formulario online. En muchos casos ya estás registrado, los datos de acceso se introducen automáticamente en el formulario y sólo tienes que confirmar el registro de inicio de sesión único mediante un botón. Como parte de este registro, sus datos personales también podrán ser procesados ​​y almacenados. En este texto de protección de datos abordamos el tratamiento de datos mediante registros de inicio de sesión único en general. Puede encontrar más información en las declaraciones de protección de datos de los respectivos proveedores.</p>\n' +
		'<h3>¿Por qué utilizamos inicios de sesión únicos?</h3>\n' +
		'<p>Queremos hacer que su vida en nuestro sitio web sea lo más fácil y placentera posible. Es por eso que también ofrecemos inicios de sesión únicos. Esto le ahorra un tiempo valioso porque solo necesita una autenticación. Como sólo hay que recordar una contraseña y sólo se transmite una vez, la seguridad también aumenta. En muchos casos, ya ha guardado su contraseña automáticamente mediante cookies y, por lo tanto, el proceso de inicio de sesión en nuestro sitio web solo lleva unos segundos.</p>\n' +
		'<h3>¿Qué datos se almacenan mediante inicios de sesión únicos?</h3>\n' +
		'<p>Aunque inicia sesión en nuestro sitio web mediante este proceso de inicio de sesión especial, la autenticación real se realiza con el proveedor de inicio de sesión único correspondiente. Como operadores de sitios web, recibimos una identificación de usuario como parte de la autenticación. Esto registra que está registrado con el proveedor correspondiente con esta identificación. Esta identificación no se puede utilizar para ningún otro propósito. También es posible que se nos transmitan otros datos, pero esto depende de los proveedores de inicios de sesión único utilizados. También depende de qué datos proporciona voluntariamente durante el proceso de autenticación y qué datos generalmente divulga en su configuración con el proveedor. En la mayoría de los casos, se trata de datos como su dirección de correo electrónico y su nombre de usuario. No conocemos su contraseña, que es necesaria para registrarse, y no la guardaremos. También es importante que sepa que los datos almacenados por nosotros se pueden comparar automáticamente con los datos de la cuenta de usuario respectiva a través del proceso de registro.</p>\n' +
		'<h3>Duración del procesamiento de datos</h3>\n' +
		'<p>Le informaremos a continuación sobre la duración del procesamiento de datos si tenemos más información. Por ejemplo, la plataforma de redes sociales Facebook almacena datos hasta que ya no son necesarios para sus propios fines. Sin embargo, los datos del cliente que se comparen con sus propios datos de usuario se eliminarán en un plazo de dos días. En general, solo procesamos datos personales durante el tiempo que sea absolutamente necesario para proporcionar nuestros servicios y productos.</p>\n' +
		'<h3>Derecho a oponerse</h3>\n' +
		'<p>También tiene el derecho y la oportunidad de revocar su consentimiento para el uso de inicios de sesión únicos en cualquier momento. Esto suele funcionar a través de las funciones de exclusión voluntaria del proveedor. Si están disponibles, también encontrará enlaces a las funciones de exclusión correspondientes en nuestros textos de protección de datos para las herramientas individuales.</p>\n' +
		'<h3>Base legal</h3>\n' +
		'<p>Si se ha acordado con usted y esto se produce en el marco del cumplimiento del contrato (artículo 6, apartado 1, letra b del RGPD) y del consentimiento (artículo 6, apartado 1, letra a del RGPD), podemos utilizar el procedimiento de inicio de sesión único en su base jurídica inserta.</p>\n' +
		'<p>Además del consentimiento, tenemos un interés legítimo en ofrecerle un proceso de registro rápido y sencillo. La base jurídica para ello es el artículo 6, apartado 1, letra f del RGPD (intereses legítimos). Sin embargo, solo utilizamos el registro de inicio de sesión único si usted ha dado su consentimiento.</p>\n' +
		'<p>Si ya no desea este enlace al proveedor con el registro de inicio de sesión único, cancélelo en su cuenta de usuario con el proveedor correspondiente. Si también desea eliminar nuestros datos, deberá cancelar su registro.</p>\n' +
		'<h2 id="google-single-sign-on-datenschutzerklaerung">Política de privacidad de inicio de sesión único de Google</h2>\n' +
		'<p>También utilizamos el servicio de autenticación de inicio de sesión único de Google para iniciar sesión en nuestro sitio web. El proveedor del servicio es la empresa estadounidense Facebook Inc. En Europa, la empresa Google Ireland Limited (Gordon House, Barrow Street Dublin 4, Irlanda) es responsable de todos los servicios de Google.</p>\n' +
		'<p>Google también procesa sus datos, entre otros lugares, en EE.UU. Google participa activamente en el Marco de Privacidad de Datos UE-EE.UU., que regula la transferencia correcta y segura de datos personales de ciudadanos de la UE a EE.UU. Puede encontrarse más información en <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a> .</p>\n' +
		'<p>Google también utiliza las llamadas cláusulas contractuales tipo (= art. 46, apartados 2 y 3 del RGPD). Las Cláusulas Contractuales Estándar (SCC) son plantillas proporcionadas por la Comisión de la UE y tienen como objetivo garantizar que sus datos cumplan con los estándares europeos de protección de datos incluso si se transfieren a terceros países (como los EE. UU.) y se almacenan allí. A través del Marco de Privacidad de Datos UE-EE.UU. y las Cláusulas Contractuales Tipo, Google se compromete a cumplir con el nivel europeo de protección de datos al procesar sus datos relevantes, incluso si los datos se almacenan, procesan y administran en los EE. UU. Estas cláusulas se basan en una decisión de implementación de la Comisión de la UE. Puede encontrar la resolución y las cláusulas contractuales tipo correspondientes aquí: <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a>\n' +
		'</p>\n' +
		'<p>Las condiciones de procesamiento de datos de Google Ads, que hacen referencia a las cláusulas contractuales estándar, se pueden encontrar en <a href="https://business.safety.google/intl/de/adsprocessorterms/" target="_blank" rel="follow noopener">https://business.safety.google/intl/de/adsprocessorterms/</a> .</p>\n' +
		'<p>En Google, puede revocar su consentimiento para el uso de registros de inicio de sesión único mediante la función de exclusión voluntaria en <a href="https://adssettings.google.com/authenticated" target="_blank" rel="follow noopener">https://adssettings.google.com/authenticated . </a>Puede obtener más información sobre los datos procesados ​​mediante el uso del inicio de sesión único de Google en la Política de privacidad en <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="follow noopener">https://policies.google.com/privacy?hl=de</a> .</p>\n' +
		'<h2 id="erklaerung-verwendeter-begriffe">Explicación de los términos utilizados.</h2>\n' +
		'<p>Siempre nos esforzamos por hacer que nuestra declaración de protección de datos sea lo más clara y comprensible posible. Sin embargo, esto no siempre es fácil, especialmente cuando se trata de cuestiones técnicas y legales. A menudo tiene sentido utilizar términos legales (como datos personales) o determinados términos técnicos (como cookies, dirección IP). Pero no queremos usarlos sin explicación. A continuación encontrará una lista alfabética de términos importantes utilizados que quizás no hayamos abordado suficientemente en la declaración de protección de datos anterior. Si estos términos fueron tomados del RGPD y son definiciones, también citaremos aquí los textos del RGPD y agregaremos nuestras propias explicaciones si es necesario.</p>\n' +
		'<h2 id="auftragsverarbeiter">Procesador</h2>\n' +
		'<p>\n' +
		'<strong>Definición según el artículo 4 del RGPD</strong>\n' +
		'</p>\n' +
		'<p>Para los efectos del presente Reglamento, el término significa:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>“Procesador” significa</strong> una persona física o jurídica, autoridad pública, agencia u otro organismo que procesa datos personales en nombre del controlador;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explicación:</strong> Como empresa y propietario de un sitio web, somos responsables de todos los datos que procesamos sobre usted. Además de los responsables, también pueden existir los llamados procesadores. Esto incluye a todas las empresas o personas que procesan datos personales en nuestro nombre. Entre los encargados del tratamiento se pueden incluir, además de proveedores de servicios como asesores fiscales, proveedores de alojamiento o de nube, proveedores de pagos o de boletines o grandes empresas como Google o Microsoft.</p>\n' +
		'<h2 id="einwilligung">consentir</h2>\n' +
		'<p>\n' +
		'<strong>Definición según el artículo 4 del RGPD</strong>\n' +
		'</p>\n' +
		'<p>Para los efectos del presente Reglamento, el término significa:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>“Consentimiento”</strong> del interesado significa cualquier expresión voluntaria, informada e inequívoca de los deseos del interesado en el caso concreto, en forma de declaración u otra acción afirmativa inequívoca, mediante la cual el interesado indica que consiente. acepta el tratamiento de datos personales que le conciernen;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explicación:</strong> Como regla general, dicho consentimiento se otorga en los sitios web a través de una herramienta de consentimiento de cookies. Probablemente lo sepas. Cada vez que visite un sitio web por primera vez, normalmente se le preguntará mediante un banner si está de acuerdo con el procesamiento de datos. Por lo general, también puede realizar ajustes individuales y decidir por sí mismo qué procesamiento de datos permite y cuál no. Si no da su consentimiento, no se podrán procesar datos personales sobre usted. En principio, el consentimiento también puede darse por escrito, es decir, no a través de una herramienta.</p>\n' +
		'<h2 id="personenbezogene-daten">Información personal</h2>\n' +
		'<p>\n' +
		'<strong>Definición según el artículo 4 del RGPD</strong>\n' +
		'</p>\n' +
		'<p>Para los efectos del presente Reglamento, el término significa:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<strong>\n' +
		'<em>“datos personales”</em>\n' +
		'</strong>\n' +
		'<em> significa cualquier información relativa a una persona física identificada o identificable (en adelante “titular de los datos”); Se considera identificable a una persona física si puede identificarse directa o indirectamente, en particular mediante un identificador como un nombre, un número de identificación, datos de ubicación, un identificador en línea o una o más características especiales que expresen la identidad física, fisiológica, genética, psicológica, económica, cultural o social de esa persona física;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explicación:</strong> Los datos personales son todos los datos que pueden identificarlo como persona. Suelen ser datos como:</p>\n' +
		'<ul>\n' +
		'<li>Apellido</li>\n' +
		'<li>DIRECCIÓN</li>\n' +
		'<li>Dirección de correo electrónico</li>\n' +
		'<li>direccion postal</li>\n' +
		'<li>Número de teléfono</li>\n' +
		'<li>fecha de nacimiento</li>\n' +
		'<li>Números de identificación como número de seguro social, número de identificación fiscal, número de cédula de identidad o número de matrícula</li>\n' +
		'<li>Detalles bancarios como número de cuenta, información crediticia, saldos de cuentas y mucho más.</li>\n' +
		'</ul>\n' +
		'<p>Según el Tribunal de Justicia Europeo (TJCE), tu <strong>dirección IP también se considera dato personal</strong> . Gracias a su dirección IP, los expertos en TI pueden al menos determinar la ubicación aproximada de su dispositivo y, posteriormente, de usted como propietario de la conexión. Por lo tanto, el almacenamiento de una dirección IP también requiere una base jurídica en el sentido del RGPD. También existen las llamadas <strong>“categorías especiales”</strong> de datos personales que son particularmente dignos de protección. Éstas incluyen:</p>\n' +
		'<ul>\n' +
		'<li>orígenes raciales y étnicos</li>\n' +
		'<li>opiniones politicas</li>\n' +
		'<li>creencias religiosas o ideológicas</li>\n' +
		'<li>Membresía de la unión</li>\n' +
		'<li>datos genéticos, como datos recopilados de muestras de sangre o saliva</li>\n' +
		'<li>datos biométricos (es información sobre características psicológicas, físicas o de comportamiento que pueden identificar a una persona). <br>\n' +
		'Datos de salud</li>\n' +
		'<li>Datos sobre orientación sexual o vida sexual</li>\n' +
		'</ul>\n' +
		'<h2 id="profiling">Perfilado</h2>\n' +
		'<p>\n' +
		'<strong>Definición según el artículo 4 del RGPD</strong>\n' +
		'</p>\n' +
		'<p>Para los efectos del presente Reglamento, el término significa:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>“Elaboración de perfiles”</strong> significa cualquier tipo de procesamiento automatizado de datos personales, que consiste en utilizar esos datos personales para evaluar ciertos aspectos personales relacionados con una persona física, en particular aspectos relacionados con el desempeño laboral, la situación económica, la salud, el análisis personal o predecir esa persona física. preferencias, intereses, confiabilidad, comportamiento, ubicación o movimientos de la persona;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explicación:</strong> La elaboración de perfiles implica recopilar diversa información sobre una persona para aprender más sobre esa persona. En el sector web, la elaboración de perfiles se utiliza a menudo con fines publicitarios o para comprobar el crédito. Los programas de análisis web o publicitarios, por ejemplo, recopilan datos sobre su comportamiento e intereses en un sitio web. Esto da como resultado un perfil de usuario especial que puede utilizarse para orientar la publicidad a un grupo objetivo específico.</p>\n' +
		'<p>&nbsp;</p>\n' +
		'<h2 id="verantwortlicher">Persona responsable</h2>\n' +
		'<p>\n' +
		'<strong>Definición según el artículo 4 del RGPD</strong>\n' +
		'</p>\n' +
		'<p>Para los efectos del presente Reglamento, el término significa:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>“Responsable” significa</strong> la persona física o jurídica, autoridad pública, agencia u otro organismo que, solo o junto con otros, decide sobre los fines y medios del procesamiento de datos personales; cuando los fines y medios de dicho procesamiento estén determinados por la legislación de la Unión o de los Estados miembros, el responsable del tratamiento o los criterios específicos para su designación podrán estar previstos por la legislación de la Unión o de los Estados miembros;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Explicación:</strong> En nuestro caso, somos el responsable del tratamiento de sus datos personales y por tanto el “responsable”. Si transmitimos los datos recopilados a otros proveedores de servicios para su procesamiento, ellos son "procesadores". Para ello, se debe firmar un “acuerdo de procesamiento de pedidos (AVV)”.</p>\n' +
		'<p>&nbsp;</p>\n' +
		'<h2 id="verarbeitung">Procesando</h2>\n' +
		'<p>\n' +
		'<strong>Definición según el artículo 4 del RGPD</strong>\n' +
		'</p>\n' +
		'<p>Para los efectos del presente Reglamento, el término significa:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<strong>\n' +
		'<em>"Procesamiento" significa</em>\n' +
		'</strong>\n' +
		'<em> cualquier operación o serie de operaciones realizadas con o sin la ayuda de procedimientos automatizados en relación con datos personales, como la recopilación, registro, organización, estructuración, almacenamiento, adaptación o modificación, lectura, consulta, uso, divulgación. mediante transmisión, distribución u otra forma de puesta a disposición, alineación o combinación, restricción, eliminación o destrucción;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Nota:</strong> Cuando hablamos de procesamiento en nuestra política de privacidad, nos referimos a cualquier tipo de procesamiento de datos. Como se mencionó anteriormente en la declaración original del RGPD, esto incluye no solo la recopilación, sino también el almacenamiento y el procesamiento de datos.</p>\n' +
		'<p>Todos los textos tienen derechos de autor.</p>\n' +
		'<p style="margin-top:15px">Fuente: Creado con el Generador de protección de datos de AdSimple <a href="https://www.adsimple.at/datenschutz-generator/" title="Generador de protección de datos Austria de AdSimple">Austria</a></p>\n',
	'VERIFY_MAIL': {
		'SUCCESS': 'Correo electrónico verificado correctamente.',
		'ERROR': 'Error al verificar el correo electrónico',
		'ERROR_HELP': 'El correo se puede reenviar desde la pantalla de inicio de sesión.',
		'BACK_HOME': 'Volver a inicio'
	},
	'DOWNLOAD': {
		'HEADLINE': 'Descargar Editor',
		'DESCRIPTION': 'El editor también está disponible como una aplicación de escritorio. Esto tiene la ventaja de que la simulación es mucho más rápida que en internet. La aplicación se puede descargar a continuación.',
		'DOWNLOAD': 'Descargar',
		'DATE': 'Fecha',
		'FILE_SIZE': 'Tamaño del archivo'
	},
	'NOT_FOUND': {
		'TEXT': 'No se pudo encontrar la página solicitada.',
		'BACK': 'Volver a inicio'
	},
	'MAILS': {
		'VERIFY_MAIL_REGISTER': {
			'SUBJECT': 'Bienvenido a Logigator',
			'WELCOME': 'Bienvenido a Logigator:',
			'PLEASE_VERIFY': 'Por favor, verifica tu dirección de correo electrónico.',
			'TO_DO_SO': 'Para hacerlo',
			'CLICK_HERE': 'haz clic aquí',
			'HAVE_FUN': '¡Diviértete construyendo!'
		},
		'VERIFY_MAIL_EMAIL_UPDATE': {
			'SUBJECT': 'Verifica tu nuevo correo electrónico',
			'CHANGED': 'Tu dirección de correo electrónico fue cambiada recientemente.',
			'PLEASE_VERIFY': 'Por favor, verifica tu dirección de correo electrónico.',
			'TO_DO_SO': 'Para hacerlo',
			'CLICK_HERE': 'haz clic aquí',
			'HAVE_FUN': '¡Diviértete construyendo!'
		},
		'RESET_PASSWORD': {
			'SUBJECT': 'Restablecer contraseña',
			'TEXT': 'Has solicitado restablecer la contraseña de tu cuenta de Logigator. Si no lo solicitaste, ignora este correo.',
			'TO_DO_SO': 'Para restablecer tu contraseña',
			'CLICK_HERE': 'haz clic aquí',
			'HAVE_FUN': '¡Diviértete construyendo!'
		}
	}
};
