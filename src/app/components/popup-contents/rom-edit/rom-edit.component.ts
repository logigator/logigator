import {ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {PopupContentComp} from '@logigator/logigator-shared-comps';
import {Element} from '../../../models/element';
import {RomData} from '../../../models/element-types/advanced/rom';

@Component({
	selector: 'app-rom-edit',
	templateUrl: './rom-edit.component.html',
	styleUrls: ['./rom-edit.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RomEditComponent extends PopupContentComp<Element> implements OnInit {

	@ViewChild('hexInput', {static: true})
	hexInput: ElementRef<HTMLTextAreaElement>;

	leftAddress = '00000000';

	private oldValue = '';

	selectionStart: number;
	selectionEnd: number;
	rows = 1;

	constructor() {
		super();
	}

	ngOnInit() {
		this.hexInput.nativeElement.value = '';

		if (!this.inputFromOpener.data) return;
		const raw = atob(this.inputFromOpener.data as RomData);
		let hex = '';
		for (let i = 0; i < raw.length; i++ ) {
			const _hex = raw.charCodeAt(i).toString(16).toUpperCase();
			hex += (_hex.length === 2 ? _hex : '0' + _hex) + ' ';

		}
		this.rows = Math.ceil(hex.length / 48) || 1;
		this.calcLeftAddresses(this.rows);
		this.hexInput.nativeElement.value = hex;
	}

	onInput(event: any) {
		this.selectionChange();
		let newValue: string | string[] = this.hexInput.nativeElement.value
			.split('')
			.map(c => c.toUpperCase())
			.filter(c => c.match(/[0-9A-F]/im));

		const newLength = newValue.length;

		newValue = newValue.reduce((previousValue, currentValue, currentIndex) => {
			return previousValue + currentValue + (currentIndex !== 0 && (currentIndex + 1) % 2 === 0 ? ' ' : '');
		}, '')
		.trimRight();

		if (newLength <= Math.ceil((this.inputFromOpener.options[0] * (2 ** this.inputFromOpener.options[1])) / 4)) {
			this.hexInput.nativeElement.value = newValue;
			this.oldValue = newValue;
		} else {
			this.hexInput.nativeElement.value = this.oldValue;
		}

		this.rows = Math.ceil(this.hexInput.nativeElement.value.length / 48) || 1;
		this.calcLeftAddresses(this.rows);
		if (event.inputType.startsWith('delete')) {
			this.hexInput.nativeElement.selectionStart = this.selectionStart;
			this.hexInput.nativeElement.selectionEnd = this.selectionEnd;
		}
	}

	private calcLeftAddresses(lineCount: number) {
		let newLeftAddress = '';
		for (let i = 0; i < lineCount; i++) {
			let hexAddr = (i * 16).toString(16).toUpperCase();
			while (hexAddr.length < 8) hexAddr = '0' + hexAddr;
			newLeftAddress += hexAddr + '\n';
		}
		this.leftAddress = newLeftAddress;
	}

	selectionChange() {
		this.selectionStart = this.hexInput.nativeElement.selectionStart;
		this.selectionEnd = this.hexInput.nativeElement.selectionEnd;
	}

	public cancel() {
		this.requestClose.emit(false);
	}

	public save() {
		const hex = this.hexInput.nativeElement.value.replace(/ /g, '');
		console.log(hex);
		const base64 = hex.match(/\w{2}/g).map((a) =>  {
			return String.fromCharCode(parseInt(a, 16));
		}).join('')
		this.requestClose.emit(btoa(base64));
	}

}
