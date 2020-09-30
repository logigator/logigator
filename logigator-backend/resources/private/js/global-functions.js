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
 */
window.openDynamicPopup = async function (popupUrl, insertionPoint) {
	const resp = await fetch(popupUrl);
	insertionPoint.innerHTML = await resp.text();
	setupPopupHandling();

	function setupPopupHandling() {
		const popupElem = insertionPoint.querySelector('.partial-popup');
		Bem.elements(popupElem, 'close').forEach(elem => {
			elem.addEventListener('click', () => {
				while (insertionPoint.firstChild) {
					insertionPoint.removeChild(insertionPoint.lastChild);
				}
			});
		});
		const formElement = popupElem.querySelector('form');
		if (!formElement) return;

		formElement.addEventListener('submit', async event => {
			if(event.submitter.hasAttribute('formaction')) return;

			event.preventDefault();
			const submitResp = await fetch(formElement.action, {
				method: formElement.method,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				redirect: 'follow',
				body: new URLSearchParams(new FormData(formElement))
			});
			if (submitResp.redirected) {
				insertionPoint.innerHTML = await submitResp.text();
				setupPopupHandling();
			} else {
				location.reload();
			}
		});
	}

};
