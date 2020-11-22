import {HelperDelegate} from 'handlebars';

export function siHelper(): HelperDelegate {

	const siSymbols_gr = [
		'', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'
	];

	const siSymbols_lw = [
		'', 'm', 'μ', 'n', 'p', 'f', 'a', 'z', 'y'
	];

	return function(value: number, decimals?: number) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{si}} expects 1 or 2 arguments. value: number, decimals: number = 2');
		}
		if (arguments.length === 2) {
			decimals = 2;
		}

		let gr = 0;
		let lw = 0;

		for (; value >= 1000 && gr < siSymbols_gr.length; gr++) {
			value /= 1000;
		}

		for (; value > 0 && value < 1 && lw < siSymbols_lw.length; lw++) {
			value *= 1000;
		}

		return (Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)) + siSymbols_gr[gr] + siSymbols_lw[lw];
	};
}
