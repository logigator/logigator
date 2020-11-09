import {ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {RomData} from '../../../models/element-types/advanced/rom';
import {ElementInspectionComp} from '../element-inspection-comp';

@Component({
	selector: 'app-rom-view',
	templateUrl: './rom-view.component.html',
	styleUrls: ['./rom-view.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RomViewComponent extends ElementInspectionComp implements OnInit, OnDestroy {

	@ViewChild('hexInput', {static: true})
	hexInput: ElementRef<HTMLDivElement>;

	leftAddress = '00000000';

	private leftAddressCache = new Map<number, string>();
	private selectedIndex;
	private selectedLength;
	private selectedValue;

	rows = 1;

	constructor() {
		super();
	}

	ngOnInit() {
		this.hexInput.nativeElement.innerHTML = '';

		if (!this.sprite.element.data) return;
		const raw = atob(this.sprite.element.data as RomData);
		let hex = '';
		for (let i = 0; i < raw.length; i++ ) {
			const _hex = raw.charCodeAt(i).toString(16).toUpperCase();
			hex += `${_hex.length === 2 ? _hex : '0' + _hex} `;
		}
		this.rows = Math.ceil(hex.length / 48) || 1;
		this.calcLeftAddresses(this.rows);
		this.hexInput.nativeElement.innerHTML = hex;
		this.selectAddress(this.sprite.getCurrentSimState());
		this.sprite.onChange = (state) => this.selectAddress(state);
	}

	ngOnDestroy(): void {
		this.sprite.onChange = undefined;
	}

	selectAddress(state: boolean[]) {
		let num = 0;
		for (let i = 0; i < this.sprite.element.numInputs; i++) {
			num |= ((state[i] ? 1 : 0) << i);
		}
		if (this.selectedLength) {
			this.hexInput.nativeElement.innerHTML =
				this.hexInput.nativeElement.innerHTML.substring(0, this.selectedIndex) +
				this.selectedValue +
				this.hexInput.nativeElement.innerHTML.substring(this.selectedIndex + this.selectedLength);
		}
		let pos = Math.floor(num * this.sprite.element.numOutputs / 4);
		pos += Math.floor(pos / 2);
		let length = Math.ceil(this.sprite.element.numOutputs / 4);
		length += Math.floor(length / 2);
		if (pos > this.hexInput.nativeElement.innerHTML.length)
			return;
		if (pos % 3 === 0 && length > 1)
			length--;
		if (pos + length > this.hexInput.nativeElement.innerHTML.length)
			length = this.hexInput.nativeElement.innerHTML.length - pos;
		this.selectedValue = this.hexInput.nativeElement.innerHTML.substr(pos, length);
		const replacement = `<span ${this.hexInput.nativeElement.attributes[0].name}="">${this.selectedValue}</span>`;
		this.hexInput.nativeElement.innerHTML =
			this.hexInput.nativeElement.innerHTML.substring(0, pos)
			+ replacement
			+ this.hexInput.nativeElement.innerHTML.substring(pos + length);
		this.hexInput.nativeElement.firstElementChild.scrollIntoView();
		this.selectedIndex = pos;
		this.selectedLength = replacement.length;
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
