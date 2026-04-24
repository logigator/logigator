// PARTIALS ---------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function siteHeaderPartial(node) {
	if(!node) return;

	const settingsDropdown = node.querySelector('.partial-settings-dropdown');
	const dropdownBackground = Bem.element(node, 'dropdown-background');

	let dropdownOpen = false;
	Bem.element(node, 'dropdown-trigger').addEventListener('click', () => {
		dropdownOpen = !dropdownOpen;
		Bem.setState(settingsDropdown, 'open', dropdownOpen);
		Bem.setState(dropdownBackground, 'shown', dropdownOpen);
	});

	dropdownBackground.addEventListener('click', () => {
		dropdownOpen = false;
		Bem.setState(settingsDropdown, 'open', dropdownOpen);
		Bem.setState(dropdownBackground, 'shown', dropdownOpen);
	});

	Bem.element(node, 'burger-menu').addEventListener('click', () => setBurgerMenuState());
}
siteHeaderPartial(document.querySelector('.partial-site-header'));

// ------------------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function popupPartial(node) {
	if(!node) return;

	let opened = Bem.hasState(node, 'open');

	const dataTriggers = Bem.data(node, 'triggers');

	if (dataTriggers) {
		const triggers = dataTriggers.split('::');
		triggers.forEach(trigger => {
			document.querySelector(trigger).addEventListener('click', () => {
				if (!opened) {
					setBurgerMenuState(false);
					Bem.setState(node, 'open', true);
					opened = true;
					document.dispatchEvent(new CustomEvent('popup-opened', {detail: node}));
				}
			});
		});
	}

	Bem.elements(node, 'close').forEach(elem => {
		elem.addEventListener('click', () => {
			Bem.setState(node, 'open', false);
			opened = false;
			document.dispatchEvent(new CustomEvent('popup-closed', {detail: node}));
		});
	});
}
document.querySelectorAll('.partial-popup').forEach(popup => popupPartial(popup));

for (const ytElement of document.querySelectorAll('.partial-youtube-overlay')) {
	ytElement.firstElementChild.addEventListener('click', () => {
		const iframe = document.createElement('iframe');
		iframe.setAttribute('frameborder', '0');
		iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
		iframe.setAttribute('allowfullscreen', '');
		iframe.setAttribute('title', 'YouTube Video');
		iframe.setAttribute('src', `https://www.youtube.com/embed/${ytElement.getAttribute('data-id')}?autoplay=1&rel=0`);
		iframe.setAttribute('width', ytElement.getAttribute('data-width'));
		iframe.setAttribute('height', ytElement.getAttribute('data-height'));
		iframe.setAttribute('referrerpolicy', 'strict-origin');

		ytElement.appendChild(iframe);
	}, { once: true, passive: true });
}

// ------------------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function burgerMenuBackgroundElement(node) {
	if(!node) return;

	node.addEventListener('click', () => setBurgerMenuState(false));
}
burgerMenuBackgroundElement(document.querySelector('.partial-burger-menu__background'));

// ------------------------------------------------------------------------------------------------

/**
 * @param {HTMLFormElement} form
 */
function formValidationForGlobalForms(form) {
	if (form.querySelector('button[type="submit"]')) {
		startFormValidation(form);
	}
}
document.querySelectorAll('form').forEach(form => formValidationForGlobalForms(form));

// ------------------------------------------------------------------------------------------------

// eslint-disable-next-line no-undef
CookieConsent.run({
	language: {
		default: 'en',
		autoDetect: 'document',
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

// GLOBAL_CALLS -----------------------------------------------------------------------------------

autoAdjustFontSize(document.body);

// ------------------------------------------------------------------------------------------------
