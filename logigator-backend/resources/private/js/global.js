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
