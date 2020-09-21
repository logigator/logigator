// GLOBAL FUNCTIONS ------------------------------------------------------------------------------

/**
 * @param {string} path
 * @param {object} body
 * @return {Promise<object>}
 */
async function jsonRequest(path, body) {
	const resp = await fetch(path, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
	return resp.json();
}

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
	const darkModeSwitch = Bem.element(node, 'theme-select').elements['dark_mode'];
	darkModeSwitch.addEventListener('change', () => {
		document.body.classList.remove('theme-dark', 'theme-light');
		if (darkModeSwitch.checked) {
			document.body.classList.add('theme-dark');
			saveOnServer('dark');
		} else {
			document.body.classList.add('theme-light');
			saveOnServer('light');
		}
	});

	function saveOnServer(theme) {
		jsonRequest('/preferences/set-theme', {
			theme
		});
	}
}
settingsDropdownPartial(document.querySelector('.partial-settings-dropdown'));

// ------------------------------------------------------------------------------------------------

/**
 * @param {HTMLElement} node
 */
function popupPartial(node) {
	let opened = Bem.hasState(node, 'open');

	const triggers = Bem.data(node, 'triggers').split('::');
	triggers.forEach(trigger => {
		document.querySelector(trigger).addEventListener('click', () => {
			if (!opened) {
				Bem.setState(node, 'open', true);
				opened = true;
			}
		});
	});

	Bem.elements(node, 'close').forEach(elem => {
		elem.addEventListener('click', () => {
			Bem.setState(node, 'open', false);
			opened = false;
		});
	});
}
document.querySelectorAll('.partial-popup').forEach(popup => popupPartial(popup));

// ------------------------------------------------------------------------------------------------
