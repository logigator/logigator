import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'si'
})
export class SiPipe implements PipeTransform {

	private static siSymbols_gr = [
		'', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'
	];

	private static siSymbols_lw = [
		'', 'm', 'μ', 'n', 'p', 'f', 'a', 'z', 'y'
	];

	transform(value: number, decimals = 2): string {
		let gr = 0;
		let lw = 0;

		for (; value > 1000 && gr < SiPipe.siSymbols_gr.length; gr++) {
			value /= 1000;
		}

		for (; value > 0 && value < 1 && lw < SiPipe.siSymbols_lw.length; lw++) {
			value *= 1000;
		}

		return (Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)) + SiPipe.siSymbols_gr[gr] + SiPipe.siSymbols_lw[lw];
	}

}
