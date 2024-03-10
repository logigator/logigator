import { ILanguage } from './index';

export const de: ILanguage = {
	'COOKIE_CONSENT': {
		'MESSAGE': 'Wir verwenden Cookies. Wenn Sie auf unserer Seite weitersurfen, stimmen Sie der Cookie-Nutzung zu.',
		'DISMISS': 'Akzeptieren',
		'LINK': 'Mehr erfahren'
	},
	'TITLE': {
		'HOME': 'Logigator - Der Editor für Logikschaltungen',
		'PRIVACY_POLICY': 'Logigator - Datenschutzerklärung',
		'IMPRINT': 'Logigator - Impressum',
		'FEATURES': 'Logigator - Features',
		'DOWNLOAD': 'Logigator - Download',
		'VERIFY_EMAIL': 'Logigator - Emailverifizierung',
		'PROJECTS': 'Logigator - Projekte',
		'COMPONENTS': 'Logigator - Komponenten',
		'ACCOUNT': 'Logigator - Account',
		'ACCOUNT_PROFILE': 'Logigator - Profil',
		'ACCOUNT_SECURITY': 'Logigator - Sicherheit',
		'ACCOUNT_DELETE': 'Logigator - Account löschen',
		'LOGIN': 'Logigator - Login',
		'REGISTER': 'Logigator - Registrieren',
		'EXAMPLES': 'Logigator - Beispiele',
		'COMMUNITY': 'Logigator - Community'
	},
	'SITE_HEADER': {
		'DOWNLOAD': 'Download',
		'FEATURES': 'Features',
		'PROJECTS': 'Meine Projekte',
		'COMPONENTS': 'Meine Komponenten',
		'COMMUNITY': 'Community',
		'LOGIN': 'Anmelden',
		'REGISTER': 'Registrieren'
	},
	'SETTINGS_DROPDOWN': {
		'DARK_MODE': 'Dunkles Design',
		'LANGUAGE': 'Sprache',
		'PROJECTS': 'Projekte',
		'COMPONENTS': 'Komponenten',
		'ACCOUNT': 'Account',
		'LOGOUT': 'Abmelden'
	},
	'FOOTER': {
		'DATA_POLICY': 'Datenschutzerklärung',
		'IMPRINT': 'Impressum',
		'CONTRIBUTING': 'Mitwirken'
	},
	'HOME': {
		'INTRO': {
			'DESCRIPTION': 'Baue, simuliere und verwalte komplexe Logikschaltungen.',
			'BUTTON': 'Zum Editor'
		},
		'FEATURES': {
			'TITLE': 'Features',
			'DESCRIPTION': 'Baue und simuliere deine eigenen Schaltungen mit Logigator, einem einfachen aber mächtigen online Tool.',
			'PERFORMANCE': 'Performance',
			'PERFORMANCE_DES': "Logigators' Editor kann dank WebAssembly und WebGL auch mit den größten Projekten umgehen.",
			'SUBCIRCUITS': 'Unterschaltungen',
			'SUBCIRCUITS_DES': 'Erstelle deine eigenen Komponenten und verwende sie in all deinen Projekten. Somit können deine Projekte übersichtlich und einfach gehalten werden.',
			'SHARE': 'Projekte teilen',
			'SHARE_DES': 'Teile deine Schaltungen mit anderen Benutzern, damit sie von deiner Arbeit lernen können.',
			'IMAGES': 'Bilder exportieren',
			'IMAGES_DES': 'Mit Logigator kannst du hochauflösende Bilder in verschieden Formaten (SVG, PNG, JPG) generieren, um sie überall zu verwenden.'
		},
		'EXAMPLES': {
			'TITLE': 'Beispielschaltungen',
			'DESCRIPTION': 'Lerne mit unseren Beispielen einfache, als auch komplexere Schaltungen zu bauen.',
			'MORE': 'Weitere Beispielschaltungen'
		},
		'VIDEO': {
			'TITLE': 'Was sind Logikschaltungen?',
			'DESCRIPTION': 'Wenn du nicht weißt, was Logikschaltungen oder Logikgatter sind, haben wir eine kurze Erklärung für dich gemacht.'
		},
		'SHARES': {
			'PROJECTS_TITLE': 'Community erstellte Projekte',
			'PROJECTS_DESCRIPTION': 'Erkunde andere Projekte unserer User. Dein Projekt könnte das nächste auf dieser Liste sein.',
			'COMPS_TITLE': 'Community erstellte Komponenten',
			'COMPS_DESCRIPTION': 'Erkunde andere Komponenten unserer User. Sie sind vielleicht hilfreich für dich.',
			'MORE_PROJECTS': 'Weitere Projekte',
			'MORE_COMPONENTS': 'Weitere Komponenten'
		},
		'PROJECT_TEASERS': {
			'VIEW': 'Öffnen'
		}
	},
	'EXAMPLES': {
		'VIEW': 'Beispiel ansehen',
		'CLONE': 'Beispiel Klonen'
	},
	'FEATURES': {
		'WHAT_IS': {
			'TITLE': 'Was ist Logigator',
			'VIDEO': '114EOH-fdLE',
			'TEXT': 'Logigator ist ein Online Logikgatter-Simulator, welcher es einem ermöglicht im Browser Schaltungen aus logischen Gattern aufzubauen und diese dann zu simulieren. Es lassen sich zum Beispiel Halbaddierer oder Volladdierer bauen, was gut zu Lernzwecken genutzt werden kann. Ob es nur ums Ausprobieren und Erforschen von boolschen Operationen geht, oder um das Entwerfen von neuen, komplexen Schaltungen - Logigator ist das geeignete Tool. <br> Logigator bietet auch hohe Performanz bei umfangreicheren Schaltungen, wie zum Beispiel auch ganzen CPUs (Computer). Mit Hilfe der Technologie “WebAssembly” (https://webassembly.org/) lassen sich Geschwindigkeiten erzielen, welche sonst im Browser nicht möglich wären.'
		},
		'GENERAL': {
			'TITLE': 'Allgemein',
			'VIDEO': 'aLcu7rsbDHA',
			'TEXT': 'Unter https://logigator.com/editor erreicht man den Editor, in dem man Schaltungen entwerfen und simulieren kann. <br> Um ein Schaltungselement zu platzieren, selektiert man das gewollte Element aus dem Baukasten, der sich auf der linken Seite des Bildschirms befindet. Es gibt folgende grundlegende Gatter: UND, ODER, XODER, NICHT, sowie einen Durchpass, welcher das Eingangssignal nicht verändert und einen Taktgeber, welcher in regelmäßigen Abständen ein Signal ausgibt. Natürlich gibt es aber auch komplexere Elemente, die hier nicht erwähnt wurden. Nachdem man ein Element ausgewählt hat, kann man es mit einem Klick auf der Arbeitsfläche platzieren. Mit dem Selektierwerkzeug kann man ein Element auswählen und mithilfe der Einstellungsbox in der rechten unteren Ecke bearbeiten. Die Möglichkeiten dieser Einstellungen variieren von Komponente zu Komponente. Mit Hilfe des Leitungswerkzeugs lassen sich die einzelnen Elemente verbinden.'
		},
		'CUSTOM_COMPS': {
			'TITLE': 'Benutzererstellte Komponenten',
			'VIDEO': '1m9IrqVxTKA',
			'TEXT': 'Oft ist es so, dass man einen Teil einer gebauten Schaltung öfters verwenden will. Dazu kann man eigene Komponenten definieren, die danach leicht wiederzuverwenden sind, auch in mehreren Projekten. <br> Es gibt 2 Arten von Stecker-Elementen: Eingänge und Ausgänge. Platziert man diese in eigenen Komponenten, lassen sich mit deren Hilfe die Ein- und Ausgänge dieser Komponenten kennzeichnen. Man kann sie außerdem beschriften, um den Überblick zu behalten.'
		},
		'SIMULATION': {
			'TITLE': 'Simulation',
			'VIDEO': 'P8fuF-AHbb0',
			'TEXT': 'Im Simulationsmodus lassen sich aufgebaute Schaltungen testen und simulieren. Um in den Simulationsmodus zu wechseln, drückt man auf den “Simulation Starten” Button. Um diese zu starten, drückt man den Play Button. Nun kann man mit der Schaltung interagieren. Will man die Schaltung debuggen, kann man diese mit Hilfe des Pause Buttons pausieren und Schritt für Schritt überprüfen. Mit dem Stopp Button kommen wir wieder zum Ausgangszustand zurück. Grundsätzlich läuft die Simulation so schnell wie möglich. Möchte man die Frequenz limitieren, kann man die Zielfrequenz entweder händisch angeben, oder mit der Frequenz des Bildschirms synchronisieren. Will man sich den Inhalt einer eigenen Komponente genauer ansehen, muss man einfach auf diese klicken.'
		},
		'SAVING': {
			'TITLE': 'Projekte speichern',
			'VIDEO': 'peOkC2Agkoo',
			'TEXT': 'Projekte und eigene Komponenten können sowohl lokal als Datei gespeichert werden, als auch in der Cloud, um sie auf mehreren Geräten bearbeiten zu können, wobei man hierfür angemeldet sein muss. Sie können ebenfalls mit anderen Nutzern geteilt werden.'
		}
	},
	'LOGIN_FORM': {
		'HEADLINE': 'Melde dich hier an',
		'EMAIL': 'E-Mail',
		'EMAIL_ERR_REQUIRED': 'E-Mail muss angegeben werden',
		'EMAIL_ERR_INVALID': 'Bitte geben Sie eine valide E-Mail an.',
		'EMAIL_ERR_NO_USER': 'Email exsistiert nicht.',
		'EMAIL_ERR_NOT_VERIFIED': 'Email Adresse nicht verifiziert.',
		'PASSWORD': 'Passwort',
		'PASSWORD_ERR_REQUIRED': 'Passwort muss angegeben werden',
		'PASSWORD_ERR_INVALID': 'Password ist falsch.',
		'ERR_EMAIL_TAKEN': 'Email Adresse wird bereits verwendet',
		'ERR_VERIFICATION_MAIL': 'Verfizierungs-Email konnte nicht gesendet werden.',
		'ERR_UNKNOWN': 'Ein unbekannter Fehler ist aufgetreten.',
		'LOGIN_BUTTON': 'ANMELDEN',
		'RESEND_BUTTON': 'Verifizierungs Email erneut senden',
		'OR': 'oder'
	},
	'REGISTER_FORM': {
		'HEADLINE': 'Registriere dich hier',
		'EMAIL': 'E-Mail',
		'EMAIL_ERR_REQUIRED': 'E-Mail muss angegeben werden.',
		'EMAIL_ERR_INVALID': 'Bitte geben Sie eine valide E-Mail an.',
		'EMAIL_ERR_TAKEN': 'Email Adresse wird bereits verwendet',
		'USERNAME': 'Benutzername',
		'USERNAME_ERR_REQUIRED': 'Benutzername muss angegeben werden.',
		'USERNAME_ERR_MIN': 'Benutzername muss mindestens zwei Zeichen enthalten.',
		'USERNAME_ERR_MAX': 'Benutzername darf maximal 20 Zeichen enthalten.',
		'USERNAME_ERR_PATTERN': 'Benutzername darf nur a-z, A-Z, 0-9, _ oder - enthalten.',
		'PASSWORD': 'Passwort',
		'PASSWORD_ERR_REQUIRED': 'Passwort muss angegeben werden.',
		'PASSWORD_ERR_MIN': 'Passwort muss mindestens acht Zeichen enthalten.',
		'PASSWORD_ERR_COMPLEXITY': 'Passwort muss Ziffern und Buchstaben enthalten.',
		'PASSWORD_REPEAT': 'Passwort wiederholen',
		'PASSWORD_REPEAT_ERR_REQUIRED': 'Passwort muss wiederholt werden.',
		'PASSWORD_REPEAT_ERR': 'Passwörter stimmen nicht überein.',
		'PRIVACY_POLICY': 'Durch klicken auf "Registrieren" stimmen Sie zu, dass Sie die Datenschutzerklärung gelesen haben akzeptieren.',
		'REGISTER_BUTTON': 'REGISTRIEREN',
		'OR': 'oder',
		'ERR_EMAIL_TAKEN': 'Email Adresse wird bereits verwendet',
		'ERR_VERIFICATION_MAIL': 'Verfizierungs-Email konnte nicht gesendet werden, versuchen Sie es beim anmelden erneut.',
		'ERR_UNKNOWN': 'Ein unbekannter Fehler ist aufgetreten.'
	},
	'COMMUNITY': {
		'NAV': {
			'PROJECTS': 'Projekte',
			'COMPONENTS': 'Komponenten'
		},
		'LATEST': 'Neueste',
		'POPULARITY': 'Beliebtheit',
		'SEARCH': 'Suchen',
		'COMPONENTS': 'Geteilte Komponenten',
		'PROJECTS': 'Geteilte Projekte',
		'VIEW': 'Details anzeigen',
		'OPEN': 'Im Editor öffnen',
		'CLONE': 'Klonen',
		'NO_DESCRIPTION': 'Beschreibung ist nicht verfügbar.',
		'USER': {
			'MEMBER_SINCE': 'Mitglied seit',
			'COMPONENTS': 'Komponenten',
			'PROJECTS': 'Projekte',
			'STARED_COMPONENTS': 'Gemerkte Komponenten',
			'STARED_PROJECTS': 'Gemerkte Projekte',
			'NO_ITEMS': 'Keine Elemente vorhanden.'
		}
	},
	'YOUTUBE_OVERLAY': {
		'CTA': 'Klicke, um das Video zu laden.'
	},
	'USERSPACE': {
		'NAV': {
			'PROJECTS': 'Projekte',
			'COMPONENTS': 'Komponenten',
			'ACCOUNT': 'Account'
		},
		'LIST': {
			'SEARCH': 'Suchen',
			'LAST_EDITED': 'Zuletzt bearbeitet: '
		},
		'PROJECTS': {
			'TITLE': 'Meine Projekte',
			'ERROR': 'Du hast noch keine Projekte definiert.'
		},
		'COMPONENTS': {
			'TITLE': 'Meine Komponenten',
			'ERROR': 'Du hast noch keine Komponenten definiert.'
		},
		'ACCOUNT': {
			'NAV': {
				'PROFILE': 'Profil',
				'SECURITY': 'Sicherheit',
				'DELETE': 'Account löschen'
			},
			'PROFILE': {
				'DELETE_IMAGE': 'Bild löschen',
				'CHANGE_IMAGE': 'Bild ändern',
				'EMAIL': 'Email',
				'EMAIL_ERR_REQUIRED': 'E-Mail muss angegeben werden.',
				'EMAIL_ERR_INVALID': 'Bitte geben Sie eine valide E-Mail an.',
				'EMAIL_ERR_TAKEN': 'Email Adresse wird bereits verwendet',
				'EMAIL_ERR_CHANGE': 'Die Email ist deine aktuelle Email.',
				'USERNAME': 'Benutzername',
				'USERNAME_ERR_REQUIRED': 'Benutzername muss angegeben werden.',
				'USERNAME_ERR_MIN': 'Benutzername muss mindestens zwei Zeichen enthalten.',
				'USERNAME_ERR_MAX': 'Benutzername darf maximal 20 Zeichen enthalten.',
				'USERNAME_ERR_CHANGE': 'Dieser Benutzername ist dein aktueller Benutzername.',
				'SAVE': 'Speichern'
			},
			'SECURITY': {
				'CONNECTED_ACCOUNTS': 'Verbundene Accounts',
				'CONNECT_NOW': 'Jetzt verbinden',
				'CONNECTED': 'Verbunden',
				'PASSWORD_EXPLANATION': 'Du kannst ein Passwort zu deinem Account hinzufügen, um dich damit anmelden zu können. Alle Social Media Accounts bleiben mit deinem Account verbunden.',
				'CURRENT_PASSWORD': 'Aktuelles Passwort',
				'CURRENT_PASSWORD_ERR_REQUIRED': 'Aktuelles Passwort muss eingegeben werden.',
				'CURRENT_PASSWORD_ERR_INVALID': 'Password ist falsch.',
				'PASSWORD': 'Passwort',
				'PASSWORD_ERR_REQUIRED': 'Passwort muss angegeben werden.',
				'PASSWORD_ERR_MIN': 'Passwort muss mindestens acht Zeichen enthalten.',
				'PASSWORD_ERR_COMPLEXITY': 'Passwort muss Ziffern und Buchstaben enthalten.',
				'PASSWORD_REPEAT': 'Passwort wiederholen',
				'PASSWORD_REPEAT_ERR_REQUIRED': 'Passwort muss wiederholt werden.',
				'PASSWORD_REPEAT_ERR': 'Passwörter stimmen nicht überein.',
				'ERR_UNKNOWN': 'Ein unbekannter Fehler ist aufgetreten',
				'SAVE': 'Speichern'
			},
			'DELETE': {
				'HEADLINE': 'Account löschen',
				'MESSAGE': 'Wenn du deinen Account löscht, werden all deine Projekte und Komponenten auch gelöscht. Es ist nicht möglich diese Daten wiederherzustellen.',
				'BUTTON': 'Account löschen'
			}
		}
	},
	'POPUP': {
		'LOGIN': {
			'TITLE': 'Anmelden'
		},
		'REGISTER': {
			'TITLE': 'Registrieren'
		},
		'PROJECT_COMP_CREATE': {
			'COMP_TITLE': 'Neue Komponente',
			'PROJECT_TITLE': 'Neues Projekt',
			'NAME': 'Name',
			'NAME_ERR_REQUIRED': 'Name muss angegeben werden.',
			'NAME_ERR_MAX': 'Name darf maximal 20 Zeichen enthalten.',
			'DESCRIPTION': 'Bschreibung',
			'DESCRIPTION_ERR_MAX': 'Bschreibung ist zu lang.',
			'SYMBOL': 'Symbol',
			'SYMBOL_ERR_REQUIRED': 'Symbol muss angegeben werden.',
			'SYMBOL_ERR_MAX': 'Symbol darf maximal fünf Zeichen enthalten',
			'CREATE': 'Erstellen',
			'PUBLIC': 'Öffentlich teilen',
			'PUBLIC_EXPLANATION': "Ist 'Öffentlich teilen' aktiviert, wird das Projekt, in allen öffentlichen Listen angezeigt."
		},
		'PROJECT_COMP_EDIT': {
			'PROJECT_TITLE': 'Projekt bearbeiten',
			'COMP_TITLE': 'Komponente bearbeiten',
			'NAME': 'Name',
			'NAME_ERR_REQUIRED': 'Name muss angegeben werden.',
			'NAME_ERR_MAX': 'Name ist zu lang.',
			'DESCRIPTION': 'Bschreibung',
			'DESCRIPTION_ERR_MAX': 'Bschreibung ist zu lang.',
			'SYMBOL': 'Symbol',
			'SYMBOL_ERR_REQUIRED': 'Symbol muss angegeben werden.',
			'SYMBOL_ERR_MAX': 'Symbol ist zu lang.',
			'SAVE': 'Speichern'
		},
		'PROJECT_COMP_INFO': {
			'TITLE': 'Informationen',
			'NAME': 'Name',
			'FORKED': 'Entstammt aus',
			'CREATED': 'Erstellt',
			'MODIFIED': 'Zuletzt bearbeitet',
			'INPUTS': 'Eingänge',
			'OUTPUTS': 'Ausgänge',
			'SYMBOL': 'Symbol',
			'DEPENDENCIES': 'Abhängigkeiten',
			'DEPENDENT_PROJECTS': 'Abhängige Projekte',
			'DEPENDENT_COMPONENTS': 'Abhängige Komponenten',
			'NO_DEPENDENCIES': 'keine',
			'DESCRIPTION': 'Beschreibung',
			'COMMUNITY_PAGE': 'Zur Community Seite'
		},
		'PROJECT_COMP_DELETE': {
			'TITLE': 'Löschen bestätigen',
			'DELETE': 'Löschen bestätigen',
			'CANCEL': 'Abbrechen',
			'CONFIRM_PROJECT': 'Sind sie sicher, dass sie dieses Projekt löschen wollen?',
			'CONFIRM_COMP': 'Sind sie sicher, dass sie diese Komponente löschen wollen?',
			'WARNING_COMP': 'Diese Komponente wird in den folgenden Projekten oder Komponenten verwendet:',
			'WARNING_COMP_DELETE': 'Wenn die Komponente gelöscht wird, wird sie aus diesen Projekten und Komponenten entfernt.',
			'PROJECTS': 'Projekte',
			'COMPONENTS': 'Komponenten'
		},
		'PROJECT_COMP_SHARE': {
			'TITLE': 'Teilen',
			'EXPLANATION': "Jeder der den Link besitzt kann das Projekt ansehen, klonen, aber nicht bearbeiten. Ist 'Öffentlich teilen' aktiviert, wird das Projekt, in allen öffentlichen Listen angezeigt.",
			'LINK': 'Link zum teilen',
			'PUBLIC': 'Öffentlich teilen',
			'REGENERATE': 'Neu generieren',
			'REGENERATE_WARN': 'Durch das neu Generieren des Links, wird der alte Link ungültig.',
			'COPY': 'Kopieren',
			'SAVE': 'Speichern',
			'CANCEL': 'Abbrechen'
		},
		'DELETE_IMAGE': {
			'TITLE': 'Bild löschen',
			'DELETE': 'Löschen bestätigen',
			'CANCEL': 'Abbrechen',
			'CONFIRM': 'Willst du dein Proilbild wirklich löschen?'
		},
		'CHANGE_IMAGE': {
			'TITLE': 'Bild ändern',
			'FILE': 'Ziehe dein Bild hierher.',
			'SAVE': 'Speichern',
			'SAVE_ERROR': 'Ein unbekannter Fehler ist aufgetreten.'
		},
		'DELETE_ACCOUNT': {
			'TITLE': 'Account löschen',
			'DELETE': 'Löschen bestätigen',
			'CANCEL': 'Abbrechen',
			'CONFIRM': 'Willst du dein Account wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
		}
	},
	'INFO_POPUP': {
		'LOCAL_REGISTER': {
			'TITLE': 'Email verifizieren',
			'LINE_1': 'Willkommen bei Logigator.',
			'LINE_2': 'Bitte überprüfe deinen Posteingang und verifiziere deine Email Adresse, bevor du beginnen kannst Logigator zu verwenden.',
			'OK_BUTTON': 'OK'
		},
		'EMAIL_UPDATED': {
			'TITLE': 'Email verifizieren',
			'LINE_1': 'Deine Email wurde geändert..',
			'LINE_2': 'Bitte überprüfe deinen Posteingang und verifiziere deine neue Email Adresse',
			'OK_BUTTON': 'OK'
		},
		'PASSWORD_CHANGED': {
			'TITLE': 'Passwort geändert',
			'LINE_1': 'Passwort wurde erfolgreich gesetzt oder geändert.',
			'OK_BUTTON': 'OK'
		},
		'ACCOUNT_DELETED': {
			'TITLE': 'Account gelöscht',
			'LINE_1': 'Dein Account wurde erfolgreich gelöscht.',
			'OK_BUTTON': 'OK'
		}
	},
	'IMPRINT': {
		'HEAD': 'Impressum',
		'INFORMATION_OBLIGATION': 'Informationspflicht laut §5 E-Commerce Gesetz, §14 Unternehmensgesetzbuch, §63 Gewerbeordnung und Offenlegungspflicht laut §25 Mediengesetz.',
		'VIENNA': 'Wien',
		'AUSTRIA': 'Österreich',
		'SOURCE_1': 'Quelle: Erstellt mit dem Impressum Generator von',
		'SOURCE_2': 'in Kooperation mit',
		'CONTENTS_HEAD': 'Haftung für Inhalte dieser Webseitee',
		'CONTENTS_1': 'Wir entwickeln die Inhalte dieser Webseite ständig weiter und bemühen uns korrekte und aktuelle Informationen bereitzustellen. Leider können wir keine Haftung für die Korrektheit aller Inhalte auf dieser Webseite übernehmen, speziell für jene die seitens Dritter bereitgestellt wurden.',
		'CONTENTS_2': 'Sollten Ihnen problematische oder rechtswidrige Inhalte auffallen, bitten wir Sie uns umgehend zu kontaktieren, Sie finden die Kontaktdaten im Impressum.',
		'LINKS_HEAD': 'Haftung für Links auf dieser Webseite',
		'LINKS_1': 'Unsere Webseite enthält Links zu anderen Webseiten für deren Inhalt wir nicht verantwortlich sind. Haftung für verlinkte Websites besteht laut',
		'LINKS_1_1': 'für uns nicht, da wir keine Kenntnis rechtswidriger Tätigkeiten hatten und haben, uns solche Rechtswidrigkeiten auch bisher nicht aufgefallen sind und wir Links sofort entfernen würden, wenn uns Rechtswidrigkeiten bekannt werden.',
		'LINKS_2': 'Wenn Ihnen rechtswidrige Links auf unserer Website auffallen, bitten wir Sie uns zu kontaktieren, Sie finden die Kontaktdaten im Impressum.',
		'COPYRIGHT_HEAD': 'Urheberrechtshinweis',
		'COPYRIGHT_1': 'Icons erstellt von',
		'COPYRIGHT_1_1': 'von',
		'COPYRIGHT_2': 'Alle Inhalte dieser Webseite (Bilder, Fotos, Texte, Videos) unterliegen dem Urheberrecht. Falls notwendig, werden wir die unerlaubte Nutzung von Teilen der Inhalte unserer Seite rechtlich verfolgen.'
	},
	'PRIVACY_POLICY': '<h1>Datenschutzerklärung</h1>\n' +
		'<h2>Inhaltsverzeichnis</h2>\n' +
		'<ul>\n' +
		'<li>\n' +
		'<a href="#einleitung-ueberblick" target="_top">Einleitung und Überblick</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#anwendungsbereich">Anwendungsbereich</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#rechtsgrundlagen">Rechtsgrundlagen</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#speicherdauer">Speicherdauer</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#rechte-dsgvo">Rechte laut Datenschutz-Grundverordnung</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#datenuebertragung-drittlaender">Datenübertragung in Drittländer</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#cookies">Cookies</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#web-analytics-einleitung">Web Analytics Einleitung</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#content-delivery-networks-einleitung">Content Delivery Networks Einleitung</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#single-sign-on-anmeldungen-einleitung">Single-Sign-On-Anmeldungen Einleitung</a>\n' +
		'</li>\n' +
		'<li>\n' +
		'<a href="#erklaerung-verwendeter-begriffe">Erklärung verwendeter Begriffe</a>\n' +
		'</li>\n' +
		'</ul>\n' +
		'<h2 id="einleitung-ueberblick">Einleitung und Überblick</h2>\n' +
		'<p>Wir haben diese Datenschutzerklärung (Fassung 09.03.2024-112741413) verfasst, um Ihnen gemäß der Vorgaben der <a href="https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679&amp;from=DE&amp;tid=112741413#d1e2269-1-1" target="_blank" rel="noopener">Datenschutz-Grundverordnung (EU) 2016/679</a> und anwendbaren nationalen Gesetzen zu erklären, welche personenbezogenen Daten (kurz Daten) wir als Verantwortliche &#8211; und die von uns beauftragten Auftragsverarbeiter (z. B. Provider) &#8211; verarbeiten, zukünftig verarbeiten werden und welche rechtmäßigen Möglichkeiten Sie haben. Die verwendeten Begriffe sind geschlechtsneutral zu verstehen.<br />\n' +
		'<strong>Kurz gesagt:</strong> Wir informieren Sie umfassend über Daten, die wir über Sie verarbeiten.</p>\n' +
		'<p>Datenschutzerklärungen klingen für gewöhnlich sehr technisch und verwenden juristische Fachbegriffe. Diese Datenschutzerklärung soll Ihnen hingegen die wichtigsten Dinge so einfach und transparent wie möglich beschreiben. Soweit es der Transparenz förderlich ist, werden technische <strong>Begriffe leserfreundlich erklärt</strong>, Links zu weiterführenden Informationen geboten und <strong>Grafiken</strong> zum Einsatz gebracht. Wir informieren damit in klarer und einfacher Sprache, dass wir im Rahmen unserer Geschäftstätigkeiten nur dann personenbezogene Daten verarbeiten, wenn eine entsprechende gesetzliche Grundlage gegeben ist. Das ist sicher nicht möglich, wenn man möglichst knappe, unklare und juristisch-technische Erklärungen abgibt, so wie sie im Internet oft Standard sind, wenn es um Datenschutz geht. Ich hoffe, Sie finden die folgenden Erläuterungen interessant und informativ und vielleicht ist die eine oder andere Information dabei, die Sie noch nicht kannten.<br />\n' +
		'Wenn trotzdem Fragen bleiben, möchten wir Sie bitten, sich an die unten bzw. im Impressum genannte verantwortliche Stelle zu wenden, den vorhandenen Links zu folgen und sich weitere Informationen auf Drittseiten anzusehen. Unsere Kontaktdaten finden Sie selbstverständlich auch im Impressum.</p>\n' +
		'<h2 id="anwendungsbereich">Anwendungsbereich</h2>\n' +
		'<p>Diese Datenschutzerklärung gilt für alle von uns im Unternehmen verarbeiteten personenbezogenen Daten und für alle personenbezogenen Daten, die von uns beauftragte Firmen (Auftragsverarbeiter) verarbeiten. Mit personenbezogenen Daten meinen wir Informationen im Sinne des Art. 4 Nr. 1 DSGVO wie zum Beispiel Name, E-Mail-Adresse und postalische Anschrift einer Person. Die Verarbeitung personenbezogener Daten sorgt dafür, dass wir unsere Dienstleistungen und Produkte anbieten und abrechnen können, sei es online oder offline. Der Anwendungsbereich dieser Datenschutzerklärung umfasst:</p>\n' +
		'<ul>\n' +
		'<li>alle Onlineauftritte (Websites, Onlineshops), die wir betreiben</li>\n' +
		'<li>Social Media Auftritte und E-Mail-Kommunikation</li>\n' +
		'<li>mobile Apps für Smartphones und andere Geräte</li>\n' +
		'</ul>\n' +
		'<p>\n' +
		'<strong>Kurz gesagt:</strong> Die Datenschutzerklärung gilt für alle Bereiche, in denen personenbezogene Daten im Unternehmen über die genannten Kanäle strukturiert verarbeitet werden. Sollten wir außerhalb dieser Kanäle mit Ihnen in Rechtsbeziehungen eintreten, werden wir Sie gegebenenfalls gesondert informieren.</p>\n' +
		'<h2 id="rechtsgrundlagen">Rechtsgrundlagen</h2>\n' +
		'<p>In der folgenden Datenschutzerklärung geben wir Ihnen transparente Informationen zu den rechtlichen Grundsätzen und Vorschriften, also den Rechtsgrundlagen der Datenschutz-Grundverordnung, die uns ermöglichen, personenbezogene Daten zu verarbeiten.<br />\n' +
		'Was das EU-Recht betrifft, beziehen wir uns auf die VERORDNUNG (EU) 2016/679 DES EUROPÄISCHEN PARLAMENTS UND DES RATES vom 27. April 2016. Diese Datenschutz-Grundverordnung der EU können Sie selbstverständlich online auf EUR-Lex, dem Zugang zum EU-Recht, unter <a href="https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=celex%3A32016R0679">https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=celex%3A32016R0679</a> nachlesen.</p>\n' +
		'<p>Wir verarbeiten Ihre Daten nur, wenn mindestens eine der folgenden Bedingungen zutrifft:</p>\n' +
		'<ol>\n' +
		'<li>\n' +
		'<strong>Einwilligung</strong> (Artikel 6 Absatz 1 lit. a DSGVO): Sie haben uns Ihre Einwilligung gegeben, Daten zu einem bestimmten Zweck zu verarbeiten. Ein Beispiel wäre die Speicherung Ihrer eingegebenen Daten eines Kontaktformulars.</li>\n' +
		'<li>\n' +
		'<strong>Vertrag</strong> (Artikel 6 Absatz 1 lit. b DSGVO): Um einen Vertrag oder vorvertragliche Verpflichtungen mit Ihnen zu erfüllen, verarbeiten wir Ihre Daten. Wenn wir zum Beispiel einen Kaufvertrag mit Ihnen abschließen, benötigen wir vorab personenbezogene Informationen.</li>\n' +
		'<li>\n' +
		'<strong>Rechtliche Verpflichtung</strong> (Artikel 6 Absatz 1 lit. c DSGVO): Wenn wir einer rechtlichen Verpflichtung unterliegen, verarbeiten wir Ihre Daten. Zum Beispiel sind wir gesetzlich verpflichtet Rechnungen für die Buchhaltung aufzuheben. Diese enthalten in der Regel personenbezogene Daten.</li>\n' +
		'<li>\n' +
		'<strong>Berechtigte Interessen</strong> (Artikel 6 Absatz 1 lit. f DSGVO): Im Falle berechtigter Interessen, die Ihre Grundrechte nicht einschränken, behalten wir uns die Verarbeitung personenbezogener Daten vor. Wir müssen zum Beispiel gewisse Daten verarbeiten, um unsere Website sicher und wirtschaftlich effizient betreiben zu können. Diese Verarbeitung ist somit ein berechtigtes Interesse.</li>\n' +
		'</ol>\n' +
		'<p>Weitere Bedingungen wie die Wahrnehmung von Aufnahmen im öffentlichen Interesse und Ausübung öffentlicher Gewalt sowie dem Schutz lebenswichtiger Interessen treten bei uns in der Regel nicht auf. Soweit eine solche Rechtsgrundlage doch einschlägig sein sollte, wird diese an der entsprechenden Stelle ausgewiesen.</p>\n' +
		'<p>Zusätzlich zu der EU-Verordnung gelten auch noch nationale Gesetze:</p>\n' +
		'<ul>\n' +
		'<li>In <strong>Österreich</strong> ist dies das Bundesgesetz zum Schutz natürlicher Personen bei der Verarbeitung personenbezogener Daten (<strong>Datenschutzgesetz</strong>), kurz <strong>DSG</strong>.</li>\n' +
		'<li>In <strong>Deutschland</strong> gilt das <strong>Bundesdatenschutzgesetz</strong>, kurz<strong> BDSG</strong>.</li>\n' +
		'</ul>\n' +
		'<p>Sofern weitere regionale oder nationale Gesetze zur Anwendung kommen, informieren wir Sie in den folgenden Abschnitten darüber.</p>\n' +
		'<h2 id="speicherdauer">Speicherdauer</h2>\n' +
		'<p>Dass wir personenbezogene Daten nur so lange speichern, wie es für die Bereitstellung unserer Dienstleistungen und Produkte unbedingt notwendig ist, gilt als generelles Kriterium bei uns. Das bedeutet, dass wir personenbezogene Daten löschen, sobald der Grund für die Datenverarbeitung nicht mehr vorhanden ist. In einigen Fällen sind wir gesetzlich dazu verpflichtet, bestimmte Daten auch nach Wegfall des ursprüngliches Zwecks zu speichern, zum Beispiel zu Zwecken der Buchführung.</p>\n' +
		'<p>Sollten Sie die Löschung Ihrer Daten wünschen oder die Einwilligung zur Datenverarbeitung widerrufen, werden die Daten so rasch wie möglich und soweit keine Pflicht zur Speicherung besteht, gelöscht.</p>\n' +
		'<p>Über die konkrete Dauer der jeweiligen Datenverarbeitung informieren wir Sie weiter unten, sofern wir weitere Informationen dazu haben.</p>\n' +
		'<h2 id="rechte-dsgvo">Rechte laut Datenschutz-Grundverordnung</h2>\n' +
		'<p>Gemäß Artikel 13, 14 DSGVO informieren wir Sie über die folgenden Rechte, die Ihnen zustehen, damit es zu einer fairen und transparenten Verarbeitung von Daten kommt:</p>\n' +
		'<ul>\n' +
		'<li>Sie haben laut Artikel 15 DSGVO ein Auskunftsrecht darüber, ob wir Daten von Ihnen verarbeiten. Sollte das zutreffen, haben Sie Recht darauf eine Kopie der Daten zu erhalten und die folgenden Informationen zu erfahren:\n' +
		'<ul>\n' +
		'<li>zu welchem Zweck wir die Verarbeitung durchführen;</li>\n' +
		'<li>die Kategorien, also die Arten von Daten, die verarbeitet werden;</li>\n' +
		'<li>wer diese Daten erhält und wenn die Daten an Drittländer übermittelt werden, wie die Sicherheit garantiert werden kann;</li>\n' +
		'<li>wie lange die Daten gespeichert werden;</li>\n' +
		'<li>das Bestehen des Rechts auf Berichtigung, Löschung oder Einschränkung der Verarbeitung und dem Widerspruchsrecht gegen die Verarbeitung;</li>\n' +
		'<li>dass Sie sich bei einer Aufsichtsbehörde beschweren können (Links zu diesen Behörden finden Sie weiter unten);</li>\n' +
		'<li>die Herkunft der Daten, wenn wir sie nicht bei Ihnen erhoben haben;</li>\n' +
		'<li>ob Profiling durchgeführt wird, ob also Daten automatisch ausgewertet werden, um zu einem persönlichen Profil von Ihnen zu gelangen.</li>\n' +
		'</ul>\n' +
		'</li>\n' +
		'<li>Sie haben laut Artikel 16 DSGVO ein Recht auf Berichtigung der Daten, was bedeutet, dass wir Daten richtig stellen müssen, falls Sie Fehler finden.</li>\n' +
		'<li>Sie haben laut Artikel 17 DSGVO das Recht auf Löschung („Recht auf Vergessenwerden“), was konkret bedeutet, dass Sie die Löschung Ihrer Daten verlangen dürfen.</li>\n' +
		'<li>Sie haben laut Artikel 18 DSGVO das Recht auf Einschränkung der Verarbeitung, was bedeutet, dass wir die Daten nur mehr speichern dürfen aber nicht weiter verwenden.</li>\n' +
		'<li>Sie haben laut Artikel 20 DSGVO das Recht auf Datenübertragbarkeit, was bedeutet, dass wir Ihnen auf Anfrage Ihre Daten in einem gängigen Format zur Verfügung stellen.</li>\n' +
		'<li>Sie haben laut Artikel 21 DSGVO ein Widerspruchsrecht, welches nach Durchsetzung eine Änderung der Verarbeitung mit sich bringt.\n' +
		'<ul>\n' +
		'<li>Wenn die Verarbeitung Ihrer Daten auf Artikel 6 Abs. 1 lit. e (öffentliches Interesse, Ausübung öffentlicher Gewalt) oder Artikel 6 Abs. 1 lit. f (berechtigtes Interesse) basiert, können Sie gegen die Verarbeitung Widerspruch einlegen. Wir prüfen danach so rasch wie möglich, ob wir diesem Widerspruch rechtlich nachkommen können.</li>\n' +
		'<li>Werden Daten verwendet, um Direktwerbung zu betreiben, können Sie jederzeit gegen diese Art der Datenverarbeitung widersprechen. Wir dürfen Ihre Daten danach nicht mehr für Direktmarketing verwenden.</li>\n' +
		'<li>Werden Daten verwendet, um Profiling zu betreiben, können Sie jederzeit gegen diese Art der Datenverarbeitung widersprechen. Wir dürfen Ihre Daten danach nicht mehr für Profiling verwenden.</li>\n' +
		'</ul>\n' +
		'</li>\n' +
		'<li>Sie haben laut Artikel 22 DSGVO unter Umständen das Recht, nicht einer ausschließlich auf einer automatisierten Verarbeitung (zum Beispiel Profiling) beruhenden Entscheidung unterworfen zu werden.</li>\n' +
		'<li>Sie haben laut Artikel 77 DSGVO das Recht auf Beschwerde. Das heißt, Sie können sich jederzeit bei der Datenschutzbehörde beschweren, wenn Sie der Meinung sind, dass die Datenverarbeitung von personenbezogenen Daten gegen die DSGVO verstößt.</li>\n' +
		'</ul>\n' +
		'<p>\n' +
		'<strong>Kurz gesagt:</strong> Sie haben Rechte &#8211; zögern Sie nicht, die oben gelistete verantwortliche Stelle bei uns zu kontaktieren!</p>\n' +
		'<p>Wenn Sie glauben, dass die Verarbeitung Ihrer Daten gegen das Datenschutzrecht verstößt oder Ihre datenschutzrechtlichen Ansprüche in sonst einer Weise verletzt worden sind, können Sie sich bei der Aufsichtsbehörde beschweren. Diese ist für Österreich die Datenschutzbehörde, deren Website Sie unter <a href="https://www.dsb.gv.at/?tid=112741413" target="_blank" rel="noopener">https://www.dsb.gv.at/</a> finden. In Deutschland gibt es für jedes Bundesland einen Datenschutzbeauftragten. Für nähere Informationen können Sie sich an die <a href="https://www.bfdi.bund.de/DE/Home/home_node.html" target="_blank" rel="noopener">Bundesbeauftragte für den Datenschutz und die Informationsfreiheit (BfDI)</a> wenden. Für unser Unternehmen ist die folgende lokale Datenschutzbehörde zuständig:</p>\n' +
		'<h2 id="datenuebertragung-drittlaender">Datenübertragung in Drittländer</h2>\n' +
		'<p>Wir übertragen oder verarbeiten Daten nur dann in Länder außerhalb des Geltungsbereichs der DSGVO (Drittländer), wenn Sie in diese Verarbeitung einwilligen oder eine sonstige gesetzliche Erlaubnis besteht. Dies trifft insbesondere zu, wenn die Verarbeitung gesetzlich vorgeschrieben oder zur Erfüllung eines Vertragsverhältnisses notwendig und in jedem Fall nur soweit dies generell erlaubt ist. Ihre Zustimmung ist in den meisten Fällen der wichtigste Grund, dass wir Daten in Drittländern verarbeiten lassen. Die Verarbeitung personenbezogener Daten in Drittländern wie den USA, wo viele Softwarehersteller Dienstleistungen anbieten und Ihre Serverstandorte haben, kann bedeuten, dass personenbezogene Daten auf unerwartete Weise verarbeitet und gespeichert werden.</p>\n' +
		'<p>Wir weisen ausdrücklich darauf hin, dass nach Meinung des Europäischen Gerichtshofs derzeit nur dann ein angemessenes Schutzniveau für den Datentransfer in die USA besteht, wenn ein US-Unternehmen, das personenbezogene Daten von EU-Bürgern in den USA verarbeitet, aktiver Teilnehmer des EU-US Data Privacy Frameworks ist. Mehr Informationen dazu finden Sie unter: <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a>\n' +
		'</p>\n' +
		'<p>Die Datenverarbeitung durch US-Dienste, die nicht aktive Teilnehmer des EU-US Data Privacy Frameworks sind, kann dazu führen, dass gegebenenfalls Daten nicht anonymisiert verarbeitet und gespeichert werden. Ferner können gegebenenfalls US-amerikanische staatliche Behörden Zugriff auf einzelne Daten nehmen. Zudem kann es vorkommen, dass erhobene Daten mit Daten aus anderen Diensten desselben Anbieters, sofern Sie ein entsprechendes Nutzerkonto haben, verknüpft werden. Nach Möglichkeit versuchen wir Serverstandorte innerhalb der EU zu nutzen, sofern das angeboten wird.<br />\n' +
		'Wir informieren Sie an den passenden Stellen dieser Datenschutzerklärung genauer über Datenübertragung in Drittländer, sofern diese zutrifft.</p>\n' +
		'<h2 id="cookies">Cookies</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Cookies Zusammenfassung</strong>\n' +
		'<br />\n' +
		'&#x1f465; Betroffene: Besucher der Website<br />\n' +
		'&#x1f91d; Zweck: abhängig vom jeweiligen Cookie. Mehr Details dazu finden Sie weiter unten bzw. beim Hersteller der Software, der das Cookie setzt.<br />\n' +
		'&#x1f4d3; Verarbeitete Daten: Abhängig vom jeweils eingesetzten Cookie. Mehr Details dazu finden Sie weiter unten bzw. beim Hersteller der Software, der das Cookie setzt.<br />\n' +
		'&#x1f4c5; Speicherdauer: abhängig vom jeweiligen Cookie, kann von Stunden bis hin zu Jahren variieren<br />\n' +
		'&#x2696;&#xfe0f; Rechtsgrundlagen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Art. 6 Abs. 1 lit.f DSGVO (Berechtigte Interessen)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Was sind Cookies?</h3>\n' +
		'<p>Unsere Website verwendet HTTP-Cookies, um nutzerspezifische Daten zu speichern.<br />\n' +
		'Im Folgenden erklären wir, was Cookies sind und warum Sie genutzt werden, damit Sie die folgende Datenschutzerklärung besser verstehen.</p>\n' +
		'<p>Immer wenn Sie durch das Internet surfen, verwenden Sie einen Browser. Bekannte Browser sind beispielsweise Chrome, Safari, Firefox, Internet Explorer und Microsoft Edge. Die meisten Websites speichern kleine Text-Dateien in Ihrem Browser. Diese Dateien nennt man Cookies.</p>\n' +
		'<p>Eines ist nicht von der Hand zu weisen: Cookies sind echt nützliche Helferlein. Fast alle Websites verwenden Cookies. Genauer gesprochen sind es HTTP-Cookies, da es auch noch andere Cookies für andere Anwendungsbereiche gibt. HTTP-Cookies sind kleine Dateien, die von unserer Website auf Ihrem Computer gespeichert werden. Diese Cookie-Dateien werden automatisch im Cookie-Ordner, quasi dem &#8220;Hirn&#8221; Ihres Browsers, untergebracht. Ein Cookie besteht aus einem Namen und einem Wert. Bei der Definition eines Cookies müssen zusätzlich ein oder mehrere Attribute angegeben werden.</p>\n' +
		'<p>Cookies speichern gewisse Nutzerdaten von Ihnen, wie beispielsweise Sprache oder persönliche Seiteneinstellungen. Wenn Sie unsere Seite wieder aufrufen, übermittelt Ihr Browser die „userbezogenen“ Informationen an unsere Seite zurück. Dank der Cookies weiß unsere Website, wer Sie sind und bietet Ihnen die Einstellung, die Sie gewohnt sind. In einigen Browsern hat jedes Cookie eine eigene Datei, in anderen wie beispielsweise Firefox sind alle Cookies in einer einzigen Datei gespeichert.</p>\n' +
		'<p>Die folgende Grafik zeigt eine mögliche Interaktion zwischen einem Webbrowser wie z. B. Chrome und dem Webserver. Dabei fordert der Webbrowser eine Website an und erhält vom Server ein Cookie zurück, welches der Browser erneut verwendet, sobald eine andere Seite angefordert wird.</p>\n' +
		'<p>\n' +
		'<img role="img" src="https://www.adsimple.at/wp-content/uploads/2018/03/http-cookie-interaction.svg" alt="HTTP Cookie Interaktion zwischen Browser und Webserver" width="100%" />\n' +
		'</p>\n' +
		'<p>Es gibt sowohl Erstanbieter Cookies als auch Drittanbieter-Cookies. Erstanbieter-Cookies werden direkt von unserer Seite erstellt, Drittanbieter-Cookies werden von Partner-Websites (z.B. Google Analytics) erstellt. Jedes Cookie ist individuell zu bewerten, da jedes Cookie andere Daten speichert. Auch die Ablaufzeit eines Cookies variiert von ein paar Minuten bis hin zu ein paar Jahren. Cookies sind keine Software-Programme und enthalten keine Viren, Trojaner oder andere „Schädlinge“. Cookies können auch nicht auf Informationen Ihres PCs zugreifen.</p>\n' +
		'<p>So können zum Beispiel Cookie-Daten aussehen:</p>\n' +
		'<p>\n' +
		'<strong>Name:</strong> _ga<br />\n' +
		'<strong>Wert:</strong> GA1.2.1326744211.152112741413-9<br />\n' +
		'<strong>Verwendungszweck:</strong> Unterscheidung der Websitebesucher<br />\n' +
		'<strong>Ablaufdatum:</strong> nach 2 Jahren</p>\n' +
		'<p>Diese Mindestgrößen sollte ein Browser unterstützen können:</p>\n' +
		'<ul>\n' +
		'<li>Mindestens 4096 Bytes pro Cookie</li>\n' +
		'<li>Mindestens 50 Cookies pro Domain</li>\n' +
		'<li>Mindestens 3000 Cookies insgesamt</li>\n' +
		'</ul>\n' +
		'<h3>Welche Arten von Cookies gibt es?</h3>\n' +
		'<p>Die Frage welche Cookies wir im Speziellen verwenden, hängt von den verwendeten Diensten ab und wird in den folgenden Abschnitten der Datenschutzerklärung geklärt. An dieser Stelle möchten wir kurz auf die verschiedenen Arten von HTTP-Cookies eingehen.</p>\n' +
		'<p>Man kann 4 Arten von Cookies unterscheiden:</p>\n' +
		'<p>\n' +
		'<strong>Unerlässliche Cookies<br />\n' +
		'</strong>Diese Cookies sind nötig, um grundlegende Funktionen der Website sicherzustellen. Zum Beispiel braucht es diese Cookies, wenn ein User ein Produkt in den Warenkorb legt, dann auf anderen Seiten weitersurft und später erst zur Kasse geht. Durch diese Cookies wird der Warenkorb nicht gelöscht, selbst wenn der User sein Browserfenster schließt.</p>\n' +
		'<p>\n' +
		'<strong>Zweckmäßige Cookies<br />\n' +
		'</strong>Diese Cookies sammeln Infos über das Userverhalten und ob der User etwaige Fehlermeldungen bekommt. Zudem werden mithilfe dieser Cookies auch die Ladezeit und das Verhalten der Website bei verschiedenen Browsern gemessen.</p>\n' +
		'<p>\n' +
		'<strong>Zielorientierte Cookies<br />\n' +
		'</strong>Diese Cookies sorgen für eine bessere Nutzerfreundlichkeit. Beispielsweise werden eingegebene Standorte, Schriftgrößen oder Formulardaten gespeichert.</p>\n' +
		'<p>\n' +
		'<strong>Werbe-Cookies<br />\n' +
		'</strong>Diese Cookies werden auch Targeting-Cookies genannt. Sie dienen dazu dem User individuell angepasste Werbung zu liefern. Das kann sehr praktisch, aber auch sehr nervig sein.</p>\n' +
		'<p>Üblicherweise werden Sie beim erstmaligen Besuch einer Website gefragt, welche dieser Cookiearten Sie zulassen möchten. Und natürlich wird diese Entscheidung auch in einem Cookie gespeichert.</p>\n' +
		'<p>Wenn Sie mehr über Cookies wissen möchten und technische Dokumentationen nicht scheuen, empfehlen wir <a href="https://datatracker.ietf.org/doc/html/rfc6265">https://datatracker.ietf.org/doc/html/rfc6265</a>, dem Request for Comments der Internet Engineering Task Force (IETF) namens &#8220;HTTP State Management Mechanism&#8221;.</p>\n' +
		'<h3>Zweck der Verarbeitung über Cookies</h3>\n' +
		'<p>Der Zweck ist letztendlich abhängig vom jeweiligen Cookie. Mehr Details dazu finden Sie weiter unten bzw. beim Hersteller der Software, die das Cookie setzt.</p>\n' +
		'<h3>Welche Daten werden verarbeitet?</h3>\n' +
		'<p>Cookies sind kleine Gehilfen für eine viele verschiedene Aufgaben. Welche Daten in Cookies gespeichert werden, kann man leider nicht verallgemeinern, aber wir werden Sie im Rahmen der folgenden Datenschutzerklärung über die verarbeiteten bzw. gespeicherten Daten informieren.</p>\n' +
		'<h3>Speicherdauer von Cookies</h3>\n' +
		'<p>Die Speicherdauer hängt vom jeweiligen Cookie ab und wird weiter unter präzisiert. Manche Cookies werden nach weniger als einer Stunde gelöscht, andere können mehrere Jahre auf einem Computer gespeichert bleiben.</p>\n' +
		'<p>Sie haben außerdem selbst Einfluss auf die Speicherdauer. Sie können über ihren Browser sämtliche Cookies jederzeit manuell löschen (siehe auch unten &#8220;Widerspruchsrecht&#8221;). Ferner werden Cookies, die auf einer Einwilligung beruhen, spätestens nach Widerruf Ihrer Einwilligung gelöscht, wobei die Rechtmäßigkeit der Speicherung bis dahin unberührt bleibt.</p>\n' +
		'<h3>Widerspruchsrecht &#8211; wie kann ich Cookies löschen?</h3>\n' +
		'<p>Wie und ob Sie Cookies verwenden wollen, entscheiden Sie selbst. Unabhängig von welchem Service oder welcher Website die Cookies stammen, haben Sie immer die Möglichkeit Cookies zu löschen, zu deaktivieren oder nur teilweise zuzulassen. Zum Beispiel können Sie Cookies von Drittanbietern blockieren, aber alle anderen Cookies zulassen.</p>\n' +
		'<p>Wenn Sie feststellen möchten, welche Cookies in Ihrem Browser gespeichert wurden, wenn Sie Cookie-Einstellungen ändern oder löschen wollen, können Sie dies in Ihren Browser-Einstellungen finden:</p>\n' +
		'<p>\n' +
		'<a href="https://support.google.com/chrome/answer/95647?tid=112741413" target="_blank" rel="noopener noreferrer">Chrome: Cookies in Chrome löschen, aktivieren und verwalten</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.apple.com/de-at/guide/safari/sfri11471/mac?tid=112741413" target="_blank" rel="noopener noreferrer">Safari: Verwalten von Cookies und Websitedaten mit Safari</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.mozilla.org/de/kb/cookies-und-website-daten-in-firefox-loschen?tid=112741413" target="_blank" rel="noopener noreferrer">Firefox: Cookies löschen, um Daten zu entfernen, die Websites auf Ihrem Computer abgelegt haben</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.microsoft.com/de-de/windows/l%C3%B6schen-und-verwalten-von-cookies-168dab11-0753-043d-7c16-ede5947fc64d?tid=112741413">Internet Explorer: Löschen und Verwalten von Cookies</a>\n' +
		'</p>\n' +
		'<p>\n' +
		'<a href="https://support.microsoft.com/de-de/microsoft-edge/cookies-in-microsoft-edge-l%C3%B6schen-63947406-40ac-c3b8-57b9-2a946a29ae09?tid=112741413">Microsoft Edge: Löschen und Verwalten von Cookies</a>\n' +
		'</p>\n' +
		'<p>Falls Sie grundsätzlich keine Cookies haben wollen, können Sie Ihren Browser so einrichten, dass er Sie immer informiert, wenn ein Cookie gesetzt werden soll. So können Sie bei jedem einzelnen Cookie entscheiden, ob Sie das Cookie erlauben oder nicht. Die Vorgangsweise ist je nach Browser verschieden. Am besten Sie suchen die Anleitung in Google mit dem Suchbegriff “Cookies löschen Chrome” oder &#8220;Cookies deaktivieren Chrome&#8221; im Falle eines Chrome Browsers.</p>\n' +
		'<h3>Rechtsgrundlage</h3>\n' +
		'<p>Seit 2009 gibt es die sogenannten „Cookie-Richtlinien“. Darin ist festgehalten, dass das Speichern von Cookies eine <strong>Einwilligung</strong> (Artikel 6 Abs. 1 lit. a DSGVO) von Ihnen verlangt. Innerhalb der EU-Länder gibt es allerdings noch sehr unterschiedliche Reaktionen auf diese Richtlinien. In Österreich erfolgte aber die Umsetzung dieser Richtlinie in § 165 Abs. 3 des Telekommunikationsgesetzes (2021). In Deutschland wurden die Cookie-Richtlinien nicht als nationales Recht umgesetzt. Stattdessen erfolgte die Umsetzung dieser Richtlinie weitgehend in § 15 Abs.3 des Telemediengesetzes (TMG).</p>\n' +
		'<p>Für unbedingt notwendige Cookies, auch soweit keine Einwilligung vorliegt, bestehen <strong>berechtigte Interessen</strong> (Artikel 6 Abs. 1 lit. f DSGVO), die in den meisten Fällen wirtschaftlicher Natur sind. Wir möchten den Besuchern der Website eine angenehme Benutzererfahrung bescheren und dafür sind bestimmte Cookies oft unbedingt notwendig.</p>\n' +
		'<p>Soweit nicht unbedingt erforderliche Cookies zum Einsatz kommen, geschieht dies nur im Falle Ihrer Einwilligung. Rechtsgrundlage ist insoweit Art. 6 Abs. 1 lit. a DSGVO.</p>\n' +
		'<p>In den folgenden Abschnitten werden Sie genauer über den Einsatz von Cookies informiert, sofern eingesetzte Software Cookies verwendet.</p>\n' +
		'<h2 id="web-analytics-einleitung">Web Analytics Einleitung</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Web Analytics Datenschutzerklärung Zusammenfassung</strong>\n' +
		'<br />\n' +
		'&#x1f465; Betroffene: Besucher der Website<br />\n' +
		'&#x1f91d; Zweck: Auswertung der Besucherinformationen zur Optimierung des Webangebots.<br />\n' +
		'&#x1f4d3; Verarbeitete Daten: Zugriffsstatistiken, die Daten wie Standorte der Zugriffe, Gerätedaten, Zugriffsdauer und Zeitpunkt, Navigationsverhalten, Klickverhalten und IP-Adressen enthalten. Mehr Details dazu finden Sie beim jeweils eingesetzten Web Analytics Tool.<br />\n' +
		'&#x1f4c5; Speicherdauer: abhängig vom eingesetzten Web-Analytics-Tool<br />\n' +
		'&#x2696;&#xfe0f; Rechtsgrundlagen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Was ist Web Analytics?</h3>\n' +
		'<p>Wir verwenden auf unserer Website Software zur Auswertung des Verhaltens der Website-Besucher, kurz Web Analytics oder Web-Analyse genannt. Dabei werden Daten gesammelt, die der jeweilige Analytic-Tool-Anbieter (auch Trackingtool genannt) speichert, verwaltet und verarbeitet. Mit Hilfe der Daten werden Analysen über das Nutzerverhalten auf unserer Website erstellt und uns als Websitebetreiber zur Verfügung gestellt. Zusätzlich bieten die meisten Tools verschiedene Testmöglichkeiten an. So können wir etwa testen, welche Angebote oder Inhalte bei unseren Besuchern am besten ankommen. Dafür zeigen wir Ihnen für einen begrenzten Zeitabschnitt zwei verschiedene Angebote. Nach dem Test (sogenannter A/B-Test) wissen wir, welches Produkt bzw. welcher Inhalt unsere Websitebesucher interessanter finden. Für solche Testverfahren, wie auch für andere Analytics-Verfahren, können auch Userprofile erstellt werden und die Daten in Cookies gespeichert werden.</p>\n' +
		'<h3>Warum betreiben wir Web Analytics?</h3>\n' +
		'<p>Mit unserer Website haben wir ein klares Ziel vor Augen: wir wollen für unsere Branche das beste Webangebot auf dem Markt liefern. Um dieses Ziel zu erreichen, wollen wir einerseits das beste und interessanteste Angebot bieten und andererseits darauf achten, dass Sie sich auf unserer Website rundum wohlfühlen. Mit Hilfe von Webanalyse-Tools können wir das Verhalten unserer Websitebesucher genauer unter die Lupe nehmen und dann entsprechend unser Webangebot für Sie und uns verbessern. So können wir beispielsweise erkennen wie alt unsere Besucher durchschnittlich sind, woher sie kommen, wann unsere Website am meisten besucht wird oder welche Inhalte oder Produkte besonders beliebt sind. All diese Informationen helfen uns die Website zu optimieren und somit bestens an Ihre Bedürfnisse, Interessen und Wünsche anzupassen.</p>\n' +
		'<h3>Welche Daten werden verarbeitet?</h3>\n' +
		'<p>Welche Daten genau gespeichert werden, hängt natürlich von den verwendeten Analyse-Tools ab. Doch in der Regel wird zum Beispiel gespeichert, welche Inhalte Sie auf unserer Website ansehen, auf welche Buttons oder Links Sie klicken, wann Sie eine Seite aufrufen, welchen Browser sie verwenden, mit welchem Gerät (PC, Tablet, Smartphone usw.) Sie die Website besuchen oder welches Computersystem Sie verwenden. Wenn Sie damit einverstanden waren, dass auch Standortdaten erhoben werden dürfen, können auch diese durch den Webanalyse-Tool-Anbieter verarbeitet werden.</p>\n' +
		'<p>Zudem wird auch Ihre IP-Adresse gespeichert. Gemäß der Datenschutz-Grundverordnung (DSGVO) sind IP-Adressen personenbezogene Daten. Ihre IP-Adresse wird allerdings in der Regel pseudonymisiert (also in unkenntlicher und gekürzter Form) gespeichert. Für den Zweck der Tests, der Webanalyse und der Weboptimierung werden grundsätzlich keine direkten Daten, wie etwa Ihr Name, Ihr Alter, Ihre Adresse oder Ihre E-Mail-Adresse gespeichert. All diese Daten werden, sofern sie erhoben werden, pseudonymisiert gespeichert. So können Sie als Person nicht identifiziert werden.</p>\n' +
		'<p>Das folgende Beispiel zeigt schematisch die Funktionsweise von Google Analytics als Beispiel für client-basiertes Webtracking mit Java-Script-Code.</p>\n' +
		'<p>\n' +
		'<img role="img" src="https://www.adsimple.at/wp-content/uploads/2021/04/google-analytics-dataflow.svg" alt="Schematischer Datenfluss bei Google Analytics" width="100%" />\n' +
		'</p>\n' +
		'<p>Wie lange die jeweiligen Daten gespeichert werden, hängt immer vom Anbieter ab. Manche Cookies speichern Daten nur für ein paar Minuten bzw. bis Sie die Website wieder verlassen, andere Cookies können Daten über mehrere Jahre speichern.</p>\n' +
		'<h3>\n' +
		'<span data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Wo und wie lange werden Daten gespeichert?&quot;}" data-sheets-userformat="{&quot;2&quot;:769,&quot;3&quot;:{&quot;1&quot;:0},&quot;11&quot;:4,&quot;12&quot;:0}">Dauer der Datenverarbeitung</span>\n' +
		'</h3>\n' +
		'<p>Über die Dauer der Datenverarbeitung informieren wir Sie weiter unten, sofern wir weitere Informationen dazu haben. Generell verarbeiten wir personenbezogene Daten nur so lange wie es für die Bereitstellung unserer Dienstleistungen und Produkte unbedingt notwendig ist. Wenn es, wie zum Beispiel im Fall von Buchhaltung, gesetzlich vorgeschrieben ist, kann diese Speicherdauer auch überschritten werden.</p>\n' +
		'<h3>Widerspruchsrecht</h3>\n' +
		'<p>Sie haben auch jederzeit das Recht und die Möglichkeit Ihre Einwilligung zur Verwendung von Cookies bzw. Drittanbietern zu widerrufen. Das funktioniert entweder über unser Cookie-Management-Tool oder über andere Opt-Out-Funktionen. Zum Beispiel können Sie auch die Datenerfassung durch Cookies verhindern, indem Sie in Ihrem Browser die Cookies verwalten, deaktivieren oder löschen.</p>\n' +
		'<h3>Rechtsgrundlage</h3>\n' +
		'<p>Der Einsatz von Web-Analytics setzt Ihre Einwilligung voraus, welche wir mit unserem Cookie Popup eingeholt haben. Diese Einwilligung stellt laut<strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</strong> die Rechtsgrundlage für die Verarbeitung personenbezogener Daten, wie sie bei der Erfassung durch Web-Analytics Tools vorkommen kann, dar.</p>\n' +
		'<p>Zusätzlich zur Einwilligung besteht von unserer Seite ein berechtigtes Interesse daran, das Verhalten der Websitebesucher zu analysieren und so unser Angebot technisch und wirtschaftlich zu verbessern. Mit Hilfe von Web-Analytics erkennen wir Fehler der Website, können Attacken identifizieren und die Wirtschaftlichkeit verbessern. Die Rechtsgrundlage dafür ist <strong>Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</strong>. Wir setzen die Tools gleichwohl nur ein, soweit sie eine Einwilligung erteilt haben.</p>\n' +
		'<p>Da bei Web-Analytics-Tools Cookies zum Einsatz kommen, empfehlen wir Ihnen auch das Lesen unserer allgemeinen Datenschutzerklärung zu Cookies. Um zu erfahren, welche Daten von Ihnen genau gespeichert und verarbeitet werden, sollten Sie die Datenschutzerklärungen der jeweiligen Tools durchlesen.</p>\n' +
		'<p>Informationen zu speziellen Web-Analytics-Tools, erhalten Sie &#8211; sofern vorhanden &#8211; in den folgenden Abschnitten.</p>\n' +
		'<h2 id="google-analytics-datenschutzerklaerung">Google Analytics Datenschutzerklärung</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Google Analytics Datenschutzerklärung Zusammenfassung</strong>\n' +
		'<br />\n' +
		'&#x1f465; Betroffene: Besucher der Website<br />\n' +
		'&#x1f91d; Zweck: Auswertung der Besucherinformationen zur Optimierung des Webangebots.<br />\n' +
		'&#x1f4d3; Verarbeitete Daten: Zugriffsstatistiken, die Daten wie Standorte der Zugriffe, Gerätedaten, Zugriffsdauer und Zeitpunkt, Navigationsverhalten und Klickverhalten enthalten. Mehr Details dazu finden Sie weiter unten in dieser Datenschutzerklärung.<br />\n' +
		'&#x1f4c5; Speicherdauer: individuell einstellbar, standardmäßig speichert Google Analytics 4 Daten für 14 Monate<br />\n' +
		'&#x2696;&#xfe0f; Rechtsgrundlagen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Was ist Google Analytics?</h3>\n' +
		'<p>Wir verwenden auf unserer Website das Analyse-Tracking Tool Google Analytics in der Version Google Analytics 4 (GA4) des amerikanischen Unternehmens Google Inc. Für den europäischen Raum ist das Unternehmen Google Ireland Limited (Gordon House, Barrow Street Dublin 4, Irland) für alle Google-Dienste verantwortlich. Google Analytics sammelt Daten über Ihre Handlungen auf unserer Website. Durch die Kombination aus verschiedenen Technologien wie Cookies, Geräte-IDs und Anmeldeinformationen, können Sie als User aber über verschiedene Geräte hinweg identifiziert werden. Dadurch können Ihre Handlungen auch plattformübergreifend analysiert werden.</p>\n' +
		'<p>Wenn Sie beispielsweise einen Link anklicken, wird dieses Ereignis in einem Cookie gespeichert und an Google Analytics versandt. Mithilfe der Berichte, die wir von Google Analytics erhalten, können wir unsere Website und unseren Service besser an Ihre Wünsche anpassen. Im Folgenden gehen wir näher auf das Tracking-Tool ein und informieren Sie vor allem darüber, welche Daten verarbeitet werden und wie Sie das verhindern können.</p>\n' +
		'<p>Google Analytics ist ein Trackingtool, das der Datenverkehrsanalyse unserer Website dient. Basis dieser Messungen und Analysen ist eine pseudonyme Nutzeridentifikationsnummer. Diese Nummer beinhaltet keine personenbezogenen Daten wie Name oder Adresse, sondern dient dazu, Ereignisse einem Endgerät zuzuordnen. GA4 nutzt ein ereignisbasiertes Modell, das detaillierte Informationen zu Userinteraktionen wie etwa Seitenaufrufe, Klicks, Scrollen, Conversion-Ereignisse erfasst. Zudem wurden in GA4 auch verschiedene maschinelle Lernfunktionen eingebaut, um das Nutzerverhalten und gewissen Trends besser zu verstehen. GA4 setzt mit Hilfe maschineller Lernfunktionen auf Modellierungen. Das heißt auf Grundlage der erhobenen Daten können auch fehlende Daten hochgerechnet werden, um damit die Analyse zu optimieren und auch um Prognosen geben zu können.</p>\n' +
		'<p>Damit Google Analytics grundsätzlich funktioniert, wird ein Tracking-Code in den Code unserer Website eingebaut. Wenn Sie unsere Website besuchen, zeichnet dieser Code verschiedene Ereignisse auf, die Sie auf unserer Website ausführen. Mit dem ereignisbasierten Datenmodell von GA4 können wir als Websitebetreiber spezifische Ereignisse definieren und verfolgen, um Analysen von Userinteraktionen zu erhalten. Somit können neben allgemeinen Informationen wie Klicks oder Seitenaufrufe auch spezielle Ereignisse, die für unser Geschäft wichtig sind, verfolgt werden. Solche speziellen Ereignisse können zum Beispiel das Absenden eines Kontaktformulars oder der Kauf eines Produkts sein.</p>\n' +
		'<p>Sobald Sie unsere Website verlassen, werden diese Daten an die Google-Analytics-Server gesendet und dort gespeichert.</p>\n' +
		'<p>Google verarbeitet die Daten und wir bekommen Berichte über Ihr Userverhalten. Dabei kann es sich unter anderem um folgende Berichte handeln:</p>\n' +
		'<ul>\n' +
		'<li>Zielgruppenberichte: Über Zielgruppenberichte lernen wir unsere User besser kennen und wissen genauer, wer sich für unser Service interessiert.</li>\n' +
		'<li>Anzeigeberichte: Durch Anzeigeberichte können wir unsere Onlinewerbung leichter analysieren und verbessern.</li>\n' +
		'<li>Akquisitionsberichte: Akquisitionsberichte geben uns hilfreiche Informationen darüber, wie wir mehr Menschen für unseren Service begeistern können.</li>\n' +
		'<li>Verhaltensberichte: Hier erfahren wir, wie Sie mit unserer Website interagieren. Wir können nachvollziehen welchen Weg Sie auf unserer Seite zurücklegen und welche Links Sie anklicken.</li>\n' +
		'<li>Conversionsberichte: Conversion nennt man einen Vorgang, bei dem Sie aufgrund einer Marketing-Botschaft eine gewünschte Handlung ausführen. Zum Beispiel, wenn Sie von einem reinen Websitebesucher zu einem Käufer oder Newsletter-Abonnent werden. Mithilfe dieser Berichte erfahren wir mehr darüber, wie unsere Marketing-Maßnahmen bei Ihnen ankommen. So wollen wir unsere Conversionrate steigern.</li>\n' +
		'<li>Echtzeitberichte: Hier erfahren wir immer sofort, was gerade auf unserer Website passiert. Zum Beispiel sehen wir wie viele User gerade diesen Text lesen.</li>\n' +
		'</ul>\n' +
		'<p>Neben den oben genannten Analyseberichten bietet Google Analytics 4 unter anderem auch folgende Funktionen an:</p>\n' +
		'<ul>\n' +
		'<li>Ereignisbasiertes Datenmodell: Dieses Modell erfasst ganz spezifische Ereignisse, die auf unserer Website stattfinden können. Zum Beispiel das Abspielen eines Videos, der Kauf eines Produkts oder das Anmelden zu unserem Newsletter.</li>\n' +
		'<li>Erweiterte Analysefunktionen: Mit diesen Funktionen können wir Ihr Verhalten auf unserer Website oder gewisse allgemeine Trends noch besser verstehen. So können wir etwa Usergruppen segmentieren, Vergleichsanalysen von Zielgruppen machen oder Ihren Weg bzw. Pfad auf unserer Website nachvollziehen.</li>\n' +
		'<li>Vorhersagemodellierung: Auf Grundlage erhobener Daten können durch maschinelles Lernen fehlende Daten hochgerechnet werden, die zukünftige Ereignisse und Trends vorhersagen. Das kann uns helfen, bessere Marketingstrategien zu entwickeln.</li>\n' +
		'<li>Cross-Plattform-Analyse: Die Erfassung und Analyse von Daten sind sowohl von Websites als auch von Apps möglich. Das bietet uns die Möglichkeit, das Userverhalten plattformübergreifend zu analysieren, sofern Sie natürlich der Datenverarbeitung eingewilligt haben.</li>\n' +
		'</ul>\n' +
		'<h3>Warum verwenden wir Google Analytics auf unserer Website?</h3>\n' +
		'<p>Unser Ziel mit dieser Website ist klar: Wir wollen Ihnen den bestmöglichen Service bieten. Die Statistiken und Daten von Google Analytics helfen uns dieses Ziel zu erreichen.</p>\n' +
		'<p>Die statistisch ausgewerteten Daten zeigen uns ein klares Bild von den Stärken und Schwächen unserer Website. Einerseits können wir unsere Seite so optimieren, dass sie von interessierten Menschen auf Google leichter gefunden wird. Andererseits helfen uns die Daten, Sie als Besucher besser zu verstehen. Wir wissen somit sehr genau, was wir an unserer Website verbessern müssen, um Ihnen das bestmögliche Service zu bieten. Die Daten dienen uns auch, unsere Werbe- und Marketing-Maßnahmen individueller und kostengünstiger durchzuführen. Schließlich macht es nur Sinn, unsere Produkte und Dienstleistungen Menschen zu zeigen, die sich dafür interessieren.</p>\n' +
		'<h3>Welche Daten werden von Google Analytics gespeichert?</h3>\n' +
		'<p>Google Analytics erstellt mithilfe eines Tracking-Codes eine zufällige, eindeutige ID, die mit Ihrem Browser-Cookie verbunden ist. So erkennt Sie Google Analytics als neuen User und Ihnen wird eine User-ID zugeordnet. Wenn Sie das nächste Mal unsere Seite besuchen, werden Sie als „wiederkehrender“ User erkannt. Alle gesammelten Daten werden gemeinsam mit dieser User-ID gespeichert. So ist es erst möglich pseudonyme Userprofile auszuwerten.</p>\n' +
		'<p>Um mit Google Analytics unsere Website analysieren zu können, muss eine Property-ID in den Tracking-Code eingefügt werden. Die Daten werden dann in der entsprechenden Property gespeichert. Für jede neu angelegte Property ist die Google Analytics 4-Property standardmäßig. Je nach verwendeter Property werden Daten unterschiedlich lange gespeichert.</p>\n' +
		'<p>Durch Kennzeichnungen wie Cookies, App-Instanz-IDs, User-IDs oder etwa benutzerdefinierte Ereignisparameter werden Ihre Interaktionen, sofern Sie eingewilligt haben, plattformübergreifend gemessen. Interaktionen sind alle Arten von Handlungen, die Sie auf unserer Website ausführen. Wenn Sie auch andere Google-Systeme (wie z.B. ein Google-Konto) nützen, können über Google Analytics generierte Daten mit Drittanbieter-Cookies verknüpft werden. Google gibt keine Google Analytics-Daten weiter, außer wir als Websitebetreiber genehmigen das. Zu Ausnahmen kann es kommen, wenn es gesetzlich erforderlich ist.</p>\n' +
		'<p>Laut Google werden in Google Analytics 4 keine IP-Adressen protokolliert oder gespeichert. Google nutzt die IP-Adressdaten allerdings für die Ableitung von Standortdaten und löscht sie unmittelbar danach. Alle IP-Adressen, die von Usern in der EU erhoben werden, werden also gelöscht, bevor die Daten in einem Rechenzentrum oder auf einem Server gespeichert werden.</p>\n' +
		'<p>Da bei Google Analytics 4 der Fokus auf ereignisbasierten Daten liegt, verwendet das Tool im Vergleich zu früheren Versionen (wie Google Universal Analytics) deutlich weniger Cookies. Dennoch gibt es einige spezifische Cookies, die von GA4 verwendet werden. Dazu zählen zum Beispiel:</p>\n' +
		'<p>\n' +
		'<strong>Name:</strong> _ga<br />\n' +
		'<strong>Wert: </strong>2.1326744211.152112741413-5<br />\n' +
		'<strong>Verwendungszweck:</strong> Standardmäßig verwendet analytics.js das Cookie _ga, um die User-ID zu speichern. Grundsätzlich dient es zur Unterscheidung der Webseitenbesucher.<br />\n' +
		'<strong>Ablaufdatum:</strong> nach 2 Jahren</p>\n' +
		'<p>\n' +
		'<strong>Name:</strong> _gid<br />\n' +
		'<strong>Wert: </strong>2.1687193234.152112741413-1<br />\n' +
		'<strong>Verwendungszweck:</strong> Das Cookie dient auch zur Unterscheidung der Webseitenbesucher<br />\n' +
		'<strong>Ablaufdatum:</strong> nach 24 Stunden</p>\n' +
		'<p>\n' +
		'<strong>Name:</strong> _gat_gtag_UA_&lt;property-id&gt;<br />\n' +
		'<strong>Wert:</strong> 1<br />\n' +
		'<strong>Verwendungszweck:</strong> Wird zum Senken der Anforderungsrate verwendet. Wenn Google Analytics über den Google Tag Manager bereitgestellt wird, erhält dieser Cookie den Namen _dc_gtm_ &lt;property-id&gt;.<br />\n' +
		'<strong>Ablaufdatum: </strong>nach 1 Minute</p>\n' +
		'<p>\n' +
		'<strong>Anmerkung:</strong> Diese Aufzählung kann keinen Anspruch auf Vollständigkeit erheben, da Google die Wahl ihrer Cookies immer wieder auch verändert. Ziel von GA4 ist es auch, den Datenschutz zu verbessern. Daher bietet das Tool einige Möglichkeiten zur Kontrolle der Datenerfassung. So können wir beispielsweise die Speicherdauer selbst festlegen und auch die Datenerfassung steuern.</p>\n' +
		'<p>Hier zeigen wir Ihnen einen Überblick über die wichtigsten Arten von Daten, die mit Google Analytics erhoben werden:</p>\n' +
		'<p>\n' +
		'<strong>Heatmaps:</strong> Google legt sogenannte Heatmaps an. Über Heatmaps sieht man genau jene Bereiche, die Sie anklicken. So bekommen wir Informationen, wo Sie auf unserer Seite „unterwegs“ sind.</p>\n' +
		'<p>\n' +
		'<strong>Sitzungsdauer:</strong> Als Sitzungsdauer bezeichnet Google die Zeit, die Sie auf unserer Seite verbringen, ohne die Seite zu verlassen. Wenn Sie 20 Minuten inaktiv waren, endet die Sitzung automatisch.</p>\n' +
		'<p>\n' +
		'<strong>Absprungrate</strong> (engl. Bouncerate): Von einem Absprung ist die Rede, wenn Sie auf unserer Website nur eine Seite ansehen und dann unsere Website wieder verlassen.</p>\n' +
		'<p>\n' +
		'<strong>Kontoerstellung:</strong> Wenn Sie auf unserer Website ein Konto erstellen bzw. eine Bestellung machen, erhebt Google Analytics diese Daten.</p>\n' +
		'<p>\n' +
		'<strong>Standort:</strong> IP-Adressen werden in Google Analytics nicht protokolliert oder gespeichert. Allerdings werden kurz vor der Löschung der IP-Adresse Ableitungen für Standortdaten genutzt.</p>\n' +
		'<p>\n' +
		'<strong>Technische Informationen:</strong> Zu den technischen Informationen zählen unter anderem Ihr Browsertyp, Ihr Internetanbieter oder Ihre Bildschirmauflösung.</p>\n' +
		'<p>\n' +
		'<strong>Herkunftsquelle:</strong> Google Analytics beziehungsweise uns interessiert natürlich auch über welche Website oder welche Werbung Sie auf unsere Seite gekommen sind.</p>\n' +
		'<p>Weitere Daten sind Kontaktdaten, etwaige Bewertungen, das Abspielen von Medien (z. B., wenn Sie ein Video über unsere Seite abspielen), das Teilen von Inhalten über Social Media oder das Hinzufügen zu Ihren Favoriten. Die Aufzählung hat keinen Vollständigkeitsanspruch und dient nur zu einer allgemeinen Orientierung der Datenspeicherung durch Google Analytics.</p>\n' +
		'<h3>Wie lange und wo werden die Daten gespeichert?</h3>\n' +
		'<p>Google hat ihre Server auf der ganzen Welt verteilt. Hier können Sie genau nachlesen, wo sich die Google-Rechenzentren befinden: <a href="https://www.google.com/about/datacenters/locations/?hl=de">https://www.google.com/about/datacenters/locations/?hl=de</a>\n' +
		'</p>\n' +
		'<p>Ihre Daten werden auf verschiedenen physischen Datenträgern verteilt. Das hat den Vorteil, dass die Daten schneller abrufbar sind und vor Manipulation besser geschützt sind. In jedem Google-Rechenzentrum gibt es entsprechende Notfallprogramme für Ihre Daten. Wenn beispielsweise die Hardware bei Google ausfällt oder Naturkatastrophen Server lahmlegen, bleibt das Risiko einer Dienstunterbrechung bei Google dennoch gering.</p>\n' +
		'<p>Die Aufbewahrungsdauer der Daten hängt von den verwendeten Properties ab. Die Speicherdauer wird stets für jede einzelne Property eigens festgelegt. Google Analytics bietet uns zur Kontrolle der Speicherdauer vier Optionen an:</p>\n' +
		'<ul>\n' +
		'<li>2 Monate: das ist die kürzeste Speicherdauer.</li>\n' +
		'<li>14 Monate: standardmäßig bleiben die Daten bei GA4 für 14 Monate gespeichert.</li>\n' +
		'<li>26 Monate: man kann die Daten auch 26 Monate lang speichern.</li>\n' +
		'<li>Daten werden erst gelöscht, wenn wir sie manuell löschen</li>\n' +
		'</ul>\n' +
		'<p>Zusätzlich gibt es auch die Option, dass Daten erst dann gelöscht werden, wenn Sie innerhalb des von uns gewählten Zeitraums nicht mehr unsere Website besuchen. In diesem Fall wird die Aufbewahrungsdauer jedes Mal zurückgesetzt, wenn Sie unsere Website innerhalb des festgelegten Zeitraums wieder besuchen.</p>\n' +
		'<p>Wenn der festgelegte Zeitraum abgelaufen ist, werden einmal im Monat die Daten gelöscht. Diese Aufbewahrungsdauer gilt für Ihre Daten, die mit Cookies, Usererkennung und Werbe-IDs (z.B. Cookies der DoubleClick-Domain) verknüpft sind. Berichtergebnisse basieren auf aggregierten Daten und werden unabhängig von Nutzerdaten gespeichert. Aggregierte Daten sind eine Zusammenschmelzung von Einzeldaten zu einer größeren Einheit.</p>\n' +
		'<h3>Wie kann ich meine Daten löschen bzw. die Datenspeicherung verhindern?</h3>\n' +
		'<p>Nach dem Datenschutzrecht der Europäischen Union haben Sie das Recht, Auskunft über Ihre Daten zu erhalten, sie zu aktualisieren, zu löschen oder einzuschränken. Mithilfe des Browser-Add-ons zur Deaktivierung von Google Analytics-JavaScript (analytics.js, gtag.js) verhindern Sie, dass Google Analytics 4 Ihre Daten verwendet. Das Browser-Add-on können Sie unter <a href="https://tools.google.com/dlpage/gaoptout?hl=de">https://tools.google.com/dlpage/gaoptout?hl=de</a> runterladen und installieren. Beachten Sie bitte, dass durch dieses Add-on nur die Datenerhebung durch Google Analytics deaktiviert wird.</p>\n' +
		'<p>Falls Sie grundsätzlich Cookies deaktivieren, löschen oder verwalten wollen, finden Sie unter dem Abschnitt „Cookies“ die entsprechenden Links zu den jeweiligen Anleitungen der bekanntesten Browser.</p>\n' +
		'<h3>Rechtsgrundlage</h3>\n' +
		'<p>Der Einsatz von Google Analytics setzt Ihre Einwilligung voraus, welche wir mit unserem Cookie Popup eingeholt haben. Diese Einwilligung stellt laut<strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</strong> die Rechtsgrundlage für die Verarbeitung personenbezogener Daten, wie sie bei der Erfassung durch Web-Analytics Tools vorkommen kann, dar.</p>\n' +
		'<p>Zusätzlich zur Einwilligung besteht von unserer Seite ein berechtigtes Interesse daran, das Verhalten der Websitebesucher zu analysieren und so unser Angebot technisch und wirtschaftlich zu verbessern. Mit Hilfe von Google Analytics erkennen wir Fehler der Website, können Attacken identifizieren und die Wirtschaftlichkeit verbessern. Die Rechtsgrundlage dafür ist <strong>Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</strong>. Wir setzen Google Analytics gleichwohl nur ein, soweit Sie eine Einwilligung erteilt haben.</p>\n' +
		'<p>Google verarbeitet Daten von Ihnen u.a. auch in den USA. Google ist aktiver Teilnehmer des EU-US Data Privacy Frameworks, wodurch der korrekte und sichere Datentransfer personenbezogener Daten von EU-Bürgern in die USA geregelt wird. Mehr Informationen dazu finden Sie auf <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener"> https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a>.</p>\n' +
		'<p>Zudem verwendet Google sogenannte Standardvertragsklauseln (= Art. 46. Abs. 2 und 3 DSGVO). Standardvertragsklauseln (Standard Contractual Clauses – SCC) sind von der EU-Kommission bereitgestellte Mustervorlagen und sollen sicherstellen, dass Ihre Daten auch dann den europäischen Datenschutzstandards entsprechen, wenn diese in Drittländer (wie beispielsweise in die USA) überliefert und dort gespeichert werden. Durch das EU-US Data Privacy Framework und durch die Standardvertragsklauseln verpflichtet sich Google, bei der Verarbeitung Ihrer relevanten Daten, das europäische Datenschutzniveau einzuhalten, selbst wenn die Daten in den USA gespeichert, verarbeitet und verwaltet werden. Diese Klauseln basieren auf einem Durchführungsbeschluss der EU-Kommission. Sie finden den Beschluss und die entsprechenden Standardvertragsklauseln u.a. hier: <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a>\n' +
		'</p>\n' +
		'<p>Die Google Ads Datenverarbeitungsbedingungen (Google Ads Data Processing Terms), welche auf die Standardvertragsklauseln verweisen, finden Sie unter <a href="https://business.safety.google/intl/de/adsprocessorterms/" target="_blank" rel="follow noopener">https://business.safety.google/intl/de/adsprocessorterms/</a>.</p>\n' +
		'<p>Wir hoffen, wir konnten Ihnen die wichtigsten Informationen rund um die Datenverarbeitung von Google Analytics näherbringen. Wenn Sie mehr über den Tracking-Dienst erfahren wollen, empfehlen wir diese beiden Links: <a href="https://marketingplatform.google.com/about/analytics/terms/de/" target="_blank" rel="follow noopener">https://marketingplatform.google.com/about/analytics/terms/de/</a> und <a href="https://support.google.com/analytics/answer/6004245?hl=de" target="_blank" rel="follow noopener">https://support.google.com/analytics/answer/6004245?hl=de</a>.</p>\n' +
		'<p>Wenn Sie mehr über die Datenverarbeitung erfahren wollen, nutzen Sie die Google-Datenschutzerklärung auf <a href="https://policies.google.com/privacy?hl=de&amp;tid=112741413" target="_blank" rel="follow noopener">https://policies.google.com/privacy?hl=de</a>.</p>\n' +
		'<h2 id="google-analytics-berichte-zu-demografischen-merkmalen-und-interessen">Google Analytics Berichte zu demografischen Merkmalen und Interessen</h2>\n' +
		'<p>Wir haben in Google Analytics die Funktionen für Werbeberichte eingeschaltet. Die Berichte zu demografischen Merkmalen und Interessen enthalten Angaben zu Alter, Geschlecht und Interessen. Damit können wir uns &#8211; ohne diese Daten einzelnen Personen zuordnen zu können &#8211; ein besseres Bild von unseren Nutzern machen. Mehr über die Werbefunktionen erfahren Sie auf <a href="https://support.google.com/analytics/answer/3450482?hl=de_AT&amp;utm_id=ad">https://support.google.com/analytics/answer/3450482?hl=de_AT&amp;utm_id=ad</a>.</p>\n' +
		'<p>Sie können die Nutzung der Aktivitäten und Informationen Ihres Google Kontos unter “Einstellungen für Werbung” auf <a href="https://adssettings.google.com/authenticated">https://adssettings.google.com/authenticated</a> per Checkbox beenden.</p>\n' +
		'<h2 id="google-analytics-im-einwilligungsmodus">Google Analytics im Einwilligungsmodus</h2>\n' +
		'<p>Abhängig von Ihrer Einwilligung werden im sogenannten Einwilligungsmodus (bzw. „Consent Mode“) personenbezogene Daten von Ihnen durch Google Analytics verarbeitet. Sie können wählen, ob Sie Google-Analytics-Cookies zustimmen oder nicht. Damit wählen Sie auch, welche Daten Google Analytics von Ihnen verarbeitet darf. Diese erhobenen Daten werden hauptsächlich dafür verwendet, Messungen über das Userverhalten auf der Website durchzuführen, zielgerichtete Werbung auszuspielen und uns Web-Analyseberichte zu liefern. In der Regel willigen Sie der Datenverarbeitung durch Google über ein Cookie-Consent-Tool ein. Wenn Sie der Datenverarbeitung nicht einwilligen, werden nur aggregierte Daten erfasst und verarbeitet. Das bedeutet, Daten können einzelnen Usern nicht zugeordnet werden und es entsteht somit kein Userprofil von Ihnen. Sie können auch nur der statistischen Messung zustimmen. Dabei werden keine personenbezogenen Daten verarbeitet und folglich nicht für Werbungen oder Werbemesserfolge verwendet.</p>\n' +
		'<h2 id="content-delivery-networks-einleitung">Content Delivery Networks Einleitung</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Content Delivery Networks Datenschutzerklärung Zusammenfassung</strong>\n' +
		'<br />\n' +
		'&#x1f465; Betroffene: Besucher der Website<br />\n' +
		'&#x1f91d; Zweck: Optimierung unserer Serviceleistung (um die Website schneller laden zu können)<br />\n' +
		'&#x1f4d3; Verarbeitete Daten: Daten wie etwa Ihre IP-Adresse<br />\n' +
		'Mehr Details dazu finden Sie weiter unten und den einzelnen Datenschutztexten.<br />\n' +
		'&#x1f4c5; Speicherdauer: meisten werden die Daten solange gespeichert, bis sie zur Erfüllung der Dienstleistung nicht mehr benötigt werden<br />\n' +
		'&#x2696;&#xfe0f; Rechtsgrundlagen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Was ist ein Content Delivery Network?</h3>\n' +
		'<p>Wir nutzen auf unserer Website ein sogenanntes Content Delivery Network. Meistens wird ein solchen Netzwerk nur CDN genannt. Ein CDN hilft uns, unsere Website, unabhängig von Ihrem Standort, schnell und problemlos zu laden. Dabei werden auch personenbezogene Daten von Ihnen auf den Servern des eingesetzten CDN-Anbieters gespeichert, verwaltet und verarbeitet. Nachfolgend gehen wir allgemein näher auf den Dienst und dessen Datenverarbeitung ein. Genaue Informationen über den Umgang mit Ihren Daten finden Sie in der jeweiligen Datenschutzerklärung des Anbieters.</p>\n' +
		'<p>Jedes Content Delivery Network (CDN) ist ein Netzwerk regional verteilter Server, die alle über das Internet miteinander verbunden sind. Über dieses Netzwerk können Inhalte von Websites (speziell auch sehr große Dateien) auch bei großen Lastspitzen schnell und reibungslos ausgeliefert werden. Das CDN legt dafür eine Kopie unserer Website auf Ihren Servern an. Da diese Server weltweit verteilt sind, kann die Website schnell ausgeliefert werden. Die Datenübertragung zu Ihrem Browser wird folglich durch das CDN deutlich verkürzt.</p>\n' +
		'<h3>Warum verwenden wir ein Content Delivery Network für unsere Website?</h3>\n' +
		'<p>Eine schnell ladende Website ist Teil unserer Dienstleistung. Wir wissen natürlich, wie nervig es ist, wenn eine Website im Schneckentempo lädt. Meist verliert man sogar die Geduld und sucht das Weite, bevor die Website vollständig geladen ist. Das wollen wir natürlich vermeiden. Daher gehört eine schnell ladende Website ganz selbstverständlich zu unserem Websiteangebot. Mit einem Content Delivery Network wird in Ihrem Browser unsere Website deutlich schneller geladen. Besonders hilfreich ist der Einsatz des CDNs wenn Sie im Ausland sind, weil die Website von einem Server in Ihrer Nähe ausgeliefert wird.</p>\n' +
		'<h3>Welche Daten werden verarbeitet?</h3>\n' +
		'<p>Wenn Sie eine Website bzw. die Inhalte einer Website anfordern und diese in einem CDN zwischengespeichert sind, leitet das CDN die Anforderung an den von Ihnen am nächsten gelegenen Server und dieser liefert die Inhalte aus. Content Delivery Networks sind so aufgebaut, dass JavaScript-Bibliotheken heruntergeladen werden können und auf npm- und Github-Servern gehostet werden. Alternativ können bei den meisten CDNs auch WordPress-Plugins geladen werden, wenn diese auf <a href="https://wordpress.org/" target="_blank" rel="noopener">WordPress.org</a> gehostet werden. Ihr Browser kann personenbezogene Daten an das von uns eingesetzte Content Delivery Network senden. Dabei handelt es sich etwa um Daten wie IP-Adresse, Browsertyp, Browserversion, welche Webseite geladen wird oder Uhrzeit und Datum des Seitenbesuchs. Diese Daten werden vom CDN gesammelt und auch gespeichert. Ob zur Datenspeicherung Cookies verwendet werden, hängt von dem eingesetzten Network ab. Bitte lesen Sie sich dafür die Datenschutztexte des jeweiligen Dienstes durch.</p>\n' +
		'<h3>Widerspruchsrecht</h3>\n' +
		'<p>Falls Sie diese Datenübertragung vollkommen unterbinden wollen, können Sie einen JavaScript-Blocker (siehe beispielsweise <a href="https://noscript.net/" target="_blank" rel="noopener">https://noscript.net/</a>) auf Ihrem PC installieren. Natürlich kann dann unsere Website nicht mehr das gewohnte Service (wie beispielsweise eine schnelle Ladegeschwindigkeit) bieten.</p>\n' +
		'<h3>Rechtsgrundlage</h3>\n' +
		'<p>Wenn Sie eingewilligt haben, dass ein Content Delivery Network eingesetzt werden darf, ist die Rechtsgrundlage der entsprechenden Datenverarbeitung diese Einwilligung. Diese Einwilligung stellt laut <strong>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</strong> die Rechtsgrundlage für die Verarbeitung personenbezogener Daten, wie sie bei der Erfassung durch ein Content Delivery Network vorkommen kann, dar.</p>\n' +
		'<p>Von unserer Seite besteht zudem ein berechtigtes Interesse, ein Content Delivery Network zu verwenden, um unser Online-Service zu optimieren und sicherer zu machen. Die dafür entsprechende Rechtsgrundlage ist <strong>Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</strong>. Wir setzen das Tool gleichwohl nur ein, soweit Sie eine Einwilligung erteilt haben.</p>\n' +
		'<p>Informationen zu speziellen Content Delivery Network erhalten Sie &#8211; sofern vorhanden &#8211; in den folgenden Abschnitten.</p>\n' +
		'<h2 id="cloudflare-datenschutzerklaerung">Cloudflare Datenschutzerklärung</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Cloudflare Datenschutzerklärung Zusammenfassung</strong>\n' +
		'<br />\n' +
		'&#x1f465; Betroffene: Besucher der Website<br />\n' +
		'&#x1f91d; Zweck: Optimierung unserer Serviceleistung (um die Website schneller laden zu können)<br />\n' +
		'&#x1f4d3; Verarbeitete Daten: Daten wie etwa IP-Adresse, Kontakt- und Protokollinfos, Sicherheitsfingerabdrücke und Leistungsdaten für Websites<br />\n' +
		'Mehr Details dazu finden Sie weiter unten in dieser Datenschutzerklärung.<br />\n' +
		'&#x1f4c5; Speicherdauer: meisten werden die Daten für weniger als 24 Stunden gespeichert<br />\n' +
		'&#x2696;&#xfe0f; Rechtsgrundlagen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Was ist Cloudflare?</h3>\n' +
		'<p>Wir verwenden auf dieser Website Cloudflare der Firma Cloudflare, Inc. (101 Townsend St., San Francisco, CA 94107, USA), um unsere Webseite schneller und sicherer zu machen. Dabei verwendet Cloudflare Cookies und verarbeitet User-Daten. Cloudflare, Inc. ist eine amerikanische Firma, die ein Content Delivery Network und diverse Sicherheitsdienste anbietet. Diese Dienste befinden sich zwischen dem User und unserem Hosting-Anbieter. Was das alles genau bedeutet, versuchen wir im Folgenden genauer zu erläutern.</p>\n' +
		'<p>Ein Content Delivery Network (CDN), wie es die Firma Cloudflare bereitstellt, ist nichts anderes als ein Netzwerk aus verbundenen Servern. Cloudflare hat auf der ganzen Welt solche Server verteilt, um Webseiten schneller auf Ihren Bildschirm zu bringen. Ganz einfach gesagt, legt Cloudflare Kopien unserer Webseite an und platziert sie auf ihren eigenen Servern. Wenn Sie jetzt unsere Webseite besuchen, stellt ein System der Lastenverteilung sicher, dass die größten Teile unserer Webseite von jenem Server ausgeliefert werden, der Ihnen unsere Webseite am schnellsten anzeigen kann. Die Strecke der Datenübertragung zu Ihrem Browser wird durch ein CDN deutlich verkürzt. Somit wird Ihnen der Content unserer Webseite durch Cloudflare nicht nur von unserem Hosting-Server geliefert, sondern von Servern aus der ganzen Welt. Besonders hilfreich wird der Einsatz von Cloudflare für User aus dem Ausland, da hier die Seite von einem Server in der Nähe ausgeliefert werden kann. Neben dem schnellen Ausliefern von Webseiten bietet Cloudflare auch diverse Sicherheitsdienste, wie den DDoS-Schutz oder die Web Application Firewall an.</p>\n' +
		'<h3>Warum verwenden wir Cloudflare auf unserer Website?</h3>\n' +
		'<p>Natürlich wollen wir Ihnen mit unserer Webseite das bestmögliche Service bieten. Cloudflare hilft uns dabei, unsere Webseite schneller und sicherer zu machen. Cloudflare bietet uns sowohl Web-Optimierungen als auch Sicherheitsdienste, wie DDoS-Schutz und Web-Firewall, an. Dazu gehören auch ein <a href="https://de.wikipedia.org/wiki/Reverse_Proxy" target="_blank" rel="noopener noreferrer">Reverse-Proxy</a> und das Content-Verteilungsnetzwerk (CDN). Cloudflare blockiert Bedrohungen und begrenzt missbräuchliche Bots und Crawler, die unsere Bandbreite und Serverressourcen verschwenden. Durch das Speichern unserer Webseite auf lokalen Datenzentren und das Blockieren von Spam-Software ermöglicht Cloudflare, unsere Bandbreitnutzung etwa um 60% zu reduzieren. Das Bereitstellen von Inhalten über ein Datenzentrum in Ihrer Nähe und einiger dort durchgeführten Web-Optimierungen reduziert die durchschnittliche Ladezeit einer Webseite etwa um die Hälfte. Durch die Einstellung „I´m Under Attack Mode“ („Ich werde angegriffen“-Modus) können laut Cloudflare weitere Angriffe abgeschwächt werden, indem eine JavaScript-Rechenaufgabe angezeigt wird, die man lösen muss, bevor ein User auf eine Webseite zugreifen kann. Insgesamt wird dadurch unsere Webseite deutlich leistungsstärker und weniger anfällig auf Spam oder andere Angriffe.</p>\n' +
		'<h3>Welche Daten werden von Cloudflare verarbeitet?</h3>\n' +
		'<p>Cloudflare leitet im Allgemeinen nur jene Daten weiter, die von Webseitenbetreibern gesteuert werden. Die Inhalte werden also nicht von Cloudflare bestimmt, sondern immer vom Websitebetreiber selbst. Zudem erfasst Cloudflare unter Umständen bestimmte Informationen zur Nutzung unserer Website und verarbeitet Daten, die von uns versendet werden oder für die Cloudflare entsprechende Anweisungen erhalten hat. In den meisten Fällen erhält Cloudflare Daten wie IP-Adresse, Kontakt- und Protokollinfos, Sicherheitsfingerabdrücke und Leistungsdaten für Websites. Protokolldaten helfen Cloudflare beispielsweise dabei, neue Bedrohungen zu erkennen. So kann Cloudflare einen hohen Sicherheitsschutz für unsere Webseite gewährleisten. Cloudflare verarbeitet diese Daten im Rahmen der Services unter Einhaltung der geltenden Gesetze. Dazu zählt natürlich auch die Datenschutzgrundverordnung (DSGVO). Cloudflare arbeitet auch mit Drittanbietern zusammen. Diese dürfen personenbezogene Daten nur unter Anweisung der Firma Cloudflare und in Übereinstimmung mit den Datenschutzrichtlinien und anderer Vertraulichkeits- und Sicherheitsmaßnahmen verarbeiten. Ohne explizite Einwilligung von uns gibt Cloudflare keine personenbezogenen Daten weiter.</p>\n' +
		'<h3>Wie lange und wo werden die Daten gespeichert?</h3>\n' +
		'<p>Cloudflare speichert Ihre Informationen hauptsächlich in den USA und im Europäischen Wirtschaftsraum. Cloudflare kann die oben beschriebenen Informationen aus der ganzen Welt übertragen und darauf zugreifen. Im Allgemeinen speichert Cloudflare Daten auf User-Ebene für Domains in den Versionen Free, Pro und Business für weniger als 24 Stunden. Für Enterprise Domains, die Cloudflare Logs (früher Enterprise LogShare oder ELS) aktiviert haben, können die Daten bis zu 7 Tage gespeichert werden. Wenn allerdings IP-Adressen bei Cloudflare Sicherheitswarnungen auslösen, kann es zu Ausnahmen der oben angeführten Speicherungsdauer kommen.</p>\n' +
		'<h3>Wie kann ich meine Daten löschen bzw. die Datenspeicherung verhindern?</h3>\n' +
		'<p>Cloudflare bewahrt Daten-Protokolle nur solange wie nötig auf und diese Daten werden auch in den meisten Fällen innerhalb von 24 Stunden wieder gelöscht. Cloudflare speichert auch keine personenbezogenen Daten, wie beispielsweise Ihre IP-Adresse. Es gibt allerdings Informationen, die Cloudflare als Teil seiner permanenten Protokolle auf unbestimmte Zeit speichert, um so die Gesamtleistung von Cloudflare Resolver zu verbessern und etwaige Sicherheitsrisiken zu erkennen. Welche permanenten Protokolle genau gespeichert werden, können Sie auf <a href="https://www.cloudflare.com/application/privacypolicy/">https://www.cloudflare.com/application/privacypolicy/</a> nachlesen. Alle Daten, die Cloudflare sammelt (temporär oder permanent), werden von allen personenbezogenen Daten bereinigt. Alle permanenten Protokolle werden zudem von Cloudflare anonymisiert.</p>\n' +
		'<p>Cloudflare geht in ihrer Datenschutzerklärung darauf ein, dass sie für die Inhalte, die sie erhalten nicht verantwortlich sind. Wenn Sie beispielsweise bei Cloudflare anfragen, ob sie Ihre Inhalte aktualisieren oder löschen können, verweist Cloudflare grundsätzlich auf uns als Webseitenbetreiber. Sie können auch die gesamte Erfassung und Verarbeitung Ihrer Daten durch Cloudflare komplett unterbinden, indem Sie die Ausführung von Script-Code in Ihrem Browser deaktivieren oder einen Script-Blocker in Ihren Browser einbinden.</p>\n' +
		'<h3>Rechtsgrundlage</h3>\n' +
		'<p>Wenn Sie eingewilligt haben, dass Cloudflare eingesetzt werden darf, ist die Rechtsgrundlage der entsprechenden Datenverarbeitung diese Einwilligung. Diese Einwilligung stellt laut<strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</strong> die Rechtsgrundlage für die Verarbeitung personenbezogener Daten, wie sie bei der Erfassung durch Cloudflare vorkommen kann, dar.</p>\n' +
		'<p>Von unserer Seite besteht zudem ein berechtigtes Interesse, Cloudflare zu verwenden, um unser Online-Service zu optimieren und sicherer zu machen. Die dafür entsprechende Rechtsgrundlage ist <strong>Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</strong>. Wir setzen Cloudflare gleichwohl nur ein, soweit Sie eine Einwilligung erteilt haben.</p>\n' +
		'<p>Cloudflare verarbeitet Daten von Ihnen u.a. auch in den USA. Cloudflare ist aktiver Teilnehmer des EU-US Data Privacy Frameworks, wodurch der korrekte und sichere Datentransfer personenbezogener Daten von EU-Bürgern in die USA geregelt wird. Mehr Informationen dazu finden Sie auf <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener">https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a>.</p>\n' +
		'<p>Zudem verwendet Cloudflare sogenannte Standardvertragsklauseln (= Art. 46. Abs. 2 und 3 DSGVO). Standardvertragsklauseln (Standard Contractual Clauses – SCC) sind von der EU-Kommission bereitgestellte Mustervorlagen und sollen sicherstellen, dass Ihre Daten auch dann den europäischen Datenschutzstandards entsprechen, wenn diese in Drittländer (wie beispielsweise in die USA) überliefert und dort gespeichert werden. Durch das EU-US Data Privacy Framework und durch die Standardvertragsklauseln verpflichtet sich Cloudflare, bei der Verarbeitung Ihrer relevanten Daten, das europäische Datenschutzniveau einzuhalten, selbst wenn die Daten in den USA gespeichert, verarbeitet und verwaltet werden. Diese Klauseln basieren auf einem Durchführungsbeschluss der EU-Kommission. Sie finden den Beschluss und die entsprechenden Standardvertragsklauseln u.a. hier: <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a>.</p>\n' +
		'<p>Mehr über die Standardvertragsklauseln und Daten, die durch die Verwendung von Cloudflare verarbeitet werden, erfahren Sie in der Datenschutzerklärung auf <a href="https://www.cloudflare.com/de-de/privacypolicy/?tid=112741413" target="_blank" rel="noopener noreferrer">https://www.cloudflare.com/de-de/privacypolicy/</a>.</p>\n' +
		'<h2 id="single-sign-on-anmeldungen-einleitung">Single-Sign-On-Anmeldungen Einleitung</h2>\n' +
		'<table border="1" cellpadding="15">\n' +
		'<tbody>\n' +
		'<tr>\n' +
		'<td>\n' +
		'<strong>Single-Sign-On-Anmeldungen Datenschutzerklärung Zusammenfassung</strong>\n' +
		'<br />\n' +
		'&#x1f465; Betroffene: Besucher der Website<br />\n' +
		'&#x1f91d; Zweck: Vereinfachung des Authentifizierungsprozesses<br />\n' +
		'&#x1f4d3; Verarbeitete Daten: Ist stark vom jeweiligen Anbieter abhängig, meist können E-Mail-Adresse und Benutzername gespeichert werden.<br />\n' +
		'Mehr Details dazu finden Sie beim jeweils eingesetzten Tool.<br />\n' +
		'&#x1f4c5; Speicherdauer: abhängig von den verwendeten Tools<br />\n' +
		'&#x2696;&#xfe0f; Rechtsgrundlagen: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Artikel 6 Absatz 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen)</td>\n' +
		'</tr>\n' +
		'</tbody>\n' +
		'</table>\n' +
		'<h3>Was sind Single-Sign-On-Anmeldungen?</h3>\n' +
		'<p>Auf unserer Website haben Sie die Möglichkeit sich über ein Userkonto eines anderen Anbieters (z.B. über Facebook) schnell und einfach für unser Onlineservice anzumelden. Dieses Authentifizierungs-Verfahren nennt man unter anderem „Single-Sign-On-Anmeldung“. Dieses Anmeldeverfahren funktioniert natürlich nur, wenn Sie bei dem anderen Anbieter registriert sind bzw. ein Nutzerkonto haben und die entsprechenden Zugangsdaten in das Onlineformular eingeben. In vielen Fällen sind Sie auch schon angemeldet, die Zugangsdaten werden automatisch ins Formular eingetragen und Sie müssen nur noch über einen Button die Single-Sign-On-Anmeldung bestätigen. Im Zuge dieser Anmeldung können auch personenbezogenen Daten von Ihnen verarbeitet und gespeichert werden. In diesem Datenschutztext gehen wir allgemein auf die Datenverarbeitung durch Single-Sign-On-Anmeldungen ein. Nähere Informationen finden Sie in den Datenschutzerklärungen der jeweiligen Anbieter.</p>\n' +
		'<h3>Warum verwenden wir Single-Sign-On-Anmeldungen?</h3>\n' +
		'<p>Wir wollen Ihnen das Leben auf unserer Website so einfach und angenehm wie möglich gestalten. Daher bieten wir auch Single-Sign-On-Anmeldungen an. So ersparen Sie sich wertvolle Zeit, weil Sie nur eine Authentifizierung benötigen. Da Sie sich nur ein Passwort merken müssen und es nur einmal übertragen wird, erhöht sich auch die Sicherheit. In vielen Fällen haben Sie Ihr Passwort mithilfe von Cookies auch schon automatisch gespeichert und der Anmeldeprozess auf unserer Website dauert daher nur ein paar Sekunden.</p>\n' +
		'<h3>Welche Daten werden durch Single-Sign-On-Anmeldungen gespeichert?</h3>\n' +
		'<p>Obwohl Sie sich über dieses spezielle Anmeldeverfahren auf unserer Website anmelden, erfolgt die eigentliche Authentifizierung beim entsprechenden Single-Sign-On-Anbieter. Wir als Websitebetreiber erhalten in Zuge der Authentifizierung eine Nutzer-ID. Darin wird festgehalten, dass Sie unter dieser ID beim entsprechenden Anbieter angemeldet sind. Diese ID kann für keine anderen Zwecke verwendet werden. Es können uns auch andere Daten übermittelt werden, das hängt aber von den verwendeten Single-Sign-On-Anbietern ab. Ebenso hängt es davon ab, welche Daten Sie während des Authentifizierungsprozesses freiwillig zur Verfügung stellen und welche Daten Sie grundsätzlich in Ihren Einstellungen bei dem Anbieter freigeben. Meistens handelt es sich um Daten wie Ihre E-Mail-Adresse und Ihrem Benutzernamen. Ihr Passwort, das für die Anmeldung nötig ist, kennen wir nicht und wird auch nicht bei uns gespeichert. Für Sie ist es noch wichtig zu wissen, dass bei uns gespeicherte Daten durch das Anmeldeverfahren automatisch mit den Daten des jeweiligen Nutzerkontos abgeglichen werden können.</p>\n' +
		'<h3>Dauer der Datenverarbeitung</h3>\n' +
		'<p>Über die Dauer der Datenverarbeitung informieren wir Sie weiter unten, sofern wir weitere Informationen dazu haben. Beispielsweise speichert die Social-Media-Plattform Facebook Daten, bis sie für den eigenen Zweck nicht mehr benötigt werden. Kundendaten, die mit den eigenen Userdaten abgeglichen werden, werden aber schon innerhalb von zwei Tagen gelöscht. Generell verarbeiten wir personenbezogene Daten nur so lange wie es für die Bereitstellung unserer Dienstleistungen und Produkte unbedingt notwendig ist.</p>\n' +
		'<h3>Widerspruchsrecht</h3>\n' +
		'<p>Sie haben auch jederzeit das Recht und die Möglichkeit Ihre Einwilligung zur Verwendung von Single-Sign-On-Anmeldungen zu widerrufen. Das funktioniert meist über Opt-Out-Funktionen des Anbieters. Wenn vorhanden, finden Sie in unseren Datenschutztexten zu den einzelnen Tools auch Links zu den entsprechenden Opt-Out-Funktionen.</p>\n' +
		'<h3>Rechtsgrundlage</h3>\n' +
		'<p>Wenn es mit Ihnen vereinbart wurde und dies im Rahmen der Vertragserfüllung (Artikel 6 Absatz 1 lit. b DSGVO) und der Einwilligung (Artikel 6 Absatz 1 lit. a DSGVO) erfolgt, können wir das Single-Sign-On-Verfahren auf deren Rechtsgrundlagen einsetzen.</p>\n' +
		'<p>Zusätzlich zur Einwilligung besteht von unserer Seite ein berechtigtes Interesse darin, Ihnen ein schnelles und einfaches Anmeldeverfahren zu bieten. Die Rechtsgrundlage dafür ist Art. 6 Abs. 1 lit. f DSGVO (Berechtigte Interessen). Wir setzen die Single-Sign-On-Anmeldung gleichwohl nur ein, soweit Sie eine Einwilligung erteilt haben.</p>\n' +
		'<p>Wenn Sie diese Verknüpfung zu dem Anbieter mit der Single-Sign-On-Anmeldung nicht mehr haben wollen, lösen Sie bitte diese in Ihrem Userkonto bei dem jeweiligen Anbieter auf. Falls Sie auch Daten bei uns löschen wollen, ist eine Kündigung Ihrer Registrierung notwendig.</p>\n' +
		'<h2 id="google-single-sign-on-datenschutzerklaerung">Google Single-Sign-On Datenschutzerklärung</h2>\n' +
		'<p>Wir nutzen für die Anmeldung auf unserer Website auch den Authentifizierungsdienst Google Single-Sign-On. Dienstanbieter ist das amerikanische Unternehmen Facebook Inc. Für den europäischen Raum ist das Unternehmen Google Ireland Limited (Gordon House, Barrow Street Dublin 4, Irland) für alle Google-Dienste verantwortlich.</p>\n' +
		'<p>Google verarbeitet Daten von Ihnen u.a. auch in den USA. Google ist aktiver Teilnehmer des EU-US Data Privacy Frameworks, wodurch der korrekte und sichere Datentransfer personenbezogener Daten von EU-Bürgern in die USA geregelt wird. Mehr Informationen dazu finden Sie auf <a href="https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en" target="_blank" rel="follow noopener"> https://commission.europa.eu/document/fa09cbad-dd7d-4684-ae60-be03fcb0fddf_en</a>.</p>\n' +
		'<p>Zudem verwendet Google sogenannte Standardvertragsklauseln (= Art. 46. Abs. 2 und 3 DSGVO). Standardvertragsklauseln (Standard Contractual Clauses – SCC) sind von der EU-Kommission bereitgestellte Mustervorlagen und sollen sicherstellen, dass Ihre Daten auch dann den europäischen Datenschutzstandards entsprechen, wenn diese in Drittländer (wie beispielsweise in die USA) überliefert und dort gespeichert werden. Durch das EU-US Data Privacy Framework und durch die Standardvertragsklauseln verpflichtet sich Google, bei der Verarbeitung Ihrer relevanten Daten, das europäische Datenschutzniveau einzuhalten, selbst wenn die Daten in den USA gespeichert, verarbeitet und verwaltet werden. Diese Klauseln basieren auf einem Durchführungsbeschluss der EU-Kommission. Sie finden den Beschluss und die entsprechenden Standardvertragsklauseln u.a. hier: <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de" target="_blank" rel="follow noopener">https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj?locale=de</a>\n' +
		'</p>\n' +
		'<p>Die Google Ads Datenverarbeitungsbedingungen (Google Ads Data Processing Terms), welche auf die Standardvertragsklauseln verweisen, finden Sie unter <a href="https://business.safety.google/intl/de/adsprocessorterms/" target="_blank" rel="follow noopener">https://business.safety.google/intl/de/adsprocessorterms/</a>.</p>\n' +
		'<p>Bei Google können Sie unter <a href="https://adssettings.google.com/authenticated" target="_blank" rel="follow noopener">https://adssettings.google.com/authenticated</a> Ihre Einwilligung zur Verwendung von Single-Sign-On-Anmeldungen per Opt-Out-Funktion widerrufen. Mehr über die Daten, die durch die Verwendung von Google Single-Sign-On verarbeitet werden, erfahren Sie in der Privacy Policy auf <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="follow noopener">https://policies.google.com/privacy?hl=de</a>.</p>\n' +
		'<h2 id="erklaerung-verwendeter-begriffe">Erklärung verwendeter Begriffe</h2>\n' +
		'<p>Wir sind stets bemüht unsere Datenschutzerklärung so klar und verständlich wie möglich zu verfassen. Besonders bei technischen und rechtlichen Themen ist das allerdings nicht immer ganz einfach. Es macht oft Sinn juristische Begriffe (wie z. B. personenbezogene Daten) oder bestimmte technische Ausdrücke (wie z. B. Cookies, IP-Adresse) zu verwenden. Wir möchte diese aber nicht ohne Erklärung verwenden. Nachfolgend finden Sie nun eine alphabetische Liste von wichtigen verwendeten Begriffen, auf die wir in der bisherigen Datenschutzerklärung vielleicht noch nicht ausreichend eingegangen sind. Falls diese Begriffe der DSGVO entnommen wurden und es sich um Begriffsbestimmungen handelt, werden wir hier auch die DSGVO-Texte anführen und gegebenenfalls noch eigene Erläuterungen hinzufügen.</p>\n' +
		'<h2 id="auftragsverarbeiter">Auftragsverarbeiter</h2>\n' +
		'<p>\n' +
		'<strong>Begriffsbestimmung nach Artikel 4 der DSGVO</strong>\n' +
		'</p>\n' +
		'<p>Im Sinne dieser Verordnung bezeichnet der Ausdruck:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>„Auftragsverarbeiter“</strong> eine natürliche oder juristische Person, Behörde, Einrichtung oder andere Stelle, die personenbezogene Daten im Auftrag des Verantwortlichen verarbeitet;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Erläuterung:</strong> Wir sind als Unternehmen und Websiteinhaber für alle Daten, die wir von Ihnen verarbeiten verantwortlich. Neben den Verantwortlichen kann es auch sogenannte Auftragsverarbeiter geben. Dazu zählt jedes Unternehmen bzw. jede Person, die in unserem Auftrag personenbezogene Daten verarbeitet. Auftragsverarbeiter können folglich, neben Dienstleistern wie Steuerberater, etwa auch Hosting- oder Cloudanbieter, Bezahlungs- oder Newsletter-Anbieter oder große Unternehmen wie beispielsweise Google oder Microsoft sein.</p>\n' +
		'<h2 id="einwilligung">Einwilligung</h2>\n' +
		'<p>\n' +
		'<strong>Begriffsbestimmung nach Artikel 4 der DSGVO</strong>\n' +
		'</p>\n' +
		'<p>Im Sinne dieser Verordnung bezeichnet der Ausdruck:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>„Einwilligung“</strong> der betroffenen Person jede freiwillig für den bestimmten Fall, in informierter Weise und unmissverständlich abgegebene Willensbekundung in Form einer Erklärung oder einer sonstigen eindeutigen bestätigenden Handlung, mit der die betroffene Person zu verstehen gibt, dass sie mit der Verarbeitung der sie betreffenden personenbezogenen Daten einverstanden ist;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Erläuterung: </strong>In der Regel erfolgt bei Websites eine solche Einwilligung über ein Cookie-Consent-Tool. Sie kennen das bestimmt. Immer wenn Sie erstmals eine Website besuchen, werden Sie meist über einen Banner gefragt, ob Sie der Datenverarbeitung zustimmen bzw. einwilligen. Meist können Sie auch individuelle Einstellungen treffen und so selbst entscheiden, welche Datenverarbeitung Sie erlauben und welche nicht. Wenn Sie nicht einwilligen, dürfen auch keine personenbezogene Daten von Ihnen verarbeitet werden. Grundsätzlich kann eine Einwilligung natürlich auch schriftlich, also nicht über ein Tool, erfolgen.</p>\n' +
		'<h2 id="personenbezogene-daten">Personenbezogene Daten</h2>\n' +
		'<p>\n' +
		'<strong>Begriffsbestimmung nach Artikel 4 der DSGVO</strong>\n' +
		'</p>\n' +
		'<p>Im Sinne dieser Verordnung bezeichnet der Ausdruck:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<strong>\n' +
		'<em>„personenbezogene Daten“</em>\n' +
		'</strong>\n' +
		'<em> alle Informationen, die sich auf eine identifizierte oder identifizierbare natürliche Person (im Folgenden „betroffene Person“) beziehen; als identifizierbar wird eine natürliche Person angesehen, die direkt oder indirekt, insbesondere mittels Zuordnung zu einer Kennung wie einem Namen, zu einer Kennnummer, zu Standortdaten, zu einer Online-Kennung oder zu einem oder mehreren besonderen Merkmalen, die Ausdruck der physischen, physiologischen, genetischen, psychischen, wirtschaftlichen, kulturellen oder sozialen Identität dieser natürlichen Person sind, identifiziert werden kann;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Erläuterung:</strong> Personenbezogene Daten sind also all jene Daten, die Sie als Person identifizieren können. Das sind in der Regel Daten wie etwa:</p>\n' +
		'<ul>\n' +
		'<li>Name</li>\n' +
		'<li>Adresse</li>\n' +
		'<li>E-Mail-Adresse</li>\n' +
		'<li>Post-Anschrift</li>\n' +
		'<li>Telefonnummer</li>\n' +
		'<li>Geburtsdatum</li>\n' +
		'<li>Kennnummern wie Sozialversicherungsnummer, Steueridentifikationsnummer, Personalausweisnummer oder Matrikelnummer</li>\n' +
		'<li>Bankdaten wie Kontonummer, Kreditinformationen, Kontostände uvm.</li>\n' +
		'</ul>\n' +
		'<p>Laut Europäischem Gerichtshof (EuGH) zählt auch Ihre <strong>IP-Adresse zu den personenbezogenen Daten</strong>. IT-Experten können anhand Ihrer IP-Adresse zumindest den ungefähren Standort Ihres Geräts und in weiterer Folge Sie als Anschlussinhabers feststellen. Daher benötigt auch das Speichern einer IP-Adresse eine Rechtsgrundlage im Sinne der DSGVO. Es gibt auch noch sogenannte <strong>„besondere Kategorien“</strong> der personenbezogenen Daten, die auch besonders schützenswert sind. Dazu zählen:</p>\n' +
		'<ul>\n' +
		'<li>rassische und ethnische Herkunft</li>\n' +
		'<li>politische Meinungen</li>\n' +
		'<li>religiöse bzw. weltanschauliche Überzeugungen</li>\n' +
		'<li>die Gewerkschaftszugehörigkeit</li>\n' +
		'<li>genetische Daten wie beispielsweise Daten, die aus Blut- oder Speichelproben entnommen werden</li>\n' +
		'<li>biometrische Daten (das sind Informationen zu psychischen, körperlichen oder verhaltenstypischen Merkmalen, die eine Person identifizieren können).<br />\n' +
		'Gesundheitsdaten</li>\n' +
		'<li>Daten zur sexuellen Orientierung oder zum Sexualleben</li>\n' +
		'</ul>\n' +
		'<h2 id="profiling">Profiling</h2>\n' +
		'<p>\n' +
		'<strong>Begriffsbestimmung nach Artikel 4 der DSGVO</strong>\n' +
		'</p>\n' +
		'<p>Im Sinne dieser Verordnung bezeichnet der Ausdruck:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>„Profiling“</strong> jede Art der automatisierten Verarbeitung personenbezogener Daten, die darin besteht, dass diese personenbezogenen Daten verwendet werden, um bestimmte persönliche Aspekte, die sich auf eine natürliche Person beziehen, zu bewerten, insbesondere um Aspekte bezüglich Arbeitsleistung, wirtschaftliche Lage, Gesundheit, persönliche Vorlieben, Interessen, Zuverlässigkeit, Verhalten, Aufenthaltsort oder Ortswechsel dieser natürlichen Person zu analysieren oder vorherzusagen;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Erläuterung:</strong> Beim Profiling werden verschiedene Informationen über eine Person zusammengetragen, um daraus mehr über diese Person zu erfahren. Im Webbereich wird Profiling häufig für Werbezwecke oder auch für Bonitätsprüfungen angewandt. Web- bzw. Werbeanalyseprogramme sammeln zum Beispiel Daten über Ihre Verhalten und Ihre Interessen auf einer Website. Daraus ergibt sich ein spezielles Userprofil, mit dessen Hilfe Werbung gezielt an eine Zielgruppe ausgespielt werden kann.</p>\n' +
		'<p>&nbsp;</p>\n' +
		'<h2 id="verantwortlicher">Verantwortlicher</h2>\n' +
		'<p>\n' +
		'<strong>Begriffsbestimmung nach Artikel 4 der DSGVO</strong>\n' +
		'</p>\n' +
		'<p>Im Sinne dieser Verordnung bezeichnet der Ausdruck:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<em>\n' +
		'<strong>„Verantwortlicher“</strong> die natürliche oder juristische Person, Behörde, Einrichtung oder andere Stelle, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten entscheidet; sind die Zwecke und Mittel dieser Verarbeitung durch das Unionsrecht oder das Recht der Mitgliedstaaten vorgegeben, so kann der Verantwortliche beziehungsweise können die bestimmten Kriterien seiner Benennung nach dem Unionsrecht oder dem Recht der Mitgliedstaaten vorgesehen werden;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Erläuterung:</strong> In unserem Fall sind wir für die Verarbeitung Ihrer personenbezogenen Daten verantwortlich und folglich der &#8220;Verantwortliche&#8221;. Wenn wir erhobene Daten zur Verarbeitung an andere Dienstleister weitergeben, sind diese &#8220;Auftragsverarbeiter&#8221;. Dafür muss ein &#8220;Auftragsverarbeitungsvertrag (AVV)&#8221; unterzeichnet werden.</p>\n' +
		'<p>&nbsp;</p>\n' +
		'<h2 id="verarbeitung">Verarbeitung</h2>\n' +
		'<p>\n' +
		'<strong>Begriffsbestimmung nach Artikel 4 der DSGVO</strong>\n' +
		'</p>\n' +
		'<p>Im Sinne dieser Verordnung bezeichnet der Ausdruck:</p>\n' +
		'<blockquote>\n' +
		'<p>\n' +
		'<strong>\n' +
		'<em>„Verarbeitung“</em>\n' +
		'</strong>\n' +
		'<em> jeden mit oder ohne Hilfe automatisierter Verfahren ausgeführten Vorgang oder jede solche Vorgangsreihe im Zusammenhang mit personenbezogenen Daten wie das Erheben, das Erfassen, die Organisation, das Ordnen, die Speicherung, die Anpassung oder Veränderung, das Auslesen, das Abfragen, die Verwendung, die Offenlegung durch Übermittlung, Verbreitung oder eine andere Form der Bereitstellung, den Abgleich oder die Verknüpfung, die Einschränkung, das Löschen oder die Vernichtung;</em>\n' +
		'</p>\n' +
		'</blockquote>\n' +
		'<p>\n' +
		'<strong>Anmerkung: </strong>Wenn wir in unserer Datenschutzerklärung von Verarbeitung sprechen, meinen wir damit jegliche Art von Datenverarbeitung. Dazu zählt, wie oben in der originalen DSGVO-Erklärung erwähnt, nicht nur das Erheben sondern auch das Speichern und Verarbeiten von Daten.</p>\n' +
		'<p>Alle Texte sind urheberrechtlich geschützt.</p>\n' +
		'<p style="margin-top:15px">Quelle: Erstellt mit dem <a href="https://www.adsimple.at/datenschutz-generator/" title="Datenschutz Generator Österreich von AdSimple">Datenschutz Generator Österreich</a> von AdSimple</p>\n',
	'VERIFY_MAIL': {
		'SUCCESS': 'Email erfolgreich verifiziert.',
		'ERROR': 'Fehler beim verifizieren der Email',
		'ERROR_HELP': 'Die Email kann vom Loginbereich erneut gesendet werden.',
		'BACK_HOME': 'Zur Startseite'
	},
	'DOWNLOAD': {
		'HEADLINE': 'Editor herunterladen',
		'DESCRIPTION': 'Der Editor ist auch als Desktopanwendung verfügbar. Das hat den Vorteil, dass die Simulation um einiges schneller ist, als in der Webversion. Die App kann hier heruntergeladen werden.',
		'DOWNLOAD': 'Herunterladen',
		'DATE': 'Datum',
		'FILE_SIZE': 'Dateigröße'
	},
	'NOT_FOUND': {
		'TEXT': 'Die angegebene Seite konnte nicht gefunden werden.',
		'BACK': 'Zur Startseite'
	},
	'MAILS': {
		'VERIFY_MAIL_REGISTER': {
			'SUBJECT': 'Willkommen bei Logigator',
			'WELCOME': 'Willkommen bei Logigator:',
			'PLEASE_VERIFY': 'Bitte verifiziere deine E-Mail Adresse.',
			'TO_DO_SO': 'Um sie jetzt zu verifizieren',
			'CLICK_HERE': 'klicke hier',
			'HAVE_FUN': 'Viel Spaß beim Verwenden von Logigator!'
		},
		'VERIFY_MAIL_EMAIL_UPDATE': {
			'SUBJECT': 'Verifiziere deine neue Email',
			'CHANGED': 'Deine Email-Addresse wurde kürzlich geändert.',
			'PLEASE_VERIFY': 'Bitte verifiziere deine E-Mail Adresse.',
			'TO_DO_SO': 'Um sie jetzt zu verifizieren',
			'CLICK_HERE': 'klicke hier',
			'HAVE_FUN': 'Viel Spaß beim Verwenden von Logigator!'
		}
	}
};
