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

/**
 * @param {HTMLElement} node
 */
function cookieConsent(node) {
	if(!node) return;

	Bem.element(node, 'btn').addEventListener('click', () => {
		const date = new Date();
		date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
		document.cookie = `acceptedCookies=true; expires=${date.toUTCString()}; path=/`;
		node.style.display = 'none';
	});
}
cookieConsent(document.querySelector('.partial-cookie-consent'));

// GLOBAL_CALLS -----------------------------------------------------------------------------------

autoAdjustFontSize(document.body);

// ------------------------------------------------------------------------------------------------
