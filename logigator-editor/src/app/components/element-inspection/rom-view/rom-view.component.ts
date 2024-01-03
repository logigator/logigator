// @ts-strict-ignore
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { RomData } from '../../../models/element-types/advanced/rom';
import { ElementInspectionComp } from '../element-inspection-comp';

@Component({
	selector: 'app-rom-view',
	templateUrl: './rom-view.component.html',
	styleUrls: ['./rom-view.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RomViewComponent
	extends ElementInspectionComp
	implements OnInit, OnDestroy
{
	@ViewChild('hexInput', { static: true })
	hexInput: ElementRef<HTMLDivElement>;

	leftAddress = '00000000';

	private leftAddressCache = new Map<number, string>();
	private selected: {
		index: number;
		length: number;
		value: string;
	}[] = [];

	rows = 1;

	constructor() {
		super();
	}

	ngOnInit() {
		this.hexInput.nativeElement.innerHTML = '';

		// if (!this.sprite.element.data) return;
		// const raw = atob(this.sprite.element.data as RomData);
		// let hex = '';
		// for (let i = 0; i < raw.length; i++) {
		// 	const _hex = raw.charCodeAt(i).toString(16).toUpperCase();
		// 	hex += `${_hex.length === 2 ? _hex : '0' + _hex} `;
		// }
		// this.rows = Math.ceil(hex.length / 48) || 1;
		// this.calcLeftAddresses(this.rows);
		// this.hexInput.nativeElement.innerHTML = hex;
		// this.selectAddress(this.sprite.getCurrentSimState());
		// this.sprite.onChange = (state) => this.selectAddress(state);
	}

	// eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
	ngOnDestroy(): void {
		// this.sprite.onChange = undefined;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	selectAddress(state: boolean[]) {
		// let num = 0;
		// for (let i = 0; i < this.sprite.element.numInputs; i++) {
		// 	num |= (state[i] ? 1 : 0) << i;
		// }
		for (const selection of this.selected.reverse()) {
			this.hexInput.nativeElement.innerHTML =
				this.hexInput.nativeElement.innerHTML.substring(0, selection.index) +
				selection.value +
				this.hexInput.nativeElement.innerHTML.substring(
					selection.index + selection.length
				);
		}
		this.selected = [];

		// const pos = Math.floor((num * this.sprite.element.numOutputs) / 4);
		// let endPos = Math.floor(
		// 	((num + 1) * this.sprite.element.numOutputs - 1) / 4
		// );
		// if (endPos % 2 === 0) {
		// 	this.addSelection(endPos + 1, endPos + 1);
		// 	endPos--;
		// }
		// if (pos % 2 === 1) {
		// 	this.addSelection(pos + 1, endPos);
		// 	this.addSelection(pos - 1, pos - 1);
		// } else {
		// 	this.addSelection(pos, endPos);
		// }
		// this.hexInput.nativeElement.firstElementChild?.scrollIntoView();
	}

	private addSelection(pos: number, endPos: number) {
		pos += Math.floor(pos / 2);
		endPos += Math.floor(endPos / 2);
		if (pos >= this.hexInput.nativeElement.innerHTML.length || endPos < pos)
			return;
		if (endPos >= this.hexInput.nativeElement.innerHTML.length)
			endPos = this.hexInput.nativeElement.innerHTML.length - 1;
		const selectedValue = this.hexInput.nativeElement.innerHTML.substring(
			pos,
			endPos + 1
		);
		const replacement = `<span ${this.hexInput.nativeElement.attributes[0].name}="">${selectedValue}</span>`;
		this.hexInput.nativeElement.innerHTML =
			this.hexInput.nativeElement.innerHTML.substring(0, pos) +
			replacement +
			this.hexInput.nativeElement.innerHTML.substring(endPos + 1);

		this.selected.push({
			index: pos,
			length: replacement.length,
			value: selectedValue
		});
	}

	private calcLeftAddresses(lineCount: number) {
		if (this.leftAddressCache.has(lineCount)) {
			this.leftAddress = this.leftAddressCache.get(lineCount);
		}

		let newLeftAddress = '';
		for (let i = 0; i < lineCount; i++) {
			let hexAddr = (i * 16).toString(16).toUpperCase();
			while (hexAddr.length < 8) hexAddr = '0' + hexAddr;
			newLeftAddress += hexAddr + '\n';
		}
		this.leftAddressCache.set(lineCount, newLeftAddress);
		this.leftAddress = newLeftAddress;
	}
}
