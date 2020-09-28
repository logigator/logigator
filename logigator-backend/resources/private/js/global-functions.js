/**
 * @param {boolean?} open toggle if undefined
 */
window.setBurgerMenuState = function (open) {
	const burgerMenu = document.querySelector('.partial-burger-menu');
	const burgerMenuBackground = document.querySelector('.partial-burger-menu__background');
	if (open !== undefined) {
		Bem.setState(burgerMenu, 'open', open);
		Bem.setState(burgerMenuBackground, 'open', open);
	} else {
		open = !Bem.hasState(burgerMenu, 'open');
		Bem.setState(burgerMenu, 'open', open);
		Bem.setState(burgerMenuBackground, 'open', open);
	}
};

/**
 * @param {Function} func
 * @param {number} debounce
 * @return {Function}
 */
window.debounceFunction = function (func, debounce) {
	let timeout;

	return function() {
		const context = this;
		const args = arguments;

		const later = function() {
			timeout = null;
			func.apply(context, args);
		};

		clearTimeout(timeout);
		timeout = setTimeout(later, debounce);
	};
};

/**
 * @param {string} popupUrl
 * @param {Element} insertionPoint
 * @param {string} [formDataPostUrl]
 */
window.openDynamicPopup = async function (popupUrl, insertionPoint, formDataPostUrl) {
	const resp = await fetch(popupUrl);
	insertionPoint.innerHTML = await resp.text();
	const popupElem = insertionPoint.querySelector('.partial-popup');
	Bem.elements(popupElem, 'close').forEach(elem => {
		elem.addEventListener('click', () => {
			while (insertionPoint.firstChild) {
				insertionPoint.removeChild(insertionPoint.lastChild);
			}
		});
	});
};
