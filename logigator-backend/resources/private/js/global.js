// PARTIALS ---------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function siteHeaderPartial(node) {
	const settingsDropdown = node.querySelector('.partial-settings-dropdown');
	const background = Bem.element(node, 'dropdown-background');

	let dropdownOpen = false;
	Bem.element(node, 'dropdown-trigger').addEventListener('click', () => {
		dropdownOpen = !dropdownOpen;
		Bem.setState(settingsDropdown, 'open', dropdownOpen);
		Bem.setState(background, 'shown', dropdownOpen);
	});

	background.addEventListener('click', () => {
		dropdownOpen = false;
		Bem.setState(settingsDropdown, 'open', dropdownOpen);
		Bem.setState(background, 'shown', dropdownOpen);
	});
}
siteHeaderPartial(document.querySelector('.partial-site-header'));

// ------------------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function settingsDropdownPartial(node) {
	const themeForm =  Bem.element(node, 'theme-select');
	const darkModeSwitch = themeForm.elements['dark_mode'];
	darkModeSwitch.addEventListener('change', () => themeForm.submit());
}
settingsDropdownPartial(document.querySelector('.partial-settings-dropdown'));

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

	Bem.element(node, 'close').addEventListener('click', () => {
		Bem.setState(node, 'open', false);
		opened = false;
	});
}
document.querySelectorAll('.partial-popup').forEach(popup => popupPartial(popup));

// ------------------------------------------------------------------------------------------------
