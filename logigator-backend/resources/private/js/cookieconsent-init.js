// Shared cookie-consent bootstrap. Bundled into the global site bundle for the
// server-rendered pages and, together with the vanilla-cookieconsent UMD, into
// the standalone /js/cookieconsent.js the editor loads — one config, one
// stylesheet and one consent cookie across the whole origin.

(function () {
	// Server-rendered pages carry a `.theme-dark`/`.theme-light` class on
	// <body>; its absence identifies the editor SPA.
	var isSpaPage =
		!document.body.classList.contains('theme-dark') &&
		!document.body.classList.contains('theme-light');

	// On server-rendered pages <html lang> is the user's language, so the
	// library's document auto-detection is right. The editor's <html lang> is
	// a static placeholder — resolve its language the way the editor itself
	// does (persisted choice, then the site preferences cookie, then the
	// browser).
	function spaLanguage() {
		var lang = null;
		try {
			lang = localStorage.getItem('translocoLang');
		} catch (e) { /* storage access can be denied; fall through */ }
		if (!lang) {
			var match = document.cookie.match(/(?:^|;\s*)preferences=([^;]*)/);
			if (match) {
				try {
					lang = JSON.parse(
						decodeURIComponent(match[1]).replace(/^j:/, '')
					).lang;
				} catch (e) { /* malformed cookie; fall through */ }
			}
		}
		return lang;
	}

	// The banner shows before the editor bootstraps and applies its `dark-mode`
	// class, so seed the initial state from the editor's persisted theme (its
	// default is dark).
	function spaInitiallyDark() {
		try {
			return localStorage.getItem('logigator.theme') !== 'light';
		} catch (e) {
			return true;
		}
	}

	// The banner is themed through the `.theme-dark`/`.theme-light` body class
	// plus the library's `cc--darkmode` root class. The editor signals dark
	// mode via `dark-mode` on <html> and can switch at runtime, so mirror it
	// onto the body.
	var spaBootstrapped = false;

	function syncConsentTheme() {
		spaBootstrapped =
			spaBootstrapped ||
			document.documentElement.classList.contains('dark-mode');
		var dark = isSpaPage
			? spaBootstrapped
				? document.documentElement.classList.contains('dark-mode')
				: spaInitiallyDark()
			: document.body.classList.contains('theme-dark');
		document.documentElement.classList.toggle('cc--darkmode', dark);
		if (isSpaPage) {
			document.body.classList.toggle('theme-dark', dark);
			document.body.classList.toggle('theme-light', !dark);
		}
	}

	syncConsentTheme();
	if (isSpaPage) {
		new MutationObserver(syncConsentTheme).observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});
	}

	var spaLang = isSpaPage ? spaLanguage() : null;

	// eslint-disable-next-line no-undef
	CookieConsent.run({
		language: {
			default: spaLang || 'en',
			autoDetect: spaLang ? undefined : isSpaPage ? 'browser' : 'document',
			translations: {
				en: '/cookieconsent/en.json',
				de: '/cookieconsent/de.json',
				es: '/cookieconsent/es.json',
				fr: '/cookieconsent/fr.json'
			}
		},
		categories: {
			necessary: {
				enabled: true,  // this category is enabled by default
				readOnly: true  // this category cannot be disabled
			},
			analytics: {}
		},
		cookie: {
			expiresAfterDays: 365
		},
		guiOptions: {
			consentModal: {
				layout: 'bar',
				equalWeightButtons: false
			},
			preferencesModal: {
				equalWeightButtons: false
			}
		}
	});
})();
