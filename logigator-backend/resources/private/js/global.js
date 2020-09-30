// PARTIALS ---------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function siteHeaderPartial(node) {
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
	let opened = Bem.hasState(node, 'open');

	const dataTriggers = Bem.data(node, 'triggers');

	if (dataTriggers) {
		const triggers = dataTriggers.split('::');
		triggers.forEach(trigger => {
			document.querySelector(trigger).addEventListener('click', () => {
				if (!opened) {
					Bem.setState(node, 'open', true);
					opened = true;
				}
			});
		});
	}

	Bem.elements(node, 'close').forEach(elem => {
		elem.addEventListener('click', () => {
			Bem.setState(node, 'open', false);
			opened = false;
		});
	});
}
document.querySelectorAll('.partial-popup').forEach(popup => popupPartial(popup));

// ------------------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function burgerMenuBackgroundElement(node) {
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
