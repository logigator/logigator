'use strict';
const Bem = {
	bemClass(e) {
		if (1 === e.classList.length) return e.classList[0];
		for (let t = 0; t < e.classList.length; t++) if (!e.classList[t].includes('--')) return e.classList[t];
	}, element(e, t) {
		const s = Bem.bemClass(e);
		return e.querySelector('.'.concat(s, '__').concat(t));
	}, elements(e, t) {
		const s = Bem.bemClass(e);
		return e.querySelectorAll('.'.concat(s, '__').concat(t));
	}, setState(e, t, s) {
		s ? e.classList.add('is-'.concat(t)) : e.classList.remove('is-'.concat(t));
	}, hasState: (e, t) => e.classList.contains('is-'.concat(t)), toggleState(e, t) {
		e.classList.toggle('is-'.concat(t));
	}, hasModifier(e, t) {
		const s = Bem.bemClass(e);
		return e.classList.contains(''.concat(s, '--').concat(t));
	}, data: (e, t) => e.getAttribute('data-'.concat(t)), hasData: (e, t) => e.hasAttribute('data-'.concat(t))
};

async function jsonRequest(e, t) {
	return (await fetch(e, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(t)
	})).json();
}

function siteHeaderPartial(e) {
	const t = e.querySelector('.partial-settings-dropdown'), s = Bem.element(e, 'dropdown-background');
	let a = !1;
	Bem.element(e, 'dropdown-trigger').addEventListener('click', () => {
		a = !a, Bem.setState(t, 'open', a), Bem.setState(s, 'shown', a);
	}), s.addEventListener('click', () => {
		a = !1, Bem.setState(t, 'open', a), Bem.setState(s, 'shown', a);
	});
}

function settingsDropdownPartial(e) {
	const t = Bem.element(e, 'theme-select').elements.dark_mode;

	function s(e) {
		jsonRequest('/preferences/set-theme', {theme: e});
	}

	t.addEventListener('change', () => {
		document.body.classList.remove('theme-dark', 'theme-light'), t.checked ? (document.body.classList.add('theme-dark'), s('dark')) : (document.body.classList.add('theme-light'), s('light'));
	});
}

function popupPartial(e) {
	let t = Bem.hasState(e, 'open');
	Bem.data(e, 'triggers').split('::').forEach(s => {
		document.querySelector(s).addEventListener('click', () => {
			t || (Bem.setState(e, 'open', !0), t = !0);
		});
	}), Bem.elements(e, 'close').forEach(s => {
		s.addEventListener('click', () => {
			Bem.setState(e, 'open', !1), t = !1;
		});
	});
}

siteHeaderPartial(document.querySelector('.partial-site-header')), settingsDropdownPartial(document.querySelector('.partial-settings-dropdown')), document.querySelectorAll('.partial-popup').forEach(e => popupPartial(e));
//# sourceMappingURL=global-es2015.js.map
