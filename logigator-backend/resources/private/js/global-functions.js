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
 *
 * @param {HTMLFormElement} formElement
 */
window.startFormValidation = function (formElement) {
	const validationFunctions = {
		isNotEmpty: value => value !== undefined && value !== null && value !== '',
		minLength: (value, valData) => value.length >= Number(valData),
		maxLength: (value, valData) => value.length <= Number(valData),
		isEmail: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
		matches: (value, valData) => new RegExp(valData).test(value),
		matchesProperty: (value, valData, elements) => elements.namedItem(valData).value === value
	};

	const submitButton = formElement.querySelector('button[type="submit"]');
	const formElements = formElement.elements;

	const formErrorConfig = generateFormErrorConfig(formElements);

	for (const elementErrorConfig of formErrorConfig) {
		updateElementState(elementErrorConfig, Bem.hasState(elementErrorConfig.formContainer, 'invalid'));

		elementErrorConfig.element.addEventListener('input', () => {
			elementErrorConfig.touched = true;
			updateElementState(elementErrorConfig);
		});
	}

	function updateElementState(elementErrorConfig, defaultInvalid) {
		elementErrorConfig.valid = true;
		elementErrorConfig.errors.forEach(error => {
			const isValid = validationFunctions[error.errorName](elementErrorConfig.element.value, error.valData, formElements);
			if (!isValid) elementErrorConfig.valid = false;
			Bem.setState(error.errorMessage, 'shown', !isValid && elementErrorConfig.touched);
		});
		Bem.setState(elementErrorConfig.formContainer, 'invalid', defaultInvalid || !elementErrorConfig.valid && elementErrorConfig.touched);
		submitButton.disabled = !formErrorConfig.every(elemErrConf => elemErrConf.valid);
	}

	/**
	 *
	 * @param {HTMLFormControlsCollection} elements
	 */
	function generateFormErrorConfig(elements) {
		const config = [];

		for (const element of elements) {
			if (element instanceof HTMLButtonElement) continue;

			const elementConfig = {
				formContainer: element.closest('div[form-container]'),
				element: element,
				touched: false,
				valid: false,
				errors: []
			};
			const errorMessages = elementConfig.formContainer.querySelector('div[form-errors]').children;
			for (const errorMessage of errorMessages) {
				const errorName = errorMessage.getAttribute('data-error');

				if (!(errorName in validationFunctions)) continue;

				elementConfig.errors.push({
					errorName: errorName,
					valData: errorMessage.getAttribute('data-val-data'),
					errorMessage: errorMessage
				});
			}
			config.push(elementConfig);
		}
		return config;
	}
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

		startFormValidation(formElement);
		formElement.addEventListener('submit', async event => {
			event.preventDefault();

			const submitResp = await fetch(event.submitter.getAttribute('formaction') ?? formElement.action, {
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

/**
 * @param {Element} contextToCheck
 */
window.autoAdjustFontSize = function (contextToCheck) {
	contextToCheck.querySelectorAll('[auto-font-size]').forEach(node => {
		const desiredFontWidth = Number(node.getAttribute('auto-font-size'));
		const style = window.getComputedStyle(node);
		const originalWidth = Number(style.fontSize.replace('px', ''));
		const textWidth = getTextWidth(node.innerText, style.font);
		const adjustedWidth = originalWidth * (desiredFontWidth / textWidth);

		if (adjustedWidth < originalWidth) {
			node.style.fontSize = adjustedWidth + 'px';
		}

	});

	function getTextWidth(text, font) {
		if (!window.__autoFontSizeCanvas__) {
			window.__autoFontSizeCanvas__ = document.createElement('canvas');
		}
		const context2D = window.__autoFontSizeCanvas__.getContext('2d');
		context2D.font = font ?? window.getComputedStyle(this.document.body).font;
		return context2D.measureText(text).width;
	}
};
